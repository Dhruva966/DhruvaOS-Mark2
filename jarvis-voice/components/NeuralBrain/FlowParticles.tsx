'use client'

import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { ConnectionData } from '@/types'
import { ANIM } from '@/hooks/useNeuralAnimation'

interface Props {
  connections: ConnectionData[]
}

const PARTICLE_COUNT = 180

interface Assignment {
  connIdx: number
  t:       number
  speed:   number
}

export default function FlowParticles({ connections }: Props) {
  const meshRef   = useRef<THREE.InstancedMesh>(null)
  const _matrix   = useMemo(() => new THREE.Matrix4(), [])
  const _color    = useMemo(() => new THREE.Color(), [])
  const _pos      = useMemo(() => new THREE.Vector3(), [])

  const assignments = useMemo<Assignment[]>(() => {
    if (connections.length === 0) return []
    return Array.from({ length: PARTICLE_COUNT }, () => ({
      connIdx: Math.floor(Math.random() * connections.length),
      t:       Math.random(),
      speed:   0.4 + Math.random() * 0.9,
    }))
  }, [connections])

  // Set initial colors
  useEffect(() => {
    if (!meshRef.current || connections.length === 0) return
    const mesh = meshRef.current
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const a = assignments[i]
      if (!a) continue
      const conn = connections[a.connIdx]
      if (!conn) continue
      _color.set(conn.hexColor)
      _color.multiplyScalar(4.0)
      mesh.setColorAt(i, _color)
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [assignments, connections, _color])

  useFrame((_, delta) => {
    if (!meshRef.current || connections.length === 0) return
    const mesh = meshRef.current
    const baseSpeed = ANIM.flowSpeed * 55

    let colorDirty = false

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const a = assignments[i]
      if (!a) continue

      a.t += delta * baseSpeed * a.speed
      if (a.t > 1) {
        a.t = 0
        a.connIdx = Math.floor(Math.random() * connections.length)
        a.speed = 0.4 + Math.random() * 0.9
        const conn = connections[a.connIdx]
        if (conn) {
          _color.set(conn.hexColor)
          _color.multiplyScalar(4.0)
          mesh.setColorAt(i, _color)
          colorDirty = true
        }
      }

      const conn = connections[a.connIdx]
      if (!conn) continue

      conn.curve.getPoint(a.t, _pos)
      const fade = Math.sin(a.t * Math.PI)
      const s = 0.05 + fade * 0.08
      _matrix.makeScale(s, s, s)
      _matrix.setPosition(_pos)
      mesh.setMatrixAt(i, _matrix)
    }

    mesh.instanceMatrix.needsUpdate = true
    if (colorDirty && mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  if (connections.length === 0) return null

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, PARTICLE_COUNT]}
      frustumCulled={false}
    >
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial
        vertexColors
        toneMapped={false}
        transparent
        opacity={0.95}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </instancedMesh>
  )
}
