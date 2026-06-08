'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Mic, MicOff } from 'lucide-react'
import { useAudioVisualizer } from '@/hooks/useAudioVisualizer'
import { WaveformRings } from './WaveformRings'

type State = 'idle' | 'listening' | 'processing' | 'responding'

const stateConfig = {
  idle: {
    scale: 0.15,
    glow: 'rgba(0, 255, 255, 0.3)',
    spinRing: false,
  },
  listening: {
    scale: 1,
    glow: 'rgba(0, 255, 255, 0.8)',
    spinRing: false,
  },
  processing: {
    scale: 1,
    glow: 'rgba(251, 202, 3, 0.8)',
    spinRing: true,
  },
  responding: {
    scale: 1,
    glow: 'rgba(255, 0, 255, 0.8)',
    spinRing: false,
  },
}

export function JarvisVoiceBubble() {
  const [state, setState] = useState<State>('idle')
  const [isMuted, setIsMuted] = useState(false)
  const { frequencyData, startMicrophone, stopMicrophone } = useAudioVisualizer()

  const handleActivate = async () => {
    setState('listening')
    await startMicrophone()

    setTimeout(() => {
      setState('processing')
      setTimeout(() => {
        setState('responding')
        setTimeout(() => {
          stopMicrophone()
          setState('idle')
        }, 2000)
      }, 2000)
    }, 1500)
  }

  const config = stateConfig[state]

  const glowColor = config.glow.match(/\d+/g) as string[]
  const glowR = glowColor[0]
  const glowG = glowColor[1]
  const glowB = glowColor[2]

  return (
    <motion.div
      className="fixed bottom-4 right-4 z-50 cursor-grab active:cursor-grabbing"
      drag
      dragConstraints={{ left: -300, right: 0, top: -300, bottom: 0 }}
      dragElastic={0.2}
      initial={{ scale: config.scale }}
      animate={{ scale: config.scale }}
      transition={{ type: 'spring', damping: 15 }}
    >
      {/* Main bubble container */}
      <motion.div
        className="relative w-20 h-20 rounded-full border-2 border-cyan-500 flex items-center justify-center bg-black/20 backdrop-blur"
        animate={{
          boxShadow: [
            `0 0 15px ${config.glow}`,
            `0 0 30px ${config.glow}`,
            `0 0 15px ${config.glow}`,
          ],
          rotate: config.spinRing ? 360 : 0,
        }}
        transition={{
          boxShadow: { duration: 1.5, repeat: Infinity },
          rotate: config.spinRing
            ? { duration: 2, repeat: Infinity, ease: "linear" }
            : { duration: 0 },
        }}
      >
        {/* Breathing ripple (idle state) */}
        {state === 'idle' && (
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-cyan-500/50"
            animate={{
              scale: [1, 1.05, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
            }}
          />
        )}

        {/* Waveform (listening state) */}
        {state === 'listening' && frequencyData && (
          <div className="absolute inset-0 flex items-center justify-center">
            <WaveformRings frequencyData={frequencyData} />
          </div>
        )}

        {/* Spinner (processing state) */}
        {state === 'processing' && (
          <motion.div
            className="text-2xl"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            ⚙️
          </motion.div>
        )}

        {/* Microphone icon (idle/listening) */}
        {(state === 'idle' || state === 'responding') && (
          <motion.button
            onClick={state === 'idle' ? handleActivate : undefined}
            whileHover={{ scale: 1.1 }}
            className="flex items-center justify-center w-full h-full rounded-full hover:bg-cyan-500/20 transition-colors"
          >
            <Mic size={10} className="text-white" />
          </motion.button>
        )}

        {/* Mute button */}
        <motion.button
          onClick={() => {
            setIsMuted(!isMuted)
            if (!isMuted && state !== 'idle') {
              stopMicrophone()
              setState('idle')
            }
          }}
          whileHover={{ scale: 1.2 }}
          className={`absolute bottom-0 right-0 p-1.5 rounded-full transition-colors ${
            isMuted ? 'bg-red-500/80' : 'bg-cyan-500/80'
          } hover:opacity-100 opacity-80`}
        >
          {isMuted ? (
            <MicOff size={10} className="text-white" />
          ) : (
            <Mic size={10} className="text-white" />
          )}
        </motion.button>
      </motion.div>

      {/* State indicator text (small, below bubble) */}
      {state !== 'idle' && (
        <motion.div
          className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-cyan-400 whitespace-nowrap"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {state === 'listening' && 'Listening...'}
          {state === 'processing' && 'Processing...'}
          {state === 'responding' && 'Responding...'}
        </motion.div>
      )}
    </motion.div>
  )
}
