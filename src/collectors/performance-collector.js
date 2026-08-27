/**
 * Collects Performance API metrics already buffered in the page.
 * One-shot read — does not continuously observe or block the page.
 */
var WI = WI || {};
WI.collectors = WI.collectors || {};

WI.collectors.performance = function collectPerformance() {
  WI.log("Collector", "performance started");
  try {
    if (typeof performance === "undefined") {
      return { available: false, error: "Performance API unavailable" };
    }

    var hostname = "";
    try {
      hostname = location.hostname || "";
    } catch (e) {
      hostname = "";
    }

    var resources = [];
    try {
      var entries = performance.getEntriesByType("resource") || [];
      var max = Math.min(entries.length, 400);
      for (var i = 0; i < max; i++) {
        var e = entries[i];
        resources.push(serializeResource(e, hostname));
      }
    } catch (err) {
      WI.logError("Collector", "resource timing failed", err);
    }

    var navigation = null;
    try {
      var navs = performance.getEntriesByType("navigation");
      if (navs && navs[0]) {
        navigation = serializeNavigation(navs[0]);
      }
    } catch (err2) {
      WI.logError("Collector", "navigation timing failed", err2);
    }

    var paint = {};
    try {
      var paints = performance.getEntriesByType("paint") || [];
      for (var p = 0; p < paints.length; p++) {
        paint[paints[p].name] = round(paints[p].startTime);
      }
    } catch (err3) {
      /* optional */
    }

    var lcp = null;
    try {
      var lcps = performance.getEntriesByType("largest-contentful-paint") || [];
      if (lcps.length) {
        var last = lcps[lcps.length - 1];
        lcp = {
          startTime: round(last.startTime),
          size: last.size || 0,
          url: last.url || "",
        };
      }
    } catch (err4) {
      /* optional / may require observation earlier */
    }

    var mem = null;
    try {
      if (performance.memory) {
        mem = {
          usedJSHeapSize: performance.memory.usedJSHeapSize || 0,
          totalJSHeapSize: performance.memory.totalJSHeapSize || 0,
        };
      }
    } catch (err5) {
      /* Chrome-only, non-standard */
    }

    WI.log("Collector", "performance completed", { resources: resources.length });
    return {
      available: true,
      collectedAt: new Date().toISOString(),
      hostname: hostname,
      resourceCountObserved: resources.length,
      resources: resources,
      navigation: navigation,
      paint: paint,
      lcp: lcp,
      memory: mem,
      note:
        "Cross-origin transfer sizes may be 0 without Timing-Allow-Origin. Metrics reflect the current document buffer only.",
    };
  } catch (err) {
    WI.logError("Collector", "performance failed", err);
    return {
      available: false,
      error: String(err && err.message ? err.message : err),
    };
  }
};

function round(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function serializeResource(e, pageHost) {
  var name = e.name || "";
  var host = "";
  try {
    host = new URL(name, location.href).hostname;
  } catch (err) {
    host = "";
  }
  var transfer = typeof e.transferSize === "number" ? e.transferSize : 0;
  var encoded = typeof e.encodedBodySize === "number" ? e.encodedBodySize : 0;
  var decoded = typeof e.decodedBodySize === "number" ? e.decodedBodySize : 0;
  var size = transfer > 0 ? transfer : encoded > 0 ? encoded : decoded;

  return {
    name: name.slice(0, 300),
    initiatorType: e.initiatorType || "other",
    transferSize: transfer,
    encodedBodySize: encoded,
    decodedBodySize: decoded,
    size: size,
    sizeKnown: transfer > 0 || encoded > 0 || decoded > 0,
    duration: round(e.duration),
    host: host,
    thirdParty: Boolean(host && pageHost && host !== pageHost),
  };
}

function serializeNavigation(n) {
  return {
    type: n.type || "",
    transferSize: n.transferSize || 0,
    encodedBodySize: n.encodedBodySize || 0,
    decodedBodySize: n.decodedBodySize || 0,
    startTime: round(n.startTime),
    duration: round(n.duration),
    redirectCount: n.redirectCount || 0,
    // High-resolution timestamps relative to navigation start
    ttfb: round((n.responseStart || 0) - (n.requestStart || 0)),
    domContentLoaded: round(n.domContentLoadedEventEnd || 0),
    loadEventEnd: round(n.loadEventEnd || 0),
    domInteractive: round(n.domInteractive || 0),
    responseEnd: round(n.responseEnd || 0),
    nextHopProtocol: n.nextHopProtocol || "",
  };
}
