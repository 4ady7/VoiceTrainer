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
  const speakingRef = useRef(false)
  const aliveRef = useRef(true)
  const listenGen = useRef(0)
  const pointerRelease = useRef<(() => void) | null>(null)
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
    if (!aliveRef.current) return
    const generation = ++listenGen.current
    submitted.current = false
    recognition.current?.start(
      {
        onStart: () => {
          if (!aliveRef.current || generation !== listenGen.current) return
          onVoiceRef.current('listening', continuous ? 'Listening' : 'Hold to talk')
        },
        onInterim: (text) => {
          if (!aliveRef.current || generation !== listenGen.current) return
          setInterim(text)
        },
        onFinal: (text) => {
          if (!aliveRef.current || generation !== listenGen.current) return
          emit(text)
        },
        onError: (message) => {
          if (!aliveRef.current || generation !== listenGen.current) return
          if (message === 'denied' || message === 'unsupported' || message === 'start-failed') {
            onError('Voice unavailable — continue with text.')
            onVoiceRef.current('error', 'Voice unavailable')
            setSupported(false)
            alwaysRef.current = false
            setAlwaysOn(false)
          }
        },
        onEnd: () => {
          if (!aliveRef.current || generation !== listenGen.current) return
          if (holdRef.current || speakingRef.current) return
          if (alwaysRef.current && !blockedRef.current) {
            window.setTimeout(() => {
              if (!aliveRef.current || generation !== listenGen.current) return
              if (alwaysRef.current && !blockedRef.current && !holdRef.current && !speakingRef.current) startSession(true)
            }, 280)
          }
        },
      },
      continuous,
    )
  }

  useEffect(() => {
    aliveRef.current = true
    recognition.current = new SpeechRecognitionService()
    tts.current = new TextToSpeechService((speaking) => {
      if (!aliveRef.current) return
      speakingRef.current = speaking
      if (speaking) onVoiceRef.current('instructor_speaking', 'Instructor speaking')
      else if (!holdRef.current && !blockedRef.current) {
        onVoiceRef.current('ready', alwaysRef.current ? 'Listening' : 'Ready')
        if (alwaysRef.current) startSession(true)
      }
    })
    setSupported(speechRecognitionSupported())
    return () => {
      aliveRef.current = false
      listenGen.current += 1
      speakingRef.current = false
      holdRef.current = false
      if (pointerRelease.current) {
        window.removeEventListener('pointerup', pointerRelease.current)
        window.removeEventListener('pointercancel', pointerRelease.current)
        pointerRelease.current = null
      }
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
    if (!speechNonce || !instructorLine || !aliveRef.current) return
    const willSpeak = !mutedRef.current && ttsSupported()
    if (willSpeak) speakingRef.current = true
    recognition.current?.abort()
    if (!willSpeak) {
      speakingRef.current = false
      onVoiceRef.current('ready', mutedRef.current ? 'Muted' : 'Ready')
      if (alwaysRef.current && !blockedRef.current) startSession(true)
      return
    }
    tts.current?.speak(instructorLine)
  }, [speechNonce, instructorLine])

  useEffect(() => {
    if (!aliveRef.current) return
    if (blocked) {
      recognition.current?.abort()
      return
    }
    if (alwaysRef.current && !holdRef.current && !speakingRef.current) startSession(true)
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
    const generation = listenGen.current
    const pending = recognition.current?.stop() ?? ''
    window.setTimeout(() => {
      if (!aliveRef.current || generation !== listenGen.current) return
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
      if (!supported || blockedRef.current || alwaysRef.current || holdRef.current) return
      holdRef.current = true
      const end = () => {
        window.removeEventListener('pointerup', end)
        window.removeEventListener('pointercancel', end)
        pointerRelease.current = null
        if (!holdRef.current) return
        release()
      }
      pointerRelease.current = end
      window.addEventListener('pointerup', end)
      window.addEventListener('pointercancel', end)
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
