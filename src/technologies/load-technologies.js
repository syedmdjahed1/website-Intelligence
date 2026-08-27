/**
 * Loads technology definitions from JSON via the extension package URL.
 */

import { log, logError } from "../utils/logger.js";

let cached = null;

/**
 * @returns {Promise<object[]>}
 */
export async function loadTechnologies() {
  if (cached) return cached;

  const indexUrl = chrome.runtime.getURL("src/technologies/technology-index.json");
  const index = await fetch(indexUrl).then((r) => {
    if (!r.ok) throw new Error("Failed to load technology-index.json");
    return r.json();
  });

  const list = Array.isArray(index.technologies) ? index.technologies : [];
  const defs = [];

  for (const rel of list) {
    try {
      const url = chrome.runtime.getURL(`src/technologies/${rel}`);
      const def = await fetch(url).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      });
      if (def && def.id && def.name) {
        defs.push(def);
      }
    } catch (err) {
      logError("TechLoader", `Failed to load ${rel}`, err);
    }
  }

  cached = defs;
  log("TechLoader", "loaded definitions", { count: defs.length });
  return defs;
}

/**
 * Collect probe targets from all definitions.
 * @param {object[]} defs
 */
export function extractProbes(defs) {
  const globals = new Set();
  const selectors = new Set();

  for (const def of defs) {
    for (const p of def.patterns || []) {
      if (p.type === "global" && p.pattern) globals.add(p.pattern);
      if (p.type === "selector" && p.pattern) selectors.add(p.pattern);
    }
    for (const v of def.versionPatterns || []) {
      if (v.type === "globalPath" && v.path) {
        globals.add(v.path.split(".")[0]);
      }
      if (v.type === "selectorAttr" && v.selector) {
        selectors.add(v.selector);
      }
    }
  }

  return {
    globals: [...globals],
    selectors: [...selectors],
  };
}
