/* patch4c.js — simplify the holdload img src (drop regex cleanup). */
'use strict';
const fs = require('fs');
let s = fs.readFileSync(__dirname + '/app.js', 'utf8');
const bad = s.match(/img\.src = p\.get\('cloud'\)[^;]+;/);
if (!bad) { console.error('img.src line not found'); process.exit(1); }
s = s.replace(bad[0], "img.src = p.get('cloud') + '/slow.png';");
fs.writeFileSync(__dirname + '/app.js', s);
console.log('img.src simplified');
