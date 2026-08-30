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

  const pageUrl = String(extras.pageUrl || "").toLowerCase();

  addPlatformFromHeaders(list, byId, headers, server, via, poweredBy, pageUrl);

  return list;
}

/**
 * Detect PaaS / IaaS platforms from response headers and page URL.
 */
function addPlatformFromHeaders(list, byId, headers, server, via, poweredBy, pageUrl) {
  const combined = `${server} ${via} ${poweredBy}`.toLowerCase();

  const checks = [
    {
      id: "vercel",
      name: "Vercel",
      category: "PaaS",
      description: "Frontend cloud platform",
      match:
        headers["x-vercel-id"] ||
        headers["x-vercel-cache"] ||
        /vercel/i.test(server) ||
        /vercel\.app|\.vercel\.com/.test(pageUrl),
      detail: headers["x-vercel-id"]
        ? `X-Vercel-Id: ${headers["x-vercel-id"]}`
        : `Server: ${server || pageUrl}`,
    },
    {
      id: "netlify",
      name: "Netlify",
      category: "PaaS",
      description: "Web development platform",
      match:
        headers["x-nf-request-id"] ||
        /netlify/i.test(server) ||
        /netlify\.app|netlifyusercontent\.com/.test(pageUrl),
      detail: headers["x-nf-request-id"]
        ? `X-NF-Request-Id present`
        : `Server: ${server || pageUrl}`,
    },
    {
      id: "heroku",
      name: "Heroku",
      category: "PaaS",
      description: "Cloud application platform",
      match: /heroku/i.test(via) || /heroku/i.test(poweredBy) || /herokuapp\.com/.test(pageUrl),
      detail: via ? `Via: ${via}` : pageUrl,
    },
    {
      id: "render",
      name: "Render",
      category: "PaaS",
      description: "Unified cloud platform",
      match: headers["x-render-origin-server"] || /onrender\.com/.test(pageUrl),
      detail: headers["x-render-origin-server"]
        ? `X-Render-Origin-Server: ${headers["x-render-origin-server"]}`
        : pageUrl,
    },
    {
      id: "fly-io",
      name: "Fly.io",
      category: "PaaS",
      description: "Global application platform",
      match: headers["fly-request-id"] || /fly\.dev/.test(pageUrl),
      detail: headers["fly-request-id"] ? "Fly-Request-Id present" : pageUrl,
    },
    {
      id: "google-app-engine",
      name: "Google App Engine",
      category: "PaaS",
      description: "Google managed app platform",
      match:
        (headers["x-cloud-trace-context"] && /google/i.test(server)) ||
        /appspot\.com/.test(pageUrl),
      detail: headers["x-cloud-trace-context"] ? "X-Cloud-Trace-Context present" : pageUrl,
    },
    {
      id: "azure-app-service",
      name: "Azure App Service",
      category: "PaaS",
      description: "Azure managed web apps",
      match:
        headers["x-azure-ref"] ||
        headers["x-ms-request-id"] ||
        /azurewebsites\.net|azurestaticapps\.net/.test(pageUrl),
      detail: headers["x-azure-ref"] ? `X-Azure-Ref: ${headers["x-azure-ref"]}` : pageUrl,
    },
    {
      id: "aws",
      name: "Amazon Web Services",
      category: "IaaS",
      description: "Amazon cloud infrastructure",
      match:
        headers["x-amz-request-id"] ||
        headers["x-amz-apigw-id"] ||
        headers["x-amz-cf-id"] ||
        /amazonaws\.com/.test(pageUrl),
      detail: headers["x-amz-request-id"]
        ? `X-Amz-Request-Id present`
        : headers["x-amz-cf-id"]
          ? `X-Amz-Cf-Id present`
          : pageUrl,
    },
    {
      id: "microsoft-azure",
      name: "Microsoft Azure",
      category: "IaaS",
      description: "Microsoft cloud infrastructure",
      match:
        headers["x-azure-ref"] ||
        headers["x-ms-request-id"] ||
        /blob\.core\.windows\.net|azureedge\.net/.test(pageUrl),
      detail: headers["x-azure-ref"] ? `X-Azure-Ref present` : pageUrl,
    },
    {
      id: "cloudflare-pages",
      name: "Cloudflare Pages",
      category: "PaaS",
      description: "Cloudflare JAMstack hosting",
      match: /pages\.dev/.test(pageUrl) || headers["cf-pages"],
      detail: pageUrl || "CF-Pages header present",
    },
    {
      id: "railway",
      name: "Railway",
      category: "PaaS",
      description: "Modern app deployment platform",
      match: /railway\.app|up\.railway\.app/.test(pageUrl),
      detail: pageUrl,
    },
    {
      id: "digitalocean",
      name: "DigitalOcean",
      category: "IaaS",
      description: "Cloud infrastructure provider",
      match: /digitaloceanspaces\.com|ondigitalocean\.app/.test(pageUrl),
      detail: pageUrl,
    },
  ];

  for (const item of checks) {
    if (!item.match || byId.has(item.id)) continue;
    list.push(makeHeaderTech({
      id: item.id,
      name: item.name,
      category: item.category,
      description: item.description,
      detail: String(item.detail).slice(0, 120),
    }));
    byId.add(item.id);
  }
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
