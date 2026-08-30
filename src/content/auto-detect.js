/**
 * Auto-triggers background analysis when a page loads (Adblock Plus–style).
 * Sends collected page signals so the badge updates without opening the popup.
 */
(function autoDetect() {
  var DELAYS = [0, 1500, 4000];
  var lastUrl = location.href;

  function ping(reason) {
    try {
      if (typeof WI !== "undefined" && typeof WI.collectAll === "function") {
        var collection = WI.collectAll();
        chrome.runtime.sendMessage({
          type: "PAGE_COLLECTED",
          url: location.href,
          reason: reason,
          collection: collection,
        });
        return;
      }
      chrome.runtime.sendMessage({
        type: "PAGE_READY",
        url: location.href,
        reason: reason,
      });
    } catch (err) {
      /* extension context invalidated */
    }
  }

  function schedule() {
    for (var i = 0; i < DELAYS.length; i++) {
      (function (ms) {
        setTimeout(function () {
          ping(ms === 0 ? "idle" : "delay-" + ms);
        }, ms);
      })(DELAYS[i]);
    }
  }

  function onNav(reason) {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    schedule();
    ping(reason || "spa-nav");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", schedule);
  } else {
    schedule();
  }

  window.addEventListener("popstate", function () {
    onNav("popstate");
  });

  var pushState = history.pushState;
  var replaceState = history.replaceState;
  if (pushState) {
    history.pushState = function () {
      pushState.apply(this, arguments);
      onNav("pushState");
    };
  }
  if (replaceState) {
    history.replaceState = function () {
      replaceState.apply(this, arguments);
      onNav("replaceState");
    };
  }
})();
