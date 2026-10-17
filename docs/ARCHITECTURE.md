# DevPulse Architecture

## Design principles
1. Local-first: captured events remain in the browser unless the user explicitly requests AI diagnosis.
2. Least privilege: inject into the current tab after a deliberate user action.
3. Separate responsibilities: page observation, extension messaging, UI, and AI integration are distinct modules.
4. Fail safely: diagnosis failure must never hide the original event.
5. Be honest about coverage: page-world hooks cannot observe every browser, worker, iframe, or extension event.

## Planned event flow

```text
User clicks DevPulse
        |
        v
Background service worker
  - checks active tab
  - injects page monitor + content bridge
        |
        v
Page main world
  - window error events
  - unhandled promise rejections
  - fetch/XHR observations
        |
        v
Content script / bridge
  - validates message shape
  - sanitizes and bounds fields
        |
        v
Service worker
  - deduplicates events
  - persists bounded history
  - forwards events to side panel
        |
        v
Side panel
  - event timeline
  - raw details
  - optional AI diagnosis
```

## Module responsibilities
- `src/background/service-worker.js`: extension lifecycle, active-tab injection, event routing, persistence coordination.
- `src/page/page-monitor.js`: main-world instrumentation. Must not access extension APIs or secrets.
- `src/content/content-bridge.js`: receives page messages, validates origin/source and shape, forwards safe events.
- `src/shared/schema.js`: event shape, limits, and validation helpers shared by extension contexts where appropriate.
- `src/shared/sanitize.js`: URL and message sanitization.
- `src/shared/fingerprint.js`: stable event fingerprinting for deduplication.
- `src/sidepanel/`: event timeline and detail view.
- `src/options/`: user-provided Gemini key and privacy/settings controls.
- `src/ai/gemini-client.js`: API request construction, timeout, response parsing and schema validation.

## Important browser boundary
A page-world script cannot directly call `chrome.runtime` APIs. A bridge is needed. Any page can send crafted `window.postMessage` messages, so the content bridge must treat every message as untrusted and validate it. `event.source === window` alone is not authentication.

## Storage plan
Use `chrome.storage.local` for settings and a bounded diagnostic history. The Gemini key may be stored there only with a clear warning that this is not encrypted secret storage. Provide a delete-key action and never log the key. Consider `chrome.storage.local.setAccessLevel({accessLevel: "TRUSTED_CONTEXTS"})` where supported to restrict access from content scripts.

## Out of scope for first prototype
- Cloud accounts or sync
- Team collaboration
- Automatic code fixes or execution
- Collecting request/response bodies
- Background monitoring of every site without user action
