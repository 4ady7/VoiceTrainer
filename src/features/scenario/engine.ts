import { COMPONENT_BY_ID, CORRECT_DIAGNOSIS, DIAGNOSIS_LABEL, HINT_TEXT, judgeClaim } from './content'
import { deriveGuidance } from './guidance'
import { scoreState } from './scoring'
import { addCheckpoint, checkpointsFor, evidenceReady, isChecked } from './selectors'
import type {
  ComponentId,
  EngineAction,
  HintId,
  ReduceResult,
  ScenarioState,
} from './types'

const EMPTY_SCORE = {
  diagnosticAccuracy: 0,
  observationAccuracy: 0,
  processQuality: 0,
  efficiency: 0,
  hintDependence: 0,
  completion: 0,
  overall: 0,
}

export function createInitialState(): ScenarioState {
  const blank: ScenarioState = {
    phase: 'investigation',
    startedAtMs: null,
    elapsedMs: 0,
    checked: {},
    observations: [],
    suspectedDiagnosis: null,
    confirmedDiagnosis: null,
    namedCorrectFault: false,
    hintsUsed: 0,
    hintIds: [],
    mistakes: [],
    correctActions: 0,
    repeatedActions: 0,
    irrelevantActions: 0,
    uncertaintyTurns: 0,
    stallTurns: 0,
    prematureConfirms: 0,
    wrongConfirms: 0,
    wrongHypotheses: 0,
    checkpoints: [],
    guidanceLevel: 'normal',
    score: EMPTY_SCORE,
    completed: false,
    completedAtMs: null,
    diagnosticPath: [],
    lastComponentId: null,
    actionCount: 0,
  }
  return finalize(blank, 0)
}

function finalize(state: ScenarioState, now: number): ScenarioState {
  const elapsedMs = state.startedAtMs == null ? 0 : Math.max(0, now - state.startedAtMs)
  const next = { ...state, elapsedMs }
  return {
    ...next,
    guidanceLevel: deriveGuidance(next),
    score: scoreState(next),
  }
}

function result(
  state: ScenarioState,
  now: number,
  extras: Partial<Omit<ReduceResult, 'state'>> = {},
): ReduceResult {
  return {
    state: finalize(state, now),
    judgment: extras.judgment ?? null,
    componentId: extras.componentId ?? null,
    claim: extras.claim ?? null,
    truth: extras.truth ?? null,
    hintId: extras.hintId ?? null,
    premature: extras.premature ?? false,
    completedNow: extras.completedNow ?? false,
    wrongDiagnosis: extras.wrongDiagnosis ?? null,
  }
}

function elapsed(state: ScenarioState, now: number): number {
  if (state.startedAtMs == null) return 0
  return Math.max(0, now - state.startedAtMs)
}

function reveal(state: ScenarioState, componentId: ComponentId, atMs: number): ScenarioState['observations'] {
  const truth = COMPONENT_BY_ID[componentId].truth
  const already = state.observations.some(
    (record) => record.componentId === componentId && record.judgment === 'revealed',
  )
  if (already) return state.observations
  return [...state.observations, { componentId, claim: null, truth, judgment: 'revealed', atMs }]
}

function markChecked(state: ScenarioState, componentId: ComponentId, atMs: number): ScenarioState['checked'] {
  const prior = state.checked[componentId]
  return {
    ...state.checked,
    [componentId]: { times: (prior?.times ?? 0) + 1, atMs },
  }
}

