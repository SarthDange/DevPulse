const HISTORY_KEY = "devpulse_history";
const API_KEY_NAME = "devpulse_gemini_api_key";
const AI_ENABLED_KEY = "devpulse_ai_enabled";
const GEMINI_ORIGIN = "https://generativelanguage.googleapis.com/*";

const eventList = document.getElementById("event-list");
const eventCount = document.getElementById("event-count");
const emptyState = document.getElementById("empty-state");
const noMatches = document.getElementById("no-matches");
const status = document.getElementById("status");
const analysisPanel = document.getElementById("analysis-panel");
const analysisStatus = document.getElementById("analysis-status");
const analysisResult = document.getElementById("analysis-result");
const searchInput = document.getElementById("event-search");
const typeFilter = document.getElementById("type-filter");

let currentHistory = [];

function addTextElement(parent, tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = String(text ?? "");
  if (className) element.className = className;
  parent.appendChild(element);
  return element;
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString();
}

function getEventLabel(type) {
  const labels = {
    javascript_error: "JavaScript error",
    unhandled_rejection: "Unhandled promise rejection",
    http_error: "HTTP error",
    network_error: "Network error"
  };
  return labels[type] || "Diagnostic event";
}

function showAnalysisMessage(message) {
  analysisPanel.hidden = false;
  analysisStatus.textContent = message;
  analysisResult.replaceChildren();
}

function renderAnalysis(result) {
  analysisResult.replaceChildren();
  addTextElement(analysisResult, "h3", result.summary);
  addTextElement(analysisResult, "p", `Category: ${result.category}`);
  addTextElement(analysisResult, "p", `Likely cause: ${result.cause}`);
  addTextElement(analysisResult, "p", `Confidence: ${result.confidence}`);

  addTextElement(analysisResult, "h4", "Suggested fixes");
  const fixesList = document.createElement("ul");
  for (const fix of result.fixes) addTextElement(fixesList, "li", fix);
  analysisResult.appendChild(fixesList);

  if (result.missing_info.length) {
    addTextElement(analysisResult, "h4", "Information that could help");
    const missingList = document.createElement("ul");
    for (const item of result.missing_info) addTextElement(missingList, "li", item);
    analysisResult.appendChild(missingList);
  }
}

async function analyzeEvent(event, button) {
  button.disabled = true;
  button.textContent = "Checking settings…";
  try {
    const settings = await chrome.storage.local.get([API_KEY_NAME, AI_ENABLED_KEY]);
    const apiKey = settings[API_KEY_NAME];

    if (settings[AI_ENABLED_KEY] !== true) {
      showAnalysisMessage("AI analysis is disabled. Open DevPulse settings, save your Gemini API key, and enable AI analysis. No diagnostic data was sent.");
      return;
    }
    if (typeof apiKey !== "string" || !apiKey.trim()) {
      showAnalysisMessage("No Gemini API key is saved. Open DevPulse settings to add one. No diagnostic data was sent.");
      return;
    }
    if (!await chrome.permissions.contains({ origins: [GEMINI_ORIGIN] })) {
      showAnalysisMessage("Gemini permission is missing. Open DevPulse settings and enable AI analysis again. No diagnostic data was sent.");
      return;
    }
    if (!globalThis.DevPulseGemini?.analyzeDiagnostic) {
      showAnalysisMessage("The Gemini client did not load. Reload DevPulse and try again.");
      return;
    }

    const consent = window.confirm(
      "Send this selected, sanitized diagnostic to Google Gemini for analysis?\\n\\n" +
      "The event message and limited origin/location hints will be sent. " +
      "Do not analyze diagnostics that may contain confidential information."
    );
    if (!consent) {
      showAnalysisMessage("Analysis cancelled. No diagnostic data was sent.");
      return;
    }

    showAnalysisMessage("Sending the selected, sanitized diagnostic to Gemini…");
    button.textContent = "Analyzing…";
    const result = await globalThis.DevPulseGemini.analyzeDiagnostic({ apiKey, event });
    renderAnalysis(result);
    analysisStatus.textContent = "Analysis complete. Review suggestions before applying them.";
  } catch (error) {
    showAnalysisMessage(error instanceof Error ? error.message : "Analysis failed. Check your settings and try again.");
  } finally {
    button.disabled = false;
    button.textContent = "Analyze with AI";
  }
}

function eventMatches(event, query, type) {
  if (type !== "all" && event.type !== type) return false;
  if (!query) return true;
  const haystack = [event.message, event.origin, event.filename, getEventLabel(event.type)]
    .filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(query);
}

