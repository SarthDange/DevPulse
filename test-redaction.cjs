
const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const source = fs.readFileSync(
  "src/background/service-worker.js",
  "utf8"
);

// Extract the real helper and its size limit from the service worker.
const match = source.match(
  /function redactSensitiveText\(value\)\s*\{[\s\S]*?\n\}/
);

assert.ok(match, "Could not find redactSensitiveText()");

const maxLengthMatch = source.match(
  /const MAX_MESSAGE_LENGTH\s*=\s*(\d+)\s*;/
);

assert.ok(maxLengthMatch, "Could not find MAX_MESSAGE_LENGTH");

const sandbox = {
  MAX_MESSAGE_LENGTH: Number(maxLengthMatch[1])
};

vm.createContext(sandbox);
vm.runInContext(`${match[0]}; globalThis.testRedact = redactSensitiveText;`, sandbox);

const tests = [
  ["API key", "api_key=MY_TEST_SECRET_123", "api_key=[REDACTED]"],
  ["Quoted password", 'password: "my test password"', "password=[REDACTED]"],
  ["Client secret", "client_secret=abc123", "client_secret=[REDACTED]"],
  ["Authorization", "Authorization: Bearer abc123xyz", "Authorization=[REDACTED]"],
  ["Token", "token: abc123", "token=[REDACTED]"],
  ["Ordinary message", "Request failed with an unknown error", "Request failed with an unknown error"]
];

for (const [name, input, expected] of tests) {
  const actual = sandbox.testRedact(input);
  assert.equal(actual, expected, `${name} test failed`);
  console.log(`PASS: ${name}`);
}

console.log("\nAll redaction tests passed.");
