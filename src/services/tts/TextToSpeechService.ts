export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export class TextToSpeechService {
  private last = ''
  private generation = 0
  private timer = 0
  private watch = 0

  constructor(private onSpeaking: (speaking: boolean) => void) {}

  get lastText(): string {
    return this.last
  }

  speak(text: string): void {
    if (!ttsSupported() || !text.trim()) {
      this.onSpeaking(false)
      return
    }
    this.last = text
    const generation = ++this.generation
    window.clearTimeout(this.timer)
    window.clearTimeout(this.watch)
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.98
    utterance.pitch = 1
    const voices = window.speechSynthesis.getVoices()
    const voice =
      voices.find((item) => item.lang.startsWith('en') && /samantha|google uk english|daniel|natural/i.test(item.name)) ??
      voices.find((item) => item.lang.startsWith('en'))
    if (voice) utterance.voice = voice
    utterance.onstart = () => {
      if (generation === this.generation) this.onSpeaking(true)
    }
    utterance.onend = () => {
      if (generation !== this.generation) return
      window.clearTimeout(this.watch)
      this.onSpeaking(false)
    }
    utterance.onerror = () => {
      if (generation !== this.generation) return
      window.clearTimeout(this.watch)
      this.onSpeaking(false)
    }
    this.watch = window.setTimeout(() => {
      if (generation !== this.generation) return
      this.generation += 1
      if (ttsSupported()) window.speechSynthesis.cancel()
      this.onSpeaking(false)
    }, Math.min(60000, 2500 + text.length * 70))
    this.timer = window.setTimeout(() => {
      if (generation !== this.generation) return
      window.speechSynthesis.speak(utterance)
    }, 60)
  }

  stop(): void {
    this.generation += 1
    window.clearTimeout(this.timer)
    window.clearTimeout(this.watch)
    if (ttsSupported()) window.speechSynthesis.cancel()
    this.onSpeaking(false)
  }

  replay(): void {
    if (this.last) this.speak(this.last)
  }
}
