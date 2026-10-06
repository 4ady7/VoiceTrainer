import { claimFits, COMPONENT_BY_ID, COMPONENTS } from '../scenario/content'
import type { ComponentId, DiagnosisId, ObservationId } from '../scenario/types'
import { emptyInterpretation, type Interpretation } from './schema'

export interface InterpretContext {
  lastComponentId: ComponentId | null
}

const COMPONENT_MATCHERS: { id: ComponentId; pattern: RegExp }[] = [
  { id: 'emergency_stop', pattern: /emergency stop|e-stop|estop|stop button/ },
  { id: 'temperature_display', pattern: /temperature display|temp display|temperature|thermometer|\btemp\b/ },
  { id: 'pressure_gauge', pattern: /pressure gauge|pressure|\bgauge\b/ },
  { id: 'filter_panel', pattern: /filter panel|\bfilter\b/ },
  { id: 'air_intake', pattern: /air intake|\bintake\b|\binlet\b/ },
  { id: 'air_outlet', pattern: /air outlet|\boutlet\b|\bexhaust\b|\bdischarge\b/ },
  { id: 'control_panel', pattern: /control panel|setpoint|set point/ },
  { id: 'status_indicator', pattern: /status indicator|status light|indicator light|status lamp/ },
  { id: 'power_switch', pattern: /power switch|power button|\bpower\b/ },
  { id: 'compressor', pattern: /compressor/ },
  { id: 'fan', pattern: /\bfan\b/ },
]

