import { CORRECT_DIAGNOSIS } from './content'
import { hasTruth } from './selectors'
import type { ComponentId, ScenarioState, ScoreBreakdown } from './types'

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

const AIRFLOW: ComponentId[] = ['air_intake', 'air_outlet']

function processRatio(state: ScenarioState): number {
  const slots: ComponentId[] = [
    'temperature_display',
    'pressure_gauge',
    'filter_panel',
    'fan',
    'power_switch',
    'compressor',
  ]
  let hit = slots.filter((id) => state.checked[id]).length
  if (AIRFLOW.some((id) => state.checked[id])) hit += 1
  return hit / (slots.length + 1)
}

function completionRatio(state: ScenarioState): number {
  if (state.completed) return 1
  const marks = [
    hasTruth(state, 'temperature_high'),
    hasTruth(state, 'pressure_high') || Boolean(state.checked.air_intake || state.checked.air_outlet),
    hasTruth(state, 'filter_restricted'),
    state.namedCorrectFault,
    Object.keys(state.checked).length >= 3,
  ]
  return marks.filter(Boolean).length / marks.length
}

export function scoreState(state: ScenarioState): ScoreBreakdown {
  const started =
    Object.keys(state.checked).length > 0 ||
    state.hintsUsed > 0 ||
    state.mistakes.length > 0 ||
    state.irrelevantActions > 0 ||
    state.suspectedDiagnosis != null ||
    state.completed
  let diagnostic = 0
  if (hasTruth(state, 'filter_restricted')) diagnostic += 30
  if (hasTruth(state, 'temperature_high')) diagnostic += 15
  if (state.namedCorrectFault) diagnostic += 20
  if (state.confirmedDiagnosis === CORRECT_DIAGNOSIS) diagnostic += 35
  diagnostic -= state.wrongConfirms * 20
  diagnostic -= state.wrongHypotheses * 8
  diagnostic -= state.prematureConfirms * 8

  const claims = state.observations.filter((record) => record.judgment !== 'revealed')
  let observation = 0
  if (claims.length > 0) {
    const points = claims.reduce((total, record) => {
      if (record.judgment === 'correct') return total + 1
      if (record.judgment === 'partial') return total + 0.5
      return total
    }, 0)
    observation = (points / claims.length) * 100
  } else if (Object.keys(state.checked).length > 0) {
    observation = 75
  }

  let process = processRatio(state) * 100
  process -= state.prematureConfirms * 12

  let efficiency = 0
  if (started) {
    efficiency = 100
    efficiency -= state.repeatedActions * 7
    efficiency -= state.irrelevantActions * 10
    if (state.elapsedMs > 10 * 60 * 1000) efficiency -= 12
    if (state.elapsedMs > 14 * 60 * 1000) efficiency -= 12
  }

  const hintDependence = started ? 100 - state.hintsUsed * 22 : 0
  const completion = completionRatio(state) * 100

  const diagnosticAccuracy = clamp(diagnostic)
  const observationAccuracy = clamp(observation)
  const processQuality = clamp(process)
  const efficiencyScore = clamp(efficiency)
  const hintScore = clamp(hintDependence)
  const completionScore = clamp(completion)
  const overall = clamp(
    diagnosticAccuracy * 0.3 +
      observationAccuracy * 0.18 +
      processQuality * 0.22 +
      efficiencyScore * 0.12 +
      hintScore * 0.08 +
      completionScore * 0.1,
  )

  return {
    diagnosticAccuracy,
    observationAccuracy,
    processQuality,
    efficiency: efficiencyScore,
    hintDependence: hintScore,
    completion: completionScore,
    overall,
  }
}
