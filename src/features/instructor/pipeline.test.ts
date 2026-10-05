import { describe, expect, it } from 'vitest'
import { COMPONENTS } from '../scenario/content'
import { createInitialState, reduce } from '../scenario/engine'
import { canonicalInspect, interpretDemo } from './demoInterpreter'
import { toEngineAction } from './mapToAction'
import { replyAcceptable } from './guard'
import { runTurn } from './orchestrate'
import { snapshotState } from './snapshot'
import type { EngineAction } from '../scenario/types'

const pressurePhrases = [
  "I'm checking the pressure gauge.",
  'Let me inspect the pressure.',
  'I want to see the pressure.',
  "I'm looking at the gauge.",
]

describe('demo interpreter', () => {
  it('maps pressure paraphrases to the same inspection', () => {
    const actions = pressurePhrases.map((phrase) =>
      toEngineAction(interpretDemo(phrase, { lastComponentId: null }), { lastComponentId: null }),
    )
    const expected: EngineAction = { type: 'inspect', componentId: 'pressure_gauge' }
    for (const action of actions) expect(action).toEqual(expected)
  })

  it('maps every component label to an inspection', () => {
    for (const component of COMPONENTS) {
      const action = toEngineAction(interpretDemo(canonicalInspect(component.id), { lastComponentId: null }), {
        lastComponentId: null,
      })
      expect(action).toEqual({ type: 'inspect', componentId: component.id })
    }
  })

  it('attaches a high reading to the gauge the trainee just checked', () => {
    const action = toEngineAction(
      interpretDemo("It's reading higher than expected.", { lastComponentId: 'pressure_gauge' }),
      { lastComponentId: 'pressure_gauge' },
    )
    expect(action).toEqual({ type: 'observe', componentId: 'pressure_gauge', claim: 'pressure_high' })
  })

  it('treats a clogged filter as an observation and a stated fault as a diagnosis', () => {
    const observed = toEngineAction(interpretDemo('The filter is clogged.', { lastComponentId: null }), {
      lastComponentId: null,
    })
    const confirmed = toEngineAction(
      interpretDemo('My diagnosis is a restricted filter.', { lastComponentId: 'filter_panel' }),
      { lastComponentId: 'filter_panel' },
    )
    const suspected = toEngineAction(interpretDemo('Could it be the compressor?', { lastComponentId: null }), {
      lastComponentId: null,
    })
    expect(observed).toEqual({ type: 'observe', componentId: 'filter_panel', claim: 'filter_restricted' })
    expect(confirmed).toEqual({ type: 'confirm', diagnosisId: 'restricted_filter' })
    expect(suspected).toEqual({ type: 'hypothesize', diagnosisId: 'compressor_failure' })
  })

  it('does not treat a hint, an aside, or a mumbled fragment as a mistake action', () => {
    expect(toEngineAction(interpretDemo('Can I get a hint?', { lastComponentId: null }), { lastComponentId: null })).toEqual({
      type: 'request_hint',
    })
    expect(toEngineAction(interpretDemo("What's the weather today?", { lastComponentId: null }), { lastComponentId: null })).toEqual({
      type: 'irrelevant',
    })
    expect(toEngineAction(interpretDemo('um', { lastComponentId: null }), { lastComponentId: null })).toEqual({
      type: 'clarify',
    })
    expect(toEngineAction(interpretDemo('ok', { lastComponentId: null }), { lastComponentId: null })).toEqual({
      type: 'acknowledge',
    })
  })

  it('plays a full diagnostic conversation through the engine', () => {
    const lines = [
      "I'm checking the temperature display.",
      "It's higher than expected.",
      'Let me inspect the pressure.',
      'The gauge is high.',
      "I'm looking at the fan.",
      "I'm checking the air intake.",
      'The intake airflow is weak.',
      "I'm checking the filter panel.",
      'The filter is clogged.',
      'I suspect a restricted filter.',
      'My diagnosis is a restricted filter.',
    ]
    let state = reduce(createInitialState(), { type: 'begin' }, 0).state
    for (const line of lines) {
      const ctx = { lastComponentId: state.lastComponentId }
      state = reduce(state, toEngineAction(interpretDemo(line, ctx), ctx), 1000).state
    }
    expect(state.completed).toBe(true)
    expect(state.confirmedDiagnosis).toBe('restricted_filter')
    expect(state.mistakes).toHaveLength(0)
  })
})

describe('orchestrator', () => {
  it('keeps an empty transcript from changing the score', async () => {
    const state = reduce(createInitialState(), { type: 'begin' }, 0).state
    const outcome = await runTurn(
      { utterance: '   ', state, recent: [], mode: 'local', now: 1000 },
      { interpret: async () => null, phrase: async () => null },
    )
    expect(outcome.state.score).toEqual(state.score)
    expect(outcome.state.mistakes).toHaveLength(0)
    expect(outcome.reply.length).toBeGreaterThan(0)
  })

  it('falls back to the local interpreter when the model payload is malformed', async () => {
    const state = reduce(createInitialState(), { type: 'begin' }, 0).state
    const outcome = await runTurn(
      { utterance: "I'm checking the pressure gauge.", state, recent: [], mode: 'live', now: 1000 },
      { interpret: async () => ({ intent: 'inspect', mentionedComponents: ['not-a-part'] }), phrase: async () => null },
    )
    expect(outcome.usedModel).toBe(false)
    expect(outcome.state.checked.pressure_gauge).toBeTruthy()
    expect(outcome.reply.toLowerCase()).toContain('pressure')
  })

  it('rejects a phrased reply that invents a score', async () => {
    const state = reduce(createInitialState(), { type: 'begin' }, 0).state
    const outcome = await runTurn(
      { utterance: "I'm checking the fan.", state, recent: [], mode: 'live', now: 1000 },
      {
        interpret: async () => ({
          intent: 'inspect',
          mentionedComponents: ['fan'],
          claimedObservations: [],
          diagnosticHypothesis: null,
          requestedHint: false,
          needsClarification: false,
        }),
        phrase: async () => 'Nice work. Your score is 99% and the session is complete.',
      },
    )
    expect(outcome.phrased).toBe(false)
    expect(outcome.reply.toLowerCase()).not.toContain('score')
    expect(outcome.state.completed).toBe(false)
    expect(replyAcceptable('Your score is 99%.', outcome.state && {
      state: outcome.state,
      judgment: 'correct',
      componentId: 'fan',
      claim: null,
      truth: 'fan_spinning',
      hintId: null,
      premature: false,
      completedNow: false,
      wrongDiagnosis: null,
    })).toBe(false)
  })

  it('omits hidden readings from the model snapshot', () => {
    const state = reduce(createInitialState(), { type: 'begin' }, 0).state
    const snapshot = snapshotState(state)
    const encoded = JSON.stringify(snapshot)
    expect(encoded).not.toContain('filter_restricted')
    expect(encoded).not.toContain('pressure_high')
    const seen = reduce(state, { type: 'inspect', componentId: 'pressure_gauge' }, 1000).state
    expect(JSON.stringify(snapshotState(seen))).toContain('above the marked band')
    expect(JSON.stringify(snapshotState(seen))).not.toContain('filter_restricted')
  })
})
