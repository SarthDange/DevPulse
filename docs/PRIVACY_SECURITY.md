# Privacy and Security Requirements

## Data minimization
- Collect only diagnostic metadata needed for the current feature.
- Do not collect cookies, authorization headers, request/response bodies, full page content, or browsing history.
- Remove URL query strings and fragments by default; redact common token patterns and sensitive values in messages and stacks.
- Explain that redaction is best-effort and may not catch every secret.
- Monitoring should start only after a clear user action.

## AI disclosure
Before sending a diagnostic to Gemini, explain that the selected event (after sanitization) is sent to Google's API. Make AI diagnosis optional. Link to the provider's current terms and privacy documentation in the UI/policy.

## API key handling
- Users supply their own key; never commit keys to source control.
- `chrome.storage.local` is not encrypted vault storage. Treat the key as a locally stored secret that may be exposed to someone with access to the browser profile or machine.
- Never display the full key after saving; never log it; provide delete/replace controls.
- Consider limiting storage access to trusted extension contexts.
- Do not transmit the key anywhere except the intended Gemini API endpoint.

## Message and rendering safety
- Validate every message crossing from the page world.
- Enforce size and type limits.
- Use `textContent` for untrusted strings.
- Never execute code from a page, error, or model response.
- Avoid broad permissions and remote executable code.

## Release checklist
- Privacy policy matches actual behavior.
- Chrome Web Store disclosures match data collection and transfers.
- Provider terms and retention settings are reviewed before release.
- Security contact and incident-handling steps exist before public launch.
- Test with synthetic secrets to verify redaction.
