# DevPulse

DevPulse is a Manifest V3 Chrome extension prototype for capturing common browser-side JavaScript errors and network failures, displaying them in a side panel, and optionally requesting an AI-assisted diagnosis.

> **Status:** Working prototype. Core capture, history, optional Gemini analysis, settings, search/filter, copy, and JSON export are implemented; final regression and security testing is still required.

## Project goals
- Capture uncaught JavaScript errors and unhandled promise rejections.
- Observe selected `fetch()` and `XMLHttpRequest` outcomes where technically possible.
- Show events in a Chrome Side Panel.
- Optionally request a structured Gemini diagnosis.
- Preserve raw diagnostic information when AI is unavailable.
- Minimize permissions and data collection.

## Important security notes
- `chrome.storage.local` is extension-scoped storage, **not an encrypted secret vault**. A user-provided API key avoids publishing your own key, but it is still stored locally in readable extension storage. Explain this to users and provide a delete-key control.
- Never promise complete capture of all browser errors or exact identification of every CORS cause.
- Do not collect cookies, authorization headers, request/response bodies, or full page content by default.
- Treat page-derived messages and AI output as untrusted data.
- A client-side 3-second cooldown is useful UX, but it is not a security boundary and cannot guarantee a provider quota. Add server-side limits if a shared backend is introduced. With a bring-your-own-key architecture, enforce local limits and rely on provider quotas for that user's key.

## Architecture
See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Documentation
- [Frontend / side panel](docs/FRONTEND.md)
- [Event capture](docs/EVENT_CAPTURE.md)
- [Privacy and security](docs/PRIVACY_SECURITY.md)
- [AI integration](docs/AI_INTEGRATION.md)
- [Rate limiting and reliability](docs/RATE_LIMITING.md)
- [Development workflow](docs/DEVELOPMENT.md)

## Initial permissions
The manifest requests `activeTab`, `scripting`, `storage`, and `sidePanel`. The extension should inject monitoring only after a user action on the active tab. Review the permissions again before publishing.

## Current implementation status
- [x] Manifest and extension loading smoke test
- [x] Capture uncaught JavaScript errors and unhandled promise rejections
- [x] Observe fetch and XHR HTTP/network outcomes where technically possible
- [x] Validate incoming event messages and bound event storage
- [x] Sanitize stored messages and origins; suppress recent duplicates
- [x] Side-panel event timeline with search and type filters
- [x] Copy event summary and export diagnostic history as JSON
- [x] Clear history with confirmation
- [x] User-configured Gemini key, opt-in permission, and structured AI analysis
- [x] Validate AI response schema and render untrusted text safely
- [x] Local redaction and Gemini-client tests
- [ ] Full final regression, permission, and privacy test pass

## Local development
1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this project folder.
4. Reload the extension after manifest changes.

This scaffold does not yet implement the listed functionality.
