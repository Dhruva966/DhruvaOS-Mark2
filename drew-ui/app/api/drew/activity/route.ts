import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;

  const hermesUrl = process.env.HERMES_URL ?? 'http://127.0.0.1:8642';

  try {
    const res = await fetch(`${hermesUrl}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    const statusLine = res.ok ? 'Hermes online' : 'Hermes unhealthy';
    return NextResponse.json({
      activity: [statusLine],
      note: 'Full log via SSH: tail -f ~/.hermes/logs/gateway.log',
    });
  } catch {
    return NextResponse.json({
      activity: [],
      error: 'Hermes unreachable',
    });
  }
}
