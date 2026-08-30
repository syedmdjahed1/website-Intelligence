/**
 * Collects response security headers via a short-lived extension fetch.
 * Uses temporary host access from activeTab when the user clicks Analyze.
 * Prefers HEAD; falls back to GET and cancels the body stream.
 */

import { log, logError } from "../utils/logger.js";

const INTERESTING = [
  "strict-transport-security",
  "content-security-policy",
  "content-security-policy-report-only",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
  "feature-policy",
  "cross-origin-opener-policy",
  "cross-origin-resource-policy",
  "cross-origin-embedder-policy",
  "x-xss-protection",
  "server",
  "via",
  "x-powered-by",
  "x-varnish",
  "x-served-by",
  "x-litespeed-cache",
];

/**
 * @param {string} pageUrl
 * @returns {Promise<object>}
 */
export async function collectSecurityHeaders(pageUrl) {
  log("Security", "header collection started", { pageUrl });

  try {
    let response = await tryFetch(pageUrl, "HEAD");
    if (!response || response.status === 405 || response.status === 501) {
      response = await tryFetch(pageUrl, "GET");
    }

    if (!response) {
      return {
        available: false,
        error: "Could not fetch response headers for this page.",
        finalUrl: pageUrl,
        status: null,
        headers: {},
      };
    }

    /** @type {Record<string, string>} */
    const headers = {};
    for (const name of INTERESTING) {
      const value = response.headers.get(name);
      if (value) headers[name] = value;
    }

    response.headers.forEach((value, name) => {
      const key = name.toLowerCase();
      if (key.startsWith("x-") || key.includes("policy") || key.includes("security")) {
        if (!headers[key]) headers[key] = value;
      }
    });

    log("Security", "header collection completed", {
      status: response.status,
      count: Object.keys(headers).length,
    });

    return {
      available: true,
      error: null,
      finalUrl: response.url || pageUrl,
      status: response.status,
      redirected: response.redirected,
      headers,
    };
  } catch (err) {
    logError("Security", "header collection failed", err);
    return {
      available: false,
      error: err instanceof Error ? err.message : String(err),
      finalUrl: pageUrl,
      status: null,
      headers: {},
    };
  }
}

/**
 * @param {string} url
 * @param {"HEAD" | "GET"} method
 */
async function tryFetch(url, method) {
  try {
    const response = await fetch(url, {
      method,
      redirect: "follow",
      credentials: "omit",
      cache: "no-store",
    });

    if (method === "GET" && response.body && typeof response.body.cancel === "function") {
      response.body.cancel().catch(() => {});
    }

    return response;
  } catch (err) {
    log("Security", `${method} fetch failed`, String(err));
    return null;
  }
}
