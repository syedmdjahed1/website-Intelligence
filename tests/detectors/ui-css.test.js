/**
 * UI / CSS framework detection tests
 * Run: node tests/detectors/ui-css.test.js
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { buildCorpus, matchTechnology } from "../../src/detector/pattern-matcher.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function loadJson(rel) {
  return JSON.parse(readFileSync(join(root, rel), "utf8"));
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const tailwind = loadJson("src/technologies/frontend/tailwind.json");
const bootstrap = loadJson("src/technologies/frontend/bootstrap.json");
const fontAwesome = loadJson("src/technologies/frontend/font-awesome.json");

{
  const corpus = buildCorpus(
    {
      page: { href: "https://example.com/" },
      scripts: { external: [] },
      links: { items: [] },
      meta: { items: [] },
      cookies: { names: [] },
      html: {
        sample:
          '<div class="flex items-center justify-between px-4 py-2 mt-4 bg-blue-500 text-white rounded-lg shadow-md w-full max-w-xl">',
        urlPool: [],
      },
      dom: {
        classHints: [
          "flex",
          "items-center",
          "justify-between",
          "px-4",
          "py-2",
          "mt-4",
          "bg-blue-500",
          "text-white",
          "rounded-lg",
          "shadow-md",
          "w-full",
          "max-w-xl",
        ],
      },
    },
    {}
  );
  const hit = matchTechnology(tailwind, corpus);
  assert(hit, "Compiled Tailwind should be detected via utility classes");
  console.log("PASS compiled Tailwind", hit.confidence);
}

{
  const corpus = buildCorpus(
    {
      page: { href: "https://example.com/" },
      scripts: { external: [{ src: "https://cdn.tailwindcss.com" }] },
      links: { items: [] },
      meta: { items: [] },
      cookies: { names: [] },
      html: { sample: "", urlPool: [] },
      dom: { classHints: [] },
    },
    {}
  );
  const hit = matchTechnology(tailwind, corpus);
  assert(hit, "Tailwind CDN should be detected");
  console.log("PASS Tailwind CDN", hit.confidence);
}

{
  const corpus = buildCorpus(
    {
      page: { href: "https://example.com/" },
      scripts: { external: [] },
      links: { items: [] },
      meta: { items: [] },
      cookies: { names: [] },
      html: { sample: "", urlPool: [] },
      dom: {
        classHints: ["container", "row", "col-md-6", "btn", "btn-primary", "navbar", "card", "card-body"],
      },
    },
    {}
  );
  const hit = matchTechnology(bootstrap, corpus);
  assert(hit, "Bootstrap should be detected via DOM classes");
  console.log("PASS Bootstrap classes", hit.confidence);
}

{
  const corpus = buildCorpus(
    {
      page: { href: "https://example.com/" },
      scripts: { external: [] },
      links: { items: [] },
      meta: { items: [] },
      cookies: { names: [] },
      html: { sample: '<i class="fa-solid fa-user"></i>', urlPool: [] },
      dom: { classHints: ["fa-solid", "fa-user"] },
    },
    {}
  );
  const hit = matchTechnology(fontAwesome, corpus);
  assert(hit, "Font Awesome should be detected via icon classes");
  console.log("PASS Font Awesome classes", hit.confidence);
}

console.log("\nAll UI/CSS tests passed.");