function selectHint(state: ScenarioState): HintId {
  const filterSeen = isChecked(state, 'filter_panel')
  const tempSeen = isChecked(state, 'temperature_display')
  const airSeen = Boolean(state.checked.air_intake || state.checked.air_outlet || state.checked.fan)
  const strong = state.guidanceLevel === 'high_support' || state.hintsUsed >= 3
  const medium = state.guidanceLevel !== 'normal' || state.hintsUsed >= 2

  if (strong && !filterSeen) return 'filter_area'
  if (filterSeen && tempSeen && !state.namedCorrectFault) return 'connect'
  if (filterSeen && state.namedCorrectFault) return 'name_fault'
  if (medium && !filterSeen && (tempSeen || airSeen)) return 'filter_area'
  if (!tempSeen && !isChecked(state, 'pressure_gauge') && state.hintsUsed <= 1) return 'symptom'
  if (!airSeen) return 'airflow'
  if (!filterSeen) return 'filter_area'
  if (!tempSeen) return 'symptom'
  return 'name_fault'
}

function finished(state: ScenarioState): boolean {
  return state.completed
}

export function reduce(state: ScenarioState, action: EngineAction, now = 0): ReduceResult {
  if (action.type === 'begin') {
    if (state.startedAtMs != null) return result(state, now)
    const next: ScenarioState = {
      ...state,
      startedAtMs: now,
      phase: 'investigation',
      diagnosticPath: [{ atMs: 0, componentId: null, summary: 'Session started.' }],
      actionCount: state.actionCount + 1,
    }
    return result(next, now)
  }

  if (action.type === 'tick') return result(state, now)

  if (finished(state)) return result(state, now, { judgment: 'already_checked' })

  const atMs = elapsed(state, now)

  if (action.type === 'clarify') {
    return result(
      {
        ...state,
        uncertaintyTurns: state.uncertaintyTurns + 1,
        actionCount: state.actionCount + 1,
        diagnosticPath: [
          ...state.diagnosticPath,
          { atMs, componentId: state.lastComponentId, summary: 'Asked for the last remark to be restated.' },
        ],
      },
      now,
    )
  }

  if (action.type === 'acknowledge') {
    return result(
      {
        ...state,
        actionCount: state.actionCount + 1,
      },
      now,
    )
  }

  if (action.type === 'irrelevant') {
    return result(
      {
        ...state,
        irrelevantActions: state.irrelevantActions + 1,
        stallTurns: state.stallTurns + 1,
        actionCount: state.actionCount + 1,
        diagnosticPath: [...state.diagnosticPath, { atMs, componentId: null, summary: 'Off-task remark.' }],
      },
      now,
      { judgment: 'irrelevant' },
    )
  }

  if (action.type === 'request_hint') {
    const hinted: ScenarioState = {
      ...state,
      hintsUsed: state.hintsUsed + 1,
      stallTurns: 0,
      actionCount: state.actionCount + 1,
      elapsedMs: atMs,
    }
    const hintId = selectHint({ ...hinted, guidanceLevel: deriveGuidance(hinted) })
    return result(
      {
        ...hinted,
        hintIds: [...hinted.hintIds, hintId],
        diagnosticPath: [
          ...state.diagnosticPath,
          { atMs, componentId: null, summary: `Hint: ${HINT_TEXT[hintId]}` },
        ],
      },
      now,
      { judgment: 'partial', hintId },
    )
  }

  if (action.type === 'inspect') {
    return inspect(state, action.componentId, now, atMs)
  }

  if (action.type === 'observe') {
    return observe(state, action.componentId, action.claim, now, atMs)
  }

  if (action.type === 'hypothesize') {
    return hypothesize(state, action.diagnosisId, now, atMs)
  }

  if (action.type === 'confirm') {
    return confirm(state, action.diagnosisId, now, atMs)
  }

  return result(state, now)
}

