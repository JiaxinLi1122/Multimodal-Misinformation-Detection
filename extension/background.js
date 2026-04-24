// background.js – service worker that handles auto-analysis triggered by content.js.
//
// Flow:
//   content.js  →  { action: "autoAnalyze", text }  →  background
//   background captures screenshot, POSTs to /analyze, sends result back to tab.

const BACKEND_URL = "http://localhost:8000/analyze";

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.action !== "autoAnalyze") return;

  const tabId = sender.tab?.id;
  if (!tabId) return;

  runAnalysis(tabId, message.text);
});

async function runAnalysis(tabId, text) {
  let imageData = null;
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: "jpeg", quality: 70 });
    imageData = dataUrl.replace(/^data:image\/\w+;base64,/, "");
  } catch (e) {
    console.warn("[MMD] Screenshot capture failed:", e.message);
  }

  let result, error;
  try {
    const res = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, image_data: imageData }),
    });
    if (!res.ok) throw new Error(`Backend returned ${res.status}`);
    result = await res.json();

    await chrome.storage.local.set({
      [`tab_${tabId}`]: {
        result,
        charCount: text.length,
        imageCaptured: !!imageData,
        ts: Date.now(),
      },
    });
  } catch (e) {
    error = e.message;
  }

  try {
    await chrome.tabs.sendMessage(tabId, { action: "showResult", result, error });
  } catch (e) {
    console.warn("[MMD] Could not deliver result to tab:", e.message);
  }
}
