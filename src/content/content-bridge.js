
/**
 * DevPulse — Content Bridge
 * Receives page-world diagnostic messages and forwards
 * validated, bounded data to the extension service worker.
 *
 * Page messages are untrusted. A webpage can forge them.
 */

(() => {
  if (globalThis.__DEVPULSE_BRIDGE_INSTALLED__) {
    return;
  }

  globalThis.__DEVPULSE_BRIDGE_INSTALLED__ = true;

  const MAX_MESSAGE_LENGTH = 2000;
  const MAX_FILENAME_LENGTH = 1000;

  const ALLOWED_TYPES = new Set([
  "javascript_error",
  "unhandled_rejection",
  "http_error",
  "network_error"
]);

  window.addEventListener("message", (message) => {
    if (message.source !== window) {
      return;
    }

    const data = message.data;

    if (
      !data ||
      data.source !== "DEVPULSE_PAGE_MONITOR" ||
      data.type !== "DIAGNOSTIC_EVENT"
    ) {
      return;
    }

    const payload = data.payload;

    if (
      !payload ||
      typeof payload !== "object" ||
      !ALLOWED_TYPES.has(payload.type) ||
      typeof payload.message !== "string" ||
      typeof payload.timestamp !== "number" ||
      !Number.isFinite(payload.timestamp)
    ) {
      return;
    }

    // Build a fresh, bounded object. Never forward arbitrary page data.
    const event = {
      id: typeof payload.id === "string"
        ? payload.id.slice(0, 100)
        : "",
      type: payload.type,
      message: payload.message.slice(0, MAX_MESSAGE_LENGTH),
      filename: typeof payload.filename === "string"
        ? payload.filename.slice(0, MAX_FILENAME_LENGTH)
        : "",
      line: Number.isSafeInteger(payload.line) &&
        payload.line >= 0 ? payload.line : 0,
      column: Number.isSafeInteger(payload.column) &&
        payload.column >= 0 ? payload.column : 0,
      timestamp: payload.timestamp
    };

    chrome.runtime.sendMessage({
      type: "DEVPULSE_INGEST_EVENT",
      event
    }).catch((error) => {
      console.warn("DevPulse: Could not forward diagnostic event.", error);
    });
  });

  console.info("DevPulse: Content bridge initialized.");
})();
