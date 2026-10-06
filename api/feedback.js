'use strict';

const { redis } = require('../lib/qr-store');
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { reference, rating, comment = '' } = body || {};
    if (typeof reference !== 'string' || !/^REF-\d{8}-\d{6}$/.test(reference) ||
        !Number.isInteger(rating) || rating < 1 || rating > 5 ||
        typeof comment !== 'string' || comment.length > 1000) {
      return res.status(400).json({ error: 'Choose a rating from 1 to 5 and keep comments under 1,000 characters.' });
    }
    const feedback = { reference, rating, comment: comment.trim(), createdAt: new Date().toISOString() };
    // One submission per receipt, retained for 90 days in the existing Redis database.
    await redis(['SET', `campus-pos:feedback:${reference}`, JSON.stringify(feedback), 'EX', 90 * 24 * 60 * 60, 'NX']);
    return res.status(200).json({ saved: true });
  } catch (error) {
    if (error instanceof SyntaxError) return res.status(400).json({ error: 'Invalid feedback request' });
    return res.status(503).json({ error: 'Unable to save feedback right now. Please try again.' });
  }
};
