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
- `tools.js` — tool definitions, execution, and memory
- `public/` — browser interface
- `test/` — tool tests
