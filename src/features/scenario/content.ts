import type { ComponentId, DiagnosisId, HintId, ObservationId } from './types'

export interface ComponentSpec {
  id: ComponentId
  label: string
  truth: ObservationId
  partial: ObservationId[]
  contradictions: ObservationId[]
  abnormal: boolean
  followup: string
}

export const CORRECT_DIAGNOSIS: DiagnosisId = 'restricted_filter'

export const SCENARIO = {
  id: 'hydracool',
  title: 'HydraCool Cooling Unit',
  difficulty: 'Introductory',
  duration: '5–8 minutes',
  briefing: [
    'Your cooling unit is running, but the output temperature is higher than expected.',
    'Your task is to diagnose the fault.',
    "Explain what you're checking as you work.",
    'The instructor will respond to your reasoning.',
  ],
} as const

export const COMPONENTS: readonly ComponentSpec[] = [
  {
    id: 'power_switch',
    label: 'Power switch',
    truth: 'powered_on',
    partial: [],
    contradictions: ['powered_off'],
    abnormal: false,
    followup: 'If it is powered, the warm outlet is not a dead unit. What else is worth ruling out?',
  },
  {
    id: 'status_indicator',
    label: 'Status indicator',
    truth: 'status_running',
    partial: [],
    contradictions: ['status_fault'],
    abnormal: false,
    followup: 'It is reporting a running unit, not a fault lamp. Where would you look next?',
  },
  {
    id: 'control_panel',
    label: 'Control panel',
    truth: 'setpoint_normal',
    partial: [],
    contradictions: ['setpoint_wrong'],
    abnormal: false,
    followup: 'The panel is calling for ordinary cooling. The command is not the odd part.',
  },
  {
    id: 'temperature_display',
    label: 'Temperature display',
    truth: 'temperature_high',
    partial: ['outlet_warm'],
    contradictions: ['temperature_normal', 'temperature_low'],
    abnormal: true,
    followup: 'The warm outlet is the symptom. What could cause it while the unit is still running?',
  },
  {
    id: 'pressure_gauge',
    label: 'Pressure gauge',
    truth: 'pressure_high',
    partial: [],
    contradictions: ['pressure_normal', 'pressure_low'],
    abnormal: true,
    followup: 'What might a high reading tell you about the cooling problem?',
  },
  {
    id: 'fan',
    label: 'Fan',
    truth: 'fan_spinning',
    partial: [],
    contradictions: ['fan_stopped'],
    abnormal: false,
    followup: 'The fan is moving. If the airflow is still poor, where else could the air be blocked?',
  },
  {
    id: 'air_intake',
    label: 'Air intake',
    truth: 'intake_weak',
    partial: [],
    contradictions: ['intake_normal'],
    abnormal: true,
    followup: 'Weak intake with a spinning fan points upstream of the fan. What sits in that path?',
  },
  {
    id: 'air_outlet',
    label: 'Air outlet',
    truth: 'outlet_weak',
    partial: ['outlet_warm'],
    contradictions: ['outlet_normal'],
    abnormal: true,
    followup: 'Less air is leaving than a healthy unit would move. Where could that air be restricted?',
  },
  {
    id: 'filter_panel',
    label: 'Filter panel',
    truth: 'filter_restricted',
    partial: [],
    contradictions: ['filter_clear'],
    abnormal: true,
    followup: 'If the filter is restricting air, which other readings should agree with that?',
  },
  {
    id: 'compressor',
    label: 'Compressor module',
    truth: 'compressor_running',
    partial: [],
    contradictions: ['compressor_stopped'],
    abnormal: false,
    followup: 'The compressor is running, so a stopped compressor does not explain the heat.',
  },
  {
    id: 'emergency_stop',
    label: 'Emergency stop',
    truth: 'estop_clear',
    partial: [],
    contradictions: ['estop_engaged'],
    abnormal: false,
    followup: 'The emergency stop is released. The unit was not halted there.',
  },
]

export const COMPONENT_BY_ID: Record<ComponentId, ComponentSpec> = Object.fromEntries(
  COMPONENTS.map((component) => [component.id, component]),
) as Record<ComponentId, ComponentSpec>

