/**
 * Lightweight matcher tests (Node, no Chrome required).
 * Run: node tests/detectors/pattern-matcher.test.js
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { buildCorpus, matchTechnology } from "../../src/detector/pattern-matcher.js";
import { enrichWordPress } from "../../src/detector/wordpress-enricher.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "../..");

function loadJson(rel) {
  return JSON.parse(readFileSync(join(root, rel), "utf8"));
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const wordpress = loadJson("src/technologies/cms/wordpress.json");
const react = loadJson("src/technologies/frontend/react.json");
const laravel = loadJson("src/technologies/backend/laravel.json");

// Positive: WordPress
{
  const signals = {
    page: { href: "https://blog.example/post", pathname: "/post", hostname: "blog.example" },
    scripts: {
      external: [
        { src: "https://blog.example/wp-content/themes/twentytwentyfour/app.js" },
        { src: "https://blog.example/wp-content/plugins/contact-form-7/includes/js/index.js" },
        { src: "https://blog.example/wp-content/plugins/yoast-seo/js/dist/addon.js" },
      ],
    },
    links: { items: [{ rel: "stylesheet", href: "/wp-includes/css/admin-bar.min.css" }] },
    meta: { items: [{ name: "generator", content: "WordPress 6.4.2" }] },
    cookies: { names: [] },
    html: {
      sample:
        '<link href="/wp-content/themes/twentytwentyfour/style.css"><script src="/wp-content/plugins/contact-form-7/x.js">',
      urlPool: [],
    },
  };
  const corpus = buildCorpus(signals, { globals: {}, selectors: {} });
  const hit = matchTechnology(wordpress, corpus);
  assert(hit, "WordPress should be detected");
  assert(hit.confidence >= 70, "WordPress confidence too low for report");
  assert(["Confirmed", "Detected"].includes(hit.label), `Unexpected label ${hit.label}`);
  assert(hit.version === "6.4.2", `Expected WP version 6.4.2, got ${hit.version}`);

  const enriched = enrichWordPress(signals, [hit]);
  assert(enriched.wordpress?.themes?.some((t) => t.slug === "twentytwentyfour"), "Theme missing");
  assert(enriched.wordpress?.plugins?.length >= 2, "Plugins missing");
  assert(enriched.technologies.some((t) => t.id === "php" && t.implied), "PHP implied missing");
  console.log("PASS WordPress + enrichment", hit.confidence, enriched.wordpress.pluginCount);
}

// Negative: clean static page
{
  const corpus = buildCorpus(
    {
      page: { href: "https://example.com/", pathname: "/", hostname: "example.com" },
      scripts: { external: [] },
      links: { items: [] },
      meta: { items: [{ name: "viewport", content: "width=device-width" }] },
      cookies: { names: [] },
      html: { sample: "<html><body><h1>Example Domain</h1></body></html>", urlPool: [] },
    },
    { globals: {}, selectors: {} }
  );
  assert(!matchTechnology(wordpress, corpus), "WordPress should not match example.com");
  assert(!matchTechnology(react, corpus), "React should not match example.com");
  console.log("PASS negative static page");
}

// Positive: React via global + DOM
{
  const corpus = buildCorpus(
    {
      page: { href: "https://app.example/", pathname: "/", hostname: "app.example" },
      scripts: { external: [{ src: "https://unpkg.com/react@18/umd/react.production.min.js" }] },
      links: { items: [] },
      meta: { items: [] },
      cookies: { names: [] },
      html: { sample: '<div data-reactroot="">App</div>', urlPool: [] },
    },
    {
      globals: { React: "object", __REACT_DEVTOOLS_GLOBAL_HOOK__: "object" },
      selectors: { "[data-reactroot], [data-reactid], [data-react-helmet], [data-react-checksum]": 1 },
    }
  );
  const hit = matchTechnology(react, corpus);
  assert(hit, "React should be detected");
  assert(hit.confidence >= 70, `React confidence expected high, got ${hit.confidence}`);
  assert(["Confirmed", "Detected"].includes(hit.label), "React should not be Possible/Likely");
  console.log("PASS React positive", hit.confidence, hit.label);
}

// Laravel: report only with strong evidence (no Possible)
{
  const corpus = buildCorpus(
    {
      page: { href: "https://app.example/login", pathname: "/login", hostname: "app.example" },
      scripts: { external: [] },
      links: { items: [] },
      meta: { items: [] },
      cookies: { names: ["laravel_session", "XSRF-TOKEN"] },
      html: { sample: "", urlPool: [] },
    },
    { globals: {}, selectors: {} }
  );
  const hit = matchTechnology(laravel, corpus);
  assert(hit, "Laravel should be detected with laravel_session");
  assert(hit.label === "Detected", `Expected Detected, got ${hit.label}`);
  console.log("PASS Laravel strong", hit.confidence, hit.label);
}

// Weak csrf alone should not report Laravel
{
  const corpus = buildCorpus(
    {
      page: { href: "https://app.example/", pathname: "/", hostname: "app.example" },
      scripts: { external: [] },
      links: { items: [] },
      meta: { items: [{ name: "csrf-token", content: "abc" }] },
      cookies: { names: ["XSRF-TOKEN"] },
      html: { sample: "", urlPool: [] },
    },
    { globals: {}, selectors: {} }
  );
  assert(!matchTechnology(laravel, corpus), "Weak Laravel signals must not report");
  console.log("PASS Laravel weak rejected");
}

console.log("\nAll detector tests passed.");
