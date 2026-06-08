'use client'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ANIM } from '@/hooks/useNeuralAnimation'
import { AUDIO_ENERGY, AUDIO_BANDS } from '@/hooks/useAudioVisualizer'

// ── Fluorescence microscopy palette ──────────────────────────────────────────
const SOMA_COLOR     = new THREE.Color(0x00ff88)  // GFP green — soma
const DENDRITE_COLOR = new THREE.Color(0x00ee77)  // GFP — dendrites
const AXON_COLOR     = new THREE.Color(0x44ccff)  // CFP cyan — axon
const SIGNAL_COLOR   = new THREE.Color(0xffffff)  // bright white — action potential

// ── Neuron geometry constants ─────────────────────────────────────────────────
const SOMA_R = 0.58

// 5 primary dendrites — spread in upper hemisphere from soma
// Axon goes lower-right (opposite to dendrite fan — realistic)
const PRIMARY_DIRS: [number, number, number][] = [
  [ 0.9,  0.7,  0.3],
  [ 0.1,  1.1, -0.2],
  [-0.9,  0.8,  0.1],
  [-1.0,  0.0,  0.2],
  [-0.4, -0.7,  0.5],
]
const AXON_DIR: [number, number, number] = [0.6, -0.9, -0.3]
const RNG_SEEDS = [1.3, 2.7, 0.9, 4.1, 3.5]
const MAX_SIGNALS = 10

interface BranchCurve {
  curve: THREE.CatmullRomCurve3
  isAxon: boolean
}

// ── Geometry builder ──────────────────────────────────────────────────────────
function buildNeuronGeometry(): {
  dendriteGeo: THREE.BufferGeometry
  axonGeo: THREE.BufferGeometry
  branches: BranchCurve[]
} {
  const dendritePts: number[] = []
  const axonPts: number[] = []
  const branches: BranchCurve[] = []

  function addBranch(
    output: number[],
    isAxon: boolean,
    start: THREE.Vector3,
    dir: THREE.Vector3,
    level: number,
    maxLevel: number,
    length: number,
    rng: number
  ): THREE.Vector3 {
    const r1 = Math.sin(rng * 7.891 + 1.23) * 0.4
    const r2 = Math.cos(rng * 3.421 + 0.77) * 0.3

    const perpA = new THREE.Vector3(-dir.y, dir.x, 0)
    if (perpA.length() < 0.01) perpA.set(1, 0, 0)
    perpA.normalize()
    const perpB = dir.clone().cross(perpA).normalize()

    const mid = start.clone()
      .add(dir.clone().multiplyScalar(length * 0.48))
      .addScaledVector(perpA, r1 * length * 0.25)
      .addScaledVector(perpB, r2 * length * 0.18)

    const tip = start.clone().add(dir.clone().multiplyScalar(length))

    const curve = new THREE.CatmullRomCurve3([start.clone(), mid, tip.clone()])
    branches.push({ curve, isAxon })

    const nSeg = Math.max(6, Math.ceil(length * 1.8))
    const pts = curve.getPoints(nSeg)
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1]
      output.push(a.x, a.y, a.z, b.x, b.y, b.z)
    }

    if (level < maxLevel) {
      const childCount = level === 0 ? 3 : 2
      for (let c = 0; c < childCount; c++) {
        const angle = ((c + 0.5) / childCount - 0.5) * Math.PI * 0.90
        const childDir = dir.clone()
          .addScaledVector(perpA, Math.sin(angle) * 0.85 + r1 * 0.15)
          .addScaledVector(perpB, Math.cos(angle) * 0.25 + r2 * 0.10)
          .normalize()
        addBranch(output, isAxon, tip.clone(), childDir, level + 1, maxLevel, length * 0.60, rng + c * 1.71 + level * 3.14)
      }
    }

    return tip
  }

  // Dendrite fan
  for (let i = 0; i < PRIMARY_DIRS.length; i++) {
    const dir = new THREE.Vector3(...PRIMARY_DIRS[i]).normalize()
    const start = dir.clone().multiplyScalar(SOMA_R + 0.05)
    addBranch(dendritePts, false, start, dir, 0, 2, 11.0, RNG_SEEDS[i])
  }

  // Axon — long, relatively straight (maxLevel 1 for fewer branches)
  const axonDir = new THREE.Vector3(...AXON_DIR).normalize()
  const axonStart = axonDir.clone().multiplyScalar(SOMA_R + 0.05)
  const axonTip = addBranch(axonPts, true, axonStart, axonDir, 0, 0, 20.0, 9.9)

  // Axon collaterals at 60% along
  const collBase = axonStart.clone().lerp(axonTip, 0.6)
  const axonPerp = new THREE.Vector3(-axonDir.y, axonDir.x, 0).normalize()
  for (let s = -1; s <= 1; s += 2) {
    const cDir = axonDir.clone().addScaledVector(axonPerp, s * 0.65).normalize()
    addBranch(axonPts, true, collBase.clone(), cDir, 0, 1, 9.0, 5.5 + s)
  }

  const dendriteGeo = new THREE.BufferGeometry()
  dendriteGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(dendritePts), 3))

  const axonGeo = new THREE.BufferGeometry()
  axonGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(axonPts), 3))

  return { dendriteGeo, axonGeo, branches }
}

// ── Signal state ──────────────────────────────────────────────────────────────
interface SignalState {
  active: boolean
  branchIdx: number
  t: number
  speed: number
}

