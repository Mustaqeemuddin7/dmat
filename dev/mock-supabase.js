/* mock-supabase.js — minimal in-memory Supabase-compatible test server.
   Run: node dev/mock-supabase.js [port]     (default port 8787)
   Emulates ONLY the endpoints the app uses (auth signup/login/refresh/health,
   REST select + upsert for the two tables) plus permissive CORS, so the real
   cloud layer can be tested end-to-end from a headless browser.
   THIS IS A TEST DOUBLE — never a substitute for a real backend. */
'use strict';
const http = require('http');
const port = Number(process.argv[2] || 8787);
const users = [], sessions = {}, refreshTokens = {};
const tables = { dmat_results: [], dmat_profiles: [] };
let hits = { signup: 0, login: 0, refresh: 0, push: 0, pull: 0 };

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, apikey, content-type, prefer');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    console.log(new Date().toISOString().slice(11, 19), req.method, req.url);
    const u = new URL(req.url, 'http://localhost');
    const p = u.pathname;
    const json = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
    const authUser = () => {
      const h = (req.headers.authorization || '').replace(/^Bearer /, '');
      return sessions[h] || null;
    };
    if (p === '/auth/v1/health') return json(200, { version: 'mock-supabase', hits });
    if (p === '/slow.png') { // holds the page's load event open so async tests finish before dump-dom
      req.on('close', () => { }); // keep-alive trick not needed; just delay the response
      setTimeout(() => { try { res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a', 'hex')); } catch (e) { } }, 15000);
      return;
    }

    if (p === '/auth/v1/signup' && req.method === 'POST') {
      const { email, password } = JSON.parse(body || '{}');
      if (!email || !password) return json(400, { error: 'email and password required' });
      let user = users.find(x => x.email === email);
      if (user && user.password !== password) return json(400, { error: 'email already registered' });
      if (!user) { user = { id: 'u-' + Math.random().toString(36).slice(2, 10), email, password }; users.push(user); }
      const tok = 'tok-' + Math.random().toString(36).slice(2), rt = 'rt-' + Math.random().toString(36).slice(2);
      sessions[tok] = user.id; refreshTokens[rt] = user.id; hits.signup++;
      return json(200, { access_token: tok, refresh_token: rt, user: { id: user.id, email: user.email } });
    }

    if (p === '/auth/v1/token' && req.method === 'POST') {
      const grant = u.searchParams.get('grant_type');
      const b = JSON.parse(body || '{}');
      if (grant === 'password') {
        const user = users.find(x => x.email === b.email && x.password === b.password);
        if (!user) return json(400, { error: 'Invalid login credentials' });
        const tok = 'tok-' + Math.random().toString(36).slice(2), rt = 'rt-' + Math.random().toString(36).slice(2);
        sessions[tok] = user.id; refreshTokens[rt] = user.id; hits.login++;
        return json(200, { access_token: tok, refresh_token: rt, user: { id: user.id, email: user.email } });
      }
      if (grant === 'refresh_token') {
        const uid = refreshTokens[b.refresh_token];
        if (!uid) return json(400, { error: 'Invalid refresh token' });
        const tok = 'tok-' + Math.random().toString(36).slice(2), rt = 'rt-' + Math.random().toString(36).slice(2);
        sessions[tok] = uid; refreshTokens[rt] = uid; hits.refresh++;
        const user = users.find(x => x.id === uid);
        return json(200, { access_token: tok, refresh_token: rt, user: { id: uid, email: user && user.email } });
      }
      return json(400, { error: 'bad grant' });
    }

    if (p.startsWith('/rest/v1/')) {
      const table = p.slice('/rest/v1/'.length).split('?')[0];
      if (!tables[table]) return json(404, { error: 'relation does not exist: ' + table });
      if (req.method === 'GET') {
        let rows = tables[table].slice();
        for (const [k, v] of u.searchParams) {
          if (k === 'select') continue;
          const m = v.match(/^eq\.(.*)$/);
          if (m) rows = rows.filter(r => String(r[k]) === m[1]);
        }
        hits.pull++;
        return json(200, rows);
      }
      if (req.method === 'POST') {
        const auth = authUser();
        if (!auth) return json(401, { error: 'no session' });
        const parsed = JSON.parse(body || '[]');
        const rows = Array.isArray(parsed) ? parsed : [parsed];
        const pk = table === 'dmat_results' ? 'uid' : 'id';
        for (const r of rows) {
          if (!r.user_id) r.user_id = auth;
          const i = tables[table].findIndex(x => String(x[pk]) === String(r[pk]));
          if (i >= 0) tables[table][i] = r; else tables[table].push(r);
        }
        hits.push++;
        res.writeHead(201, { 'Content-Type': 'application/json' });
        return res.end('[]');
      }
      return json(405, { error: 'method not allowed' });
    }
    json(404, { error: 'not found: ' + p });
  });
}).listen(port, () => console.log('mock-supabase listening on http://127.0.0.1:' + port));
