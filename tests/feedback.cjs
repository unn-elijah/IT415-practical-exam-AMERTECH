'use strict';
const assert = require('node:assert/strict');
const handler = require('../api/feedback');
const originalFetch = global.fetch;
const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const records = new Map();
process.env.UPSTASH_REDIS_REST_URL = 'https://feedback-test.invalid';
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
global.fetch = async (_, options) => {
  const [command, key, value, expiry, lifetime, nx] = JSON.parse(options.body);
  assert.equal(command, 'SET');
  assert.equal(expiry, 'EX');
  assert.equal(lifetime, 7776000);
  assert.equal(nx, 'NX');
  const result = records.has(key) ? null : 'OK';
  if (result) records.set(key, value);
  return { ok: true, json: async () => ({ result }) };
};
async function call(method, body) {
  const res = { code: 200, setHeader() {}, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
  await handler({ method, body }, res);
  return res;
}
(async () => {
  try {
    const body = { reference: 'REF-20261006-123456', rating: 5, comment: ' Great! ' };
    assert.equal((await call('GET')).code, 405);
    for (const invalid of [{ ...body, rating: 0 }, { ...body, rating: 6 }, { ...body, rating: 1.5 }, { ...body, reference: '' }, { ...body, comment: 'a'.repeat(1001) }]) {
      assert.equal((await call('POST', invalid)).code, 400);
    }
    assert.equal((await call('POST', '{bad')).code, 400);
    assert.equal((await call('POST', body)).data.saved, true);
    const key = 'campus-pos:feedback:REF-20261006-123456';
    assert.equal(JSON.parse(records.get(key)).comment, 'Great!');
    assert.equal((await call('POST', { ...body, rating: 1 })).code, 200);
    assert.equal(JSON.parse(records.get(key)).rating, 5);
    global.fetch = async () => { throw new Error('Storage offline'); };
    assert.equal((await call('POST', body)).code, 503);
    console.log('PASS: feedback validation, persistence, repeat submission, and storage failure.');
  } finally {
    global.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    if (originalToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
