/* patch4b.js — rebuild the SQL guide block cleanly (no shell-escape damage). */
'use strict';
const fs = require('fs');
let s = fs.readFileSync(__dirname + '/app.js', 'utf8');
const a = s.indexOf("  const g = el('details', 'small'); g.style.marginTop = '10px';");
const b = s.indexOf('  cc.appendChild(g);', a);
if (a < 0 || b < 0) { console.error('anchors missing', a, b); process.exit(1); }

const SQL = [
  '-- Run once in the Supabase SQL editor',
  'create table if not exists public.dmat_profiles (',
  '  id text primary key,',
  '  user_id uuid not null default auth.uid() references auth.users on delete cascade,',
  '  name text not null,',
  '  created_at timestamptz not null default now(),',
  '  last_activity timestamptz not null default now(),',
  "  stats jsonb not null default '{}'::jsonb",
  ');',
  'create table if not exists public.dmat_results (',
  '  uid text primary key,',
  '  user_id uuid not null default auth.uid() references auth.users on delete cascade,',
  '  profile text not null,',
  '  module text not null,',
  '  qid text not null,',
  '  cls text,',
  '  type text,',
  '  techs jsonb,',
  '  outcome text not null,',
  '  time_sec int not null default 0,',
  '  answer text,',
  '  at timestamptz not null default now()',
  ');',
  'alter table public.dmat_profiles enable row level security;',
  'alter table public.dmat_results enable row level security;',
  'create policy "profiles own write" on public.dmat_profiles for insert with check (auth.uid() = user_id);',
  'create policy "profiles own update" on public.dmat_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);',
  "create policy \"profiles group read\" on public.dmat_profiles for select using (auth.role() = 'authenticated');",
  'create policy "results own write" on public.dmat_results for insert with check (auth.uid() = user_id);',
  'create policy "results own update" on public.dmat_results for update using (auth.uid() = user_id) with check (auth.uid() = user_id);',
  "create policy \"results group read\" on public.dmat_results for select using (auth.role() = 'authenticated');"
].join('\n');

const fixed = `  const g = el('details', 'small'); g.style.marginTop = '10px';
  const SQL = ${JSON.stringify(SQL)};
  g.innerHTML = '<summary><b>Setup guide (one person does this once, ~5 minutes)</b></summary>' +
    '<ol class="small">' +
    '<li>Create a free project at <a href="https://supabase.com" target="_blank" rel="noopener">supabase.com</a> (no credit card needed).</li>' +
    '<li>In the project: <b>Authentication → Providers → Email</b> → turn <b>OFF</b> "Confirm email" (so friends can log in straight away).</li>' +
    '<li><b>SQL Editor → New query</b> — paste the SQL below and press <b>Run</b>.</li>' +
    '<li><b>Project Settings → API</b> — copy the <i>Project URL</i> and the <i>anon public key</i> into the fields above and Connect.</li>' +
    '<li>Share this HTML file with your friends. Each one connects with the SAME URL + key, then creates their own account (email + password) and a profile with their name. The Group tab then shows everybody live.</li>' +
    '</ol>' +
    '<pre style="background:var(--panel2);border:1px solid var(--border2);border-radius:6px;padding:10px;font-size:12px;white-space:pre-wrap">' + esc(SQL) + '</pre>' +
    '<p class="small muted">Security notes: the anon key is public by design — safety comes from Row Level Security (you can only write your own rows; the group can read). Anyone with the URL + key + an account can read group scores, so use a private project. Data lives in YOUR project on supabase.com.</p>';
  cc.appendChild(g);
`;
s = s.slice(0, a) + fixed + s.slice(b + '  cc.appendChild(g);'.length);
fs.writeFileSync(__dirname + '/app.js', s);
console.log('SQL guide rebuilt cleanly');
