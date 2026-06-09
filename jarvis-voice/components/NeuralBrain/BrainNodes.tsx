'use client'

import { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { NodeData } from '@/types'
import { ANIM, RIPPLE_SPEED } from '@/hooks/useNeuralAnimation'
import { AUDIO_BANDS, AUDIO_ENERGY } from '@/hooks/useAudioVisualizer'

interface Props {
  nodes: NodeData[]
  bands?: unknown  // kept for API compat — use AUDIO_BANDS singleton instead
}

const _matrix = new THREE.Matrix4()
const _color  = new THREE.Color()
const _tmpPos = new THREE.Vector3()

export default function BrainNodes({ nodes, bands }: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const count   = nodes.length

  // Per-node phase offsets — computed once
  const phases = useMemo(
    () => Float32Array.from({ length: count }, (_, i) => i * 0.04),
    [count]
  )

  // Initial matrix + color setup
  useEffect(() => {
    if (!meshRef.current) return
    const mesh = meshRef.current
    for (let i = 0; i < count; i++) {
      const n = nodes[i]
      _matrix.makeScale(n.scale, n.scale, n.scale)
      _matrix.setPosition(n.position)
      mesh.setMatrixAt(i, _matrix)
      _color.set(n.hexColor)
      mesh.setColorAt(i, _color)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [nodes, count])

  useFrame(({ clock }, delta) => {
    if (!meshRef.current) return
    const mesh = meshRef.current
    const t = clock.getElapsedTime()

    // Advance ripple
    if (ANIM.rippleActive) {
      ANIM.rippleRadius += delta * RIPPLE_SPEED
      if (ANIM.rippleRadius > 15) {
        ANIM.rippleActive = false
        ANIM.rippleRadius = 0
      }
    }

    // Audio boost via singleton — zero-lag, bypasses React batching
    const audioBoost = AUDIO_ENERGY.value > 0
      ? (AUDIO_BANDS.mid * 0.5 + AUDIO_BANDS.highMid * 0.3 + AUDIO_BANDS.bass * 0.2) * 1.5
      : 0

    for (let i = 0; i < count; i++) {
      const n = nodes[i]
      const phase = phases[i]

      // Scale: slow breathing per node
      const breath = 1 + 0.12 * Math.sin(t * 0.6 + phase)
      const driftX  = Math.sin(t * 0.25 + phase * 3.7) * 0.08
      const driftY  = Math.cos(t * 0.20 + phase * 2.9) * 0.07
      const driftZ  = Math.sin(t * 0.18 + phase * 4.1) * 0.05
      const s = n.scale * breath

      _tmpPos.set(
        n.position.x + driftX,
        n.position.y + driftY,
        n.position.z + driftZ
      )
      _matrix.makeScale(s, s, s)
      _matrix.setPosition(_tmpPos)
      mesh.setMatrixAt(i, _matrix)

      // Brightness = base intensity + audio + ripple wave
      let intensity = ANIM.nodeIntensity + audioBoost

      if (ANIM.rippleActive) {
        const dist = n.position.length()
        const wave = Math.exp(-Math.pow(dist - ANIM.rippleRadius, 2) / 4)
        intensity += wave * 3.0
      }

      if (ANIM.errorFlash > 0) {
        _color.setRGB(ANIM.errorFlash * 1.5, 0.05, 0.05)
      } else {
        _color.set(n.hexColor)
        _color.multiplyScalar(Math.min(6.0, Math.max(0.1, intensity)))
      }
      mesh.setColorAt(i, _color)
    }

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      frustumCulled={false}
    >
      <sphereGeometry args={[1, 10, 10]} />
      <meshBasicMaterial
        toneMapped={false}
        vertexColors
        transparent
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  )
}
