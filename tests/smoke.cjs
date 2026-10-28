const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const results = path.join(root, 'test-results');
const failures = [];
const network = [];
let checks = 0;

async function main() {
  await fs.mkdir(results, { recursive: true });
  const options = { headless: true };
  if (process.env.PLAYWRIGHT_CHANNEL) options.channel = process.env.PLAYWRIGHT_CHANNEL;
  const browser = await chromium.launch(options);
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
    const page = await context.newPage();
    context.on('page', p => p.on('pageerror', error => failures.push(error.message)));
    page.on('pageerror', error => failures.push(error.message));
    context.on('request', request => { if (/^https?:/.test(request.url())) network.push(request.url()); });
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
    await page.waitForFunction(() => document.querySelector('#dimensions').textContent.includes('PX'));
    await page.screenshot({ path: path.join(results, 'desktop.png'), fullPage: true });
    assert.equal(await page.locator('.preset').count(), 6); checks++;

    const imageHash = () => page.locator('#preview').evaluate(c => c.toDataURL());
    const waitPaint = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const setRange = async (id, value) => { await page.locator('#' + id).evaluate((el, n) => { el.value = n; el.dispatchEvent(new Event('input', { bubbles: true })); }, value); await waitPaint(); };
    const seed = async value => { await page.locator('#seed').fill(String(value)); await page.locator('#seed').dispatchEvent('change'); await waitPaint(); };
    const getDownload = async (selector, name) => {
      const event = page.waitForEvent('download'); await page.locator(selector).click(); const download = await event;
      assert.equal(await download.failure(), null); const dest = path.join(results, name || download.suggestedFilename()); await download.saveAs(dest); return { dest, data: await fs.readFile(dest), name: download.suggestedFilename() };
    };

    for (const [resolution, expected] of [['1080', 1080], ['original', 1600]]) {
      await page.locator('#resolution').selectOption(resolution);
      const file = await getDownload('#download-button', 'sample-' + resolution + '.png');
      assert.equal(file.data.readUInt32BE(16), expected, 'Export rerenders at selected resolution'); checks++;
      await page.waitForFunction(() => !document.querySelector('#download-button').disabled);
    }

    const originalHash = await imageHash();
    const presetHashes = new Set();
    for (let i = 0; i < 6; i++) { await page.locator('.preset').nth(i).click(); await waitPaint(); presetHashes.add(await imageHash()); }
    assert.equal(presetHashes.size, 6, 'Each preset produces a different image'); checks++;
    await page.locator('.preset').first().click(); await waitPaint();
    assert.equal(await imageHash(), originalHash, 'Preset renders deterministically'); checks++;
    await seed(12345); const seededHash = await imageHash(); await seed(67890); assert.notEqual(await imageHash(), seededHash); await seed(12345); assert.equal(await imageHash(), seededHash); checks += 2;

    await page.locator('#compare-button').click();
    assert.equal(await page.locator('#compare-button').getAttribute('aria-pressed'), 'true');
    await page.locator('#compare-slider').fill('25');
    assert.equal(await page.locator('#compare-divider').evaluate(el => el.style.left), '25%');
    await page.locator('#compare-button').click(); checks++;
    await page.locator('#animate-button').click();
    const movingSeed = await page.locator('#seed').inputValue();
    await page.waitForFunction(s => document.querySelector('#seed').value !== s, movingSeed);
    await page.locator('#animate-button').click();
    assert.equal(await page.locator('#animate-button').getAttribute('aria-pressed'), 'false'); checks++;

    const fixture = await page.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 320; c.height = 240;
      const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 320, 240); g.addColorStop(0, '#2e78b5'); g.addColorStop(1, '#f6c359'); x.fillStyle = g; x.fillRect(0, 0, 320, 240); x.fillStyle = '#243025'; x.fillRect(40, 10, 60, 220); x.fillRect(90, 80, 200, 30); x.clearRect(0, 0, 15, 15);
      return c.toDataURL().split(',')[1];
    });
    await page.locator('#file-input').setInputFiles({ name: 'test-photo.png', mimeType: 'image/png', buffer: Buffer.from(fixture, 'base64') });
    await page.waitForFunction(() => document.querySelector('#file-name').textContent === 'test-photo.png');
    assert.equal(await page.locator('#dimensions').textContent(), '320 × 240 PX'); checks++;
    await setRange('amount', 0);
    assert.equal((await imageHash()).split(',')[1], fixture, 'Zero intensity preserves original pixels and transparency'); checks++;
    await setRange('amount', 82); await seed(42817);
    for (const direction of ['horizontal', 'vertical', 'both']) {
      await page.locator('#direction').selectOption(direction); await waitPaint();
      assert.deepEqual(await page.locator('#preview').evaluate(c => [c.width, c.height]), [320, 240]);
    } checks++;
    await page.locator('#direction').selectOption('horizontal');
    await page.locator('summary').filter({ hasText: 'Signal & texture' }).click();
    for (const id of ['rgb', 'sort', 'grain', 'scanlines']) { const before = await imageHash(); await setRange(id, 75); assert.notEqual(await imageHash(), before, id + ' changes pixels'); checks++; }
    await page.locator('summary').filter({ hasText: 'Color & finishing' }).click();
    for (const id of ['saturation', 'contrast']) { const before = await imageHash(); await setRange(id, 140); assert.notEqual(await imageHash(), before); checks++; }

    for (const format of ['png', 'jpeg', 'webp']) {
      await page.locator('#format').selectOption(format);
      await page.locator('#resolution').selectOption('1080');
      const file = await getDownload('#download-button');
      if (format === 'png') { assert.equal(file.data.subarray(1, 4).toString(), 'PNG'); assert.equal(file.data.readUInt32BE(16), 320); assert.equal(file.data.readUInt32BE(20), 240); }
      if (format === 'jpeg') assert.equal(file.data.readUInt16BE(0), 0xffd8);
      if (format === 'webp') assert.equal(file.data.subarray(8, 12).toString(), 'WEBP');
      checks++;
      await page.waitForFunction(() => !document.querySelector('#download-button').disabled);
    }

    await page.locator('#format').selectOption('png'); await page.locator('#resolution').selectOption('original');
    const saved = await getDownload('#save-settings', 'settings.json'); const recipe = JSON.parse(saved.data.toString()); assert.equal(recipe.settings.rgb, 75); checks++;
    await page.locator('#reset-button').click(); await waitPaint(); assert.equal(await page.locator('#amount').inputValue(), '70'); checks++;
    await page.locator('#settings-input').setInputFiles(saved.dest); await page.waitForFunction(() => document.querySelector('#rgb').value === '75'); await waitPaint();
    const restoredHash = await imageHash();
    const badRecipe = { ...recipe, settings: { ...recipe.settings, amount: -99 } };
    await page.locator('#settings-input').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(badRecipe)) });
    await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('Could not load settings'));
    assert.equal(await imageHash(), restoredHash, 'Bad settings leave the session unchanged'); checks++;

    await page.locator('#compare-button').click();
    const html = await getDownload('#save-app', 'session.html');
    const reopened = await context.newPage(); await reopened.goto(pathToFileURL(html.dest).href);
    await reopened.waitForFunction(() => document.querySelector('#dimensions').textContent === '320 × 240 PX');
    assert.equal(await reopened.locator('.preset').count(), 6, 'Reopening does not duplicate presets');
    assert.equal(await reopened.locator('#preview').evaluate(c => c.toDataURL()), restoredHash, 'HTML session restores exactly');
    assert.equal(await reopened.locator('#compare-button').getAttribute('aria-pressed'), 'false'); checks++;
    const reExport = reopened.waitForEvent('download'); await reopened.locator('#bundle-button').click(); const download = await reExport; await download.saveAs(path.join(results, 'bundle.zip'));
    const archive = await fs.readFile(path.join(results, 'bundle.zip')); const entries = new Map(); let offset = 0;
    while (archive.readUInt32LE(offset) === 0x04034b50) { const length = archive.readUInt32LE(offset + 18), nameLength = archive.readUInt16LE(offset + 26), extra = archive.readUInt16LE(offset + 28); const name = archive.subarray(offset + 30, offset + 30 + nameLength).toString('utf8'); const start = offset + 30 + nameLength + extra; entries.set(name, archive.subarray(start, start + length)); offset = start + length; }
    assert.deepEqual([...entries.keys()], ['artwork.png', 'original.png', 'settings.json', 'session.html', 'READ-ME.txt']);
    assert.deepEqual(entries.get('original.png'), Buffer.from(fixture, 'base64'));
    assert.equal(JSON.parse(entries.get('settings.json').toString()).seed, recipe.seed); checks++;

    const badFile = { name: 'corrupt.png', mimeType: 'image/png', buffer: Buffer.from('not an image') };
    await page.locator('#file-input').setInputFiles(badFile); await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('Could not read that image'));
    assert.equal(await page.locator('#file-name').textContent(), 'test-photo.png'); checks++;
    await page.locator('#help-button').click(); assert.equal(await page.locator('#help-dialog').evaluate(el => el.open), true); await page.keyboard.press('Escape'); checks++;

    for (const width of [1440, 1024, 768, 760, 390, 360]) {
      await page.setViewportSize({ width, height: 900 }); await waitPaint();
      const dims = await page.evaluate(() => ({ body: document.documentElement.scrollWidth, viewport: innerWidth, preview: document.querySelector('#image-wrap').getBoundingClientRect().width, stage: document.querySelector('#stage').getBoundingClientRect().width }));
      assert.ok(dims.body <= dims.viewport, 'No horizontal overflow at ' + width); assert.ok(dims.preview <= dims.stage, 'Preview fits at ' + width); checks++;
    }
    const mobile = await context.newPage(); await mobile.setViewportSize({ width: 390, height: 844 }); await mobile.goto(pathToFileURL(path.join(root, 'index.html')).href); await mobile.waitForFunction(() => document.querySelector('#dimensions').textContent.includes('PX'));
    await mobile.screenshot({ path: path.join(results, 'mobile.png'), fullPage: true });
    assert.deepEqual(failures, [], 'No browser errors'); assert.deepEqual(network, [], 'No application network requests'); checks += 2;
    console.log(`PASS: ${checks} checks; presets, deterministic patterns, alpha preservation, controls, PNG/JPEG/WebP, settings validation, HTML reopen, ZIP contents, error recovery, and responsive layout.`);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
