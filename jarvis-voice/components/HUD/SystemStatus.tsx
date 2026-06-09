'use client'

export default function SystemStatus() {
  return (
    <div className="absolute top-6 left-6 select-none pointer-events-none">
      <div
        style={{ fontFamily: 'Playfair Display, serif' }}
        className="text-[11px] font-semibold tracking-[0.25em] text-cyan-400 uppercase"
      >
        [ D.R.E.W.
      </div>
      <div
        style={{ fontFamily: 'Space Mono, monospace' }}
        className="mt-0.5 text-[9px] tracking-[0.2em] text-cyan-600/80 uppercase flex items-center gap-2"
      >
        <span className="dot-live" />
        NEURLINK BRAIN — CONNECTED
      </div>
    </div>
  )
}
