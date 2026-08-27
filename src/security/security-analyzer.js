/**
 * Security analyzer — measurable checks only (no fake 0–100 score).
 */

import { log } from "../utils/logger.js";

/**
 * @param {object} input
 * @param {object} input.signals - page collectors
 * @param {object} input.headers - from header-collector
 * @param {object} input.cookieSecurity - from cookie-collector
 * @returns {object}
 */
export function analyzeSecurity(input = {}) {
  log("Security", "analyzeSecurity started");

  const signals = input.signals || {};
  const headerData = input.headers || {};
  const cookieData = input.cookieSecurity || {};
  const page = signals.page || {};
  const protocol = String(page.protocol || "").toLowerCase();
  const headers = headerData.headers || {};

  /** @type {Array<object>} */
  const checks = [];

  checks.push(httpsCheck(protocol));
  checks.push(hstsCheck(protocol, headers["strict-transport-security"]));
  checks.push(
    headerPresentCheck(
      "csp",
      "Content-Security-Policy",
      headers["content-security-policy"],
      headers["content-security-policy-report-only"]
    )
  );
  checks.push(xFrameCheck(headers));
  checks.push(
    simpleHeaderCheck(
      "x-content-type-options",
      "X-Content-Type-Options",
      headers["x-content-type-options"],
      (v) => /nosniff/i.test(v),
      "nosniff"
    )
  );
  checks.push(
    simpleHeaderCheck(
      "referrer-policy",
      "Referrer-Policy",
      headers["referrer-policy"],
      (v) => Boolean(v && v.trim()),
      "present"
    )
  );
  checks.push(permissionsPolicyCheck(headers));
  checks.push(cookieFlagsCheck(cookieData));
  checks.push(mixedContentCheck(protocol, signals));

  if (!headerData.available) {
    checks.push({
      id: "header-fetch",
      name: "Header inspection",
      status: "warn",
      detail: headerData.error
        ? `Header fetch limited: ${headerData.error}`
        : "Response headers could not be retrieved (separate request; may differ from navigation).",
      value: null,
    });
  } else {
    checks.push({
      id: "header-fetch",
      name: "Header inspection",
      status: "info",
      detail: `Fetched headers via extension request (HTTP ${headerData.status}). May differ slightly from the original navigation response.`,
      value: { status: headerData.status, finalUrl: headerData.finalUrl },
    });
  }

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
    score: null,
    scoreNote: "No overall security score — checklist only",
    headersFound: Object.keys(headers),
  };

  log("Security", "analyzeSecurity completed", summary);
  return result;
}

function httpsCheck(protocol) {
  if (protocol === "https") {
    return {
      id: "https",
      name: "HTTPS",
      status: "pass",
      detail: "Page is served over HTTPS",
      value: protocol,
    };
  }
  return {
    id: "https",
    name: "HTTPS",
    status: "fail",
    detail: `Page protocol is ${protocol || "unknown"} (not HTTPS)`,
    value: protocol || null,
  };
}

function hstsCheck(protocol, hsts) {
  if (protocol !== "https") {
    return {
      id: "hsts",
      name: "HSTS",
      status: "info",
      detail: "HSTS only applies to HTTPS responses",
      value: null,
    };
  }
  if (!hsts) {
    return {
      id: "hsts",
      name: "HSTS",
      status: "warn",
      detail: "Strict-Transport-Security header not observed",
      value: null,
    };
  }
  return {
    id: "hsts",
    name: "HSTS",
    status: "pass",
    detail: truncate(hsts, 90),
    value: hsts,
  };
}

function headerPresentCheck(id, label, enforce, reportOnly) {
  if (enforce) {
    return {
      id,
      name: label,
      status: "pass",
      detail: truncate(enforce, 90),
      value: enforce,
    };
  }
  if (reportOnly) {
    return {
      id,
      name: label,
      status: "warn",
      detail: `Report-Only only: ${truncate(reportOnly, 70)}`,
      value: reportOnly,
    };
  }
  return {
    id,
    name: label,
    status: "warn",
    detail: `${label} header not observed`,
    value: null,
  };
}

function simpleHeaderCheck(id, label, value, okFn, okHint) {
  if (!value) {
    return {
      id,
      name: label,
      status: "warn",
      detail: `${label} header not observed`,
      value: null,
    };
  }
  if (okFn(value)) {
    return {
      id,
      name: label,
      status: "pass",
      detail: truncate(value, 90),
      value,
    };
  }
  return {
    id,
    name: label,
    status: "warn",
    detail: `${label} present but unexpected (${okHint}): ${truncate(value, 60)}`,
    value,
  };
}

