'use client'

import { CORTEX_MODULES } from '@/config/neural'
import type { CortexModule, ModuleStatus } from '@/types'

interface Props {
  overrides?: Partial<Record<string, ModuleStatus>>
}

function StatusDot({ status, color }: { status: ModuleStatus; color?: string }) {
  if (status === 'LIVE') {
    return (
      <span
        className="dot-live"
        style={color ? { background: color, boxShadow: `0 0 6px ${color}` } : undefined}
      />
    )
  }
  if (status === 'ON') return <span className="dot-on" />
  if (status === 'ERROR') return <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500" />
  return <span className="dot-planned" />
}

function ModuleRow({ mod }: { mod: CortexModule }) {
  const statusColor =
    mod.status === 'LIVE'    ? (mod.color ?? '#00ff88') :
    mod.status === 'ON'      ? '#00ff88' :
    mod.status === 'ERROR'   ? '#ff4444' :
    '#334455'

  return (
    <div className="flex items-center justify-between gap-3 py-[3px]">
      <span
        style={{ fontFamily: 'Space Mono, monospace' }}
        className="text-[8px] tracking-[0.12em] text-cyan-300/70 uppercase min-w-[80px]"
      >
        {mod.name}
      </span>
      <div className="flex items-center gap-1.5">
        <span
          style={{ fontFamily: 'Space Mono, monospace', color: statusColor }}
          className="text-[8px] tracking-[0.1em] uppercase"
        >
          {mod.status}
        </span>
        <StatusDot status={mod.status} color={mod.color} />
      </div>
    </div>
  )
}

export default function CortexStatusPanel({ overrides = {} }: Props) {
  const modules = CORTEX_MODULES.map(m => ({
    ...m,
    status: (overrides[m.name] ?? m.status) as ModuleStatus,
  }))

  return (
    <div className="absolute right-5 top-1/2 -translate-y-1/2 select-none pointer-events-none">
      <div
        className="border border-cyan-500/20 bg-black/50 px-3 py-3 backdrop-blur-sm"
        style={{ minWidth: 160 }}
      >
        {/* Panel header */}
        <div className="mb-2 border-b border-cyan-500/20 pb-2">
          <div
            style={{ fontFamily: 'Playfair Display, serif' }}
            className="text-[8px] tracking-[0.2em] text-cyan-400/80 uppercase"
          >
            NEURLINK
          </div>
          <div
            style={{ fontFamily: 'Space Mono, monospace' }}
            className="text-[7px] tracking-[0.15em] text-cyan-600/60 uppercase"
          >
            CORTEX STATUS
          </div>
        </div>

        {/* Module rows */}
        <div className="divide-y divide-cyan-900/30">
          {modules.map(m => (
            <ModuleRow key={m.name} mod={m} />
          ))}
        </div>
      </div>
    </div>
  )
}
