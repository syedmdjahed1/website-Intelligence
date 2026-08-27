/**
 * Runs all collectors once and exposes WI.collectAll for executeScript(func).
 * Collectors are isolated: one failure does not abort the others.
 */
var WI = WI || {};

WI.collectAll = function collectAll() {
  WI.log("Collector", "collectAll started");
  var collectedAt = new Date().toISOString();
  var collectors = [
    "page",
    "meta",
    "scripts",
    "links",
    "cookies",
    "dom",
    "html",
    "performance",
  ];
  var signals = {};
  var errors = [];

  for (var i = 0; i < collectors.length; i++) {
    var name = collectors[i];
    try {
      var fn = WI.collectors && WI.collectors[name];
      if (typeof fn !== "function") {
        errors.push({ collector: name, error: "Collector not registered" });
        signals[name] = null;
        continue;
      }
      signals[name] = fn();
    } catch (err) {
      WI.logError("Collector", name + " threw", err);
      errors.push({
        collector: name,
        error: String(err && err.message ? err.message : err),
      });
      signals[name] = null;
    }
  }

  WI.log("Collector", "collectAll completed", { errors: errors.length });

  return {
    collectedAt: collectedAt,
    signals: signals,
    collectorErrors: errors,
  };
};
