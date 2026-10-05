import { composeReply, transitionLabel } from './compose'
import { interpretDemo, type InterpretContext } from './demoInterpreter'
import { replyAcceptable } from './guard'
import { toEngineAction } from './mapToAction'
import { interpretationSchema, parseModelJson } from './schema'
import { snapshotState } from './snapshot'
import { reduce } from '../scenario/engine'
import type { ComponentId, Judgment, ReduceResult, ScenarioState } from '../scenario/types'

export interface TranscriptSnippet {
  speaker: string
  text: string
}

export interface TurnInput {
  utterance: string
  state: ScenarioState
  recent: TranscriptSnippet[]
  mode: 'live' | 'local'
  now: number
}

export interface TurnDeps {
  interpret: (input: TurnInput, snapshot: ReturnType<typeof snapshotState>) => Promise<unknown | null>
  phrase: (input: {
    utterance: string
    template: string
    result: ReduceResult
    snapshot: ReturnType<typeof snapshotState>
  }) => Promise<string | null>
}

export interface TurnOutcome {
  state: ScenarioState
  reply: string
  componentId: ComponentId | null
  transition: string | null
  judgment: Judgment | null
  usedModel: boolean
  phrased: boolean
}

function contextFor(state: ScenarioState): InterpretContext {
  return { lastComponentId: state.lastComponentId }
}

export async function runTurn(input: TurnInput, deps: TurnDeps): Promise<TurnOutcome> {
  const utterance = input.utterance.trim()
  const ctx = contextFor(input.state)
  if (!utterance) {
    return {
      state: input.state,
      reply: 'I did not catch anything. Say what you are checking, or type it.',
      componentId: null,
      transition: null,
      judgment: null,
      usedModel: false,
      phrased: false,
    }
  }

  let usedModel = false
  let parsed = null as ReturnType<typeof interpretationSchema.safeParse> | null
  if (input.mode === 'live') {
    const raw = await deps.interpret(input, snapshotState(input.state))
    if (raw) {
      parsed = interpretationSchema.safeParse(raw)
      usedModel = parsed.success
    }
  }

  const interpretation = parsed?.success ? parsed.data : interpretDemo(utterance, ctx)
  const action = toEngineAction(interpretation, ctx)
  const result = reduce(input.state, action, input.now)
  const template = composeReply(input.state, action, result)
  let reply = template
  let phrased = false

  if (usedModel && action.type !== 'clarify' && action.type !== 'acknowledge') {
    const spoken = await deps.phrase({
      utterance,
      template,
      result,
      snapshot: snapshotState(result.state),
    })
    if (spoken && replyAcceptable(spoken, result)) {
      reply = spoken.trim()
      phrased = true
    }
  }

  return {
    state: result.state,
    reply,
    componentId: result.componentId,
    transition: transitionLabel(result),
    judgment: result.judgment,
    usedModel,
    phrased,
  }
}

export function interpretationFromModelText(text: string): unknown | null {
  try {
    return parseModelJson(text)
  } catch {
    return null
  }
}
