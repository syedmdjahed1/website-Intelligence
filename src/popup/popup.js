/**
 * Website Intelligence — popup UI (Detechtor-style 3-tab layout)
 */

import { inspectUrl } from "../utils/helpers.js";
import { log, logError } from "../utils/logger.js";
import { getTechIconUrl } from "../ui/tech-icons.js";

const CATEGORY_COLORS = {
  "Frontend Framework": "#3b82f6",
  "JavaScript Library": "#0ea5e9",
  "UI / CSS Framework": "#8b5cf6",
  "CSS Framework": "#8b5cf6",
  CMS: "#22c55e",
  Ecommerce: "#059669",
  "Payment Processor": "#0891b2",
  "Live Chat": "#7c3aed",
  "Fonts & Icons": "#c026d3",
  "Font Script": "#c026d3",
  "WordPress Theme": "#15803d",
  "WordPress Plugin": "#2563eb",
  "Backend Framework": "#f59e0b",
  "Programming Language": "#a855f7",
  CDN: "#0f766e",
  Infrastructure: "#64748b",
  "Web Server": "#b45309",
  "Hosting & Server": "#b45309",
  "Reverse Proxy": "#92400e",
  Analytics: "#f97316",
  "SEO & Meta": "#ea580c",
  "Marketing & Advertising": "#db2777",
  "Cookie & Consent": "#ca8a04",
  "Developer Tools": "#475569",
  Security: "#dc2626",
  Miscellaneous: "#6366f1",
  Other: "#6366f1",
};

const CATEGORY_ORDER = [
  "Frontend Framework",
  "Programming Language",
  "JavaScript Library",
  "UI / CSS Framework",
  "CSS Framework",
  "CMS",
  "Ecommerce",
  "Payment Processor",
  "Live Chat",
  "Fonts & Icons",
  "Font Script",
  "WordPress Theme",
  "WordPress Plugin",
  "Backend Framework",
  "CDN",
  "Infrastructure",
  "Hosting & Server",
  "Web Server",
  "Reverse Proxy",
  "Analytics",
  "Marketing & Advertising",
  "Cookie & Consent",
  "SEO & Meta",
  "Developer Tools",
  "Security",
  "Miscellaneous",
  "Other",
];

const els = {
  domain: document.getElementById("domain"),
  siteSub: document.getElementById("site-sub"),
  siteAvatar: document.getElementById("site-avatar"),
  detectBadge: document.getElementById("detect-badge"),
  blockedBanner: document.getElementById("blocked-banner"),
  tabs: document.getElementById("tabs"),
  refreshBtn: document.getElementById("refresh-btn"),
  techSearch: document.getElementById("tech-search"),
  techGrid: document.getElementById("tech-grid"),
  techEmpty: document.getElementById("tech-empty"),
  wpOverview: document.getElementById("wp-overview"),
  siteBlurb: document.getElementById("site-blurb"),
  generalInfo: document.getElementById("general-info"),
  statsGrid: document.getElementById("stats-grid"),
  seoList: document.getElementById("seo-list"),
  perfList: document.getElementById("perf-list"),
  securityList: document.getElementById("security-list"),
  extVersion: document.getElementById("ext-version"),
  exportJson: document.getElementById("export-json"),
  exportCsv: document.getElementById("export-csv"),
};

/** @type {chrome.tabs.Tab | null} */
let activeTab = null;
/** @type {object | null} */
let lastResult = null;
let searchQuery = "";

function showTab(tabId) {
  els.tabs.querySelectorAll(".tab").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.tab === tabId);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    const active = panel.dataset.panel === tabId;
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
  });
}

els.tabs.addEventListener("click", (event) => {
  const btn = event.target.closest(".tab");
  if (!btn) return;
  showTab(btn.dataset.tab);
});

els.techSearch.addEventListener("input", () => {
  searchQuery = els.techSearch.value.trim().toLowerCase();
  if (lastResult) renderTechnologies(lastResult);
});

els.refreshBtn.addEventListener("click", () => runAnalysis(true));

function setBusy(busy) {
  els.refreshBtn.disabled = busy;
  els.refreshBtn.classList.toggle("is-spinning", busy);
}

