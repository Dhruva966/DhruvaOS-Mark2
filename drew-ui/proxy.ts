import { NextRequest, NextResponse } from 'next/server';

// Page routes that require auth (redirect to login on failure)
const PROTECTED_PAGES = ['/drew', '/content', '/jarvis'];

// API routes that require auth (return 401 JSON on failure)
// /api/auth is intentionally excluded — it IS the login endpoint
const PROTECTED_API_PREFIXES = [
  '/api/voice/',
  '/api/drew/',
  '/api/content/',
];

function isAuthenticated(request: NextRequest): boolean {
  const auth = request.cookies.get('site-auth');
  const expected = process.env.SITE_PASSWORD;
  return !!(expected && auth?.value === expected);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check protected API routes first — return 401, never redirect
  const isProtectedApi = PROTECTED_API_PREFIXES.some((p) =>
    pathname.startsWith(p)
  );
  if (isProtectedApi) {
    if (!isAuthenticated(request)) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Check protected page routes — redirect to login
  const isProtectedPage = PROTECTED_PAGES.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );
  if (!isProtectedPage) return NextResponse.next();

  if (isAuthenticated(request)) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/drew/:path*',
    '/content/:path*',
    '/jarvis/:path*',
    '/api/voice/:path*',
    '/api/drew/:path*',
    '/api/content/:path*',
  ],
};
