'use client'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ANIM } from '@/hooks/useNeuralAnimation'
import { AUDIO_ENERGY, AUDIO_BANDS } from '@/hooks/useAudioVisualizer'

// ── Jarvis blue palette ───────────────────────────────────────────────────────
const BLUE_PEAK  = new THREE.Color(0x0088ff)   // primary dendrites / soma
const BLUE_MID   = new THREE.Color(0x0055cc)   // secondary / tertiary
const BLUE_DIM   = new THREE.Color(0x001a44)   // quaternary tips
const CYAN_PEAK  = new THREE.Color(0x44ddff)   // axon / myelin / boutons
const CYAN_DIM   = new THREE.Color(0x002244)   // axon terminals
const VIOLET     = new THREE.Color(0x6644ff)   // nucleolus / organelles
const SIGNAL_CLR = new THREE.Color(0xffffff)   // action potential spark

const SOMA_R = 0.60

// ── Neuron architecture ───────────────────────────────────────────────────────
// 7 primary dendrites covering upper hemisphere (axon exits lower-right — biologically correct)
const PRIMARY_DIRS: [number, number, number][] = [
  [ 0.95,  0.78,  0.22],
  [ 0.12,  1.10, -0.22],
  [-0.82,  0.88,  0.12],
  [-1.05,  0.08,  0.28],
  [-0.42, -0.72,  0.55],
  [ 0.68, -0.38,  0.85],
  [ 0.28,  0.58, -0.82],
]
const AXON_DIR: [number, number, number] = [0.52, -1.00, -0.28]
const RNG_SEEDS = [1.3, 2.7, 0.9, 4.1, 3.5, 0.6, 5.2]

const MAX_SIGNALS     = 15
const MAX_SPINES      = 240
const MAX_BOUTONS     = 36
const MAX_MYELIN      = 20
const MAX_ORGANELLES  = 48

interface Branch { curve: THREE.CatmullRomCurve3; level: number; isAxon: boolean }

