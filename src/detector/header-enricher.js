/**
 * Extra detections from headers / navigation protocol (report-quality only).
 */

import { createEvidence } from "./evidence.js";

/**
 * @param {object[]} technologies
 * @param {{ headers?: object }} extras
 * @param {object} performanceResult
 * @returns {object[]}
 */
export function enrichProtocolAndHeaders(technologies, extras = {}, performanceResult = {}) {
  const list = [...technologies];
  const byId = new Set(list.map((t) => t.id));
  const headers = extras.headers?.headers || {};

  if (headers["strict-transport-security"] && !byId.has("hsts")) {
    list.push({
      id: "hsts",
      name: "HSTS",
      category: "Security",
      description: "HTTP Strict Transport Security",
      website: "",
      visibility: "client",
      confidence: 95,
      label: "Confirmed",
      evidence: [
        createEvidence("header", `Strict-Transport-Security: ${String(headers["strict-transport-security"]).slice(0, 80)}`),
      ],
      evidenceCount: 1,
      version: null,
      implies: [],
      implied: false,
    });
    byId.add("hsts");
  }

  const proto =
    performanceResult?.metrics?.navigation?.nextHopProtocol ||
    extras.performanceNav?.nextHopProtocol ||
    "";
  if (/^h2/i.test(proto) && !byId.has("http2")) {
    list.push({
      id: "http2",
      name: "HTTP/2",
      category: "Other",
      description: "HTTP/2 protocol",
      website: "",
      visibility: "client",
      confidence: 95,
      label: "Confirmed",
      evidence: [createEvidence("protocol", `nextHopProtocol=${proto}`)],
      evidenceCount: 1,
      version: null,
      implies: [],
      implied: false,
    });
  }

  return list;
}
