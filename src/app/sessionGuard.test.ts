import { describe, expect, it } from 'vitest'
import { canCommitTurn } from './sessionGuard'

describe('session generation', () => {
  it('commits a turn only while that generation is still the open simulation', () => {
    expect(canCommitTurn(3, 3, 'simulation')).toBe(true)
    expect(canCommitTurn(3, 4, 'simulation')).toBe(false)
    expect(canCommitTurn(3, 3, 'debrief')).toBe(false)
    expect(canCommitTurn(3, 3, 'start')).toBe(false)
    expect(canCommitTurn(3, 3, 'briefing')).toBe(false)
  })
})
