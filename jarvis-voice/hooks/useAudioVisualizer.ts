'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { analyzeFrequencyBands, calcEnergy } from '@/services/audioAnalyzer'
import type { FrequencyBands } from '@/types'

// Module-level singletons — BrainNodes reads directly in useFrame
// bypassing React batching for instant audio reactivity (no frame lag)
export const AUDIO_BANDS: FrequencyBands = {
  subBass: 0, bass: 0, lowMid: 0, mid: 0,
  highMid: 0, presence: 0, brilliance: 0, overall: 0,
}
export const AUDIO_ENERGY = { value: 0 }

export function useAudioVisualizer() {
  const [frequencyData, setFrequencyData] = useState<Uint8Array<ArrayBuffer> | null>(null)
  const [frequencyBands, setFrequencyBands] = useState<FrequencyBands | null>(null)
  const [energy, setEnergy] = useState<number>(0)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const animationIdRef = useRef<number | null>(null)
  // Reused buffers — no GC per frame
  const dataRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const sampleRateRef = useRef<number>(44100)

  const startMicrophone = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const audioCtx = new AudioContext()
      audioCtxRef.current = audioCtx
      sampleRateRef.current = audioCtx.sampleRate

      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 1024
      analyser.smoothingTimeConstant = 0.70  // 0.85 → 0.70: faster glow response

      // DynamicsCompressor prevents saturation from loud environments
      const compressor = audioCtx.createDynamicsCompressor()
      compressor.threshold.value = -24
      compressor.knee.value = 30
      compressor.ratio.value = 12
      compressor.attack.value = 0.003
      compressor.release.value = 0.25

      const microphone = audioCtx.createMediaStreamSource(stream)
      microphone.connect(compressor)
      compressor.connect(analyser)

      analyserRef.current = analyser
      micStreamRef.current = stream
      dataRef.current = new Uint8Array(analyser.frequencyBinCount)

      const animate = () => {
        if (!analyserRef.current || !dataRef.current) return
        analyserRef.current.getByteFrequencyData(dataRef.current)
        const bands = analyzeFrequencyBands(dataRef.current, sampleRateRef.current)
        const e = calcEnergy(dataRef.current)
        // Update singletons immediately — bypasses React batching for zero-lag 3D animation
        Object.assign(AUDIO_BANDS, bands)
        AUDIO_ENERGY.value = e
        // Also update React state for HUD / voice state machine
        setFrequencyBands(bands)
        setEnergy(e)
        setFrequencyData(new Uint8Array(dataRef.current))
        animationIdRef.current = requestAnimationFrame(animate)
      }
      animate()
    } catch (err) {
      console.error('Mic access denied:', err)
    }
  }, [])

  const stopMicrophone = useCallback(() => {
    if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current)
    micStreamRef.current?.getTracks().forEach(t => t.stop())
    audioCtxRef.current?.close()
    audioCtxRef.current = null
    analyserRef.current = null
    setFrequencyData(null)
    setFrequencyBands(null)
    setEnergy(0)
  }, [])

  // Stop mic and cancel rAF loop if component unmounts while recording
  useEffect(() => {
    return () => {
      if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current)
      micStreamRef.current?.getTracks().forEach(t => t.stop())
      audioCtxRef.current?.close()
      audioCtxRef.current = null
      analyserRef.current = null
    }
  }, [])

  return { frequencyData, frequencyBands, energy, startMicrophone, stopMicrophone }
}
