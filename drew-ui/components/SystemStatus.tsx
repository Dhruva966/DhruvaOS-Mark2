'use client';

interface SystemStatusProps {
  hermes: boolean | null;
  gbrain: boolean | null;
  timestamp: string | null;
  loading: boolean;
}

function StatusDot({ ok, loading }: { ok: boolean | null; loading: boolean }) {
  if (loading) return <span className="inline-block w-2 h-2 rounded-full bg-zinc-600 animate-pulse" />;
  if (ok === null) return <span className="inline-block w-2 h-2 rounded-full bg-zinc-600" />;
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${ok ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]'}`}
    />
  );
}

export default function SystemStatus({ hermes, gbrain, timestamp, loading }: SystemStatusProps) {
  const fmt = timestamp
    ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-zinc-400 text-xs uppercase tracking-widest font-medium">System</span>
        {fmt && <span className="text-zinc-600 text-xs">{fmt}</span>}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2.5">
          <StatusDot ok={hermes} loading={loading} />
          <span className="text-sm text-zinc-300">Hermes</span>
          <span className={`ml-auto text-xs ${hermes ? 'text-emerald-500' : 'text-red-500'}`}>
            {loading ? '...' : hermes ? 'active' : 'offline'}
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <StatusDot ok={gbrain} loading={loading} />
          <span className="text-sm text-zinc-300">GBrain</span>
          <span className={`ml-auto text-xs ${gbrain ? 'text-emerald-500' : 'text-red-500'}`}>
            {loading ? '...' : gbrain ? 'active' : 'offline'}
          </span>
        </div>
      </div>
    </div>
  );
}
