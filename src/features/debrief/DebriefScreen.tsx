import { buildDebrief } from '../scenario/debrief'
import type { ScenarioState } from '../scenario/types'
import type { TranscriptTurn } from '../../app/useTrainingSession'
import { formatClock } from '../../utils/clock'

interface DebriefScreenProps {
  scenario: ScenarioState
  transcript: TranscriptTurn[]
  latencies: number[]
  coaching: string | null
  onAgain: () => void
}

const DIMENSIONS = [
  ['diagnosticAccuracy', 'Diagnostic accuracy'],
  ['observationAccuracy', 'Observation accuracy'],
  ['processQuality', 'Process quality'],
  ['efficiency', 'Efficiency'],
  ['hintDependence', 'Hint independence'],
  ['completion', 'Completion'],
] as const

export function DebriefScreen({ scenario, transcript, latencies, coaching, onAgain }: DebriefScreenProps) {
  const report = buildDebrief(scenario)
  const traineeTurns = transcript.filter((turn) => turn.speaker === 'you').length
  const meanLatency = latencies.length
    ? Math.round(latencies.reduce((total, value) => total + value, 0) / latencies.length)
    : null

  return (
    <main className="debrief">
      <p className="eyebrow">Final performance</p>
      <header className="debrief-hero">
        <p className="debrief-score">{report.overall}</p>
        <div>
          <h1>HydraCool Cooling Unit</h1>
          <p>{report.completed ? `Confirmed: ${report.confirmedLabel}` : 'Diagnosis not confirmed'}</p>
          <p className="disclaimer">Figures are calculated by the scenario engine from this session only.</p>
        </div>
      </header>
      <ul className="metrics">
        {DIMENSIONS.map(([key, label]) => (
          <li key={key}>
            <div className="metric-head">
              <span>{label}</span>
              <span>{report[key]}</span>
            </div>
            <div className="metric-track" aria-hidden="true">
              <span style={{ width: `${report[key]}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <section>
        <h2>What you did well</h2>
        <ul>
          {report.didWell.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <section>
        <h2>What you missed</h2>
        {report.missed.length === 0 ? (
          <p>No mistakes were recorded.</p>
        ) : (
          <ul>
            {report.missed.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2>Key observations</h2>
        {report.keyObservations.length === 0 ? (
          <p>No instrument readings were recorded.</p>
        ) : (
          <ul>
            {report.keyObservations.map((item) => (
              <li key={item.componentId}>
                {item.text} <span className="meta-inline">{item.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2>Diagnostic path</h2>
        <ol className="path">
          {report.path.map((step, index) => (
            <li key={`${step.atMs}-${index}`}>
              <time>{formatClock(step.atMs)}</time>
              <span>{step.summary}</span>
            </li>
          ))}
        </ol>
      </section>
      <section>
        <h2>Missed opportunities</h2>
        {report.missedOpportunities.length === 0 ? (
          <p>The main checks were all in the record.</p>
        ) : (
          <ul>
            {report.missedOpportunities.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2>Instructor feedback</h2>
        <p>{report.instructorFeedback}</p>
        {coaching ? (
          <>
            <h3>Coaching note</h3>
            <p>{coaching}</p>
          </>
        ) : null}
      </section>
      <section>
        <h2>Next time</h2>
        <ul>
          {report.nextTime.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <dl className="session-facts">
        <div>
          <dt>Session duration</dt>
          <dd>{formatClock(report.durationMs)}</dd>
        </div>
        <div>
          <dt>Trainee turns</dt>
          <dd>{traineeTurns}</dd>
        </div>
        <div>
          <dt>Mistakes</dt>
          <dd>{report.mistakes}</dd>
        </div>
        <div>
          <dt>Hints</dt>
          <dd>{report.hints}</dd>
        </div>
        <div>
          <dt>Checkpoints</dt>
          <dd>{report.checkpoints}</dd>
        </div>
        <div>
          <dt>Completion</dt>
          <dd>{report.completed ? 'Complete' : 'Incomplete'}</dd>
        </div>
        <div>
          <dt>Mean response</dt>
          <dd>{meanLatency == null ? '—' : `${meanLatency} ms`}</dd>
        </div>
      </dl>
      <button className="btn btn-primary" type="button" onClick={onAgain}>
        Train again
      </button>
    </main>
  )
}
