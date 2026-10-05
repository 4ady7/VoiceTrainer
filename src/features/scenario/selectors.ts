import { COMPONENT_BY_ID } from './content'
import type { ComponentId, ObservationId, ScenarioState } from './types'

export function hasTruth(state: ScenarioState, truth: ObservationId): boolean {
  return state.observations.some(
    (record) =>
      record.truth === truth &&
      (record.judgment === 'revealed' || record.judgment === 'correct' || record.judgment === 'partial'),
  )
}

export function isChecked(state: ScenarioState, componentId: ComponentId): boolean {
  return Boolean(state.checked[componentId])
}

export function evidenceReady(state: ScenarioState): boolean {
  if (!hasTruth(state, 'filter_restricted') || !hasTruth(state, 'temperature_high')) return false
  const support = Boolean(
    state.checked.pressure_gauge || state.checked.air_intake || state.checked.air_outlet || state.checked.fan,
  )
  return support && Object.keys(state.checked).length >= 3
}

export function addCheckpoint(checkpoints: string[], id: string): string[] {
  return checkpoints.includes(id) ? checkpoints : [...checkpoints, id]
}

export function checkpointsFor(state: ScenarioState, componentId: ComponentId): string[] {
  let next = state.checkpoints
  const spec = COMPONENT_BY_ID[componentId]
  if (spec.truth === 'temperature_high') next = addCheckpoint(next, 'temperature_seen')
  if (spec.truth === 'pressure_high') next = addCheckpoint(next, 'pressure_seen')
  if (componentId === 'air_intake' || componentId === 'air_outlet' || componentId === 'fan') {
    next = addCheckpoint(next, 'airflow_seen')
  }
  if (componentId === 'filter_panel') next = addCheckpoint(next, 'filter_seen')
  if (
    componentId === 'power_switch' ||
    componentId === 'compressor' ||
    componentId === 'emergency_stop' ||
    componentId === 'status_indicator'
  ) {
    next = addCheckpoint(next, 'ruleout_seen')
  }
  return next
}

export function objectiveFor(state: ScenarioState): string {
  if (state.completed) return 'Review the debrief.'
  if (state.guidanceLevel === 'high_support' && !hasTruth(state, 'filter_restricted')) {
    return 'Inspect the filter and the path of the air.'
  }
  if (state.suspectedDiagnosis === 'restricted_filter' && hasTruth(state, 'filter_restricted')) {
    return 'State the fault when the evidence holds.'
  }
  if (state.suspectedDiagnosis && state.suspectedDiagnosis !== 'restricted_filter') {
    return 'Test that idea against a reading before you trust it.'
  }
  if (state.phase === 'hypothesis') return 'Gather the reading that would confirm or drop that idea.'
  return 'Determine why the outlet is warmer than expected.'
}

export function phaseLabel(state: ScenarioState): string {
  if (state.phase === 'complete') return 'Complete'
  if (state.phase === 'hypothesis') return 'Testing a hypothesis'
  return 'Investigating'
}

export function guidanceLabel(level: ScenarioState['guidanceLevel']): string {
  if (level === 'high_support') return 'High support'
  if (level === 'supportive') return 'Supportive'
  return 'Normal'
}
