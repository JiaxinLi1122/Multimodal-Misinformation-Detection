// popup.js – runs inside the extension popup window.
//
// Flow:
//   1. User clicks "Analyse Current Page"
//   2. Identify the active browser tab
//   3. Ask content.js for { text, imageUrl }
//   4. POST { text, image_url } to the backend at /analyze
//   5. Render the returned { risk, reason } plus image detection status

const BACKEND_URL = "http://localhost:8000/analyze";

const analyseBtn = document.getElementById("analyseBtn");
const resultDiv  = document.getElementById("result");

// Maps risk level to a background colour for the result box
const LEVEL_COLOUR = { HIGH: "#fee2e2", MEDIUM: "#fef9c3", LOW: "#dcfce7" };

// Render a successful API response in the result box
function renderResult({ risk, reason }, charCount, imageUrl) {
  resultDiv.style.background = LEVEL_COLOUR[risk] ?? "#f3f4f6";

  const imageLine = imageUrl ? "Image detected" : "No image found";

  resultDiv.textContent =
    `Risk level: ${risk}\n\n` +
    `${reason}\n\n` +
    `${imageLine}\n` +
    `(${charCount.toLocaleString()} characters sent to backend)`;
}

// Render an error message in the result box
function renderError(message) {
  resultDiv.style.background = "#f3f4f6";
  resultDiv.textContent = `Error: ${message}`;
}

analyseBtn.addEventListener("click", async () => {
  analyseBtn.disabled = true;
  resultDiv.style.background = "#f3f4f6";
  resultDiv.textContent = "Extracting page content…";

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

    // Step 3 – show loading state while the API call is in flight
    resultDiv.textContent = "Analyzing…";

    // Step 4 – POST text and image_url to the backend
    // The backend currently only uses text (image support is a TODO),
    // but we send image_url so it is ready when the backend is updated.
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
      // fetch() throws when the server is unreachable
      renderError("Failed to connect to backend. Is it running on port 8000?");
      return;
    }

    // Step 5 – display the result
    renderResult(apiResponse, text.length, imageUrl);

  } catch (err) {
    renderError(err.message);
  } finally {
    analyseBtn.disabled = false;
  }
});
