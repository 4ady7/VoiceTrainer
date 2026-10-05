import { z } from 'zod'
import { COMPONENT_IDS, DIAGNOSIS_IDS, OBSERVATION_IDS } from '../scenario/types'

const componentEnum = z.enum(COMPONENT_IDS)
const diagnosisEnum = z.enum(DIAGNOSIS_IDS)
const observationEnum = z.enum(OBSERVATION_IDS)

export const interpretationSchema = z.object({
  intent: z.enum([
    'inspect',
    'observe',
    'hypothesize',
    'confirm',
    'hint',
    'acknowledge',
    'clarify',
    'irrelevant',
  ]),
  mentionedComponents: z.array(componentEnum).max(3),
  claimedObservations: z.array(observationEnum).max(3),
  diagnosticHypothesis: diagnosisEnum.nullable(),
  requestedHint: z.boolean(),
  needsClarification: z.boolean(),
})

export type Interpretation = z.infer<typeof interpretationSchema>

export function parseModelJson(text: string): unknown {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fenced?.[1] ?? trimmed
  return JSON.parse(raw)
}

export function emptyInterpretation(intent: Interpretation['intent']): Interpretation {
  return {
    intent,
    mentionedComponents: [],
    claimedObservations: [],
    diagnosticHypothesis: null,
    requestedHint: intent === 'hint',
    needsClarification: intent === 'clarify',
  }
}
