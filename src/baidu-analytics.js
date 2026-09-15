export const BAIDU_ANALYTICS_ID = "1df8fda3d25e8df34a5c8e08f945e9fb";
export const BAIDU_CONSENT_STORAGE_KEY = "wedding_baidu_analytics_consent_v1";

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

export const BAIDU_ANALYTICS_SNIPPET = `<script data-purpose="baidu-analytics-consent">
(function () {
  var consentKey = "${BAIDU_CONSENT_STORAGE_KEY}";
  var trackingUrl = "https://hm.baidu.com/hm.js?${BAIDU_ANALYTICS_ID}";
  var bannerId = "wedding-analytics-consent";

  function readConsent() {
    try { return localStorage.getItem(consentKey); } catch (_) { return null; }
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

  function closeBanner() {
    var banner = document.getElementById(bannerId);
    if (banner) banner.remove();
  }

  function choose(value) {
    writeConsent(value);
    closeBanner();
    if (value === "granted") loadBaiduAnalytics();
  }

  function renderBanner() {
    if (readConsent() || document.getElementById(bannerId)) return;
    var banner = document.createElement("section");
    banner.id = bannerId;
    banner.setAttribute("role", "dialog");
    var isEn = document.documentElement.lang === "en" || location.pathname.startsWith("/en/");
    banner.setAttribute("aria-label", isEn ? "Analytics Consent Settings" : "访问统计设置");
    banner.style.cssText = "position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483647;max-width:760px;margin:auto;padding:14px 16px;background:#fff;color:#18151c;border:1px solid #d8d3dc;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.22);font:14px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap";
    banner.innerHTML = isEn
      ? '<p style="margin:0;flex:1 1 420px">To understand page traffic and improve our website, we request your consent to use Baidu Analytics cookies on public pages. Declining does not affect site features. Live screens and invitations never load analytics. <a href="/en/privacy.html#baidu-analytics" style="color:#7a3f00;text-decoration:underline">Privacy Policy</a></p><div style="display:flex;gap:8px"><button type="button" data-consent="denied" style="padding:8px 14px;border:1px solid #777;background:#fff;color:#18151c;border-radius:6px;cursor:pointer">Decline</button><button type="button" data-consent="granted" style="padding:8px 14px;border:1px solid #7a3f00;background:#7a3f00;color:#fff;border-radius:6px;cursor:pointer">Accept</button></div>'
      : '<p style="margin:0;flex:1 1 420px">为了解内容访问情况并改进网站，本站希望在公共内容页使用百度统计 Cookie。拒绝不会影响使用，邀请和现场互动页面不启用统计。<a href="/privacy.html#baidu-analytics" style="color:#7a3f00;text-decoration:underline">查看隐私说明</a></p><div style="display:flex;gap:8px"><button type="button" data-consent="denied" style="padding:8px 14px;border:1px solid #777;background:#fff;color:#18151c;border-radius:6px;cursor:pointer">拒绝</button><button type="button" data-consent="granted" style="padding:8px 14px;border:1px solid #7a3f00;background:#7a3f00;color:#fff;border-radius:6px;cursor:pointer">允许统计</button></div>';
    banner.addEventListener("click", function (event) {
      var button = event.target.closest("button[data-consent]");
      if (button) choose(button.getAttribute("data-consent"));
    });
    document.body.appendChild(banner);
  }

  window.WeddingAnalyticsConsent = {
    status: readConsent,
    reset: function () {
      try { localStorage.removeItem(consentKey); } catch (_) {}
      location.reload();
    }
  };

  if (readConsent() === "granted") {
    loadBaiduAnalytics();
  } else if (!readConsent()) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", renderBanner, { once: true });
    } else {
      renderBanner();
    }
  }
})();
</script>`;
