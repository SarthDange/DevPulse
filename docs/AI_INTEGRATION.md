# AI Integration: Gemini

## Planned behavior
- AI diagnosis is user-triggered and optional.
- Send only the selected, sanitized event; do not send the entire event history.
- Request JSON output with fields: `category`, `summary`, `cause`, `fixes`, `confidence`, and `missing_info`.
- Validate the response after parsing. Treat every field as untrusted text.
- Preserve raw event details if the API is unavailable or returns malformed output.

## API key
The user provides their own Gemini API key in the Options page. Store it in `chrome.storage.local` only after warning that this storage is not encrypted secret storage. Do not include any key in the repository or logs. Provide a remove-key control.

## Request safeguards
- Use the official Gemini API endpoint and current supported model configuration.
- Set input/output limits and a timeout.
- Never send cookies, auth headers, request bodies, full page content, or unredacted query parameters.
- Do not allow the model to call tools, run code, or apply fixes.
- Handle invalid key, quota exceeded, network timeout, non-success HTTP status, and malformed JSON separately.
- Verify current model availability and provider terms when implementing; model names and free-tier terms can change.

## Response schema
```json
{
  "category": "JavaScript | HTTP | Network/CORS | Unknown",
  "summary": "Short one-sentence summary",
  "cause": "Evidence-based likely cause",
  "fixes": ["Actionable step"],
  "confidence": "High | Medium | Low",
  "missing_info": "Missing evidence, or empty string"
}
```
