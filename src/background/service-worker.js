
/**
 * DevPulse — Manifest V3 service worker
 * Opens the side panel and stores validated diagnostic events.
 */

const HISTORY_KEY = "devpulse_history";
const MAX_HISTORY = 100;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_FILENAME_LENGTH = 1000;
const RATE_WINDOW_MS = 10_000;
const MAX_EVENTS_PER_WINDOW = 30;
const DEDUPE_WINDOW_MS = 5000;

function redactSensitiveText(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .slice(0, MAX_MESSAGE_LENGTH)
    // Handle Authorization headers first, including Bearer credentials.
    .replace(
      /\b(authorization)\b\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s&,;]+(?:\s+[^\s&,;]+)?)/gi,
      "$1=[REDACTED]"
    )
    // Redact other common secret names.
    .replace(
      /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|token|client[_-]?secret|secret|auth|password|passwd)\b\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s&,;]+)/gi,
      "$1=[REDACTED]"
    )
    // Redact standalone Bearer credentials.
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    // Redact common Google API keys.
    .replace(/\bAIza[A-Za-z0-9_-]{20,}\b/g, "[REDACTED_API_KEY]");
}

const ALLOWED_TYPES = new Set([
  "javascript_error",
  "unhandled_rejection",
  "http_error",
  "network_error"
]);

// In-memory rate limits reset if Chrome suspends the service worker.
// They are a useful first guard, not a complete abuse-prevention system.
const rateLimits = new Map();

// Serialize history writes to avoid simultaneous updates overwriting each other.
let writeQueue = Promise.resolve();

chrome.runtime.onInstalled.addListener(() => {
  if (chrome.storage.local.setAccessLevel) {
    chrome.storage.local.setAccessLevel({
      accessLevel: "TRUSTED_CONTEXTS"
    }).catch((error) => {
      console.warn("DevPulse: Could not restrict storage access.", error);
    });
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  if (typeof tab.id !== "number") {
    return;
  }

  try {
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (error) {
    console.warn("DevPulse: Could not open side panel.", error);
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["src/content/content-bridge.js"]
    });

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      files: ["src/page/page-monitor.js"]
    });

    console.info("DevPulse: Monitoring scripts initialized.", {
      tabId: tab.id
    });
  } catch (error) {
    console.warn(
      "DevPulse: Script injection was unavailable for this tab.",
      error
    );
  }
});

function isValidEvent(event) {
  return Boolean(
    event &&
    typeof event === "object" &&
    ALLOWED_TYPES.has(event.type) &&
    typeof event.message === "string" &&
    event.message.length <= MAX_MESSAGE_LENGTH &&
    typeof event.filename === "string" &&
    event.filename.length <= MAX_FILENAME_LENGTH &&
    typeof event.timestamp === "number" &&
    Number.isFinite(event.timestamp) &&
    Number.isSafeInteger(event.line) &&
    event.line >= 0 &&
    Number.isSafeInteger(event.column) &&
    event.column >= 0
  );
}

function isWithinRateLimit(tabId) {
  const now = Date.now();
  const current = rateLimits.get(tabId);

  if (!current || now - current.start >= RATE_WINDOW_MS) {
    rateLimits.set(tabId, { start: now, count: 1 });
    return true;
  }

  if (current.count >= MAX_EVENTS_PER_WINDOW) {
    return false;
  }

  current.count += 1;
  return true;
}


function sanitizeFilename(filename, trustedOrigin) {
  if (!filename || !trustedOrigin) {
    return "";
  }

  try {
    const url = new URL(filename, trustedOrigin);
    if (!["http:", "https:"].includes(url.protocol)) {
      return "";
    }

    // Cross-origin request sources are useful for debugging. Keep only
    // the origin; never retain paths, queries, fragments, or credentials.
    return url.origin;
  } catch {
    return "";
  }
}



async function storeEvent(event, tabId, trustedOrigin) {
  const existing = await chrome.storage.local.get(HISTORY_KEY);
  const history = Array.isArray(existing[HISTORY_KEY])
    ? existing[HISTORY_KEY]
    : [];

  const safeEvent = {
    id: crypto.randomUUID(),
    type: event.type,
    message: redactSensitiveText(event.message),
    filename: sanitizeFilename(event.filename, trustedOrigin),
    line: event.line,
    column: event.column,
    timestamp: event.timestamp,
    origin: trustedOrigin,
    tabId,
    receivedAt: Date.now()
  };

  // Skip an equivalent event from the same tab if it was
  // recorded within the deduplication window.
  const duplicate = history.some((saved) => {
    return (
      saved.tabId === safeEvent.tabId &&
      saved.type === safeEvent.type &&
      saved.message === safeEvent.message &&
      saved.filename === safeEvent.filename &&
      saved.line === safeEvent.line &&
      saved.column === safeEvent.column &&
      safeEvent.receivedAt - saved.receivedAt < DEDUPE_WINDOW_MS &&
      safeEvent.receivedAt >= saved.receivedAt
    );
  });

  if (duplicate) {
    return { saved: false, reason: "duplicate" };
  }

  history.push(safeEvent);

  await chrome.storage.local.set({
    [HISTORY_KEY]: history.slice(-MAX_HISTORY)
  });

  return { saved: true };
}


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "DEVPULSE_INGEST_EVENT") {
    return;
  }

  // Only accept messages originating from this extension's content scripts.
  // Page messages are still forgeable, so validate and limit them.
  if (
    sender.id !== chrome.runtime.id ||
    !sender.tab ||
    typeof sender.tab.id !== "number" ||
    typeof sender.url !== "string"
  ) {
    sendResponse({ ok: false });
    return;
  }

  let trustedOrigin;

  try {
    const senderUrl = new URL(sender.url);

    if (!["http:", "https:"].includes(senderUrl.protocol)) {
      sendResponse({ ok: false });
      return;
    }

    trustedOrigin = senderUrl.origin;
  } catch {
    sendResponse({ ok: false });
    return;
  }

  if (!isValidEvent(message.event)) {
    sendResponse({ ok: false });
    return;
  }

  const tabId = sender.tab.id;

  if (!isWithinRateLimit(tabId)) {
    sendResponse({ ok: false, reason: "rate_limited" });
    return;
  }

  writeQueue = writeQueue
  .catch(() => {})
  .then(() => storeEvent(message.event, tabId, trustedOrigin));

  writeQueue.then(
    () => sendResponse({ ok: true }),
    (error) => {
      console.error("DevPulse: Could not save diagnostic event.", error);
      sendResponse({ ok: false });
    }
  );

  return true;
});
