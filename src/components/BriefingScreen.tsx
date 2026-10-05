import { SCENARIO } from '../features/scenario/content'

interface BriefingScreenProps {
  textMode: boolean
  onEnter: () => void
  onBack: () => void
}

export function BriefingScreen({ textMode, onEnter, onBack }: BriefingScreenProps) {
  return (
    <main className="briefing">
      <p className="eyebrow">{SCENARIO.title}</p>
      <h1>Briefing</h1>
      <div className="briefing-copy">
        {SCENARIO.briefing.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      <p className="briefing-note">
        {textMode
          ? 'Text mode uses the same scenario record as voice. You can enable the microphone later.'
          : 'You can speak or type. A missed word is not a training mistake.'}
      </p>
      <div className="actions">
        <button className="btn btn-primary" type="button" onClick={onEnter}>
          Enter simulation
        </button>
        <button className="btn btn-secondary" type="button" onClick={onBack}>
          Back
        </button>
      </div>
    </main>
  )
}
