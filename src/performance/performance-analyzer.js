/**
 * Performance analyzer — measurable metrics only (no fake 0–100 score).
 */

import { log } from "../utils/logger.js";

const MB = 1024 * 1024;
const KB = 1024;

/**
 * @param {object} perfSignal - WI.collectors.performance output
 * @returns {object}
 */
export function analyzePerformance(perfSignal = {}) {
  log("Performance", "analyzePerformance started");

  if (!perfSignal || perfSignal.available === false) {
    return {
      available: false,
      status: "Analysis unavailable",
      summary: { pass: 0, warn: 0, fail: 0, info: 1, total: 1 },
      checks: [
        {
          id: "availability",
          name: "Performance API",
          status: "warn",
          detail: perfSignal?.error || "Performance metrics unavailable on this page",
          value: null,
        },
      ],
      metrics: null,
      score: null,
      scoreNote: "No overall performance score — checklist only",
    };
  }

  const resources = Array.isArray(perfSignal.resources) ? perfSignal.resources : [];
  const nav = perfSignal.navigation || null;
  const paint = perfSignal.paint || {};
  const lcp = perfSignal.lcp || null;

  const totals = summarizeResources(resources);
  const metrics = {
    requestCount: resources.length,
    totalBytes: totals.totalBytes,
    sizedRequestCount: totals.sizedCount,
    unknownSizeCount: totals.unknownCount,
    byType: totals.byType,
    thirdPartyCount: totals.thirdPartyCount,
    thirdPartyBytes: totals.thirdPartyBytes,
    largest: totals.largest,
    navigation: nav,
    paint: {
      firstPaint: paint["first-paint"] ?? null,
      firstContentfulPaint: paint["first-contentful-paint"] ?? null,
    },
    lcp: lcp,
    note: perfSignal.note || null,
  };

  /** @type {Array<object>} */
  const checks = [];

  checks.push(requestCountCheck(metrics.requestCount));
  checks.push(pageWeightCheck(metrics.totalBytes, metrics.unknownSizeCount, metrics.requestCount));
  checks.push(typeSizeCheck("javascript", "JavaScript weight", totals.byType.script?.bytes || 0, 1 * MB));
  checks.push(typeSizeCheck("css", "CSS weight", totals.byType.css?.bytes || 0, 300 * KB));
  checks.push(typeSizeCheck("img", "Image weight", totals.byType.img?.bytes || 0, 2 * MB));
  checks.push(thirdPartyCheck(metrics.requestCount, metrics.thirdPartyCount));
  checks.push(largeResourcesCheck(totals.largest));
  checks.push(timingCheck("ttfb", "Time to first byte", nav?.ttfb, 800, 1800));
  checks.push(timingCheck("dcl", "DOM Content Loaded", nav?.domContentLoaded, 2000, 4000));
  checks.push(timingCheck("load", "Load event", nav?.loadEventEnd, 3000, 6000));
  checks.push(timingCheck("fcp", "First Contentful Paint", paint["first-contentful-paint"], 1800, 3000));
  checks.push(lcpCheck(lcp));

  const summary = {
    pass: checks.filter((c) => c.status === "pass").length,
    warn: checks.filter((c) => c.status === "warn").length,
    fail: checks.filter((c) => c.status === "fail").length,
    info: checks.filter((c) => c.status === "info").length,
    total: checks.length,
  };

  const result = {
    available: true,
    summary,
    checks,
    metrics,
    score: null,
    scoreNote: "No overall performance score — checklist + measured metrics only",
  };

  log("Performance", "analyzePerformance completed", summary);
  return result;
}

function summarizeResources(resources) {
  const byType = {};
  let totalBytes = 0;
  let sizedCount = 0;
  let unknownCount = 0;
  let thirdPartyCount = 0;
  let thirdPartyBytes = 0;

  for (const r of resources) {
    const type = normalizeType(r.initiatorType);
    if (!byType[type]) byType[type] = { count: 0, bytes: 0 };
    byType[type].count += 1;

    if (r.sizeKnown && r.size > 0) {
      byType[type].bytes += r.size;
      totalBytes += r.size;
      sizedCount += 1;
    } else {
      unknownCount += 1;
    }

    if (r.thirdParty) {
      thirdPartyCount += 1;
      if (r.sizeKnown) thirdPartyBytes += r.size;
    }
  }

  const largest = [...resources]
    .filter((r) => r.sizeKnown && r.size > 0)
    .sort((a, b) => b.size - a.size)
    .slice(0, 8)
    .map((r) => ({
      name: shortenUrl(r.name),
      size: r.size,
      type: normalizeType(r.initiatorType),
      thirdParty: r.thirdParty,
    }));

  return {
    byType,
    totalBytes,
    sizedCount,
    unknownCount,
    thirdPartyCount,
    thirdPartyBytes,
    largest,
  };
}

