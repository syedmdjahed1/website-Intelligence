/**
 * SEO analyzer — checklist of measurable on-page signals only.
 * Does NOT invent a fake 0–100 score. Summary is pass/warn/fail counts.
 */

import { log } from "../utils/logger.js";

/**
 * @typedef {"pass" | "warn" | "fail" | "info"} SeoStatus
 */

/**
 * @param {object} signals
 * @returns {object}
 */
export function analyzeSeo(signals = {}) {
  log("SEO", "analyzeSeo started");

  const page = signals.page || {};
  const metaItems = signals.meta?.items || [];
  const links = signals.links?.items || [];
  const dom = signals.dom || {};

  const title = (page.title || "").trim();
  const description = findMeta(metaItems, ["description"]);
  const robots = findMeta(metaItems, ["robots"]);
  const ogTitle = findMeta(metaItems, ["og:title"]);
  const ogDescription = findMeta(metaItems, ["og:description"]);
  const ogImage = findMeta(metaItems, ["og:image"]);
  const twitterCard = findMeta(metaItems, ["twitter:card"]);
  const canonical = findLink(links, "canonical");

  /** @type {Array<object>} */
  const checks = [];

  checks.push(
    titleCheck(title),
    descriptionCheck(description),
    {
      id: "canonical",
      name: "Canonical link",
      status: canonical ? "pass" : "warn",
      detail: canonical
        ? truncate(canonical, 80)
        : "No rel=canonical link found on this page",
      value: canonical || null,
    },
    {
      id: "robots",
      name: "Robots meta",
      status: robots ? "info" : "info",
      detail: robots ? truncate(robots, 80) : "No robots meta tag (defaults apply)",
      value: robots || null,
    },
    h1Check(dom.h1Count || 0),
    {
      id: "viewport",
      name: "Viewport meta",
      status: dom.hasViewportMeta ? "pass" : "warn",
      detail: dom.hasViewportMeta
        ? "Viewport meta tag present"
        : "Missing viewport meta (mobile rendering may suffer)",
      value: Boolean(dom.hasViewportMeta),
    },
    {
      id: "open-graph",
      name: "Open Graph",
      status: ogTitle && ogDescription ? "pass" : ogTitle || ogImage ? "warn" : "warn",
      detail: summarizeOg(ogTitle, ogDescription, ogImage),
      value: {
        title: ogTitle || null,
        description: ogDescription || null,
        image: ogImage || null,
      },
    },
    {
      id: "twitter-card",
      name: "Twitter Card",
      status: twitterCard ? "pass" : "info",
      detail: twitterCard
        ? `twitter:card=${twitterCard}`
        : "No twitter:card meta tag",
      value: twitterCard || null,
    },
    imageAltCheck(dom.imageCount || 0, dom.imagesMissingAlt || 0),
    {
      id: "json-ld",
      name: "JSON-LD",
      status: (dom.jsonLdCount || 0) > 0 ? "pass" : "info",
      detail:
        (dom.jsonLdCount || 0) > 0
          ? `${dom.jsonLdCount} JSON-LD block(s) found`
          : "No application/ld+json blocks found",
      value: dom.jsonLdCount || 0,
    }
  );

  const summary = {
    pass: checks.filter((c) => c.status === "pass").length,
    warn: checks.filter((c) => c.status === "warn").length,
    fail: checks.filter((c) => c.status === "fail").length,
    info: checks.filter((c) => c.status === "info").length,
    total: checks.length,
  };

  const result = {
    available: true,
    summary,
    checks,
    // Explicitly not a magic quality score
    score: null,
    scoreNote: "No overall SEO score — checklist only",
  };

  log("SEO", "analyzeSeo completed", summary);
  return result;
}

/**
 * @param {Array<{name:string,content:string}>} items
 * @param {string[]} names
 */
function findMeta(items, names) {
  const want = new Set(names.map((n) => n.toLowerCase()));
  for (const item of items) {
    if (want.has(String(item.name || "").toLowerCase())) {
      return String(item.content || "").trim();
    }
  }
  return "";
}

/**
 * @param {Array<{rel:string,href:string}>} items
 * @param {string} rel
 */
function findLink(items, rel) {
  const want = rel.toLowerCase();
  for (const item of items) {
    const rels = String(item.rel || "")
      .toLowerCase()
      .split(/\s+/);
    if (rels.includes(want) && item.href) return String(item.href).trim();
  }
  return "";
}

function titleCheck(title) {
  if (!title) {
    return {
      id: "title",
      name: "Title",
      status: "fail",
      detail: "Page title is missing",
      value: null,
    };
  }
  const len = title.length;
  let status = "pass";
  let detail = `${len} characters`;
  if (len < 10) {
    status = "warn";
    detail = `${len} characters — unusually short`;
  } else if (len > 65) {
    status = "warn";
    detail = `${len} characters — may truncate in SERPs`;
  }
  return {
    id: "title",
    name: "Title",
    status,
    detail: `${truncate(title, 70)} (${detail})`,
    value: title,
  };
}

function descriptionCheck(description) {
  if (!description) {
    return {
      id: "description",
      name: "Meta description",
      status: "warn",
      detail: "Meta description is missing",
      value: null,
    };
  }
  const len = description.length;
  let status = "pass";
  let note = `${len} characters`;
  if (len < 50) {
    status = "warn";
    note = `${len} characters — short`;
  } else if (len > 160) {
    status = "warn";
    note = `${len} characters — may truncate`;
  }
  return {
    id: "description",
    name: "Meta description",
    status,
    detail: `${truncate(description, 70)} (${note})`,
    value: description,
  };
}

function h1Check(count) {
  if (count === 0) {
    return {
      id: "h1",
      name: "H1 heading",
      status: "fail",
      detail: "No H1 found on this page",
      value: 0,
    };
  }
  if (count === 1) {
    return {
      id: "h1",
      name: "H1 heading",
      status: "pass",
      detail: "Exactly one H1 found",
      value: 1,
    };
  }
  return {
    id: "h1",
    name: "H1 heading",
    status: "warn",
    detail: `${count} H1 elements found (usually one is preferred)`,
    value: count,
  };
}

function imageAltCheck(imageCount, missingAlt) {
  if (imageCount === 0) {
    return {
      id: "image-alt",
      name: "Image alt text",
      status: "info",
      detail: "No images on this page",
      value: { imageCount, missingAlt },
    };
  }
  if (missingAlt === 0) {
    return {
      id: "image-alt",
      name: "Image alt text",
      status: "pass",
      detail: `All ${imageCount} images declare an alt attribute`,
      value: { imageCount, missingAlt },
    };
  }
  return {
    id: "image-alt",
    name: "Image alt text",
    status: "warn",
    detail: `${missingAlt} of ${imageCount} images missing alt attribute`,
    value: { imageCount, missingAlt },
  };
}

function summarizeOg(title, description, image) {
  const parts = [];
  if (title) parts.push("title");
  if (description) parts.push("description");
  if (image) parts.push("image");
  if (parts.length === 0) return "No Open Graph tags found";
  return `Present: ${parts.join(", ")}`;
}

function truncate(text, max) {
  const s = String(text);
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}
