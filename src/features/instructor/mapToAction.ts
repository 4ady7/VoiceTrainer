import { claimFits } from '../scenario/content'
import type { EngineAction } from '../scenario/types'
import type { InterpretContext } from './demoInterpreter'
import type { Interpretation } from './schema'

export function toEngineAction(interpretation: Interpretation, ctx: InterpretContext): EngineAction {
  if (interpretation.intent === 'acknowledge') return { type: 'acknowledge' }
  if (interpretation.requestedHint || interpretation.intent === 'hint') return { type: 'request_hint' }
  if (interpretation.intent === 'irrelevant') return { type: 'irrelevant' }
  if (interpretation.intent === 'clarify') return { type: 'clarify' }

  if (interpretation.intent === 'confirm') {
    if (!interpretation.diagnosticHypothesis) return { type: 'clarify' }
    return { type: 'confirm', diagnosisId: interpretation.diagnosticHypothesis }
  }

  if (interpretation.intent === 'hypothesize') {
    if (!interpretation.diagnosticHypothesis) return { type: 'clarify' }
    return { type: 'hypothesize', diagnosisId: interpretation.diagnosticHypothesis }
  }

  if (interpretation.intent === 'observe' || interpretation.intent === 'inspect') {
    const mentioned = interpretation.mentionedComponents
    if (mentioned.length > 1) {
      const claim = interpretation.claimedObservations[0]
      if (interpretation.intent === 'observe' && claim) {
        const fitting = mentioned.filter((id) => claimFits(id, claim))
        if (fitting.length === 1) return { type: 'observe', componentId: fitting[0], claim }
      }
      return { type: 'clarify' }
    }
  }

  const componentId = interpretation.mentionedComponents[0] ?? ctx.lastComponentId
  if (interpretation.intent === 'observe') {
    const claim = interpretation.claimedObservations[0]
    if (!componentId || !claim || !claimFits(componentId, claim)) {
      return componentId ? { type: 'inspect', componentId } : { type: 'clarify' }
    }
    return { type: 'observe', componentId, claim }
  }

  if (interpretation.intent === 'inspect') {
    if (!componentId) return { type: 'clarify' }
    return { type: 'inspect', componentId }
  }

  return { type: 'clarify' }
}
