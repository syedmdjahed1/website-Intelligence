/**
 * Collects external and inline script references (src URLs + inline length only).
 * Does not evaluate script content beyond length of inline blocks.
 */
var WI = WI || {};
WI.collectors = WI.collectors || {};

WI.collectors.scripts = function collectScripts() {
  WI.log("Collector", "scripts started");
  try {
    var nodes = document.querySelectorAll("script");
    var external = [];
    var inlineCount = 0;
    var inlineTotalChars = 0;

    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var src = el.getAttribute("src");
      if (src) {
        external.push({
          src: src,
          async: el.hasAttribute("async"),
          defer: el.hasAttribute("defer"),
          type: el.getAttribute("type") || "",
        });
      } else {
        inlineCount += 1;
        inlineTotalChars += (el.textContent || "").length;
      }
    }

    WI.log("Collector", "scripts completed", {
      external: external.length,
      inline: inlineCount,
    });

    return {
      externalCount: external.length,
      inlineCount: inlineCount,
      inlineTotalChars: inlineTotalChars,
      external: external,
    };
  } catch (err) {
    WI.logError("Collector", "scripts failed", err);
    return {
      externalCount: 0,
      inlineCount: 0,
      inlineTotalChars: 0,
      external: [],
      error: String(err && err.message ? err.message : err),
    };
  }
};
