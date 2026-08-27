/**
 * Security analyzer tests (Node).
 * Run: node tests/detectors/security-analyzer.test.js
 */

import { analyzeSecurity } from "../../src/security/security-analyzer.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

{
  const result = analyzeSecurity({
    signals: {
      page: { protocol: "https", href: "https://secure.example/" },
      scripts: { external: [{ src: "https://cdn.example/app.js" }] },
      links: { items: [{ rel: "stylesheet", href: "https://cdn.example/app.css" }] },
      dom: { iframeSrcs: [] },
    },
    headers: {
      available: true,
      status: 200,
      finalUrl: "https://secure.example/",
      headers: {
        "strict-transport-security": "max-age=31536000; includeSubDomains",
        "content-security-policy": "default-src 'self'; frame-ancestors 'none'",
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer",
        "permissions-policy": "geolocation=()",
      },
    },
    cookieSecurity: {
      available: true,
      cookies: [
        { name: "sid", secure: true, httpOnly: true, sameSite: "lax", session: false },
      ],
    },
  });

  assert(result.score === null, "Must not invent a security score");
  assert(result.checks.find((c) => c.id === "https").status === "pass", "HTTPS should pass");
  assert(result.checks.find((c) => c.id === "hsts").status === "pass", "HSTS should pass");
  assert(result.checks.find((c) => c.id === "mixed-content").status === "pass", "Mixed content pass");
  console.log("PASS secure baseline", result.summary);
}

{
  const result = analyzeSecurity({
    signals: {
      page: { protocol: "http", href: "http://insecure.example/" },
      scripts: { external: [] },
      links: { items: [] },
      dom: { iframeSrcs: [] },
    },
    headers: { available: false, error: "blocked", headers: {} },
    cookieSecurity: { available: true, cookies: [] },
  });

  assert(result.checks.find((c) => c.id === "https").status === "fail", "HTTP should fail HTTPS check");
  console.log("PASS insecure http", result.summary);
}

{
  const result = analyzeSecurity({
    signals: {
      page: { protocol: "https", href: "https://mixed.example/" },
      scripts: { external: [{ src: "http://evil.example/a.js" }] },
      links: { items: [] },
      dom: { iframeSrcs: [] },
    },
    headers: {
      available: true,
      status: 200,
      headers: {},
    },
    cookieSecurity: {
      available: true,
      cookies: [{ name: "a", secure: false, httpOnly: false, sameSite: "no_restriction" }],
    },
  });

  assert(result.checks.find((c) => c.id === "mixed-content").status === "fail", "Mixed content should fail");
  assert(result.checks.find((c) => c.id === "cookies").status === "warn", "Weak cookies should warn");
  console.log("PASS mixed + weak cookies", result.summary);
}

console.log("\nAll security tests passed.");
