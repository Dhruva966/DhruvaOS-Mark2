'use client'

import { EffectComposer, Bloom, ChromaticAberration, Vignette, Noise } from '@react-three/postprocessing'
import { BlendFunction, KernelSize } from 'postprocessing'
import { Vector2 } from 'three'

export default function PostProcessing() {
  return (
    <EffectComposer>
      {/* Layered bloom — two passes: tight bright core + wide soft halo */}
      <Bloom
        intensity={2.8}
        luminanceThreshold={0.07}
        luminanceSmoothing={0.88}
        kernelSize={KernelSize.VERY_LARGE}
        mipmapBlur
      />
      <Bloom
        intensity={1.4}
        luminanceThreshold={0.40}
        luminanceSmoothing={0.95}
        kernelSize={KernelSize.MEDIUM}
        mipmapBlur={false}
      />
      {/* Chromatic aberration — GFP/CFP colour split on bright dendrite edges */}
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={new Vector2(0.00055, 0.00055)}
        radialModulation={false}
        modulationOffset={0}
      />
      {/* Vignette — draws eye to the central soma */}
      <Vignette
        offset={0.30}
        darkness={0.72}
        eskil={false}
        blendFunction={BlendFunction.NORMAL}
      />
      {/* Film grain — breaks "clean digital" look, adds biological texture */}
      <Noise blendFunction={BlendFunction.ADD} opacity={0.045} />
    </EffectComposer>
  )
}
