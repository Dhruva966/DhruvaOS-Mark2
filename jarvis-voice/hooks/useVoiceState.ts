'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { VAD_THRESHOLD, ERROR_AUTO_RESET_MS } from '@/config/animation'
import type { VoiceState } from '@/types'

export function useVoiceState() {
  const [state, setState] = useState<VoiceState>('idle')
  const stateRef = useRef<VoiceState>('idle')
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const transition = useCallback((next: VoiceState) => {
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current)
      errorTimerRef.current = null
    }
    stateRef.current = next
    setState(next)
    if (next === 'error') {
      errorTimerRef.current = setTimeout(() => {
        errorTimerRef.current = null
        stateRef.current = 'idle'
        setState('idle')
      }, ERROR_AUTO_RESET_MS)
    }
  }, [])

  useEffect(() => () => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
  }, [])

  // Call each frame with current audio energy (0-255 scale)
  const processAudioEnergy = useCallback((energy: number) => {
    const cur = stateRef.current
    // Only VAD-driven transitions; Gojo events handle thinking/speaking/error
    if (cur === 'idle' && energy > VAD_THRESHOLD) {
      transition('listening')
    } else if (cur === 'listening' && energy < VAD_THRESHOLD * 0.7) {
      // Hysteresis: 30% lower threshold to avoid flicker
      transition('idle')
    }
  }, [transition])

  return { state, stateRef, transition, processAudioEnergy }
}
