/**
 * Website Intelligence — background service worker (Manifest V3)
 * Auto-detects technologies on tab load and shows count on toolbar badge.
 */

import { inspectUrl } from "../utils/helpers.js";
import { log, logError } from "../utils/logger.js";
import { runTabAnalysis } from "../analysis/run-tab-analysis.js";

const BADGE_COLOR = "#16a34a";
const BADGE_TEXT_COLOR = "#FFFFFF";

/** @type {Map<number, { url: string, result: object, analyzedAt: number, count: number }>} */
const tabCache = new Map();
/** @type {Set<number>} */
const pending = new Set();
/** @type {number | null} */
let activeTabId = null;

function initBadgeColors() {
  chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR }).catch(() => {});
  if (chrome.action.setBadgeTextColor) {
    chrome.action.setBadgeTextColor({ color: BADGE_TEXT_COLOR }).catch(() => {});
  }
}

chrome.runtime.onInstalled.addListener(initBadgeColors);

/**
 * Sets the visible toolbar badge (global — shown on extension icon like Adblock Plus).
 * @param {number} count
 */
async function setToolbarBadge(count) {
  const text = count > 0 ? String(count) : "";
  try {
    initBadgeColors();
    await chrome.action.setBadgeText({ text });
  } catch (err) {
    logError("Background", "setToolbarBadge failed", err);
  }
}

async function resolveActiveTabId() {
  if (activeTabId != null) return activeTabId;
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTabId = active?.id ?? null;
  return activeTabId;
}

async function syncToolbarBadge() {
  const tabId = await resolveActiveTabId();
  if (tabId == null) {
    await setToolbarBadge(0);
    return;
  }
  const cached = tabCache.get(tabId);
  await setToolbarBadge(cached?.count ?? 0);
}

function storeResult(tabId, url, result) {
  const count = result.technologies?.length || 0;
  const entry = {
    url,
    result,
    analyzedAt: Date.now(),
    count,
  };
  tabCache.set(tabId, entry);
  return entry;
}

/**
 * @param {number} tabId
 * @param {string} url
 * @param {{ force?: boolean, reason?: string, collection?: object }} [options]
 */
async function analyzeTab(tabId, url, options = {}) {
  const { force = false, reason = "manual", collection = null } = options;
  const check = inspectUrl(url);

  if (!check.analyzable) {
    tabCache.delete(tabId);
    if (tabId === activeTabId) await setToolbarBadge(0);
    return null;
  }

  const cached = tabCache.get(tabId);
  const isDelayScan = String(reason).startsWith("delay-");

  if (!force && cached?.url === url && !collection) {
    if (!isDelayScan) {
      if (tabId === activeTabId) await setToolbarBadge(cached.count);
      return cached;
    }
    if (Date.now() - cached.analyzedAt < 1200) {
      return cached;
    }
  }

  if (pending.has(tabId)) {
    if (tabId === activeTabId && cached) await setToolbarBadge(cached.count);
    return cached || null;
  }

  pending.add(tabId);
  log("Background", "analyzeTab", { tabId, url, reason, force, preCollected: Boolean(collection) });

  try {
    const out = await runTabAnalysis(tabId, url, { collection });
    if (!out.ok) {
      tabCache.delete(tabId);
      if (tabId === activeTabId) await setToolbarBadge(0);
      return null;
    }

    const count = out.result.technologies?.length || 0;
    const prev = tabCache.get(tabId);

    if (
      prev?.url === url &&
      prev.count >= count &&
      isDelayScan &&
      Date.now() - prev.analyzedAt < 8000
    ) {
      if (tabId === activeTabId) await setToolbarBadge(prev.count);
      return prev;
    }

    const entry = storeResult(tabId, url, out.result);

    if (tabId === activeTabId) {
      await setToolbarBadge(entry.count);
    }

    log("Background", "analyzeTab done", { tabId, count, reason });
    return entry;
  } catch (err) {
    logError("Background", "analyzeTab failed", err);
    const fallback = tabCache.get(tabId);
    if (tabId === activeTabId && fallback) await setToolbarBadge(fallback.count);
    return fallback || null;
  } finally {
    pending.delete(tabId);
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab?.url) return;
  analyzeTab(tabId, tab.url, { reason: "tab-complete" }).catch((err) =>
    logError("Background", "onUpdated", err)
  );
});

chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  activeTabId = tabId;
  chrome.tabs
    .get(tabId)
    .then((tab) => {
      if (!tab?.url) return syncToolbarBadge();
      const cached = tabCache.get(tabId);
      if (cached?.url === tab.url) {
        return syncToolbarBadge();
      }
      return analyzeTab(tabId, tab.url, { reason: "tab-activated" });
    })
    .catch((err) => logError("Background", "onActivated", err));
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabCache.delete(tabId);
  pending.delete(tabId);
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  chrome.tabs.query({ active: true, windowId }).then((tabs) => {
    if (tabs[0]?.id != null) {
      activeTabId = tabs[0].id;
      syncToolbarBadge().catch(() => {});
    }
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "PAGE_COLLECTED") {
    const tabId = sender.tab?.id;
    const url = message.url || sender.tab?.url;
    if (tabId != null && url) {
      analyzeTab(tabId, url, {
        reason: message.reason || "page-collected",
        collection: message.collection,
      }).catch((err) => logError("Background", "PAGE_COLLECTED", err));
    }
    return false;
  }

  if (message?.type === "PAGE_READY") {
    const tabId = sender.tab?.id;
    const url = message.url || sender.tab?.url;
    if (tabId != null && url) {
      analyzeTab(tabId, url, { reason: message.reason || "page-ready" }).catch((err) =>
        logError("Background", "PAGE_READY", err)
      );
    }
    return false;
  }

  if (message?.type === "UPDATE_BADGE") {
    const tabId = message.tabId ?? sender.tab?.id;
    const count = Number(message.count) || 0;
    if (tabId != null && message.result) {
      storeResult(tabId, message.url || "", message.result);
    }
    if (tabId === activeTabId || tabId == null) {
      setToolbarBadge(count).catch(() => {});
    }
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "GET_TAB_RESULT") {
    sendResponse({ cached: tabCache.get(message.tabId) || null });
    return false;
  }

  if (message?.type === "ANALYZE_TAB") {
    chrome.tabs
      .get(message.tabId)
      .then((tab) => {
        if (!tab?.url) {
          sendResponse({ cached: null, error: "Tab has no URL." });
          return;
        }
        return analyzeTab(message.tabId, tab.url, {
          force: Boolean(message.force),
          reason: message.force ? "popup-refresh" : "popup-open",
        });
      })
      .then((cached) => {
        sendResponse({ cached: cached || tabCache.get(message.tabId) || null });
      })
      .catch((err) => {
        sendResponse({
          cached: null,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    return true;
  }

  return false;
});

async function bootstrap() {
  initBadgeColors();

  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (active?.id != null) {
    activeTabId = active.id;
    if (active.url) {
      await analyzeTab(active.id, active.url, { reason: "startup-active" });
    } else {
      await syncToolbarBadge();
    }
  }

  const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
  for (const tab of tabs) {
    if (tab.id != null && tab.url && tab.id !== activeTabId) {
      analyzeTab(tab.id, tab.url, { reason: "startup" }).catch((err) =>
        logError("Background", "startup analyze", err)
      );
    }
  }
}

bootstrap().catch((err) => logError("Background", "bootstrap", err));