function renderEvents(history) {
  currentHistory = Array.isArray(history) ? history.slice(-100) : [];
  const query = searchInput.value.trim().toLowerCase();
  const selectedType = typeFilter.value;
  const filtered = currentHistory.slice().reverse()
    .filter((event) => eventMatches(event, query, selectedType));

  eventList.replaceChildren();
  eventCount.textContent = `${filtered.length} shown · ${currentHistory.length} total`;
  emptyState.hidden = currentHistory.length > 0;
  noMatches.hidden = currentHistory.length === 0 || filtered.length > 0;

  for (const event of filtered) {
    const card = document.createElement("article");
    card.className = `event-card event-${event.type}`;
    const heading = document.createElement("div");
    heading.className = "event-heading";
    addTextElement(heading, "strong", getEventLabel(event.type));
    addTextElement(heading, "time", formatTime(event.timestamp));
    card.appendChild(heading);

    addTextElement(card, "p", event.message || "No error message", "event-message");
    if (event.origin) addTextElement(card, "p", `Page: ${event.origin}`, "event-origin");
    if (event.filename) addTextElement(card, "p", `Source: ${event.filename}`, "event-filename");
    if (event.line > 0) addTextElement(card, "p",
      `Line ${event.line}${event.column > 0 ? `, column ${event.column}` : ""}`, "event-location");

    const actions = document.createElement("div");
    actions.className = "event-actions";
    const analyzeButton = document.createElement("button");
    analyzeButton.type = "button";
    analyzeButton.className = "analyze-button";
    analyzeButton.textContent = "Analyze with AI";
    analyzeButton.addEventListener("click", () => analyzeEvent(event, analyzeButton));
    actions.appendChild(analyzeButton);

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.textContent = "Copy summary";
    copyButton.addEventListener("click", async () => {
      const summary = [
        `Type: ${getEventLabel(event.type)}`,
        `Time: ${formatTime(event.timestamp)}`,
        `Message: ${event.message || "No error message"}`,
        event.origin ? `Page: ${event.origin}` : "",
        event.filename ? `Source: ${event.filename}` : "",
        event.line > 0 ? `Line: ${event.line}, column: ${event.column || 0}` : ""
      ].filter(Boolean).join("\\n");
      try {
        await navigator.clipboard.writeText(summary);
        status.textContent = "Diagnostic summary copied.";
      } catch {
        status.textContent = "Clipboard access failed. Select and copy the event text instead.";
      }
    });
    actions.appendChild(copyButton);
    card.appendChild(actions);

    const details = document.createElement("details");
    addTextElement(details, "summary", "Event metadata");
    addTextElement(details, "p", `Event ID: ${event.id || "Unavailable"}`);
    addTextElement(details, "p", `Received: ${formatTime(event.receivedAt)}`);
    card.appendChild(details);
    eventList.appendChild(card);
  }
}

async function loadEvents() {
  status.textContent = "";
  try {
    const result = await chrome.storage.local.get(HISTORY_KEY);
    renderEvents(result[HISTORY_KEY]);
  } catch (error) {
    console.error("DevPulse: Could not load event history.", error);
    status.textContent = "Couldn't load event history. Try refreshing.";
  }
}

document.getElementById("refresh").addEventListener("click", loadEvents);
searchInput.addEventListener("input", () => renderEvents(currentHistory));
typeFilter.addEventListener("change", () => renderEvents(currentHistory));

document.getElementById("export-history").addEventListener("click", () => {
  // Export only diagnostic fields; omit tab IDs and internal bookkeeping.
  const exportEvents = currentHistory.map((event) => ({
    id: event.id,
    type: event.type,
    message: event.message,
    filename: event.filename,
    line: event.line,
    column: event.column,
    timestamp: event.timestamp,
    origin: event.origin
  }));
  const blob = new Blob([JSON.stringify(exportEvents, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `devpulse-diagnostics-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  status.textContent = "Diagnostic history export prepared. Review the file before sharing it.";
});

document.getElementById("clear-history").addEventListener("click", async () => {
  const confirmed = window.confirm("Clear all saved DevPulse diagnostic history? This cannot be undone.");
  if (!confirmed) return;
  try {
    await chrome.storage.local.set({ [HISTORY_KEY]: [] });
    status.textContent = "History cleared.";
    analysisPanel.hidden = true;
  } catch (error) {
    console.error("DevPulse: Could not clear event history.", error);
    status.textContent = "Couldn't clear history.";
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[HISTORY_KEY]) renderEvents(changes[HISTORY_KEY].newValue);
});

loadEvents();
