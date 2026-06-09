'use client'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useNeuralAnimation } from '@/hooks/useNeuralAnimation'
import { useNeuralNetwork } from '@/hooks/useNeuralNetwork'
import SingleNeuron from './SingleNeuron'
import BrainNodes from './BrainNodes'
import BrainConnections from './BrainConnections'
import PostProcessing from './PostProcessing'
import type { VoiceState, FrequencyBands } from '@/types'

// Distant extracellular particles — hint of other neurons in the void
function BackgroundField() {
  const geo = useMemo(() => {
    const pts: number[] = []
    const cols: number[] = []
    const rng = (s: number) => Math.abs(Math.sin(s * 127.1 + 311.7) * 43758.5) % 1
    for (let i = 0; i < 180; i++) {
      const r = 18 + rng(i) * 28
      const theta = rng(i * 2) * Math.PI * 2
      const phi   = Math.acos(2 * rng(i * 3) - 1)
      pts.push(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi))
      // Faint blue or cyan colour
      const c = rng(i * 5) > 0.5 ? [0.02, 0.18, 0.6] : [0.08, 0.35, 0.65]
      const b = 0.04 + rng(i * 7) * 0.12
      cols.push(c[0]*b, c[1]*b, c[2]*b)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3))
    g.setAttribute('color',    new THREE.BufferAttribute(new Float32Array(cols), 3))
    return g
  }, [])

  return (
    <points geometry={geo}>
      <pointsMaterial vertexColors size={0.14} sizeAttenuation transparent opacity={0.6}
        depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
    </points>
  )
}

interface Props {
  voiceState?: VoiceState
  bands?: FrequencyBands | null
  isMuted?: boolean
  onToggleMute?: () => void
}

export default function BrainScene({ voiceState = 'idle', bands = null, isMuted = false, onToggleMute }: Props) {
  const groupRef = useRef<THREE.Group>(null)
  const { nodes, connections } = useNeuralNetwork()

  // Drive ANIM singleton from voice state
  useNeuralAnimation(voiceState, bands)

  // Slow organic drift — neuron feels alive
  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()
    groupRef.current.position.y = Math.sin(t * 0.32) * 0.18
    groupRef.current.position.x = Math.sin(t * 0.21) * 0.10
  })

  return (
    <>
      <OrbitControls
        enableZoom
        minDistance={2}
        maxDistance={42}
        enablePan={false}
        dampingFactor={0.06}
        enableDamping
        rotateSpeed={0.4}
        autoRotate
        autoRotateSpeed={0.5}
        zoomSpeed={0.7}
      />

      {/* Jarvis blue lighting */}
      <ambientLight intensity={0.02} color={0x000c20} />
      <pointLight position={[0, 0, 0]} intensity={0.5} color={0x0055ff} decay={2} />
      <pointLight position={[-6, -4, -8]} intensity={0.35} color={0x0022ff} decay={2} />

      {/* Pitch-black void at distance */}
      <fog attach="fog" args={[0x000005, 24, 72]} />

      <BackgroundField />

      <group ref={groupRef}>
        {/* Ambient node network drifts with the neuron as one unit */}
        <BrainNodes nodes={nodes} />
        <BrainConnections connections={connections} />
        <SingleNeuron isMuted={isMuted} onToggleMute={onToggleMute} />
      </group>

      <PostProcessing />
    </>
  )
}
