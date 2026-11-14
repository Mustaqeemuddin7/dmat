/* patch8.js — fix the notes sidebar group lookup: match group elements through
   a Map (raw titles) instead of attribute selectors (entity-escaping broke
   categories containing '&', e.g. 'Formulas & deep dives'). */
'use strict';
const fs = require('fs');
let s = fs.readFileSync(__dirname + '/study-notes.js', 'utf8');
const from = `      const navList = el('div');
      const renderNav = filter => {
        navList.innerHTML = '';
        (this.order[mid] || []).filter(id => id !== '__deep__').forEach(id => {
          const t = this.topics[id];
          if (filter && t.search.indexOf(filter.toLowerCase()) < 0) return;
          if (!navList.querySelector('[data-cat="' + esc(t.cat) + '"]')) {
            const d = el('details', '', '<summary class="small" style="font-weight:700">' + esc(t.cat) + '</summary>');
            d.dataset.cat = t.cat; d.open = true;
            navList.appendChild(d);
          }
          const row = el('div', 'trow' + (topicId === id ? ' cur' : ''));
          row.innerHTML = this.dot(this.statusOf(id)) + '<span class="small" style="flex:1">' + esc(t.title) + '</span>' +
            (S.learning.bookmarks.indexOf(id) >= 0 ? '<span class="wstar">⭐</span>' : '');
          row.onclick = () => this.openTopic(id);
          navList.querySelector('[data-cat="' + esc(t.cat) + '"]').appendChild(row);
        });
      };`;
if (s.indexOf(from) < 0) { console.error('ANCHOR NOT FOUND (renderNav)'); process.exit(1); }
const to = `      const navList = el('div');
      const renderNav = filter => {
        navList.innerHTML = '';
        const groups = {}; // cat title -> details element (raw titles; selectors break on '&')
        (this.order[mid] || []).filter(id => id !== '__deep__').forEach(id => {
          const t = this.topics[id];
          if (filter && t.search.indexOf(filter.toLowerCase()) < 0) return;
          let d = groups[t.cat];
          if (!d) {
            d = el('details', '', '<summary class="small" style="font-weight:700">' + esc(t.cat) + '</summary>');
            d.dataset.cat = t.cat; d.open = true;
            groups[t.cat] = d;
            navList.appendChild(d);
          }
          const row = el('div', 'trow' + (topicId === id ? ' cur' : ''));
          row.innerHTML = this.dot(this.statusOf(id)) + '<span class="small" style="flex:1">' + esc(t.title) + '</span>' +
            (S.learning.bookmarks.indexOf(id) >= 0 ? '<span class="wstar">⭐</span>' : '');
          row.onclick = () => this.openTopic(id);
          d.appendChild(row);
        });
      };`;
s = s.replace(from, to);
fs.writeFileSync(__dirname + '/study-notes.js', s);
console.log('sidebar group lookup fixed');
