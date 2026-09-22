// Run with Playwright against a local Wrangler server. Provider requests are mocked.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const base = process.env.ANALYTICS_TEST_URL || 'http://127.0.0.1:8789';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const consentKey = 'wedding_analytics_consent_v2';
const legacyKey = 'wedding_baidu_analytics_consent_v1';
const out = path.resolve('.wrangler/analytics-browser-results');
const results = [];
let browser;

async function session(entries = {}, mobile = false) {
  const context = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1366, height: 900 },
    isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block',
    storageState: { cookies: [], origins: [{ origin: base,
      localStorage: Object.entries(entries).map(([name, value]) => ({ name, value })) }] },
  });
  const requests = [];
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'hm.baidu.com' || url.hostname.endsWith('.clarity.ms')) {
      requests.push(url.href);
      return route.fulfill({ contentType: 'application/javascript', body: '/* analytics SDK mocked */' });
    }
    if (url.origin !== base || url.pathname.startsWith('/api/')) return route.abort();
    return route.continue();
  });
  const page = await context.newPage();
  return { context, page, requests };
}

const clarityRequests = requests => requests.filter(url => url.includes('clarity.ms/tag/'));
async function visit(page, pathname, options = {}) {
  await page.goto(base + pathname, { waitUntil: 'networkidle', ...options });
}
async function bannerFits(page) {
  const bounds = await page.locator('#wedding-analytics-consent').boundingBox();
  const viewport = page.viewportSize();
  assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0);
  assert.ok(bounds.x + bounds.width <= viewport.width + 1);
  assert.ok(bounds.y + bounds.height <= viewport.height + 1);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  assert.equal(await page.locator('[data-consent="denied"]').isVisible(), true);
  assert.equal(await page.locator('[data-consent="granted"]').isVisible(), true);
}

(async () => {
  await fs.mkdir(out, { recursive: true });
  browser = await chromium.launch({ headless: true,
    ...(process.env.ANALYTICS_BROWSER_CHANNEL ? { channel: process.env.ANALYTICS_BROWSER_CHANNEL } : {}) });

  for (const locale of ['/', '/en/']) {
    const { context, page, requests } = await session({}, true);
    await visit(page, locale);
    assert.equal(requests.length, 0);
    await bannerFits(page);
    await page.screenshot({ path: path.join(out, locale === '/' ? 'consent-cn-mobile.png' : 'consent-en-mobile.png') });
    await page.locator('[data-consent="granted"]').click();
    await page.waitForFunction(() => window.__weddingClarityLoaded);
    await page.waitForLoadState('networkidle');
    assert.equal(requests.length, 2);
    assert.deepEqual(clarityRequests(requests), ['https://www.clarity.ms/tag/ym2xvwuebv']);
    assert.deepEqual(await page.evaluate(() => Array.from(window.clarity.q[0])),
      ['consentv2', { analytics_Storage: 'granted', ad_Storage: 'denied' }]);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), consentKey), 'granted');
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(clarityRequests(requests).length, 2);
    assert.equal(await page.locator('#wedding-analytics-consent').count(), 0);
    await context.close();
    results.push(locale + ': mobile banner, explicit consent and persistent consent passed');
  }

  for (const oldChoice of ['granted', 'denied']) {
    const { context, page, requests } = await session({ [legacyKey]: oldChoice });
    await visit(page, '/');
    assert.equal(requests.length, 0);
    assert.equal(await page.locator('#wedding-analytics-consent').count(), oldChoice === 'granted' ? 1 : 0);
    if (oldChoice === 'granted') {
      await page.locator('[data-consent="denied"]').click();
      await page.reload({ waitUntil: 'networkidle' });
      assert.equal(requests.length, 0);
      assert.equal(await page.evaluate(key => localStorage.getItem(key), consentKey), 'denied');
    }
    await context.close();
    results.push('legacy ' + oldChoice + ': no implicit Clarity consent passed');
  }

  for (const pathname of ['/invitation.html', '/en/invitation.html', '/ai-planner.html',
    '/wedding-live-wall.html', '/live-wall.html', '/live-wall.html?room=w_000000000000000000000001',
    '/blessing.html?room=w_000000000000000000000001', '/blessing.html', '/i/abc12345',
    '/privacy.html', '/en/privacy.html', '/terms.html', '/404.html',
    '/?room=private', '/#private', '/blog/hunan.html?draft=private']) {
    const { context, page, requests } = await session({ [consentKey]: 'granted' });
    await visit(page, pathname);
    assert.equal(clarityRequests(requests).length, 0, pathname);
    if (['/live-wall.html?room=w_000000000000000000000001', '/blessing.html?room=w_000000000000000000000001', '/blessing.html', '/i/abc12345', '/404.html'].includes(pathname)) {
      assert.equal(requests.length, 0, pathname + ': both providers must be excluded');
    }
    await context.close();
    results.push(pathname + ': excluded from Clarity passed');
  }

  for (const referrer of [base + '/i/abc12345', base + '/live-wall.html?room=private']) {
    const { context, page, requests } = await session({ [consentKey]: 'granted' });
    await visit(page, '/', { referer: referrer });
    assert.ok(await page.evaluate(() => document.referrer));
    assert.equal(clarityRequests(requests).length, 0);
    await context.close();
    results.push('private referrer exclusion passed');
  }

  for (const privacyPath of ['/privacy.html', '/en/privacy.html']) {
    const { context, page, requests } = await session({ [consentKey]: 'granted', [legacyKey]: 'granted', toolDraft: 'preserve' });
    await visit(page, '/blog/hunan.html');
    assert.equal(clarityRequests(requests).length, 1);
    await context.addCookies(['_clck', '_clsk', 'Hm_lvt_1df8fda3d25e8df34a5c8e08f945e9fb', 'Hm_lpvt_1df8fda3d25e8df34a5c8e08f945e9fb']
      .map(name => ({ name, value: 'test', url: base })));
    const policy = await context.newPage();
    await visit(policy, privacyPath);
    const beforeReset = requests.length;
    const reload = page.waitForEvent('load');
    await policy.locator('#resetAnalyticsConsent').click();
    await reload;
    await policy.locator('#wedding-analytics-consent').waitFor();
    await page.locator('#wedding-analytics-consent').waitFor();
    await policy.waitForLoadState('networkidle');
    await page.waitForLoadState('networkidle');
    assert.equal(requests.length, beforeReset);
    assert.deepEqual(await policy.evaluate(([key, old]) => [localStorage.getItem(key), localStorage.getItem(old), localStorage.getItem('toolDraft')], [consentKey, legacyKey]), [null, null, 'preserve']);
    assert.equal((await context.cookies()).some(cookie => /^(?:_clck|_clsk|Hm_)/.test(cookie.name)), false);
    await context.close();
    results.push(privacyPath + ': withdrawal, cookies, cross-tab reload and draft preservation passed');
  }
  await fs.writeFile(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
  console.log(results.join('\n'));
  console.log(`PASS: ${results.length} local browser scenarios; no real provider traffic.`);
})().catch(error => { console.error(error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });
