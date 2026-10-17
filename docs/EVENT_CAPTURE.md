# Event Capture

## First-version targets
- Uncaught JavaScript exceptions via `window` error events.
- Unhandled promise rejections via `unhandledrejection`.
- `fetch()` HTTP responses with non-OK status, plus rejected promises.
- XHR completion statuses and `error` / `timeout` events.

## Limitations
- `fetch()` does not reject merely because the server returned 404 or 500; inspect `response.status` / `response.ok`.
- CORS failures may appear as generic network failures. Do not claim the precise cause unless evidence supports it.
- Hooks may miss requests made before injection, from workers, in other frames, or through APIs not instrumented.
- Instrumentation must preserve the original return values, promise behavior, `this` binding, and XHR behavior as closely as possible.
- Do not read request/response bodies or sensitive headers in v1.

## Event shape (proposed)
```json
{
  "id": "generated-event-id",
  "type": "runtime_error | unhandled_rejection | http_error | network_error",
  "timestamp": 0,
  "pageUrl": "sanitized URL",
  "message": "bounded text",
  "stack": "bounded text",
  "request": {
    "method": "GET",
    "url": "sanitized URL",
    "status": 404
  }
}
```

All fields are untrusted input. Validate types, lengths, event type, and optional request fields before storage or display.
