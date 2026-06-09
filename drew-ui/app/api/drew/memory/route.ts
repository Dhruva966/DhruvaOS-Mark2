import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;

  const gbrainUrl = process.env.GBRAIN_URL ?? 'http://127.0.0.1:3131';

  try {
    const res = await fetch(`${gbrainUrl}/health`, {
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const data = await res.json() as { status?: string; version?: string };
      return NextResponse.json({
        total_entries: null,
        last_dream: null,
        status: data.status ?? 'ok',
        version: data.version ?? null,
      });
    }
    return NextResponse.json({
      total_entries: null,
      last_dream: null,
      status: 'unavailable',
      error: 'GBrain health check failed',
    });
  } catch {
    return NextResponse.json({
      total_entries: null,
      last_dream: null,
      status: 'unavailable',
      error: 'GBrain unreachable',
    });
  }
}
