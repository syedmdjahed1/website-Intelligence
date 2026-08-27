/**
 * Popup/extension-page logger (ES module).
 */

const DEV = true;

export function log(scope, message, detail) {
  if (!DEV) return;
  if (detail !== undefined) {
    console.log(`[WI:${scope}]`, message, detail);
  } else {
    console.log(`[WI:${scope}]`, message);
  }
}

export function logError(scope, message, err) {
  console.error(`[WI:${scope}]`, message, err || "");
}
