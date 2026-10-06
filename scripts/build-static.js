'use strict';

const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'public');
fs.mkdirSync(output, { recursive: true });
for (const name of ['index.html', 'pay.html', 'css', 'js', 'assets']) {
  fs.cpSync(path.join(root, name), path.join(output, name), { recursive: true });
}
console.log('Static kiosk files prepared in public/.');
