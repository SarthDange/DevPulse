
const assert = require("node:assert/strict");

require("./src/ai/gemini-client.js");

const gemini = globalThis.DevPulseGemini;

assert.ok(gemini, "Gemini client did not initialize");

// Test 1: secrets are redacted in diagnostic messages.
const safe = gemini.prepareDiagnostic({
  type: "http_error",
  message: "Authorization: Bearer abc123xyz",
  origin: "https://app.example/private?token=SECRET",
  filename: "https://api.example/v1?api_key=SECRET",
  line: 0,
  column: 0
});

assert.equal(safe.message, "Authorization=[REDACTED]");
console.log("PASS: authorization secret redacted");

// Test 2: URLs are reduced to their origins.
assert.equal(safe.page_origin, "https://app.example");
assert.equal(safe.source_origin, "https://api.example");
console.log("PASS: URLs contain origins only");

// Test 3: sensitive fields are not included.
assert.deepEqual(
  Object.keys(safe).sort(),
  ["category", "column", "line", "message", "page_origin", "source_origin"].sort()
);
console.log("PASS: diagnostic payload contains only allowed fields");

// Test 4: unsupported event types are rejected.
assert.throws(() => gemini.prepareDiagnostic({
  type: "unknown_event",
  message: "test"
}));
console.log("PASS: unsupported event type rejected");

// Test 5: a valid AI response is accepted.
const validResult = gemini.validateAnalysis({
  category: "HTTP error",
  summary: "The server returned a 404 response.",
  cause: "The requested resource may not exist.",
  fixes: ["Check the endpoint URL."],
  confidence: "medium",
  missing_info: []
});

assert.equal(validResult.confidence, "medium");
console.log("PASS: valid analysis accepted");

// Test 6: unexpected AI response fields are rejected.
assert.throws(() => gemini.validateAnalysis({
  category: "HTTP error",
  summary: "Test",
  cause: "Test",
  fixes: [],
  confidence: "low",
  missing_info: [],
  extra_data: "unexpected"
}));
console.log("PASS: unexpected response fields rejected");

console.log("\nAll Gemini client tests passed. No network request was made.");