function inspect(state: ScenarioState, componentId: ComponentId, now: number, atMs: number): ReduceResult {
  const spec = COMPONENT_BY_ID[componentId]
  if (isChecked(state, componentId)) {
    return result(
      {
        ...state,
        repeatedActions: state.repeatedActions + 1,
        stallTurns: state.stallTurns + 1,
        lastComponentId: componentId,
        actionCount: state.actionCount + 1,
        checked: markChecked(state, componentId, atMs),
        diagnosticPath: [
          ...state.diagnosticPath,
          { atMs, componentId, summary: `Checked ${spec.label} again.` },
        ],
      },
      now,
      { judgment: 'already_checked', componentId, truth: spec.truth },
    )
  }

  const next: ScenarioState = {
    ...state,
    checked: markChecked(state, componentId, atMs),
    observations: reveal(state, componentId, atMs),
    checkpoints: checkpointsFor(state, componentId),
    correctActions: state.correctActions + 1,
    stallTurns: 0,
    lastComponentId: componentId,
    actionCount: state.actionCount + 1,
    diagnosticPath: [...state.diagnosticPath, { atMs, componentId, summary: `Checked ${spec.label}.` }],
  }
  return result(next, now, { judgment: 'correct', componentId, truth: spec.truth })
}

function observe(
  state: ScenarioState,
  componentId: ComponentId,
  claim: import('./types').ObservationId,
  now: number,
  atMs: number,
): ReduceResult {
  const spec = COMPONENT_BY_ID[componentId]
  const judgment = judgeClaim(componentId, claim)
  const repeated = state.observations.some(
    (record) => record.componentId === componentId && record.claim === claim && record.judgment === judgment,
  )
  if (repeated && judgment !== 'incorrect') {
    return result(
      {
        ...state,
        repeatedActions: state.repeatedActions + 1,
        lastComponentId: componentId,
        actionCount: state.actionCount + 1,
        checked: isChecked(state, componentId) ? state.checked : markChecked(state, componentId, atMs),
        diagnosticPath: [
          ...state.diagnosticPath,
          { atMs, componentId, summary: `Repeated the reading on ${spec.label}.` },
        ],
      },
      now,
      { judgment: 'already_checked', componentId, claim, truth: spec.truth },
    )
  }

  let mistakes = state.mistakes
  let stallTurns = 0
  let correctActions = state.correctActions + (judgment === 'incorrect' ? 0 : 1)
  if (judgment === 'incorrect') {
    mistakes = [
      ...state.mistakes,
      {
        kind: 'incorrect_observation',
        componentId,
        detail: `Misread the ${spec.label.toLowerCase()}.`,
        atMs,
      },
    ]
    stallTurns = state.stallTurns + 1
    correctActions = state.correctActions
  }

  const next: ScenarioState = {
    ...state,
    checked: markChecked(state, componentId, atMs),
    observations: [
      ...reveal(state, componentId, atMs),
      { componentId, claim, truth: spec.truth, judgment, atMs },
    ],
    checkpoints: checkpointsFor(state, componentId),
    mistakes,
    stallTurns,
    correctActions,
    lastComponentId: componentId,
    actionCount: state.actionCount + 1,
    diagnosticPath: [
      ...state.diagnosticPath,
      {
        atMs,
        componentId,
        summary:
          judgment === 'correct'
            ? `Read ${spec.label} correctly.`
            : judgment === 'partial'
              ? `Partly read ${spec.label}.`
              : `Misread ${spec.label}.`,
      },
    ],
  }
  return result(next, now, { judgment, componentId, claim, truth: spec.truth })
}

