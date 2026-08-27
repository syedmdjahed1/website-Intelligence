/**
 * Injects collectors into the active tab and probes page-world globals/selectors.
 */

import { log, logError } from "../utils/logger.js";

const COLLECTOR_FILES = [
  "src/content/wi-namespace.js",
  "src/content/wi-logger.js",
  "src/collectors/page-collector.js",
  "src/collectors/meta-collector.js",
  "src/collectors/script-collector.js",
  "src/collectors/link-collector.js",
  "src/collectors/cookie-collector.js",
  "src/collectors/dom-collector.js",
  "src/collectors/html-collector.js",
  "src/collectors/performance-collector.js",
  "src/content/collect-all.js",
];

/**
 * @param {number} tabId
 * @param {{ globals?: string[], selectors?: string[] }} [probes]
 * @returns {Promise<{ collection: object, probes: object }>}
 */
export async function collectFromTab(tabId, probes = {}) {
  log("Collect", "injecting collectors", { tabId });

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: COLLECTOR_FILES,
    });
  } catch (err) {
    logError("Collect", "script injection failed", err);
    throw new Error(
      "Could not access this page. Reload the tab and try again, or the site may block script injection."
    );
  }

  let results;
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        if (typeof WI === "undefined" || typeof WI.collectAll !== "function") {
          return { error: "Collectors did not initialize on this page." };
        }
        return WI.collectAll();
      },
    });
  } catch (err) {
    logError("Collect", "collectAll execution failed", err);
    throw new Error("Page signal collection failed on this tab.");
  }

  const entry = results && results[0];
  if (!entry || entry.result == null) {
    throw new Error("No collection result returned from the page.");
  }

  if (entry.result.error) {
    throw new Error(entry.result.error);
  }

  const probeResult = await runProbes(tabId, probes);

  log("Collect", "collection ok", {
    errors: entry.result.collectorErrors?.length || 0,
    globals: Object.keys(probeResult.globals || {}).length,
  });

  return {
    collection: entry.result,
    probes: probeResult,
  };
}

/**
 * @param {number} tabId
 * @param {{ globals?: string[], selectors?: string[] }} probes
 */
async function runProbes(tabId, probes) {
  const globalNames = Array.isArray(probes.globals) ? probes.globals : [];
  const selectors = Array.isArray(probes.selectors) ? probes.selectors : [];

  /** @type {Record<string, string>} */
  let globals = {};
  /** @type {Record<string, string>} */
  let versions = {};
  /** @type {Record<string, number>} */
  let selectorHits = {};

  if (globalNames.length > 0) {
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: (names) => {
          const found = {};
          const versionHints = {};

          const readPath = (path) => {
            try {
              const parts = String(path).split(".");
              let cur = window;
              for (const part of parts) {
                if (cur == null) return undefined;
                cur = cur[part];
              }
              return cur;
            } catch {
              return undefined;
            }
          };

          for (const name of names) {
            try {
              if (name in window && window[name] != null) {
                found[name] = typeof window[name];
              }
            } catch {
              /* cross-origin / revoked */
            }
          }

          // Common version paths used by MVP detectors
          const jq = readPath("jQuery.fn.jquery");
          if (jq != null) versionHints["jQuery.fn.jquery"] = String(jq);

          return { globals: found, versions: versionHints };
        },
        args: [globalNames],
      });
      globals = result?.globals || {};
      versions = result?.versions || {};
    } catch (err) {
      logError("Collect", "MAIN-world global probe failed", err);
    }
  }

  if (selectors.length > 0) {
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId },
        func: (selectorList) => {
          const hits = {};
          const versions = {};
          for (const sel of selectorList) {
            try {
              const nodes = document.querySelectorAll(sel);
              hits[sel] = nodes.length;
              if (sel.includes("ng-version") && nodes[0]) {
                const v = nodes[0].getAttribute("ng-version");
                if (v) versions[`${sel}::ng-version`] = v;
              }
            } catch {
              hits[sel] = 0;
            }
          }
          return { selectors: hits, versions };
        },
        args: [selectors],
      });
      selectorHits = result?.selectors || {};
      versions = { ...versions, ...(result?.versions || {}) };
    } catch (err) {
      logError("Collect", "selector probe failed", err);
    }
  }

  return {
    globals,
    selectors: selectorHits,
    versions,
  };
}
