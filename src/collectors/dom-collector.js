/**
 * Lightweight DOM structure signals (counts only — no form field values).
 */
var WI = WI || {};
WI.collectors = WI.collectors || {};

WI.collectors.dom = function collectDom() {
  WI.log("Collector", "dom started");
  try {
    var images = document.querySelectorAll("img");
    var imagesMissingAlt = 0;
    for (var i = 0; i < images.length; i++) {
      var alt = images[i].getAttribute("alt");
      if (alt === null) imagesMissingAlt += 1;
    }

    var iframes = document.querySelectorAll("iframe");
    var iframeSrcs = [];
    for (var f = 0; f < iframes.length; f++) {
      var src = iframes[f].getAttribute("src") || "";
      if (src) iframeSrcs.push(src);
    }

    var result = {
      elementCount: document.getElementsByTagName("*").length,
      h1Count: document.querySelectorAll("h1").length,
      h2Count: document.querySelectorAll("h2").length,
      imageCount: images.length,
      imagesMissingAlt: imagesMissingAlt,
      formCount: document.querySelectorAll("form").length,
      iframeCount: iframes.length,
      iframeSrcs: iframeSrcs.slice(0, 40),
      hasViewportMeta: !!document.querySelector('meta[name="viewport"]'),
      jsonLdCount: document.querySelectorAll('script[type="application/ld+json"]').length,
      idHints: [],
      classHints: [],
    };

    var hintRoots = document.querySelectorAll("[id], [class]");
    var idSet = {};
    var classSet = {};
    var limit = Math.min(hintRoots.length, 200);
    for (var h = 0; h < limit; h++) {
      var el = hintRoots[h];
      if (el.id) idSet[el.id] = true;
      var className = el.className;
      if (typeof className === "string" && className) {
        var parts = className.split(/\s+/);
        for (var c = 0; c < parts.length; c++) {
          if (parts[c]) classSet[parts[c]] = true;
        }
      }
    }

    result.idHints = Object.keys(idSet).slice(0, 40);
    result.classHints = Object.keys(classSet).slice(0, 60);

    WI.log("Collector", "dom completed", { elements: result.elementCount });
    return result;
  } catch (err) {
    WI.logError("Collector", "dom failed", err);
    return {
      elementCount: 0,
      h1Count: 0,
      h2Count: 0,
      imageCount: 0,
      imagesMissingAlt: 0,
      formCount: 0,
      iframeCount: 0,
      iframeSrcs: [],
      hasViewportMeta: false,
      jsonLdCount: 0,
      idHints: [],
      classHints: [],
      error: String(err && err.message ? err.message : err),
    };
  }
};
