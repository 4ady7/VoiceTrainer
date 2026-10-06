import { useState } from 'react'

interface VoiceDockProps {
  interim: string
  alwaysOn: boolean
  muted: boolean
  supported: boolean
  blocked: boolean
  onHoldStart: () => void
  onHoldEnd: () => void
  onToggleAlways: () => void
  onToggleMute: () => void
  onReplay: () => void
  onEnable: () => void
  onSubmit: (text: string) => Promise<boolean>
}

export function VoiceDock({
  interim,
  alwaysOn,
  muted,
  supported,
  blocked,
  onHoldStart,
  onHoldEnd,
  onToggleAlways,
  onToggleMute,
  onReplay,
  onEnable,
  onSubmit,
}: VoiceDockProps) {
  const [draft, setDraft] = useState('')

  return (
    <div className="voice-dock">
      <div className="voice-controls">
        <button
          className="ptt"
          type="button"
          disabled={!supported || blocked || alwaysOn}
          aria-pressed={alwaysOn}
          onPointerDown={(event) => {
            event.preventDefault()
            try {
              event.currentTarget.setPointerCapture(event.pointerId)
            } catch {
              // Releasing outside the button still ends the hold.
            }
            onHoldStart()
          }}
          onPointerUp={onHoldEnd}
          onPointerCancel={onHoldEnd}
          onKeyDown={(event) => {
            if (event.repeat) return
            if (event.code === 'Space' || event.key === 'Enter') {
              event.preventDefault()
              event.stopPropagation()
              onHoldStart()
            }
          }}
          onKeyUp={(event) => {
            if (event.code === 'Space' || event.key === 'Enter') {
              event.preventDefault()
              event.stopPropagation()
              onHoldEnd()
            }
          }}
        >
          {alwaysOn ? 'Listening' : 'Hold to talk'}
        </button>
        <button className="btn btn-ghost" type="button" disabled={!supported || blocked} onClick={onToggleAlways} aria-pressed={alwaysOn}>
          {alwaysOn ? 'Stop listening' : 'Always listening'}
        </button>
        <button className="btn btn-ghost" type="button" onClick={onReplay}>
          Replay
        </button>
        <button className="btn btn-ghost" type="button" onClick={onToggleMute} aria-pressed={muted}>
          {muted ? 'Unmute' : 'Mute'}
        </button>
        {!supported ? (
          <button className="btn btn-ghost" type="button" onClick={onEnable}>
            Enable microphone
          </button>
        ) : null}
      </div>
      <p className="interim" aria-live="polite">
        {interim ? `Hearing: ${interim}` : 'Hold Space to talk, unless you are typing.'}
      </p>
      <form
        className="composer"
        onSubmit={async (event) => {
          event.preventDefault()
          const accepted = await onSubmit(draft)
          if (accepted) setDraft('')
        }}
      >
        <label htmlFor="utterance">Type what you would say</label>
        <div className="composer-row">
          <input
            id="utterance"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="I’m checking the pressure gauge."
            autoComplete="off"
            disabled={blocked}
          />
          <button className="btn btn-primary" type="submit" disabled={blocked || !draft.trim()}>
            Send
          </button>
        </div>
      </form>
    </div>
  )
}
