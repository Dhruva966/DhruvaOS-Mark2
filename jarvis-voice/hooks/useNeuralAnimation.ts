'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { STATE_CONFIGS, RIPPLE_INTERVAL_MS, RIPPLE_SPEED } from '@/config/animation'
import type { VoiceState, FrequencyBands } from '@/types'

export interface AnimState {
  coreScale: number
  coreGlowIntensity: number
  connectionOpacity: number
  flowSpeed: number
  nodeIntensity: number
  rippleRadius: number
  rippleActive: boolean
  errorFlash: number
}

// ── Module-level singleton ────────────────────────────────────
// Shared across all Three.js components; GSAP tweens this directly.
// No prop-passing needed — components read from this object in useFrame.
export const ANIM: AnimState = {
  coreScale:         1.0,
  coreGlowIntensity: 1.2,
  connectionOpacity: 0.55,
  flowSpeed:         0.0004,
  nodeIntensity:     1.8,
  rippleRadius:      0,
  rippleActive:      false,
  errorFlash:        0,
}

// ── Hook (call once, from BrainScene) ────────────────────────
export function useNeuralAnimation(
  voiceState: VoiceState,
  _bands: FrequencyBands | null
) {
  const tweenRef      = useRef<gsap.core.Tween | null>(null)
  const rippleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const cfg = STATE_CONFIGS[voiceState]

    tweenRef.current?.kill()
    tweenRef.current = gsap.to(ANIM, {
      duration: cfg.transitionDuration,
      ease: 'power2.inOut',
      coreScale:         cfg.coreScale,
      coreGlowIntensity: cfg.coreGlowIntensity,
      connectionOpacity: cfg.connectionOpacity,
      flowSpeed:         cfg.flowSpeed,
      nodeIntensity:     cfg.emissiveBase,
    })

    if (rippleTimerRef.current) {
      clearInterval(rippleTimerRef.current)
      rippleTimerRef.current = null
    }
    if (cfg.ripple) {
      const fireRipple = () => {
        ANIM.rippleRadius = 0
        ANIM.rippleActive = true
      }
      fireRipple()
      rippleTimerRef.current = setInterval(fireRipple, RIPPLE_INTERVAL_MS)
    } else {
      ANIM.rippleActive = false
    }

    if (cfg.errorFlash) {
      gsap.fromTo(ANIM, { errorFlash: 0 }, {
        errorFlash: 1,
        duration: 0.15,
        repeat: 5,
        yoyo: true,
        ease: 'none',
        onComplete: () => { ANIM.errorFlash = 0 },
      })
    }

    return () => {
      if (rippleTimerRef.current) clearInterval(rippleTimerRef.current)
      tweenRef.current?.kill()
    }
  }, [voiceState])
}

// Expose ripple speed constant for BrainNodes
export { RIPPLE_SPEED }
