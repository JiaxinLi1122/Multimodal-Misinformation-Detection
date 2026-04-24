// content.js – injected into every page by the browser (see manifest.json).
//
// Responsibility: listen for messages from popup.js, extract visible page
// text and the largest visible image, then return both.

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action !== "getPageText") return;

  // --- Text ---
  // innerText skips <script>, <style>, and hidden elements automatically.
  const text = document.body?.innerText?.trim() ?? "";

  // --- Image ---
  // Pick the largest visible <img> on the page as the representative image.
  // "Visible" means: rendered in the layout (offsetParent !== null), has a
  // non-empty src, and occupies real screen area.
  const imageUrl = findMainImage();

  sendResponse({ text, imageUrl });

  // Return true keeps the message channel open for the async sendResponse.
  return true;
});


/**
 * Walk every <img> on the page and return the src of the largest visible one.
 * Falls back to null when no suitable image is found.
 *
 * @returns {string|null}
 */
function findMainImage() {
  const imgs = Array.from(document.querySelectorAll("img"));

  if (imgs.length === 0) return null;

  // Filter to images that are actually visible and have a usable src
  const visible = imgs.filter((img) => {
    if (!img.src) return false;                       // no source
    if (img.src.startsWith("data:")) return false;   // inline data URIs are too large to send
    if (img.offsetParent === null) return false;      // hidden via display:none or similar
    if (img.offsetWidth === 0 || img.offsetHeight === 0) return false; // zero-size
    return true;
  });

  if (visible.length === 0) return null;

  // Pick the image with the largest rendered area
  const largest = visible.reduce((best, img) => {
    const area    = img.offsetWidth * img.offsetHeight;
    const bestArea = best.offsetWidth * best.offsetHeight;
    return area > bestArea ? img : best;
  });

  return largest.src;
}
