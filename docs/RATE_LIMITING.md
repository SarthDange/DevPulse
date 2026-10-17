# Rate Limiting and Reliability

## Client-side controls
- Apply a 3-second cooldown between AI diagnosis attempts.
- Disable the diagnosis button while a request is pending.
- Deduplicate repeated events using a stable fingerprint and a rolling time window.
- Bound the number of stored events and the maximum size of messages/stacks.
- Avoid automatic retries for invalid keys, quota errors, or other permanent failures.

## Important limitation
A client-side cooldown improves user experience and reduces accidental requests, but it is not a security boundary. A user can alter local extension state or call an API outside the UI. Since v1 uses a user-owned API key directly from the extension, the provider's own quota applies to that key. If a shared backend is introduced later, implement authoritative server-side per-user and global quotas.

## Failure behavior
- Timeout: show an error and retain the original event.
- Offline: keep local event details usable.
- HTTP 429 / quota exceeded: show a clear message; do not retry in a tight loop.
- Temporary server errors: at most a small number of retries with exponential backoff and jitter.
- Never retry a request indefinitely.
