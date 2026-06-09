import type { BrainRegion, CortexModule } from '@/types'

// ── Node / connection counts ─────────────────────────────────
export const NODE_COUNT = 90
export const MAX_CONNECTIONS = 200
export const MAX_CONNECT_DIST = 8
export const KNN_K = 4

// ── Sphere distribution ──────────────────────────────────────
export const SPHERE_RADIUS = 9

// ── Soma configuration ───────────────────────────────────────
export const SOMA_COUNT = 8
export const SOMA_SCALE_MIN = 0.08
export const SOMA_SCALE_MAX = 0.14

// ── Jarvis blue palette — all regions are blue/cyan variants ─
export const BRAIN_REGIONS: BrainRegion[] = [
  {
    id: 'b1',
    name: 'B1',
    color: '#0088ff',
    hexColor: 0x0088ff,
    zone: { xRange: [-9, 9], yRange: [4, 9] },
  },
  {
    id: 'b2',
    name: 'B2',
    color: '#00aaff',
    hexColor: 0x00aaff,
    zone: { xRange: [-9, 0], yRange: [0, 4] },
  },
  {
    id: 'b3',
    name: 'B3',
    color: '#44ddff',
    hexColor: 0x44ddff,
    zone: { xRange: [0, 9], yRange: [0, 4] },
  },
  {
    id: 'b4',
    name: 'B4',
    color: '#0055cc',
    hexColor: 0x0055cc,
    zone: { xRange: [-3, 3], yRange: [-2, 2] },
  },
  {
    id: 'b5',
    name: 'B5',
    color: '#88aaff',
    hexColor: 0x88aaff,
    zone: { xRange: [-9, 0], yRange: [-4, 0] },
  },
  {
    id: 'b6',
    name: 'B6',
    color: '#2266ee',
    hexColor: 0x2266ee,
    zone: { xRange: [0, 9], yRange: [-4, 0] },
  },
  {
    id: 'b7',
    name: 'B7',
    color: '#00ccff',
    hexColor: 0x00ccff,
    zone: { xRange: [-9, 9], yRange: [-9, -4] },
  },
]

// ── Cortex status panel modules ───────────────────────────────
export const CORTEX_MODULES: CortexModule[] = [
  { name: 'PREFRONTAL',  status: 'LIVE',    color: '#00ddff' },
  { name: 'MOTOR',       status: 'LIVE',    color: '#ff6b00' },
  { name: 'CONCEPT',     status: 'LIVE',    color: '#ff2d78' },
  { name: 'ASSOCIATION', status: 'LIVE',    color: '#cc44ff' },
  { name: 'SENSORY',     status: 'LIVE',    color: '#00ffdd' },
  { name: 'PREDICTIVE',  status: 'PLANNED', color: undefined },
  { name: 'FEATURE',     status: 'LIVE',    color: '#00ff66' },
  { name: 'BRAINSTEM',   status: 'LIVE',    color: '#aaffcc' },
  { name: 'HIPPOCAMPUS', status: 'LIVE',    color: '#00ff88' },
  { name: 'LANGUAGE',    status: 'LIVE',    color: '#ffee00' },
  { name: 'CEREBELLUM',  status: 'PLANNED', color: undefined },
  { name: 'REFLEX ARC',  status: 'PLANNED', color: undefined },
  { name: 'CONFIG',      status: 'ON',      color: undefined },
  { name: 'TTS',         status: 'ON',      color: undefined },
  { name: 'WEB',         status: 'ON',      color: undefined },
]
