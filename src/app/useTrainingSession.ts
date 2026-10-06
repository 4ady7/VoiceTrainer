import { useCallback, useEffect, useRef, useState } from 'react'
import { buildDebrief } from '../features/scenario/debrief'
import { createInitialState, reduce } from '../features/scenario/engine'
import type { ComponentId, Phase, ScenarioState } from '../features/scenario/types'
import { composeReply } from '../features/instructor/compose'
import { canonicalInspect } from '../features/instructor/demoInterpreter'
import { coachingAcceptable } from '../features/instructor/guard'
import { runTurn } from '../features/instructor/orchestrate'
import { snapshotState } from '../features/instructor/snapshot'
import { fetchCoaching, fetchHealth, fetchInterpretation, fetchPhrase } from '../services/ai/client'
import { OBSERVATION_TEXT } from '../features/scenario/content'
import { canCommitTurn } from './sessionGuard'

export type ScreenName = 'start' | 'briefing' | 'simulation' | 'debrief'
export type InterpreterMode = 'unknown' | 'live' | 'local'
export type VoiceUiState = 'ready' | 'listening' | 'processing' | 'instructor_speaking' | 'error'

export interface TranscriptTurn {
  id: string
  speaker: 'you' | 'instructor'
  text: string
  atMs: number
  phase: Phase
  componentId: ComponentId | null
  transition: string | null
}

interface SessionState {
  screen: ScreenName
  preferVoice: boolean
  interpreter: InterpreterMode
  scenario: ScenarioState
  transcript: TranscriptTurn[]
  instructorLine: string
  voice: VoiceUiState
  voiceDetail: string
  error: string | null
  speechNonce: number
  latencies: number[]
  coaching: string | null
}

function initialSession(interpreter: InterpreterMode = 'unknown'): SessionState {
  return {
    screen: 'start',
    preferVoice: true,
    interpreter,
    scenario: createInitialState(),
    transcript: [],
    instructorLine: '',
    voice: 'ready',
    voiceDetail: 'Ready',
    error: null,
    speechNonce: 0,
    latencies: [],
    coaching: null,
  }
}

