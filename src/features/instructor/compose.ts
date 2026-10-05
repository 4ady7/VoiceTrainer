import {
  COMPONENT_BY_ID,
  DIAGNOSIS_LABEL,
  DIAGNOSIS_REBUTTAL,
  HINT_TEXT,
  OBSERVATION_TEXT,
} from '../scenario/content'
import { isChecked } from '../scenario/selectors'
import type { EngineAction, ReduceResult, ScenarioState } from '../scenario/types'

function limitSentences(text: string, max = 3): string {
  const parts = text.match(/[^.!?]+[.!?]+/g)
  if (!parts || parts.length <= max) return text.trim()
  return parts.slice(0, max).join(' ').trim()
}

function nudge(state: ScenarioState): string | null {
  if (state.guidanceLevel === 'normal') return null
  if (state.guidanceLevel === 'high_support') {
    return isChecked(state, 'filter_panel')
      ? 'Connect the filter to the warm outlet, then name the fault.'
      : 'Take a look at the filter area. Could restricted airflow explain the symptoms?'
  }
  return 'Think about the airflow through the unit.'
}

function withNudge(reply: string, result: ReduceResult): string {
  const worthy =
    result.premature ||
    result.judgment === 'incorrect' ||
    result.judgment === 'irrelevant' ||
    result.judgment === 'already_checked'
  if (!worthy) return limitSentences(reply)
  const line = nudge(result.state)
  if (!line) return limitSentences(reply)
  if (reply.toLowerCase().includes(line.slice(0, 24).toLowerCase())) return limitSentences(reply)
  return limitSentences(`${line} ${reply}`)
}

export function composeReply(before: ScenarioState, action: EngineAction, result: ReduceResult): string {
  if (action.type === 'begin') {
    return 'The unit is running, but the outlet is warmer than it should be. Tell me what you want to check first.'
  }
  if (before.completed || (result.state.completed && !result.completedNow)) {
    return 'The diagnosis is already confirmed. Open the debrief for the review.'
  }

  let reply = 'Say that again as a component, a reading, or a diagnosis.'

  if (action.type === 'clarify') {
    reply = 'I did not catch a clear action. Tell me what you are checking, or what you think it shows.'
  } else if (action.type === 'acknowledge') {
    reply = before.lastComponentId
      ? COMPONENT_BY_ID[before.lastComponentId].followup
      : 'What do you want to check next?'
  } else if (action.type === 'irrelevant') {
    reply = 'Stay with the cooling unit. What do you want to check?'
  } else if (action.type === 'request_hint' && result.hintId) {
    reply = HINT_TEXT[result.hintId]
  } else if (action.type === 'inspect' && result.componentId && result.truth) {
    const spec = COMPONENT_BY_ID[result.componentId]
    reply =
      result.judgment === 'already_checked'
        ? `You have already checked the ${spec.label.toLowerCase()}. ${spec.followup}`
        : `${OBSERVATION_TEXT[result.truth]} ${spec.followup}`
  } else if (action.type === 'observe' && result.componentId && result.truth) {
    const spec = COMPONENT_BY_ID[result.componentId]
    if (result.judgment === 'already_checked') {
      reply = `You already reported that on the ${spec.label.toLowerCase()}. ${spec.followup}`
    } else if (result.judgment === 'incorrect') {
      reply = `That does not match the ${spec.label.toLowerCase()}. ${OBSERVATION_TEXT[result.truth]}`
    } else if (result.judgment === 'partial') {
      reply = `You are close. Be specific about the ${spec.label.toLowerCase()}. ${OBSERVATION_TEXT[result.truth]}`
    } else {
      reply = `${OBSERVATION_TEXT[result.truth]} ${spec.followup}`
    }
  } else if (action.type === 'hypothesize' && action.diagnosisId) {
    if (result.judgment === 'already_checked') {
      reply = `You are still on ${DIAGNOSIS_LABEL[action.diagnosisId].toLowerCase()}. What evidence would move it forward?`
    } else if (action.diagnosisId === 'restricted_filter') {
      const sawFilter = isChecked(result.state, 'filter_panel')
      const sawTemperature = isChecked(result.state, 'temperature_display')
      reply =
        sawFilter && sawTemperature
          ? 'That ties the filter to the warm outlet. State it as your diagnosis when you are ready.'
          : sawFilter
            ? 'Restricted airflow fits the filter. Check the outlet temperature before you confirm it.'
            : 'Restricted airflow is a credible suspect. The filter and the outlet temperature still have to agree with it.'
    } else {
      reply = `${DIAGNOSIS_REBUTTAL[action.diagnosisId]} Which reading would have to be true?`
    }
  } else if (action.type === 'confirm' && action.diagnosisId) {
    if (result.completedNow) {
      reply = 'Diagnosis confirmed. A restricted filter fits the warm outlet and the readings you gathered.'
    } else if (result.premature) {
      reply = 'It might be the filter, but that still has to be earned on the equipment. Check the filter and the outlet temperature before you confirm it.'
    } else {
      reply = DIAGNOSIS_REBUTTAL[action.diagnosisId]
    }
  }

  return withNudge(reply, result)
}

export function transitionLabel(result: ReduceResult): string | null {
  if (!result.judgment) return null
  const name = result.componentId ? COMPONENT_BY_ID[result.componentId].label : null
  if (result.completedNow) return 'Diagnosis confirmed by the scenario engine'
  if (result.premature) return 'Right idea, evidence still short'
  if (result.judgment === 'correct' && name) return `${name} accepted`
  if (result.judgment === 'already_checked') return name ? `${name} already checked` : 'Already covered'
  if (result.judgment === 'incorrect') return 'Does not match the equipment'
  if (result.judgment === 'partial') return name ? `${name} partially read` : 'Partial observation'
  if (result.judgment === 'irrelevant') return 'Outside the scenario'
  return null
}
