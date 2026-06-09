'use client';

import { motion } from 'framer-motion';
import type { Transition } from 'framer-motion';

type DrewState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface DrewProps {
  state: DrewState;
  isActive: boolean;
}

export default function Drew({ state, isActive }: DrewProps) {
  const getStateAnimation = () => {
    switch (state) {
      case 'idle':
        return {
          scale: [1, 1.05, 1],
          opacity: [0.7, 0.85, 0.7],
        };
      case 'listening':
        return {
          scale: [1, 1.08, 1],
          boxShadow: [
            '0 0 20px rgba(59, 130, 246, 0.5)',
            '0 0 40px rgba(59, 130, 246, 0.8)',
            '0 0 20px rgba(59, 130, 246, 0.5)',
          ],
        };
      case 'thinking':
        return {
          scale: [1, 1.02, 0.98, 1],
          rotate: [0, 5, -5, 0],
        };
      case 'speaking':
        return {
          scale: [1, 1.1, 0.95, 1],
          y: [-10, 0, -5, 0],
        };
      default:
        return {};
    }
  };

  const animationConfig: Transition = {
    duration: state === 'idle' ? 3 : 1.5,
    repeat: Infinity,
    ease: [0.43, 0.13, 0.23, 0.96],
  };

  return (
    <motion.div
      className="fixed bottom-8 right-8 z-50"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className={`
          w-32 h-32 rounded-full cursor-pointer
          relative flex items-center justify-center
          transition-all duration-300
          ${isActive ? 'ring-4 ring-blue-400' : ''}
        `}
        style={{
          background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.8), rgba(147,112,219,0.6), rgba(75,0,130,0.8))',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.3)',
          boxShadow: isActive
            ? '0 0 40px rgba(59, 130, 246, 0.8), inset 0 0 20px rgba(255,255,255,0.3)'
            : '0 20px 40px rgba(0,0,0,0.3), inset 0 0 20px rgba(255,255,255,0.2)',
        }}
        animate={getStateAnimation()}
        transition={animationConfig}
      >
        {/* Inner glow */}
        <motion.div
          className="absolute inset-2 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(255,255,255,0.6), transparent)',
            pointerEvents: 'none',
          }}
        />

        {/* Status indicator */}
        <motion.div
          className="absolute top-4 right-4 w-3 h-3 rounded-full"
          animate={{
            scale: state === 'listening' ? [1, 1.5, 1] : 1,
            opacity: state === 'listening' ? [1, 0.5, 1] : 0.8,
          }}
          transition={{ duration: 0.6, repeat: Infinity }}
          style={{
            background: state === 'idle' ? '#10b981' : state === 'listening' ? '#3b82f6' : state === 'thinking' ? '#f59e0b' : '#ec4899',
          }}
        />

        {/* Center text */}
        <div className="text-center z-10 pointer-events-none">
          <div className="text-2xl font-bold text-white drop-shadow-lg">
            {state === 'idle' && '🎤'}
            {state === 'listening' && '👂'}
            {state === 'thinking' && '💭'}
            {state === 'speaking' && '🗣️'}
          </div>
          <div className="text-xs text-white/70 mt-1 capitalize drop-shadow-lg">
            {state}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
