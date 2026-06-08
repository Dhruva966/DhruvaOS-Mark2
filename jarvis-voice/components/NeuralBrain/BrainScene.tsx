'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useNeuralNetwork } from '@/hooks/useNeuralNetwork'
import { useNeuralAnimation } from '@/hooks/useNeuralAnimation'
import BrainNodes from './BrainNodes'
import BrainConnections from './BrainConnections'
import BrainCore from './BrainCore'
import PostProcessing from './PostProcessing'
import type { VoiceState, FrequencyBands } from '@/types'

interface Props {
  voiceState?: VoiceState
  bands?: FrequencyBands | null
  isMuted?: boolean
  onToggleMute?: () => void
}

export default function BrainScene({ voiceState = 'idle', bands = null, isMuted = false, onToggleMute }: Props) {
  const { nodes, connections } = useNeuralNetwork()
  const groupRef = useRef<THREE.Group>(null)

  // Drive the ANIM singleton based on voiceState
  useNeuralAnimation(voiceState, bands)

  // Y-bounce breathing only — rotation handled by OrbitControls autoRotate
  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()
    groupRef.current.position.y = Math.sin(t * 0.55) * 0.28
    groupRef.current.position.z = Math.sin(t * 0.35) * 0.10
  })

  return (
    <>
      <OrbitControls
        enableZoom
        minDistance={3}
        maxDistance={35}
        enablePan={false}
        dampingFactor={0.08}
        enableDamping
        rotateSpeed={0.5}
        autoRotate
        autoRotateSpeed={0.3}
        zoomSpeed={0.8}
      />

      <ambientLight intensity={0.04} color={0x000820} />
      <pointLight position={[0, 10, 8]}  intensity={2.0} color={0x0055ff} />
      <pointLight position={[-8, 2, 4]}  intensity={1.2} color={0x0022aa} />
      <pointLight position={[8, -5, 4]}  intensity={0.8} color={0x001144} />

      <fog attach="fog" args={[0x000208, 30, 80]} />

      <group ref={groupRef}>
        <BrainNodes nodes={nodes} bands={bands} />
        <BrainConnections connections={connections} />
        <BrainCore isMuted={isMuted} onToggleMute={onToggleMute} />
      </group>

      <PostProcessing />
    </>
  )
}
