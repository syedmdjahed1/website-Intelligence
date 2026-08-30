/**
 * Shared tab analysis — used by popup and background service worker.
 */

import { inspectUrl } from "../utils/helpers.js";
import { log, logError } from "../utils/logger.js";
import { collectFromTab, runProbesOnly } from "../popup/collect-bridge.js";
import { prepareDetection, analyzeSignals } from "../detector/detection-engine.js";
import { collectSecurityHeaders } from "../security/header-collector.js";
import { collectCookieSecurity } from "../security/cookie-collector.js";

/**
 * @param {number} tabId
 * @param {string} url
 * @param {object} [options]
 * @param {object} [options.collection] Pre-collected page signals from content script
 * @returns {Promise<{ ok: true, result: object } | { ok: false, analyzable: boolean, reason?: string }>}
 */
export async function runTabAnalysis(tabId, url, options = {}) {
  const check = inspectUrl(url);
  if (!check.analyzable) {
    return { ok: false, analyzable: false, reason: check.reason };
  }

  log("Analysis", "runTabAnalysis", { tabId, url, preCollected: Boolean(options.collection) });

  try {
    const { defs, probes } = await prepareDetection();

    let collection = options.collection;
    let probeData = { globals: {}, selectors: {}, versions: {} };

    if (collection) {
      probeData = await runProbesOnly(tabId, probes);
    } else {
      const collected = await collectFromTab(tabId, probes);
      collection = collected.collection;
      probeData = collected.probes;
    }

    const [headers, cookieSecurity] = await Promise.all([
      collectSecurityHeaders(url),
      collectCookieSecurity(url),
    ]);

    const result = analyzeSignals(collection, probeData, defs, {
      headers,
      cookieSecurity,
    });

    return { ok: true, result };
  } catch (err) {
    logError("Analysis", "runTabAnalysis failed", err);
    throw err;
  }
}
