/* patch4d.js — instrument renderGroup for the failing selftest assertion. */
'use strict';
const fs = require('fs');
let s = fs.readFileSync(__dirname + '/app.js', 'utf8');
// mark start of the async IIFE
s = s.replace("  (async () => {\n    let allR = [], cloudLive = false, profilesMeta = Profiles.map;",
              "  (async () => {\n    window.__groupDebug = { started: true };\n    let allR = [], cloudLive = false, profilesMeta = Profiles.map;");
// mark cloud branch result
s = s.replace("        const g = await Cloud.pullGroup();\n        allR = g.results; profilesMeta = g.profiles; cloudLive = true;\n      } catch (e) { console.warn('group cloud pull failed', e); }",
              "        const g = await Cloud.pullGroup();\n        allR = g.results; profilesMeta = g.profiles; cloudLive = true;\n        window.__groupDebug.cloud = { results: allR.length, profiles: Object.keys(profilesMeta) };\n      } catch (e) { window.__groupDebug.cloudError = e.message; console.warn('group cloud pull failed', e); }");
// mark the end with rows info
s = s.replace("    if (!rows.length) { wrap.innerHTML = '<p class=\"muted\">No profiles yet — create one on the Dashboard.</p>'; return; }",
              "    window.__groupDebug.rows = rows.length;\n    window.__groupDebug.names = names;\n    if (!rows.length) { wrap.innerHTML = '<p class=\"muted\">No profiles yet — create one on the Dashboard.</p>'; return; }");
// mark fallback
s = s.replace("    if (!cloudLive) {\n      allR = Store.ok ? await Store.all('results') : S.results.slice().concat(Object.keys(MemStash.results).reduce((a, k) => a.concat(MemStash.results[k]), []));\n    }",
              "    if (!cloudLive) {\n      window.__groupDebug.fellBack = true;\n      allR = Store.ok ? await Store.all('results') : S.results.slice().concat(Object.keys(MemStash.results).reduce((a, k) => a.concat(MemStash.results[k]), []));\n    }");
fs.writeFileSync(__dirname + '/app.js', s);
console.log('renderGroup instrumented');
