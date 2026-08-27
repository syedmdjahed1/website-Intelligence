/**
 * Collects cookie SECURITY ATTRIBUTES only — never values.
 */

import { log, logError } from "../utils/logger.js";

/**
 * @param {string} pageUrl
 * @returns {Promise<object>}
 */
export async function collectCookieSecurity(pageUrl) {
  log("Security", "cookie attribute collection started");

  if (!chrome.cookies || typeof chrome.cookies.getAll !== "function") {
    return {
      available: false,
      error: "cookies API unavailable",
      cookies: [],
    };
  }

  try {
    const list = await chrome.cookies.getAll({ url: pageUrl });
    const cookies = (list || []).map((c) => ({
      name: c.name,
      secure: Boolean(c.secure),
      httpOnly: Boolean(c.httpOnly),
      sameSite: c.sameSite || "unspecified",
      session: Boolean(c.session),
      // intentionally omit value, storeId details beyond safety flags
      domain: c.domain || "",
      path: c.path || "",
    }));

    log("Security", "cookie attributes collected", { count: cookies.length });
    return {
      available: true,
      error: null,
      cookies,
    };
  } catch (err) {
    logError("Security", "cookie attribute collection failed", err);
    return {
      available: false,
      error: err instanceof Error ? err.message : String(err),
      cookies: [],
    };
  }
}
