/**
 * Pattern matcher — JSON definitions against page signals.
 * Only report-quality hits (Detected / Confirmed). No Possible noise.
 */

import { clampConfidence, confidenceLabel } from "./confidence.js";
import { createEvidence } from "./evidence.js";
import { log, logError } from "../utils/logger.js";

/** Minimum score to surface a technology in the UI */
const REPORT_MIN = 70;

function toRegex(pattern, flags = "i") {
  try {
    return new RegExp(pattern, flags || "i");
  } catch (err) {
    logError("Matcher", `Invalid regex: ${pattern}`, err);
    return null;
  }
}

/**
 * @param {object} signals
 * @param {{ globals?: Record<string, string>, selectors?: Record<string, number>, versions?: Record<string, string> }} probes
 */
export function buildCorpus(signals, probes = {}) {
  const scripts = (signals.scripts?.external || []).map((s) => s.src || "");
  const links = (signals.links?.items || []).map((l) => `${l.rel || ""} ${l.href || ""}`);
  const metas = (signals.meta?.items || []).map((m) => ({
    name: (m.name || "").toLowerCase(),
    content: m.content || "",
  }));
  const cookies = signals.cookies?.names || [];
  const htmlSample = signals.html?.sample || "";
  const iframes = signals.dom?.iframeSrcs || [];
  const urlPool = [
    ...(signals.html?.urlPool || []),
    signals.page?.href || "",
    signals.page?.pathname || "",
    ...scripts,
    ...links,
    ...iframes,
  ].filter(Boolean);

  return {
    scripts,
    links,
    metas,
    cookies,
    htmlSample,
    urlPool,
    iframes,
    globals: probes.globals || {},
    selectors: probes.selectors || {},
    versionHints: probes.versions || {},
  };
}

/**
 * @param {object} def
 * @param {ReturnType<typeof buildCorpus>} corpus
 * @returns {object | null}
 */
export function matchTechnology(def, corpus) {
  log("Detector", `${def.name} started`);

  try {
    const evidence = [];
    let score = 0;
    const matchedTypes = new Set();

    for (const pattern of def.patterns || []) {
      const hit = testPattern(pattern, corpus);
      if (!hit) continue;

      score += Number(pattern.confidence) || 0;
      matchedTypes.add(pattern.type);
      evidence.push(
        createEvidence(pattern.type, pattern.evidence || `${pattern.type} pattern matched`)
      );
    }

    if (matchedTypes.size >= 3) score += 12;
    else if (matchedTypes.size === 2) score += 6;

    score = clampConfidence(Math.min(score, 99));
    const min = Math.max(def.minConfidence ?? REPORT_MIN, REPORT_MIN);

    // Server-inferred: never show weak guesses; require reportable score.
    if (def.visibility === "server-inferred") {
      score = clampConfidence(Math.min(score, 85));
    }

    if (score < min || evidence.length === 0) {
      log("Detector", `${def.name} rejected`, { score, min });
      return null;
    }

    const version = detectVersion(def, corpus);
    let displayLabel = confidenceLabel(score);
    if (displayLabel === "Likely" || displayLabel === "Possible") {
      log("Detector", `${def.name} rejected weak label`, { score, displayLabel });
      return null;
    }

    if (def.visibility === "server-inferred") {
      displayLabel = "Detected";
    }

    const result = {
      id: def.id,
      name: def.name,
      category: def.category,
      description: def.description || "",
      website: def.website || "",
      visibility: def.visibility || "client",
      confidence: score,
      label: displayLabel,
      evidence,
      evidenceCount: evidence.length,
      version: version || null,
      implies: def.implies || [],
      implied: false,
    };

    log("Detected", def.name, { confidence: score, label: displayLabel, evidence: evidence.length });
    return result;
  } catch (err) {
    logError("Detector", `${def.name} failed`, err);
    return null;
  }
}