function initials(name) {
  const parts = String(name).replace(/[^a-zA-Z0-9 ]/g, " ").trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function categoryColor(category) {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.Other;
}

function renderHeader(result, fallbackDomain) {
  const domain = result?.overview?.domain || fallbackDomain || "—";
  const techCount = result?.technologies?.length || 0;
  const categories = Object.keys(result?.technologiesByCategory || {}).length;
  const letter = (domain.replace(/^www\./, "")[0] || "W").toUpperCase();

  els.domain.textContent = domain;
  els.siteAvatar.textContent = letter;
  els.detectBadge.textContent = String(techCount);

  if (!result) {
    els.siteSub.textContent = "Ready to analyze";
    return;
  }

  els.siteSub.textContent =
    techCount === 0
      ? "0 technologies detected"
      : `${techCount} technolog${techCount === 1 ? "y" : "ies"} · ${categories} categor${categories === 1 ? "y" : "ies"}`;
}

function renderTechnologies(result) {
  els.techGrid.replaceChildren();
  renderWordpressOverview(result.wordpress);

  const groups = result.technologiesByCategory || {};
  let categories = [
    ...CATEGORY_ORDER.filter((c) => groups[c]?.length),
    ...Object.keys(groups)
      .filter((c) => !CATEGORY_ORDER.includes(c))
      .sort(),
  ];

  const q = searchQuery;
  const filtered = {};
  for (const cat of categories) {
    const items = (groups[cat] || []).filter((t) => {
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        String(t.category || "").toLowerCase().includes(q) ||
        String(t.slug || "").toLowerCase().includes(q)
      );
    });
    if (items.length) filtered[cat] = items;
  }
  categories = Object.keys(filtered);

  if (categories.length === 0) {
    els.techEmpty.hidden = false;
    els.techEmpty.textContent = q
      ? "No technologies match your search."
      : "No confident technologies detected on this page.";
    return;
  }

  els.techEmpty.hidden = true;

  for (const category of categories) {
    const col = document.createElement("div");
    col.className = "tech-group";

    const title = document.createElement("h3");
    title.className = "tech-group-title";
    title.textContent = category;
    col.appendChild(title);

    for (const tech of filtered[category]) {
      col.appendChild(renderTechItem(tech));
    }
    els.techGrid.appendChild(col);
  }
}

function renderWordpressOverview(wp) {
  const box = els.wpOverview;
  if (!box) return;
  box.replaceChildren();
  if (!wp || !wp.detected) {
    box.hidden = true;
    return;
  }

  box.hidden = false;
  const title = document.createElement("div");
  title.className = "wp-overview-title";
  title.textContent = wp.version ? `WordPress ${wp.version}` : "WordPress";

  const meta = document.createElement("div");
  meta.className = "wp-overview-meta";
  meta.textContent = `${wp.themeCount} theme${wp.themeCount === 1 ? "" : "s"} · ${wp.pluginCount} plugin${wp.pluginCount === 1 ? "" : "s"}${wp.woocommerce ? " · WooCommerce" : ""}${wp.restApi ? " · REST API" : ""}${wp.blockEditor ? " · Block editor" : ""}`;

  const chips = document.createElement("div");
  chips.className = "wp-chips";

  for (const t of wp.themes || []) {
    const chip = document.createElement("span");
    chip.className = "wp-chip";
    chip.textContent = `Theme: ${t.name}`;
    chips.appendChild(chip);
  }
  for (const p of (wp.plugins || []).slice(0, 24)) {
    const chip = document.createElement("span");
    chip.className = "wp-chip is-plugin";
    chip.textContent = p.name;
    chips.appendChild(chip);
  }
  if ((wp.plugins || []).length > 24) {
    const more = document.createElement("span");
    more.className = "wp-chip is-flag";
    more.textContent = `+${wp.plugins.length - 24} more plugins`;
    chips.appendChild(more);
  }

  box.appendChild(title);
  box.appendChild(meta);
  if (chips.childNodes.length) box.appendChild(chips);
}