const _pos   = new THREE.Vector3()
const _mat4  = new THREE.Matrix4()
const _zeroScale = new THREE.Matrix4().makeScale(0.0001, 0.0001, 0.0001)

// ── Component ─────────────────────────────────────────────────────────────────
export default function SingleNeuron({
  isMuted = false,
  onToggleMute,
}: {
  isMuted?: boolean
  onToggleMute?: () => void
}) {
  const somaMatRef    = useRef<THREE.MeshStandardMaterial>(null)
  const outerGlowRef  = useRef<THREE.MeshBasicMaterial>(null)
  const signalMeshRef = useRef<THREE.InstancedMesh>(null)

  const { dendriteGeo, axonGeo, branches } = useMemo(() => buildNeuronGeometry(), [])

  const st = useRef({
    breathPhase:    0,
    muteProgress:   1.0,
    nextSignalTime: 2.0,
    dummy:          new THREE.Object3D(),
    signals:        Array.from<SignalState>({ length: MAX_SIGNALS }).fill(
      { active: false, branchIdx: 0, t: 0, speed: 0.8 }
    ).map(s => ({ ...s })),
  })

  useFrame(({ clock }, delta) => {
    const soma  = somaMatRef.current
    const halo  = outerGlowRef.current
    const sigMesh = signalMeshRef.current
    if (!soma) return

    const s = st.current
    const now = clock.getElapsedTime()

    // Mute lerp
    const muteTarget = isMuted ? 0 : 1
    s.muteProgress += (muteTarget - s.muteProgress) * Math.min(1, delta * 6)
    const m = s.muteProgress

    // Breathing
    s.breathPhase += delta * 2.0
    const breath = 1 + Math.sin(s.breathPhase) * 0.055

    // Audio
    const e = AUDIO_ENERGY.value
    const audioBoost = m > 0.05
      ? e * (AUDIO_BANDS.mid * 0.4 + AUDIO_BANDS.highMid * 0.35 + AUDIO_BANDS.bass * 0.25) * 11.0
      : 0

    // Soma glow
    soma.emissiveIntensity = breath * (0.5 + m * 3.2 + audioBoost)
    if (halo) halo.opacity = (0.025 + m * 0.10) * (1 + audioBoost * 0.4)

    // Signal spawning
    if (now >= s.nextSignalTime) {
      const loudness = AUDIO_ENERGY.value
      const interval = loudness > 0.3
        ? 0.20 + Math.random() * 0.35
        : 2.5 + Math.random() * 2.5
      s.nextSignalTime = now + interval

      const slot = s.signals.findIndex(sig => !sig.active)
      if (slot !== -1 && branches.length > 0) {
        s.signals[slot] = {
          active: true,
          branchIdx: Math.floor(Math.random() * branches.length),
          t: 0,
          speed: 0.55 + Math.random() * 0.55 + (loudness > 0.3 ? 0.8 : 0),
        }
      }
    }

    // Animate signals
    if (sigMesh) {
      let drawn = 0
      for (const sig of s.signals) {
        if (!sig.active) continue
        const branch = branches[sig.branchIdx]
        if (!branch) { sig.active = false; continue }

        sig.t += delta * sig.speed
        if (sig.t >= 1.0) { sig.active = false; continue }

        branch.curve.getPoint(sig.t, _pos)
        s.dummy.position.copy(_pos)
        const scale = 0.10 * (1 - sig.t * 0.4)   // shrinks toward tip
        s.dummy.scale.setScalar(scale)
        s.dummy.updateMatrix()
        sigMesh.setMatrixAt(drawn, s.dummy.matrix)
        drawn++
      }
      for (let i = drawn; i < MAX_SIGNALS; i++) {
        sigMesh.setMatrixAt(i, _zeroScale)
      }
      sigMesh.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group>
      {/* Outer halo */}
      <mesh>
        <sphereGeometry args={[1.9, 16, 16]} />
        <meshBasicMaterial
          ref={outerGlowRef}
          color={SOMA_COLOR}
          transparent
          opacity={0.08}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Inner corona */}
      <mesh>
        <sphereGeometry args={[0.9, 18, 18]} />
        <meshBasicMaterial
          color={SOMA_COLOR}
          transparent
          opacity={0.14}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Soma nucleus — dark with strong GFP emissive */}
      <mesh
        onClick={(e) => { e.stopPropagation(); onToggleMute?.() }}
        onPointerOver={() => { document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { document.body.style.cursor = 'auto' }}
      >
        <sphereGeometry args={[SOMA_R, 30, 30]} />
        <meshStandardMaterial
          ref={somaMatRef}
          color={0x020a06}
          emissive={SOMA_COLOR}
          emissiveIntensity={3.2}
          roughness={0.65}
          metalness={0.05}
          toneMapped={false}
        />
      </mesh>

      {/* Dendrites — GFP green branching tree */}
      <lineSegments geometry={dendriteGeo} frustumCulled={false}>
        <lineBasicMaterial
          color={DENDRITE_COLOR}
          transparent
          opacity={0.80}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>

      {/* Axon + collaterals — CFP cyan */}
      <lineSegments geometry={axonGeo} frustumCulled={false}>
        <lineBasicMaterial
          color={AXON_COLOR}
          transparent
          opacity={0.75}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>

      {/* Action potential sparks */}
      <instancedMesh
        ref={signalMeshRef}
        args={[undefined, undefined, MAX_SIGNALS]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial
          color={SIGNAL_COLOR}
          transparent
          opacity={0.95}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>

      {/* Muted ring */}
      {isMuted && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.72, 0.80, 32]} />
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
