#!/usr/bin/env node
// How agents talk to each other through the agent portal.
//   agl-talk contacts                 who you may talk to
//   agl-talk request <agent> "why"    ask the user for a new contact
//   agl-talk send <agent> "text"      message an allowed contact
//   agl-talk inbox [--wait] [--read]  new messages; --wait blocks until one arrives; --read marks them read
//   agl-talk thread <agent>           the whole conversation
// Agents are named agent/session, for example claude/hrms-lead. Run it from inside your session folder.
const fs = require('node:fs'); const path = require('node:path');
const comms = require('./comms.cjs');

function whoAmI(cwd) {
  for (let dir = path.resolve(cwd), i = 0; i < 8; i++, dir = path.dirname(dir)) {
    try { const s = JSON.parse(fs.readFileSync(path.join(dir, '.agl-session.json'), 'utf8')); if (s.agent && s.name) return s.agent + '/' + s.name; if (s.agent && s.folder) return s.agent + '/' + s.folder; } catch {}
    if (path.dirname(dir) === dir) break;
  }
  throw new Error('Run this from inside an AGL session folder.');
}
const show = (m) => `[${m.at}] ${m.from} to ${m.to}:\n${m.text}`;
function sleep(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

function main(argv, { cwd = process.cwd(), dir = process.env.AGL_COMMS_DIR || comms.defaultDir(), out = console.log } = {}) {
  const [cmd, ...rest] = argv; const me = whoAmI(cwd);
  if (cmd === 'contacts') { const list = comms.contactsOf(dir, me); out(list.length ? list.map((c) => `${c.with}  ${c.status}${c.reason ? '  (' + c.reason + ')' : ''}`).join('\n') : 'No contacts yet. Ask for one: agl-talk request <agent> "why".'); return 0; }
  if (cmd === 'request') { const r = comms.request(dir, me, rest[0], rest[1]); out(r.unchanged ? `Already ${r.status}; the user decides.` : `Requested. The user will permit or deny ${rest[0]} on the agent portal.`); return 0; }
  if (cmd === 'send') { comms.send(dir, me, rest[0], rest[1]); out('Sent.'); return 0; }
  if (cmd === 'thread') { if (!comms.isAllowed(dir, me, rest[0]) && !comms.readThread(dir, me, rest[0]).length) throw new Error('No conversation with ' + rest[0] + '.'); out(comms.readThread(dir, me, rest[0]).map(show).join('\n\n') || 'No messages yet.'); return 0; }
  if (cmd === 'inbox') {
    const wait = rest.includes('--wait'), mark = rest.includes('--read');
    let msgs = comms.unread(dir, me);
    while (wait && !msgs.length) { comms.heartbeat(dir, me); sleep(5000); msgs = comms.unread(dir, me); }
    comms.heartbeat(dir, me);
    out(msgs.length ? msgs.map(show).join('\n\n') : 'No new messages.');
    if (mark && msgs.length) comms.markRead(dir, me, msgs);
    return 0;
  }
  out('Usage: agl-talk contacts | request <agent> "why" | send <agent> "text" | inbox [--wait] [--read] | thread <agent>');
  return cmd ? 2 : 0;
}

if (require.main === module) { try { process.exitCode = main(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exitCode = 1; } }
module.exports = { main, whoAmI };