export function useTrainingSession() {
  const [session, setSession] = useState<SessionState>(() => initialSession())
  const inflight = useRef(false)
  const epochRef = useRef(0)
  const scenarioRef = useRef(session.scenario)
  const transcriptRef = useRef(session.transcript)
  const interpreterRef = useRef(session.interpreter)
  const screenRef = useRef(session.screen)
  scenarioRef.current = session.scenario
  transcriptRef.current = session.transcript
  interpreterRef.current = session.interpreter
  screenRef.current = session.screen

  useEffect(() => {
    let cancelled = false
    void fetchHealth().then((live) => {
      if (cancelled) return
      const interpreter = live ? 'live' : 'local'
      setSession((current) => (current.interpreter === 'unknown' ? { ...current, interpreter } : current))
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (session.screen !== 'simulation' || session.scenario.completed) return
    const timer = window.setInterval(() => {
      setSession((current) => {
        if (current.screen !== 'simulation' || current.scenario.completed) return current
        return { ...current, scenario: reduce(current.scenario, { type: 'tick' }, Date.now()).state }
      })
    }, 20000)
    return () => window.clearInterval(timer)
  }, [session.screen, session.scenario.completed])

  const start = useCallback((preferVoice: boolean) => {
    setSession((current) => ({ ...current, screen: 'briefing', preferVoice, error: null }))
  }, [])

  const enter = useCallback(() => {
    epochRef.current += 1
    inflight.current = false
    const before = createInitialState()
    const result = reduce(before, { type: 'begin' }, Date.now())
    const line = composeReply(before, { type: 'begin' }, result)
    const turn: TranscriptTurn = {
      id: 'ins-open',
      speaker: 'instructor',
      text: line,
      atMs: 0,
      phase: 'investigation',
      componentId: null,
      transition: null,
    }
    setSession((current) => ({
      ...current,
      screen: 'simulation',
      scenario: result.state,
      transcript: [turn],
      instructorLine: line,
      speechNonce: 1,
      error: null,
      coaching: null,
      latencies: [],
      voice: 'instructor_speaking',
      voiceDetail: current.preferVoice ? 'Instructor speaking' : 'Text only',
    }))
  }, [])

  const submit = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || inflight.current || screenRef.current !== 'simulation') return false
    const epoch = epochRef.current
    const snapshot = scenarioRef.current
    const recent = transcriptRef.current.slice(-8).map((turn) => ({ speaker: turn.speaker, text: turn.text }))
    const mode = interpreterRef.current === 'live' ? 'live' : 'local'
    inflight.current = true
    setSession((current) =>
      canCommitTurn(epoch, epochRef.current, current.screen)
        ? { ...current, voice: 'processing', voiceDetail: 'Processing', error: null }
        : current,
    )
    const started = performance.now()
    try {
      const outcome = await runTurn(
        {
          utterance: trimmed,
          state: snapshot,
          recent,
          mode,
          now: Date.now(),
        },
        {
          interpret: async (turn, turnSnapshot) => {
            if (mode !== 'live') return null
            return fetchInterpretation({ utterance: turn.utterance, snapshot: turnSnapshot, recent: turn.recent })
          },
          phrase: async ({ utterance, template, result }) => {
            if (mode !== 'live') return null
            return fetchPhrase({
              utterance,
              template,
              snapshot: snapshotState(result.state),
              facts: {
                judgment: result.judgment,
                completedNow: result.completedNow,
                premature: result.premature,
                componentId: result.componentId,
                hintId: result.hintId,
                reading: result.truth ? OBSERVATION_TEXT[result.truth] : null,
                guidanceLevel: result.state.guidanceLevel,
              },
            })
          },
        },
      )
      if (!canCommitTurn(epoch, epochRef.current, screenRef.current)) return false
      const nextInterpreter: InterpreterMode | null = mode === 'live' && !outcome.usedModel ? 'local' : null
      const latency = Math.round(performance.now() - started)
      setSession((current) => {
        if (!canCommitTurn(epoch, epochRef.current, current.screen)) return current
        const nonce = current.speechNonce + 1
        const you: TranscriptTurn = {
          id: `you-${nonce}`,
          speaker: 'you',
          text: trimmed,
          atMs: snapshot.elapsedMs,
          phase: snapshot.phase,
          componentId: outcome.componentId,
          transition: outcome.transition,
        }
        const instructor: TranscriptTurn = {
          id: `ins-${nonce}`,
          speaker: 'instructor',
          text: outcome.reply,
          atMs: outcome.state.elapsedMs,
          phase: outcome.state.phase,
          componentId: outcome.componentId,
          transition: null,
        }
        return {
          ...current,
          scenario: outcome.state,
          transcript: [...current.transcript, you, instructor],
          instructorLine: outcome.reply,
          speechNonce: nonce,
          latencies: [...current.latencies, latency],
          voice: 'instructor_speaking',
          voiceDetail: 'Instructor speaking',
          interpreter: nextInterpreter ?? current.interpreter,
        }
      })
      return true
    } catch {
      if (!canCommitTurn(epoch, epochRef.current, screenRef.current)) return false
      setSession((current) => {
        if (!canCommitTurn(epoch, epochRef.current, current.screen)) return current
        return {
          ...current,
          error: 'That turn did not go through. The session is still open — try again.',
          voice: 'ready',
          voiceDetail: 'Ready',
        }
      })
      return false
    } finally {
      if (epoch === epochRef.current) inflight.current = false
    }
  }, [])

  const inspect = useCallback(async (componentId: ComponentId) => submit(canonicalInspect(componentId)), [submit])

  const openDebrief = useCallback(() => {
    const epoch = (epochRef.current += 1)
    inflight.current = false
    const scenario = reduce(scenarioRef.current, { type: 'tick' }, Date.now()).state
    scenarioRef.current = scenario
    setSession((current) => ({ ...current, scenario, screen: 'debrief', voice: 'ready', voiceDetail: 'Ready' }))
    if (interpreterRef.current !== 'live') return
    const report = buildDebrief(scenario)
    void fetchCoaching(report).then((text) => {
      if (epoch !== epochRef.current) return
      if (!text || !coachingAcceptable(text, report)) return
      setSession((current) =>
        current.screen === 'debrief' && epoch === epochRef.current ? { ...current, coaching: text } : current,
      )
    })
  }, [])

  const restart = useCallback(() => {
    epochRef.current += 1
    inflight.current = false
    setSession((current) => initialSession(current.interpreter))
  }, [])

  const setVoice = useCallback((voice: VoiceUiState, detail?: string) => {
    setSession((current) => {
      if (current.screen !== 'simulation') return current
      if (current.voice === 'processing' && voice !== 'error') return current
      return { ...current, voice, voiceDetail: detail ?? current.voiceDetail }
    })
  }, [])

  const setError = useCallback((error: string | null) => {
    setSession((current) => ({ ...current, error }))
  }, [])

  return { session, start, enter, submit, inspect, openDebrief, restart, setVoice, setError }
}
