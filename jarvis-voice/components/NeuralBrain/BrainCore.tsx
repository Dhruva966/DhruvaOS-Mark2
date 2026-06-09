'use client'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ANIM } from '@/hooks/useNeuralAnimation'
import { AUDIO_ENERGY, AUDIO_BANDS } from '@/hooks/useAudioVisualizer'

interface Props {
  isMuted?: boolean
  onToggleMute?: () => void
}

// Screen-edge targets — camera z=16, fov=65 → viewport ±18.1w × ±10.2h at z=0
// 30 arms: primary fan to screen edges + secondary branching fills + depth arms
const ARM_TARGETS: [number, number, number][] = [
  // Primary cardinal arms
  [ 26,   0,   0],   // right
  [-26,   0,   0],   // left
  [  0,  15,   0],   // top
  [  0, -15,   0],   // bottom
  // Corner arms
  [ 20,  12,   2],   // top-right
  [-20,  12,   2],   // top-left
  [ 20, -12,   2],   // bottom-right
  [-20, -12,   2],   // bottom-left
  // Secondary fan — between cardinals and corners
  [ 24,   6,   1],   // right-upper
  [ 24,  -6,   1],   // right-lower
  [-24,   6,   1],   // left-upper
  [-24,  -6,   1],   // left-lower
  [  6,  15,   1],   // top-right slight
  [ -6,  15,   1],   // top-left slight
  [  6, -15,   1],   // bottom-right slight
  [ -6, -15,   1],   // bottom-left slight
  // Depth arms — forward/back through the z-axis
  [ 10,   0,  22],   // toward viewer center
  [-10,   0,  22],   // toward viewer left
  [  0,   8,  22],   // toward viewer top
  [  0,  -8,  22],   // toward viewer bottom
  [  8,   6, -20],   // receding top-right
  [ -8,   6, -20],   // receding top-left
  [  8,  -6, -20],   // receding bottom-right
  [ -8,  -6, -20],   // receding bottom-left
  // Extra cross-screen diagonals
  [ 22,   9,  -5],   // wide right-up
  [-22,   9,  -5],   // wide left-up
  [ 22,  -9,  -5],   // wide right-down
  [-22,  -9,  -5],   // wide left-down
  [  0,   0,  28],   // straight forward
  [  0,   0, -28],   // straight back
]

const BENDS = [
  0.7, -1.2, 0.5, -0.8, 1.0, -0.6, 0.9, -1.1, 0.3, -0.4,
  0.8, -0.5, 1.1, -0.9, 0.4, -0.7, 0.6, -1.0, 0.2, -0.8,
  1.2, -0.3, 0.7, -1.1, 0.5, -0.9, 1.0, -0.4, 0.8, -0.6,
]

function buildMergedArmGeo(): THREE.BufferGeometry {
  const tubes: THREE.TubeGeometry[] = []

  for (let i = 0; i < ARM_TARGETS.length; i++) {
    const [ex, ey, ez] = ARM_TARGETS[i]
    const endpoint = new THREE.Vector3(ex, ey, ez)
    const len = endpoint.length()
    const dir = endpoint.clone().normalize()

    const perp = new THREE.Vector3(-dir.y, dir.x, 0)
    if (perp.length() < 0.01) perp.set(0, 1, 0)
    else perp.normalize()

    const bend = BENDS[i] * 2.2

    const start = dir.clone().multiplyScalar(0.55)
    const mid1  = dir.clone().multiplyScalar(len * 0.30).add(perp.clone().multiplyScalar(bend * 0.9))
    const mid2  = dir.clone().multiplyScalar(len * 0.62).add(perp.clone().multiplyScalar(bend * 0.4))

    const curve = new THREE.CatmullRomCurve3([start, mid1, mid2, endpoint])
    tubes.push(new THREE.TubeGeometry(curve, 22, 0.024, 5, false))
  }

  // Merge all tube geometries into one draw call
  let totalVerts = 0
  let totalIdx   = 0
  for (const g of tubes) {
    totalVerts += g.attributes.position.count
    if (g.index) totalIdx += g.index.count
  }

  const positions = new Float32Array(totalVerts * 3)
  const indices   = new Uint32Array(totalIdx)
  let voff = 0, ioff = 0

  for (const g of tubes) {
    const src = g.attributes.position.array as Float32Array
    positions.set(src, voff * 3)
    if (g.index) {
      const srcIdx = g.index.array
      for (let k = 0; k < srcIdx.length; k++) indices[ioff + k] = srcIdx[k] + voff
      ioff += srcIdx.length
    }
    voff += g.attributes.position.count
    g.dispose()
  }

  const merged = new THREE.BufferGeometry()
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  merged.setIndex(new THREE.BufferAttribute(indices, 1))
  return merged
}

