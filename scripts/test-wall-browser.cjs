// Run against `wrangler dev --local`. Never point this destructive test at production.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
const base = process.env.WALL_TEST_URL || 'http://127.0.0.1:8789';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const out = path.resolve('.wrangler/wall-browser-results');
const errors = [];
let browser, roomId, key;
async function api(action, body, token = '', method) {
  const read = ['public', 'admin'].includes(action);
  const url = base + '/api/wall' + (roomId ? '?room=' + roomId : '') + (action === 'admin' ? '&view=admin' : '');
  const r = await fetch(url, { method: method || (read ? 'GET' : 'POST'),
    headers: { 'content-type': 'application/json', Origin: base, ...(token ? { authorization: 'Bearer ' + token } : {}) },
    ...(!read ? { body: JSON.stringify({ ...body, action }) } : {}), signal: AbortSignal.timeout(15000) });
  return { status: r.status, data: await r.json(), headers: r.headers };
}
async function download(page, button) {
  const wait = page.waitForEvent('download'); await button.click();
  const file = await wait, chunks = [];
  for await (const chunk of await file.createReadStream()) chunks.push(chunk);
  return Buffer.concat(chunks);
}
async function noOverflow(page, label) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, label + ' horizontal overflow');
}
(async () => {
  await fs.mkdir(out, { recursive: true });
  browser = await chromium.launch({ headless: true, ...(process.env.WALL_BROWSER_CHANNEL ? { channel: process.env.WALL_BROWSER_CHANNEL } : {}) });
  const hostContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const viewContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  for (const ctx of [hostContext, guestContext, viewContext]) {
    await ctx.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    ctx.on('page', p => p.on('pageerror', e => errors.push(e.message)));
  }
  const host = await hostContext.newPage(), guest = await guestContext.newPage(), viewer = await viewContext.newPage();
  await host.goto(base + '/wedding-live-wall.html');
  await host.locator('#groom').fill('测试新人一'); await host.locator('#bride').fill('测试新人二');
  await host.locator('#privacyAgree').check();
  await host.locator('#createButton').click();
  await host.waitForURL('**/live-wall.html?room=*');
  await host.locator('#manage').waitFor({ state: 'visible' });
  roomId = new URL(host.url()).searchParams.get('room');
  key = await host.evaluate(id => JSON.parse(localStorage.getItem('wall_admin_' + id)), roomId);
  assert.equal(key.length, 64);
  assert.equal(new URL(host.url()).hash, '');
  const publicInitial = await api('public'); assert.equal(publicInitial.data.messages.length, 0);
  assert.match(publicInitial.headers.get('cache-control'), /no-store/);
  assert.equal((await api('admin')).status, 403);
  assert.equal((await api('settings', { accepting: false }, 'bad')).status, 403);
  const forbiddenOrigin = await fetch(base + '/api/wall?room=' + roomId, { method: 'POST', headers: { Origin: 'https://unrelated.invalid', 'content-type': 'application/json' }, body: JSON.stringify({ action: 'close' }) });
  assert.equal(forbiddenOrigin.status, 403);
  const legacyLoad = await fetch(base + '/api/load?wall=' + roomId); assert.equal(legacyLoad.status, 400);
  const legacySave = await fetch(base + '/api/save', { method: 'POST', headers: { Origin: base, 'content-type': 'application/json' }, body: JSON.stringify({ wall: { room: roomId, name: 'Bypass', message: 'Blocked' } }) });
  assert.equal(legacySave.status, 400);
  await viewer.goto(base + '/live-wall.html?room=' + roomId);
  assert.equal(await viewer.locator('#manage').isVisible(), false);
  await guest.goto(base + '/blessing.html?room=' + roomId);
  await guest.waitForFunction(() => !document.getElementById('submitGuest').disabled);
  await guest.locator('#guestName').fill('=1+1');
  const injection = '<img src=x onerror=alert(1)> 祝你们幸福';
  await guest.locator('#guestMsg').fill(injection); await guest.locator('input[type=checkbox]').check();
  await guest.locator('#submitGuest').click();
  await guest.waitForFunction(() => document.getElementById('sendNotice').textContent.includes('等待主持人审核'));
  assert.equal((await api('public')).data.messages.length, 0);
  await host.locator('#manage').click();
  await host.locator('#pending .message').waitFor();
  assert.equal(await host.locator('#pending img').count(), 0);
  const item = (await api('admin', undefined, key)).data.messages[0];
  await Promise.all(Array.from({ length: 5 }, () => api('submit', item)));
  assert.equal((await api('admin', undefined, key)).data.stats.submitted, 1);
  await host.locator('#pending .message button').first().click();
  await guest.waitForFunction(text => document.getElementById('feedList').textContent.includes(text), injection);
  assert.equal(await guest.locator('#feedList img').count(), 0);
  assert.equal((await api('admin', undefined, key)).data.stats.approved, 1);
  await host.waitForFunction(() => document.getElementById('stats').textContent.includes('累计通过 1'));
  const csv = await download(host, host.locator('#exportCsv'));
  assert.equal(csv.subarray(0, 3).toString('hex'), 'efbbbf'); assert.ok(csv.toString().includes("'=1+1"));
  const stats = JSON.parse((await download(host, host.locator('#exportStats'))).toString());
  assert.equal(stats.submitted, 1); assert.ok(!JSON.stringify(stats).includes(key)); assert.ok(!JSON.stringify(stats).includes(roomId));
  await host.locator('#exportImage').click(); await host.locator('.image-export img').waitFor();
  const png = await download(host, host.locator('.image-export button').first());
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal((await sharp(png).metadata()).width, 1000);
  await fs.writeFile(path.join(out, 'blessings.png'), png);
  await host.locator('.image-export button').last().click();
  await host.locator('[data-close=adminDialog]').click();
  await host.locator('#tableCard').click(); await host.locator('.image-export img').waitFor();
  const table = await download(host, host.locator('.image-export button').first());
  assert.equal((await sharp(table).metadata()).height, 1300); await fs.writeFile(path.join(out, 'table-card.png'), table);
  await host.locator('.image-export button').last().click();
  await host.locator('#pause').click();
  await viewer.waitForFunction(() => document.getElementById('stage').classList.contains('paused'));
  await host.locator('#manage').click(); await host.locator('#accepting').click();
  await guest.waitForFunction(() => document.getElementById('submitGuest').disabled);
  assert.equal((await api('submit', { id: crypto.randomUUID(), name: 'Blocked', message: 'Closed' })).status, 409);
  await host.locator('#approved').locator('xpath=..').locator('summary').click();
  await host.locator('#approved .message button').click();
  await guest.waitForFunction(() => !document.getElementById('feedList').textContent.includes('=1+1'));
  assert.equal((await api('public')).data.messages.length, 0);
  await host.locator('[data-close=adminDialog]').click();
  await host.screenshot({ path: path.join(out, 'desktop-room.png') });
  await guest.screenshot({ path: path.join(out, 'mobile-guest.png'), fullPage: true });
  await noOverflow(host, 'host'); await noOverflow(guest, 'guest');
  await api('settings', { accepting: true }, key);
  const parallel = await Promise.all(Array.from({ length: 10 }, (_, i) => api('submit', { id: crypto.randomUUID(), name: 'Concurrent ' + i, message: '祝福' })));
  assert.ok(parallel.every(r => r.status === 200));
  assert.equal((await api('admin', undefined, key)).data.stats.submitted, 11);
  for (const width of [320, 390, 1440]) {
    await host.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
    for (const route of ['/wedding-live-wall.html', '/timeline.html', '/live-wall.html?demo=1']) {
      await host.goto(base + route); await noOverflow(host, width + route);
      if (route === '/wedding-live-wall.html') await host.screenshot({ path: path.join(out, width + '-create.png'), fullPage: true });
      if (route === '/live-wall.html?demo=1') await host.screenshot({ path: path.join(out, width + '-demo.png') });
      if (route === '/live-wall.html?demo=1') {
        const qr = await host.locator('#qr').boundingBox(); assert.ok(qr.width <= 120);
        await host.waitForTimeout(5000);
        const boxes = await host.locator('.bubble').evaluateAll(items => items.map(e => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; }));
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) assert.ok(boxes[i].bottom <= boxes[j].top || boxes[j].bottom <= boxes[i].top, 'message tracks must not overlap');
      }
    }
  }
  await host.goto(base + '/timeline.html');
  for (const value of await host.locator('#type option').evaluateAll(items => items.map(e => e.value))) {
    await host.locator('#type').selectOption(value); await host.getByRole('button', { name: '生成时间轴', exact: true }).click();
    assert.ok(await host.locator('.tl-row').count() > 0);
    await host.getByRole('button', { name: '下载 PNG 长图', exact: true }).click();
    const timeline = await download(host, host.locator('.image-export button').first());
    assert.equal(timeline.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    await fs.writeFile(path.join(out, 'timeline-' + value + '.png'), timeline);
    await host.locator('.image-export button').last().click();
  }
  await host.locator('#start').fill(''); await host.getByRole('button', { name: '生成时间轴', exact: true }).click();
  assert.ok(!(await host.locator('#tl').textContent()).includes('NaN'));
  await api('close', {}, key);
  await viewer.waitForFunction(() => document.getElementById('connection').textContent.includes('过期'));
  assert.equal(await viewer.locator('#replay').isDisabled(), true);
  assert.equal((await api('public')).status, 410);
  assert.deepEqual(errors, []);
  console.log('PASS: create, moderation, permissions, legacy isolation, parallel writes, retries, expiry UI, CSV/PNG/JSON exports, 3 viewport sizes, 4 timeline templates');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (roomId && key) await api('close', {}, key).catch(() => {});
  if (browser) await browser.close();
});
