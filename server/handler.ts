import { z } from 'zod'
import { interpretationSchema, parseModelJson } from '../src/features/instructor/schema'
import { complete } from './model'
import { instructorConfig } from './env'

const requestSchema = z.object({
  task: z.enum(['interpret', 'phrase', 'debrief']),
  utterance: z.string().max(2000).optional(),
  snapshot: z.unknown().optional(),
  recent: z.array(z.object({ speaker: z.string().max(40), text: z.string().max(2000) })).max(12).optional(),
  template: z.string().max(800).optional(),
  facts: z.unknown().optional(),
  debrief: z.unknown().optional(),
})

const INTERPRET_SYSTEM = `You classify a trainee utterance in a fictional cooling-unit exercise.
Return JSON only. Do not invent scores, completion, or readings.
Use only these component ids: power_switch, status_indicator, control_panel, temperature_display, pressure_gauge, fan, air_intake, air_outlet, filter_panel, compressor, emergency_stop.
Use only these observation ids when the trainee states a reading: powered_on, powered_off, status_running, status_fault, setpoint_normal, setpoint_wrong, temperature_high, temperature_normal, temperature_low, pressure_high, pressure_normal, pressure_low, fan_spinning, fan_stopped, intake_weak, intake_normal, outlet_weak, outlet_normal, outlet_warm, filter_restricted, filter_clear, compressor_running, compressor_stopped, estop_clear, estop_engaged, abnormal_unspecified, normal_unspecified.
Use only these diagnosis ids: restricted_filter, power_loss, compressor_failure, fan_failure, emergency_stop_engaged, low_charge.
Schema:
{"intent":"inspect|observe|hypothesize|confirm|hint|acknowledge|clarify|irrelevant","mentionedComponents":[],"claimedObservations":[],"diagnosticHypothesis":null,"requestedHint":false,"needsClarification":false}
Set needsClarification true only when intent is clarify.
If the trainee is vague about a reading and a last component is present, attach the reading to that component.
Do not punish grammar. Unclear speech is clarify, not irrelevant.`

const PHRASE_SYSTEM = `You are the instructor in a fictional diagnostic exercise.
Speak in one to three short sentences.
Use only the supplied template and facts. Do not add readings, scores, percentages, or a confirmed diagnosis unless the facts say the diagnosis was just confirmed.
Do not mention that you are a language model.
Return the spoken line only, with no JSON and no label.`

const DEBRIEF_SYSTEM = `You write a short coaching note for a fictional training debrief.
Use two or three sentences.
If you mention the overall mark, use the exact integer provided.
Do not invent a different result, a percentage, or the word score.
Do not claim the diagnosis was confirmed unless the record says completed is true.
Return prose only.`

export function healthBody(): { live: boolean } {
  return { live: instructorConfig() != null }
}

export async function handleInstructor(input: unknown): Promise<{ status: number; body: unknown }> {
  const parsed = requestSchema.safeParse(input)
  if (!parsed.success) return { status: 400, body: { ok: false, error: 'invalid request' } }
  if (!instructorConfig()) return { status: 503, body: { ok: false, error: 'instructor model unavailable' } }

  try {
    if (parsed.data.task === 'interpret') {
      const text = await complete(
        INTERPRET_SYSTEM,
        JSON.stringify({
          utterance: parsed.data.utterance ?? '',
          snapshot: parsed.data.snapshot ?? {},
          recent: parsed.data.recent ?? [],
        }),
      )
      if (!text) return { status: 502, body: { ok: false, error: 'model unavailable' } }
      const interpretation = interpretationSchema.safeParse(parseModelJson(text))
      if (!interpretation.success) return { status: 422, body: { ok: false, error: 'malformed interpretation' } }
      return { status: 200, body: { ok: true, interpretation: interpretation.data } }
    }

    if (parsed.data.task === 'phrase') {
      const text = await complete(
        PHRASE_SYSTEM,
        JSON.stringify({
          utterance: parsed.data.utterance ?? '',
          template: parsed.data.template ?? '',
          facts: parsed.data.facts ?? {},
        }),
      )
      if (!text) return { status: 502, body: { ok: false, error: 'model unavailable' } }
      return { status: 200, body: { ok: true, reply: text.trim() } }
    }

    const text = await complete(DEBRIEF_SYSTEM, JSON.stringify(parsed.data.debrief ?? {}))
    if (!text) return { status: 502, body: { ok: false, error: 'model unavailable' } }
    return { status: 200, body: { ok: true, coaching: text.trim() } }
  } catch {
    return { status: 502, body: { ok: false, error: 'model unavailable' } }
  }
}
