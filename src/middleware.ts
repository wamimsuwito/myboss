import { NextResponse, type NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { cookies } from 'next/headers';

export async function middleware(request: NextRequest) {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  const { user } = session;
  const { pathname } = request.nextUrl;

  const publicPaths = ['/login'];

  // If user is not logged in and is trying to access a protected route
  if (!user && !publicPaths.includes(pathname)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // If user is logged in and is trying to access the login page
  if (user && pathname === '/login') {
    // Redirect to their designated page instead of always to '/'
    const userJabatan = user.jabatan.toUpperCase();
    let userHomePage = '/'; // Default page
    
    if (userJabatan === 'SUPER ADMIN') userHomePage = '/admin';
    else if (userJabatan === 'OWNER') userHomePage = '/owner';
    else if (userJabatan.includes('SOPIR')) userHomePage = '/sopir';
    else if (userJabatan.includes('KEPALA MEKANIK')) userHomePage = '/kepala-mekanik';
    else if (userJabatan.includes('KEPALA WORKSHOP')) userHomePage = '/workshop';
    else if (userJabatan.includes('ADMIN BP')) userHomePage = '/admin-bp';
    else if (userJabatan.includes('ADMIN LOGISTIK MATERIAL')) userHomePage = '/admin-logistik-material';
    else if (userJabatan.includes('QC')) userHomePage = '/qc';
    else if (userJabatan.includes('PEKERJA BONGKAR SEMEN')) userHomePage = '/bongkar-semen';
    else if (userJabatan.includes('HRD PUSAT')) userHomePage = '/hrd-pusat';
    
    return NextResponse.redirect(new URL(userHomePage, request.url));
  }

  // Define role-based access control
  const roleAccess: Record<string, string[]> = {
    'SUPER ADMIN': ['/admin'],
    'OWNER': ['/owner'],
    'OPRATOR BP': ['/'],
    'SOPIR': ['/sopir', '/checklist-alat', '/kegiatan', '/riwayat-kegiatan', '/absensi', '/riwayat-saya', '/ubah-password'],
    'SOPIR DT': ['/sopir', '/checklist-alat', '/kegiatan', '/riwayat-kegiatan', '/catat-rit-bongkar', '/absensi', '/riwayat-saya', '/ubah-password'],
    'KEPALA MEKANIK': ['/kepala-mekanik', '/kepala-mekanik/absensi', '/kepala-mekanik/kegiatan', '/kepala-mekanik/riwayat-kegiatan', '/riwayat-saya', '/ubah-password'],
    'KEPALA WORKSHOP': ['/workshop'],
    'ADMIN BP': ['/admin-bp', '/job-mix-formula', '/database-produksi', '/stok-material', '/ubah-password'],
    'ADMIN LOGISTIK MATERIAL': ['/admin-logistik-material', '/stok-material-logistik'],
    'QC': ['/qc', '/riwayat-uji-tekan', '/absensi', '/kegiatan', '/riwayat-kegiatan', '/riwayat-saya', '/ubah-password'],
    'PEKERJA BONGKAR SEMEN': ['/bongkar-semen', '/catat-aktivitas-bongkar', '/riwayat-bongkar-semen', '/absensi', '/riwayat-saya', '/ubah-password'],
    'HRD PUSAT': ['/hrd-pusat'],
  };

  if(user) {
    const userJabatan = user.jabatan.toUpperCase();
    const allowedPaths = Object.entries(roleAccess)
      .filter(([jabatan, _]) => userJabatan.includes(jabatan))
      .flatMap(([_, paths]) => paths);

    // If the root path '/' is not explicitly in allowedPaths, add it for roles that should default there.
    // OPRATOR BP is already set to '/'
    
    const isAuthorized = allowedPaths.some(allowedPath => pathname.startsWith(allowedPath));
    const isPublic = publicPaths.includes(pathname);

    // Check if the current path is the root path and if the user is not an Operator BP
    // If so, redirect them to their specific dashboard
    if (pathname === '/' && !userJabatan.includes('OPRATOR BP')) {
      let userHomePage = '/login'; // Default to login if no specific page
        if (userJabatan === 'SUPER ADMIN') userHomePage = '/admin';
        else if (userJabatan === 'OWNER') userHomePage = '/owner';
        else if (userJabatan.includes('SOPIR')) userHomePage = '/sopir';
        else if (userJabatan.includes('KEPALA MEKANIK')) userHomePage = '/kepala-mekanik';
        else if (userJabatan.includes('KEPALA WORKSHOP')) userHomePage = '/workshop';
        else if (userJabatan.includes('ADMIN BP')) userHomePage = '/admin-bp';
        else if (userJabatan.includes('ADMIN LOGISTIK MATERIAL')) userHomePage = '/admin-logistik-material';
        else if (userJabatan.includes('QC')) userHomePage = '/qc';
        else if (userJabatan.includes('PEKERJA BONGKAR SEMEN')) userHomePage = '/bongkar-semen';
        else if (userJabatan.includes('HRD PUSAT')) userHomePage = '/hrd-pusat';
        
        return NextResponse.redirect(new URL(userHomePage, request.url));
    }


    if (!isAuthorized && !isPublic) {
        const rootRedirect = new URL('/', request.url);
        return NextResponse.redirect(rootRedirect);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|sounds|favicon.ico|manifest.json|icons).*)',
  ],
};