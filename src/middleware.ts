
import { NextResponse, type NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { cookies } from 'next/headers';

export async function middleware(request: NextRequest) {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  const { user } = session;
  const { pathname } = request.nextUrl;

  const publicPaths = ['/login'];
  const isAccessingPublicPath = publicPaths.includes(pathname);

  // If user is not logged in and is trying to access a protected route
  if (!user && !isAccessingPublicPath) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Define role-based access control
  const roleAccess: { [key: string]: string[] } = {
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
  
  const getHomePageForRole = (jabatan: string): string => {
    const role = jabatan.toUpperCase();
    if (role.includes('SUPER ADMIN')) return '/admin';
    if (role.includes('OWNER')) return '/owner';
    if (role.includes('OPRATOR BP')) return '/';
    if (role.includes('SOPIR')) return '/sopir'; // Catches both SOPIR and SOPIR DT
    if (role.includes('KEPALA MEKANIK')) return '/kepala-mekanik';
    if (role.includes('KEPALA WORKSHOP')) return '/workshop';
    if (role.includes('ADMIN BP')) return '/admin-bp';
    if (role.includes('ADMIN LOGISTIK MATERIAL')) return '/admin-logistik-material';
    if (role.includes('QC')) return '/qc';
    if (role.includes('PEKERJA BONGKAR SEMEN')) return '/bongkar-semen';
    if (role.includes('HRD PUSAT')) return '/hrd-pusat';
    return '/login'; // Fallback to login if no role matches
  };


  if (user) {
    const userHomePage = getHomePageForRole(user.jabatan);

    // If user is logged in and trying to access the login page, redirect them to their homepage.
    if (isAccessingPublicPath) {
      return NextResponse.redirect(new URL(userHomePage, request.url));
    }

    // Check if user is authorized to access the requested path
    const userJabatan = user.jabatan.toUpperCase();
    const allowedPaths = Object.entries(roleAccess)
      .filter(([jabatan, _]) => userJabatan.includes(jabatan))
      .flatMap(([_, paths]) => paths);
    
    // Check if the current path starts with any of the allowed paths
    const isAuthorized = allowedPaths.some(allowedPath => pathname.startsWith(allowedPath));

    if (!isAuthorized) {
        // If not authorized, redirect to their designated home page
        return NextResponse.redirect(new URL(userHomePage, request.url));
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
