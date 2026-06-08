'use client'

import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { KernelSize, Resolution } from 'postprocessing'

export default function PostProcessing() {
  return (
    <EffectComposer>
      <Bloom
        intensity={3.5}
        luminanceThreshold={0.08}
        luminanceSmoothing={0.85}
        kernelSize={KernelSize.LARGE}
        resolutionX={Resolution.AUTO_SIZE}
        resolutionY={Resolution.AUTO_SIZE}
        mipmapBlur
      />
    </EffectComposer>
  )
}
