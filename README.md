# AI Agent Course and Study Planner Project

This standalone repository contains both the beginner course and the real project used by the course.

## Project structure

```text
ai-agent-course/
├── course/          # Ten-step browser course
├── study-agent/     # Runnable Node.js AI agent project
└── README.md
```

## Open in VS Code

```bash
code /Users/zorin/Desktop/projects/ai-agent-course
```

You can also open `ai-agent-course.code-workspace` from Finder or VS Code.

## Run the course

Open a terminal in the repository root:

```bash
python3 -m http.server 8080 --directory course
```

Open `http://localhost:8080`.

## Run the Study Agent

Open a second terminal:

```bash
cd study-agent
npm install
npm test
npm start
```

Open `http://localhost:3000`.

The project works in demo mode without an API key.

### Add another model provider

In the Study Agent webpage, open **Add model provider** and enter:

- A short alias, such as `Local Ollama`
- An OpenAI-compatible API base URL, such as `http://localhost:11434/v1`
- An API key when the provider requires one

The server requests `GET /models`, returns the available model IDs to the browser, and lets you select the provider and model above the message input. Custom providers must also support the OpenAI-compatible `/responses` API and function calling to run the agent.

For real model mode:

```bash
cd study-agent
cp .env.example .env
```

Then place your API key in `.env`. Never commit `.env` to GitHub.

## Create a GitHub repository

Create an empty repository on GitHub, then run:

```bash
cd /Users/zorin/Desktop/projects/ai-agent-course
git init
git add .
git commit -m "Add beginner AI agent course and project"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```