function testPattern(pattern, corpus) {
  const type = pattern.type;

  if (type === "script") {
    const re = toRegex(pattern.pattern, pattern.flags);
    if (!re) return false;
    return corpus.scripts.some((src) => re.test(src));
  }

  if (type === "link") {
    const re = toRegex(pattern.pattern, pattern.flags);
    if (!re) return false;
    return corpus.links.some((href) => re.test(href));
  }

  if (type === "url") {
    const re = toRegex(pattern.pattern, pattern.flags);
    if (!re) return false;
    return corpus.urlPool.some((u) => re.test(u));
  }

  if (type === "html") {
    const re = toRegex(pattern.pattern, pattern.flags);
    if (!re) return false;
    return re.test(corpus.htmlSample);
  }

  if (type === "cookie") {
    const re = toRegex(pattern.pattern, pattern.flags);
    if (!re) return false;
    return corpus.cookies.some((name) => re.test(name));
  }

  if (type === "meta") {
    const re = toRegex(pattern.pattern, pattern.flags);
    if (!re) return false;
    const want = (pattern.name || "").toLowerCase();
    return corpus.metas.some((m) => {
      if (want && m.name !== want) return false;
      return re.test(m.content) || re.test(m.name);
    });
  }

  if (type === "iframe") {
    const re = toRegex(pattern.pattern, pattern.flags);
    if (!re) return false;
    return corpus.iframes.some((src) => re.test(src)) || re.test(corpus.htmlSample);
  }

  if (type === "global") {
    return Object.prototype.hasOwnProperty.call(corpus.globals, pattern.pattern);
  }

  if (type === "selector") {
    const count = corpus.selectors[pattern.pattern];
    return typeof count === "number" && count > 0;
  }

  return false;
}

function detectVersion(def, corpus) {
  for (const rule of def.versionPatterns || []) {
    if (rule.type === "meta") {
      const re = toRegex(rule.pattern, rule.flags);
      if (!re) continue;
      const want = (rule.name || "").toLowerCase();
      for (const m of corpus.metas) {
        if (want && m.name !== want) continue;
        const match = m.content.match(re);
        if (match && match[1]) return match[1];
      }
    }

    if (rule.type === "globalPath") {
      const val = corpus.versionHints[rule.path];
      if (val) return String(val);
    }

    if (rule.type === "selectorAttr") {
      const key = `${rule.selector}::${rule.attr}`;
      const val = corpus.versionHints[key];
      if (val) return String(val);
    }
  }
  return null;
}

/**
 * @param {object[]} defs
 * @param {ReturnType<typeof buildCorpus>} corpus
 * @returns {object[]}
 */
export function matchAllTechnologies(defs, corpus) {
  const found = [];
  const byId = new Map();

  for (const def of defs) {
    try {
      const hit = matchTechnology(def, corpus);
      if (hit) {
        found.push(hit);
        byId.set(hit.id, hit);
      }
    } catch (err) {
      logError("Matcher", `Unhandled failure for ${def?.id}`, err);
    }
  }

  applyImplies(found, byId, defs);

  found.sort((a, b) => {
    if (Boolean(a.implied) !== Boolean(b.implied)) return a.implied ? 1 : -1;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return a.name.localeCompare(b.name);
  });

  return found;
}

/**
 * Add implied technologies (e.g. Next.js → React, WordPress → PHP).
 */
function applyImplies(found, byId, defs) {
  const defById = new Map(defs.map((d) => [d.id, d]));

  for (const hit of [...found]) {
    for (const implyId of hit.implies || []) {
      if (byId.has(implyId)) continue;
      const def = defById.get(implyId);
      const name = def?.name || implyId;
      const category = def?.category || "Other";
      const implied = {
        id: implyId,
        name,
        category,
        description: def?.description || `Implied by ${hit.name}`,
        website: def?.website || "",
        visibility: def?.visibility || "client",
        confidence: Math.min(hit.confidence, 88),
        label: "Detected",
        evidence: [createEvidence("implied", `Implied by ${hit.name}`)],
        evidenceCount: 1,
        version: null,
        implies: [],
        implied: true,
      };
      found.push(implied);
      byId.set(implyId, implied);
      log("Detected", `${name} (implied)`, { by: hit.name });
    }
  }
}
