'use client'

import { motion } from 'framer-motion'

interface WaveformRingsProps {
  frequencyData?: Uint8Array
}

export function WaveformRings({ frequencyData }: WaveformRingsProps) {
  const ringCount = 5

  return (
    <svg viewBox="0 0 160 160" className="w-full h-full">
      {Array.from({ length: ringCount }).map((_, i) => {
        const baseRadius = 20 + i * 12
        const index = Math.floor((i / ringCount) * (frequencyData?.length || 128))
        const height = frequencyData?.[index] ?? 0
        const maxHeight = 255
        const scale = 1 + (height / maxHeight) * 0.3
        const opacity = 0.5 + (height / maxHeight) * 0.5

        return (
          <motion.circle
            key={i}
            cx={80}
            cy={80}
            r={baseRadius}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-cyan-500"
            opacity={opacity}
            animate={{ r: baseRadius * scale }}
            transition={{ duration: 0.05 }}
          />
        )
      })}
    </svg>
  )
}