const DIAGNOSIS_MATCHERS: { id: DiagnosisId; pattern: RegExp }[] = [
  {
    id: 'restricted_filter',
    pattern: /restricted filter|clogged filter|dirty filter|blocked filter|loaded filter|restricted airflow|clogged airflow/,
  },
  { id: 'power_loss', pattern: /power loss|no power|lost power|power failure|not powered|isn't powered/ },
  {
    id: 'compressor_failure',
    pattern: /compressor (failure|failed|is dead|isn't working|not working)|failed compressor|dead compressor/,
  },
  { id: 'fan_failure', pattern: /fan (failure|failed|is dead|isn't working|not working|is broken)|broken fan/ },
  { id: 'emergency_stop_engaged', pattern: /emergency stop is (engaged|pressed|in)|e-stop is (engaged|pressed|in)/ },
  { id: 'low_charge', pattern: /low charge|refrigerant|lost charge|gas leak|undercharged/ },
]

const HYPOTHESIS = /could it be|could this be|might be|may be|i suspect|maybe it's|maybe it is|i think it might|possibly|what if it's|what if it is|hypothesis/
const CONFIRM = /my diagnosis|the fault is|the problem is|i'm diagnosing|i am diagnosing|i conclude|that confirms|i confirm|final diagnosis|it's a |it is a |this is a /
const HINT = /\bhint\b|i'm stuck|i am stuck|what should i|what do i check next|what next|help me|not sure where|give me a clue|i'm lost|i am lost|where do i (start|look)/
const FAILURE = /failed|failure|is broken|isn't working|not working|has died|is dead/
const ACK = /^(ok|okay|yeah|yep|yes|right|go on|continue|sure|alright|all right|got it|thanks|thank you)$/
const UNCLEAR = /^(um+|uh+|er+|hmm+|hello|hi|hey|wait|what|\?)$/

export function normalizeUtterance(input: string): string {
  return input
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function findComponents(text: string): ComponentId[] {
  const found: { id: ComponentId; index: number }[] = []
  for (const matcher of COMPONENT_MATCHERS) {
    const index = text.search(matcher.pattern)
    if (index >= 0) found.push({ id: matcher.id, index })
  }
  found.sort((left, right) => left.index - right.index)
  const unique: ComponentId[] = []
  for (const item of found) {
    if (!unique.includes(item.id)) unique.push(item.id)
  }
  return unique
}

function findComponent(text: string): ComponentId | null {
  const found = findComponents(text)
  return found.length === 1 ? found[0] : null
}

function matchingDiagnoses(text: string, loose: boolean): DiagnosisId[] {
  const strict = DIAGNOSIS_MATCHERS.filter((matcher) => matcher.pattern.test(text)).map((matcher) => matcher.id)
  if (strict.length > 0 || !loose) return strict
  const found: DiagnosisId[] = []
  if (/filter/.test(text)) found.push('restricted_filter')
  if (/compressor/.test(text)) found.push('compressor_failure')
  if (/\bfan\b/.test(text)) found.push('fan_failure')
  if (/emergency stop|e-stop|estop/.test(text)) found.push('emergency_stop_engaged')
  if (/charge|refrigerant/.test(text)) found.push('low_charge')
  if (/\bpower\b/.test(text) && !/power switch|power button/.test(text)) found.push('power_loss')
  return found
}

function findDiagnosis(text: string, loose: boolean): DiagnosisId | null {
  const found = matchingDiagnoses(text, loose)
  return found.length === 1 ? found[0] : null
}

function ambiguousFault(text: string): boolean {
  return matchingDiagnoses(text, true).length > 1
}

type ClaimShape =
  | 'high'
  | 'low'
  | 'weak_air'
  | 'filter_restricted'
  | 'filter_clear'
  | 'running'
  | 'stopped'
  | 'warm'
  | 'normal'
  | 'abnormal'
  | 'powered_on'
  | 'powered_off'
  | 'estop_on'
  | 'estop_off'

function detectShape(text: string): ClaimShape | null {
  if (/emergency stop|e-stop|estop/.test(text) && /engaged|pressed|pushed in|is in/.test(text)) return 'estop_on'
  if (/emergency stop|e-stop|estop/.test(text) && /released|not engaged|isn't engaged|is out|clear/.test(text)) return 'estop_off'
  if (/(filter|airflow|air flow)/.test(text) && /clogged|dirty|restricted|blocked|loaded/.test(text)) return 'filter_restricted'
  if (/filter/.test(text) && /clear|clean/.test(text)) return 'filter_clear'
  if (/(intake|outlet|airflow|air flow)/.test(text) && /(weak|low|poor|barely|reduced|restricted)/.test(text)) {
    return 'weak_air'
  }
  if (
    /higher than expected|too high|reading high|reads high|\bhigh\b|above the|above normal|above expected|elevated|warmer than expected|hotter than/.test(
      text,
    )
  ) {
    return 'high'
  }
  if (/too low|reading low|reads low|\blow\b|below the|below normal|lower than expected/.test(text)) return 'low'
  if (/warm|hot/.test(text)) return 'warm'
  if (/not spinning|isn't spinning|not running|isn't running|is stopped|has stopped|not moving|isn't moving/.test(text)) {
    return 'stopped'
  }
  if (/spinning|is running|still running|is moving|is on and/.test(text)) return 'running'
  if (/power is off|switched off|turned off/.test(text)) return 'powered_off'
  if (/power is on|switched on|turned on/.test(text)) return 'powered_on'
  if (/looks wrong|looks off|something'?s wrong|not right|abnormal|doesn'?t look right/.test(text)) return 'abnormal'
  if (/looks normal|looks fine|looks good|seems normal|reads normal|is normal/.test(text)) return 'normal'
  return null
}

function resolveClaim(shape: ClaimShape, component: ComponentId | null, text: string): ObservationId | null {
  switch (shape) {
    case 'high':
      if (component === 'temperature_display' || /\btemp/.test(text)) return 'temperature_high'
      if (component === 'pressure_gauge' || /pressure|gauge/.test(text)) return 'pressure_high'
      return null
    case 'low':
      if (component === 'temperature_display' || /\btemp/.test(text)) return 'temperature_low'
      if (component === 'pressure_gauge' || /pressure|gauge/.test(text)) return 'pressure_low'
      return null
    case 'weak_air':
      if (component === 'air_outlet' || /outlet|exhaust|discharge/.test(text)) return 'outlet_weak'
      if (component === 'air_intake' || /intake|inlet/.test(text)) return 'intake_weak'
      return null
    case 'filter_restricted':
      return component === 'filter_panel' || /filter/.test(text) ? 'filter_restricted' : null
    case 'filter_clear':
      return 'filter_clear'
    case 'warm':
      if (component === 'temperature_display') return 'temperature_high'
      if (component === 'air_outlet' || /outlet/.test(text)) return 'outlet_warm'
      return null
    case 'running':
      if (component === 'fan') return 'fan_spinning'
      if (component === 'compressor') return 'compressor_running'
      if (component === 'status_indicator') return 'status_running'
      return null
    case 'stopped':
      if (component === 'fan') return 'fan_stopped'
      if (component === 'compressor') return 'compressor_stopped'
      if (component === 'power_switch') return 'powered_off'
      return null
    case 'powered_on':
      return 'powered_on'
    case 'powered_off':
      return 'powered_off'
    case 'estop_on':
      return 'estop_engaged'
    case 'estop_off':
      return 'estop_clear'
    case 'normal':
      return 'normal_unspecified'
    case 'abnormal':
      return 'abnormal_unspecified'
    default:
      return null
  }
}

function componentForShape(shape: ClaimShape, text: string, ctx: InterpretContext): ComponentId | null {
  const named = findComponent(text)
  if (named) return named
  const last = ctx.lastComponentId
  if (!last) return null
  if (shape === 'high' || shape === 'low') {
    return last === 'pressure_gauge' || last === 'temperature_display' ? last : null
  }
  if (shape === 'warm') return last === 'temperature_display' || last === 'air_outlet' ? last : null
  if (shape === 'normal' || shape === 'abnormal' || shape === 'running' || shape === 'stopped') return last
  if (shape === 'weak_air') return last === 'air_intake' || last === 'air_outlet' ? last : null
  if (shape === 'filter_restricted' || shape === 'filter_clear') return 'filter_panel'
  if (shape === 'powered_on' || shape === 'powered_off') return 'power_switch'
  if (shape === 'estop_on' || shape === 'estop_off') return 'emergency_stop'
  return last
}

function hypothesis(diagnosisId: DiagnosisId): Interpretation {
  return {
    ...emptyInterpretation('hypothesize'),
    diagnosticHypothesis: diagnosisId,
  }
}

function confirmation(diagnosisId: DiagnosisId): Interpretation {
  return {
    ...emptyInterpretation('confirm'),
    diagnosticHypothesis: diagnosisId,
  }
}

export function interpretDemo(utterance: string, ctx: InterpretContext): Interpretation {
  const text = normalizeUtterance(utterance)
  if (!text || UNCLEAR.test(text)) return emptyInterpretation('clarify')
  if (ACK.test(text)) return emptyInterpretation('acknowledge')

  const mentioned = findComponents(text)
  const hypothesisCue = HYPOTHESIS.test(text)
  const confirmCue = CONFIRM.test(text)
  if ((hypothesisCue || confirmCue || FAILURE.test(text)) && ambiguousFault(text)) {
    return emptyInterpretation('clarify')
  }
  if (hypothesisCue || confirmCue) {
    const diagnosis = findDiagnosis(text, true)
    if (diagnosis && hypothesisCue) return hypothesis(diagnosis)
    if (diagnosis && confirmCue) return confirmation(diagnosis)
  }

  const shape = detectShape(text)
  if (mentioned.length > 1 && shape) return emptyInterpretation('clarify')
  if (shape) {
    const componentId = componentForShape(shape, text, ctx)
    const claim = resolveClaim(shape, componentId, text)
    if (componentId && claim && claimFits(componentId, claim)) {
      return {
        ...emptyInterpretation('observe'),
        mentionedComponents: [componentId],
        claimedObservations: [claim],
      }
    }
    return emptyInterpretation('clarify')
  }

  if (FAILURE.test(text)) {
    const diagnosis = findDiagnosis(text, true)
    if (diagnosis) return hypothesis(diagnosis)
  }

  if (HINT.test(text)) return emptyInterpretation('hint')

  if (mentioned.length > 1) return emptyInterpretation('clarify')
  const componentId = mentioned[0]
  if (componentId) {
    return { ...emptyInterpretation('inspect'), mentionedComponents: [componentId] }
  }

  if (text.length < 10) return emptyInterpretation('clarify')
  return emptyInterpretation('irrelevant')
}

export function canonicalInspect(componentId: ComponentId): string {
  const label = COMPONENT_BY_ID[componentId].label
  return `I'm checking the ${label.toLowerCase()}.`
}

export const TRAINABLE_COMPONENTS = COMPONENTS