function xFrameCheck(headers) {
  const xfo = headers["x-frame-options"];
  const csp = headers["content-security-policy"] || "";
  const hasFrameAncestors = /frame-ancestors/i.test(csp);

  if (xfo) {
    return {
      id: "x-frame-options",
      name: "Clickjacking protection",
      status: "pass",
      detail: `X-Frame-Options: ${truncate(xfo, 60)}`,
      value: xfo,
    };
  }
  if (hasFrameAncestors) {
    return {
      id: "x-frame-options",
      name: "Clickjacking protection",
      status: "pass",
      detail: "CSP frame-ancestors directive present",
      value: "csp-frame-ancestors",
    };
  }
  return {
    id: "x-frame-options",
    name: "Clickjacking protection",
    status: "warn",
    detail: "Neither X-Frame-Options nor CSP frame-ancestors observed",
    value: null,
  };
}

function permissionsPolicyCheck(headers) {
  const pp = headers["permissions-policy"] || headers["feature-policy"];
  if (pp) {
    return {
      id: "permissions-policy",
      name: "Permissions-Policy",
      status: "pass",
      detail: truncate(pp, 90),
      value: pp,
    };
  }
  return {
    id: "permissions-policy",
    name: "Permissions-Policy",
    status: "info",
    detail: "Permissions-Policy / Feature-Policy not observed",
    value: null,
  };
}

function cookieFlagsCheck(cookieData) {
  if (!cookieData.available) {
    return {
      id: "cookies",
      name: "Cookie flags",
      status: "warn",
      detail: cookieData.error
        ? `Cookie attribute check unavailable: ${cookieData.error}`
        : "Cookie attribute check unavailable",
      value: null,
    };
  }

  const cookies = cookieData.cookies || [];
  if (cookies.length === 0) {
    return {
      id: "cookies",
      name: "Cookie flags",
      status: "info",
      detail: "No cookies returned by the cookies API for this URL",
      value: { count: 0 },
    };
  }

  const insecure = cookies.filter((c) => !c.secure);
  const noHttpOnly = cookies.filter((c) => !c.httpOnly);
  const noneSite = cookies.filter(
    (c) => String(c.sameSite).toLowerCase() === "no_restriction" || String(c.sameSite).toLowerCase() === "none"
  );

  const issues = [];
  if (insecure.length) issues.push(`${insecure.length} without Secure`);
  if (noHttpOnly.length) issues.push(`${noHttpOnly.length} without HttpOnly`);
  if (noneSite.length) issues.push(`${noneSite.length} SameSite=None`);

  if (issues.length === 0) {
    return {
      id: "cookies",
      name: "Cookie flags",
      status: "pass",
      detail: `${cookies.length} cookie(s): Secure + HttpOnly look set (values never read)`,
      value: { count: cookies.length },
    };
  }

  return {
    id: "cookies",
    name: "Cookie flags",
    status: "warn",
    detail: `${cookies.length} cookie(s): ${issues.join("; ")} (values never read)`,
    value: {
      count: cookies.length,
      insecureNames: insecure.map((c) => c.name).slice(0, 8),
      noHttpOnlyNames: noHttpOnly.map((c) => c.name).slice(0, 8),
    },
  };
}

function mixedContentCheck(protocol, signals) {
  if (protocol !== "https") {
    return {
      id: "mixed-content",
      name: "Mixed content",
      status: "info",
      detail: "Mixed-content check applies to HTTPS pages",
      value: null,
    };
  }

  const httpUrls = [];
  const scripts = signals.scripts?.external || [];
  for (const s of scripts) {
    if (/^http:\/\//i.test(s.src || "")) httpUrls.push(s.src);
  }
  const links = signals.links?.items || [];
  for (const l of links) {
    if (/^http:\/\//i.test(l.href || "")) httpUrls.push(l.href);
  }
  const iframes = signals.dom?.iframeSrcs || [];
  for (const src of iframes) {
    if (/^http:\/\//i.test(src)) httpUrls.push(src);
  }

  if (httpUrls.length === 0) {
    return {
      id: "mixed-content",
      name: "Mixed content",
      status: "pass",
      detail: "No http:// script, stylesheet, or iframe URLs observed",
      value: { count: 0 },
    };
  }

  return {
    id: "mixed-content",
    name: "Mixed content",
    status: "fail",
    detail: `${httpUrls.length} insecure http:// resource URL(s) on an HTTPS page`,
    value: { count: httpUrls.length, samples: httpUrls.slice(0, 5) },
  };
}

function truncate(text, max) {
  const s = String(text);
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}
