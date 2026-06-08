import type { FrequencyBands } from '@/types'

/**
 * Maps raw FFT bins to 7 perceptual frequency bands (0–1 normalized).
 * sampleRate defaults to 44100 Hz.
 */
export function analyzeFrequencyBands(
  data: Uint8Array,
  sampleRate = 44100
): FrequencyBands {
  const nyquist = sampleRate / 2
  const binHz = nyquist / data.length

  const bandAvg = (minHz: number, maxHz: number): number => {
    const minBin = Math.max(0, Math.floor(minHz / binHz))
    const maxBin = Math.min(data.length - 1, Math.ceil(maxHz / binHz))
    if (maxBin <= minBin) return 0
    let sum = 0
    for (let i = minBin; i <= maxBin; i++) sum += data[i]
    return sum / ((maxBin - minBin + 1) * 255)
  }

  const subBass   = bandAvg(20,    60)
  const bass      = bandAvg(60,    250)
  const lowMid    = bandAvg(250,   500)
  const mid       = bandAvg(500,   2000)
  const highMid   = bandAvg(2000,  4000)
  const presence  = bandAvg(4000,  6000)
  const brilliance= bandAvg(6000,  20000)

  // Weighted overall energy (emphasize speech frequencies)
  const overall = subBass * 0.1 + bass * 0.2 + lowMid * 0.25 + mid * 0.3 + highMid * 0.15

  return { subBass, bass, lowMid, mid, highMid, presence, brilliance, overall }
}

/**
 * Calculates simple energy average over all bins (for VAD).
 */
export function calcEnergy(data: Uint8Array): number {
  let sum = 0
  for (let i = 0; i < data.length; i++) sum += data[i]
  return sum / data.length
}
