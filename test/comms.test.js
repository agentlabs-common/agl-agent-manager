const { test } = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os');
const comms = require('../scripts/comms.cjs'); const talk = require('../scripts/agl-talk.cjs');
const LEAD = 'claude/hrms-lead', DEV = 'claude/hrms-dev', OTHER = 'claude/auth-dev';
function tmp(fn) { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agl-comms-')); try { return fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); } }

test('nobody talks without permission: request, then the user decides, and can withdraw', () => tmp((dir) => {
  assert.throws(() => comms.send(dir, DEV, LEAD, 'hi'), /No permission to talk/);
  assert.throws(() => comms.request(dir, DEV, LEAD, ' '), /Say in one line/);
  assert.equal(comms.request(dir, DEV, LEAD, 'my lead').status, 'requested');
  assert.throws(() => comms.send(dir, DEV, LEAD, 'hi'), /waiting for the user/);
  assert.deepEqual(comms.contactsOf(dir, LEAD).map((c) => [c.with, c.status]), [[DEV, 'requested']], 'both sides see it');
  comms.decide(dir, DEV, LEAD, 'allowed');
  assert.equal(comms.send(dir, DEV, LEAD, 'Is the run book ready?').text, 'Is the run book ready?');
  assert.equal(comms.send(dir, LEAD, DEV, 'Yes').from, LEAD, 'a permission covers both directions');
  assert.throws(() => comms.send(dir, DEV, OTHER, 'hi'), /No permission/, 'other pairs are unaffected');
  comms.decide(dir, DEV, LEAD, 'withdrawn');
  assert.throws(() => comms.send(dir, DEV, LEAD, 'still there?'), /withdrawn permission/);
  assert.equal(comms.request(dir, DEV, LEAD, 'please').unchanged, true, 'a request cannot undo the user\'s decision');
  assert.equal(comms.contactsOf(dir, DEV)[0].status, 'withdrawn');
  comms.decide(dir, DEV, OTHER, 'denied'); assert.throws(() => comms.send(dir, DEV, OTHER, 'hi'), /denied permission/);
  assert.throws(() => comms.request(dir, DEV, '../evil', 'x'), /named agent\/session/);
}));

test('the thread is shared, and an agent only hears what is new to it', () => tmp((dir) => {
  comms.request(dir, DEV, LEAD, 'my lead'); comms.decide(dir, DEV, LEAD, 'allowed');
  comms.send(dir, DEV, LEAD, 'one', new Date('2026-11-08T10:00:00Z')); comms.send(dir, LEAD, DEV, 'two', new Date('2026-11-08T10:01:00Z'));
  assert.deepEqual(comms.readThread(dir, LEAD, DEV).map((m) => m.text), ['one', 'two']);
  assert.deepEqual(comms.threadsOf(dir, DEV).map((t) => [t.with, t.messages.length]), [[LEAD, 2]]);
  const inbox = comms.unread(dir, LEAD); assert.deepEqual(inbox.map((m) => m.text), ['one'], 'own messages are not new');
  comms.markRead(dir, LEAD, inbox); assert.equal(comms.unread(dir, LEAD).length, 0);
  comms.send(dir, DEV, LEAD, 'three', new Date('2026-11-08T10:02:00Z')); assert.deepEqual(comms.unread(dir, LEAD).map((m) => m.text), ['three']);
}));

test('agl-talk works out who is asking from the session folder', () => tmp((dir) => {
  const seat = path.join(dir, 'ws', '.sessions', 'claude', 'hrms-dev'); fs.mkdirSync(path.join(seat, 'repo'), { recursive: true }); fs.writeFileSync(path.join(seat, '.agl-session.json'), JSON.stringify({ agent: 'claude', name: 'hrms-dev' }));
  const store = path.join(dir, 'store'); const lines = []; const run = (...a) => talk.main(a, { cwd: path.join(seat, 'repo'), dir: store, out: (l) => lines.push(l) });
  assert.equal(talk.whoAmI(path.join(seat, 'repo')), DEV); assert.throws(() => talk.whoAmI(dir), /inside an AGL session/);
  assert.throws(() => run('send', LEAD, 'hi'), /No permission/);
  run('request', LEAD, 'my lead'); assert.match(lines.pop(), /will permit or deny/);
  comms.decide(store, DEV, LEAD, 'allowed'); run('send', LEAD, 'Is it ready?'); assert.equal(lines.pop(), 'Sent.');
  comms.send(store, LEAD, DEV, 'Yes, it is');
  run('inbox', '--read'); assert.match(lines.pop(), /claude\/hrms-lead to claude\/hrms-dev:\nYes, it is/); run('inbox'); assert.equal(lines.pop(), 'No new messages.');
  run('contacts'); assert.match(lines.pop(), /claude\/hrms-lead {2}allowed/);
  assert.ok(comms.listeningAt(store, DEV) > 0, 'checking the inbox leaves a heartbeat');
}));

test('the portal shows contacts and conversations, and only its own form decides', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agl-comms-p-')); const { createPortal } = require('../portal.cjs');
  try {
    const root = path.join(dir, 's'); fs.mkdirSync(path.join(root, '.agl'), { recursive: true }); fs.writeFileSync(path.join(root, '.agl', 'STATUS.openui'), 'root = Status("idle", "x", "2026-11-08 15:00", [], [], [], [])\n');
    const store = path.join(dir, 'store'); const portal = createPortal({ commsDir: store, listSessions: async () => [{ agent: 'claude', folder: 'hrms-dev', name: 'hrms-dev', sessionRoot: root }] });
    try {
      comms.request(store, DEV, LEAD, 'my lead <b>');
      const home = await (await fetch(await portal.url())).text(); assert.match(home, /Contact requests \(1\)/);
      const pending = await (await fetch(await portal.url('contacts'))).text(); assert.match(pending, /my lead &lt;b&gt;/);
      const page = await (await fetch(await portal.url('s', 'claude', 'hrms-dev') + '?p=CONTACTS')).text(); assert.match(page, /Waiting for you/); assert.match(page, /Contacts \(1 to decide\)/); assert.doesNotMatch(page, /details class="reviews"/);
      const res = await fetch(await portal.url('contact'), { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ a: DEV, b: LEAD, status: 'allowed', back: 'https://evil.example/' }) });
      assert.equal(res.status, 303); assert.doesNotMatch(res.headers.get('location'), /evil/); assert.equal(comms.isAllowed(store, DEV, LEAD), true);
      assert.equal((await fetch(new URL(await portal.url()).origin + '/wrong/contact', { method: 'POST' })).status, 404, 'needs the token');
      comms.send(store, LEAD, DEV, 'Run the <gate>');
      const conv = await (await fetch(await portal.url('s', 'claude', 'hrms-dev') + '?p=CONVERSATIONS')).text(); assert.match(conv, />claude\/hrms-lead<\/a>/); assert.match(conv, /Run the &lt;gate&gt;/); assert.match(conv, /Conversations \(1\)/);
    } finally { await portal.close(); }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the waker wakes a stopped agent with unread messages, and never one on hold, running, or woken lately', async () => {
  const waker = require('../scripts/waker.cjs');
  await (async () => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agl-wake-')); try {
    const store = path.join(dir, 'store'); const root = path.join(dir, 'hrms-dev'); fs.mkdirSync(path.join(root, '.agl'), { recursive: true });
    fs.writeFileSync(path.join(root, '.agl-session.json'), JSON.stringify({ agent: 'claude', name: 'hrms-dev', conversations: [{ provider: 'claude', sessionId: 'old' }, { provider: 'claude', sessionId: 'sid-1' }] }));
    const sessions = [{ agent: 'claude', folder: 'hrms-dev', name: 'hrms-dev', sessionRoot: root }]; const started = []; const start = (x) => started.push(x); const stopped = async () => ['/somewhere/else'];
    assert.deepEqual(await waker.tick({ sessions, dir: store, running: stopped, start }), [], 'nothing unread');
    comms.request(store, LEAD, DEV, 'seat'); comms.decide(store, LEAD, DEV, 'allowed'); comms.send(store, LEAD, DEV, 'Please run the gate');
    assert.deepEqual(await waker.tick({ sessions, dir: store, running: async () => [path.join(root, 'repo')], start }), [], 'still running: no duplicate');
    fs.writeFileSync(path.join(root, '.agl', '.hold'), 'x'); assert.deepEqual(await waker.tick({ sessions, dir: store, running: stopped, start }), [], 'on hold'); fs.rmSync(path.join(root, '.agl', '.hold'));
    const home = path.join(dir, 'home');
    const [w] = await waker.tick({ sessions, dir: store, running: stopped, start, home }); assert.equal(w.id, DEV); assert.equal(started.length, 1); assert.equal(started[0].sessionId, 'sid-1'); assert.match(started[0].prompt, /from claude\/hrms-lead/);
    assert.deepEqual(await waker.tick({ sessions, dir: store, running: stopped, start }), [], 'cooldown'); assert.equal(waker.wakes(store, DEV).length, 1, 'each wake is logged');
    const later = Date.now() + waker.COOLDOWN_MS + 1000; comms.decide(store, LEAD, DEV, 'withdrawn'); assert.deepEqual(await waker.tick({ sessions, dir: store, running: stopped, start, now: later }), [], 'withdrawn contact cannot wake');
    const jobs = path.join(dir, 'home', '.claude', 'jobs', 'j1'); fs.mkdirSync(jobs, { recursive: true }); fs.writeFileSync(path.join(jobs, 'state.json'), JSON.stringify({ linkScanPath: '/x/sid-1.jsonl', respawnFlags: ['--name', 'a', '--dangerously-skip-permissions'] }));
    assert.deepEqual(waker.permissionFlags('sid-1', path.join(dir, 'home')), ['--dangerously-skip-permissions'], 'keeps its own mode');
    const job2 = path.join(dir, 'home', '.claude', 'jobs', 'j2'); fs.mkdirSync(job2, { recursive: true }); fs.writeFileSync(path.join(job2, 'state.json'), JSON.stringify({ linkScanPath: path.join('/p', root.replace(/[^A-Za-z0-9-]/g, '-'), 'earlier.jsonl'), respawnFlags: ['--permission-mode', 'acceptEdits'] }));
    assert.deepEqual(waker.permissionFlags('new-fork', path.join(dir, 'home'), root), ['--permission-mode', 'acceptEdits'], 'a new fork keeps the folder\'s mode'); assert.deepEqual(waker.permissionFlags('new-fork', path.join(dir, 'home')), []);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); } })();
});

