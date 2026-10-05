import { useEffect, useMemo, useState } from 'react'
import type { VoiceUiState } from '../../app/useTrainingSession'
import { EquipmentIndex } from '../../components/EquipmentIndex'
import { InstructorPanel } from '../../components/InstructorPanel'
import { TopBar } from '../../components/TopBar'
import { Transcript } from '../../components/Transcript'
import type { TranscriptTurn } from '../../app/useTrainingSession'
import { componentLabel, deriveVisuals } from '../scenario/visuals'
import type { ComponentId, ScenarioState } from '../scenario/types'
import { useVoiceControls } from '../voice/useVoiceControls'
import { VoiceDock } from '../voice/VoiceDock'
import { CoolingUnit } from './scene/CoolingUnit'

interface SimulationScreenProps {
  scenario: ScenarioState
  transcript: TranscriptTurn[]
  instructorLine: string
  speechNonce: number
  preferVoice: boolean
  voice: VoiceUiState
  voiceDetail: string
  interpreterLabel: string
  error: string | null
  onSubmit: (text: string) => Promise<boolean>
  onInspect: (id: ComponentId) => Promise<boolean>
  onDebrief: () => void
  onVoice: (voice: VoiceUiState, detail?: string) => void
  onError: (message: string | null) => void
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  return reduced
}

export function SimulationScreen({
  scenario,
  transcript,
  instructorLine,
  speechNonce,
  preferVoice,
  voice,
  voiceDetail,
  interpreterLabel,
  error,
  onSubmit,
  onInspect,
  onDebrief,
  onVoice,
  onError,
}: SimulationScreenProps) {
  const [hover, setHover] = useState<ComponentId | null>(null)
  const reducedMotion = usePrefersReducedMotion()
  const visuals = useMemo(
    () => deriveVisuals(scenario, hover, scenario.lastComponentId),
    [scenario, hover],
  )
  const controls = useVoiceControls({
    preferVoice,
    blocked: voice === 'processing',
    instructorLine,
    speechNonce,
    onUtterance: onSubmit,
    onVoice,
    onError,
  })

  return (
    <div className="sim">
      <TopBar
        startedAtMs={scenario.startedAtMs}
        elapsedMs={scenario.completed ? (scenario.completedAtMs ?? scenario.elapsedMs) : scenario.elapsedMs}
        completed={scenario.completed}
        voiceDetail={voiceDetail}
        interpreterLabel={interpreterLabel}
        showEnd
        onEnd={onDebrief}
      />
      <div className="sim-main">
        <EquipmentIndex visuals={visuals} disabled={voice === 'processing'} onInspect={(id) => void onInspect(id)} onHover={setHover} />
        <div className="stage">
          <CoolingUnit
            visuals={visuals}
            reducedMotion={reducedMotion}
            onHover={setHover}
            onSelect={(id) => void onInspect(id)}
          />
          <p className="stage-caption">
            {hover ? componentLabel(hover) : 'Drag to look around the unit. Select a part, or talk through the check.'}
          </p>
        </div>
        <InstructorPanel
          scenario={scenario}
          line={instructorLine}
          voiceDetail={voiceDetail}
          interpreterLabel={interpreterLabel}
          onDebrief={onDebrief}
        />
      </div>
      {error ? (
        <div className="banner" role="status">
          <p>{error}</p>
          <button type="button" onClick={() => onError(null)}>
            Dismiss
          </button>
        </div>
      ) : null}
      <div className="dock">
        <Transcript turns={transcript} />
        <VoiceDock
          interim={controls.interim}
          alwaysOn={controls.alwaysOn}
          muted={controls.muted}
          supported={controls.supported}
          blocked={voice === 'processing'}
          onHoldStart={controls.holdStart}
          onHoldEnd={controls.holdEnd}
          onToggleAlways={controls.toggleAlways}
          onToggleMute={controls.toggleMute}
          onReplay={controls.replay}
          onEnable={() => void controls.enableMicrophone()}
          onSubmit={onSubmit}
        />
      </div>
    </div>
  )
}
