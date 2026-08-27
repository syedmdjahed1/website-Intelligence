# Website Intelligence

Chrome Extension (Manifest V3) that analyzes the currently open website for technology stack and other publicly observable characteristics.

**Version:** 0.7.0 (UI refresh — Technologies / Site / Security)

## UI

Light popup inspired by professional detector tools:

- **Technologies** — grouped by category, searchable
- **Site** — page stats grid, SEO & performance checklists
- **Security** — pass/warn/fail checklist
- Detection count badge on the brand icon
- JSON / CSV export

Auto-analyzes when the popup opens; use the refresh button to re-run.


### Performance checks

- Request count
- Measured transfer / body size (where browsers expose it)
- JS / CSS / image weight
- Third-party request share
- Large resources (≥ 500 KB)
- TTFB, DOM Content Loaded, Load
- First Contentful Paint
- Largest Contentful Paint (when present in the buffer)

**No fake 0–100 performance score.**

## Load in Chrome

1. `chrome://extensions/` → Developer mode  
2. Load unpacked → this folder  
3. Reload extension + tab after updates  

## How to test (Phase 6)

1. Open a content-heavy site and wait for it to finish loading  
2. Click **Analyze Website**  
3. Open **Performance** — expect request counts, timings, and pass/warn/fail rows  
4. Overview **Perf** line should show summary + request count  

### Unit tests

```bash
node tests/detectors/pattern-matcher.test.js
node tests/detectors/seo-analyzer.test.js
node tests/detectors/security-analyzer.test.js
node tests/detectors/performance-analyzer.test.js
```

## Permissions

| Permission | Why |
|------------|-----|
| `activeTab` | Access the active tab on popup open |
| `scripting` | Inject collectors / probes |
| `cookies` | Cookie **attribute** checks (not values) |

## Known limits

- Cross-origin resource sizes are often `0` without `Timing-Allow-Origin`
- Metrics are a one-shot read of the current Performance buffer (not a continuous lab crawl)
- LCP may be missing if it was never buffered before Analyze

## Privacy

Local only. No uploads. Cookie values never collected.
