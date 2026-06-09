'use client'

import { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { ConnectionData } from '@/types'
import { ANIM } from '@/hooks/useNeuralAnimation'

interface Props {
  connections: ConnectionData[]
}

const CURVE_SEGMENTS = 10

export default function BrainConnections({ connections }: Props) {
  const geomRef = useRef<THREE.BufferGeometry>(null)
  const matRef  = useRef<THREE.LineBasicMaterial>(null)

  const { positions, colors } = useMemo(() => {
    const pts:  number[] = []
    const cols: number[] = []
    const c = new THREE.Color()

    for (const conn of connections) {
      const curvePts = conn.curve.getPoints(CURVE_SEGMENTS)
      c.set(conn.hexColor)
      for (let i = 0; i < curvePts.length - 1; i++) {
        const a = curvePts[i]
        const b = curvePts[i + 1]
        pts.push(a.x, a.y, a.z, b.x, b.y, b.z)
        // HDR brightness tapers at endpoints for organic fiber look
        const taper  = Math.sin(((i + 0.5) / CURVE_SEGMENTS) * Math.PI)
        // Level 0 = primary dendrite (bright), level 1 = secondary (dim)
        const levelMult = (conn.dendriticLevel ?? 1) === 0 ? 4.5 : 2.0
        const bright = levelMult * taper + 0.4
        cols.push(c.r * bright, c.g * bright, c.b * bright)
        cols.push(c.r * bright, c.g * bright, c.b * bright)
      }
    }

    return {
      positions: new Float32Array(pts),
      colors:    new Float32Array(cols),
    }
  }, [connections])

  useEffect(() => {
    if (!geomRef.current) return
    geomRef.current.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geomRef.current.setAttribute('color',    new THREE.BufferAttribute(colors, 3))
    geomRef.current.computeBoundingSphere()
  }, [positions, colors])

  useFrame(() => {
    if (!matRef.current) return
    matRef.current.opacity = Math.min(1.0, ANIM.connectionOpacity + 0.2)
  })

  return (
    <lineSegments frustumCulled={false}>
      <bufferGeometry ref={geomRef} />
      <lineBasicMaterial
        ref={matRef}
        vertexColors
        transparent
        opacity={0.75}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
      />
    </lineSegments>
  )
}
