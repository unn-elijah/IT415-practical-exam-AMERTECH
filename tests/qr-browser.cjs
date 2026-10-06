'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const create = require('../api/qr/index');
const session = require('../api/qr/[id]');
const feedback = require('../api/feedback');
const staticServer = require('../server');
const records = new Map();
const originalFetch = global.fetch;
const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.invalid';
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

// Exercise the deployed handlers through HTTP, with only Redis mocked.
global.fetch = async (_, options) => {
  const [command, ...args] = JSON.parse(options.body);
  let result;
  if (command === 'SET') { records.set(args[0], args[1]); result = 'OK'; }
  else if (command === 'GET') result = records.get(args[0]) || null;
  else if (command === 'DEL') result = Number(records.delete(args[0]));
  else if (command === 'EVAL') {
    const value = records.get(args[2]);
    if (!value) result = null;
    else {
      const data = JSON.parse(value), paid = Number(args[3]);
      if (paid < data.total) result = 'insufficient';
      else {
        if (!data.done) { data.done = true; data.paid = paid; }
        result = JSON.stringify(data);
        records.set(args[2], result);
      }
    }
  } else throw new Error('Unexpected Redis command');
  return { ok: true, json: async () => ({ result }) };
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const match = url.pathname.match(/^\/api\/qr\/([a-f0-9]{32})$/);
    if (url.pathname !== '/api/qr' && url.pathname !== '/api/feedback' && !match) return staticServer.emit('request', req, res);
    let body = '';
    for await (const chunk of req) body += chunk;
    req.body = body ? JSON.parse(body) : undefined;
    req.query = { id: match?.[1] };
    res.status = code => { res.statusCode = code; return res; };
    res.json = data => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
    await (url.pathname === '/api/feedback' ? feedback : match ? session : create)(req, res);
  } catch (error) { res.statusCode = 500; res.end(error.message); }
});

(async () => {
  let browser;
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(3000, '127.0.0.1', resolve);
    });
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext();
    const kiosk = await context.newPage(), phone = await context.newPage();
    const errors = [];
    for (const page of [kiosk, phone]) page.on('pageerror', error => errors.push(error.message));
    await kiosk.goto('http://127.0.0.1:3000');
    await kiosk.locator('.product-card:visible').first().click();
    await kiosk.locator('#order [data-view="review"]:visible').click();
    await kiosk.locator('#review [data-view="methods"]:visible').click();
    const created = kiosk.waitForResponse(response => response.url().endsWith('/api/qr') && response.request().method() === 'POST');
    await kiosk.locator('[data-view="qr"]:visible').click();
    const response = await created;
    assert.equal(response.status(), 201);
    const link = (await response.json()).paymentUrl;
    const confirm = kiosk.locator('#qr [data-payment="qr"]:visible');
    assert.equal(await confirm.isDisabled(), true);
    await kiosk.locator('#qr svg.qr-art path').first().waitFor();
    await phone.goto(new URL(link, kiosk.url()).href);
    await phone.waitForFunction(() => !document.getElementById('done').disabled);
    await phone.locator('#paid').fill('0.01');
    await phone.locator('#done').click();
    assert.match(await phone.locator('#message').innerText(), /Insufficient/);
    assert.equal(await confirm.isDisabled(), true);
    const total = Number(new URL(phone.url()).searchParams.get('total'));
    await phone.locator('#paid').fill(((total + 500) / 100).toFixed(2));
    await phone.locator('#done').click();
    await phone.waitForFunction(() => document.getElementById('message').textContent.includes('Done sent'));
    await kiosk.waitForFunction(() => !document.querySelector('#qr [data-payment="qr"]').disabled);
    await confirm.click();
    await kiosk.locator('#success:visible').waitFor();
    assert.equal(await kiosk.locator('#feedback-modal').isVisible(), false);
    await kiosk.keyboard.press('Enter');
    await kiosk.locator('#feedback-modal[open]').waitFor();
    await kiosk.getByRole('button', { name: 'Close feedback', exact: true }).click();
    await kiosk.keyboard.press('Enter');
    assert.equal(await kiosk.locator('#feedback-modal').isVisible(), false);
    // A fresh payment allows a new prompt; tap opens it without adding a UI control.
    await kiosk.evaluate(() => document.dispatchEvent(new CustomEvent('transaction-ready', {
      detail: { reference: document.querySelector('#success .reference [data-method="qr"]').textContent }
    })));
    await kiosk.locator('#success h1:visible').click();
    await kiosk.locator('#feedback-modal[open]').waitFor();
    assert.equal(await kiosk.locator('#success .feedback-form, #receipt .feedback-form').count(), 0);
    await kiosk.locator('label[for="feedback-modal-star-4"]').click();
    await kiosk.locator('#feedback-modal-star-4').focus();
    await kiosk.keyboard.press('ArrowRight');
    assert.equal(await kiosk.locator('#feedback-modal-star-5').isChecked(), true);
    await kiosk.keyboard.press('ArrowLeft');
    assert.equal(await kiosk.locator('#feedback-modal-star-4').isChecked(), true);
    await kiosk.locator('#feedback-modal-feedback-comment').fill('Easy to use. Thank you!');
    await kiosk.locator('label[for="feedback-modal-star-5"]').click();
    await kiosk.screenshot({ path: '.verification/feedback-modal.png', fullPage: true });
    await kiosk.setViewportSize({ width: 390, height: 844 });
    assert.equal(await kiosk.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await kiosk.screenshot({ path: '.verification/feedback-modal-mobile.png', fullPage: true });
    await kiosk.locator('#feedback-modal [type="submit"]').click();
    await kiosk.waitForFunction(() => document.querySelector('#feedback-modal [role="status"]').textContent.includes('has been saved'));
    assert.equal(await kiosk.locator('#feedback-modal [type="submit"]').isDisabled(), true);
    await kiosk.getByRole('button', { name: 'Close feedback', exact: true }).click();
    assert.equal(await kiosk.locator('#feedback-modal').isVisible(), false);
    await kiosk.locator('#success [data-view="receipt"]:visible').click();
    await kiosk.locator('#receipt:visible').waitFor();
    assert.match(await kiosk.locator('#receipt:visible').innerText(), /QR Payment/);
    const savedFeedback = [...records].filter(([key]) => key.startsWith('campus-pos:feedback:'));
    assert.equal(savedFeedback.length, 1);
    assert.equal(JSON.parse(savedFeedback[0][1]).rating, 5);
    assert.equal(JSON.parse(savedFeedback[0][1]).comment, 'Easy to use. Thank you!');
    await kiosk.locator('#receipt [data-new-transaction]:visible').click();
    await kiosk.locator('#order:visible').waitFor();
    assert.equal(await kiosk.locator('.feedback-form input:checked').count(), 0);
    assert.equal(await kiosk.locator('#qr [data-payment="qr"]').first().isDisabled(), true);
    assert.deepEqual(errors, []);
    console.log('PASS: browser QR flow, receipt feedback submission and storage, duplicate prevention, and transaction reset. Redis is mocked; live deployment still requires verification.');
  } finally {
    await browser?.close();
    if (server.listening) await new Promise(resolve => server.close(resolve));
    global.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    if (originalToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
