# Frontend and Side Panel

## Goals
- Compact developer-focused UI; visual theme will be selected later.
- Show a clear event count and a list of recent events.
- Separate event summary from raw details and AI diagnosis.
- Keep raw event data available when AI is disabled, offline, or rate-limited.

## Planned UI states
1. Empty: ask the user to open a page and start monitoring.
2. Monitoring: show recent captured events.
3. Event selected: show category, timestamp, URL (sanitized), message, stack trace and status.
4. Diagnosing: show progress without blocking the event list.
5. Diagnosis ready: render validated JSON fields.
6. Failure: show a concise error and retain raw event details.
7. Rate limited: explain when another request can be made.
8. Settings missing: ask user to configure their own Gemini API key.

## Accessibility and safety
- Use semantic HTML and keyboard-accessible controls.
- Render page-derived and AI-generated strings with `textContent`; do not inject them with `innerHTML`.
- Do not render arbitrary Markdown or HTML from AI output.
- Truncate long fields in list rows, but allow users to inspect bounded raw details.
- Provide Clear history and Delete API key controls.
