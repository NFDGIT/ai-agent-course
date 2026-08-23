# Beginner Study Planner Agent

This is the real project used by the course in `../course/`.

## Run it

```bash
npm install
cp .env.example .env
npm start
```

Open `http://localhost:3000`.

The project works in demo mode without an API key. To use the real model, place your API key in `.env`.

## Files

- `server.js` — HTTP server and API endpoints
- `agent.js` — streaming model request and agent loop
- `providers.js` — provider aliases, model discovery, and selected-provider lookup
- `provider-store.js` — private local persistence outside the Git repository
- `tools.js` — tool definitions, execution, and memory
- `public/` — browser interface
- `test/` — tool tests

## Add a model provider

Open **Add model provider** in the webpage and enter an alias, an OpenAI-compatible API base URL, and an optional API key. The server calls the provider's `GET /models` endpoint and fills the model dropdown.

Custom providers are saved to `~/.ai-agent-course/providers.json` with owner-only file permissions, so they survive server restarts without entering this Git repository. The API key is never returned by `/api/providers`, but it is stored as plain text on your computer; protect your user account and do not move this file into the repository.

Paste the raw API key into the form. A pasted `Bearer ` prefix is removed automatically. Custom providers must support `/models` plus streaming `/responses` requests, including function calling.

Set `PROVIDER_STORE_PATH` if you need a different local storage location.

## Streaming

The browser uses `POST /api/agent/stream` and receives Server-Sent Events while the agent works:

- `agent.started` — selected provider and model
- `trace` — a decision, tool call, or observation
- `text.delta` — the next piece of generated text
- `done` — the complete canonical result
- `error` — a streaming failure

The original `POST /api/agent` JSON endpoint remains available as a non-streaming fallback.
