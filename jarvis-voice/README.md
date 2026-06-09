# jarvis-voice — DREW Neural Brain Interface

Full-screen 3D neural brain visualization powering the DREW voice interface. Runs at `localhost:3000` (dev) or `dhruvavutukury.org/drew` (prod, Cloudflare Tunnel).

## What It Is

A biorealistic single-neuron visualization that reacts to Dhruva's voice in real-time. Built with React Three Fiber + postprocessing on Next.js 15. The central neuron is the "brain" of DREW — it glows, fires action potentials, and breathes with every voice interaction.

**Visual style:** GFP/CFP fluorescence microscopy on a near-black background. Looks like a real neuron under a confocal microscope.

## Architecture

```
BrainCanvas          ← R3F Canvas + mic toggle + HUD overlay
└── BrainScene       ← Lights, fog, OrbitControls, BackgroundField
    ├── SingleNeuron ← The whole neuron (soma + dendrites + axon + signals)
    └── PostProcessing ← Bloom × 2 + ChromaticAberration + Vignette
```

### SingleNeuron geometry (all built procedurally at init, zero JS per frame for geometry)

| Structure | Detail |
|-----------|--------|
| Soma | r=0.60 sphere, `meshStandardMaterial` emissive GFP green |
| Nuclear membrane | Two concentric shells at r=0.38 / 0.34, additive blending |
| Nucleolus | YFP yellow-green sphere at r=0.11, offset inside nucleus |
| Outer halo | r=2.1 corona, audio-reactive opacity |
| Dendrites | 7 primary arms × 4 recursive levels (max 154 branches), vertex-colour gradient GFP_BRIGHT → GFP_DIM |
| Axon | 1 main arm 22 units long (spans viewport) + 2 collaterals, CFP cyan vertex colour |
| Dendritic spines | ≤240 InstancedMesh tiny spheres on level 0–1 dendrites |
| Synaptic boutons | ≤36 InstancedMesh YFP spheres at axon terminal tips |
| Nodes of Ranvier | ≤20 InstancedMesh CFP bright dots along main axon |
| Organelles | 48 InstancedMesh YFP particles floating inside soma |
| Action potentials | 15 InstancedMesh white sparks traveling CatmullRomCurve3 paths |
| Background field | 180 faint particles at r=18–46 (distant neuron hints) |

### Audio reactivity

`useAudioVisualizer` exposes `AUDIO_BANDS` and `AUDIO_ENERGY` as **module-level singletons** — no React state, no batching delay. The `useFrame` loop in `SingleNeuron` reads these directly every frame:
- `soma.emissiveIntensity` = `0.4 + muteProgress × 2.6 + audioBoost`
- `outer.opacity` driven by `audioBoost`
- Signals fire more frequently when `AUDIO_ENERGY.value > 0.25`

### Voice states

`useVoiceState` / `useNeuralAnimation` drive the `ANIM` singleton (GSAP tweens):
- `idle` → slow breathing, rare signals
- `listening` → brighter, signals every ~0.3s
- `thinking` → ripple wave, fast signals
- `speaking` → peak intensity, burst signals
- `error` → red flash

## Running locally

```bash
cd jarvis-voice
npm run dev        # http://localhost:3000
```

Requires no Omen connection — audio input from local mic.

## Connecting to DREW (Gojo backend)

Set env var before `npm run dev`:

```bash
NEXT_PUBLIC_GOJO_URL=http://100.119.229.11:3020  # via Tailscale
```

Without it, the HUD runs in mock mode (no real task execution).

## Key files

| File | Purpose |
|------|---------|
| `components/NeuralBrain/SingleNeuron.tsx` | All neuron geometry + animation logic |
| `components/NeuralBrain/BrainScene.tsx` | Scene setup, lights, fog |
| `components/NeuralBrain/PostProcessing.tsx` | Bloom × 2, ChromaticAberration, Vignette |
| `components/NeuralBrain/BrainCanvas.tsx` | R3F Canvas + mic toggle + HUD mount |
| `hooks/useAudioVisualizer.ts` | Mic → 7-band FFT → AUDIO_BANDS singleton |
| `hooks/useNeuralAnimation.ts` | ANIM singleton + GSAP voice-state transitions |
| `config/neural.ts` | Constants (SPHERE_RADIUS, SOMA_COUNT, etc.) |
| `types/index.ts` | VoiceState, NodeData, ConnectionData, FrequencyBands |

## Controls

| Action | How |
|--------|-----|
| Activate mic | Click the central soma orb |
| Mute | Click soma again (orb dims, red ring appears) |
| Rotate | Click + drag |
| Zoom | Scroll wheel |

## Postprocessing stack

- **Bloom (wide, soft):** intensity 2.8, threshold 0.10, `KernelSize.VERY_LARGE`, mipmapBlur
- **Bloom (tight, core):** intensity 1.4, threshold 0.40, `KernelSize.MEDIUM`
- **ChromaticAberration:** offset (0.00055, 0.00055) — subtle GFP/CFP colour split on bright edges
- **Vignette:** offset 0.30, darkness 0.72 — forces eye to soma
