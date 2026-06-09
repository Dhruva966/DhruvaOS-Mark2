import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

/**
 * Call at the top of every API route handler.
 * Returns a 401 NextResponse if the request is not authenticated;
 * returns null if the request is allowed to proceed.
 */
export function requireAuth(request: NextRequest): NextResponse | null {
  const auth = request.cookies.get('site-auth');
  const expected = process.env.SITE_PASSWORD;
  if (!expected || !auth?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const authBuf = Buffer.from(auth.value);
  const expBuf = Buffer.from(expected);
  const match =
    authBuf.length === expBuf.length && timingSafeEqual(authBuf, expBuf);
  if (!match) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
