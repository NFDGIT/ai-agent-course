import "dotenv/config";

import express from "express";

import { runStudyAgent } from "./agent.js";
import { discoverProvider, listProviders, removeProvider } from "./providers.js";
import { readMemory } from "./tools.js";

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json({ limit: "100kb" }));
app.use(express.static("public"));

app.get("/api/status", (_request, response) => {
  const defaultProvider = listProviders()[0];
  response.json({
    ok: true,
    mode: process.env.OPENAI_API_KEY ? "openai" : "demo",
    provider: defaultProvider.alias,
    model: defaultProvider.models[0],
  });
});

app.get("/api/providers", (_request, response) => {
  response.json({ providers: listProviders() });
});

app.post("/api/providers", async (request, response) => {
  try {
    const provider = await discoverProvider({
      alias: request.body?.alias,
      baseUrl: request.body?.baseUrl,
      apiKey: request.body?.apiKey || "",
    });
    response.status(201).json({ provider });
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.delete("/api/providers/:alias", (request, response) => {
  try {
    const removed = removeProvider(request.params.alias);
    if (!removed) {
      response.status(404).json({ error: "provider not found" });
      return;
    }
    response.status(204).end();
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.get("/api/memory", (_request, response) => {
  response.json(readMemory());
});

app.post("/api/agent", async (request, response) => {
  const message = request.body?.message?.trim();
  const providerAlias = request.body?.providerAlias?.trim() || "Default";
  const model = request.body?.model?.trim();

  if (!message) {
    response.status(400).json({ error: "message is required" });
    return;
  }

  try {
    const result = await runStudyAgent(message, { providerAlias, model });
    response.json(result);
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: error.message || "The agent failed" });
  }
});

app.listen(port, () => {
  const mode = process.env.OPENAI_API_KEY ? "OpenAI" : "demo";
  console.log(`Study Agent running at http://localhost:${port} (${mode} mode)`);
});
