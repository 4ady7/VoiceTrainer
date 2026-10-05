import { formatClock } from '../utils/clock'
import { useEffect, useState } from 'react'

interface TopBarProps {
  startedAtMs: number | null
  elapsedMs: number
  completed: boolean
  voiceDetail: string
  interpreterLabel: string
  onEnd: () => void
  showEnd: boolean
}

export function TopBar({ startedAtMs, elapsedMs, completed, voiceDetail, interpreterLabel, onEnd, showEnd }: TopBarProps) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (startedAtMs == null || completed) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [startedAtMs, completed])

  const shown = completed || startedAtMs == null ? elapsedMs : Math.max(0, now - startedAtMs)

  return (
    <header className="topbar">
      <p className="brand">Voice Trainer</p>
      <p className="scenario-name">HydraCool Cooling Unit</p>
      <div className="top-status">
        <time className="clock">{formatClock(shown)}</time>
        <span>{interpreterLabel}</span>
        <span className="voice-pill" data-voice={voiceDetail}>
          {voiceDetail}
        </span>
        {showEnd ? (
          <button className="btn btn-ghost" type="button" onClick={onEnd}>
            End session
          </button>
        ) : null}
      </div>
    </header>
  )
}
