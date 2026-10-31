// tests/browser/app.spec.js — deterministic browser integration tests; API fixtures exist only here.
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { messages } from '../../src/i18n.js';
const sourceUrl = 'https://youtu.be/dQw4w9WgXcQ';
const caption = 'WEBVTT\n\n00:00.000 --> 00:01.200\nHello &amp; welcome.\n\n00:01.200 --> 00:03.000\nမင်္ဂလာပါ\n';

// Substitute Google only at the network boundary so production has no mock mode.
async function identity(page) {
  await page.route('https://accounts.google.com/gsi/client', route => route.fulfill({ contentType: 'text/javascript', body: `window.google = { accounts: { oauth2: { initTokenClient: options => ({ requestAccessToken: () => options.callback({ access_token: 'test-only', expires_in: 3600 }) }), hasGrantedAllScopes: () => true } } };` }));
}
async function authorize(page) {
  await page.locator('#consent').check();
  await page.locator('#connect').click();
  await expect(page.locator('#account')).toBeVisible();
}

// Exercise real local import, Unicode export, attribution, and full locale switching.
test('import, export, translation, and source invalidation', async ({ page }) => {
  await page.goto('/');
  await page.locator('#import-tab').click();
  await page.locator('#url').fill(sourceUrl);
  await page.locator('#video-title').fill('A source video');
  await page.locator('#file').setInputFiles({ name: 'captions.vtt', mimeType: 'text/vtt', buffer: Buffer.from(caption) });
  await page.locator('#submit').click();
  await expect(page.locator('#transcript')).toHaveValue('Hello & welcome.\nမင်္ဂလာပါ');
  await page.locator('#my').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'my');
  await expect(page.locator('#status')).toHaveText(messages.my.imported);
  const nodes = await page.locator('[data-i18n]').evaluateAll(elements => elements.map(element => [element.dataset.i18n, element.textContent]));
  for (const [key, text] of nodes) expect(text).toBe(messages.my[key]);
  const downloadEvent = page.waitForEvent('download');
  await page.locator('#download').click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('youtube-dQw4w9WgXcQ-captions.txt');
  const text = await readFile(await download.path(), 'utf8');
  expect(text).toContain('မင်္ဂလာပါ');
  expect(text).toContain('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  expect(text).not.toContain('-->');
  await page.locator('#url').fill('https://youtu.be/abcdefghijk');
  await expect(page.locator('#result')).toBeHidden();
});

// Empty real API responses must never produce invented transcript content.
test('no captions and cancelled request recover cleanly', async ({ page }) => {
  await identity(page);
  await page.route('https://www.googleapis.com/youtube/v3/**', route => route.fulfill({ json: { items: [] } }));
  await page.goto('/');
  await authorize(page);
  await page.locator('#url').fill(sourceUrl);
  await page.locator('#submit').click();
  await expect(page.locator('#status')).toHaveText(messages.en.noCaptions);
  await expect(page.locator('#result')).toBeHidden();
  await page.unroute('https://www.googleapis.com/youtube/v3/**');
  await page.route('https://www.googleapis.com/youtube/v3/**', () => {});
  await page.locator('#submit').click();
  await expect(page.locator('#submit')).toBeDisabled();
  await page.locator('#my').click();
  await expect(page.locator('#status')).toHaveText(messages.my.loading);
  await page.locator('#cancel').click();
  await expect(page.locator('#status')).toHaveText(messages.my.cancelledRequest);
  await expect(page.locator('#submit')).toBeEnabled();
});

// Recover from blocked authorization windows and denied clipboard permissions.
test('popup cancellation and clipboard fallback', async ({ page }) => {
  await page.route('https://accounts.google.com/gsi/client', route => route.fulfill({ contentType: 'text/javascript', body: `window.google = { accounts: { oauth2: { initTokenClient: options => ({ requestAccessToken: () => options.error_callback({ type: 'popup_closed' }) }) } } };` }));
  await page.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('Denied'); } } }); });
  await page.goto('/');
  await page.locator('#consent').check();
  await page.locator('#connect').click();
  await expect(page.locator('#status')).toHaveText(messages.en.cancelled);
  await page.locator('#import-tab').click();
  await page.locator('#url').fill(sourceUrl);
  await page.locator('#file').setInputFiles({ name: 'captions.vtt', mimeType: 'text/vtt', buffer: Buffer.from(caption) });
  await page.locator('#submit').click();
  await page.locator('#copy').click();
  await expect(page.locator('#status')).toHaveText(messages.en.copyFailed);
  await expect(page.locator('#transcript')).toBeFocused();
});

