import { describe, expect, it } from 'vitest'
import { COMPONENTS } from './content'
import { buildDebrief } from './debrief'
import { createInitialState, reduce } from './engine'
import { deriveGuidance } from './guidance'
import type { EngineAction, ScenarioState } from './types'
import { deriveVisuals } from './visuals'

function run(actions: EngineAction[], start = 0, step = 1000): ScenarioState {
  let state = reduce(createInitialState(), { type: 'begin' }, start).state
  actions.forEach((action, index) => {
    state = reduce(state, action, start + (index + 1) * step).state
  })
  return state
}

describe('scenario engine', () => {
  it('starts unpublished, incomplete, and at normal guidance', () => {
    const state = createInitialState()
    expect(state.phase).toBe('investigation')
    expect(state.completed).toBe(false)
    expect(state.checked).toEqual({})
    expect(state.confirmedDiagnosis).toBeNull()
    expect(state.guidanceLevel).toBe('normal')
    expect(state.score.overall).toBe(0)
    expect(state.mistakes).toHaveLength(0)
  })

  it('records a valid inspection and reveals the instrument truth', () => {
    const result = reduce(reduce(createInitialState(), { type: 'begin' }, 0).state, {
      type: 'inspect',
      componentId: 'pressure_gauge',
    }, 1000)
    expect(result.judgment).toBe('correct')
    expect(result.state.checked.pressure_gauge?.times).toBe(1)
    expect(result.state.lastComponentId).toBe('pressure_gauge')
    expect(result.truth).toBe('pressure_high')
    expect(result.state.observations.some((item) => item.truth === 'pressure_high')).toBe(true)
  })

  it('accepts a different inspection order', () => {
    const temperatureFirst = run([
      { type: 'inspect', componentId: 'temperature_display' },
      { type: 'inspect', componentId: 'power_switch' },
    ])
    const powerFirst = run([
      { type: 'inspect', componentId: 'power_switch' },
      { type: 'inspect', componentId: 'temperature_display' },
    ])
    expect(temperatureFirst.checked.temperature_display).toBeTruthy()
    expect(temperatureFirst.checked.power_switch).toBeTruthy()
    expect(powerFirst.checked.temperature_display).toBeTruthy()
    expect(powerFirst.checked.power_switch).toBeTruthy()
    expect(temperatureFirst.completed).toBe(false)
    expect(powerFirst.completed).toBe(false)
  })

  it('marks an incorrect observation without treating it as the truth claim', () => {
    const state = run([
      { type: 'observe', componentId: 'pressure_gauge', claim: 'pressure_low' },
    ])
    expect(state.observations.some((item) => item.judgment === 'incorrect' && item.claim === 'pressure_low')).toBe(true)
    expect(state.mistakes).toHaveLength(1)
    expect(state.mistakes[0]?.kind).toBe('incorrect_observation')
    expect(state.score.observationAccuracy).toBe(0)
  })

  it('gives partial credit for an unspecified abnormal reading', () => {
    const state = run([
      { type: 'observe', componentId: 'pressure_gauge', claim: 'abnormal_unspecified' },
    ])
    expect(state.observations.some((item) => item.judgment === 'partial')).toBe(true)
    expect(state.mistakes).toHaveLength(0)
    expect(state.score.observationAccuracy).toBe(50)
  })

  it('scores a correct claim above a partial claim', () => {
    const correct = run([{ type: 'observe', componentId: 'pressure_gauge', claim: 'pressure_high' }])
    const partial = run([{ type: 'observe', componentId: 'pressure_gauge', claim: 'abnormal_unspecified' }])
    expect(correct.score.observationAccuracy).toBeGreaterThan(partial.score.observationAccuracy)
  })

  it('treats a repeated inspection as already checked', () => {
    const state = run([
      { type: 'inspect', componentId: 'fan' },
      { type: 'inspect', componentId: 'fan' },
    ])
    expect(state.repeatedActions).toBe(1)
    expect(state.observations.filter((item) => item.judgment === 'revealed')).toHaveLength(1)
    expect(state.checked.fan?.times).toBe(2)
  })

  it('tracks hints separately from mistakes', () => {
    const state = run([{ type: 'request_hint' }])
    expect(state.hintsUsed).toBe(1)
    expect(state.hintIds[0]).toBe('symptom')
    expect(state.mistakes).toHaveLength(0)
    expect(state.score.hintDependence).toBe(78)
  })

  it('raises guidance after repeated mistakes and again under high support', () => {
    const supportive = run([
      { type: 'observe', componentId: 'pressure_gauge', claim: 'pressure_low' },
      { type: 'observe', componentId: 'fan', claim: 'fan_stopped' },
    ])
    expect(supportive.guidanceLevel).toBe('supportive')

    const high = run([
      { type: 'observe', componentId: 'pressure_gauge', claim: 'pressure_low' },
      { type: 'observe', componentId: 'fan', claim: 'fan_stopped' },
      { type: 'observe', componentId: 'power_switch', claim: 'powered_off' },
      { type: 'observe', componentId: 'compressor', claim: 'compressor_stopped' },
    ])
    expect(high.mistakes.length).toBeGreaterThanOrEqual(4)
    expect(high.guidanceLevel).toBe('high_support')
    expect(deriveGuidance(high)).toBe('high_support')
  })

  it('does not turn a clarification into a mistake', () => {
    const state = run([{ type: 'clarify' }, { type: 'acknowledge' }])
    expect(state.mistakes).toHaveLength(0)
    expect(state.uncertaintyTurns).toBe(1)
    expect(state.score.diagnosticAccuracy).toBe(0)
  })

  it('rejects a wrong diagnosis', () => {
    const state = run([{ type: 'confirm', diagnosisId: 'power_loss' }])
    expect(state.completed).toBe(false)
    expect(state.confirmedDiagnosis).toBeNull()
    expect(state.wrongConfirms).toBe(1)
    expect(state.mistakes.some((item) => item.kind === 'incorrect_diagnosis')).toBe(true)
  })

  it('rejects the right diagnosis before the evidence is in', () => {
    const state = run([{ type: 'confirm', diagnosisId: 'restricted_filter' }])
    expect(state.completed).toBe(false)
    expect(state.prematureConfirms).toBe(1)
    expect(state.namedCorrectFault).toBe(true)
    expect(state.confirmedDiagnosis).toBeNull()
  })

  it('completes on the correct diagnosis after key evidence, in more than one order', () => {
    const ordered = run([
      { type: 'inspect', componentId: 'temperature_display' },
      { type: 'inspect', componentId: 'pressure_gauge' },
      { type: 'inspect', componentId: 'fan' },
      { type: 'inspect', componentId: 'filter_panel' },
      { type: 'hypothesize', diagnosisId: 'restricted_filter' },
      { type: 'confirm', diagnosisId: 'restricted_filter' },
    ])
    const alternate = run([
      { type: 'inspect', componentId: 'filter_panel' },
      { type: 'inspect', componentId: 'air_outlet' },
      { type: 'inspect', componentId: 'temperature_display' },
      { type: 'confirm', diagnosisId: 'restricted_filter' },
    ])
    for (const state of [ordered, alternate]) {
      expect(state.completed).toBe(true)
      expect(state.phase).toBe('complete')
      expect(state.confirmedDiagnosis).toBe('restricted_filter')
      expect(state.score.completion).toBe(100)
      expect(state.score.diagnosticAccuracy).toBeGreaterThanOrEqual(90)
      expect(state.score.overall).toBeGreaterThanOrEqual(80)
      expect(state.score.overall).toBeLessThanOrEqual(100)
    }
    expect(ordered.diagnosticPath.some((step) => step.summary.includes('Confirmed'))).toBe(true)
  })

  it('keeps every score dimension inside 0 to 100', () => {
    const state = run([
      { type: 'inspect', componentId: 'temperature_display' },
      { type: 'observe', componentId: 'pressure_gauge', claim: 'pressure_low' },
      { type: 'request_hint' },
      { type: 'irrelevant' },
      { type: 'confirm', diagnosisId: 'fan_failure' },
      { type: 'inspect', componentId: 'filter_panel' },
      { type: 'inspect', componentId: 'fan' },
      { type: 'confirm', diagnosisId: 'restricted_filter' },
    ])
    for (const value of Object.values(state.score)) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(100)
    }
  })

  it('moves guidance up when time passes without the filter', () => {
    let state = reduce(createInitialState(), { type: 'begin' }, 0).state
    state = reduce(state, { type: 'observe', componentId: 'power_switch', claim: 'powered_off' }, 1000).state
    state = reduce(state, { type: 'request_hint' }, 2000).state
    state = reduce(state, { type: 'tick' }, 8 * 60 * 1000).state
    expect(state.elapsedMs).toBe(8 * 60 * 1000)
    expect(state.guidanceLevel).not.toBe('normal')
  })

  it('does not show the filter fault before that panel is inspected', () => {
    const initial = reduce(createInitialState(), { type: 'begin' }, 0).state
    expect(deriveVisuals(initial, null, null).filter_panel.fault).toBe(false)
    const seen = reduce(initial, { type: 'inspect', componentId: 'filter_panel' }, 1000).state
    const visuals = deriveVisuals(seen, null, null)
    expect(visuals.filter_panel.fault).toBe(true)
    expect(visuals.pressure_gauge.fault).toBe(false)
    expect(visuals.temperature_display.warning).toBe(false)
  })

  it('builds a debrief from engine metrics', () => {
    const state = run([
      { type: 'inspect', componentId: 'temperature_display' },
      { type: 'observe', componentId: 'pressure_gauge', claim: 'pressure_high' },
      { type: 'inspect', componentId: 'filter_panel' },
      { type: 'confirm', diagnosisId: 'restricted_filter' },
    ])
    const report = buildDebrief(state)
    expect(report.completed).toBe(true)
    expect(report.overall).toBe(state.score.overall)
    expect(report.didWell.length).toBeGreaterThan(0)
    expect(report.keyObservations.some((item) => item.componentId === 'filter_panel')).toBe(true)
    expect(report.path.length).toBe(state.diagnosticPath.length)
    expect(report.confirmedLabel).toBe('Restricted filter')
    expect(COMPONENTS.length).toBe(11)
  })
})