export default function BrainCore({ isMuted = false, onToggleMute }: Props) {
  const groupRef       = useRef<THREE.Group>(null)
  const nucleusMatRef  = useRef<THREE.MeshStandardMaterial>(null)
  const outerHaloRef   = useRef<THREE.MeshBasicMaterial>(null)
  const midGlowRef     = useRef<THREE.MeshBasicMaterial>(null)

  const armGeo = useMemo(() => buildMergedArmGeo(), [])

  // Per-frame state — avoids GSAP/useFrame conflicts
  const anim = useRef({ breathPhase: 0, muteProgress: 1.0 })

  useFrame((_, delta) => {
    const group     = groupRef.current
    const nucMat    = nucleusMatRef.current
    const haloMat   = outerHaloRef.current
    const midMat    = midGlowRef.current
    if (!group || !nucMat) return

    const st = anim.current

    // Mute lerp — smooth 0↔1 over ~250ms
    const muteTarget = isMuted ? 0.0 : 1.0
    st.muteProgress += (muteTarget - st.muteProgress) * Math.min(1, delta * 7)
    const m = st.muteProgress

    // Breathing
    st.breathPhase += delta * 2.6
    const breath = 1 + Math.sin(st.breathPhase) * 0.055

    // Scale — stays near full size even when muted (0.82 → 1.0)
    group.scale.setScalar(ANIM.coreScale * breath * (0.82 + m * 0.18))

    // Audio energy boost for glow
    const e = AUDIO_ENERGY.value
    const audioBoost = m > 0.1
      ? e * (AUDIO_BANDS.mid * 0.4 + AUDIO_BANDS.highMid * 0.35 + AUDIO_BANDS.bass * 0.25) * 9.0
      : 0.0

    // Nucleus emissive — dim when muted but ALWAYS visible
    nucMat.emissiveIntensity = 0.6 + m * 2.4 + audioBoost

    // Outer halo — always faintly visible, brighter when unmuted + audio
    if (haloMat) haloMat.opacity = (0.04 + m * 0.10) * (1 + audioBoost * 0.5)
    if (midMat)  midMat.opacity  = (0.04 + m * 0.08) * (1 + audioBoost * 0.3)
  })

  return (
    <group ref={groupRef}>
      {/* Outer halo — largest, faintest, cyan tint */}
      <mesh>
        <sphereGeometry args={[2.4, 16, 16]} />
        <meshBasicMaterial
          ref={outerHaloRef}
          color={0x00aaff}
          transparent
          opacity={0.10}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Mid corona shell */}
      <mesh>
        <sphereGeometry args={[1.4, 18, 18]} />
        <meshBasicMaterial
          ref={midGlowRef}
          color={0x00ffcc}
          transparent
          opacity={0.12}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Inner bright corona */}
      <mesh>
        <sphereGeometry args={[0.85, 20, 20]} />
        <meshBasicMaterial
          color={0x66ffff}
          transparent
          opacity={0.22}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Nucleus — dark soma, clickable */}
      <mesh
        onClick={(e) => { e.stopPropagation(); onToggleMute?.() }}
        onPointerOver={() => { document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { document.body.style.cursor = 'auto' }}
      >
        <sphereGeometry args={[0.55, 28, 28]} />
        <meshStandardMaterial
          ref={nucleusMatRef}
          color={0x04000e}
          emissive={0x00aaff}
          emissiveIntensity={2.8}
          roughness={0.72}
          metalness={0.08}
          toneMapped={false}
        />
      </mesh>

      {/* Viewport-spanning tentacle arms */}
      <mesh geometry={armGeo} frustumCulled={false}>
        <meshBasicMaterial
          color={0x00ffbb}
          transparent
          opacity={0.45}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Muted indicator ring */}
      {isMuted && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.68, 0.75, 32]} />
          <meshBasicMaterial
            color={0xff2244}
            transparent
            opacity={0.9}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}
    </group>
  )
}
