export const BAIDU_ANALYTICS_ID = "1df8fda3d25e8df34a5c8e08f945e9fb";
export const BAIDU_CONSENT_STORAGE_KEY = "wedding_baidu_analytics_consent_v1";
export const ANALYTICS_CONSENT_STORAGE_KEY = "wedding_analytics_consent_v2";
export const CLARITY_PROJECT_ID = "ym2xvwuebv";

// Session replay is limited to reviewed reading pages, never tool inputs or results.
export const CLARITY_CONTENT_PATHS = new Set([
  "/", "/en/", "/blog.html", "/guide.html", "/guide-livestream.html",
  "/about.html", "/en/about.html", "/authors.html", "/editorial-policy.html",
  "/tool-methodology.html", "/timeline-templates.html", "/mv-style.html",
  "/outdoor-wedding-emergency-case.html", "/wedding-budget-scenarios-case.html",
  "/wedding-quote-comparison-case.html", "/wedding-budget-planning-guide.html",
  "/wedding-customs-verification-guide.html", "/wedding-day-timeline-guide.html",
  "/wedding-emergency-plan-guide.html", "/wedding-family-communication-guide.html",
  "/wedding-invitation-wording-guide.html", "/wedding-live-stream-technical-guide.html",
  "/wedding-photo-video-delivery-guide.html", "/wedding-vendor-contract-guide.html",
]);

export function shouldInjectClarityAnalytics(pathname) {
  return CLARITY_CONTENT_PATHS.has(pathname) || /^\/blog\/[a-z0-9-]+\.html$/.test(pathname);
}

// Do not send invitation identifiers, room codes, or other non-indexed flows to analytics.
export const BAIDU_ANALYTICS_EXCLUDED_PATHS = new Set([
  "/404.html",
  "/blessing.html",
  "/contract-audit.html",
  "/i.html",
  "/live-wall.html",
  "/live.html",
  "/speech-bride-father.html",
  "/speech-bridesmaid-bestman.html",
  "/speech-groom-father.html",
  "/wedding-vows-collection.html",
]);

export function shouldInjectBaiduAnalytics(pathname) {
  const isHtml = pathname === "/" || pathname === "/en/" || pathname === "/en" || pathname.endsWith(".html");
  return isHtml && !BAIDU_ANALYTICS_EXCLUDED_PATHS.has(pathname);
}

