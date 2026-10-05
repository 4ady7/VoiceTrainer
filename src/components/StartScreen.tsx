import { SCENARIO } from '../features/scenario/content'

interface StartScreenProps {
  onStart: () => void
  onText: () => void
}

export function StartScreen({ onStart, onText }: StartScreenProps) {
  return (
    <main className="start">
      <p className="eyebrow">Experimental training study</p>
      <h1 className="hero-title">
        Voice
        <br />
        Trainer
      </h1>
      <p className="hero-sub">
        Talk through the fault.
        <br />
        The instructor is listening.
      </p>
      <div className="rule" />
      <p className="lede">An experimental voice-driven diagnostic training simulator.</p>
      <dl className="meta">
        <div>
          <dt>Scenario</dt>
          <dd>{SCENARIO.title}</dd>
        </div>
        <div>
          <dt>Difficulty</dt>
          <dd>{SCENARIO.difficulty}</dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{SCENARIO.duration}</dd>
        </div>
      </dl>
      <div className="actions">
        <button className="btn btn-primary" type="button" onClick={onStart}>
          Start training
        </button>
        <button className="btn btn-secondary" type="button" onClick={onText}>
          Try text mode
        </button>
      </div>
      <p className="disclaimer">
        Fictional equipment for an interaction study. Not HVAC instruction, not a safety certification, and not a field
        procedure.
      </p>
    </main>
  )
}
