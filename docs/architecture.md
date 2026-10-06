# Architecture

Voice Trainer separates language from training truth.

```text
utterance (voice, text, or a selected part)
  → interpreter (model or local matcher)
  → schema check
  → one engine action
  → scenario engine
  → score, guidance, discoveries, completion
  → instructor line (model phrasing, or a template)
  → speech synthesis and the 3D scene
```

The model is not the source of truth. The engine never calls a model and does not import React. The scene never decides whether a component is faulty. `deriveVisuals()` maps engine state onto `normal`, `hovered`, `selected`, `highlighted`, `warning`, `fault`, and `checked`.

## Modules

| Path | Responsibility |
| --- | --- |
| `src/features/scenario/` | Content, reducer, scoring, guidance, debrief metrics, visuals |
| `src/features/instructor/` | Local interpreter, validation, action mapping, reply templates, turn orchestration |
| `src/features/simulation/` | Layout and the Three.js unit |
| `src/features/voice/` | Push-to-talk, always-listening, mute, replay |
| `src/features/debrief/` | Performance report |
| `src/services/speech/` | Browser speech recognition |
| `src/services/tts/` | Browser speech synthesis |
| `src/services/ai/` | Client for the instructor endpoint |
| `server/` | Health check and model calls. The API key stays here |

## What the model may do

On a live turn the server asks an OpenAI-compatible model for a JSON interpretation:

- intent
- mentioned components
- claimed observations
- a hypothesis, if any
- whether a hint was requested
- whether the remark needs to be repeated

Zod rejects unknown ids. A bad payload is discarded and the local interpreter handles the same utterance. A second call may rephrase the engine’s template. The reply is dropped if it mentions a score, a percentage, or a confirmed diagnosis the engine did not just confirm.

The snapshot sent upstream lists only components the trainee has already checked, plus phase, guidance, objective, hint count, and mistake count. Unrevealed readings stay in the scenario content module.

## What the engine owns

`reduce(state, action, now)` accepts `begin`, `tick`, `inspect`, `observe`, `hypothesize`, `confirm`, `request_hint`, `clarify`, `acknowledge`, and `irrelevant`.

Judgments are `correct`, `partial`, `incorrect`, `irrelevant`, and `already_checked`.

Empty audio and unclear remarks do not become mistakes. Clarification increments uncertainty, which can raise guidance, and does not change the score by itself. An empty submit does not enter the engine at all.

Once a run is completed, later ticks and actions leave its score, guidance, elapsed time, and diagnostic record unchanged. Reset builds a new state. A turn still in flight when the session ends or resets is discarded, so it cannot write into the next run.

Guidance is `normal`, `supportive`, or `high_support`, derived from mistakes, hints, stalls, uncertainty, wrong confirmations, elapsed time, and whether the filter has been seen.

## Voice loop

System states shown in the interface:

`Ready` · `Listening` · `Processing` · `Instructor speaking` · `Voice unavailable`

Push-to-talk is the default (the button or Space, unless focus is in the text field). Always-listening is optional and pauses while the instructor is speaking. A transcript that echoes the last instructor line is ignored. Text uses `runTurn` with the same engine path. Selecting a part sends the canonical sentence “I’m checking the …” through that path too.

Speech synthesis is canceled before the next line. If it is muted, unsupported, or it errors, the written line remains.

## Demo mode

Demo mode is not a second application. `GET /api/health` reports whether a key is configured. Missing key, network failure, timeout, or a malformed model body all keep the session on the local interpreter. The scene, transcript, score, and debrief stay on the engine.

## Session data

For the open session the app keeps response latency, duration, trainee turns, hints, mistakes, checkpoints, completion, and the diagnostic path. Refreshing the page clears it. There is no account and no audio archive.

## Failure behavior

| Failure | What the trainee gets |
| --- | --- |
| Microphone denied or missing speech recognition | “Voice unavailable — continue with text.” |
| Empty or unclear speech | A request to restate. No mistake. |
| Model timeout or invalid JSON | Local interpretation of the same utterance |
| Phrased reply that invents a result | The template |
| Speech synthesis failure | The written instructor line |
| Second submit while a turn is in flight | The new submit is ignored and the text stays in the field |
