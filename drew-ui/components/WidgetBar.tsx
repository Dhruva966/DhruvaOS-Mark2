'use client';

interface WidgetBarProps {
  hermes: boolean | null;
  gbrain: boolean | null;
  memoryEntries: number | null;
  cronCount: number;
  lastActivity: string | null;
  loading: boolean;
}

function Dot({ ok }: { ok: boolean | null }) {
  if (ok === null) return <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-600" />;
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full ${
        ok
          ? 'bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.7)]'
          : 'bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.7)]'
      }`}
    />
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-none items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-1 text-xs whitespace-nowrap">
      {children}
    </div>
  );
}

export default function WidgetBar({
  hermes, gbrain, memoryEntries, cronCount, lastActivity, loading,
}: WidgetBarProps) {
  return (
    <div className="flex-none flex items-center gap-2 overflow-x-auto border-b border-zinc-900 px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {/* Services */}
      <Chip>
        <Dot ok={hermes} />
        <span className="text-zinc-400">Hermes</span>
        <span className="text-zinc-700">·</span>
        <Dot ok={gbrain} />
        <span className="text-zinc-400">GBrain</span>
      </Chip>

      {/* Memory entries */}
      <Chip>
        <span className="text-zinc-500">Memory</span>
        <span className="font-medium tabular-nums text-zinc-200">
          {loading ? '—' : (memoryEntries ?? '—').toLocaleString()}
        </span>
      </Chip>

      {/* Cron count */}
      {(cronCount > 0 || !loading) && (
        <Chip>
          <span className="text-zinc-500">Crons</span>
          <span className="font-medium tabular-nums text-zinc-200">
            {loading ? '—' : cronCount}
          </span>
        </Chip>
      )}

      {/* Latest activity */}
      {lastActivity && (
        <Chip>
          <span className="text-zinc-500">Activity</span>
          <span className="max-w-[180px] truncate font-mono text-[10px] text-zinc-400">
            {lastActivity}
          </span>
        </Chip>
      )}
    </div>
  );
}
