'use client'

import { Suspense, useState, useCallback, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { useAudioVisualizer } from '@/hooks/useAudioVisualizer'
import { useVoiceState } from '@/hooks/useVoiceState'
import { useGojoEvents } from '@/hooks/useGojoEvents'
import BrainScene from './BrainScene'
import HUDOverlay from '@/components/HUD/HUDOverlay'
import type { ModuleStatus } from '@/types'

export default function BrainCanvas() {
  const { frequencyBands, energy, startMicrophone, stopMicrophone } =
    useAudioVisualizer()
  const { state: voiceState, transition, processAudioEnergy } = useVoiceState()
  const [moduleOverrides, setModuleOverrides] = useState<
    Partial<Record<string, ModuleStatus>>
  >({})
  const [micActive, setMicActive] = useState(false)

  const toggleMic = useCallback(async () => {
    if (micActive) {
      stopMicrophone()
      setMicActive(false)
    } else {
      await startMicrophone()
      setMicActive(true)
    }
  }, [micActive, startMicrophone, stopMicrophone])

  // VAD processing — use effect to avoid side-effects during render
  useEffect(() => {
    if (energy > 0) processAudioEnergy(energy)
  })

  const handleModuleUpdate = useCallback(
    (overrides: Partial<Record<string, ModuleStatus>>) => {
      setModuleOverrides(overrides)
    },
    []
  )

  // Wire Gojo SSE events → voice state + module updates
  useGojoEvents({
    onTransition: transition,
    onModuleUpdate: handleModuleUpdate,
    enabled: true,
  })

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0a0a1a]">
      {/* Three.js canvas */}
      <Canvas
        className="absolute inset-0"
        camera={{ position: [0, 0, 16], fov: 65, near: 0.1, far: 200 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
        }}
        dpr={[1, 2]}
        style={{ background: '#0a0a1a' }}
      >
        <Suspense fallback={null}>
          <BrainScene
            voiceState={voiceState}
            bands={frequencyBands}
            isMuted={!micActive}
            onToggleMute={toggleMic}
          />
        </Suspense>
      </Canvas>

      {/* HTML HUD overlay */}
      <HUDOverlay voiceState={voiceState} moduleOverrides={moduleOverrides} />

      {/* Mic status hint */}
      {!micActive && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 pointer-events-none select-none">
          <span
            style={{ fontFamily: 'Space Mono, monospace' }}
            className="text-[9px] tracking-[0.3em] text-cyan-600/40 uppercase animate-blink"
          >
            CLICK ORB TO ACTIVATE MIC
          </span>
        </div>
      )}
    </div>
  )
}
