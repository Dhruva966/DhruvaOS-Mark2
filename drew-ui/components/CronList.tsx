'use client';

import type { CronJob } from '@/app/api/drew/crons/route';

interface CronListProps {
  crons: CronJob[];
  raw?: string;
  error?: string;
  loading: boolean;
}

function StatusBadge({ status }: { status: CronJob['status'] }) {
  const map = {
    active: 'bg-emerald-900/50 text-emerald-400 border-emerald-800',
    disabled: 'bg-zinc-800 text-zinc-500 border-zinc-700',
    unknown: 'bg-zinc-800 text-zinc-500 border-zinc-700',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${map[status]}`}>
      {status}
    </span>
  );
}

export default function CronList({ crons, raw, error, loading }: CronListProps) {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3 min-h-[160px]">
      <span className="text-zinc-400 text-xs uppercase tracking-widest font-medium">Cron Jobs</span>

      {loading && (
        <div className="flex-1 flex items-center justify-center text-zinc-600 text-xs">loading...</div>
      )}

      {!loading && error && !raw && (
        <div className="flex-1 flex items-center justify-center text-zinc-600 text-xs text-center px-2">
          {error}
        </div>
      )}

      {!loading && raw && (
        <pre className="text-xs text-zinc-400 font-mono whitespace-pre-wrap overflow-auto max-h-40">{raw}</pre>
      )}

      {!loading && crons.length === 0 && !error && !raw && (
        <div className="flex-1 flex items-center justify-center text-zinc-600 text-xs">no cron jobs</div>
      )}

      {!loading && crons.length > 0 && (
        <div className="space-y-2 overflow-auto">
          {crons.map((job) => (
            <div key={job.id} className="flex items-start gap-2 text-sm">
              <StatusBadge status={job.status} />
              <div className="flex-1 min-w-0">
                <div className="text-zinc-200 truncate text-xs font-medium">{job.name}</div>
                <div className="text-zinc-600 text-[10px] font-mono">{job.schedule}</div>
              </div>
              {job.last_run && (
                <div className="text-zinc-600 text-[10px] shrink-0">
                  {new Date(job.last_run).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