function renderTechItem(tech) {
  const row = document.createElement("div");
  row.className = "tech-item";
  row.title = (tech.evidence || []).map((e) => e.detail).join("\n");

  const iconUrl = getTechIconUrl(tech.id);
  let iconEl;
  if (iconUrl) {
    iconEl = document.createElement("img");
    iconEl.className = "tech-icon";
    iconEl.src = iconUrl;
    iconEl.alt = "";
    iconEl.width = 20;
    iconEl.height = 20;
    iconEl.loading = "lazy";
    iconEl.onerror = () => {
      const fallback = document.createElement("span");
      fallback.className = "tech-glyph";
      fallback.style.background = categoryColor(tech.category);
      fallback.textContent = initials(tech.name);
      iconEl.replaceWith(fallback);
    };
  } else {
    iconEl = document.createElement("span");
    iconEl.className = "tech-glyph";
    iconEl.style.background = categoryColor(tech.category);
    iconEl.textContent = initials(tech.name);
  }

  const body = document.createElement("div");
  body.className = "tech-item-body";

  const name = document.createElement("span");
  name.className = "tech-item-name";
  name.textContent = tech.name;
  body.appendChild(name);

  if (tech.version) {
    const ver = document.createElement("span");
    ver.className = "tech-version";
    ver.textContent = `v${tech.version}`;
    body.appendChild(ver);
  }

  if (tech.implied) {
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = "implied";
    body.appendChild(pill);
  } else if (tech.visibility === "server-inferred") {
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = "inferred";
    body.appendChild(pill);
  }

  row.appendChild(iconEl);
  row.appendChild(body);
  return row;
}

function renderSite(result) {
  const o = result.overview;
  const seo = result.seo;
  const perf = result.performance;

  els.siteBlurb.textContent = o.title
    ? o.title
    : "No page title available for this document.";

  els.generalInfo.replaceChildren();
  const rows = [
    ["Language", o.language || "—"],
    ["Protocol", o.protocol || "—"],
    ["Generator", findMeta(result, "generator") || "—"],
    ["Robots Meta", findMeta(result, "robots") || "—"],
  ];
  if (result.wordpress?.detected) {
    rows.push([
      "WordPress",
      `${result.wordpress.version || "detected"} · ${result.wordpress.themeCount} themes · ${result.wordpress.pluginCount} plugins`,
    ]);
  }
  for (const [label, value] of rows) {
    const wrap = document.createElement("div");
    wrap.className = "info-row";
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    wrap.appendChild(dt);
    wrap.appendChild(dd);
    els.generalInfo.appendChild(wrap);
  }

  const stats = [
    ["Scripts", o.scriptCount ?? 0],
    ["CSS", o.stylesheetCount ?? 0],
    ["Images", o.imageCount ?? 0],
    ["iFrames", o.iframeCount ?? 0],
    ["Forms", o.formCount ?? 0],
    ["Meta", o.metaCount ?? 0],
    ["Cookies", o.cookieNameCount ?? 0],
    ["HttpOnly", o.httpOnlyCount ?? 0],
  ];
  els.statsGrid.replaceChildren();
  for (const [label, value] of stats) {
    const card = document.createElement("div");
    card.className = "stat-card";
    const num = document.createElement("span");
    num.className = "stat-value";
    num.textContent = String(value);
    const lab = document.createElement("span");
    lab.className = "stat-label";
    lab.textContent = label;
    card.appendChild(num);
    card.appendChild(lab);
    els.statsGrid.appendChild(card);
  }

  renderCheckList(els.seoList, seo?.checks || []);
  renderCheckList(els.perfList, (perf?.checks || []).slice(0, 8));
}

function findMeta(result, name) {
  const items = result.raw?.signals?.meta?.items || [];
  const hit = items.find((m) => String(m.name || "").toLowerCase() === name.toLowerCase());
  return hit?.content || "";
}

function renderSecurity(result) {
  renderCheckList(els.securityList, result.security?.checks || [], true);
}

function renderCheckList(container, checks, securityStyle = false) {
  container.replaceChildren();
  if (!checks.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No checks available.";
    container.appendChild(empty);
    return;
  }

  for (const check of checks) {
    const row = document.createElement("div");
    row.className = "check-row";

    const dot = document.createElement("span");
    const status = check.status || "info";
    dot.className = `check-dot ${status}`;
    if (securityStyle) {
      dot.textContent = status === "pass" ? "✓" : status === "fail" ? "✕" : "!";
    } else {
      dot.textContent =
        status === "pass" ? "✓" : status === "fail" ? "✕" : status === "warn" ? "!" : "i";
    }

    const text = document.createElement("div");
    text.className = "check-text";
    const title = document.createElement("div");
    title.className = "check-title";
    title.textContent = check.name;
    const detail = document.createElement("div");
    detail.className = "check-detail";
    detail.textContent = check.detail || "";
    text.appendChild(title);
    text.appendChild(detail);

    row.appendChild(dot);
    row.appendChild(text);
    container.appendChild(row);
  }
}

