# Testing

The training rules are tested without the browser, the scene, or a model.

```bash
npm test
npm run typecheck
npm run build
```

Vitest runs `src/**/*.test.ts` in Node.

## Scenario engine

`src/features/scenario/engine.test.ts` covers:

- the initial unpublished state
- a valid inspection and the reading it reveals
- two inspection orders
- an incorrect observation and a partial one
- a repeated inspection
- hints, separate from mistakes
- guidance moving to supportive and high support
- clarification that does not create a mistake
- a wrong diagnosis
- the correct diagnosis named too early
- completion on two different evidence paths
- a completed run whose score stays put after a later tick, another check, or another diagnosis
- scores staying inside 0–100
- elapsed time participating in guidance before completion
- unknown component and diagnosis ids leaving the state unchanged
- a fresh session after a finished one
- the filter staying visually normal until it is inspected
- a debrief built from the same state the engine scored
- a misread component that is not praised as a correct observation
- a completed debrief that names only readings the trainee actually gathered

## Language mapping

`src/features/instructor/pipeline.test.ts` covers:

- “I’m checking the pressure gauge.”
- “Let me inspect the pressure.”
- “I want to see the pressure.”
- “I’m looking at the gauge.”

Those four become one `inspect` of `pressure_gauge`. The same file checks other pressure phrasings, including “above normal” and “reading high”, every equipment label, a follow-up reading of “higher than expected”, a clogged-filter observation versus a stated diagnosis, hints, asides, and mumbled fragments.

A remark that names two parts, two faults, or no part at all becomes a request to repeat it. It does not pick one of them.

It also runs a full spoken path through the engine and expects a confirmed restricted filter with no mistakes.

## Pipeline guards

The same file checks that:

- a blank utterance does not change the score
- a malformed model payload falls back to the local interpreter
- a thrown interpretation or a thrown phrase falls back without completing the scenario
- a model payload cannot set the score or mark the run complete
- a premature model diagnosis is rejected by the engine
- two named parts without a distinguishing claim check neither part
- a phrased reply that invents a score is discarded
- the snapshot sent to a model does not contain the hidden filter reading

`src/app/sessionGuard.test.ts` checks that a finished generation cannot commit into a reset or debrief. `src/services/speech/speechSession.test.ts` checks that a replaced recognition session cannot accept a late result.

Add a regression here when a new paraphrase should hit an existing action. Do not assert on instructor wording unless the wording is the contract, such as “diagnosis confirmed” only after completion.
