'use client'

interface Props {
  isListening?: boolean
  voiceState?: string
}

export default function ListeningIndicator({ isListening = false, voiceState = 'idle' }: Props) {
  const active = isListening || voiceState === 'listening'

  return (
    <div className="absolute bottom-5 left-6 select-none pointer-events-none">
      <div
        style={{ fontFamily: 'Space Mono, monospace' }}
        className={`text-[9px] tracking-[0.2em] uppercase flex items-center gap-2 ${
          active ? 'text-green-400' : 'text-cyan-600/60 animate-blink'
        }`}
      >
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${
          active ? 'bg-green-400' : 'bg-cyan-600/50'
        }`} />
        MIC LISTENING FOR &apos;HEY DREW&apos;
      </div>
      {voiceState !== 'idle' && (
        <div
          style={{ fontFamily: 'Space Mono, monospace' }}
          className="mt-1 text-[8px] tracking-[0.15em] text-cyan-500/60 uppercase"
        >
          &gt; STATE: {voiceState.toUpperCase()}
        </div>
      )}
    </div>
  )
}
