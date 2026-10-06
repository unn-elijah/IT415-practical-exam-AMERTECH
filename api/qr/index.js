'use strict';

const { randomBytes } = require('node:crypto');
const { createSession } = require('../../lib/qr-store');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const total = body?.total;
    if (!Number.isSafeInteger(total) || total <= 0) {
      return res.status(400).json({ error: 'Invalid total' });
    }
    const id = randomBytes(16).toString('hex');
    await createSession(id, total);
    // A relative URL keeps the phone and kiosk on the same deployed website.
    const paymentUrl = `/pay.html?session=${id}&total=${total}`;
    return res.status(201).json({ id, paymentUrl });
  } catch (error) {
    if (error instanceof SyntaxError) return res.status(400).json({ error: 'Invalid request' });
    return res.status(503).json({ error: 'QR storage unavailable. Check the server environment variables.' });
  }
};
