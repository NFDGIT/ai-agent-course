const form = document.querySelector("#agentForm");
const messageInput = document.querySelector("#message");
const runButton = document.querySelector("#runButton");
const traceList = document.querySelector("#trace");
const answer = document.querySelector("#answer");
const status = document.querySelector("#status");
const modeBadge = document.querySelector("#modeBadge");

async function loadStatus() {
  try {
    const response = await fetch("/api/status");
    const data = await response.json();
    status.textContent = `${data.mode} mode · ${data.model}`;
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
      body: JSON.stringify({ message }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed");

    modeBadge.textContent = data.mode;
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

loadStatus();
