/**
 * Detection engine — technologies + SEO + security + performance.
 */

import { log } from "../utils/logger.js";
import { buildCorpus, matchAllTechnologies } from "./pattern-matcher.js";
import { loadTechnologies, extractProbes } from "../technologies/load-technologies.js";
import { analyzeSeo } from "../seo/seo-analyzer.js";
import { analyzeSecurity } from "../security/security-analyzer.js";
import { analyzePerformance } from "../performance/performance-analyzer.js";
import { enrichWordPress } from "./wordpress-enricher.js";
import { enrichProtocolAndHeaders } from "./header-enricher.js";

/**
 * @typedef {object} AnalysisResult
 * @property {string} version
 * @property {string} analyzedAt
 * @property {"full_mvp_analysis"} phase
 * @property {object} overview
 * @property {Array<object>} technologies
 * @property {Record<string, object[]>} technologiesByCategory
 * @property {object} seo
 * @property {object} security
 * @property {object} performance
 * @property {string[]} notes
 * @property {object} raw
 */

export async function prepareDetection() {
  const defs = await loadTechnologies();
  const probes = extractProbes(defs);
  return { defs, probes };
}

/**
 * @param {object} collection
 * @param {object} probeData
 * @param {object[]} defs
 * @param {{ headers?: object, cookieSecurity?: object }} [extras]
 * @returns {AnalysisResult}
 */
export function analyzeSignals(collection, probeData = {}, defs = [], extras = {}) {
  log("Engine", "analyzeSignals started");

  const signals = collection?.signals || {};
  const page = signals.page || {};
  const meta = signals.meta || {};
  const scripts = signals.scripts || {};
  const links = signals.links || {};
  const cookies = signals.cookies || {};
  const dom = signals.dom || {};

  const corpus = buildCorpus(signals, probeData);
  let technologies = matchAllTechnologies(defs, corpus);

  const wpEnrichment = enrichWordPress(signals, technologies);
  technologies = wpEnrichment.technologies;

  const seo = analyzeSeo(signals);
  const security = analyzeSecurity({
    signals,
    headers: extras.headers || {},
    cookieSecurity: extras.cookieSecurity || {},
  });
  const performance = analyzePerformance(signals.performance || {});

  technologies = enrichProtocolAndHeaders(technologies, {
    ...extras,
    pageUrl: page.href || "",
  }, performance);
  const technologiesByCategory = groupByCategory(technologies);

  const httpOnlyCount = Array.isArray(extras.cookieSecurity?.cookies)
    ? extras.cookieSecurity.cookies.filter((c) => c.httpOnly).length
    : 0;

  const overview = {
    url: page.href || "",
    domain: page.hostname || "",
    protocol: page.protocol || "",
    title: page.title || "",
    metaCount: meta.count || 0,
    scriptCount: (scripts.externalCount || 0) + (scripts.inlineCount || 0),
    externalScriptCount: scripts.externalCount || 0,
    stylesheetCount: links.stylesheetCount || 0,
    cookieNameCount: cookies.count || 0,
    httpOnlyCount,
    elementCount: dom.elementCount || 0,
    imageCount: dom.imageCount || 0,
    iframeCount: dom.iframeCount || 0,
    formCount: dom.formCount || 0,
    language: page.language || "",
    collectorErrorCount: Array.isArray(collection?.collectorErrors)
      ? collection.collectorErrors.length
      : 0,
    technologyCount: technologies.length,
    seoPass: seo.summary.pass,
    seoWarn: seo.summary.warn,
    seoFail: seo.summary.fail,
    securityPass: security.summary.pass,
    securityWarn: security.summary.warn,
    securityFail: security.summary.fail,
    performancePass: performance.summary.pass,
    performanceWarn: performance.summary.warn,
    performanceFail: performance.summary.fail,
    performanceRequests: performance.metrics?.requestCount ?? null,
  };

  const notes = [
    technologies.length === 0
      ? "No registered technologies matched with sufficient confidence."
      : `Detected ${technologies.length} technolog${technologies.length === 1 ? "y" : "ies"}.`,
    `SEO: ${seo.summary.pass} pass / ${seo.summary.warn} warn / ${seo.summary.fail} fail.`,
    `Security: ${security.summary.pass} pass / ${security.summary.warn} warn / ${security.summary.fail} fail.`,
    `Performance: ${performance.summary.pass} pass / ${performance.summary.warn} warn / ${performance.summary.fail} fail.`,
  ];

  /** @type {AnalysisResult} */
  const result = {
    version: "0.9.5",
    analyzedAt: new Date().toISOString(),
    phase: "full_mvp_analysis",
    overview,
    technologies,
    technologiesByCategory,
    wordpress: wpEnrichment.wordpress,
    seo,
    security,
    performance,
    notes,
    raw: {
      collectedAt: collection?.collectedAt || null,
      collectorErrors: collection?.collectorErrors || [],
      probes: probeData,
      securityHeaders: extras.headers
        ? {
            available: extras.headers.available,
            status: extras.headers.status,
            headersFound: Object.keys(extras.headers.headers || {}),
          }
        : null,
      cookieSecurity: extras.cookieSecurity
        ? {
            available: extras.cookieSecurity.available,
            count: (extras.cookieSecurity.cookies || []).length,
          }
        : null,
      performance: performance.metrics
        ? {
            requestCount: performance.metrics.requestCount,
            totalBytes: performance.metrics.totalBytes,
            thirdPartyCount: performance.metrics.thirdPartyCount,
          }
        : null,
      signals: {
        ...signals,
        html: signals.html
          ? {
              sampleLength: signals.html.sampleLength,
              urlPool: signals.html.urlPool,
            }
          : null,
        // Keep performance summary only in raw (resources can be large)
        performance: signals.performance
          ? {
              available: signals.performance.available,
              resourceCountObserved: signals.performance.resourceCountObserved,
              navigation: signals.performance.navigation,
              paint: signals.performance.paint,
              lcp: signals.performance.lcp,
            }
          : null,
      },
    },
  };

  log("Engine", "analyzeSignals completed", {
    domain: overview.domain,
    technologies: technologies.length,
    performanceRequests: overview.performanceRequests,
  });

  return result;
}

function groupByCategory(technologies) {
  /** @type {Record<string, object[]>} */
  const groups = {};
  for (const tech of technologies) {
    const key = tech.category || "Other";
    if (!groups[key]) groups[key] = [];
    groups[key].push(tech);
  }
  return groups;
}
