/**
 * Development logger for injected collectors.
 * Production builds can flip WI.LOG_ENABLED to false later.
 */
var WI = WI || {};

WI.LOG_ENABLED = true;

WI.log = function log(scope, message, detail) {
  if (!WI.LOG_ENABLED) return;
  if (detail !== undefined) {
    console.log("[WI:" + scope + "]", message, detail);
  } else {
    console.log("[WI:" + scope + "]", message);
  }
};

WI.logError = function logError(scope, message, err) {
  console.error("[WI:" + scope + "]", message, err || "");
};
