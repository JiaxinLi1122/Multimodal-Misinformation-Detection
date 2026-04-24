// popup.js – runs inside the extension popup window.
//
// Flow:
//   1. User clicks "Analyse Current Page"
//   2. We find the active browser tab
//   3. We send a message to content.js running in that tab
//   4. content.js replies with the visible page text
//   5. analyseText() scores the text with local keyword rules
//   6. The result (risk level + explanation) is rendered in the popup

const analyseBtn = document.getElementById("analyseBtn");
const resultDiv  = document.getElementById("result");

// Keyword rules evaluated in priority order (first match wins).
// TODO: replace with a real model call once the Python backend is ready.
const RULES = [
  {
    level: "HIGH",
    keywords: ["shocking", "secret", "they don't want you to know", "wake up",
               "banned", "suppressed", "cover-up", "what they're hiding"],
    explanation: "Contains sensationalist or conspiracy-style language commonly associated with misinformation.",
  },
  {
    level: "LOW",
    keywords: ["study", "research", "according to", "published", "evidence",
               "journal", "scientists", "peer-reviewed"],
    explanation: "Contains language typical of evidence-based reporting.",
  },
];

// Returns { level, explanation } for the given page text.
function analyseText(text) {
  const lower = text.toLowerCase();

  for (const rule of RULES) {
    const hit = rule.keywords.find((kw) => lower.includes(kw));
    if (hit) {
      return {
        level: rule.level,
        matchedKeyword: hit,
        explanation: rule.explanation,
      };
    }
  }

  // No rule matched → medium risk
  return {
    level: "MEDIUM",
    matchedKeyword: null,
    explanation: "No strong indicators found. Manual review recommended.",
  };
}

// Maps risk level to a colour used in the result box
const LEVEL_COLOUR = { HIGH: "#fee2e2", MEDIUM: "#fef9c3", LOW: "#dcfce7" };

function renderResult({ level, matchedKeyword, explanation }, charCount) {
  resultDiv.style.background = LEVEL_COLOUR[level] ?? "#f3f4f6";

  const keywordLine = matchedKeyword
    ? `Triggered by: "${matchedKeyword}"\n`
    : "";

  resultDiv.textContent =
    `Risk level: ${level}\n` +
    `${keywordLine}` +
    `\n${explanation}\n` +
    `\n(${charCount.toLocaleString()} characters analysed – local rules only)`;
}

analyseBtn.addEventListener("click", async () => {
  analyseBtn.disabled = true;
  resultDiv.style.background = "#f3f4f6";
  resultDiv.textContent = "Extracting page text…";

  try {
    // Get the currently active tab in the current window
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      resultDiv.textContent = "Error: could not identify the active tab.";
      return;
    }

    // Ask content.js to collect visible text from the page
    const response = await chrome.tabs.sendMessage(tab.id, { action: "getPageText" });

    if (!response?.text) {
      resultDiv.textContent = "Error: no text received from the page.";
      return;
    }

    const result = analyseText(response.text);
    renderResult(result, response.text.length);

  } catch (err) {
    resultDiv.textContent = `Error: ${err.message}`;
  } finally {
    analyseBtn.disabled = false;
  }
});
