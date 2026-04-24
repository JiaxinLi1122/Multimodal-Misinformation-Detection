// popup.js – runs inside the extension popup window.
//
// Flow:
//   1. User clicks "Analyse Current Page"
//   2. Identify the active browser tab
//   3. Ask content.js for { text, imageUrl }
//   4. POST { text, image_url } to the backend at /analyze
//   5. Render the returned { risk, reason, confidence, explanations, used_image }

const BACKEND_URL = "http://localhost:8000/analyze";

const analyseBtn      = document.getElementById("analyseBtn");
const resultDiv       = document.getElementById("result");
const statusText      = document.getElementById("status-text");
const analysisOutput  = document.getElementById("analysis-output");
const riskBadge       = document.getElementById("risk-badge");
const confidenceLine  = document.getElementById("confidence-line");
const explanationsList = document.getElementById("explanations-list");
const metaLine        = document.getElementById("meta-line");

function showStatus(msg) {
  analysisOutput.style.display = "none";
  statusText.style.display = "";
  statusText.textContent = msg;
  resultDiv.className = "";
  resultDiv.style.background = "";
}

function renderResult({ risk, confidence, explanations, used_image }, charCount, imageUrl) {
  // Apply risk-level class to result box (controls background colour)
  resultDiv.className = risk;

  // Hide plain text, show structured output
  statusText.style.display = "none";
  analysisOutput.style.display = "";

  // Big risk label
  riskBadge.textContent = `${risk} RISK`;
  riskBadge.className = risk;

  // Confidence percentage
  const pct = Math.round(confidence * 100);
  confidenceLine.textContent = `${pct}% probability of misinformation`;

  // Bullet explanations
  explanationsList.innerHTML = "";
  for (const point of (explanations ?? [])) {
    const li = document.createElement("li");
    li.textContent = point;
    explanationsList.appendChild(li);
  }

  // Meta info line
  const imageUsedNote = used_image ? "image + text" : "text only";
  const imageDetected = imageUrl ? "image detected" : "no image";
  metaLine.textContent =
    `Model input: ${imageUsedNote} · ${imageDetected} · ${charCount.toLocaleString()} chars`;
}

function renderError(message) {
  showStatus(`Error: ${message}`);
}

analyseBtn.addEventListener("click", async () => {
  analyseBtn.disabled = true;
  showStatus("Extracting page content…");

  try {
    // Step 1 – identify the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      renderError("Could not identify the active tab.");
      return;
    }

    // Step 2 – ask content.js for text + the largest visible image URL
    const pageResponse = await chrome.tabs.sendMessage(tab.id, { action: "getPageText" });

    if (!pageResponse?.text) {
      renderError("No text received from the page.");
      return;
    }

    const { text, imageUrl } = pageResponse;

    showStatus("Analyzing…");

    // Step 3 – POST text and image_url to the backend
    let apiResponse;
    try {
      const res = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, image_url: imageUrl ?? null }),
      });

      if (!res.ok) {
        renderError(`Backend returned status ${res.status}.`);
        return;
      }

      apiResponse = await res.json();
    } catch (_networkErr) {
      renderError("Failed to connect to backend. Is it running on port 8000?");
      return;
    }

    // Step 4 – display the result
    renderResult(apiResponse, text.length, imageUrl);

  } catch (err) {
    renderError(err.message);
  } finally {
    analyseBtn.disabled = false;
  }
});