function enableExports(enabled) {
  els.exportJson.disabled = !enabled;
  els.exportCsv.disabled = !enabled;
}

function downloadText(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

els.exportJson.addEventListener("click", () => {
  if (!lastResult) return;
  const payload = {
    domain: lastResult.overview.domain,
    analyzedAt: lastResult.analyzedAt,
    technologies: lastResult.technologies,
    seo: lastResult.seo,
    security: lastResult.security,
    performance: {
      summary: lastResult.performance.summary,
      checks: lastResult.performance.checks,
      metrics: lastResult.performance.metrics,
    },
  };
  const name = `website-intelligence-${lastResult.overview.domain || "site"}.json`;
  downloadText(name, JSON.stringify(payload, null, 2), "application/json");
});

els.exportCsv.addEventListener("click", () => {
  if (!lastResult) return;
  const lines = [["name", "category", "confidence", "label", "version", "visibility"]];
  for (const t of lastResult.technologies) {
    lines.push([
      t.name,
      t.category,
      t.confidence,
      t.label,
      t.version || "",
      t.visibility || "",
    ]);
  }
  const csv = lines
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? "");
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    )
    .join("\n");
  const name = `website-intelligence-${lastResult.overview.domain || "site"}.csv`;
  downloadText(name, csv, "text/csv");
});

function applyResult(result, domain) {
  lastResult = result;
  renderHeader(result, domain);
  renderTechnologies(result);
  renderSite(result);
  renderSecurity(result);
  enableExports(true);

  if (activeTab?.id) {
    chrome.runtime.sendMessage({
      type: "UPDATE_BADGE",
      tabId: activeTab.id,
      url: activeTab.url,
      count: result.technologies?.length || 0,
      result,
    });
  }
}

async function getCachedTabResult(tabId) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_TAB_RESULT", tabId }, (response) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      resolve(response?.cached || null);
    });
  });
}

async function requestTabAnalysis(tabId, force = false) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "ANALYZE_TAB", tabId, force }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (response?.error) {
        reject(new Error(response.error));
        return;
      }
      resolve(response?.cached || null);
    });
  });
}

async function runAnalysis(force = false) {
  if (!activeTab?.id || !activeTab.url) return;

  const check = inspectUrl(activeTab.url);
  if (!check.analyzable) return;

  setBusy(true);
  els.siteSub.textContent = force ? "Analyzing…" : "Loading…";
  els.blockedBanner.hidden = true;

  try {
    log("Popup", "analyze", { tabId: activeTab.id, force });
    const cached = await requestTabAnalysis(activeTab.id, force);
    if (!cached?.result) {
      throw new Error("Analysis did not return a result for this tab.");
    }
    applyResult(cached.result, check.domain);
    showTab("technologies");
  } catch (err) {
    logError("Popup", "analyze failed", err);
    els.siteSub.textContent = "Analysis failed";
    els.blockedBanner.hidden = false;
    els.blockedBanner.textContent =
      err instanceof Error ? err.message : "Analysis failed unexpectedly.";
  } finally {
    setBusy(false);
  }
}

async function init() {
  try {
    const manifest = chrome.runtime.getManifest();
    if (els.extVersion && manifest?.version) {
      els.extVersion.textContent = `v${manifest.version}`;
    }

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTab = tabs[0] ?? null;

    if (!activeTab) {
      els.domain.textContent = "—";
      els.siteSub.textContent = "No active tab";
      els.refreshBtn.disabled = true;
      return;
    }

    const check = inspectUrl(activeTab.url);
    renderHeader(null, check.domain);
    els.siteAvatar.textContent = (check.domain.replace(/^www\./, "")[0] || "W").toUpperCase();

    if (!check.analyzable) {
      els.siteSub.textContent = "Cannot analyze this page";
      els.blockedBanner.hidden = false;
      els.blockedBanner.textContent = check.reason || "This page cannot be analyzed.";
      els.refreshBtn.disabled = true;
      return;
    }

    const cached = await getCachedTabResult(activeTab.id);
    if (cached?.result && cached.url === activeTab.url) {
      applyResult(cached.result, check.domain);
      return;
    }

    await runAnalysis(false);
  } catch (err) {
    logError("Popup", "init failed", err);
    els.siteSub.textContent = "Error";
    els.blockedBanner.hidden = false;
    els.blockedBanner.textContent = "Something went wrong while reading this tab.";
  }
}

init();
