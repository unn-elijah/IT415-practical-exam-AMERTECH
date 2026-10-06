'use strict';

const { getSession, cancelSession, completeSession } = require('../../lib/qr-store');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const id = req.query.id;
  if (typeof id !== 'string' || !/^[a-f0-9]{32}$/.test(id)) {
    return res.status(400).json({ error: 'Invalid payment session' });
  }
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    if (req.method === 'DELETE') {
      await cancelSession(id);
      return res.status(200).json({ cancelled: true });
    }
    let session;
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const paid = body?.paid;
      if (!Number.isSafeInteger(paid) || paid < 0) {
        return res.status(400).json({ error: 'Invalid amount' });
      }
      session = await completeSession(id, paid);
      if (session === 'insufficient') {
        return res.status(400).json({ error: 'Enter an amount equal to or greater than the total due.' });
      }
    } else session = await getSession(id);
    if (!session) return res.status(404).json({ error: 'Payment session expired. Scan the new QR code.' });
    return res.status(200).json(session);
  } catch (error) {
    if (error instanceof SyntaxError) return res.status(400).json({ error: 'Invalid request' });
    return res.status(503).json({ error: 'QR storage unavailable. Try again shortly.' });
  }
};
