interface RecognitionAlternative {
  transcript: string
}

interface RecognitionResult {
  isFinal: boolean
  0: RecognitionAlternative
}

interface RecognitionEvent extends Event {
  resultIndex: number
  results: ArrayLike<RecognitionResult>
}

interface RecognitionErrorEvent extends Event {
  error: string
}

interface BrowserRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: RecognitionEvent) => void) | null
  onerror: ((event: RecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

type RecognitionCtor = new () => BrowserRecognition

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const host = window as Window & {
    SpeechRecognition?: RecognitionCtor
    webkitSpeechRecognition?: RecognitionCtor
  }
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null
}

export function speechRecognitionSupported(): boolean {
  return recognitionCtor() != null
}

export async function queryMicrophone(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (!navigator.mediaDevices?.getUserMedia || !speechRecognitionSupported()) return 'unsupported'
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    for (const track of stream.getTracks()) track.stop()
    return 'granted'
  } catch {
    return 'denied'
  }
}

export interface SpeechCallbacks {
  onStart: () => void
  onInterim: (text: string) => void
  onFinal: (text: string) => void
  onError: (message: string) => void
  onEnd: () => void
}

export class SpeechRecognitionService {
  private recognition: BrowserRecognition | null = null
  private latestInterim = ''
  private gotFinal = false

  start(callbacks: SpeechCallbacks, continuous: boolean): void {
    const Ctor = recognitionCtor()
    if (!Ctor) {
      callbacks.onError('unsupported')
      return
    }
    this.abort()
    const recognition = new Ctor()
    this.recognition = recognition
    this.latestInterim = ''
    this.gotFinal = false
    recognition.lang = 'en-US'
    recognition.continuous = continuous
    recognition.interimResults = true
    recognition.onstart = () => callbacks.onStart()
    recognition.onresult = (event) => {
      let interim = ''
      let finalText = ''
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const piece = event.results[index]?.[0]?.transcript ?? ''
        if (event.results[index]?.isFinal) finalText += piece
        else interim += piece
      }
      if (interim) {
        this.latestInterim = interim
        callbacks.onInterim(interim)
      }
      if (finalText.trim()) {
        this.gotFinal = true
        this.latestInterim = ''
        callbacks.onFinal(finalText.trim())
      }
    }
    recognition.onerror = (event) => {
      if (event.error === 'aborted' || event.error === 'no-speech') return
      callbacks.onError(event.error === 'not-allowed' ? 'denied' : event.error)
    }
    recognition.onend = () => {
      callbacks.onEnd()
      this.recognition = null
    }
    try {
      recognition.start()
    } catch {
      callbacks.onError('start-failed')
    }
  }

  stop(): string {
    const pending = this.gotFinal ? '' : this.latestInterim.trim()
    this.recognition?.stop()
    return pending
  }

  abort(): void {
    this.recognition?.abort()
    this.recognition = null
  }
}
