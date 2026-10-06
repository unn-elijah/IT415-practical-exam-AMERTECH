'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { randomBytes } = require('node:crypto');
const sessions = new Map();
const port = Number(process.env.PORT || 3000);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };

function getLanAddress() {
  const interfaces = Object.entries(os.networkInterfaces());
  const candidates = interfaces.flatMap(([name, addresses]) =>
    (addresses || []).filter(address => address.family === 'IPv4' && !address.internal)
      .map(address => ({ name, address: address.address })));
  return candidates.find(item => /wi-?fi|wireless|wlan/i.test(item.name))?.address ||
    candidates.find(item => !/virtual|vbox|vmware|vethernet/i.test(item.name))?.address ||
    candidates[0]?.address;
}

function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 2048) throw new Error('Request too large');
  }
  return JSON.parse(body);
}

const server = http.createServer(async (req, res) => {
  // Allow the kiosk served by Live Server on this computer to call the QR API.
  const origin = req.headers.origin;
  if (origin) {
    try {
      const caller = new URL(origin);
      const host = new URL(`http://${req.headers.host}`).hostname;
      if (caller.protocol === 'http:' && caller.hostname === host) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      }
    } catch {}
  }
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/feedback') {
      req.body = req.method === 'POST' ? await readBody(req) : undefined;
      res.status = code => { res.statusCode = code; return res; };
      res.json = data => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
      };
      return require('./api/feedback')(req, res);
    }
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (session.expires <= now) sessions.delete(id);
    }
    if (req.method === 'POST' && url.pathname === '/api/qr') {
      const { total } = await readBody(req);
      if (!Number.isSafeInteger(total) || total <= 0) return send(res, 400, { error: 'Invalid total' });
      const id = randomBytes(16).toString('hex');
      sessions.set(id, { total, done: false, paid: 0, expires: now + 30 * 60 * 1000 });
      const origin = new URL(`http://${req.headers.host}`);
      if (['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)) {
        const lanAddress = getLanAddress();
        if (!lanAddress) {
          sessions.delete(id);
          return send(res, 503, { error: 'Connect the kiosk to Wi-Fi or Ethernet first.' });
        }
        origin.hostname = lanAddress;
      }
      const paymentUrl = new URL('/pay.html', origin);
      paymentUrl.searchParams.set('session', id);
      paymentUrl.searchParams.set('total', total);
      return send(res, 201, { id, paymentUrl: paymentUrl.href });
    }
    const match = url.pathname.match(/^\/api\/qr\/([a-f0-9]{32})$/);
    if (match) {
      const session = sessions.get(match[1]);
      if (!session) return send(res, 404, { error: 'Payment session expired. Scan the new QR code.' });
      if (req.method === 'GET') return send(res, 200, session);
      if (req.method === 'DELETE') {
        sessions.delete(match[1]);
        return send(res, 200, { cancelled: true });
      }
      if (req.method === 'POST') {
        const { paid } = await readBody(req);
        if (!Number.isSafeInteger(paid) || paid < session.total) {
          return send(res, 400, { error: 'Enter an amount equal to or greater than the total due.' });
        }
        if (!session.done) { session.paid = paid; session.done = true; }
        return send(res, 200, session);
      }
      return send(res, 405, { error: 'Method not allowed' });
    }
    if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
    const relative = decodeURIComponent(url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
    // Serve only the kiosk pages and public asset directories.
    if (!/^(index\.html|pay\.html|(js|css|assets)\/[a-zA-Z0-9_./-]+)$/.test(relative) ||
        relative.split('/').some(part => part.startsWith('.'))) return send(res, 404, { error: 'Not found' });
    const file = path.resolve(__dirname, relative);
    if (!file.startsWith(__dirname + path.sep)) return send(res, 404, { error: 'Not found' });
    const content = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(content);
  } catch (error) {
    send(res, error.code === 'ENOENT' ? 404 : 400, { error: 'Unable to process request' });
  }
});

if (require.main === module) {
  server.listen(port, '0.0.0.0', () => {
    console.log('Open the kiosk using a LAN address below; phone and kiosk must share the network:');
    for (const addresses of Object.values(os.networkInterfaces())) {
      for (const address of addresses || []) {
        if (address.family === 'IPv4' && !address.internal) console.log(`http://${address.address}:${port}`);
      }
    }
  });
}
module.exports = server;
