/**
 * Deep WordPress enrichment — themes, plugins, core paths from public URLs/HTML.
 */

import { log } from "../utils/logger.js";
import { createEvidence } from "./evidence.js";

const THEME_RE = /\/wp-content\/themes\/([a-zA-Z0-9_-]+)/gi;
const PLUGIN_RE = /\/wp-content\/plugins\/([a-zA-Z0-9_-]+)/gi;
const MU_PLUGIN_RE = /\/wp-content\/mu-plugins\/([a-zA-Z0-9_-]+)/gi;

/**
 * @param {object} signals
 * @param {object[]} technologies
 * @returns {{ technologies: object[], wordpress: object | null }}
 */
export function enrichWordPress(signals, technologies) {
  const wp = technologies.find((t) => t.id === "wordpress" && !t.implied);
  if (!wp) {
    return { technologies, wordpress: null };
  }

  log("WordPress", "enrichment started");

  const blob = buildSearchBlob(signals);
  const themes = uniqueSlugs(blob, THEME_RE).filter((s) => s.toLowerCase() !== "twentytwentyfour-placeholder");
  const plugins = uniqueSlugs(blob, PLUGIN_RE);
  const muPlugins = uniqueSlugs(blob, MU_PLUGIN_RE);

  const version = wp.version || extractVersion(signals) || null;
  const hasRest = /\/wp-json\//i.test(blob);
  const hasBlock = /wp-block-|wp-includes\/js\/dist\//i.test(blob);
  const hasWoo = plugins.some((p) => p.toLowerCase() === "woocommerce") || /\/woocommerce\//i.test(blob);

  const extras = [];

  for (const slug of themes) {
    extras.push(
      makeWpChild({
        id: `wp-theme-${slug}`,
        name: humanize(slug),
        category: "WordPress Theme",
        description: `WordPress theme (${slug})`,
        parent: "wordpress",
        slug,
        kind: "theme",
      })
    );
  }

  for (const slug of plugins) {
    extras.push(
      makeWpChild({
        id: `wp-plugin-${slug}`,
        name: humanize(slug),
        category: "WordPress Plugin",
        description: `WordPress plugin (${slug})`,
        parent: "wordpress",
        slug,
        kind: "plugin",
      })
    );
  }

  // PHP is implied by confirmed WordPress
  if (!technologies.some((t) => t.id === "php")) {
    extras.push({
      id: "php",
      name: "PHP",
      category: "Programming Language",
      description: "Server-side language (implied by WordPress)",
      website: "https://www.php.net",
      visibility: "server-inferred",
      confidence: Math.min(wp.confidence, 85),
      label: "Detected",
      evidence: [createEvidence("implied", "Implied by WordPress")],
      evidenceCount: 1,
      version: null,
      implies: [],
      implied: true,
    });
  }

  if (hasWoo && !technologies.some((t) => t.id === "woocommerce") && !extras.some((t) => t.id === "woocommerce")) {
    extras.push({
      id: "woocommerce",
      name: "WooCommerce",
      category: "CMS",
      description: "WordPress e-commerce plugin",
      website: "https://woocommerce.com",
      visibility: "client",
      confidence: 90,
      label: "Confirmed",
      evidence: [createEvidence("path", "WooCommerce plugin path detected")],
      evidenceCount: 1,
      version: null,
      implies: [],
      implied: false,
    });
  }

  const wordpress = {
    detected: true,
    version,
    themeCount: themes.length,
    pluginCount: plugins.length,
    muPluginCount: muPlugins.length,
    themes: themes.map((slug) => ({ slug, name: humanize(slug) })),
    plugins: plugins.map((slug) => ({ slug, name: humanize(slug) })),
    muPlugins: muPlugins.map((slug) => ({ slug, name: humanize(slug) })),
    restApi: hasRest,
    blockEditor: hasBlock,
    woocommerce: hasWoo,
  };

  wp.details = wordpress;

  const merged = [...technologies, ...extras];
  log("WordPress", "enrichment completed", {
    themes: themes.length,
    plugins: plugins.length,
    version,
  });

  return { technologies: merged, wordpress };
}

function buildSearchBlob(signals) {
  const parts = [];
  for (const s of signals.scripts?.external || []) parts.push(s.src || "");
  for (const l of signals.links?.items || []) parts.push(l.href || "");
  for (const src of signals.dom?.iframeSrcs || []) parts.push(src || "");
  parts.push(signals.html?.sample || "");
  parts.push(signals.page?.href || "");
  return parts.join("\n");
}

function uniqueSlugs(blob, re) {
  const set = new Set();
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(blob))) {
    const slug = m[1];
    if (!slug) continue;
    // Skip common non-theme path segments
    if (/^(themes|plugins|mu-plugins)$/i.test(slug)) continue;
    set.add(slug);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

function extractVersion(signals) {
  const items = signals.meta?.items || [];
  for (const m of items) {
    if (String(m.name || "").toLowerCase() !== "generator") continue;
    const match = String(m.content || "").match(/WordPress\s+([0-9]+(?:\.[0-9]+)*)/i);
    if (match) return match[1];
  }
  return null;
}

function humanize(slug) {
  return String(slug)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function makeWpChild({ id, name, category, description, parent, slug, kind }) {
  return {
    id,
    name,
    category,
    description,
    website: "",
    visibility: "client",
    confidence: 92,
    label: "Confirmed",
    evidence: [
      createEvidence(
        "path",
        kind === "theme"
          ? `Theme path /wp-content/themes/${slug}/`
          : `Plugin path /wp-content/plugins/${slug}/`
      ),
    ],
    evidenceCount: 1,
    version: null,
    implies: [],
    implied: false,
    parent,
    slug,
    kind,
  };
}
