// content.js – injected into every page by the browser (see manifest.json).
//
// On load: auto-extracts page text, shows a floating "Analyzing…" badge, and
// asks the background service worker to run the full analysis.  Results are
// received via a message and rendered as a floating overlay on the page.
//
// Manual fallback: popup.js can still send { action: "getPageText" } to
// trigger the popup-driven analysis flow.

// ── Message listener ──────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Popup requests page content for its own analysis flow
  if (message.action === "getPageText") {
    sendResponse({ text: document.body?.innerText?.trim() ?? "", imageUrl: findMainImage() });
    return true;
  }

  // Background delivers the auto-analysis result
  if (message.action === "showResult") {
    removeFloatingIndicator();
    showFloatingResult(message.result, message.error);
  }
});

// ── Auto-analyze on load ──────────────────────────────────────────────────

function autoAnalyze() {
  const text = document.body?.innerText?.trim() ?? "";
  if (!text) return;

  showFloatingIndicator("Analyzing page…");

  try {
    chrome.runtime.sendMessage({ action: "autoAnalyze", text });
  } catch (e) {
    // Extension context may be invalidated on fast navigations
    removeFloatingIndicator();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", autoAnalyze);
} else {
  autoAnalyze();
}

// ── Floating indicator ────────────────────────────────────────────────────

function showFloatingIndicator(msg) {
  removeFloatingIndicator();
  const el = document.createElement("div");
  el.id = "__mmd_indicator__";
  Object.assign(el.style, {
    position:     "fixed",
    bottom:       "20px",
    right:        "20px",
    background:   "rgba(79,70,229,0.93)",
    color:        "#fff",
    padding:      "9px 15px",
    borderRadius: "8px",
    fontFamily:   "sans-serif",
    fontSize:     "13px",
    fontWeight:   "500",
    zIndex:       "2147483647",
    boxShadow:    "0 4px 14px rgba(0,0,0,0.28)",
    pointerEvents:"none",
    transition:   "opacity 0.2s",
  });
  el.textContent = msg;
  document.body?.appendChild(el);
}

function removeFloatingIndicator() {
  document.getElementById("__mmd_indicator__")?.remove();
}

// ── Floating result overlay ───────────────────────────────────────────────

const COLOR = {
  HIGH:   { bg: "#fee2e2", border: "#b91c1c", text: "#b91c1c" },
  MEDIUM: { bg: "#fef9c3", border: "#92400e", text: "#92400e" },
  LOW:    { bg: "#dcfce7", border: "#166534", text: "#166534" },
  _:      { bg: "#f3f4f6", border: "#9ca3af", text: "#374151" },
};

function showFloatingResult(result, error) {
  document.getElementById("__mmd_result__")?.remove();

  const el = document.createElement("div");
  el.id = "__mmd_result__";
  Object.assign(el.style, {
    position:     "fixed",
    bottom:       "20px",
    right:        "20px",
    borderRadius: "8px",
    fontFamily:   "sans-serif",
    fontSize:     "13px",
    zIndex:       "2147483647",
    boxShadow:    "0 4px 14px rgba(0,0,0,0.28)",
    maxWidth:     "290px",
    minWidth:     "210px",
    overflow:     "hidden",
    padding:      "12px 32px 12px 14px",
  });

  if (error || !result) {
    const c = COLOR._;
    el.style.background  = c.bg;
    el.style.borderLeft  = `4px solid ${c.border}`;
    el.innerHTML = `
      <div style="font-weight:700;color:${c.text};margin-bottom:4px">Analysis error</div>
      <div style="font-size:12px;color:#6b7280">${error ?? "Unknown error"}</div>
    `;
  } else {
    const risk = result.risk || "UNKNOWN";
    const pct  = Math.round((result.confidence || 0) * 100);
    const c    = COLOR[risk] ?? COLOR._;
    const exps = (result.explanations || [])
      .map(e => `<li style="margin-bottom:3px">${e}</li>`)
      .join("");

    el.style.background = c.bg;
    el.style.borderLeft = `4px solid ${c.border}`;
    el.innerHTML = `
      <div style="font-weight:800;font-size:15px;color:${c.text};margin-bottom:2px">${risk} RISK</div>
      <div style="font-size:12px;color:#6b7280;margin-bottom:${exps ? "8px" : "0"}">${pct}% probability of misinformation</div>
      ${exps ? `<ul style="margin:0;padding-left:18px;font-size:12px;line-height:1.55">${exps}</ul>` : ""}
    `;
  }

  // Dismiss (×) button
  const btn = document.createElement("button");
  btn.textContent = "×";
  Object.assign(btn.style, {
    position:   "absolute",
    top:        "7px",
    right:      "9px",
    background: "transparent",
    border:     "none",
    cursor:     "pointer",
    fontSize:   "17px",
    lineHeight: "1",
    color:      "#9ca3af",
    padding:    "0",
  });
  btn.addEventListener("click", () => el.remove());
  el.appendChild(btn);

  document.body?.appendChild(el);
}

// ── Helpers ───────────────────────────────────────────────────────────────

function findMainImage() {
  const imgs = Array.from(document.querySelectorAll("img"));
  if (imgs.length === 0) return null;

  const visible = imgs.filter(img =>
    img.src &&
    !img.src.startsWith("data:") &&
    img.offsetParent !== null &&
    img.offsetWidth > 0 &&
    img.offsetHeight > 0
  );
  if (visible.length === 0) return null;

  return visible.reduce((best, img) =>
    img.offsetWidth * img.offsetHeight > best.offsetWidth * best.offsetHeight ? img : best
  ).src;
}
