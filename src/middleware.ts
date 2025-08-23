
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
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Define role-based access control
  const roleAccess: Record<string, string[]> = {
    'SUPER ADMIN': ['/admin'],
    'OWNER': ['/owner'],
    'OPRATOR BP': ['/'],
    'SOPIR': ['/sopir', '/checklist-alat', '/kegiatan', '/riwayat-kegiatan', '/absensi', '/riwayat-saya'],
    'SOPIR DT': ['/sopir', '/checklist-alat', '/kegiatan', '/riwayat-kegiatan', '/catat-rit-bongkar', '/absensi', '/riwayat-saya'],
    'KEPALA MEKANIK': ['/kepala-mekanik', '/kepala-mekanik/absensi', '/kepala-mekanik/kegiatan', '/kepala-mekanik/riwayat-kegiatan', '/riwayat-saya'],
    'KEPALA WORKSHOP': ['/workshop'],
    'ADMIN BP': ['/admin-bp', '/job-mix-formula', '/database-produksi', '/stok-material', '/ubah-password'],
    'ADMIN LOGISTIK MATERIAL': ['/admin-logistik-material', '/stok-material-logistik'],
    'QC': ['/qc', '/riwayat-uji-tekan'],
    'PEKERJA BONGKAR SEMEN': ['/bongkar-semen', '/catat-aktivitas-bongkar', '/riwayat-bongkar-semen', '/absensi', '/riwayat-saya'],
    'HRD PUSAT': ['/hrd-pusat'],
  };

  if(user) {
    const userJabatan = user.jabatan.toUpperCase();
    const allowedPaths = Object.entries(roleAccess)
      .filter(([jabatan, _]) => userJabatan.includes(jabatan))
      .flatMap(([_, paths]) => paths);

    const isAuthorized = allowedPaths.some(allowedPath => pathname.startsWith(allowedPath));

    if (!isAuthorized && !publicPaths.includes(pathname) && pathname !== '/') {
        // Allow access to root for all logged-in users, otherwise check authorization
        if(pathname !== '/') {
            const rootRedirect = new URL('/', request.url);
            // You can add a query param to show an "Access Denied" message on the dashboard
            // rootRedirect.searchParams.set('error', 'access_denied');
            return NextResponse.redirect(rootRedirect);
        }
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
