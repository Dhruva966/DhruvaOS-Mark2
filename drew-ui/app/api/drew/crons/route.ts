import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { requireAuth } from '@/lib/auth';

const execAsync = promisify(exec);

const OMEN_PATH = [
  '/home/dhruva/.nvm/versions/node/v24.16.0/bin',
  '/home/dhruva/.bun/bin',
  '/home/dhruva/.local/bin',
  '/home/dhruva/.hermes/bin',
  '/usr/local/sbin',
  '/usr/local/bin',
  '/usr/sbin',
  '/usr/bin',
  '/sbin',
  '/bin',
].join(':');

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

  try {
    const { stdout } = await execAsync('hermes cron list --json', {
      env: { ...process.env, PATH: OMEN_PATH },
      timeout: 5000,
    });
    const parsed = JSON.parse(stdout);
    const crons: CronJob[] = Array.isArray(parsed) ? parsed : [];
    return NextResponse.json({ crons });
  } catch {
    // Hermes might not support --json; try plain output
    try {
      const { stdout } = await execAsync('hermes cron list', {
        env: { ...process.env, PATH: OMEN_PATH },
        timeout: 5000,
      });
      return NextResponse.json({ crons: [], raw: stdout.trim() });
    } catch (err2) {
      return NextResponse.json({
        crons: [],
        error: `hermes cron list unavailable: ${err2 instanceof Error ? err2.message : String(err2)}`,
      });
    }
  }
}
