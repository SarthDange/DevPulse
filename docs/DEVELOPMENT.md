# Development Workflow

## Requirements
- Google Chrome 114+ (Side Panel API baseline)
- A code editor such as VS Code
- A Gemini API key only when AI integration is implemented

## Load unpacked
1. Open `chrome://extensions`.
2. Turn on Developer mode.
3. Select **Load unpacked**.
4. Choose the `DevPulse` project folder.
5. Reload the extension after manifest changes.

## Working rules
- Build one module at a time.
- Verify extension loading before implementing event capture.
- Use a local test page with intentionally triggered errors and HTTP responses.
- Never test using real credentials or production user data.
- Keep secrets out of Git history. If a key is accidentally committed, revoke it immediately; deleting the file in a later commit is not enough.
- Keep the documentation aligned with actual behavior. Do not claim a feature is implemented before it is tested.
