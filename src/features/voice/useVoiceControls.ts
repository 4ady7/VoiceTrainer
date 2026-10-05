import { useEffect, useRef, useState } from 'react'
import type { VoiceUiState } from '../../app/useTrainingSession'
import {
  queryMicrophone,
  SpeechRecognitionService,
  speechRecognitionSupported,
} from '../../services/speech/SpeechRecognitionService'
import { TextToSpeechService, ttsSupported } from '../../services/tts/TextToSpeechService'

interface VoiceControlOptions {
  preferVoice: boolean
  blocked: boolean
  instructorLine: string
  speechNonce: number
  onUtterance: (text: string) => Promise<boolean>
  onVoice: (voice: VoiceUiState, detail?: string) => void
  onError: (message: string | null) => void
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
}

function isEcho(heard: string, spoken: string): boolean {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()
  const incoming = normalize(heard)
  const previous = normalize(spoken)
  if (incoming.length < 12 || previous.length < 12) return false
  return previous.includes(incoming) || incoming.includes(previous.slice(0, 48))
}

export function useVoiceControls({
  preferVoice,
  blocked,
  instructorLine,
  speechNonce,
  onUtterance,
  onVoice,
  onError,
}: VoiceControlOptions) {
  const recognition = useRef<SpeechRecognitionService | null>(null)
  const tts = useRef<TextToSpeechService | null>(null)
  const [interim, setInterim] = useState('')
  const [alwaysOn, setAlwaysOn] = useState(false)
  const [muted, setMuted] = useState(false)
  const [supported, setSupported] = useState(true)
  const alwaysRef = useRef(false)
  const mutedRef = useRef(false)
  const blockedRef = useRef(blocked)
  const holdRef = useRef(false)
  const submitted = useRef(false)
  const instructorRef = useRef(instructorLine)
  const onUtteranceRef = useRef(onUtterance)
  const onVoiceRef = useRef(onVoice)
  instructorRef.current = instructorLine
  onUtteranceRef.current = onUtterance
  onVoiceRef.current = onVoice
  blockedRef.current = blocked
  alwaysRef.current = alwaysOn
  mutedRef.current = muted

  const emit = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || submitted.current) return
    if (isEcho(trimmed, instructorRef.current)) return
    submitted.current = true
    setInterim('')
    void onUtteranceRef.current(trimmed)
  }

  const startSession = (continuous: boolean) => {
    submitted.current = false
    recognition.current?.start(
      {
        onStart: () => onVoiceRef.current('listening', continuous ? 'Listening' : 'Hold to talk'),
        onInterim: (text) => setInterim(text),
        onFinal: (text) => emit(text),
        onError: (message) => {
          if (message === 'denied' || message === 'unsupported' || message === 'start-failed') {
            onError('Voice unavailable — continue with text.')
            onVoiceRef.current('error', 'Voice unavailable')
            setSupported(false)
            alwaysRef.current = false
            setAlwaysOn(false)
          }
        },
        onEnd: () => {
          if (holdRef.current) return
          if (alwaysRef.current && !blockedRef.current) {
            window.setTimeout(() => {
              if (alwaysRef.current && !blockedRef.current && !holdRef.current) startSession(true)
            }, 280)
          }
        },
      },
      continuous,
    )
  }

  useEffect(() => {
    recognition.current = new SpeechRecognitionService()
    tts.current = new TextToSpeechService((speaking) => {
      if (speaking) onVoiceRef.current('instructor_speaking', 'Instructor speaking')
      else if (!holdRef.current && !blockedRef.current) {
        onVoiceRef.current('ready', alwaysRef.current ? 'Listening' : 'Ready')
        if (alwaysRef.current) startSession(true)
      }
    })
    setSupported(speechRecognitionSupported())
    return () => {
      recognition.current?.abort()
      tts.current?.stop()
    }
    // The service instances live for the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!preferVoice) {
      onVoiceRef.current('ready', 'Text only')
      return
    }
    if (!speechRecognitionSupported()) {
      setSupported(false)
      onError('Voice unavailable — continue with text.')
      onVoiceRef.current('error', 'Voice unavailable')
      return
    }
    let cancelled = false
    void queryMicrophone().then((result) => {
      if (cancelled) return
      if (result !== 'granted') {
        setSupported(false)
        onError('Voice unavailable — continue with text.')
        onVoiceRef.current('error', 'Voice unavailable')
      }
    })
    return () => {
      cancelled = true
    }
  }, [preferVoice, onError])

  useEffect(() => {
    if (!speechNonce || !instructorLine) return
    recognition.current?.abort()
    if (mutedRef.current || !ttsSupported()) {
      onVoiceRef.current('ready', mutedRef.current ? 'Muted' : 'Ready')
      return
    }
    tts.current?.speak(instructorLine)
  }, [speechNonce, instructorLine])

  useEffect(() => {
    if (blocked) recognition.current?.abort()
  }, [blocked])

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat || isTypingTarget(event.target) || blockedRef.current) return
      if (!supported || alwaysRef.current) return
      event.preventDefault()
      holdRef.current = true
      startSession(false)
    }
    const up = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || isTypingTarget(event.target)) return
      if (!holdRef.current) return
      event.preventDefault()
      release()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [supported])

  function release() {
    holdRef.current = false
    const pending = recognition.current?.stop() ?? ''
    window.setTimeout(() => {
      if (!submitted.current && pending) emit(pending)
      if (!submitted.current) onVoiceRef.current('ready', 'Ready')
    }, 420)
  }

  return {
    interim,
    alwaysOn,
    muted,
    supported,
    holdStart: () => {
      if (!supported || blockedRef.current || alwaysRef.current) return
      holdRef.current = true
      startSession(false)
    },
    holdEnd: () => {
      if (!holdRef.current) return
      release()
    },
    toggleAlways: () => {
      const next = !alwaysRef.current
      alwaysRef.current = next
      setAlwaysOn(next)
      if (next) startSession(true)
      else recognition.current?.abort()
    },
    toggleMute: () => {
      const next = !mutedRef.current
      mutedRef.current = next
      setMuted(next)
      if (next) tts.current?.stop()
    },
    replay: () => tts.current?.replay(),
    enableMicrophone: async () => {
      const result = await queryMicrophone()
      if (result !== 'granted') {
        onError('Voice unavailable — continue with text.')
        onVoiceRef.current('error', 'Voice unavailable')
        return
      }
      setSupported(true)
      onError(null)
      onVoiceRef.current('ready', 'Ready')
    },
  }
}
