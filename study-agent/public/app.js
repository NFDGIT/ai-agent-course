const form = document.querySelector("#agentForm");
const providerForm = document.querySelector("#providerForm");
const providerAliasInput = document.querySelector("#providerAliasInput");
const providerUrlInput = document.querySelector("#providerUrlInput");
const providerKeyInput = document.querySelector("#providerKeyInput");
const loadModelsButton = document.querySelector("#loadModelsButton");
const providerMessage = document.querySelector("#providerMessage");
const providerSelect = document.querySelector("#providerSelect");
const modelSelect = document.querySelector("#modelSelect");
const removeProviderButton = document.querySelector("#removeProviderButton");
const messageInput = document.querySelector("#message");
const runButton = document.querySelector("#runButton");
const traceList = document.querySelector("#trace");
const answer = document.querySelector("#answer");
const status = document.querySelector("#status");
const modeBadge = document.querySelector("#modeBadge");

let providers = [];

function setProviderMessage(message, type = "") {
  providerMessage.textContent = message;
  providerMessage.classList.toggle("is-error", type === "error");
  providerMessage.classList.toggle("is-success", type === "success");
}

function selectedProvider() {
  return providers.find((provider) => provider.alias === providerSelect.value);
}

function renderModels(preferredModel) {
  const provider = selectedProvider();
  modelSelect.replaceChildren();

  for (const model of provider?.models || []) {
    const option = document.createElement("option");
    option.value = model;
    option.textContent = model;
    modelSelect.append(option);
  }

  if (preferredModel && provider?.models.includes(preferredModel)) {
    modelSelect.value = preferredModel;
  }

  modelSelect.disabled = modelSelect.options.length === 0;
  removeProviderButton.disabled = !provider || provider.source === "environment";
  window.localStorage.setItem("study-agent-provider", providerSelect.value);
  window.localStorage.setItem("study-agent-model", modelSelect.value);
}

function renderProviders(preferredAlias, preferredModel) {
  providerSelect.replaceChildren();

  for (const provider of providers) {
    const option = document.createElement("option");
    option.value = provider.alias;
    option.textContent = `${provider.alias} · ${provider.baseUrl}`;
    providerSelect.append(option);
  }

  if (preferredAlias && providers.some((provider) => provider.alias === preferredAlias)) {
    providerSelect.value = preferredAlias;
  }

  providerSelect.disabled = providers.length === 0;
  renderModels(preferredModel);
}

async function loadProviders(preferredAlias, preferredModel) {
  const response = await fetch("/api/providers");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load providers");

  providers = data.providers;
  renderProviders(
    preferredAlias || window.localStorage.getItem("study-agent-provider"),
    preferredModel || window.localStorage.getItem("study-agent-model"),
  );
}

async function loadStatus() {
  try {
    const response = await fetch("/api/status");
    const data = await response.json();
    status.textContent = `${data.mode} mode · ${data.provider} · ${data.model}`;
    modeBadge.textContent = data.mode;
  } catch {
    status.textContent = "Server unavailable";
  }
}

function renderTrace(trace) {
  traceList.replaceChildren();

  for (const step of trace) {
    const item = document.createElement("li");
    const title = document.createElement("strong");
    const detail = document.createElement("span");

    title.textContent = `${step.type}: ${step.title}`;
    detail.textContent = step.detail;
    item.append(title, detail);
    traceList.append(item);
  }
}

providerSelect.addEventListener("change", () => {
  renderModels();
});

modelSelect.addEventListener("change", () => {
  window.localStorage.setItem("study-agent-model", modelSelect.value);
});

providerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loadModelsButton.disabled = true;
  loadModelsButton.textContent = "Loading models…";
  setProviderMessage("Connecting to the provider’s /models endpoint…");

  try {
    const response = await fetch("/api/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        alias: providerAliasInput.value,
        baseUrl: providerUrlInput.value,
        apiKey: providerKeyInput.value,
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load models");

    providerKeyInput.value = "";
    await loadProviders(data.provider.alias, data.provider.models[0]);
    setProviderMessage(
      `Loaded ${data.provider.models.length} model${data.provider.models.length === 1 ? "" : "s"} from ${data.provider.alias}.`,
      "success",
    );
  } catch (error) {
    setProviderMessage(error.message, "error");
  } finally {
    loadModelsButton.disabled = false;
    loadModelsButton.textContent = "Connect and load models";
  }
});

removeProviderButton.addEventListener("click", async () => {
  const provider = selectedProvider();
  if (!provider || provider.source === "environment") return;

  const response = await fetch(`/api/providers/${encodeURIComponent(provider.alias)}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const data = await response.json();
    setProviderMessage(data.error || "Could not remove provider", "error");
    return;
  }

  await loadProviders("Default");
  setProviderMessage(`Removed ${provider.alias}.`, "success");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = messageInput.value.trim();
  if (!message) return;

  runButton.disabled = true;
  runButton.textContent = "Agent is working…";
  answer.textContent = "Waiting for the agent…";

  try {
    const response = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        providerAlias: providerSelect.value,
        model: modelSelect.value,
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed");

    modeBadge.textContent = `${data.provider} · ${data.model}`;
    renderTrace(data.trace);
    answer.textContent = data.answer;
  } catch (error) {
    traceList.innerHTML = '<li class="placeholder">The request failed.</li>';
    answer.textContent = error.message;
  } finally {
    runButton.disabled = false;
    runButton.textContent = "Run the agent";
  }
});

Promise.all([loadStatus(), loadProviders()]).catch((error) => {
  setProviderMessage(error.message, "error");
});
