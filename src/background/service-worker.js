/**
 * Website Intelligence — background service worker (Manifest V3)
 */

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install" || details.reason === "update") {
    console.log("[Website Intelligence] Extension ready (v0.8.0)", details.reason);
  }
});
