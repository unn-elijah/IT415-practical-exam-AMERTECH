'use strict';

const prefix = 'campus-pos:qr:';
const lifetimeSeconds = 30 * 60;

async function redis(command) {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('QR storage is not configured');
  const response = await fetch(url.replace(/\/$/, ''), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error('QR storage is unavailable');
  const data = await response.json();
  if (data.error) throw new Error('QR storage request failed');
  return data.result;
}

async function createSession(id, total) {
  const session = { total, done: false, paid: 0, expires: Date.now() + lifetimeSeconds * 1000 };
  await redis(['SET', prefix + id, JSON.stringify(session), 'EX', lifetimeSeconds]);
}

async function getSession(id) {
  const value = await redis(['GET', prefix + id]);
  return value ? JSON.parse(value) : null;
}

async function cancelSession(id) {
  return redis(['DEL', prefix + id]);
}

// Validate and save Done atomically: repeated taps cannot overwrite the first payment.
async function completeSession(id, paid) {
  const script = `
    local value = redis.call('GET', KEYS[1])
    if not value then return nil end
    local session = cjson.decode(value)
    if tonumber(ARGV[1]) < session.total then return 'insufficient' end
    if not session.done then
      local ttl = redis.call('PTTL', KEYS[1])
      if ttl <= 0 then return nil end
      session.paid = tonumber(ARGV[1])
      session.done = true
      value = cjson.encode(session)
      redis.call('SET', KEYS[1], value, 'PX', ttl)
    end
    return value
  `;
  const result = await redis(['EVAL', script, 1, prefix + id, String(paid)]);
  if (!result || result === 'insufficient') return result;
  return JSON.parse(result);
}

module.exports = { createSession, getSession, cancelSession, completeSession, redis };
