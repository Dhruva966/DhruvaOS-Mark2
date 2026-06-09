'use client'

import { useEffect, useCallback, useRef } from 'react'
import { subscribeToEvents } from '@/services/gojoClient'
import type { VoiceState, SessionEvent, ModuleStatus } from '@/types'

export interface GojoState {
  moduleOverrides: Partial<Record<string, ModuleStatus>>
  lastEvent: SessionEvent | null
}

interface Options {
  onTransition: (next: VoiceState) => void
  onModuleUpdate: (overrides: Partial<Record<string, ModuleStatus>>) => void
  enabled?: boolean
}

export function useGojoEvents({ onTransition, onModuleUpdate, enabled = true }: Options) {
  const overridesRef = useRef<Partial<Record<string, ModuleStatus>>>({})

  const handleEvent = useCallback((event: SessionEvent) => {
    switch (event.type) {
      case 'task_started':
        onTransition('thinking')
        break
      case 'agent_started':
        // Update matching module to LIVE if it matches a known module name
        if (event.payload?.agent) {
          overridesRef.current = {
            ...overridesRef.current,
            [event.payload.agent.toUpperCase()]: 'LIVE',
          }
          onModuleUpdate(overridesRef.current)
        }
        break
      case 'task_done':
        onTransition('speaking')
        // Reset module overrides after a short delay
        setTimeout(() => {
          overridesRef.current = {}
          onModuleUpdate({})
        }, 2000)
        break
      case 'error':
        // Transition to error state on Gojo error
        onTransition('error')
        // Flag errored modules
        if (event.payload?.agent) {
          overridesRef.current = {
            ...overridesRef.current,
            [event.payload.agent.toUpperCase()]: 'ERROR',
          }
          onModuleUpdate(overridesRef.current)
        }
        break
      default:
        break
    }
  }, [onTransition, onModuleUpdate])

  useEffect(() => {
    if (!enabled) return
    const unsubscribe = subscribeToEvents(handleEvent)
    return unsubscribe
  }, [enabled, handleEvent])
}
