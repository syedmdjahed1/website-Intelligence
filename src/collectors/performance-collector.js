/**
 * Collects Performance API metrics already buffered in the page.
 * One-shot read — does not continuously observe or block the page.
 */
var WI = WI || {};
WI.collectors = WI.collectors || {};

WI.collectors.performance = function collectPerformance() {
  WI.log("Collector", "performance started");
  try {
    if (typeof performance === "undefined" || typeof performance.getEntriesByType !== "function") {
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
      var entries = getEntriesByTypeSafe("resource");
      var max = Math.min(entries.length, 400);
      for (var i = 0; i < max; i++) {
        resources.push(serializeResource(entries[i], hostname));
      }
    } catch (err) {
      WI.logError("Collector", "resource timing failed", err);
    }

    var navigation = null;
    try {
      var navs = getEntriesByTypeSafe("navigation");
      if (navs.length) {
        navigation = serializeNavigation(navs[0]);
      } else if (performance.timing) {
        navigation = serializeLegacyNavigation(performance.timing);
      }
    } catch (err2) {
      WI.logError("Collector", "navigation timing failed", err2);
    }

    var paint = {};
    try {
      var paints = getEntriesByTypeSafe("paint");
      for (var p = 0; p < paints.length; p++) {
        paint[paints[p].name] = round(paints[p].startTime);
      }
    } catch (err3) {
      WI.logError("Collector", "paint timing failed", err3);
    }

    var lcp = readLcpEntry();

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

function supportsEntryType(type) {
  try {
    if (typeof PerformanceObserver === "undefined") return true;
    if (!PerformanceObserver.supportedEntryTypes) return true;
    return PerformanceObserver.supportedEntryTypes.indexOf(type) !== -1;
  } catch (e) {
    return false;
  }
}

function getEntriesByTypeSafe(type) {
  try {
    if (!supportsEntryType(type)) return [];
    var entries = performance.getEntriesByType(type);
    return entries && entries.length ? entries : [];
  } catch (err) {
    WI.logError("Collector", "getEntriesByType failed: " + type, err);
    return [];
  }
}

function readLcpEntry() {
  try {
    if (!supportsEntryType("largest-contentful-paint")) return null;
    var lcps = getEntriesByTypeSafe("largest-contentful-paint");
    if (!lcps.length) return null;
    var last = lcps[lcps.length - 1];
    return {
      startTime: round(last.startTime),
      size: last.size || 0,
      url: String(last.url || "").slice(0, 300),
    };
  } catch (err) {
    WI.logError("Collector", "lcp read failed", err);
    return null;
  }
}

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
    ttfb: round((n.responseStart || 0) - (n.requestStart || 0)),
    domContentLoaded: round(n.domContentLoadedEventEnd || 0),
    loadEventEnd: round(n.loadEventEnd || 0),
    domInteractive: round(n.domInteractive || 0),
    responseEnd: round(n.responseEnd || 0),
    nextHopProtocol: n.nextHopProtocol || "",
  };
}

function serializeLegacyNavigation(timing) {
  if (!timing) return null;
  var navStart = timing.navigationStart || 0;
  return {
    type: "navigate",
    transferSize: 0,
    encodedBodySize: 0,
    decodedBodySize: 0,
    startTime: 0,
    duration: round((timing.loadEventEnd || 0) - navStart),
    redirectCount: performance.navigation ? performance.navigation.redirectCount || 0 : 0,
    ttfb: round((timing.responseStart || 0) - (timing.requestStart || 0)),
    domContentLoaded: round((timing.domContentLoadedEventEnd || 0) - navStart),
    loadEventEnd: round((timing.loadEventEnd || 0) - navStart),
    domInteractive: round((timing.domInteractive || 0) - navStart),
    responseEnd: round((timing.responseEnd || 0) - navStart),
    nextHopProtocol: "",
  };
}
