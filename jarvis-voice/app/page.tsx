'use client'

import dynamic from 'next/dynamic'

const NeuralBrain = dynamic(() => import('@/components/NeuralBrain'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-[#0a0a1a]">
      <div className="font-[family-name:var(--font-hud,Orbitron,sans-serif)] text-xs tracking-widest text-cyan-500/60">
        INITIALIZING NEURLINK...
      </div>
    </div>
  ),
})

export default function Page() {
  return <NeuralBrain />
}