// ── Geometry factory ──────────────────────────────────────────────────────────
function buildNeuron() {
  const dPos: number[] = [], dCol: number[] = []  // dendrites
  const aPos: number[] = [], aCol: number[] = []  // axon
  const branches: Branch[] = []
  const spinePts: THREE.Vector3[]  = []
  const boutonPts: THREE.Vector3[] = []
  const myelinPts: THREE.Vector3[] = []

  function lerpColor(a: THREE.Color, b: THREE.Color, t: number): [number, number, number] {
    const HDR = 2.2  // push into bloom range — gives fiber-optic glow width
    return [
      (a.r + (b.r - a.r) * t) * HDR,
      (a.g + (b.g - a.g) * t) * HDR,
      (a.b + (b.b - a.b) * t) * HDR,
    ]
  }

  function dendColor(level: number): [number, number, number] {
    if (level <= 1) return lerpColor(BLUE_PEAK, BLUE_MID, level / 1)
    return lerpColor(BLUE_MID, BLUE_DIM, (level - 1) / 2)
  }

  function axonColor(level: number): [number, number, number] {
    return lerpColor(CYAN_PEAK, CYAN_DIM, Math.min(level / 2, 1))
  }

  function addBranch(
    outPos: number[], outCol: number[], isDendrite: boolean,
    start: THREE.Vector3, dir: THREE.Vector3,
    level: number, maxLevel: number, length: number, rng: number
  ): THREE.Vector3 {
    const r1 = Math.sin(rng * 7.891 + 1.23) * 0.4
    const r2 = Math.cos(rng * 3.421 + 0.77) * 0.3
    const perpA = new THREE.Vector3(-dir.y, dir.x, 0)
    if (perpA.length() < 0.01) perpA.set(1, 0, 0)
    perpA.normalize()
    const perpB = dir.clone().cross(perpA).normalize()

    const mid = start.clone()
      .addScaledVector(dir, length * 0.48)
      .addScaledVector(perpA, r1 * length * 0.30)
      .addScaledVector(perpB, r2 * length * 0.20)
    const tip = start.clone().addScaledVector(dir, length)

    const curve = new THREE.CatmullRomCurve3([start.clone(), mid, tip.clone()])
    branches.push({ curve, level, isAxon: !isDendrite })

    const nSeg = Math.max(6, Math.ceil(length * 2.4))
    const pts  = curve.getPoints(nSeg)
    const cBase = isDendrite ? dendColor(level) : axonColor(level)
    const cTip  = isDendrite ? dendColor(level + 1) : axonColor(level + 1)

    for (let i = 0; i < pts.length - 1; i++) {
      const t = i / (pts.length - 1)
      const [cr, cg, cb] = [
        cBase[0] + (cTip[0] - cBase[0]) * t,
        cBase[1] + (cTip[1] - cBase[1]) * t,
        cBase[2] + (cTip[2] - cBase[2]) * t,
      ]
      const a = pts[i], b = pts[i + 1]
      outPos.push(a.x, a.y, a.z, b.x, b.y, b.z)
      outCol.push(cr, cg, cb, cr, cg, cb)

      // Dendritic spines on level 0–1 branches
      if (isDendrite && level <= 1 && spinePts.length < MAX_SPINES && Math.random() < 0.30) {
        const normal = perpA.clone()
          .multiplyScalar(Math.sin(rng * 11.3 + i * 0.7))
          .addScaledVector(perpB, Math.cos(rng * 5.7 + i * 0.5))
          .normalize()
        spinePts.push(a.clone().lerp(b, 0.5).addScaledVector(normal, 0.22 + Math.random() * 0.16))
      }
    }

    if (level < maxLevel) {
      const nChild = level === 0 ? 3 : 2
      for (let c = 0; c < nChild; c++) {
        const angle  = ((c + 0.5) / nChild - 0.5) * Math.PI * 0.92
        const cDir   = dir.clone()
          .addScaledVector(perpA, Math.sin(angle) * 0.82 + r1 * 0.18)
          .addScaledVector(perpB, Math.cos(angle) * 0.28 + r2 * 0.12)
          .normalize()
        addBranch(outPos, outCol, isDendrite, tip.clone(), cDir, level + 1, maxLevel, length * 0.60, rng + c * 1.71 + level * 3.14)
      }
    } else if (!isDendrite) {
      boutonPts.push(tip.clone())  // axon terminal bouton
    }
    return tip
  }

  // Dendrite fan (7 primaries, 4 levels deep — quaternary dendrites)
  for (let i = 0; i < PRIMARY_DIRS.length; i++) {
    const dir = new THREE.Vector3(...PRIMARY_DIRS[i]).normalize()
    addBranch(dPos, dCol, true, dir.clone().multiplyScalar(SOMA_R + 0.05), dir, 0, 3, 12.0, RNG_SEEDS[i])
  }

  // Main axon — long (screen-spanning), straight-ish
  const axDir   = new THREE.Vector3(...AXON_DIR).normalize()
  const axStart = axDir.clone().multiplyScalar(SOMA_R + 0.05)
  const axTip   = addBranch(aPos, aCol, false, axStart, axDir, 0, 0, 22.0, 9.9)

  // Myelin nodes (Nodes of Ranvier) along main axon
  const mainAxon = branches.find(b => b.isAxon && b.level === 0)
  if (mainAxon) {
    for (let t = 0.06; t < 0.94; t += 0.05) myelinPts.push(mainAxon.curve.getPoint(t))
  }

  // Axon collaterals branching at 60% of main axon
  const collBase = axStart.clone().lerp(axTip, 0.60)
  const axPerp   = new THREE.Vector3(-axDir.y, axDir.x, 0).normalize()
  for (let s = -1; s <= 1; s += 2) {
    const cDir = axDir.clone().addScaledVector(axPerp, s * 0.65).normalize()
    addBranch(aPos, aCol, false, collBase.clone(), cDir, 0, 1, 10.0, 5.5 + s * 0.3)
  }

  const dGeo = new THREE.BufferGeometry()
  dGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(dPos), 3))
  dGeo.setAttribute('color',    new THREE.BufferAttribute(new Float32Array(dCol), 3))

  const aGeo = new THREE.BufferGeometry()
  aGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(aPos), 3))
  aGeo.setAttribute('color',    new THREE.BufferAttribute(new Float32Array(aCol), 3))

  // Organelles: tiny particles floating inside/near soma (Golgi, mitochondria, etc.)
  const organellePts: THREE.Vector3[] = []
  for (let i = 0; i < MAX_ORGANELLES; i++) {
    const r = 0.15 + Math.random() * 0.55
    const theta = Math.random() * Math.PI * 2
    const phi   = Math.acos(2 * Math.random() - 1)
    organellePts.push(new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi),
    ))
  }

  return { dGeo, aGeo, branches, spinePts, boutonPts, myelinPts, organellePts }
}

