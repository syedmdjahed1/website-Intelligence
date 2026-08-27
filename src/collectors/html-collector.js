/**
 * Collects a bounded HTML sample for pattern matching.
 * Local analysis only — never uploaded.
 */
var WI = WI || {};
WI.collectors = WI.collectors || {};

WI.collectors.html = function collectHtml() {
  WI.log("Collector", "html started");
  try {
    var MAX = 150000;
    var sample = "";
    try {
      sample = document.documentElement ? document.documentElement.innerHTML : "";
    } catch (err) {
      sample = document.body ? document.body.innerHTML : "";
    }
    if (sample.length > MAX) {
      sample = sample.slice(0, MAX);
    }

    var urlPool = [];
    try {
      urlPool.push(location.href || "");
      urlPool.push(location.pathname || "");
    } catch (e) {
      /* ignore */
    }

    WI.log("Collector", "html completed", { chars: sample.length });
    return {
      sampleLength: sample.length,
      sample: sample,
      urlPool: urlPool,
    };
  } catch (err) {
    WI.logError("Collector", "html failed", err);
    return {
      sampleLength: 0,
      sample: "",
      urlPool: [],
      error: String(err && err.message ? err.message : err),
    };
  }
};
