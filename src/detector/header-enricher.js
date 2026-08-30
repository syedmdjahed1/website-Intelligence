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
    list.push(makeHeaderTech({
      id: "hsts",
      name: "HSTS",
      category: "Security",
      description: "HTTP Strict Transport Security",
      detail: `Strict-Transport-Security: ${String(headers["strict-transport-security"]).slice(0, 80)}`,
    }));
    byId.add("hsts");
  }

  const proto =
    performanceResult?.metrics?.navigation?.nextHopProtocol ||
    extras.performanceNav?.nextHopProtocol ||
    "";
  if (/^h2/i.test(proto) && !byId.has("http2")) {
    list.push(makeHeaderTech({
      id: "http2",
      name: "HTTP/2",
      category: "Miscellaneous",
      description: "HTTP/2 protocol",
      detail: `nextHopProtocol=${proto}`,
      evidenceType: "protocol",
    }));
    byId.add("http2");
  }

  const server = String(headers.server || "");
  const poweredBy = String(headers["x-powered-by"] || "");
  const via = String(headers.via || "");
  const combined = `${server} ${poweredBy} ${via}`.toLowerCase();

  if (/nginx/i.test(combined) && !byId.has("nginx")) {
    list.push(makeHeaderTech({
      id: "nginx",
      name: "nginx",
      category: "Hosting & Server",
      description: "nginx web server or reverse proxy",
      detail: server ? `Server: ${server}` : `Via: ${via}`,
    }));
    byId.add("nginx");
  }

  if (/apache/i.test(combined) && !byId.has("apache")) {
    list.push(makeHeaderTech({
      id: "apache",
      name: "Apache",
      category: "Hosting & Server",
      description: "Apache HTTP Server",
      detail: server ? `Server: ${server}` : `X-Powered-By: ${poweredBy}`,
    }));
    byId.add("apache");
  }

  if (/microsoft-iis|iis\/\d/i.test(combined) && !byId.has("iis")) {
    list.push(makeHeaderTech({
      id: "iis",
      name: "Microsoft IIS",
      category: "Hosting & Server",
      description: "Internet Information Services",
      detail: server ? `Server: ${server}` : `X-Powered-By: ${poweredBy}`,
    }));
    byId.add("iis");
  }

  if (/litespeed/i.test(combined) && !byId.has("litespeed")) {
    list.push(makeHeaderTech({
      id: "litespeed",
      name: "LiteSpeed",
      category: "Hosting & Server",
      description: "LiteSpeed web server",
      detail: server ? `Server: ${server}` : `X-Powered-By: ${poweredBy}`,
    }));
    byId.add("litespeed");
  }

  if ((headers["x-varnish"] || /varnish/i.test(via)) && !byId.has("varnish")) {
    list.push(makeHeaderTech({
      id: "varnish",
      name: "Varnish",
      category: "Reverse Proxy",
      description: "Varnish HTTP accelerator",
      detail: headers["x-varnish"] ? `X-Varnish: ${headers["x-varnish"]}` : `Via: ${via}`,
    }));
    byId.add("varnish");
  }

  if (/haproxy/i.test(combined) && !byId.has("haproxy")) {
    list.push(makeHeaderTech({
      id: "haproxy",
      name: "HAProxy",
      category: "Reverse Proxy",
      description: "HAProxy load balancer / reverse proxy",
      detail: server ? `Server: ${server}` : `Via: ${via}`,
    }));
    byId.add("haproxy");
  }

  return list;
}

function makeHeaderTech({ id, name, category, description, detail, evidenceType = "header" }) {
  return {
    id,
    name,
    category,
    description,
    website: "",
    visibility: "server-inferred",
    confidence: 95,
    label: "Detected",
    evidence: [createEvidence(evidenceType, detail)],
    evidenceCount: 1,
    version: null,
    implies: [],
    implied: false,
  };
}
