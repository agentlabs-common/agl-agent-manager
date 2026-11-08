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
