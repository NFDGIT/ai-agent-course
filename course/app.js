const completeButtons = [...document.querySelectorAll("[data-complete]")];
const progressText = document.querySelector("#progressText");
const progressBar = document.querySelector("#progressBar");
const resetProgressButton = document.querySelector("#resetProgress");
const copyButtons = [...document.querySelectorAll(".copy-button")];
const navLinks = [...document.querySelectorAll(".step-nav a")];
const lessons = [...document.querySelectorAll(".lesson")];

const completedSteps = new Set(
  JSON.parse(window.localStorage.getItem("agent-course-v2-progress") || "[]"),
);

function updateProgress() {
  completeButtons.forEach((button) => {
    const step = Number(button.dataset.complete);
    const isComplete = completedSteps.has(step);
    button.classList.toggle("is-complete", isComplete);
    button.textContent = isComplete ? "✓ Completed" : "Mark complete";
    button.setAttribute("aria-pressed", String(isComplete));
  });

  progressText.textContent = `${completedSteps.size} / ${completeButtons.length}`;
  progressBar.style.width = `${(completedSteps.size / completeButtons.length) * 100}%`;
  window.localStorage.setItem("agent-course-v2-progress", JSON.stringify([...completedSteps]));
}

completeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const step = Number(button.dataset.complete);
    if (completedSteps.has(step)) completedSteps.delete(step);
    else completedSteps.add(step);
    updateProgress();
  });
});

resetProgressButton.addEventListener("click", () => {
  completedSteps.clear();
  updateProgress();
});

copyButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const code = button.closest(".code-block").querySelector("code").textContent;
    await navigator.clipboard.writeText(code);
    button.textContent = "Copied";
    window.setTimeout(() => {
      button.textContent = "Copy";
    }, 1200);
  });
});

const observer = new IntersectionObserver(
  (entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((first, second) => second.intersectionRatio - first.intersectionRatio)[0];

    if (!visible) return;
    navLinks.forEach((link) => {
      link.classList.toggle("is-active", link.getAttribute("href") === `#${visible.target.id}`);
    });
  },
  { rootMargin: "-20% 0px -65%", threshold: [0.1, 0.35, 0.6] },
);

lessons.forEach((lesson) => observer.observe(lesson));
updateProgress();
