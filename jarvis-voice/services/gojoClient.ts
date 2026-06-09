import type { SessionEvent } from '@/types'

const BASE = process.env.NEXT_PUBLIC_GOJO_URL ?? 'http://localhost:3020'

export interface ExecuteResult {
  ok: boolean
  sessionId?: string
  error?: string
}

export interface MockSessionResult {
  ok: boolean
  session?: unknown
  error?: string
}

export async function executeTask(transcript: string, repoSlug = 'dhruvaos'): Promise<ExecuteResult> {
  try {
    const res = await fetch(`${BASE}/api/voice/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript, repoSlug }),
    })
    const json = await res.json()
    return json
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

export async function mockSession(repoSlug = 'dhruvaos'): Promise<MockSessionResult> {
  try {
    const res = await fetch(`${BASE}/api/events/mock/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoSlug, preferredBackend: 'auto' }),
    })
    const json = await res.json()
    return json
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}

export function subscribeToEvents(onEvent: (e: SessionEvent) => void): () => void {
  const url = `${BASE}/api/events/`
  const evtSource = new EventSource(url)

  evtSource.onmessage = (e) => {
    try {
      const event: SessionEvent = JSON.parse(e.data)
      onEvent(event)
    } catch {
      // ignore malformed events
    }
  }

  evtSource.onerror = () => {
    // EventSource auto-reconnects; no action needed
  }

  return () => evtSource.close()
}
