#!/usr/bin/env node
// UserPromptSubmit hook, installed by AGL Agent Manager: when the agl-notes skill this session last acknowledged is
// older than the installed one, tell the agent once per prompt to re-read it and which of its files need migrating.
// Silent outside AGL sessions and when up to date. Never blocks the prompt.
const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os');
const read = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return undefined; } };
const newer = (a, b) => { const x = String(a).split('.').map(Number), y = String(b || '0').split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };

function check(cwd, home = os.homedir()) {
  let root; for (let dir = path.resolve(cwd), i = 0; i < 8; i++, dir = path.dirname(dir)) { if (read(path.join(dir, '.agl-session.json')) !== undefined) { root = dir; break; } if (path.dirname(dir) === dir) break; }
  if (!root) return '';
  let info; try { info = JSON.parse(read(path.join(home, '.config', 'agentlabs', 'agl', 'agent-portal.json')) || ''); } catch { return ''; }
  const installed = info.skills && info.skills['agl-notes']; if (!installed) return '';
  const acknowledged = (read(path.join(root, '.agl', '.skill-version')) || '').trim();
  // The status keeper's checks ride along: each agent hears its own page problems at its next prompt.
  let keeper = []; try { keeper = require(path.join(__dirname, 'keeper.cjs')).check(root).filter((c) => c.code !== 'old-format'); } catch {}
  const kept = keeper.length ? ['AGL status keeper, your pages:', ...keeper.map((c) => '- ' + c.text)].join('\n') : '';
  // Unread messages from other agents: the safety net when the background wait wasn't running.
  let inbox = ''; try { const comms = require(path.join(__dirname, 'comms.cjs')); const s = JSON.parse(read(path.join(root, '.agl-session.json'))); const unread = comms.unread(comms.defaultDir(home), s.agent + '/' + (s.name || s.folder)); if (unread.length) inbox = `AGL: ${unread.length} new message${unread.length > 1 ? 's' : ''} from ${[...new Set(unread.map((m) => m.from))].join(', ')}. Read with: node ${path.join(path.dirname(info.tools.migrate), 'agl-talk.cjs')} inbox --read`; } catch {}
  const extras = [inbox, kept].filter(Boolean).join('\n');
  if (!newer(installed, acknowledged)) return extras;
  const agl = path.join(root, '.agl'); const todo = [];
  if (read(path.join(agl, 'STATUS.md')) !== undefined && read(path.join(agl, 'STATUS.openui')) === undefined && read(path.join(agl, 'STATUS.html')) === undefined) todo.push('.agl/STATUS.md');
  for (const f of (() => { try { return fs.readdirSync(path.join(agl, 'pages')); } catch { return []; } })()) { const m = f.match(/^(.+)\.md$/); if (m && !fs.existsSync(path.join(agl, 'pages', m[1] + '.openui')) && !fs.existsSync(path.join(agl, 'pages', m[1] + '.html'))) todo.push('.agl/pages/' + f); }
  const steps = (info.migrations || []).filter((m) => newer(m.since, acknowledged) || m.since === installed).map((m) => '- ' + m.since + ': ' + m.change);
  return ['AGL: the agl-notes skill was updated (this session acknowledged ' + (acknowledged || 'none') + ', installed ' + installed + '). Re-read the agl-notes skill before writing your pages.',
    ...(steps.length ? ['What changed:', ...steps] : []),
    ...(todo.length ? ['Migrate these files with: node ' + info.tools.migrate + ' <file> --write, check each result, then remove the old file (skip pages you made custom on purpose):', ...todo.map((t) => '- ' + t)] : []),
    'When done, write ' + installed + ' to .agl/.skill-version so this note stops.', ...(extras ? [extras] : [])].join('\n');
}

if (require.main === module) {
  let input = ''; process.stdin.on('data', (c) => { input += c; }).on('end', () => {
    let cwd = process.cwd(); try { cwd = JSON.parse(input).cwd || cwd; } catch {}
    let note = ''; try { note = check(cwd); } catch {}
    if (note) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: note } }));
    process.exit(0);
  });
}
module.exports = { check, newer };
