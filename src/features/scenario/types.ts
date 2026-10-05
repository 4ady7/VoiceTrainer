export const COMPONENT_IDS = [
  'power_switch',
  'status_indicator',
  'control_panel',
  'temperature_display',
  'pressure_gauge',
  'fan',
  'air_intake',
  'air_outlet',
  'filter_panel',
  'compressor',
  'emergency_stop',
] as const

export type ComponentId = (typeof COMPONENT_IDS)[number]

export const DIAGNOSIS_IDS = [
  'restricted_filter',
  'power_loss',
  'compressor_failure',
  'fan_failure',
  'emergency_stop_engaged',
  'low_charge',
] as const

export type DiagnosisId = (typeof DIAGNOSIS_IDS)[number]

export const OBSERVATION_IDS = [
  'powered_on',
  'powered_off',
  'status_running',
  'status_fault',
  'setpoint_normal',
  'setpoint_wrong',
  'temperature_high',
  'temperature_normal',
  'temperature_low',
  'pressure_high',
  'pressure_normal',
  'pressure_low',
  'fan_spinning',
  'fan_stopped',
  'intake_weak',
  'intake_normal',
  'outlet_weak',
  'outlet_normal',
  'outlet_warm',
  'filter_restricted',
  'filter_clear',
  'compressor_running',
  'compressor_stopped',
  'estop_clear',
  'estop_engaged',
  'abnormal_unspecified',
  'normal_unspecified',
] as const

export type ObservationId = (typeof OBSERVATION_IDS)[number]

export const HINT_IDS = ['symptom', 'airflow', 'filter_area', 'connect', 'name_fault'] as const

export type HintId = (typeof HINT_IDS)[number]

export type Phase = 'investigation' | 'hypothesis' | 'complete'

export type GuidanceLevel = 'normal' | 'supportive' | 'high_support'

export type Judgment = 'correct' | 'partial' | 'incorrect' | 'irrelevant' | 'already_checked'

export interface ScoreBreakdown {
  diagnosticAccuracy: number
  observationAccuracy: number
  processQuality: number
  efficiency: number
  hintDependence: number
  completion: number
  overall: number
}

export interface ObservationRecord {
  componentId: ComponentId
  claim: ObservationId | null
  truth: ObservationId
  judgment: 'correct' | 'partial' | 'incorrect' | 'revealed'
  atMs: number
}

export interface MistakeRecord {
  kind: 'incorrect_observation' | 'incorrect_diagnosis' | 'premature_diagnosis'
  componentId: ComponentId | null
  detail: string
  atMs: number
}

export interface PathStep {
  atMs: number
  componentId: ComponentId | null
  summary: string
}

export interface ScenarioState {
  phase: Phase
  startedAtMs: number | null
  elapsedMs: number
  checked: Partial<Record<ComponentId, { times: number; atMs: number }>>
  observations: ObservationRecord[]
  suspectedDiagnosis: DiagnosisId | null
  confirmedDiagnosis: DiagnosisId | null
  namedCorrectFault: boolean
  hintsUsed: number
  hintIds: HintId[]
  mistakes: MistakeRecord[]
  correctActions: number
  repeatedActions: number
  irrelevantActions: number
  uncertaintyTurns: number
  stallTurns: number
  prematureConfirms: number
  wrongConfirms: number
  wrongHypotheses: number
  checkpoints: string[]
  guidanceLevel: GuidanceLevel
  score: ScoreBreakdown
  completed: boolean
  completedAtMs: number | null
  diagnosticPath: PathStep[]
  lastComponentId: ComponentId | null
  actionCount: number
}

export type EngineAction =
  | { type: 'begin' }
  | { type: 'tick' }
  | { type: 'inspect'; componentId: ComponentId }
  | { type: 'observe'; componentId: ComponentId; claim: ObservationId }
  | { type: 'hypothesize'; diagnosisId: DiagnosisId }
  | { type: 'confirm'; diagnosisId: DiagnosisId }
  | { type: 'request_hint' }
  | { type: 'clarify' }
  | { type: 'acknowledge' }
  | { type: 'irrelevant' }

export interface ReduceResult {
  state: ScenarioState
  judgment: Judgment | null
  componentId: ComponentId | null
  claim: ObservationId | null
  truth: ObservationId | null
  hintId: HintId | null
  premature: boolean
  completedNow: boolean
  wrongDiagnosis: DiagnosisId | null
}
