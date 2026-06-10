import { NextRequest, NextResponse } from 'next/server';

// Public paths — exempt from auth. Everything else is gated by default.
const PUBLIC_PAGES = new Set<string>(['/login']);
const PUBLIC_API_PATHS = new Set<string>(['/api/auth']);

// File extensions served as static assets — pass through unauthenticated.
const STATIC_EXTENSIONS = [
  '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif',
  '.ico', '.txt', '.xml', '.json', '.woff', '.woff2', '.ttf', '.css', '.js', '.map',
];

function isStaticAsset(pathname: string): boolean {
  return STATIC_EXTENSIONS.some((ext) => pathname.endsWith(ext));
}

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PAGES.has(pathname)) return true;
  if (PUBLIC_API_PATHS.has(pathname)) return true;
  if (isStaticAsset(pathname)) return true;
  return false;
}

function isAuthenticated(request: NextRequest): boolean {
  const auth = request.cookies.get('site-auth');
  const expected = process.env.SITE_PASSWORD;
  return !!(expected && auth?.value === expected);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) return NextResponse.next();
  if (isAuthenticated(request)) return NextResponse.next();

  // API routes → JSON 401, never redirect.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Pages → redirect to /login with original path preserved.
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Match everything except Next internals + favicon. Static files outside _next
  // are filtered by isStaticAsset() above.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
