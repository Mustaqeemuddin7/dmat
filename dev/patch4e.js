/* patch4e.js — fix group-test ordering: render check with data belongs in the
   cloud section (after rows exist); profiles section keeps a render-only check. */
'use strict';
const fs = require('fs');
let s = fs.readFileSync(__dirname + '/app.js', 'utf8');
function rep(from, to, label) {
  const i = s.indexOf(from);
  if (i < 0) { console.error('ANCHOR NOT FOUND: ' + label); process.exit(1); }
  s = s.slice(0, i) + to + s.slice(i + from.length);
}
rep(`    showView('group');
    await new Promise(res => setTimeout(res, 800));
    const gtxt = document.getElementById('view-group').textContent;
    t('group dashboard renders profiles', gtxt.indexOf('CloudTester') >= 0 || gtxt.indexOf('TestAlfa') >= 0, 'debug=' + JSON.stringify(window.__groupDebug) + ' text=' + JSON.stringify(gtxt.slice(0, 200)));`,
`    showView('group');
    await new Promise(res => setTimeout(res, 300));
    const gtxt = document.getElementById('view-group').textContent;
    t('group dashboard renders', gtxt.indexOf('Group Dashboard') >= 0);`, 'profiles-group');

rep(`      Cloud.session = prevSession; Cloud.persistSession();`,
`      // group view now shows the pushed rows live from the cloud
      showView('group');
      await new Promise(res => setTimeout(res, 600));
      const gtxt = document.getElementById('view-group').textContent;
      t('group dashboard live from cloud', gtxt.indexOf('CloudTester') >= 0, 'text=' + JSON.stringify(gtxt.slice(0, 140)));
      Cloud.session = prevSession; Cloud.persistSession();`, 'cloud-group');

fs.writeFileSync(__dirname + '/app.js', s);
console.log('group test ordering fixed');
