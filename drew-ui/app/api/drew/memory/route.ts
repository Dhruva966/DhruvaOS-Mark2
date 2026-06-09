import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

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

export async function GET() {
  try {
    const { stdout } = await execAsync('gbrain onboard --check --json', {
      env: { ...process.env, PATH: OMEN_PATH },
      timeout: 6000,
    });
    const data = JSON.parse(stdout);
    return NextResponse.json({
      total_entries: data.total_entries ?? data.entries ?? data.count ?? 0,
      last_dream: data.last_dream ?? data.last_run ?? data.dream_last_ran ?? null,
      status: data.status ?? 'ok',
      version: data.version ?? null,
    });
  } catch {
    // Try gbrain --version just to confirm it's alive
    try {
      const { stdout } = await execAsync('gbrain --version', {
        env: { ...process.env, PATH: OMEN_PATH },
        timeout: 3000,
      });
      return NextResponse.json({
        total_entries: null,
        last_dream: null,
        status: 'alive',
        version: stdout.trim(),
      });
    } catch {
      return NextResponse.json({
        total_entries: null,
        last_dream: null,
        status: 'unavailable',
        error: 'gbrain not reachable',
      });
    }
  }
}
