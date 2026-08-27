/**
 * Collects cookie NAMES only — never values (privacy).
 */
var WI = WI || {};
WI.collectors = WI.collectors || {};

WI.collectors.cookies = function collectCookies() {
  WI.log("Collector", "cookies started");
  try {
    var raw = document.cookie || "";
    var names = [];
    if (raw) {
      var parts = raw.split(";");
      for (var i = 0; i < parts.length; i++) {
        var piece = parts[i].trim();
        if (!piece) continue;
        var eq = piece.indexOf("=");
        var name = eq === -1 ? piece : piece.slice(0, eq);
        if (name) names.push(name);
      }
    }
    WI.log("Collector", "cookies completed", { count: names.length });
    return { count: names.length, names: names };
  } catch (err) {
    WI.logError("Collector", "cookies failed", err);
    return { count: 0, names: [], error: String(err && err.message ? err.message : err) };
  }
};
