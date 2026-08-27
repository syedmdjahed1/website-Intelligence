/**
 * SEO analyzer tests (Node).
 * Run: node tests/detectors/seo-analyzer.test.js
 */

import { analyzeSeo } from "../../src/seo/seo-analyzer.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

{
  const result = analyzeSeo({
    page: { title: "Example Domain" },
    meta: {
      items: [
        { name: "description", content: "This domain is for use in documentation examples without prior coordination or asking for permission." },
        { name: "viewport", content: "width=device-width" },
      ],
    },
    links: { items: [{ rel: "canonical", href: "https://example.com/" }] },
    dom: {
      h1Count: 1,
      hasViewportMeta: true,
      imageCount: 0,
      imagesMissingAlt: 0,
      jsonLdCount: 0,
    },
  });

  assert(result.score === null, "Must not invent an SEO score");
  assert(result.available === true, "SEO should be available");
  const title = result.checks.find((c) => c.id === "title");
  assert(title.status === "pass" || title.status === "warn", "Title check missing");
  const h1 = result.checks.find((c) => c.id === "h1");
  assert(h1.status === "pass", "H1 should pass when exactly one");
  console.log("PASS SEO healthy page", result.summary);
}

{
  const result = analyzeSeo({
    page: { title: "" },
    meta: { items: [] },
    links: { items: [] },
    dom: {
      h1Count: 0,
      hasViewportMeta: false,
      imageCount: 3,
      imagesMissingAlt: 2,
      jsonLdCount: 0,
    },
  });

  assert(result.checks.find((c) => c.id === "title").status === "fail", "Missing title should fail");
  assert(result.checks.find((c) => c.id === "h1").status === "fail", "Missing H1 should fail");
  assert(result.summary.fail >= 2, "Expected multiple fails");
  console.log("PASS SEO weak page", result.summary);
}

console.log("\nAll SEO tests passed.");