// ── Soma energy-core shader ───────────────────────────────────────────────────
// glslVersion: THREE.GLSL3 → Three.js prepends "#version 300 es" automatically.
// Do NOT include that directive in the string — it would be duplicated and cause a compile error.
const SOMA_VERT = /* glsl */`
precision highp float;
out vec3 vNormal;
out vec3 vViewPos;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  vViewPos = mvPos.xyz;
  gl_Position = projectionMatrix * mvPos;
}`

const SOMA_FRAG = /* glsl */`
precision highp float;
in vec3 vNormal;
in vec3 vViewPos;
uniform float uTime;
uniform float uIntensity;
uniform vec3  uColor;
out vec4 fragColor;

// Ashima Arts 3D simplex noise — inline, no texture dependency
vec3 mod289v3(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289v4(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289v4(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);
  const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289v3(i);
  vec4 p=permute(permute(permute(
    i.z+vec4(0.,i1.z,i2.z,1.))
    +i.y+vec4(0.,i1.y,i2.y,1.))
    +i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;
  vec4 s1=floor(b1)*2.+1.;
  vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);
  m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(-vViewPos);

  // Fresnel rim: bright edge reads as a 3D sphere, not a flat disc
  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.5);
  fresnel = mix(0.55, 1.0, fresnel);

  // Two noise octaves: slow large energy veins + fast surface detail
  float n1 = snoise(N * 3.5 + uTime * 0.35);
  float n2 = snoise(N * 7.0 + uTime * 0.70);
  float veins = smoothstep(-0.2, 0.65, n1 * 0.6 + n2 * 0.4);

  // baseGlow ensures animated pattern is visible even at uIntensity=0.4 (muted)
  float baseGlow = 0.40 + 0.12 * sin(uTime * 0.55);
  float surface  = mix(baseGlow, veins, clamp(uIntensity / 1.5, 0.0, 1.0));

  // HDR output — toneMapped=false allows bloom to pick this up
  vec3 col = uColor * surface * fresnel * max(uIntensity, 0.4) * 2.8;
  fragColor = vec4(col, 1.0);
}`

// ── Animation state ───────────────────────────────────────────────────────────
interface Sig { active: boolean; branchIdx: number; t: number; speed: number }

const _pos      = new THREE.Vector3()
const _mat4     = new THREE.Matrix4()
const _zeroMat  = new THREE.Matrix4().makeScale(0.0001, 0.0001, 0.0001)
const _dummy    = new THREE.Object3D()

