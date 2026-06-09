import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

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

const LOG_PATH = `${os.homedir()}/.hermes/logs/gateway.log`;

export async function GET() {
  try {
    const { stdout } = await execAsync(`tail -n 80 "${LOG_PATH}"`, {
      env: { ...process.env, PATH: OMEN_PATH },
      timeout: 3000,
    });
    const lines = stdout
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .slice(-8);
    return NextResponse.json({ activity: lines });
  } catch {
    return NextResponse.json({ activity: [], error: 'Hermes log unavailable' });
  }
}
