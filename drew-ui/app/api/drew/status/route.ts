import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;

  const hermesUrl = process.env.HERMES_URL ?? 'http://127.0.0.1:8642';
  const gbrainUrl = process.env.GBRAIN_URL ?? 'http://127.0.0.1:3131';

  const [hermesResult, gbrainResult] = await Promise.allSettled([
    fetch(`${hermesUrl}/health`, { signal: AbortSignal.timeout(2000) }).then((r) => r.ok),
    fetch(`${gbrainUrl}/health`, { signal: AbortSignal.timeout(2000) }).then((r) => r.ok),
  ]);

  return NextResponse.json({
    hermes: hermesResult.status === 'fulfilled' && hermesResult.value === true,
    gbrain: gbrainResult.status === 'fulfilled' && gbrainResult.value === true,
    timestamp: new Date().toISOString(),
  });
}
