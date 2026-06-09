'use client';

interface ActivityFeedProps {
  activity: string[];
  error?: string;
  loading: boolean;
}

export default function ActivityFeed({ activity, error, loading }: ActivityFeedProps) {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3 min-h-[120px]">
      <span className="text-zinc-400 text-xs uppercase tracking-widest font-medium">Activity</span>

      {loading && (
        <div className="flex-1 flex items-center justify-center text-zinc-600 text-xs">loading...</div>
      )}

      {!loading && error && activity.length === 0 && (
        <div className="flex-1 flex items-center text-zinc-700 text-xs">{error}</div>
      )}

      {!loading && activity.length === 0 && !error && (
        <div className="flex-1 flex items-center text-zinc-600 text-xs">no recent activity</div>
      )}

      {!loading && activity.length > 0 && (
        <div className="space-y-1.5 overflow-auto max-h-40">
          {activity.map((line, i) => (
            <div key={i} className="text-[11px] text-zinc-400 font-mono leading-relaxed truncate" title={line}>
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
