import { describe, expect, it } from 'vitest'
import { speechSessionMatches } from './SpeechRecognitionService'

describe('speech session token', () => {
  it('accepts a result only from the recognition that is still active', () => {
    expect(speechSessionMatches(4, 4)).toBe(true)
    expect(speechSessionMatches(3, 4)).toBe(false)
  })
})
