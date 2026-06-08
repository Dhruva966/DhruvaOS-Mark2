import type { BrainRegion, CortexModule } from '@/types'

// ── Node / connection counts ─────────────────────────────────
export const NODE_COUNT = 280
export const MAX_CONNECTIONS = 640
export const MAX_CONNECT_DIST = 10
export const KNN_K = 5

// ── Sphere distribution ──────────────────────────────────────
// Camera z=16, fov=65 → viewport ±18.1 wide × ±10.2 tall at z=0
// Sphere radius 9 fills ~88% of vertical height; from any angle it's a true sphere
export const SPHERE_RADIUS = 9

// ── Soma configuration ───────────────────────────────────────
// Top N nodes by connection count become soma (cell bodies)
export const SOMA_COUNT = 20
export const SOMA_SCALE_MIN = 0.38
export const SOMA_SCALE_MAX = 0.62

// ── Biorealistic fluorescence colors ────────────────────────
// Mirrors common fluorescent staining used in neuroscience microscopy:
// GFP (green), CFP (cyan), YFP (yellow), RFP (red-orange), mCherry, etc.
export const BRAIN_REGIONS: BrainRegion[] = [
  {
    id: 'cfp',
    name: 'CFP',
    color: '#00ddff',
    hexColor: 0x00ddff,
    zone: { xRange: [-9, 9], yRange: [4, 9] },   // top cap — cyan
  },
  {
    id: 'gfp_a',
    name: 'GFP-A',
    color: '#00ff66',
    hexColor: 0x00ff66,
    zone: { xRange: [-9, 0], yRange: [0, 4] },   // upper-left — GFP green
  },
  {
    id: 'yfp',
    name: 'YFP',
    color: '#ffee00',
    hexColor: 0xffee00,
    zone: { xRange: [0, 9], yRange: [0, 4] },    // upper-right — yellow
  },
  {
    id: 'gfp_b',
    name: 'GFP-B',
    color: '#aaffcc',
    hexColor: 0xaaffcc,
    zone: { xRange: [-3, 3], yRange: [-2, 2] },  // center cluster — pale green
  },
  {
    id: 'rfp',
    name: 'RFP',
    color: '#ff4422',
    hexColor: 0xff4422,
    zone: { xRange: [-9, 0], yRange: [-4, 0] },  // lower-left — red-orange
  },
  {
    id: 'mag',
    name: 'MAGENTA',
    color: '#ee44ff',
    hexColor: 0xee44ff,
    zone: { xRange: [0, 9], yRange: [-4, 0] },   // lower-right — magenta
  },
  {
    id: 'org',
    name: 'ORANGE',
    color: '#ff8800',
    hexColor: 0xff8800,
    zone: { xRange: [-9, 9], yRange: [-9, -4] }, // bottom cap — orange
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
