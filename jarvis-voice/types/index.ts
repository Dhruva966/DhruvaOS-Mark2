import type { CatmullRomCurve3, Vector3 } from 'three'

// ── Voice state machine ──────────────────────────────────────
export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error'

export const STATE_TRANSITIONS: Record<VoiceState, VoiceState[]> = {
  idle:      ['listening'],
  listening: ['thinking', 'idle'],
  thinking:  ['speaking', 'error'],
  speaking:  ['idle'],
  error:     ['idle'],
}

// ── Brain regions ────────────────────────────────────────────
export interface RegionZone {
  xRange: [number, number]
  yRange: [number, number]
}

export interface BrainRegion {
  id: string
  name: string
  color: string
  hexColor: number
  zone: RegionZone
}

// ── Neural network data ──────────────────────────────────────
export interface NodeData {
  id: number
  position: Vector3
  regionId: string
  color: string
  hexColor: number
  emissiveIntensity: number
  scale: number
  isSoma?: boolean
}

export interface ConnectionData {
  id: number
  fromId: number
  toId: number
  curve: CatmullRomCurve3
  regionColor: string
  hexColor: number
  opacity: number
  dendriticLevel?: number  // 0=primary (bright), 1=secondary (dim)
}

// ── Gojo SSE events (matches gojo-v1 backend types) ─────────
export type SessionEventType =
  | 'task_started'
  | 'step_started'
  | 'approval_required'
  | 'agent_started'
  | 'agent_update'
  | 'agent_done'
  | 'task_done'
  | 'error'

export interface SessionEvent {
  id: string
  sessionId: string
  type: SessionEventType
  message: string
  timestamp: string
  payload?: Record<string, string>
}

// ── Cortex status panel ──────────────────────────────────────
export type ModuleStatus = 'LIVE' | 'PLANNED' | 'ON' | 'OFF' | 'ERROR'

export interface CortexModule {
  name: string
  status: ModuleStatus
  color?: string
}

// ── Frequency bands (7-band analysis) ───────────────────────
export interface FrequencyBands {
  subBass:    number  // 20-60 Hz
  bass:       number  // 60-250 Hz
  lowMid:     number  // 250-500 Hz
  mid:        number  // 500-2000 Hz
  highMid:    number  // 2000-4000 Hz
  presence:   number  // 4000-6000 Hz
  brilliance: number  // 6000-20000 Hz
  overall:    number  // weighted average (VAD energy)
}
