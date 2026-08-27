/**
 * Shared helpers for the extension UI / engine (ES module).
 */

const RESTRICTED_PROTOCOLS = new Set([
  "chrome:",
  "chrome-extension:",
  "edge:",
  "about:",
  "devtools:",
  "view-source:",
]);

/**
 * @param {string | undefined} urlString
 * @returns {{ analyzable: boolean; domain: string; protocol: string; reason?: string; url?: URL }}
 */
export function inspectUrl(urlString) {
  if (!urlString) {
    return {
      analyzable: false,
      domain: "—",
      protocol: "—",
      reason: "No URL is available for this tab.",
    };
  }

  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    return {
      analyzable: false,
      domain: "—",
      protocol: "—",
      reason: "This tab URL could not be parsed.",
    };
  }

  if (RESTRICTED_PROTOCOLS.has(parsed.protocol)) {
    return {
      analyzable: false,
      domain: parsed.hostname || parsed.protocol.replace(":", ""),
      protocol: parsed.protocol.replace(":", ""),
      reason: "Chrome internal pages cannot be analyzed.",
      url: parsed,
    };
  }

  if (parsed.protocol === "file:") {
    return {
      analyzable: false,
      domain: "local file",
      protocol: "file",
      reason: "Local files are not supported in this version.",
      url: parsed,
    };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      analyzable: false,
      domain: parsed.hostname || "—",
      protocol: parsed.protocol.replace(":", ""),
      reason: "This page type cannot be analyzed.",
      url: parsed,
    };
  }

  return {
    analyzable: true,
    domain: parsed.hostname || "—",
    protocol: parsed.protocol.replace(":", ""),
    url: parsed,
  };
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function safeText(value) {
  if (value === null || value === undefined) return "—";
  return String(value);
}
