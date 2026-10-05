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
  const scenarioRef = useRef(session.scenario)
  const transcriptRef = useRef(session.transcript)
  const interpreterRef = useRef(session.interpreter)
  scenarioRef.current = session.scenario
  transcriptRef.current = session.transcript
  interpreterRef.current = session.interpreter

  useEffect(() => {
    let cancelled = false
    void fetchHealth().then((live) => {
      if (!cancelled) {
        const interpreter = live ? 'live' : 'local'
        interpreterRef.current = interpreter
        setSession((current) => ({ ...current, interpreter }))
      }
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
    if (!trimmed || inflight.current) return false
    inflight.current = true
    setSession((current) => ({ ...current, voice: 'processing', voiceDetail: 'Processing', error: null }))
    const started = performance.now()
    try {
      const outcome = await runTurn(
        {
          utterance: trimmed,
          state: scenarioRef.current,
          recent: transcriptRef.current.slice(-8).map((turn) => ({ speaker: turn.speaker, text: turn.text })),
          mode: interpreterRef.current === 'live' ? 'live' : 'local',
          now: Date.now(),
        },
        {
          interpret: async (turn, snapshot) => {
            if (interpreterRef.current !== 'live') return null
            return fetchInterpretation({ utterance: turn.utterance, snapshot, recent: turn.recent })
          },
          phrase: async ({ utterance, template, result }) => {
            if (interpreterRef.current !== 'live') return null
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
      if (interpreterRef.current === 'live' && !outcome.usedModel) interpreterRef.current = 'local'
      const latency = Math.round(performance.now() - started)
      setSession((current) => {
        const nonce = current.speechNonce + 1
        const you: TranscriptTurn = {
          id: `you-${nonce}`,
          speaker: 'you',
          text: trimmed,
          atMs: current.scenario.elapsedMs,
          phase: current.scenario.phase,
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
          interpreter: interpreterRef.current,
        }
      })
      return true
    } catch {
      setSession((current) => ({
        ...current,
        error: 'That turn did not go through. The session is still open — try again.',
        voice: 'ready',
        voiceDetail: 'Ready',
      }))
      return false
    } finally {
      inflight.current = false
    }
  }, [])

  const inspect = useCallback(async (componentId: ComponentId) => submit(canonicalInspect(componentId)), [submit])

  const openDebrief = useCallback(() => {
    const scenario = reduce(scenarioRef.current, { type: 'tick' }, Date.now()).state
    scenarioRef.current = scenario
    setSession((current) => ({ ...current, scenario, screen: 'debrief', voice: 'ready', voiceDetail: 'Ready' }))
    if (interpreterRef.current !== 'live') return
    const report = buildDebrief(scenario)
    void fetchCoaching(report).then((text) => {
      if (!text || !coachingAcceptable(text, report)) return
      setSession((current) => ({ ...current, coaching: text }))
    })
  }, [])

  const restart = useCallback(() => {
    inflight.current = false
    setSession((current) => initialSession(current.interpreter))
  }, [])

  const setVoice = useCallback((voice: VoiceUiState, detail?: string) => {
    setSession((current) => ({ ...current, voice, voiceDetail: detail ?? current.voiceDetail }))
  }, [])

  const setError = useCallback((error: string | null) => {
    setSession((current) => ({ ...current, error }))
  }, [])

  return { session, start, enter, submit, inspect, openDebrief, restart, setVoice, setError }
}
