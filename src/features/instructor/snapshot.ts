import { COMPONENT_BY_ID, OBSERVATION_TEXT } from '../scenario/content'
import { objectiveFor } from '../scenario/selectors'
import type { ComponentId, DiagnosisId, GuidanceLevel, Phase, ScenarioState } from '../scenario/types'

export interface ScenarioSnapshot {
  phase: Phase
  guidanceLevel: GuidanceLevel
  objective: string
  checked: ComponentId[]
  discoveries: { componentId: ComponentId; reading: string }[]
  suspectedDiagnosis: DiagnosisId | null
  confirmedDiagnosis: DiagnosisId | null
  completed: boolean
  hintsUsed: number
  mistakeCount: number
  lastComponentId: ComponentId | null
}

export function snapshotState(state: ScenarioState): ScenarioSnapshot {
  const seen = new Set<ComponentId>()
  const discoveries: ScenarioSnapshot['discoveries'] = []
  for (const record of state.observations) {
    if (record.judgment !== 'revealed' && record.judgment !== 'correct' && record.judgment !== 'partial') continue
    if (seen.has(record.componentId)) continue
    seen.add(record.componentId)
    discoveries.push({
      componentId: record.componentId,
      reading: OBSERVATION_TEXT[COMPONENT_BY_ID[record.componentId].truth],
    })
  }
  return {
    phase: state.phase,
    guidanceLevel: state.guidanceLevel,
    objective: objectiveFor(state),
    checked: Object.keys(state.checked) as ComponentId[],
    discoveries,
    suspectedDiagnosis: state.suspectedDiagnosis,
    confirmedDiagnosis: state.confirmedDiagnosis,
    completed: state.completed,
    hintsUsed: state.hintsUsed,
    mistakeCount: state.mistakes.length,
    lastComponentId: state.lastComponentId,
  }
}
