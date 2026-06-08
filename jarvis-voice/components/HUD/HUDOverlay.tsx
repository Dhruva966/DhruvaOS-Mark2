'use client'

import CornerBrackets from './CornerBrackets'
import SystemStatus from './SystemStatus'
import BriefingHeader from './BriefingHeader'
import SystemClock from './SystemClock'
import CortexStatusPanel from './CortexStatusPanel'
import ListeningIndicator from './ListeningIndicator'
import type { VoiceState, ModuleStatus } from '@/types'

interface Props {
  voiceState?: VoiceState
  moduleOverrides?: Partial<Record<string, ModuleStatus>>
}

export default function HUDOverlay({ voiceState = 'idle', moduleOverrides = {} }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <CornerBrackets />
      <SystemStatus />
      <BriefingHeader />
      <SystemClock />
      <CortexStatusPanel overrides={moduleOverrides} />
      <ListeningIndicator voiceState={voiceState} />
    </div>
  )
}
