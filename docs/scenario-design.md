# Scenario design

## HydraCool Cooling Unit

A fictional cooling unit is running, but the outlet is warmer than the marked expected band. The training fault is a restricted filter. The scenario takes about five to eight minutes and exists to exercise diagnostic conversation, not professional refrigeration practice.

Nothing here should be treated as an HVAC procedure or a safety certification.

## What is visible before a check

The prop shows the premise: the power lever is on, the status lamp is lit, the fan is turning, and the emergency stop is released. Temperature digits, the gauge zone, airflow placards, and the filter condition appear only after the engine records a check. The scene reads `deriveVisuals()`. It does not contain a second copy of the rules.

## Components

| Id | What a correct check finds |
| --- | --- |
| `power_switch` | On |
| `status_indicator` | Running, not a fault lamp |
| `control_panel` | Cooling requested at a normal setpoint |
| `temperature_display` | Outlet temperature above the expected band |
| `pressure_gauge` | Above the marked band |
| `fan` | Spinning |
| `air_intake` | Weak airflow |
| `air_outlet` | Reduced airflow |
| `filter_panel` | Filter loaded and restricting air |
| `compressor` | Running |
| `emergency_stop` | Not engaged |

## Diagnoses the trainee can name

| Id | Engine result |
| --- | --- |
| `restricted_filter` | Correct, once the evidence is in |
| `power_loss` | Incorrect. The unit is running. |
| `compressor_failure` | Incorrect unless they have actually found it stopped. They will not. |
| `fan_failure` | Incorrect. The fan is spinning. |
| `emergency_stop_engaged` | Incorrect. |
| `low_charge` | Incorrect. The gauge is high, not low. |

## Evidence required to confirm

All of these have to be true:

- the filter restriction is on the record
- the high outlet temperature is on the record
- at least one of the pressure gauge, intake, outlet, or fan has been checked
- at least three components have been checked

Confirming `restricted_filter` earlier is a premature diagnosis. The idea is remembered, the session stays open, and it counts as a mistake. A wrong confirmation is a separate mistake and does not complete the session.

Inspecting in any sensible order is valid. “I’m checking the pressure gauge”, “Let me inspect the pressure”, “I want to see the pressure”, and “I’m looking at the gauge” are the same inspection.

Saying a reading is “off” or “abnormal”, without saying whether it is high or low, is partial credit when the instrument really is abnormal. A contradicted reading, such as “the pressure is low”, is incorrect. The instructor then states what the instrument shows, because the trainee is looking at it, and the mistake stays on the record.

## Scoring

The engine produces six dimensions, each clamped from 0 to 100.

| Dimension | What moves it |
| --- | --- |
| Diagnostic accuracy | Finding the filter and the warm outlet, naming the right fault, confirming it. Wrong or early confirmations reduce it. |
| Observation accuracy | Spoken readings. A correct claim scores above a partial claim. Inspections with no spoken claim sit in between. |
| Process quality | Coverage of temperature, pressure, filter, fan, power, compressor, and either the intake or the outlet. |
| Efficiency | Repeated checks, off-task remarks, and a session that runs long. |
| Hint independence | Starts high once the trainee is working, and falls as hints are used. |
| Completion | Progress through the evidence, or 100 when the diagnosis is confirmed. |

Overall is a weighted sum: diagnostic 0.30, observation 0.18, process 0.22, efficiency 0.12, hint independence 0.08, completion 0.10.

Accent, grammar, and a bad transcription are not inputs. The score is not shown during the exercise. It appears on the debrief, next to a sentence that the figures came from the engine.

## Guidance

| Level | When it tends to appear | How it sounds |
| --- | --- | --- |
| Normal | The path is still moving | “What do you want to check?” |
| Supportive | Repeated mistakes, a couple of hints, or a stall | “Think about the airflow through the unit.” |
| High support | Several mistakes, several hints, or a long session without the filter | “Take a look at the filter area. Could restricted airflow explain the symptoms?” |

Seeing the filter, or naming the right fault as a hypothesis, eases the pressure. Hints point at the next gap. They do not mark the scenario complete.

The first hint, before any instrument has been checked, asks which display shows the warm outlet. Later hints move toward airflow, then the filter, then naming the fault.

## Debrief

The report is built from the engine state: overall and dimension scores, what went well, mistakes, key observations, the path, missed checks, a feedback paragraph that quotes those numbers, and a next-time note. If a model is linked, it may add a coaching paragraph. That paragraph is shown only if it does not cite a different overall mark, a percentage, or a confirmed diagnosis the engine does not have.

## Future work

- More scenarios as data, with the same reducer.
- Keep the answer key on a server if the exercise is ever high-stakes.
- A higher-quality speech stack, still with text as a complete path.
- Headset and barge-in tuning for always-listening.
- Export of the session record without storing raw audio.
