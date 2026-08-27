/**
 * Performance analyzer tests (Node).
 * Run: node tests/detectors/performance-analyzer.test.js
 */

import { analyzePerformance } from "../../src/performance/performance-analyzer.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

{
  const result = analyzePerformance({
    available: true,
    resources: [
      {
        name: "https://example.com/app.js",
        initiatorType: "script",
        transferSize: 120000,
        encodedBodySize: 120000,
        decodedBodySize: 400000,
        size: 120000,
        sizeKnown: true,
        duration: 40,
        host: "example.com",
        thirdParty: false,
      },
      {
        name: "https://example.com/app.css",
        initiatorType: "css",
        transferSize: 20000,
        encodedBodySize: 20000,
        decodedBodySize: 80000,
        size: 20000,
        sizeKnown: true,
        duration: 12,
        host: "example.com",
        thirdParty: false,
      },
      {
        name: "https://cdn.example/lib.js",
        initiatorType: "script",
        transferSize: 80000,
        encodedBodySize: 80000,
        decodedBodySize: 200000,
        size: 80000,
        sizeKnown: true,
        duration: 30,
        host: "cdn.example",
        thirdParty: true,
      },
    ],
    navigation: {
      ttfb: 120,
      domContentLoaded: 900,
      loadEventEnd: 1400,
    },
    paint: { "first-contentful-paint": 800 },
    lcp: { startTime: 1100, size: 10000, url: "" },
  });

  assert(result.score === null, "Must not invent a performance score");
  assert(result.available === true, "Should be available");
  assert(result.metrics.requestCount === 3, "Expected 3 requests");
  assert(result.checks.find((c) => c.id === "requests").status === "pass", "Request count should pass");
  console.log("PASS light page", result.summary);
}

{
  const result = analyzePerformance({
    available: true,
    resources: Array.from({ length: 160 }, (_, i) => ({
      name: `https://cdn.example/r${i}.js`,
      initiatorType: "script",
      transferSize: 600000,
      encodedBodySize: 600000,
      decodedBodySize: 600000,
      size: 600000,
      sizeKnown: true,
      duration: 10,
      host: "cdn.example",
      thirdParty: true,
    })),
    navigation: { ttfb: 2000, domContentLoaded: 5000, loadEventEnd: 8000 },
    paint: { "first-contentful-paint": 3500 },
    lcp: null,
  });

  assert(result.checks.find((c) => c.id === "requests").status === "fail", "High requests should fail");
  assert(result.checks.find((c) => c.id === "large-resources").status === "warn", "Large resources should warn");
  console.log("PASS heavy page", result.summary);
}

{
  const result = analyzePerformance({ available: false, error: "no api" });
  assert(result.available === false, "Unavailable should propagate");
  assert(result.score === null, "Still no fake score");
  console.log("PASS unavailable");
}

console.log("\nAll performance tests passed.");