export const OBSERVATION_TEXT: Record<ObservationId, string> = {
  powered_on: 'The power switch is on.',
  powered_off: 'The power switch is off.',
  status_running: 'The status indicator shows the unit is running.',
  status_fault: 'The status indicator is showing a fault.',
  setpoint_normal: 'The control panel is calling for cooling at a normal setpoint.',
  setpoint_wrong: 'The setpoint looks wrong.',
  temperature_high: 'The outlet temperature is above the expected band.',
  temperature_normal: 'The temperature is inside the expected band.',
  temperature_low: 'The temperature is below the expected band.',
  pressure_high: 'The pressure gauge is reading above the marked band.',
  pressure_normal: 'The pressure gauge is in the marked band.',
  pressure_low: 'The pressure gauge is reading below the marked band.',
  fan_spinning: 'The fan is spinning.',
  fan_stopped: 'The fan is stopped.',
  intake_weak: 'Airflow at the intake is weak.',
  intake_normal: 'Airflow at the intake looks normal.',
  outlet_weak: 'Air leaving the outlet is reduced.',
  outlet_normal: 'Air leaving the outlet looks normal.',
  outlet_warm: 'The air at the outlet feels warm.',
  filter_restricted: 'The filter is loaded and restricting airflow.',
  filter_clear: 'The filter looks clear.',
  compressor_running: 'The compressor module is running.',
  compressor_stopped: 'The compressor module is stopped.',
  estop_clear: 'The emergency stop is not engaged.',
  estop_engaged: 'The emergency stop is engaged.',
  abnormal_unspecified: 'Something about it looks abnormal.',
  normal_unspecified: 'It looks normal.',
}

export const DIAGNOSIS_LABEL: Record<DiagnosisId, string> = {
  restricted_filter: 'Restricted filter',
  power_loss: 'Loss of power',
  compressor_failure: 'Compressor failure',
  fan_failure: 'Fan failure',
  emergency_stop_engaged: 'Emergency stop engaged',
  low_charge: 'Low charge',
}

export const HINT_TEXT: Record<HintId, string> = {
  symptom: 'Start with the complaint. The outlet is warm. Which instrument shows that?',
  airflow: 'Think about the airflow through the unit. Where does air enter, and where does it leave?',
  filter_area: 'Take a look at the filter area. Could restricted airflow explain the symptoms?',
  connect: 'You have the filter and the temperature. What single fault ties them together?',
  name_fault: 'When you are ready, state the fault as a diagnosis.',
}

export const DIAGNOSIS_REBUTTAL: Record<DiagnosisId, string> = {
  restricted_filter: 'The filter is a fair suspect, but only after you have looked at it.',
  power_loss: 'A power loss does not fit a unit that is still running.',
  compressor_failure: 'A stopped compressor is a suspect only if the compressor is actually stopped.',
  fan_failure: 'A fan failure needs a fan that is not moving.',
  emergency_stop_engaged: 'An engaged emergency stop would have halted the unit.',
  low_charge: 'Low charge would not be the first story if the gauge is sitting high.',
}

/** Shown on the prop only after the engine marks that component checked. */
export const INSTRUMENT_FACE: Partial<Record<ComponentId, { before: string; after: string }>> = {
  temperature_display: { before: 'TEMP', after: '31°  EXP 18–22' },
  pressure_gauge: { before: 'PRESS', after: 'ABOVE BAND' },
  air_intake: { before: 'INTAKE', after: 'FLOW WEAK' },
  air_outlet: { before: 'OUTLET', after: 'FLOW LOW' },
  control_panel: { before: 'COOL', after: 'SET 20' },
  filter_panel: { before: 'FILTER', after: 'LOADED' },
}

export function judgeClaim(
  componentId: ComponentId,
  claim: ObservationId,
): 'correct' | 'partial' | 'incorrect' {
  const spec = COMPONENT_BY_ID[componentId]
  if (claim === spec.truth) return 'correct'
  if (spec.partial.includes(claim)) return 'partial'
  if (claim === 'abnormal_unspecified' && spec.abnormal) return 'partial'
  if (claim === 'normal_unspecified' && !spec.abnormal) return 'partial'
  return 'incorrect'
}

export function claimFits(componentId: ComponentId, claim: ObservationId): boolean {
  const spec = COMPONENT_BY_ID[componentId]
  if (claim === spec.truth || spec.partial.includes(claim) || spec.contradictions.includes(claim)) {
    return true
  }
  return claim === 'abnormal_unspecified' || claim === 'normal_unspecified'
}
