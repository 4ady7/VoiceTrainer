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
- scores staying inside 0–100
- elapsed time participating in guidance
- the filter staying visually normal until it is inspected
- a debrief built from the same state the engine scored

## Language mapping

`src/features/instructor/pipeline.test.ts` covers:

- “I’m checking the pressure gauge.”
- “Let me inspect the pressure.”
- “I want to see the pressure.”
- “I’m looking at the gauge.”

Those four become one `inspect` of `pressure_gauge`. The same file checks every equipment label, a follow-up reading of “higher than expected”, a clogged-filter observation versus a stated diagnosis, hints, asides, and mumbled fragments.

It also runs a full spoken path through the engine and expects a confirmed restricted filter with no mistakes.

## Pipeline guards

The same file checks that:

- a blank utterance does not change the score
- a malformed model payload falls back to the local interpreter
- a phrased reply that invents a score is discarded
- the snapshot sent to a model does not contain the hidden filter reading

Add a regression here when a new paraphrase should hit an existing action. Do not assert on instructor wording unless the wording is the contract, such as “diagnosis confirmed” only after completion.
