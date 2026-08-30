/**
 * Collects link tags (stylesheets, icons, canonical, preconnect, etc.).
 */
var WI = WI || {};
WI.collectors = WI.collectors || {};

WI.collectors.links = function collectLinks() {
  WI.log("Collector", "links started");
  try {
    var nodes = document.querySelectorAll("link");
    var items = [];
    var stylesheetCount = 0;

    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var rel = (el.getAttribute("rel") || "").toLowerCase();
      var href = el.getAttribute("href") || "";
      if (!rel && !href) continue;
      if (href) {
        try {
          href = new URL(href, location.href).href;
        } catch (e) {
          /* keep original */
        }
      }
      if (rel.indexOf("stylesheet") !== -1) stylesheetCount += 1;
      items.push({
        rel: rel,
        href: href,
        as: el.getAttribute("as") || "",
        type: el.getAttribute("type") || "",
      });
    }

    WI.log("Collector", "links completed", {
      count: items.length,
      stylesheets: stylesheetCount,
    });

    return {
      count: items.length,
      stylesheetCount: stylesheetCount,
      items: items,
    };
  } catch (err) {
    WI.logError("Collector", "links failed", err);
    return {
      count: 0,
      stylesheetCount: 0,
      items: [],
      error: String(err && err.message ? err.message : err),
    };
  }
};
