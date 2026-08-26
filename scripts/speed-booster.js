/**
 * wedding-tv.cn Core Web Vitals & Instant Speed Booster + PWA Controller
 */
(function() {
  'use strict';

  // 1. PWA Service Worker Registration
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/sw.js').then(function(reg) {
        // Registered successfully
      }).catch(function(err) {
        console.warn('SW registration skipped:', err);
      });
    });
  }

  // 2. Speculative Instant Page Prefetching (Hover/Touch prefetcher)
  var prefetchedUrls = new Set();
  var prefetchTimeout = null;

  function prefetch(url) {
    if (!url || prefetchedUrls.has(url) || url.startsWith('#') || url.startsWith('javascript:')) return;
    if (url.includes('?') && !url.includes('wedding-tv.cn')) return;
    
    // Check if same origin or relative
    try {
      var target = new URL(url, location.href);
      if (target.origin !== location.origin) return;
      if (target.pathname === location.pathname) return;

      prefetchedUrls.add(url);
      var link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = target.href;
      link.as = 'document';
      document.head.appendChild(link);
    } catch (e) {}
  }

  function handleMouseOver(e) {
    var a = e.target.closest('a');
    if (!a || !a.href) return;
    prefetchTimeout = setTimeout(function() {
      prefetch(a.href);
    }, 65);
  }

  function handleMouseOut() {
    if (prefetchTimeout) clearTimeout(prefetchTimeout);
  }

  function handleTouchStart(e) {
    var a = e.target.closest('a');
    if (a && a.href) prefetch(a.href);
  }

  document.addEventListener('mouseover', handleMouseOver, { passive: true });
  document.addEventListener('mouseout', handleMouseOut, { passive: true });
  document.addEventListener('touchstart', handleTouchStart, { passive: true });

  // 3. PWA Add-to-Home-Screen floating prompt for Mobile
  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    deferredPrompt = e;
    showInstallPrompt();
  });

  function showInstallPrompt() {
    if (localStorage.getItem('pwa_prompt_dismissed')) return;
    if (document.getElementById('pwaInstallBanner')) return;

    var banner = document.createElement('div');
    banner.id = 'pwaInstallBanner';
    banner.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:9999;width:min(90%,380px);background:#1f162c;border:1px solid rgba(255,210,138,0.4);border-radius:14px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 10px 30px rgba(0,0,0,0.8);color:#fff;font-family:sans-serif;font-size:13px;animation:pwaSlideUp 0.3s ease;';
    banner.innerHTML = '<div style="display:flex;align-items:center;gap:10px;"><span style="font-size:22px;">📱</span><div><strong style="color:#ffd28a;display:block;font-size:13px;">安装备婚智囊 APP</strong><span style="color:#b9aed1;font-size:11px;">添加到手机桌面，离线秒开</span></div></div><div style="display:flex;gap:6px;"><button id="btnPwaInstall" style="background:linear-gradient(90deg,#ffd28a,#ff6b9d);border:0;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:bold;color:#1a0f1f;cursor:pointer;">安装</button><button id="btnPwaClose" style="background:none;border:0;color:#aaa;font-size:16px;cursor:pointer;padding:0 4px;">✕</button></div>';

    document.body.appendChild(banner);

    document.getElementById('btnPwaInstall').onclick = function() {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function(choiceResult) {
          deferredPrompt = null;
          banner.remove();
        });
      } else {
        alert('请点击浏览器菜单中的「添加到主屏幕」或「安装应用」即可！');
        banner.remove();
      }
    };

    document.getElementById('btnPwaClose').onclick = function() {
      localStorage.setItem('pwa_prompt_dismissed', '1');
      banner.remove();
    };
  }
})();
