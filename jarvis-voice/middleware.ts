import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const auth = request.cookies.get('site-auth');
  const expected = process.env.SITE_PASSWORD;

  if (!expected) {
    // SITE_PASSWORD not set — allow through (dev mode)
    return NextResponse.next();
  }

  if (auth?.value === expected) {
    return NextResponse.next();
  }

  // API routes get JSON 401; page routes get a redirect message
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/');
  return new NextResponse(
    isApiRoute
      ? JSON.stringify({ error: 'Unauthorized' })
      : `<!DOCTYPE html><html><head><title>Access restricted</title></head><body style="font-family:sans-serif;text-align:center;padding:4rem"><h1>Access restricted</h1><p>Visit <a href="https://dhruvavutukury.org/jarvis">dhruvavutukury.org/jarvis</a> to access this interface.</p></body></html>`,
    { status: 401, headers: { 'content-type': isApiRoute ? 'application/json' : 'text/html' } }
  );
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