// ── Component ─────────────────────────────────────────────────────────────────
export default function SingleNeuron({
  isMuted = false,
  onToggleMute,
}: { isMuted?: boolean; onToggleMute?: () => void }) {

  // somaShader — stable object, mutate uniforms directly in useFrame (no ref needed)
  const somaShader = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime:      new THREE.Uniform(0.0),
      uIntensity: new THREE.Uniform(1.0),
      uColor:     new THREE.Uniform(new THREE.Vector3(0.0, 0.533, 1.0)), // BLUE_PEAK as vec3
    },
    vertexShader:   SOMA_VERT,
    fragmentShader: SOMA_FRAG,
    glslVersion:    THREE.GLSL3,
    toneMapped:     false,
    depthWrite:     true,
    depthTest:      true,
  }), [])

  const outerRef     = useRef<THREE.MeshBasicMaterial>(null)
  const signalRef    = useRef<THREE.InstancedMesh>(null)
  const spineRef     = useRef<THREE.InstancedMesh>(null)
  const boutonRef    = useRef<THREE.InstancedMesh>(null)
  const myelinRef    = useRef<THREE.InstancedMesh>(null)
  const orgRef       = useRef<THREE.InstancedMesh>(null)
  const torusRef     = useRef<THREE.Mesh>(null)
  const torus2Ref    = useRef<THREE.Mesh>(null)

  const { dGeo, aGeo, branches, spinePts, boutonPts, myelinPts, organellePts } = useMemo(() => buildNeuron(), [])

  // Initialise spine/bouton/myelin/organelle instance transforms (static)
  const spineMatrix  = useMemo(() => spinePts.map(p  => new THREE.Matrix4().setPosition(p).multiply(new THREE.Matrix4().makeScale(0.052, 0.052, 0.052))), [spinePts])
  const boutonMatrix = useMemo(() => boutonPts.map(p => new THREE.Matrix4().setPosition(p).multiply(new THREE.Matrix4().makeScale(0.11, 0.11, 0.11))), [boutonPts])
  const myelinMatrix = useMemo(() => myelinPts.map(p => new THREE.Matrix4().setPosition(p).multiply(new THREE.Matrix4().makeScale(0.08, 0.08, 0.08))), [myelinPts])

  // Write static instances once after mount
  const staticInit = useRef(false)
  const st = useRef({
    breathPhase:  0,
    muteProgress: 1.0,
    nextSig:      1.5,
    signals:      Array.from<Sig>({ length: MAX_SIGNALS }).fill({ active: false, branchIdx: 0, t: 0, speed: 0.7 }).map(s => ({ ...s })),
  })

  useFrame(({ clock }, delta) => {
    const outer   = outerRef.current
    const sigs    = signalRef.current
    const spines  = spineRef.current
    const boutons = boutonRef.current
    const myelin  = myelinRef.current
    const orgs    = orgRef.current

    // ── Static instance init (once) ──
    if (!staticInit.current) {
      if (spines) {
        spineMatrix.forEach((m, i) => spines.setMatrixAt(i, m))
        for (let i = spineMatrix.length; i < MAX_SPINES; i++) spines.setMatrixAt(i, _zeroMat)
        spines.instanceMatrix.needsUpdate = true
      }
      if (boutons) {
        boutonMatrix.forEach((m, i) => boutons.setMatrixAt(i, m))
        for (let i = boutonMatrix.length; i < MAX_BOUTONS; i++) boutons.setMatrixAt(i, _zeroMat)
        boutons.instanceMatrix.needsUpdate = true
      }
      if (myelin) {
        myelinMatrix.forEach((m, i) => myelin.setMatrixAt(i, m))
        for (let i = myelinMatrix.length; i < MAX_MYELIN; i++) myelin.setMatrixAt(i, _zeroMat)
        myelin.instanceMatrix.needsUpdate = true
      }
      if (orgs) {
        organellePts.forEach((p, i) => {
          const s = 0.030 + Math.random() * 0.025
          orgs.setMatrixAt(i, new THREE.Matrix4().setPosition(p).multiply(new THREE.Matrix4().makeScale(s, s, s)))
        })
        orgs.instanceMatrix.needsUpdate = true
      }
      staticInit.current = true
    }

    const s   = st.current
    const now = clock.getElapsedTime()

    // Mute lerp (0 = muted, 1 = active)
    const muteTarget = isMuted ? 0.0 : 1.0
    s.muteProgress += (muteTarget - s.muteProgress) * Math.min(1, delta * 5.5)
    const m = s.muteProgress

    // Breathing
    s.breathPhase += delta * 1.8
    const breath = 1 + Math.sin(s.breathPhase) * 0.055

    // Audio
    const e = AUDIO_ENERGY.value
    const ab = m > 0.05
      ? e * (AUDIO_BANDS.mid * 0.40 + AUDIO_BANDS.highMid * 0.35 + AUDIO_BANDS.bass * 0.25) * 12.0
      : 0

    // Soma shader uniforms — energy core, dims to ambient glow when muted
    somaShader.uniforms.uTime.value      = now
    somaShader.uniforms.uIntensity.value = breath * (0.4 + m * 2.6 + ab)
    if (outer) outer.opacity = (0.02 + m * 0.12) * (1 + ab * 0.45)

    // Rotating torus rings around soma
    if (torusRef.current) {
      torusRef.current.rotation.y = now * 0.55
      torusRef.current.rotation.x = 0.35 + Math.sin(now * 0.22) * 0.12
    }
    if (torus2Ref.current) {
      torus2Ref.current.rotation.y = -now * 0.38
      torus2Ref.current.rotation.z = 0.90 + Math.cos(now * 0.18) * 0.10
    }

    // ── Signal spawning ──
    if (now >= s.nextSig) {
      const loud   = AUDIO_ENERGY.value
      s.nextSig    = now + (loud > 0.25 ? 0.15 + Math.random() * 0.3 : 2.0 + Math.random() * 3.0)
      const slot   = s.signals.findIndex(sg => !sg.active)
      if (slot !== -1 && branches.length > 0) {
        s.signals[slot] = {
          active: true,
          branchIdx: Math.floor(Math.random() * branches.length),
          t: 0,
          speed: 0.50 + Math.random() * 0.55 + (loud > 0.25 ? 0.9 : 0),
        }
      }
    }

    // ── Signal animation ──
    if (sigs) {
      let drawn = 0
      for (const sig of s.signals) {
        if (!sig.active) continue
        const br = branches[sig.branchIdx]
        if (!br) { sig.active = false; continue }
        sig.t += delta * sig.speed
        if (sig.t >= 1.0) { sig.active = false; continue }

        br.curve.getPoint(sig.t, _pos)
        _dummy.position.copy(_pos)
        const sc = 0.12 * (1 - sig.t * 0.45)
        _dummy.scale.setScalar(sc)
        _dummy.updateMatrix()
        sigs.setMatrixAt(drawn, _dummy.matrix)
        drawn++
      }
      for (let i = drawn; i < MAX_SIGNALS; i++) sigs.setMatrixAt(i, _zeroMat)
      sigs.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group>
      {/* ── Outer halo ─────────────────────────────────────────────── */}
      <mesh>
        <sphereGeometry args={[2.1, 16, 16]} />
        <meshBasicMaterial ref={outerRef} color={BLUE_PEAK}
          transparent opacity={0.08} depthWrite={false} toneMapped={false}
          blending={THREE.AdditiveBlending} />
      </mesh>

      {/* ── Mid-outer corona ───────────────────────────────────────── */}
      <mesh>
        <sphereGeometry args={[1.55, 14, 14]} />
        <meshBasicMaterial color={BLUE_PEAK}
          transparent opacity={0.055} depthWrite={false} toneMapped={false}
          blending={THREE.AdditiveBlending} />
      </mesh>

      {/* ── Mid corona ─────────────────────────────────────────────── */}
      <mesh>
        <sphereGeometry args={[1.0, 18, 18]} />
        <meshBasicMaterial color={CYAN_PEAK}
          transparent opacity={0.10} depthWrite={false} toneMapped={false}
          blending={THREE.AdditiveBlending} />
      </mesh>

      {/* ── Inner tight corona ─────────────────────────────────────── */}
      <mesh>
        <sphereGeometry args={[0.78, 16, 16]} />
        <meshBasicMaterial color={BLUE_PEAK}
          transparent opacity={0.07} depthWrite={false} toneMapped={false}
          blending={THREE.AdditiveBlending} />
      </mesh>

      {/* ── Rotating equatorial torus ──────────────────────────────── */}
      <mesh ref={torusRef}>
        <torusGeometry args={[0.66, 0.018, 8, 64]} />
        <meshBasicMaterial color={CYAN_PEAK}
          transparent opacity={0.90} depthWrite={false} toneMapped={false}
          blending={THREE.AdditiveBlending} />
      </mesh>

      {/* ── Second tilted torus ────────────────────────────────────── */}
      <mesh ref={torus2Ref}>
        <torusGeometry args={[0.58, 0.013, 8, 52]} />
        <meshBasicMaterial color={VIOLET}
          transparent opacity={0.75} depthWrite={false} toneMapped={false}
          blending={THREE.AdditiveBlending} />
      </mesh>

      {/* ── Nuclear membrane (double shell) ────────────────────────── */}
      <mesh>
        <sphereGeometry args={[0.38, 20, 20]} />
        <meshBasicMaterial color={BLUE_MID}
          transparent opacity={0.22} depthWrite={false} toneMapped={false}
          blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.34, 20, 20]} />
        <meshBasicMaterial color={0x000520}
          transparent opacity={0.30} depthWrite={false} toneMapped={false} />
      </mesh>

      {/* ── Nucleolus — VIOLET bright spot ─────────────────────────────── */}
      <mesh position={[0.08, 0.06, -0.04]}>
        <sphereGeometry args={[0.11, 14, 14]} />
        <meshBasicMaterial color={VIOLET}
          transparent opacity={0.90} depthWrite={false} toneMapped={false}
          blending={THREE.AdditiveBlending} />
      </mesh>

      {/* ── Soma — energy-core shader, clickable ────────────────────── */}
      <mesh
        onClick={e => { e.stopPropagation(); onToggleMute?.() }}
        onPointerOver={() => { document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { document.body.style.cursor = 'auto' }}
      >
        <sphereGeometry args={[SOMA_R, 32, 32]} />
        <primitive object={somaShader} attach="material" />
      </mesh>

      {/* ── Dendrite tree — vertex-coloured GFP ─────────────────────── */}
      <lineSegments geometry={dGeo} frustumCulled={false}>
        <lineBasicMaterial vertexColors transparent opacity={0.88}
          depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
      </lineSegments>

      {/* ── Axon + collaterals — vertex-coloured CFP ────────────────── */}
      <lineSegments geometry={aGeo} frustumCulled={false}>
        <lineBasicMaterial vertexColors transparent opacity={0.82}
          depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
      </lineSegments>

      {/* ── Dendritic spines ─────────────────────────────────────────── */}
      <instancedMesh ref={spineRef} args={[undefined, undefined, MAX_SPINES]} frustumCulled={false}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshBasicMaterial color={BLUE_MID}
          transparent opacity={0.75} depthWrite={false} toneMapped={false}
          blending={THREE.AdditiveBlending} />
      </instancedMesh>

      {/* ── Synaptic boutons — cyan at axon terminals ───────────────── */}
      <instancedMesh ref={boutonRef} args={[undefined, undefined, MAX_BOUTONS]} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial color={CYAN_PEAK}
          transparent opacity={0.90} depthWrite={false} toneMapped={false}
          blending={THREE.AdditiveBlending} />
      </instancedMesh>

      {/* ── Myelin Nodes of Ranvier — bright cyan dots ──────────────── */}
      <instancedMesh ref={myelinRef} args={[undefined, undefined, MAX_MYELIN]} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial color={CYAN_PEAK}
          transparent opacity={0.90} depthWrite={false} toneMapped={false}
          blending={THREE.AdditiveBlending} />
      </instancedMesh>

      {/* ── Organelles — violet particles inside soma ───────────────── */}
      <instancedMesh ref={orgRef} args={[undefined, undefined, MAX_ORGANELLES]} frustumCulled={false}>
        <sphereGeometry args={[1, 5, 5]} />
        <meshBasicMaterial color={VIOLET}
          transparent opacity={0.82} depthWrite={false} toneMapped={false}
          blending={THREE.AdditiveBlending} />
      </instancedMesh>

      {/* ── Action potential signals ─────────────────────────────────── */}
      <instancedMesh ref={signalRef} args={[undefined, undefined, MAX_SIGNALS]} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial color={SIGNAL_CLR}
          transparent opacity={0.98} depthWrite={false} toneMapped={false}
          blending={THREE.AdditiveBlending} />
      </instancedMesh>

      {/* ── Muted indicator ─────────────────────────────────────────── */}
      {isMuted && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.74, 0.82, 32]} />
          <meshBasicMaterial color={0xff2244}
            transparent opacity={0.9} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}
