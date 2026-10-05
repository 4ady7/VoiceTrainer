import { hasTruth } from './selectors'
import type { GuidanceLevel, ScenarioState } from './types'

export function guidancePressure(state: ScenarioState): number {
  let pressure = 0
  if (state.mistakes.length >= 2) pressure += 2
  if (state.mistakes.length >= 4) pressure += 2
  if (state.hintsUsed >= 1) pressure += 1
  if (state.hintsUsed >= 2) pressure += 1
  if (state.hintsUsed >= 3) pressure += 1
  if (state.stallTurns >= 3) pressure += 1
  if (state.uncertaintyTurns >= 2) pressure += 1
  if (state.wrongConfirms >= 1) pressure += 1
  if (state.elapsedMs >= 7 * 60 * 1000 && !hasTruth(state, 'filter_restricted')) pressure += 1
  if (hasTruth(state, 'filter_restricted')) pressure -= 1
  if (state.namedCorrectFault) pressure -= 1
  return pressure
}

export function deriveGuidance(state: ScenarioState): GuidanceLevel {
  const pressure = guidancePressure(state)
  if (pressure >= 4) return 'high_support'
  if (pressure >= 2) return 'supportive'
  return 'normal'
}
