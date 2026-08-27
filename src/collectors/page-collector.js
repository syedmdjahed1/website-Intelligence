/**
 * Collects basic page identity signals (URL, title, protocol).
 * Does not read form values or other sensitive inputs.
 */
var WI = WI || {};
WI.collectors = WI.collectors || {};

WI.collectors.page = function collectPage() {
  WI.log("Collector", "page started");
  try {
    var loc = window.location;
    var result = {
      href: loc.href || "",
      origin: loc.origin || "",
      protocol: (loc.protocol || "").replace(/:$/, ""),
      hostname: loc.hostname || "",
      pathname: loc.pathname || "",
      title: document.title || "",
      doctype: document.doctype ? document.doctype.name : null,
      readyState: document.readyState || "",
      charset: document.characterSet || "",
      language: document.documentElement && document.documentElement.lang
        ? document.documentElement.lang
        : "",
    };
    WI.log("Collector", "page completed");
    return result;
  } catch (err) {
    WI.logError("Collector", "page failed", err);
    return { error: String(err && err.message ? err.message : err) };
  }
};