function hypothesize(
  state: ScenarioState,
  diagnosisId: import('./types').DiagnosisId,
  now: number,
  atMs: number,
): ReduceResult {
  const correct = diagnosisId === CORRECT_DIAGNOSIS
  const label = DIAGNOSIS_LABEL[diagnosisId]
  if (state.suspectedDiagnosis === diagnosisId) {
    return result(
      {
        ...state,
        repeatedActions: state.repeatedActions + 1,
        actionCount: state.actionCount + 1,
        diagnosticPath: [...state.diagnosticPath, { atMs, componentId: null, summary: `Repeated the ${label} idea.` }],
      },
      now,
      { judgment: 'already_checked' },
    )
  }

  const next: ScenarioState = {
    ...state,
    suspectedDiagnosis: diagnosisId,
    namedCorrectFault: state.namedCorrectFault || correct,
    phase: 'hypothesis',
    wrongHypotheses: state.wrongHypotheses + (correct ? 0 : 1),
    stallTurns: correct ? 0 : state.stallTurns + 1,
    correctActions: state.correctActions + (correct ? 1 : 0),
    mistakes: correct
      ? state.mistakes
      : [
          ...state.mistakes,
          { kind: 'incorrect_diagnosis', componentId: null, detail: `Suspected ${label.toLowerCase()}.`, atMs },
        ],
    checkpoints: correct ? addCheckpoint(state.checkpoints, 'hypothesis_correct') : state.checkpoints,
    actionCount: state.actionCount + 1,
    diagnosticPath: [
      ...state.diagnosticPath,
      { atMs, componentId: null, summary: correct ? `Suspected ${label.toLowerCase()}.` : `Suspected ${label.toLowerCase()}, which does not fit.` },
    ],
  }
  return result(next, now, {
    judgment: correct ? 'correct' : 'incorrect',
    wrongDiagnosis: correct ? null : diagnosisId,
  })
}

function confirm(
  state: ScenarioState,
  diagnosisId: import('./types').DiagnosisId,
  now: number,
  atMs: number,
): ReduceResult {
  const label = DIAGNOSIS_LABEL[diagnosisId]
  if (diagnosisId !== CORRECT_DIAGNOSIS) {
    const next: ScenarioState = {
      ...state,
      suspectedDiagnosis: diagnosisId,
      phase: 'hypothesis',
      wrongConfirms: state.wrongConfirms + 1,
      stallTurns: state.stallTurns + 1,
      mistakes: [
        ...state.mistakes,
        { kind: 'incorrect_diagnosis', componentId: null, detail: `Confirmed ${label.toLowerCase()}.`, atMs },
      ],
      actionCount: state.actionCount + 1,
      diagnosticPath: [
        ...state.diagnosticPath,
        { atMs, componentId: null, summary: `Rejected diagnosis: ${label.toLowerCase()}.` },
      ],
    }
    return result(next, now, { judgment: 'incorrect', wrongDiagnosis: diagnosisId })
  }

  if (!evidenceReady(state)) {
    const next: ScenarioState = {
      ...state,
      suspectedDiagnosis: CORRECT_DIAGNOSIS,
      namedCorrectFault: true,
      phase: 'hypothesis',
      prematureConfirms: state.prematureConfirms + 1,
      stallTurns: state.stallTurns + 1,
      mistakes: [
        ...state.mistakes,
        {
          kind: 'premature_diagnosis',
          componentId: null,
          detail: 'Named the restricted filter before the evidence was in.',
          atMs,
        },
      ],
      checkpoints: addCheckpoint(state.checkpoints, 'hypothesis_correct'),
      actionCount: state.actionCount + 1,
      diagnosticPath: [
        ...state.diagnosticPath,
        { atMs, componentId: null, summary: 'Named the restricted filter before enough evidence.' },
      ],
    }
    return result(next, now, { judgment: 'partial', premature: true })
  }

  const next: ScenarioState = {
    ...state,
    phase: 'complete',
    suspectedDiagnosis: CORRECT_DIAGNOSIS,
    confirmedDiagnosis: CORRECT_DIAGNOSIS,
    namedCorrectFault: true,
    completed: true,
    completedAtMs: atMs,
    stallTurns: 0,
    correctActions: state.correctActions + 1,
    checkpoints: addCheckpoint(state.checkpoints, 'diagnosis_confirmed'),
    actionCount: state.actionCount + 1,
    diagnosticPath: [...state.diagnosticPath, { atMs, componentId: 'filter_panel', summary: 'Confirmed the restricted filter.' }],
  }
  return result(next, now, { judgment: 'correct', completedNow: true, componentId: 'filter_panel' })
}
