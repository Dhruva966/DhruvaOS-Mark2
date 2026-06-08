'use client'

import { Suspense, lazy } from 'react'

const BrainCanvas = lazy(() => import('./BrainCanvas'))

function LoadingScreen() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#0a0a1a]">
      <div
        style={{ fontFamily: 'Orbitron, sans-serif' }}
        className="text-xs tracking-[0.3em] text-cyan-500/60 uppercase"
      >
        INITIALIZING NEURLINK...
      </div>
    </div>
  )
}

export default function NeuralBrain() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <BrainCanvas />
    </Suspense>
  )
}