function normalizeType(t) {
  const x = String(t || "other").toLowerCase();
  if (x === "script") return "script";
  if (x === "css" || x === "link") return "css";
  if (x === "img" || x === "image") return "img";
  if (x === "xmlhttprequest" || x === "fetch") return "xhr";
  if (x === "font") return "font";
  if (x === "media" || x === "video" || x === "audio") return "media";
  return "other";
}

function requestCountCheck(count) {
  let status = "pass";
  let detail = `${count} resource request(s) in the Performance buffer`;
  if (count > 150) {
    status = "fail";
    detail += " — very high request count";
  } else if (count > 80) {
    status = "warn";
    detail += " — high request count";
  }
  return { id: "requests", name: "Request count", status, detail, value: count };
}

function pageWeightCheck(bytes, unknownCount, requestCount) {
  if (bytes <= 0 && unknownCount > 0) {
    return {
      id: "weight",
      name: "Transfer size",
      status: "info",
      detail: `Size unknown for ${unknownCount}/${requestCount} resources (often cross-origin without Timing-Allow-Origin)`,
      value: { bytes, unknownCount },
    };
  }
  let status = "pass";
  let detail = `${formatBytes(bytes)} measured across ${requestCount - unknownCount} sized resource(s)`;
  if (unknownCount) detail += ` (${unknownCount} size unknown)`;
  if (bytes > 5 * MB) {
    status = "fail";
    detail += " — very heavy";
  } else if (bytes > 2 * MB) {
    status = "warn";
    detail += " — heavy page weight";
  }
  return { id: "weight", name: "Transfer size", status, detail, value: { bytes, unknownCount } };
}

function typeSizeCheck(id, name, bytes, warnAt) {
  if (bytes <= 0) {
    return {
      id,
      name,
      status: "info",
      detail: `No measured ${name.toLowerCase()} bytes (none, or sizes hidden)`,
      value: bytes,
    };
  }
  let status = "pass";
  let detail = formatBytes(bytes);
  if (bytes > warnAt * 2) {
    status = "fail";
    detail += " — very large";
  } else if (bytes > warnAt) {
    status = "warn";
    detail += " — large";
  }
  return { id, name, status, detail, value: bytes };
}

function thirdPartyCheck(total, thirdParty) {
  if (total === 0) {
    return {
      id: "third-party",
      name: "Third-party requests",
      status: "info",
      detail: "No resources observed",
      value: { total, thirdParty },
    };
  }
  const pct = Math.round((thirdParty / total) * 100);
  let status = "pass";
  let detail = `${thirdParty} of ${total} requests (${pct}%) are third-party`;
  if (pct >= 70) {
    status = "warn";
    detail += " — third-party heavy";
  }
  return { id: "third-party", name: "Third-party requests", status, detail, value: { total, thirdParty, pct } };
}

function largeResourcesCheck(largest) {
  const big = (largest || []).filter((r) => r.size >= 500 * KB);
  if (big.length === 0) {
    return {
      id: "large-resources",
      name: "Large resources",
      status: "pass",
      detail: "No measured resource ≥ 500 KB",
      value: [],
    };
  }
  return {
    id: "large-resources",
    name: "Large resources",
    status: "warn",
    detail: big
      .slice(0, 5)
      .map((r) => `${formatBytes(r.size)} ${r.name}`)
      .join(" · "),
    value: big,
  };
}

function timingCheck(id, name, ms, warnAt, failAt) {
  if (ms == null || Number(ms) <= 0) {
    return {
      id,
      name,
      status: "info",
      detail: "Timing not available in this document buffer",
      value: null,
    };
  }
  const value = Number(ms);
  let status = "pass";
  let detail = `${Math.round(value)} ms`;
  if (value > failAt) {
    status = "fail";
    detail += " — slow";
  } else if (value > warnAt) {
    status = "warn";
    detail += " — elevated";
  }
  return { id, name, status, detail, value };
}

function lcpCheck(lcp) {
  if (!lcp || lcp.startTime == null) {
    return {
      id: "lcp",
      name: "Largest Contentful Paint",
      status: "info",
      detail: "LCP not in buffer (often requires earlier observation)",
      value: null,
    };
  }
  return timingCheck("lcp", "Largest Contentful Paint", lcp.startTime, 2500, 4000);
}

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < KB) return `${n} B`;
  if (n < MB) return `${(n / KB).toFixed(1)} KB`;
  return `${(n / MB).toFixed(2)} MB`;
}

function shortenUrl(url) {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 40 ? `${u.pathname.slice(0, 37)}…` : u.pathname;
    return `${u.hostname}${path}`;
  } catch {
    return String(url).slice(0, 60);
  }
}
