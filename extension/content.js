// content.js – injected into every page by the browser (see manifest.json).
//
// Responsibility: listen for messages from popup.js, extract visible page
// text, and send it back.  No model calls happen here.

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action !== "getPageText") return;

  // document.body.innerText gives the rendered, visible text –
  // it skips <script>, <style>, and hidden elements automatically.
  const text = document.body?.innerText?.trim() ?? "";

  sendResponse({ text });

  // Return true so Chrome keeps the message channel open long enough
  // for the async sendResponse above to be delivered.
  return true;
});
