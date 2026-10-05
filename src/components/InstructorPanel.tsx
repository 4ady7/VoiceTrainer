import { guidanceLabel, objectiveFor, phaseLabel } from '../features/scenario/selectors'
import type { ScenarioState } from '../features/scenario/types'

interface InstructorPanelProps {
  scenario: ScenarioState
  line: string
  voiceDetail: string
  interpreterLabel: string
  onDebrief: () => void
}

export function InstructorPanel({ scenario, line, voiceDetail, interpreterLabel, onDebrief }: InstructorPanelProps) {
  return (
    <aside className="instructor" aria-label="Instructor">
      <p className="eyebrow">Instructor</p>
      <p className="instructor-line" aria-live="polite">
        {line}
      </p>
      <div className="panel-block">
        <p className="kicker">Current objective</p>
        <p>{objectiveFor(scenario)}</p>
      </div>
      <dl className="status-list">
        <div>
          <dt>Training status</dt>
          <dd>{phaseLabel(scenario)}</dd>
        </div>
        <div>
          <dt>Guidance</dt>
          <dd>{guidanceLabel(scenario.guidanceLevel)}</dd>
        </div>
        <div>
          <dt>Voice</dt>
          <dd>{voiceDetail}</dd>
        </div>
        <div>
          <dt>Interpreter</dt>
          <dd>{interpreterLabel}</dd>
        </div>
      </dl>
      {scenario.completed ? (
        <button className="btn btn-primary" type="button" onClick={onDebrief}>
          Open debrief
        </button>
      ) : null}
    </aside>
  )
}
