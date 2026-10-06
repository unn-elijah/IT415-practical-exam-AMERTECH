'use strict';

const assert = require('node:assert/strict');
const create = require('../api/qr/index');
const sessionHandler = require('../api/qr/[id]');
const records = new Map();
const originalFetch = global.fetch;
const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.invalid';
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

// Mock the Redis REST boundary; no real account or credentials are needed.
global.fetch = async (url, options) => {
  assert.equal(url, 'https://test.upstash.invalid');
  assert.equal(options.headers.Authorization, 'Bearer test-token');
  const [command, ...args] = JSON.parse(options.body);
  let result;
  if (command === 'SET') {
    assert.equal(args[2], 'EX');
    assert.equal(args[3], 1800);
    records.set(args[0], args[1]);
    result = 'OK';
  } else if (command === 'GET') result = records.get(args[0]) || null;
  else if (command === 'DEL') result = Number(records.delete(args[0]));
  else if (command === 'EVAL') {
    assert(args[0].includes("redis.call('PTTL'"));
    const key = args[2], paid = Number(args[3]);
    const value = records.get(key);
    if (!value) result = null;
    else {
      const session = JSON.parse(value);
      if (paid < session.total) result = 'insufficient';
      else {
        if (!session.done) { session.done = true; session.paid = paid; }
        result = JSON.stringify(session);
        records.set(key, result);
      }
    }
  } else throw new Error('Unexpected command');
  return { ok: true, json: async () => ({ result }) };
};

async function call(handler, method, body, id) {
  const response = {
    headers: {}, code: 200,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.code = code; return this; },
    json(data) { this.data = data; return this; }
  };
  await handler({ method, body, query: { id } }, response);
  assert.equal(response.headers['Cache-Control'], 'no-store');
  return response;
}

(async () => {
  try {
    assert.equal((await call(create, 'GET')).code, 405);
    assert.equal((await call(create, 'POST', { total: 0 })).code, 400);
    assert.equal((await call(create, 'POST', '{bad')).code, 400);
    const first = await call(create, 'POST', { total: 17500 });
    assert.equal(first.code, 201);
    const id = first.data.id;
    const paymentUrl = new URL(first.data.paymentUrl, 'https://campus.example');
    assert.equal(paymentUrl.origin, 'https://campus.example');
    assert.equal(paymentUrl.searchParams.get('session'), id);
    assert.equal(paymentUrl.searchParams.get('total'), '17500');
    assert.equal((await call(sessionHandler, 'GET', undefined, id)).data.done, false);
    assert.equal((await call(sessionHandler, 'POST', { paid: 10000 }, id)).code, 400);
    assert.equal((await call(sessionHandler, 'POST', { paid: 20000 }, id)).data.paid, 20000);
    assert.equal((await call(sessionHandler, 'POST', { paid: 50000 }, id)).data.paid, 20000);
    const next = await call(create, 'POST', { total: 22000 });
    assert.notEqual(next.data.id, id);
    assert.equal((await call(sessionHandler, 'GET', undefined, next.data.id)).data.done, false);
    assert.equal((await call(sessionHandler, 'POST', { paid: 22000 }, next.data.id)).data.done, true);
    await call(sessionHandler, 'DELETE', undefined, id);
    assert.equal((await call(sessionHandler, 'GET', undefined, id)).code, 404);
    assert.equal((await call(sessionHandler, 'POST', { paid: 20000 }, id)).code, 404);
    assert.equal((await call(sessionHandler, 'GET', undefined, 'bad')).code, 400);
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    assert.equal((await call(create, 'POST', { total: 4500 })).code, 503);
    console.log('PASS: Vercel QR sessions, public links, input validation, Done, cancellation, reset, and missing configuration.');
  } finally {
    global.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    if (originalToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
