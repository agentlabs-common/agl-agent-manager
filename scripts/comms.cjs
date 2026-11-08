// Agent communication store, kept by the portal outside every agent's own notes.
//   <dir>/contacts.json          one record per pair of agents: requested, allowed, denied or withdrawn
//   <dir>/threads/<a>__<b>.jsonl the conversation between two agents, one message per line
// Agents can only request a contact and send to an allowed one. Only the user's click in the portal decides a contact.
const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os'); const crypto = require('node:crypto');

const defaultDir = (home = os.homedir()) => path.join(home, '.config', 'agentlabs', 'agl', 'comms');
const pairKey = (a, b) => [a, b].sort().join('|');
const fileSafe = (id) => String(id).replace(/[^A-Za-z0-9._-]/g, '+');
const threadFile = (dir, a, b) => path.join(dir, 'threads', [a, b].sort().map(fileSafe).join('__') + '.jsonl');
const VALID = /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/;
function checkId(id) { if (!VALID.test(String(id || ''))) throw new Error('Agents are named agent/session, for example claude/hrms-lead.'); return String(id); }

function sleep(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }
// One writer at a time: a lock folder, broken if a crashed writer left it behind.
function withLock(dir, fn) {
  fs.mkdirSync(dir, { recursive: true }); const lock = path.join(dir, '.lock');
  for (let i = 0; ; i++) {
    try { fs.mkdirSync(lock); break; } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      try { if (Date.now() - fs.statSync(lock).mtimeMs > 10000) { fs.rmdirSync(lock); continue; } } catch {}
      if (i > 100) throw new Error('The contact list is busy. Try again.');
      sleep(20);
    }
  }
  try { return fn(); } finally { fs.rmdirSync(lock); }
}
function fingerprint(text) { return crypto.createHash('sha256').update(text).digest('hex'); }
function load(dir) { try { return JSON.parse(fs.readFileSync(path.join(dir, 'contacts.json'), 'utf8')); } catch (e) { if (e.code === 'ENOENT') return { pairs: {} }; throw e; } }
function save(dir, data) { const file = path.join(dir, 'contacts.json'); const text = JSON.stringify(data, null, 2) + '\n'; fs.writeFileSync(file + '.tmp', text); fs.renameSync(file + '.tmp', file); return text; }

function contactsOf(dir, me) { return Object.entries(load(dir).pairs).filter(([k]) => k.split('|').includes(me)).map(([k, v]) => ({ with: k.split('|').find((x) => x !== me) || me, ...v })).sort((a, b) => a.with.localeCompare(b.with)); }
function isAllowed(dir, a, b) { return a === b || load(dir).pairs[pairKey(a, b)]?.status === 'allowed'; }

// An agent asks to talk to someone new. It cannot change a decision the user has made.
function request(dir, from, to, reason, now = new Date()) {
  checkId(from); checkId(to); if (from === to) throw new Error('That is you.');
  reason = String(reason || '').trim(); if (!reason) throw new Error('Say in one line why you need this contact.'); if (reason.length > 500) throw new Error('Keep the reason under 500 characters.');
  return withLock(dir, () => { const d = load(dir); const k = pairKey(from, to); const cur = d.pairs[k];
    if (cur && cur.status !== 'requested') return { ...cur, unchanged: true };
    d.pairs[k] = { status: 'requested', requestedBy: from, reason, requestedAt: now.toISOString() }; save(dir, d); return d.pairs[k]; });
}
// The user's decision, called only from the portal's own pages.
function decide(dir, a, b, status, now = new Date()) {
  checkId(a); checkId(b); if (!['allowed', 'denied', 'withdrawn'].includes(status)) throw new Error('Invalid decision.');
  return withLock(dir, () => { const d = load(dir); const k = pairKey(a, b); d.pairs[k] = { ...(d.pairs[k] || {}), status, decidedAt: now.toISOString() }; save(dir, d); return d.pairs[k]; });
}

function readThread(dir, a, b) { try { return fs.readFileSync(threadFile(dir, a, b), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch (e) { if (e.code === 'ENOENT') return []; throw e; } }
function send(dir, from, to, text, now = new Date()) {
  checkId(from); checkId(to); text = String(text || '').trim();
  if (!text) throw new Error('Write a message first.'); if (text.length > 8000) throw new Error('Keep a message under 8,000 characters.');
  if (from === to) throw new Error('That is you.');
  const pair = load(dir).pairs[pairKey(from, to)];
  if (pair?.status !== 'allowed') throw new Error(!pair ? `No permission to talk to ${to}. Ask first: agl-talk request ${to} "why".` : pair.status === 'requested' ? `Your contact request for ${to} is waiting for the user.` : `The user has ${pair.status === 'denied' ? 'denied' : 'withdrawn'} permission to talk to ${to}.`);
  const message = { id: crypto.randomBytes(6).toString('hex'), from, to, text, at: now.toISOString() };
  fs.mkdirSync(path.join(dir, 'threads'), { recursive: true }); fs.appendFileSync(threadFile(dir, from, to), JSON.stringify(message) + '\n');
  return message;
}
function threadsOf(dir, me) {
  let files = []; try { files = fs.readdirSync(path.join(dir, 'threads')); } catch {}
  const prefix = fileSafe(me); const out = [];
  for (const f of files) { const [a, b] = f.replace(/\.jsonl$/, '').split('__'); if (a !== prefix && b !== prefix) continue; const msgs = fs.readFileSync(path.join(dir, 'threads', f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); if (!msgs.length) continue; const first = msgs[0]; out.push({ with: first.from === me ? first.to : first.from, messages: msgs }); }
  return out.sort((x, y) => y.messages[y.messages.length - 1].at.localeCompare(x.messages[x.messages.length - 1].at));
}
// Read position per agent, so an agent only hears what is new.
function readMarks(dir, me) { try { return JSON.parse(fs.readFileSync(path.join(dir, 'read', fileSafe(me) + '.json'), 'utf8')); } catch { return {}; } }
function unread(dir, me) { const marks = readMarks(dir, me); return threadsOf(dir, me).flatMap((t) => t.messages.filter((m) => m.to === me && m.at > (marks[t.with] || ''))); }
function markRead(dir, me, messages) { const marks = readMarks(dir, me); for (const m of messages) if (m.at > (marks[m.from] || '')) marks[m.from] = m.at; fs.mkdirSync(path.join(dir, 'read'), { recursive: true }); const f = path.join(dir, 'read', fileSafe(me) + '.json'); fs.writeFileSync(f + '.tmp', JSON.stringify(marks)); fs.renameSync(f + '.tmp', f); }

// Listening: the inbox wait touches this file; the portal shows who is listening.
function heartbeat(dir, me) { const d = path.join(dir, 'listening'); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, fileSafe(me)), new Date().toISOString()); }
function listeningAt(dir, me) { try { return fs.statSync(path.join(dir, 'listening', fileSafe(me))).mtimeMs; } catch { return 0; } }

module.exports = { defaultDir, pairKey, contactsOf, isAllowed, request, decide, send, readThread, threadsOf, unread, markRead, heartbeat, listeningAt, load, fingerprint };
