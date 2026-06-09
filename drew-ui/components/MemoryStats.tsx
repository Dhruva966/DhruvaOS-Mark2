'use client';

interface MemoryStatsProps {
  totalEntries: number | null;
  lastDream: string | null;
  status: string;
  version: string | null;
  loading: boolean;
}

export default function MemoryStats({ totalEntries, lastDream, status, version, loading }: MemoryStatsProps) {
  const dreamFmt = lastDream
    ? new Date(lastDream).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-zinc-400 text-xs uppercase tracking-widest font-medium">Memory</span>
        {version && <span className="text-zinc-700 text-[10px] font-mono">{version}</span>}
      </div>

      {loading ? (
        <div className="text-zinc-600 text-xs">loading...</div>
      ) : (
        <div className="space-y-2">
          <div className="flex justify-between items-baseline">
            <span className="text-zinc-500 text-xs">Entries</span>
            <span className="text-zinc-100 text-lg font-light tabular-nums">
              {totalEntries !== null ? totalEntries.toLocaleString() : '—'}
            </span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-zinc-500 text-xs">Last dream</span>
            <span className="text-zinc-300 text-xs">{dreamFmt ?? '—'}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-zinc-500 text-xs">Status</span>
            <span
              className={`text-xs ${status === 'unavailable' ? 'text-red-500' : status === 'alive' || status === 'ok' ? 'text-emerald-400' : 'text-zinc-400'}`}
            >
              {status}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
