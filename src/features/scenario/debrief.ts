import { COMPONENT_BY_ID, COMPONENTS, CORRECT_DIAGNOSIS, DIAGNOSIS_LABEL, OBSERVATION_TEXT } from './content'
import { hasTruth, isChecked } from './selectors'
import type { ComponentId, ScenarioState } from './types'

export interface KeyObservation {
  componentId: ComponentId
  text: string
  status: 'correct' | 'partial' | 'incorrect' | 'seen'
}

export interface DebriefReport {
  overall: number
  diagnosticAccuracy: number
  observationAccuracy: number
  processQuality: number
  efficiency: number
  hintDependence: number
  completion: number
  didWell: string[]
  missed: string[]
  keyObservations: KeyObservation[]
  path: { atMs: number; summary: string }[]
  missedOpportunities: string[]
  instructorFeedback: string
  nextTime: string[]
  durationMs: number
  mistakes: number
  hints: number
  checkpoints: number
  completed: boolean
  confirmedLabel: string | null
  steps: number
}

function latestClaimStatus(state: ScenarioState, componentId: ComponentId): KeyObservation['status'] {
  const claims = state.observations.filter((record) => record.componentId === componentId && record.claim)
  const latest = claims[claims.length - 1]
  if (!latest) return 'seen'
  if (latest.judgment === 'correct' || latest.judgment === 'partial' || latest.judgment === 'incorrect') {
    return latest.judgment
  }
  return 'seen'
}

export function buildDebrief(state: ScenarioState): DebriefReport {
  const didWell: string[] = []
  if (state.completed) didWell.push('You confirmed a restricted filter with the readings in hand.')
  if (hasTruth(state, 'temperature_high')) {
    didWell.push('You identified the warm outlet on the instrument, not only from the briefing.')
  }
  if (hasTruth(state, 'pressure_high')) didWell.push('You brought the pressure gauge into the diagnosis.')
  if (isChecked(state, 'power_switch')) didWell.push('You checked power instead of assuming the unit was dead.')
  if (isChecked(state, 'compressor')) didWell.push('You checked the compressor instead of assuming it had failed.')
  if (isChecked(state, 'fan') && hasTruth(state, 'fan_spinning')) {
    didWell.push('You noticed the fan was still spinning.')
  }
  if (state.completed && state.hintsUsed === 0) didWell.push('You finished without asking for a hint.')
  if (state.completed && state.wrongConfirms === 0) didWell.push('You did not lock onto a false fault.')
  if (didWell.length === 0) didWell.push('You opened the session and kept the problem in front of you.')

  const missed = state.mistakes.map((mistake) => mistake.detail)
  if (!state.completed) missed.push('The session ended without a confirmed diagnosis.')

  const seen = new Set<ComponentId>()
  const keyObservations: KeyObservation[] = []
  for (const record of state.observations) {
    if (record.judgment !== 'revealed' && record.judgment !== 'correct' && record.judgment !== 'partial') continue
    if (seen.has(record.componentId)) continue
    seen.add(record.componentId)
    keyObservations.push({
      componentId: record.componentId,
      text: OBSERVATION_TEXT[COMPONENT_BY_ID[record.componentId].truth],
      status: latestClaimStatus(state, record.componentId),
    })
  }

  const missedOpportunities: string[] = []
  if (!isChecked(state, 'filter_panel')) missedOpportunities.push('The filter panel was never inspected.')
  if (!isChecked(state, 'temperature_display')) {
    missedOpportunities.push('The temperature display was never checked against the complaint.')
  }
  if (!isChecked(state, 'pressure_gauge')) missedOpportunities.push('The pressure gauge never entered the path.')
  if (!isChecked(state, 'air_intake') && !isChecked(state, 'air_outlet')) {
    missedOpportunities.push('Airflow at the intake or outlet was never checked.')
  }
  if (!isChecked(state, 'power_switch')) missedOpportunities.push('Power was never confirmed on the switch itself.')
  if (!isChecked(state, 'compressor')) missedOpportunities.push('The compressor was never checked.')

  const claims = state.observations.filter((record) => record.claim)
  const nextTime: string[] = []
  if (claims.length < 2) nextTime.push('Name each reading out loud. Looking and saying what you see are different skills.')
  if (!isChecked(state, 'filter_panel') || !isChecked(state, 'temperature_display')) {
    nextTime.push('Tie the warm outlet to the air path before you name a fault.')
  }
  if (state.prematureConfirms > 0) {
    nextTime.push('A correct suspicion still needs the filter and the temperature in evidence before you confirm it.')
  }
  if (state.wrongConfirms > 0) {
    nextTime.push('Rule out power, the fan, and the compressor before you close on a failed part.')
  }
  if (state.hintsUsed > 1) nextTime.push('Use a hint to choose the next area, then make the observation yourself.')
  if (nextTime.length === 0) {
    nextTime.push('Keep stating what a reading rules out, not only what it suggests.')
  }

  const score = state.score
  const outcome = state.completed
    ? 'The restricted filter accounts for the warm outlet, the weak airflow, and the high gauge.'
    : 'The fault was a restricted filter. It stays unconfirmed until the filter, the temperature, and one airflow or pressure check are all in the record.'
  const instructorFeedback = [
    `Overall diagnostic mark ${score.overall}. Diagnostic accuracy ${score.diagnosticAccuracy}. Observation accuracy ${score.observationAccuracy}. Process quality ${score.processQuality}.`,
    `Efficiency ${score.efficiency}. Hint independence ${score.hintDependence}. Completion ${score.completion}.`,
    `${state.hintsUsed} ${state.hintsUsed === 1 ? 'hint' : 'hints'}, ${state.mistakes.length} ${state.mistakes.length === 1 ? 'mistake' : 'mistakes'}, ${state.checkpoints.length} checkpoints.`,
    outcome,
  ].join(' ')

  return {
    overall: score.overall,
    diagnosticAccuracy: score.diagnosticAccuracy,
    observationAccuracy: score.observationAccuracy,
    processQuality: score.processQuality,
    efficiency: score.efficiency,
    hintDependence: score.hintDependence,
    completion: score.completion,
    didWell,
    missed,
    keyObservations,
    path: state.diagnosticPath.map((step) => ({ atMs: step.atMs, summary: step.summary })),
    missedOpportunities,
    instructorFeedback,
    nextTime,
    durationMs: state.completed && state.completedAtMs != null ? state.completedAtMs : state.elapsedMs,
    mistakes: state.mistakes.length,
    hints: state.hintsUsed,
    checkpoints: state.checkpoints.length,
    completed: state.completed,
    confirmedLabel: state.confirmedDiagnosis ? DIAGNOSIS_LABEL[state.confirmedDiagnosis] : null,
    steps: state.diagnosticPath.length,
  }
}

export function expectedComponents(): ComponentId[] {
  return COMPONENTS.map((component) => component.id)
}

export const DEBRIEF_FAULT = DIAGNOSIS_LABEL[CORRECT_DIAGNOSIS]
