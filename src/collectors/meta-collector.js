/**
 * Collects meta tag name/property/content pairs (public SEO/generator signals).
 */
var WI = WI || {};
WI.collectors = WI.collectors || {};

WI.collectors.meta = function collectMeta() {
  WI.log("Collector", "meta started");
  try {
    var nodes = document.querySelectorAll("meta");
    var items = [];
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var name = el.getAttribute("name") || el.getAttribute("property") || el.getAttribute("http-equiv") || "";
      var content = el.getAttribute("content") || "";
      if (!name && !content) continue;
      items.push({
        name: name,
        content: content.slice(0, 500),
      });
    }
    WI.log("Collector", "meta completed", { count: items.length });
    return { count: items.length, items: items };
  } catch (err) {
    WI.logError("Collector", "meta failed", err);
    return { count: 0, items: [], error: String(err && err.message ? err.message : err) };
  }
};
