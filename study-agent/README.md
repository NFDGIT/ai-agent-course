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
- `agent.js` — model request and agent loop
- `providers.js` — provider aliases, model discovery, and selected-provider lookup
- `tools.js` — tool definitions, execution, and memory
- `public/` — browser interface
- `test/` — tool tests

## Add a model provider

Open **Add model provider** in the webpage and enter an alias, an OpenAI-compatible API base URL, and an optional API key. The server calls the provider's `GET /models` endpoint and fills the model dropdown.

Provider keys are kept only in server memory and are never returned by `/api/providers`. Custom providers must support both `/models` and `/responses`, including function calling.
