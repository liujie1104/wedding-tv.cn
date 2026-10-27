// Local Wrangler only. The rooms and participants below are synthetic.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const base = process.env.WALL_TEST_URL || 'http://127.0.0.1:8789';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const out = path.join(os.tmpdir(), 'wedding-event-wall-browser-results');
const errors = [], rooms = [], results = [];
let browser;
async function api(id, action, body, key) {
  const read = action === 'public';
  const r = await fetch(base + '/api/wall?room=' + id, { method: read ? 'GET' : 'POST',
    headers: { Origin: base, 'content-type': 'application/json', ...(key ? { authorization: 'Bearer ' + key } : {}) },
    ...(!read ? { body: JSON.stringify({ ...body, action }) } : {}), signal: AbortSignal.timeout(15000) });
  return { status: r.status, data: await r.json() };
}
async function session(mobile = false) {
  const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block',
    storageState: { cookies: [], origins: [{ origin: base, localStorage: [{ name: 'wedding_analytics_consent_v2', value: 'denied' }] }] } });
  await ctx.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  ctx.on('page', page => page.on('pageerror', e => errors.push(e.message)));
  return ctx;
}
async function download(page, locator) {
  const pending = page.waitForEvent('download'); await locator.click();
  const file = await pending, chunks = [];
  for await (const chunk of await file.createReadStream()) chunks.push(chunk);
  return { buffer: Buffer.concat(chunks), name: file.suggestedFilename() };
}
async function noOverflow(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
}
(async () => {
  await fs.mkdir(out, { recursive: true });
  browser = await chromium.launch({ headless: true, channel: process.env.WALL_BROWSER_CHANNEL || 'msedge' });
  const demoCtx = await session(), demo = await demoCtx.newPage();
  for (const width of [320, 390, 1440]) {
    await demo.setViewportSize({ width, height: 900 });
    await demo.goto(base + '/event-wall.html?type=birthday');
    assert.equal(await demo.locator('#eventType').inputValue(), 'birthday');
    await noOverflow(demo);
    if (width === 390) await demo.screenshot({ path: path.join(out, 'create-mobile.png'), fullPage: true });
  }
  await demo.goto(base + '/live-wall.html?demo=1&type=annual&lang=en');
  await demo.waitForFunction(() => document.getElementById('couple').textContent.includes('留言墙演示'));
  assert.equal(await demo.locator('#guestLink').getAttribute('href'), base + '/event-wall.html?type=annual&from=demo');
  assert.equal(await demo.locator('#brandLink').textContent(), 'wedding-tv.cn · Event Wall');
  await demoCtx.close();
  for (const type of ['birthday', 'gathering', 'annual', 'training']) {
    const hostCtx = await session(), guestCtx = await session(true), viewCtx = await session();
    const host = await hostCtx.newPage(), guest = await guestCtx.newPage(), viewer = await viewCtx.newPage();
    const name = type === 'training' ? 'A'.repeat(60) : '<' + type + '> 模拟活动';
    const editedName = name.slice(0, 55) + '已修改';
    await host.goto(base + '/event-wall.html?type=' + type);
    await host.locator('#eventName').fill(name);
    await host.locator('#organizer').fill('活动组织者');
    await host.locator('#privacyAgree').check();
    await host.locator('#createButton').click();
    await host.waitForURL('**/live-wall.html?room=*');
    await host.locator('#manage').waitFor({ state: 'visible' });
    const id = new URL(host.url()).searchParams.get('room');
    const key = await host.evaluate(id => JSON.parse(localStorage.getItem('wall_admin_' + id)), id);
    rooms.push({ id, key });
    assert.equal(new URL(host.url()).hash, '');
    assert.equal(await host.locator('#couple').textContent(), name);
    assert.equal(await host.locator('#couple').locator('*').count(), 0);
    await viewer.goto(base + '/live-wall.html?room=' + id);
    await viewer.waitForFunction(() => document.getElementById('connection').textContent.includes('已连接'));
    assert.equal(await viewer.locator('#manage').isVisible(), false);
    await guest.goto(await host.locator('#guestLink').getAttribute('href'));
    await guest.waitForFunction(() => !document.getElementById('submitGuest').disabled);
    assert.equal(await guest.locator('#guestCouple').textContent(), name);
    assert.equal(await guest.locator('#btnCreateTimeline').isVisible(), false);
    assert.equal(await guest.locator('#btnCreateWall').textContent(), '创建活动留言墙');
    assert.equal((await guest.locator('body').innerText()).includes('婚礼'), false);
    await guest.locator('#quickBtn1').click();
    assert.equal((await guest.locator('#guestMsg').inputValue()).includes('新婚'), false);
    await guest.locator('#guestName').fill('=1+1');
    await guest.locator('#guestMsg').fill('模拟活动留言，中文导出测试');
    await guest.locator('#guestConsent').check();
    await guest.locator('#submitGuest').click();
    await guest.waitForFunction(() => document.getElementById('sendNotice').textContent.includes('等待主持人审核'));
    assert.equal((await api(id, 'public')).data.messages.length, 0);
    await host.locator('#manage').click();
    await host.locator('#pending .message').waitFor();
    await host.locator('#pending .message button').first().click();
    await guest.waitForFunction(() => document.querySelector('#feedList .message'));
    await viewer.waitForFunction(() => document.querySelector('.bubble'));
    assert.equal((await host.locator('#adminDialog').innerText()).includes('新人'), false);
    const csv = await download(host, host.locator('#exportCsv'));
    assert.equal(csv.name, '活动已通过留言.csv');
    assert.equal(csv.buffer.subarray(0, 3).toString('hex'), 'efbbbf');
    assert.ok(csv.buffer.toString('utf8').includes("'=1+1"));
    assert.ok(csv.buffer.toString('utf8').includes('"留言"'));
    await fs.writeFile(path.join(out, type + '.csv'), csv.buffer);
    await host.locator('#exportImage').click();
    await host.locator('.image-export img').waitFor();
    const image = await download(host, host.locator('.image-export button').first());
    assert.equal(image.name, '活动留言纪念.png');
    assert.equal((await sharp(image.buffer).metadata()).width, 1000);
    await fs.writeFile(path.join(out, type + '-messages.png'), image.buffer);
    await host.locator('.image-export button').last().click();
    await host.locator('#adminSettingsSummary').click();
    assert.equal(await host.locator('#settingGroom').isVisible(), false);
    assert.equal(await host.locator('#settingBride').isEnabled(), false);
    await host.locator('#settingEventName').fill(editedName);
    await host.locator('#settingOrganizer').fill('新的组织者');
    await host.locator('#btnSaveSettings').click();
    await host.waitForFunction(text => document.getElementById('couple').textContent === text, editedName);
    await host.locator('[data-close=adminDialog]').click();
    await guest.waitForFunction(text => document.getElementById('guestCouple').textContent === text, editedName);
    await guest.locator('#langToggle').click();
    assert.equal(await guest.locator('#submitGuest').textContent(), 'Send Message');
    assert.equal((await guest.locator('body').innerText()).toLowerCase().includes('wedding?'), false);
    await guest.locator('#langToggle').click();
    await host.reload({ waitUntil: 'networkidle' });
    assert.equal(await host.locator('#couple').textContent(), editedName);
    await host.locator('#tableCard').click();
    await host.locator('.image-export img').waitFor();
    const card = await download(host, host.locator('.image-export button').first());
    assert.equal(card.name, '活动扫码桌牌.png');
    assert.equal((await sharp(card.buffer).metadata()).height, 1300);
    await fs.writeFile(path.join(out, type + '-card.png'), card.buffer);
    await host.locator('.image-export button').last().click();
    for (const width of [320, 390, 1440]) {
      await guest.setViewportSize({ width, height: 900 });
      await noOverflow(guest);
    }
    await guest.setViewportSize({ width: 390, height: 844 });
    await guest.screenshot({ path: path.join(out, type + '-guest.png'), fullPage: true });
    await host.screenshot({ path: path.join(out, type + '-screen.png') });
    assert.equal((await api(id, 'public')).data.room.eventType, type);
    assert.equal((await api(id, 'close', {}, key)).status, 200);
    await guest.waitForFunction(() => document.getElementById('feedList').children.length === 0 && document.getElementById('submitGuest').disabled);
    await hostCtx.close(); await guestCtx.close(); await viewCtx.close();
    results.push(type);
    console.log('PASS: ' + type + ' creation, moderation, editing, reload, bilingual guest, CSV/PNG and room close');
  }
  assert.deepEqual(errors, []);
  await fs.writeFile(path.join(out, 'results.json'), JSON.stringify({ synthetic: true, realUsers: 0, results, pageErrors: errors }, null, 2));
  console.log('PASS: 4 activity types, 3 viewport widths, generic demo, real local Worker/DO, no production data. Results: ' + out);
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => {
  for (const { id, key } of rooms) await api(id, 'close', {}, key).catch(() => {});
  if (browser) await browser.close();
});
