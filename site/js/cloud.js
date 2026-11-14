/* ============================================================================
   dMAT Core Module Practice — optional cloud sync (v4)
   ----------------------------------------------------------------------------
   Syncs progress between laptops through a FREE Supabase project, using the
   plain REST API via fetch — no SDK, no other external library, so the HTML
   file stays fully self-contained and works offline; the cloud is an ADD-ON:

     - offline-first: IndexedDB remains the source of truth; the cloud layer
       only ADDS cross-device sync and the live group comparison.
     - auth: each friend creates their own account (email + password) inside
       the app; Supabase Row Level Security keeps writes to your own rows and
       lets the whole group read them for the comparison.
     - results are append-only and keyed by a unique uid, so merging is a
       simple union — nothing can be overwritten or lost.

   Tables (created by the user via the Supabase SQL editor, see Settings):
     dmat_profiles (id, user_id, name, created_at, last_activity, stats jsonb)
     dmat_results  (uid, user_id, profile, module, qid, cls, type, techs jsonb,
                    outcome, time_sec, answer, at)

   Configuration lives in localStorage ('dmat.cloud', 'dmat.cloudSession') —
   the anon key is public by design; it is NOT a secret.
   ========================================================================== */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.DMATCloud = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const Cloud = {
    cfg: null,        // {url, key}
    session: null,    // {access_token, refresh_token, user:{id, email}, at}
    status: 'off',    // off | connected | online | error
    lastSync: null,
    error: null,
    pending: [],      // result uids awaiting push

    load() {
      try { this.cfg = JSON.parse(localStorage.getItem('dmat.cloud') || 'null'); } catch (e) { this.cfg = null; }
      // fall back to the baked-in group project unless the user disconnected
      const baked = (typeof self !== 'undefined' && self.DMAT_BAKED_CLOUD) || (typeof globalThis !== 'undefined' && globalThis.DMAT_BAKED_CLOUD) || null;
      if (!this.cfg && baked && localStorage.getItem('dmat.cloudOff') !== '1') {
        this.cfg = baked;
      }
      try { this.session = JSON.parse(localStorage.getItem('dmat.cloudSession') || 'null'); } catch (e) { this.session = null; }
      this.status = this.cfg ? (this.session ? 'online' : 'connected') : 'off';
      return this;
    },
    persistCfg() { try { this.cfg ? localStorage.setItem('dmat.cloud', JSON.stringify(this.cfg)) : localStorage.removeItem('dmat.cloud'); } catch (e) { } },
    persistSession() { try { this.session ? localStorage.setItem('dmat.cloudSession', JSON.stringify(this.session)) : localStorage.removeItem('dmat.cloudSession'); } catch (e) { } },
    ready() { return !!(this.cfg && this.session && this.session.access_token); },
    setUI() { if (typeof renderCloudChip === 'function') renderCloudChip(); },

    async connect(url, key) {
      url = String(url || '').trim().replace(/\/+$/, '');
      key = String(key || '').trim();
      if (!/^https?:\/\//.test(url)) throw new Error('Project URL must start with https:// (http:// only for a local test server).');
      if (!key) throw new Error('The anon public key is required.');
      this.cfg = { url, key };
      try { localStorage.removeItem('dmat.cloudOff'); } catch (e) { }
      this.persistCfg();
      const r = await fetch(url + '/auth/v1/health', { headers: { apikey: key } });
      if (!r.ok) throw new Error('Could not reach that project (HTTP ' + r.status + '). Check the URL.');
      this.status = 'connected'; this.error = null; this.setUI();
      return true;
    },
    disconnect() { this.cfg = null; this.session = null; this.pending = []; this.status = 'off'; this.persistCfg(); this.persistSession(); try { localStorage.setItem('dmat.cloudOff', '1'); } catch (e) { } this.setUI(); },

    async api(path, opts) {
      opts = opts || {};
      const headers = Object.assign({ apikey: this.cfg.key, 'Content-Type': 'application/json' }, opts.headers || {});
      if (this.session && this.session.access_token) headers['Authorization'] = 'Bearer ' + this.session.access_token;
      const r = await fetch(this.cfg.url + path, { method: opts.method || 'GET', headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
      if (r.status === 401 || r.status === 403) { const t = await r.text(); throw new Error('Not authorised (' + r.status + '): ' + t.slice(0, 140)); }
      if (!r.ok) { const t = await r.text(); throw new Error('HTTP ' + r.status + ': ' + t.slice(0, 180)); }
      const pref = (opts.headers && opts.headers.Prefer) || '';
      if (pref.indexOf('return=minimal') >= 0 || r.status === 204) return null;
      const txt = await r.text();
      return txt ? JSON.parse(txt) : null;
    },

    async signUp(email, password) {
      if (!this.cfg) throw new Error('Connect a Supabase project first.');
      const d = await this.api('/auth/v1/signup', { method: 'POST', body: { email, password } });
      if (!d || !d.access_token) throw new Error('Sign-up pending email confirmation — turn OFF "Confirm email" in Supabase → Authentication (see the setup guide).');
      this.session = { access_token: d.access_token, refresh_token: d.refresh_token, user: d.user, at: Date.now() };
      this.persistSession(); this.status = 'online'; this.setUI();
      return d.user;
    },
    async signIn(email, password) {
      if (!this.cfg) throw new Error('Connect a Supabase project first.');
      const d = await this.api('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
      this.session = { access_token: d.access_token, refresh_token: d.refresh_token, user: d.user, at: Date.now() };
      this.persistSession(); this.status = 'online'; this.setUI();
      return d.user;
    },
    async ensureSession() {
      if (!this.ready()) return false;
      if (Date.now() - (this.session.at || 0) < 45 * 60 * 1000) return true;
      try {
        const d = await this.api('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: this.session.refresh_token } });
        this.session = { access_token: d.access_token, refresh_token: d.refresh_token, user: d.user, at: Date.now() };
        this.persistSession();
        return true;
      } catch (e) { this.status = 'error'; this.error = e.message; this.setUI(); return false; }
    },
    signOut() { this.session = null; this.pending = []; this.status = this.cfg ? 'connected' : 'off'; this.persistSession(); this.setUI(); },

    queueUid(uid) { if (this.ready() && uid && this.pending.indexOf(uid) < 0) this.pending.push(uid); },

    /* ------------------------------ push ---------------------------------- */
    resultRow(r, userId) {
      return { uid: r.uid, user_id: userId, profile: r.profile, module: r.module, qid: r.qid, cls: r.cls, type: r.type,
               techs: r.techs || [], outcome: r.outcome, time_sec: r.timeSec || 0, answer: r.user === undefined ? null : r.user,
               at: new Date(r.at || Date.now()).toISOString() };
    },
    async flush(activeProfile, getResult, stats) {
      if (!this.ready() || !(await this.ensureSession())) return;
      const uid = this.session.user.id;
      try {
        const rows = [];
        this.pending.forEach(u => { const r = getResult(u); if (r) rows.push(this.resultRow(r, uid)); });
        if (rows.length) {
          await this.api('/rest/v1/dmat_results', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: rows });
          this.pending = [];
        }
        if (activeProfile) {
          await this.api('/rest/v1/dmat_profiles', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: [{ id: uid + ':' + activeProfile, user_id: uid, name: activeProfile, last_activity: new Date().toISOString(), stats: stats || {} }] });
        }
        this.lastSync = Date.now(); this.status = 'online'; this.error = null; this.setUI();
      } catch (e) { this.status = 'error'; this.error = e.message; this.setUI(); }
    },

    /* ------------------------------ pull ---------------------------------- */
    async pullMine() {
      if (!this.ready() || !(await this.ensureSession())) return [];
      const uid = this.session.user.id;
      const rows = await this.api('/rest/v1/dmat_results?select=*&user_id=eq.' + uid);
      return (rows || []).map(unsnakeRow);
    },
    async pullGroup() {
      if (!this.ready() || !(await this.ensureSession())) throw new Error('Cloud not connected.');
      const self = this;
      const parts = await Promise.all([
        this.api('/rest/v1/dmat_results?select=*'),
        this.api('/rest/v1/dmat_profiles?select=*')
      ]);
      const results = (parts[0] || []).map(unsnakeRow);
      const profiles = {};
      (parts[1] || []).forEach(p => {
        const la = Date.parse(p.last_activity) || 0, ca = Date.parse(p.created_at) || Date.now();
        if (!profiles[p.name]) profiles[p.name] = { createdAt: ca, lastActivity: la };
        else profiles[p.name].lastActivity = Math.max(profiles[p.name].lastActivity, la);
      });
      return { results, profiles, syncedAt: self.lastSync };
    }
  };

  function unsnakeRow(r) {
    return { uid: r.uid, profile: r.profile, module: r.module, qid: r.qid, cls: r.cls, type: r.type,
             techs: Array.isArray(r.techs) ? r.techs : [], outcome: r.outcome, timeSec: r.time_sec || 0,
             user: r.answer === undefined ? null : r.answer, at: Date.parse(r.at) || Date.now() };
  }

  return Cloud;
});
