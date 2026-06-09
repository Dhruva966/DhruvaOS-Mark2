import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export interface CronJob {
  id: string;
  name: string;
  schedule: string;
  last_run: string | null;
  status: 'active' | 'disabled' | 'unknown';
}

export async function GET(request: NextRequest) {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;

  const hermesUrl = process.env.HERMES_URL ?? 'http://127.0.0.1:8642';

  try {
    const res = await fetch(`${hermesUrl}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return NextResponse.json({
      crons: [] as CronJob[],
      hermes_healthy: res.ok,
      note: 'Full cron list via SSH: hermes cron list',
    });
  } catch {
    return NextResponse.json({
      crons: [] as CronJob[],
      hermes_healthy: false,
      error: 'Hermes unreachable',
    });
  }
}
