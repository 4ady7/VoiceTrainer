import { lazy, Suspense } from 'react'
import { BriefingScreen } from '../components/BriefingScreen'
import { StartScreen } from '../components/StartScreen'
import { DebriefScreen } from '../features/debrief/DebriefScreen'
import { useTrainingSession, type InterpreterMode } from './useTrainingSession'

const SimulationScreen = lazy(() =>
  import('../features/simulation/SimulationScreen').then((module) => ({ default: module.SimulationScreen })),
)

function interpreterLabel(mode: InterpreterMode): string {
  if (mode === 'live') return 'Model linked'
  if (mode === 'local') return 'Local interpreter'
  return 'Checking link'
}

export function App() {
  const training = useTrainingSession()
  const { session } = training

  return (
    <div className="app">
      <a className="skip" href="#main">
        Skip to content
      </a>
      {session.screen === 'start' ? (
        <div id="main">
          <StartScreen onStart={() => training.start(true)} onText={() => training.start(false)} />
        </div>
      ) : null}
      {session.screen === 'briefing' ? (
        <div id="main">
          <BriefingScreen
            textMode={!session.preferVoice}
            onEnter={training.enter}
            onBack={training.restart}
          />
        </div>
      ) : null}
      {session.screen === 'simulation' ? (
        <div id="main">
          <Suspense fallback={<main className="briefing"><p className="eyebrow">Voice Trainer</p><h1>Opening the unit.</h1></main>}>
          <SimulationScreen
            scenario={session.scenario}
            transcript={session.transcript}
            instructorLine={session.instructorLine}
            speechNonce={session.speechNonce}
            preferVoice={session.preferVoice}
            voice={session.voice}
            voiceDetail={session.voiceDetail}
            interpreterLabel={interpreterLabel(session.interpreter)}
            error={session.error}
            onSubmit={training.submit}
            onInspect={training.inspect}
            onDebrief={training.openDebrief}
            onVoice={training.setVoice}
            onError={training.setError}
          />
          </Suspense>
        </div>
      ) : null}
      {session.screen === 'debrief' ? (
        <div id="main">
          <DebriefScreen
            scenario={session.scenario}
            transcript={session.transcript}
            latencies={session.latencies}
            coaching={session.coaching}
            onAgain={training.restart}
          />
        </div>
      ) : null}
    </div>
  )
}
