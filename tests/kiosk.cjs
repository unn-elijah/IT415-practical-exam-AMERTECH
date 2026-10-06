// Optional development check; the kiosk itself needs no Node or build step.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const output = path.resolve('.verification');
  fs.mkdirSync(output, { recursive: true });
  const errors = [];
  let inspections = 0;
  for (const [width, height] of [[1440, 1000], [768, 1024], [390, 844], [320, 700]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(pathToFileURL(path.resolve('index.html')).href);
    const click = selector => page.locator(selector).click();
    const view = async id => {
      await page.locator(`#${id}`).waitFor({ state: 'visible' });
      assert.equal(await page.locator('.view:visible').count(), 1);
      assert.equal(await page.locator('.progress-nav [aria-current="step"]').getAttribute('data-stage'),
        await page.locator(`#${id}`).getAttribute('data-stage'));
    };
    const inspect = async name => {
      const issues = await page.evaluate(() => {
        const visible = element => element.getClientRects().length > 0;
        const controls = [...document.querySelectorAll('button, input, summary, a')].filter(visible);
        const small = controls.filter(element => {
          const rect = element.getBoundingClientRect();
          return rect.width < 47.9 || rect.height < 47.9;
        }).map(element => [element.outerHTML.slice(0, 150), element.getBoundingClientRect().width, element.getBoundingClientRect().height]);
        const unnamed = controls.filter(element => !element.getAttribute('aria-label') && !element.textContent.trim() && !element.labels?.length).map(element => element.outerHTML);
        return { overflow: document.documentElement.scrollWidth > innerWidth, small, unnamed,
          assets: [...document.images].filter(image => !image.complete || !image.naturalWidth).length };
      });
      assert.deepEqual(issues, { overflow: false, small: [], unnamed: [], assets: 0 }, `${width} ${name}: ${JSON.stringify(issues)}`);
      await page.screenshot({ path: path.join(output, `${width}-${name}.png`), fullPage: true });
      inspections += 1;
    };
    await view('order');
    assert.equal(await page.locator('.product-card').count(), 6);
    await inspect('order');
    if (width <= 700) {
      await click('.mobile-cart-link:visible');
      assert.equal(await page.locator('#current-order').evaluate(element => element === document.activeElement), true);
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    // Every category combined with matching, nonmatching, whitespace and case searches.
    const fixtures = { all: ['Coffee', 'Sandwich', 'Soft Drink', 'Cookies', 'Bottled Water', 'Chocolate'], drinks: ['Coffee', 'Soft Drink', 'Bottled Water'], food: ['Sandwich'], snacks: ['Cookies', 'Chocolate'] };
    for (const [category, names] of Object.entries(fixtures)) {
      await click(`.category-filters [data-category="${category}"]`);
      for (const query of ['', ' COFFEE ', 'sandwich', 'water', 'cookies', 'chocolate', 'soft', 'zzzz']) {
        await page.locator('#catalog-search').fill(query);
        const expected = names.filter(name => name.toLowerCase().includes(query.trim().toLowerCase()));
        assert.deepEqual(await page.locator('.product-card:visible .product-info strong').allTextContents(), expected);
        assert.equal(await page.locator('.no-results').isVisible(), expected.length === 0);
        assert.equal(await page.locator('.cart-panel [data-order="populated"] .cart-total strong').innerText(), '₱175.00');
      }
    }
    await inspect('no-results');
    await click('#reset-catalog');
    assert.equal(await page.locator('.product-card:visible').count(), 6);
    await click('#order [data-view="review"]'); await view('review'); await inspect('review');
    assert.equal(await page.locator('#review h1').evaluate(element => element === document.activeElement), true);
    await click('#review [data-view="order"]'); await view('order');
    await click('#order [data-view="review"]');
    await click('#review [data-view="methods"]'); await view('methods'); await inspect('methods');
    await click('#methods [data-view="review"]'); await view('review');
    await click('#review [data-view="methods"]');
    for (const method of ['cash', 'qr', 'card']) {
      await click(`#methods [data-view="${method}"]`); await view(method); await inspect(method);
      await click(`#${method} [data-view="methods"]`); await view('methods');
      await click(`#methods [data-view="${method}"]`);
      if (method === 'cash') {
        await page.locator('#amount-paid').fill('999');
        assert.equal(await page.locator('.change-box[data-cash="normal"] strong').innerText(), '₱25.00');
        assert.equal(await page.locator('.keypad button:disabled').count(), 12);
      }
      await click(`#${method} [data-view="success"]:visible`); await view('success'); await inspect(`success-${method}`);
      const reference = { cash: 'TXN-2026-00125', qr: 'QR-TXN-2026-00126', card: 'CARD-TXN-2026-00127' }[method];
      assert.equal(await page.locator('#success .reference').innerText(), reference);
      const methodValues = await page.locator('#success .payment-details dd').allTextContents();
      assert.equal(methodValues[0].trim(), '₱175.00');
      assert.equal(await page.locator('#success .payment-details > div:nth-child(3) dd').innerText(), method === 'cash' ? '₱200.00' : '₱175.00');
      assert.equal(await page.locator('#success .payment-details > div:nth-child(4) dd').innerText(), method === 'cash' ? '₱25.00' : '₱0.00');
      await click('#success [data-view="receipt"]'); await view('receipt'); await inspect(`receipt-${method}`);
      assert.equal(await page.locator('#receipt .reference').innerText(), reference);
      assert.equal(await page.locator('#receipt time').innerText(), 'October 6, 2026 · 10:42 AM PHT');
      assert.equal(await page.locator('#receipt .payment-details > div:nth-child(3) dd').innerText(), method === 'cash' ? '₱200.00' : '₱175.00');
      await click('#receipt [data-new-transaction]'); await view('order');
      assert.equal(await page.locator('.cart-panel [data-order="empty"]').isVisible(), true);
      assert.equal(await page.locator('#order [data-order="empty"] .btn').isDisabled(), true);
      assert.equal(await page.locator('#catalog-search').inputValue(), '');
      assert.equal(await page.locator('.product-card:visible').count(), 6);
      if (!(await page.locator('.preview-content').isVisible())) await click('.preview-tools summary');
      await click('[data-preview="populated"]');
      await click('#order [data-view="review"]'); await click('#review [data-view="methods"]');
      // Disclosure stays open across navigation.
    }
    for (const [state, id] of [['empty','order'], ['populated','order'], ['cash-error','cash'], ['cash-normal','cash'], ['card-processing','card'], ['card-ready','card']]) {
      if (!(await page.locator('.preview-content').isVisible())) await click('.preview-tools summary');
      await click(`[data-preview="${state}"]`); await view(id); await inspect(state);
      if (state === 'cash-error') {
        assert.equal(await page.locator('#amount-paid').inputValue(), '100.00');
        assert.equal(await page.locator('#amount-paid').getAttribute('aria-invalid'), 'true');
        assert.equal(await page.locator('#cash [data-cash="error"] .btn').isDisabled(), true);
      }
    }
    await click('.brand'); await view('order');
    await page.locator('#catalog-search').focus();
    assert.notEqual(await page.locator('#catalog-search').evaluate(element => getComputedStyle(element).outlineStyle), 'none');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.locator('.method-card').first().evaluate(element => getComputedStyle(element).transitionDuration), '0s');
    await page.close();
  }
  assert.deepEqual(errors, []);
  await browser.close();
  console.log(`PASS: ${inspections} rendered checks across four sizes; all branches, Back actions, fixtures, search/category combinations, target sizes, focus, reduced motion, and JavaScript console checks.`);
})().catch(error => { console.error(error); process.exit(1); });
