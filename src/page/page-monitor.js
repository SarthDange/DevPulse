
/**
 * DevPulse — Page Monitor
 * Captures uncaught JavaScript errors and unhandled promise rejections.
 *
 * IMPORTANT:
 * This script runs in the page's MAIN world.
 * The webpage can interfere with it and forge similar messages.
 * All events must be treated as untrusted diagnostic hints.
 */

(() => {
  if (globalThis.__DEVPULSE_MONITOR_INSTALLED__) {
    return;
  }

  globalThis.__DEVPULSE_MONITOR_INSTALLED__ = true;

  const MAX_MESSAGE_LENGTH = 2000;
  const MAX_FILENAME_LENGTH = 1000;

  function limitString(value, maxLength) {
    if (typeof value !== "string") {
      return "";
    }

    return value.slice(0, maxLength);
  }

  function emitDiagnostic(event) {
    // This is a temporary bridge protocol for local testing.
    // The content bridge will validate these messages next.
    window.postMessage(
      {
        source: "DEVPULSE_PAGE_MONITOR",
        type: "DIAGNOSTIC_EVENT",
        payload: event
      },
      window.location.origin
    );
  }

  window.addEventListener("error", (event) => {
    const errorEvent = {
      id: crypto.randomUUID(),
      type: "javascript_error",
      message: limitString(event.message, MAX_MESSAGE_LENGTH),
      filename: limitString(event.filename, MAX_FILENAME_LENGTH),
      line: Number.isInteger(event.lineno) ? event.lineno : 0,
      column: Number.isInteger(event.colno) ? event.colno : 0,
      timestamp: Date.now(),
      origin: window.location.origin
    };

    emitDiagnostic(errorEvent);
  });

  window.addEventListener("unhandledrejection", (event) => {
    let reason = "";

    try {
      if (typeof event.reason === "string") {
        reason = event.reason;
      } else if (
        event.reason &&
        typeof event.reason.message === "string"
      ) {
        reason = event.reason.message;
      } else {
        reason = String(event.reason);
      }
    } catch {
      reason = "Unrecognized promise rejection reason";
    }

    const rejectionEvent = {
      id: crypto.randomUUID(),
      type: "unhandled_rejection",
      message: limitString(reason, MAX_MESSAGE_LENGTH),
      filename: "",
      line: 0,
      column: 0,
      timestamp: Date.now(),
      origin: window.location.origin
    };

    emitDiagnostic(rejectionEvent);
  });

  
  // ---- Network monitoring: fetch() ----

  function safeRequestOrigin(input) {
    try {
      let rawUrl = "";

      if (typeof input === "string") {
        rawUrl = input;
      } else if (input instanceof URL) {
        rawUrl = input.href;
      } else if (input instanceof Request) {
        rawUrl = input.url;
      }

      if (!rawUrl) {
        return "";
      }

      // Record the origin only; avoid paths, query strings and fragments.
      return new URL(rawUrl, window.location.href).origin;
    } catch {
      return "";
    }
  }

  const originalFetch = window.fetch;

  if (
    typeof originalFetch === "function" &&
    !originalFetch.__devPulseWrapped
  ) {
    const monitoredFetch = function (...args) {
      const requestOrigin = safeRequestOrigin(args[0]);

      return originalFetch.apply(this, args).then(
        (response) => {
          if (response.status >= 400) {
            emitDiagnostic({
              id: crypto.randomUUID(),
              type: "http_error",
              message: `fetch returned HTTP ${response.status}`,
              filename: requestOrigin,
              line: 0,
              column: 0,
              timestamp: Date.now(),
              origin: window.location.origin
            });
          }

          return response;
        },
        (error) => {
          emitDiagnostic({
            id: crypto.randomUUID(),
            type: "network_error",
            message: "fetch failed: no usable response received",
            filename: requestOrigin,
            line: 0,
            column: 0,
            timestamp: Date.now(),
            origin: window.location.origin
          });

          // Preserve the original fetch() rejection.
          throw error;
        }
      );
    };

    monitoredFetch.__devPulseWrapped = true;
    window.fetch = monitoredFetch;
  }

  // ---- Network monitoring: XMLHttpRequest ----

  const xhrState = new WeakMap();
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  if (!originalOpen.__devPulseWrapped) {
    const monitoredOpen = function (method, url, ...rest) {
      xhrState.set(this, {
        method: typeof method === "string" ? method.toUpperCase() : "UNKNOWN",
        origin: safeRequestOrigin(url)
      });

      return originalOpen.call(this, method, url, ...rest);
    };

    monitoredOpen.__devPulseWrapped = true;
    XMLHttpRequest.prototype.open = monitoredOpen;
  }

  if (!originalSend.__devPulseWrapped) {
    const monitoredSend = function (...args) {
      const xhr = this;
      const request = xhrState.get(xhr) || {
        method: "UNKNOWN",
        origin: ""
      };

      xhr.addEventListener("loadend", () => {
        if (xhr.status >= 400) {
          emitDiagnostic({
            id: crypto.randomUUID(),
            type: "http_error",
            message: `XHR ${request.method} returned HTTP ${xhr.status}`,
            filename: request.origin,
            line: 0,
            column: 0,
            timestamp: Date.now(),
            origin: window.location.origin
          });
        }
      }, { once: true });

      xhr.addEventListener("error", () => {
        emitDiagnostic({
          id: crypto.randomUUID(),
          type: "network_error",
          message: `XHR ${request.method} failed: no usable response received`,
          filename: request.origin,
          line: 0,
          column: 0,
          timestamp: Date.now(),
          origin: window.location.origin
        });
      }, { once: true });

      return originalSend.apply(xhr, args);
    };

    monitoredSend.__devPulseWrapped = true;
    XMLHttpRequest.prototype.send = monitoredSend;
  }

  console.info("DevPulse: Runtime and network error listeners installed.");

  console.info("DevPulse: Runtime error listeners installed.");
})();
