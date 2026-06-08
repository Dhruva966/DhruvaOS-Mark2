'use client'

export default function BriefingHeader() {
  const now = new Date()
  const dateStr = `${String(now.getMonth() + 1).padStart(2, '0')} / ${String(now.getDate()).padStart(2, '0')}`

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 select-none pointer-events-none">
      <div
        style={{ fontFamily: 'Space Mono, monospace' }}
        className="flex items-center gap-2 border border-cyan-500/30 bg-black/40 px-3 py-1 text-[9px] tracking-[0.2em] text-cyan-400 uppercase backdrop-blur-sm"
      >
        <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        N BRIEFING — LIVE &nbsp; {dateStr}
      </div>
    </div>
  )
}
