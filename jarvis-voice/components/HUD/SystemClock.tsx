'use client'

import { useState, useEffect } from 'react'

export default function SystemClock() {
  const [time, setTime] = useState('')

  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    setTime(fmt())
    const id = setInterval(() => setTime(fmt()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="absolute top-4 right-6 select-none pointer-events-none text-right">
      <div
        style={{ fontFamily: 'Playfair Display, serif' }}
        className="text-[10px] font-semibold tracking-[0.2em] text-cyan-400"
      >
        DREW.
      </div>
      <div
        style={{ fontFamily: 'Space Mono, monospace' }}
        className="text-[13px] tracking-[0.1em] text-cyan-300"
      >
        {time}
      </div>
    </div>
  )
}
