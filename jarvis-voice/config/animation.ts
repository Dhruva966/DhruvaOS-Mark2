import type { VoiceState } from '@/types'

export interface StateAnimConfig {
  emissiveBase: number   // base node emissive intensity
  coreScale: number      // BrainCore scale multiplier
  coreGlowIntensity: number
  flowSpeed: number      // particle flow speed along edges
  connectionOpacity: number
  breathingAmplitude: number
  breathingFreq: number  // Hz
  ripple: boolean
  burst: boolean
  errorFlash: boolean
  transitionDuration: number  // GSAP tween seconds
}

export const STATE_CONFIGS: Record<VoiceState, StateAnimConfig> = {
  idle: {
    emissiveBase:        1.8,   // bright enough to bloom visibly
    coreScale:           1.0,
    coreGlowIntensity:   1.2,
    flowSpeed:           0.0004,
    connectionOpacity:   0.55,
    breathingAmplitude:  0.12,
    breathingFreq:       0.35,
    ripple:              false,
    burst:               false,
    errorFlash:          false,
    transitionDuration:  1.2,
  },
  listening: {
    emissiveBase:        2.5,
    coreScale:           1.4,
    coreGlowIntensity:   2.0,
    flowSpeed:           0.0015,
    connectionOpacity:   0.75,
    breathingAmplitude:  0.05,
    breathingFreq:       1.2,
    ripple:              false,
    burst:               false,
    errorFlash:          false,
    transitionDuration:  0.5,
  },
  thinking: {
    emissiveBase:        3.2,
    coreScale:           1.8,
    coreGlowIntensity:   3.0,
    flowSpeed:           0.004,
    connectionOpacity:   0.9,
    breathingAmplitude:  0.0,
    breathingFreq:       0.0,
    ripple:              true,
    burst:               false,
    errorFlash:          false,
    transitionDuration:  0.4,
  },
  speaking: {
    emissiveBase:        4.0,
    coreScale:           2.2,
    coreGlowIntensity:   4.0,
    flowSpeed:           0.007,
    connectionOpacity:   1.0,
    breathingAmplitude:  0.0,
    breathingFreq:       0.0,
    ripple:              false,
    burst:               true,
    errorFlash:          false,
    transitionDuration:  0.3,
  },
  error: {
    emissiveBase:        0.3,
    coreScale:           0.7,
    coreGlowIntensity:   0.4,
    flowSpeed:           0.0001,
    connectionOpacity:   0.15,
    breathingAmplitude:  0.0,
    breathingFreq:       0.0,
    ripple:              false,
    burst:               false,
    errorFlash:          true,
    transitionDuration:  0.2,
  },
}

// VAD threshold — energy > this triggers listening state
export const VAD_THRESHOLD = 45
// How long to stay in error state before auto-returning to idle
export const ERROR_AUTO_RESET_MS = 3000
// Stagger delay between node activations (wave effect)
export const NODE_STAGGER_DELAY = 0.002  // seconds per node
// Ripple wave outward speed (units per second)
export const RIPPLE_SPEED = 6.0
// Ripple interval in thinking state
export const RIPPLE_INTERVAL_MS = 1500