// Capture desktop visual evidence and confirm the illustration is actually loaded.
test('desktop visual and keyboard access', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/');
  await expect(page.locator('.hero-pigeon')).toBeVisible();
  expect(await page.locator('.hero-pigeon').evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip')).toBeFocused();
  await page.keyboard.press('Tab');
  await page.screenshot({ path: 'test-results/desktop-english.png', fullPage: true });
});

// Verify URL and file errors are immediately retranslated without losing input state.
test('validation and malformed caption errors', async ({ page }) => {
  await page.goto('/');
  await page.locator('#url').fill('https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ');
  await page.locator('#submit').click();
  await expect(page.locator('#status')).toHaveText(messages.en.invalidUrl);
  await page.locator('#my').click();
  await expect(page.locator('#status')).toHaveText(messages.my.invalidUrl);
  await page.locator('#import-tab').click();
  await page.locator('#url').fill(sourceUrl);
  await page.locator('#file').setInputFiles({ name: 'bad.srt', mimeType: 'text/plain', buffer: Buffer.from('invalid') });
  await page.locator('#submit').click();
  await expect(page.locator('#status')).toHaveText(messages.my.emptyFile);
});

// Check language selection, Google request shape, caption conversion, and disconnect cleanup.
test('official API flow and track switching', async ({ page }) => {
  await identity(page);
  let downloads = 0;
  await page.route('https://www.googleapis.com/youtube/v3/**', async route => {
    const url = new URL(route.request().url());
    expect(route.request().headers().authorization).toBe('Bearer test-only');
    if (url.pathname.endsWith('/captions')) return route.fulfill({ json: { items: [
      { id: 'english-track', snippet: { language: 'en', status: 'serving', trackKind: 'standard' } },
      { id: 'burmese-track', snippet: { language: 'my', status: 'serving', trackKind: 'ASR' } },
    ] } });
    if (url.pathname.endsWith('/videos')) return route.fulfill({ json: { items: [{ snippet: { title: 'Actual API title' } }] } });
    downloads++;
    expect(url.searchParams.get('tfmt')).toBe('vtt');
    return route.fulfill({ contentType: 'text/vtt', body: caption });
  });
  await page.goto('/');
  await authorize(page);
  await page.locator('#url').fill(sourceUrl);
  await page.locator('#submit').click();
  await expect(page.locator('#track option')).toHaveCount(2);
  await page.locator('#track').selectOption('burmese-track');
  await page.locator('#retrieve').click();
  await expect(page.locator('#source')).toHaveText('Actual API title');
  await expect(page.locator('#transcript')).toHaveValue('Hello & welcome.\nမင်္ဂလာပါ');
  expect(downloads).toBe(1);
  await page.locator('#track').selectOption('english-track');
  await expect(page.locator('#result')).toBeHidden();
  await page.locator('#disconnect').click();
  await expect(page.locator('#tracks')).toBeHidden();
  await expect(page.locator('#transcript')).toHaveValue('');
});

// API failures retain their exact operational meaning in either interface language.
for (const [status, reason, key] of [[403, 'forbidden', 'forbidden'], [403, 'quotaExceeded', 'quota'], [401, 'unauthorized', 'expired'], [404, 'videoNotFound', 'notFound'], [503, 'backendError', 'upstream']]) {
  test(`API failure ${key}`, async ({ page }) => {
    await identity(page);
    await page.route('https://www.googleapis.com/youtube/v3/**', route => route.fulfill({ status, json: { error: { errors: [{ reason }] } } }));
    await page.goto('/');
    await authorize(page);
    await page.locator('#url').fill(sourceUrl);
    await page.locator('#submit').click();
    await expect(page.locator('#status')).toHaveText(messages.en[key]);
    await page.locator('#my').click();
    await expect(page.locator('#status')).toHaveText(messages.my[key]);
    await expect(page.locator('#submit')).toBeEnabled();
  });
}

// Verify small screens and reduced-motion preferences across both writing systems.
test('mobile layout and reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  for (const locale of ['en', 'my']) {
    await page.locator(`#${locale}`).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.locator('.hero').evaluate(node => getComputedStyle(node).animationName)).toBe('none');
  }
  await page.screenshot({ path: 'test-results/mobile-burmese.png', fullPage: true });
});
