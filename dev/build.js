/* build.js — v7 build system.
   Run:  node dev/build.js
   Emits TWO distribution outputs from the same sources:
     1. site/            — multi-file website (index.html + css/styles.css + js/*.js)
                           → upload the CONTENTS of site/ to GitHub Pages / Netlify
     2. dmat-practice.html — single self-contained file (offline sharing)
   Also refreshes deploy/ (copy of site/) and syntax-checks every JS file. */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(__dirname, f), 'utf8');

const css = read('styles.css');
const bankJson = fs.readFileSync(path.join(__dirname, 'bank.json'), 'utf8');
const template = read('template.html');
const JS_FILES = ['core.js', 'math.js', 'figures.js', 'cloud.js', 'deepnotes.js', 'notes-content.js', 'study-notes.js', 'app.js'];
const js = {};
JS_FILES.forEach(f => { js[f] = read(f); });

// safety: nothing may close a script tag from inside a source
Object.entries(js).forEach(([f, src]) => { if (src.includes('</script')) throw new Error(f + ' contains </script>'); });
if (bankJson.includes('</script')) throw new Error('bank.json contains </script>');

/* ------------------- 1. multi-file website → site/ ------------------- */
const siteDir = path.join(root, 'site');
fs.rmSync(siteDir, { recursive: true, force: true });
fs.mkdirSync(path.join(siteDir, 'css'), { recursive: true });
fs.mkdirSync(path.join(siteDir, 'js'), { recursive: true });
fs.writeFileSync(path.join(siteDir, 'css', 'styles.css'), css);
fs.writeFileSync(path.join(siteDir, 'js', 'bank.js'), "'use strict';\nconst BANK = " + bankJson + ";");
JS_FILES.forEach(f => fs.writeFileSync(path.join(siteDir, 'js', f), js[f]));
fs.writeFileSync(path.join(siteDir, 'index.html'), template);
console.log('site/  : index.html + css/styles.css + js/(' + JS_FILES.join(', ') + ', bank.js)');

/* ------------------- 2. single-file bundle --------------------------- */
let single = template
  .replace('<link rel="stylesheet" href="css/styles.css">', '<style>\n' + css + '\n</style>')
  .replace('<script src="js/bank.js"></script>', "<script>\n'use strict';\nconst BANK = " + bankJson + ";\n</script>");
JS_FILES.forEach(f => {
  single = single.replace('<script src="js/' + f + '"></script>', '<script>\n' + js[f] + '\n</script>');
});
if (single.includes('src="js/') || single.includes('href="css/')) throw new Error('single-file bundle still references external files');
const singlePath = path.join(root, 'dmat-practice.html');
fs.writeFileSync(singlePath, single);
console.log('single : dmat-practice.html (' + Math.round(single.length / 1024) + ' KB)');

/* ------------------- 3. deploy/ = copy of site/ ---------------------- */
const depDir = path.join(root, 'deploy');
fs.rmSync(depDir, { recursive: true, force: true });
fs.cpSync(siteDir, depDir, { recursive: true });
console.log('deploy/: refreshed from site/ (upload contents to GitHub Pages)');

/* ------------------- 4. syntax checks -------------------------------- */
let failures = 0;
const checks = JS_FILES.map(f => [f, js[f]]).concat([['bank.js', "'use strict';\nconst BANK = " + bankJson + ";"]]);
checks.forEach(([f, src]) => {
  const tmp = path.join(__dirname, '_check_' + f);
  fs.writeFileSync(tmp, src);
  try {
    execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
    console.log('js check OK: ' + f + ' (' + Math.round(src.length / 1024) + ' KB)');
  } catch (e) {
    console.error('SYNTAX ERROR in ' + f + ':\n' + e.stderr.toString().slice(0, 2000));
    failures++;
  } finally { fs.unlinkSync(tmp); }
});
const inline = [...single.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
inline.forEach((src, i) => {
  const tmp = path.join(__dirname, '_check_single_' + i + '.js');
  fs.writeFileSync(tmp, src);
  try {
    execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
    console.log('single-file block ' + i + ': syntax OK (' + Math.round(src.length / 1024) + ' KB)');
  } catch (e) {
    console.error('SINGLE-FILE block ' + i + ' SYNTAX ERROR:\n' + e.stderr.toString().slice(0, 2000));
    failures++;
  } finally { fs.unlinkSync(tmp); }
});
console.log(failures === 0 ? 'BUILD OK — site/ + deploy/ + dmat-practice.html' : 'BUILD FAILED');
if (failures) process.exitCode = 1;
