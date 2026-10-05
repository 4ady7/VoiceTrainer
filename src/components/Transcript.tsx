import { useEffect, useRef } from 'react'
import type { TranscriptTurn } from '../app/useTrainingSession'
import { formatClock } from '../utils/clock'

interface TranscriptProps {
  turns: TranscriptTurn[]
}

export function Transcript({ turns }: TranscriptProps) {
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [turns.length])

  return (
    <section className="transcript" aria-label="Transcript">
      <p className="eyebrow">Transcript</p>
      <ol>
        {turns.map((turn) => (
          <li key={turn.id} className={turn.speaker === 'you' ? 'turn turn-you' : 'turn turn-instructor'}>
            <div className="turn-head">
              <span>{turn.speaker === 'you' ? 'You' : 'Instructor'}</span>
              <time>{formatClock(turn.atMs)}</time>
            </div>
            <p>{turn.text}</p>
            {turn.transition ? <p className="turn-meta">{turn.transition}</p> : null}
          </li>
        ))}
      </ol>
      <div ref={endRef} />
    </section>
  )
}
