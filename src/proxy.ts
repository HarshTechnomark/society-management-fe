import { NextResponse, type NextRequest } from 'next/server';

/**
 * Maps the host to the route group (module 01, section 11.1). `admin.societyapp.in/today` is served by
 * `app/(admin)/admin/today`. On localhost (no audience host) every group is reachable by its path prefix,
 * for example http://localhost:3000/admin. Unknown hosts get 404.
 */
const AUDIENCES: Record<string, string> = {
  platform: '/platform',
  admin: '/admin',
  my: '/resident',
  gate: '/gate',
  work: '/work',
};
const PREFIXES = Object.values(AUDIENCES);
/** Public pages (module 02) are shared by every host and are never rewritten into an audience group. */
const PUBLIC_PATHS = [
  '/login',
  '/forgot',
  '/reset',
  '/setup',
  '/signup',
  '/invite',
  '/verify-email',
  '/support',
  '/support-handoff',
  '/_next',
];

export function proxy(req: NextRequest) {
  const host = (req.headers.get('host') ?? '').split(':')[0];
  const sub = host.split('.')[0];
  const url = req.nextUrl.clone();

  // Local development and preview deployments: no rewriting.
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.vercel.app'))
    return NextResponse.next();

  const prefix = AUDIENCES[sub];
  if (!prefix) {
    // The bare platform domain serves only the public group.
    if (host === (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'societyapp.in')) {
      return PREFIXES.some(p => url.pathname.startsWith(p))
        ? new NextResponse(null, { status: 404 })
        : NextResponse.next();
    }
    return new NextResponse(null, { status: 404 });
  }
  if (url.pathname.startsWith(prefix)) return NextResponse.next();
  // Public pages (login and so on) are shared by every host and are not rewritten.
  if (url.pathname === '/' || PUBLIC_PATHS.some(p => url.pathname === p || url.pathname.startsWith(p + '/')))
    return NextResponse.next();
  url.pathname = `${prefix}${url.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'] };
