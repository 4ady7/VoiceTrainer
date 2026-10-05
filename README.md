# Voice Trainer

Talk through the fault. The instructor is listening.

Voice Trainer is an experimental browser prototype of a voice-driven diagnostic training simulator. A trainee speaks, or types, while inspecting a fictional HydraCool cooling unit. A conversational model can interpret the remark and phrase the instructor’s reply. A deterministic scenario engine decides what was checked, what is true, how the session is scored, and when the diagnosis is complete. The 3D unit only reflects that record.

This is a portfolio study of an interaction model. It is not HVAC training, not a safety certification, and not a field procedure.

## Run it

```bash
npm install
npm test
npm run dev
```

Open the URL Vite prints. Choose **Start training** or **Try text mode**.

No API key is required. Without one, the same scenario engine, scene, transcript, score, and debrief run through a local interpreter.

## Optional instructor model

Copy `.env.example` to `.env` and set a server-only key. These names must not use a `VITE_` prefix.

```bash
AI_API_KEY=
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
```

Any OpenAI-compatible chat completions endpoint works. An xAI example:

```bash
AI_BASE_URL=https://api.x.ai/v1
AI_MODEL=grok-2-latest
```

`npm run dev` serves the app and `POST /api/instructor`. `npm run build && npm start` serves the production build the same way. If the model call fails, that turn falls back to the local interpreter and the session stays usable.

## A short path through the scenario

The unit is running, and the outlet is warmer than expected. One reasonable path:

1. “I’m checking the temperature display.”
2. “It’s higher than expected.”
3. “Let me inspect the pressure.”
4. “The gauge is high.”
5. “I’m looking at the fan.”
6. “I’m checking the air intake.”
7. “I’m checking the filter panel.”
8. “The filter is clogged.”
9. “I suspect a restricted filter.”
10. “My diagnosis is a restricted filter.”

Other orders work. You can also select parts in the equipment list or on the model. Confirming the restricted filter before the temperature, the filter, and one airflow or pressure check are on the record does not finish the session.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | App plus instructor endpoint |
| `npm test` | Scenario engine, interpreter, and pipeline tests |
| `npm run typecheck` | TypeScript |
| `npm run build` | Typecheck and production bundle |
| `npm start` | Serve `dist` and the instructor endpoint |

## Privacy

The session stays in the browser. Nothing is written to an account or a database. If a model is configured, the server sends the current utterance, a short transcript, and a snapshot of what the engine has already revealed. It does not send hidden instrument readings. Microphone audio is handled by the browser speech API and is not stored by this app.

## Limitations

- One fictional scenario, with simplified equipment behavior.
- The answer key ships in the client because the engine has to run offline.
- Speech recognition is best in Chromium. Text mode is a full path, not a backup screen.
- Speech synthesis uses the browser voice and can fail silently to on-screen text.
- The instructor model can phrase a reply. It cannot set the score, the phase, or completion.

More detail is in `docs/architecture.md`, `docs/scenario-design.md`, and `docs/testing.md`.