test('a page reads only itself and its allowed contacts; each agent has its own gradient', async () => {
  const { gradientOf } = require('../theme.cjs'); assert.equal(gradientOf('hrms-dev'), gradientOf('hrms-dev')); assert.notEqual(gradientOf('hrms-dev'), gradientOf('hrms-dev-1'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agl-read-')); const { createPortal } = require('../portal.cjs');
  try {
    const mk = (name) => { const r = path.join(dir, name); fs.mkdirSync(path.join(r, '.agl'), { recursive: true }); fs.writeFileSync(path.join(r, '.agl', 'STATUS.openui'), `root = Status("idle", "${name}", "2026-11-08 15:00", [], [], [], [])\n`); return { agent: 'claude', folder: name, name, sessionRoot: r }; };
    const store = path.join(dir, 'store'); const portal = createPortal({ commsDir: store, listSessions: async () => [mk('hrms-lead'), mk('hrms-dev')] });
    try {
      const get = async (w, q) => (await fetch(await portal.url('api', w) + q)).json();
      assert.deepEqual((await get('sessions', '?me=hrms-lead')).map((s) => s.name), ['hrms-lead']);
      assert.equal((await get('session', '?me=hrms-lead&name=hrms-dev')).denied, true);
      comms.request(store, LEAD, DEV, 'seat'); comms.decide(store, LEAD, DEV, 'allowed');
      assert.equal((await get('sessions', '?me=hrms-lead')).length, 2); assert.match((await get('session', '?me=hrms-lead&name=hrms-dev')).program, /hrms-dev/);
      const page = await (await fetch(await portal.url('s', 'claude', 'hrms-dev'))).text(); assert.ok(page.includes('header{background:' + gradientOf('hrms-dev')), 'gradient on the page');
    } finally { await portal.close(); }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the hook lists unread messages at the next prompt', async () => {
  const { check } = require('../scripts/agl-skill-check.cjs'); const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agl-hook-'));
  try {
    const root = path.join(home, 'hrms-dev'); fs.mkdirSync(path.join(root, '.agl', 'pages'), { recursive: true }); fs.writeFileSync(path.join(root, '.agl-session.json'), JSON.stringify({ agent: 'claude', name: 'hrms-dev' }));
    fs.writeFileSync(path.join(root, '.agl', '.skill-version'), '0.10.0'); const tools = path.join(home, '.config', 'agentlabs', 'agl'); fs.mkdirSync(tools, { recursive: true });
    fs.writeFileSync(path.join(tools, 'agent-portal.json'), JSON.stringify({ skills: { 'agl-notes': '0.10.0' }, tools: { migrate: path.join(tools, 'agl-migrate.cjs') } }));
    const store = comms.defaultDir(home); assert.doesNotMatch(check(root, home), /new message/);
    comms.request(store, LEAD, DEV, 'seat'); comms.decide(store, LEAD, DEV, 'allowed'); comms.send(store, LEAD, DEV, 'Run the gate');
    assert.match(check(root, home), /AGL: 1 new message from claude\/hrms-lead\. Read with: node .*agl-talk\.cjs inbox --read/);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('waker: only sessions with no status count as stopped, a resume continues the newest conversation, failures back off', async () => {
  const waker = require('../scripts/waker.cjs'); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agl-wake2-'));
  try {
    for (const a of [{ kind: 'background', state: 'done', status: null }, { kind: 'background', state: 'blocked' }]) assert.equal(waker.isRunningEntry(a), false, 'stopped: ' + JSON.stringify(a));
    for (const a of [{ kind: 'interactive', status: 'idle' }, { kind: 'background', state: 'done', status: 'idle' }, { kind: 'background', state: 'blocked', status: 'idle' }, { kind: 'background', state: 'working', status: 'busy' }]) assert.equal(waker.isRunningEntry(a), true, 'running, even when done and idle: ' + JSON.stringify(a));
    const root = path.join(dir, 'ws', '.sessions', 'hrms-dev'); fs.mkdirSync(path.join(root, '.agl'), { recursive: true }); fs.writeFileSync(path.join(root, '.agl-session.json'), JSON.stringify({ agent: 'claude', name: 'hrms-dev', conversations: [{ provider: 'claude', sessionId: 'original' }] }));
    const home = path.join(dir, 'home'); const projects = path.join(home, '.claude', 'projects', root.replace(/[^A-Za-z0-9-]/g, '-')); fs.mkdirSync(projects, { recursive: true });
    assert.equal(waker.latestSessionId(root, home), 'original', 'no transcript yet: the recorded id');
    fs.writeFileSync(path.join(projects, 'old.jsonl'), ''); const past = (Date.now() - 60000) / 1000; fs.utimesSync(path.join(projects, 'old.jsonl'), past, past); fs.writeFileSync(path.join(projects, 'fork-2.jsonl'), '');
    assert.equal(waker.latestSessionId(root, home), 'fork-2', 'the newest conversation');
    const store = path.join(dir, 'store'); comms.request(store, LEAD, DEV, 'seat'); comms.decide(store, LEAD, DEV, 'allowed'); comms.send(store, LEAD, DEV, 'one', new Date('2026-11-08T10:00:00Z'));
    const sessions = [{ agent: 'claude', folder: 'hrms-dev', name: 'hrms-dev', sessionRoot: root }]; const running = async () => []; let t = Date.parse('2026-11-08T11:00:00Z'); const calls = []; const fail = async (x) => { calls.push(x.sessionId); return { ok: false, error: 'Workspace not trusted' }; };
    const run = () => waker.tick({ sessions, dir: store, running, start: fail, now: t, home });
    assert.equal((await run())[0].ok, false, 'logged as a failure'); assert.equal(waker.wakes(store, DEV)[0].error, 'Workspace not trusted'); assert.equal(calls[0], 'fork-2');
    t += waker.COOLDOWN_MS + 1000; assert.deepEqual(await run(), [], 'backs off: longer than the cooldown after a failure');
    t += waker.COOLDOWN_MS * 2; assert.equal((await run()).length, 1); t += waker.COOLDOWN_MS * 4 + 1000; assert.equal((await run()).length, 1); assert.equal(calls.length, 3);
    t += waker.COOLDOWN_MS * 100; assert.deepEqual(await run(), [], 'stops after three failures');
    comms.send(store, LEAD, DEV, 'two', new Date(t + 1000)); t += 2000; assert.equal((await run()).length, 1, 'a newer message tries again');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a contact list changed outside the portal stops messages until the user clears it', () => tmp((dir) => {
  comms.request(dir, DEV, LEAD, 'my lead'); comms.decide(dir, DEV, LEAD, 'allowed'); assert.equal(comms.tampered(dir), false); comms.send(dir, DEV, LEAD, 'hi');
  const file = path.join(dir, 'contacts.json'); const d = JSON.parse(fs.readFileSync(file, 'utf8')); d.pairs[comms.pairKey(DEV, OTHER)] = { status: 'allowed' }; fs.writeFileSync(file, JSON.stringify(d));
  assert.equal(comms.tampered(dir), true); assert.throws(() => comms.send(dir, DEV, OTHER, 'hi'), /changed outside the portal/); assert.equal(comms.isAllowed(dir, DEV, LEAD), false);
  comms.request(dir, 'claude/a', 'claude/b', 'x'); assert.equal(comms.tampered(dir), true, 'a later save does not hide the change');
  comms.clearTampered(dir); assert.equal(comms.tampered(dir), false); assert.equal(comms.send(dir, DEV, LEAD, 'ok').text, 'ok');
}));

test('an agent with allowed contacts and no fresh heartbeat is told to listen, and marked', async () => {
  const { check } = require('../scripts/agl-skill-check.cjs'); const { createPortal } = require('../portal.cjs'); const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agl-listen-'));
  try {
    const root = path.join(home, 'hrms-dev'); fs.mkdirSync(path.join(root, '.agl', 'pages'), { recursive: true }); fs.writeFileSync(path.join(root, '.agl-session.json'), JSON.stringify({ agent: 'claude', name: 'hrms-dev' })); fs.writeFileSync(path.join(root, '.agl', 'STATUS.openui'), 'root = Status("idle", "x", "2026-11-08 15:00", [], [], [], [])\n'); fs.writeFileSync(path.join(root, '.agl', '.skill-version'), '0.10.0');
    const tools = path.join(home, '.config', 'agentlabs', 'agl'); fs.mkdirSync(tools, { recursive: true }); fs.writeFileSync(path.join(tools, 'agent-portal.json'), JSON.stringify({ skills: { 'agl-notes': '0.10.0' }, tools: { migrate: path.join(tools, 'agl-migrate.cjs') } }));
    const store = comms.defaultDir(home); assert.equal(comms.needsListener(store, DEV), false, 'no contacts: nothing to listen for'); assert.doesNotMatch(check(root, home), /not listening/);
    comms.request(store, LEAD, DEV, 'seat'); assert.equal(comms.needsListener(store, DEV), false, 'a request alone is not enough'); comms.decide(store, LEAD, DEV, 'allowed');
    assert.equal(comms.needsListener(store, DEV), true); assert.match(check(root, home), /not listening for messages\. Start this with your background option: node .*agl-talk\.cjs inbox --wait --read/);
    const portal = createPortal({ commsDir: store, listSessions: async () => [{ agent: 'claude', folder: 'hrms-dev', name: 'hrms-dev', sessionRoot: root }] });
    try { assert.match(await (await fetch(await portal.url())).text(), />not listening</); comms.heartbeat(store, DEV); assert.doesNotMatch(await (await fetch(await portal.url())).text(), />not listening</); assert.doesNotMatch(check(root, home), /not listening/); assert.equal(comms.needsListener(store, DEV, Date.now() + comms.LISTEN_FRESH_MS + 1000), true, 'a stale heartbeat counts as not listening'); } finally { await portal.close(); }
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('Conversations lists each agent talked with, newest first with unread counts, and opens one thread', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agl-conv-')); const { createPortal } = require('../portal.cjs');
  try {
    const root = path.join(dir, 's'); fs.mkdirSync(path.join(root, '.agl'), { recursive: true }); fs.writeFileSync(path.join(root, '.agl', 'STATUS.openui'), 'root = Status("idle", "x", "2026-11-08 15:00", [], [], [], [])\n');
    const store = path.join(dir, 'store'); for (const o of [LEAD, OTHER]) { comms.request(store, DEV, o, 'r'); comms.decide(store, DEV, o, 'allowed'); }
    comms.send(store, LEAD, DEV, 'older <b>', new Date('2026-11-08T10:00:00Z')); comms.send(store, DEV, OTHER, 'mine', new Date('2026-11-08T10:01:00Z')); comms.send(store, OTHER, DEV, 'newer', new Date('2026-11-08T10:02:00Z')); comms.send(store, OTHER, DEV, 'newest', new Date('2026-11-08T10:03:00Z'));
    const portal = createPortal({ commsDir: store, listSessions: async () => [{ agent: 'claude', folder: 'hrms-dev', name: 'hrms-dev', sessionRoot: root }] });
    try {
      const base = await portal.url('s', 'claude', 'hrms-dev') + '?p=CONVERSATIONS';
      const list = await (await fetch(base)).text(); const main = list.slice(list.indexOf('<h2>Conversations'));
      assert.ok(main.indexOf(OTHER) < main.indexOf(LEAD), 'newest first'); assert.match(main, /2 unread/); assert.match(main, /1 unread/); assert.doesNotMatch(main, /class="thread"/, 'the list shows no thread');
      const one = await (await fetch(base + '&w=' + encodeURIComponent(LEAD))).text(); assert.match(one, /With claude\/hrms-lead/); assert.match(one, /older &lt;b&gt;/); assert.doesNotMatch(one, /newest/, 'only that pair'); assert.match(one, /All conversations/);
    } finally { await portal.close(); }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('waker resumes the seat itself: its job without flags (name and mode kept), never a copy; a job-less conversation gets the seat name', () => {
  const waker = require('../scripts/waker.cjs'); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agl-wake3-'));
  try {
    const root = path.join(dir, 'ws', '.sessions', 'claude', 'hrms-tester'); fs.mkdirSync(root, { recursive: true }); fs.writeFileSync(path.join(root, '.agl-session.json'), JSON.stringify({ agent: 'claude', name: 'hrms-tester' }));
    const home = path.join(dir, 'home'); const jobs = path.join(home, '.claude', 'jobs');
    fs.mkdirSync(path.join(jobs, 'old'), { recursive: true }); fs.writeFileSync(path.join(jobs, 'old', 'state.json'), JSON.stringify({ cwd: root, sessionId: 'old-seat', respawnFlags: ['--name', 'hrms-tester'] }));
    fs.mkdirSync(path.join(jobs, 'seat'), { recursive: true }); fs.writeFileSync(path.join(jobs, 'seat', 'state.json'), JSON.stringify({ cwd: root, sessionId: 'seat-1', respawnFlags: ['--name', 'hrms-tester', '--dangerously-skip-permissions'] }));
    fs.mkdirSync(path.join(jobs, 'other'), { recursive: true }); fs.writeFileSync(path.join(jobs, 'other', 'state.json'), JSON.stringify({ cwd: root + '-x', sessionId: 'not-me' }));
    const t = Date.now() / 1000; fs.utimesSync(path.join(jobs, 'old', 'state.json'), t - 100, t - 100);
    assert.equal(waker.seatJob(root, home).sessionId, 'seat-1', 'newest job in this exact folder');
    assert.deepEqual(waker.resumeArgs({ root, sessionId: 'seat-1', prompt: 'p', home }), ['--bg', '--resume', 'seat-1', 'p'], 'no flags: saved options keep name and mode');
    assert.deepEqual(waker.resumeArgs({ root, sessionId: 'convo-only', prompt: 'p', home }).slice(-2), ['--name', 'hrms-tester'], 'a conversation without a job gets the seat name');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('Copilot wake resumes the bound conversation, respects hold/running/withdrawal and marks only delivered messages read',async()=>{
 const waker=require('../scripts/waker.cjs'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'agl-copilot-wake-'));try{
 const store=path.join(dir,'store'),root=path.join(dir,'seat'),lead='claude/wake-lead',seat='copilot/wake-seat';fs.mkdirSync(path.join(root,'.agl'),{recursive:true});const sid='12345678-1234-1234-1234-123456789abc';const sessions=[{agent:'copilot',name:'wake-seat',sessionRoot:root,conversations:[{provider:'copilot',sessionId:sid}]}];comms.request(store,lead,seat,'wake test');comms.decide(store,lead,seat,'allowed');comms.send(store,lead,seat,'Isolated message');
 let started=0;const adapter={running:async()=>[],start:async values=>{started++;assert.equal(values.sessionId,sid);assert.equal(values.messages[0].text,'Isolated message');comms.send(store,lead,seat,'New message during processing',new Date(Date.now()+1000));values.onDelivered();return{ok:true,delivered:true};}};const run=(extra={})=>waker.tick({sessions,dir:store,providers:{copilot:adapter},...extra});
 fs.writeFileSync(path.join(root,'.agl','.hold'),'held');assert.deepEqual(await run(),[]);fs.unlinkSync(path.join(root,'.agl','.hold'));
 adapter.running=async()=>[root];assert.deepEqual(await run(),[]);adapter.running=async()=>[];
 const result=await run();assert.equal(result[0].delivered,true);assert.equal(started,1);assert.deepEqual(comms.unread(store,seat).map(m=>m.text),['New message during processing']);
 assert.deepEqual(await run(),[],'cooldown prevents another wake');comms.decide(store,lead,seat,'withdrawn');assert.deepEqual(await run({now:Date.now()+waker.COOLDOWN_MS*10}),[]);assert.equal(started,1);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('Concurrent portals cannot double-wake Copilot; thrown failures are logged and backed off',async()=>{
 const waker=require('../scripts/waker.cjs'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'agl-copilot-wake-race-'));try{
 const store=path.join(dir,'store'),root=path.join(dir,'seat'),lead='claude/race-lead',seat='copilot/race-seat';fs.mkdirSync(root);comms.request(store,lead,seat,'race test');comms.decide(store,lead,seat,'allowed');comms.send(store,lead,seat,'Message');let release,entered;const gate=new Promise(r=>release=r),started=new Promise(r=>entered=r);let count=0;const sessions=[{agent:'copilot',name:'race-seat',sessionRoot:root,conversations:[{provider:'copilot',sessionId:'same-id'}]}];const providers={copilot:{running:async()=>[],start:async()=>{count++;entered();await gate;throw Error('Native login required');}}};
 const run=()=>waker.tick({sessions,dir:store,providers});const first=run();await started;assert.deepEqual(await run(),[]);release();assert.equal((await first)[0].ok,false);assert.equal(count,1);assert.deepEqual(await run(),[]);assert.equal(waker.wakes(store,seat).length,1);assert.deepEqual(fs.readdirSync(path.join(store,'wake-locks')),[]);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('Copilot wake rechecks contact permissions after an asynchronous activity check and never invents a conversation',async()=>{
 const waker=require('../scripts/waker.cjs'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'agl-copilot-wake-permission-'));try{
 const store=path.join(dir,'store'),root=path.join(dir,'seat'),lead='claude/check-lead',seat='copilot/check-seat';fs.mkdirSync(root);comms.request(store,lead,seat,'permission test');comms.decide(store,lead,seat,'allowed');comms.send(store,lead,seat,'Message');const sessions=[{agent:'copilot',name:'check-seat',sessionRoot:root,conversations:[{provider:'copilot',sessionId:'same-id'}]}];let count=0;const providers={copilot:{running:async()=>{comms.decide(store,lead,seat,'withdrawn');return[];},start:async()=>{count++;return{ok:true};}}};assert.deepEqual(await waker.tick({sessions,dir:store,providers}),[]);assert.equal(count,0);comms.decide(store,lead,seat,'allowed');sessions[0].conversations=[];providers.copilot.running=async()=>[];assert.deepEqual(await waker.tick({sessions,dir:store,providers}),[]);assert.equal(count,0);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
