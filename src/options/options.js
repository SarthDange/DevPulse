
(() => {
  const KEY_NAME = "devpulse_gemini_api_key";
  const AI_ENABLED_KEY = "devpulse_ai_enabled";
  const GEMINI_ORIGIN = "https://generativelanguage.googleapis.com/*";

  const input = document.getElementById("api-key");
  const saveButton = document.getElementById("save-key");
  const deleteButton = document.getElementById("delete-key");
  const keyStatus = document.getElementById("key-status");
  const status = document.getElementById("status");
  const enableCheckbox = document.getElementById("enable-ai");
  const aiStatus = document.getElementById("ai-status");

  let hasSavedKey = false;

  async function refreshKeyStatus() {
    try {
      const result = await chrome.storage.local.get(KEY_NAME);

      hasSavedKey =
        typeof result[KEY_NAME] === "string" &&
        result[KEY_NAME].length > 0;

      // Never load or display the saved key itself.
      input.value = "";
      keyStatus.textContent = hasSavedKey
        ? "A Gemini API key is saved."
        : "No Gemini API key is saved.";
    } catch {
      hasSavedKey = false;
      keyStatus.textContent = "Could not check saved-key status.";
    }
  }

  async function disableAI(revokePermission = true) {
    enableCheckbox.checked = false;

    try {
      await chrome.storage.local.set({
        [AI_ENABLED_KEY]: false
      });

      if (revokePermission) {
        await chrome.permissions.remove({
          origins: [GEMINI_ORIGIN]
        });
      }

      aiStatus.textContent = "AI analysis is disabled.";
    } catch {
      aiStatus.textContent =
        "AI could not be fully disabled. Check extension permissions.";
    }
  }

  saveButton.addEventListener("click", async () => {
    const key = input.value.trim();

    if (!key) {
      status.textContent = "Enter a key before saving.";
      return;
    }

    if (key.length > 500) {
      status.textContent =
        "The key is longer than expected. Check it and try again.";
      return;
    }

    try {
      await chrome.storage.local.set({
        [KEY_NAME]: key
      });

      input.value = "";
      status.textContent =
        "API key saved locally. It has not been tested or sent to Gemini.";

      await refreshKeyStatus();
    } catch {
      status.textContent = "Could not save the API key.";
    }
  });

  deleteButton.addEventListener("click", async () => {
    try {
      await chrome.storage.local.remove(KEY_NAME);
      await disableAI(true);

      input.value = "";
      status.textContent = "Saved API key deleted.";
      await refreshKeyStatus();
    } catch {
      status.textContent = "Could not delete the saved API key.";
    }
  });

  enableCheckbox.addEventListener("change", async () => {
    if (!enableCheckbox.checked) {
      await disableAI(true);
      return;
    }

    if (!hasSavedKey) {
      enableCheckbox.checked = false;
      aiStatus.textContent =
        "Save a Gemini API key before enabling AI analysis.";
      return;
    }

    const consent = window.confirm(
      "Enable optional Gemini AI analysis?\n\n" +
      "When you explicitly request an analysis, DevPulse will send " +
      "a selected, sanitized diagnostic summary to Google Gemini. " +
      "Do not include sensitive information. Your API key is stored " +
      "locally in this browser profile, not in encrypted secret storage.\n\n" +
      "Continue?"
    );

    if (!consent) {
      enableCheckbox.checked = false;
      aiStatus.textContent = "AI analysis remains disabled.";
      return;
    }

    try {
      // Request permission directly from this checkbox interaction.
      const granted = await chrome.permissions.request({
        origins: [GEMINI_ORIGIN]
      });

      if (!granted) {
        enableCheckbox.checked = false;
        await chrome.storage.local.set({
          [AI_ENABLED_KEY]: false
        });
        aiStatus.textContent =
          "Gemini permission was not granted. AI analysis remains disabled.";
        return;
      }

      await chrome.storage.local.set({
        [AI_ENABLED_KEY]: true
      });

      aiStatus.textContent =
        "AI enabled. No diagnostic data is sent until you explicitly request an analysis.";
    } catch {
      enableCheckbox.checked = false;

      try {
        await chrome.storage.local.set({
          [AI_ENABLED_KEY]: false
        });
      } catch {
        // Keep the UI disabled even if storage fails.
      }

      aiStatus.textContent =
        "Could not enable AI. Check the extension and permission settings.";
    }
  });

  async function initialize() {
    enableCheckbox.disabled = true;

    await refreshKeyStatus();

    try {
      const result = await chrome.storage.local.get(AI_ENABLED_KEY);
      const permissionGranted = await chrome.permissions.contains({
        origins: [GEMINI_ORIGIN]
      });

      const shouldEnable =
        hasSavedKey &&
        result[AI_ENABLED_KEY] === true &&
        permissionGranted;

      enableCheckbox.checked = shouldEnable;

      if (result[AI_ENABLED_KEY] === true && !shouldEnable) {
        await chrome.storage.local.set({
          [AI_ENABLED_KEY]: false
        });
      }

      aiStatus.textContent = shouldEnable
        ? "AI enabled. Analysis is still only sent when you explicitly request it."
        : "AI analysis is disabled.";
    } catch {
      enableCheckbox.checked = false;
      aiStatus.textContent =
        "Could not verify AI settings. AI analysis is disabled.";
    } finally {
      enableCheckbox.disabled = false;
    }
  }

  initialize();
})();