export function buildAnalyticsSnippet(pathname) {
  return `<script data-purpose="baidu-analytics-consent">
(function () {
  if (window.__weddingAnalyticsConsentInitialized) return;
  window.__weddingAnalyticsConsentInitialized = true;
  var consentKey = "${ANALYTICS_CONSENT_STORAGE_KEY}";
  var legacyConsentKey = "${BAIDU_CONSENT_STORAGE_KEY}";
  var trackingUrl = "https://hm.baidu.com/hm.js?${BAIDU_ANALYTICS_ID}";
  var clarityAllowed = ${JSON.stringify(shouldInjectClarityAnalytics(pathname))};
  var clarityPaths = ${JSON.stringify([...CLARITY_CONTENT_PATHS])};
  var bannerId = "wedding-analytics-consent";
  var activeConsent = readConsent();

  function readConsent() {
    try {
      var value = localStorage.getItem(consentKey);
      if (value === "granted" || value === "denied") return value;
      // An old Baidu grant does not authorize a newly added replay provider.
      return localStorage.getItem(legacyConsentKey) === "denied" ? "denied" : null;
    } catch (_) { return null; }
  }

  function writeConsent(value) {
    try { localStorage.setItem(consentKey, value); } catch (_) {}
  }

  function loadBaiduAnalytics() {
    if (window.__weddingBaiduAnalyticsLoaded) return;
    window.__weddingBaiduAnalyticsLoaded = true;
    window._hmt = window._hmt || [];
    var hm = document.createElement("script");
    hm.async = true;
    hm.src = trackingUrl;
    var firstScript = document.getElementsByTagName("script")[0];
    if (firstScript && firstScript.parentNode) {
      firstScript.parentNode.insertBefore(hm, firstScript);
    } else {
      document.head.appendChild(hm);
    }
  }

  function isClarityLocationSafe() {
    if (location.search || location.hash) return false;
    if (!document.referrer) return true;
    try {
      var ref = new URL(document.referrer);
      if (ref.search || ref.hash) return false;
      return ref.origin !== location.origin || clarityPaths.indexOf(ref.pathname) !== -1 || /^\\/blog\\/[a-z0-9-]+\\.html$/.test(ref.pathname);
    } catch (_) { return false; }
  }

  function loadClarityAnalytics() {
    if (!clarityAllowed || activeConsent !== "granted" || !isClarityLocationSafe() || window.__weddingClarityLoaded) return;
    // Apply the mask before the external recorder can inspect the DOM.
    document.querySelectorAll("form,input,textarea,select,[contenteditable]").forEach(function (el) {
      el.setAttribute("data-clarity-mask", "true");
    });
    window.__weddingClarityLoaded = true;
    window.clarity = window.clarity || function () { (window.clarity.q = window.clarity.q || []).push(arguments); };
    window.clarity("consentv2", { analytics_Storage: "granted", ad_Storage: "denied" });
    var tag = document.createElement("script");
    tag.async = true;
    tag.src = "https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}";
    document.head.appendChild(tag);
  }

  function loadAnalytics() {
    loadBaiduAnalytics();
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", loadClarityAnalytics, { once: true });
    } else {
      loadClarityAnalytics();
    }
  }

  function revokeAnalytics() {
    activeConsent = null;
    if (window.clarity) {
      window.clarity("consentv2", { analytics_Storage: "denied", ad_Storage: "denied" });
    }
    // Clear only this site's analytics cookies, not user tool data.
    var names = ["_clck", "_clsk", "Hm_lvt_${BAIDU_ANALYTICS_ID}", "Hm_lpvt_${BAIDU_ANALYTICS_ID}"];
    var hostParts = location.hostname.split(".");
    var domains = [""];
    for (var i = 0; i < hostParts.length - 1; i++) domains.push(hostParts.slice(i).join("."));
    names.forEach(function (name) {
      domains.forEach(function (domain) {
        document.cookie = name + "=; Max-Age=0; Path=/" + (domain ? "; Domain=" + domain : "");
      });
    });
  }

  function closeBanner() {
    var banner = document.getElementById(bannerId);
    if (banner) banner.remove();
  }

  function choose(value) {
    activeConsent = value;
    writeConsent(value);
    closeBanner();
    if (value === "granted") loadAnalytics();
  }

  function renderBanner() {
    if (activeConsent || document.getElementById(bannerId)) return;
    var banner = document.createElement("section");
    banner.id = bannerId;
    banner.setAttribute("role", "dialog");
    var isEn = document.documentElement.lang === "en" || location.pathname.startsWith("/en/");
    banner.setAttribute("aria-label", isEn ? "Analytics Consent Settings" : "访问统计设置");
    banner.style.cssText = "position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483647;max-width:760px;margin:auto;padding:14px 16px;background:#fff;color:#18151c;border:1px solid #d8d3dc;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.22);font:14px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap";
    banner.innerHTML = isEn
      ? '<p style="margin:0;flex:1 1 420px">May we use Baidu Analytics for traffic statistics and Microsoft Clarity for heatmaps and session replays on selected reading pages? These services use cookies. Clarity is disabled on tool forms, AI results, invitations and live walls. Declining does not affect site features. <a href="/en/privacy.html#baidu-analytics" style="color:#7a3f00;text-decoration:underline">Privacy Policy</a></p><div style="display:flex;gap:8px"><button type="button" data-consent="denied" style="padding:8px 14px;border:1px solid #777;background:#fff;color:#18151c;border-radius:6px;cursor:pointer">Decline</button><button type="button" data-consent="granted" style="padding:8px 14px;border:1px solid #7a3f00;background:#7a3f00;color:#fff;border-radius:6px;cursor:pointer">Accept</button></div>'
      : '<p style="margin:0;flex:1 1 420px">是否允许使用百度统计分析访问量，并使用 Microsoft Clarity 分析指定阅读页面的热图与会话回放？两者会使用 Cookie。Clarity 不用于工具表单、AI 结果、请帖或现场互动页面，拒绝不影响网站功能。<a href="/privacy.html#baidu-analytics" style="color:#7a3f00;text-decoration:underline">查看隐私说明</a></p><div style="display:flex;gap:8px"><button type="button" data-consent="denied" style="padding:8px 14px;border:1px solid #777;background:#fff;color:#18151c;border-radius:6px;cursor:pointer">拒绝</button><button type="button" data-consent="granted" style="padding:8px 14px;border:1px solid #7a3f00;background:#7a3f00;color:#fff;border-radius:6px;cursor:pointer">允许统计</button></div>';
    banner.addEventListener("click", function (event) {
      var button = event.target.closest("button[data-consent]");
      if (button) choose(button.getAttribute("data-consent"));
    });
    document.body.appendChild(banner);
  }

  window.WeddingAnalyticsConsent = {
    status: function () { return activeConsent; },
    reset: function () {
      revokeAnalytics();
      try { localStorage.removeItem(consentKey); localStorage.removeItem(legacyConsentKey); } catch (_) {}
      location.reload();
    }
  };

  window.addEventListener("storage", function (event) {
    if ((event.key === consentKey || event.key === null) && readConsent() !== "granted") {
      revokeAnalytics();
      location.reload();
    }
  });

  if (activeConsent === "granted") {
    loadAnalytics();
  } else if (!activeConsent) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", renderBanner, { once: true });
    } else {
      renderBanner();
    }
  }
})();
</script>`;
}

export const BAIDU_ANALYTICS_SNIPPET = buildAnalyticsSnippet("/");
