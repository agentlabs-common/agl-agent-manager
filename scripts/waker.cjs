// Wakes a stopped agent when an allowed contact has written to it (the user's Q18 answer: automatic, except on hold).
// Checks first that the session really is stopped: resuming a running session forks a duplicate.
const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os'); const { spawn, execFile } = require('node:child_process');
const comms = require('./comms.cjs');
const COOLDOWN_MS = 5 * 60 * 1000;

const logFile = (dir) => path.join(dir, 'wakes.jsonl');
function wakes(dir, id) { try { return fs.readFileSync(logFile(dir), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((w) => !id || w.id === id); } catch { return []; } }
const isHeld = (root) => fs.existsSync(path.join(root, '.agl', '.hold'));
function lastSessionId(root) { try { const c = JSON.parse(fs.readFileSync(path.join(root, '.agl-session.json'), 'utf8')).conversations || []; return [...c].reverse().find((x) => x.provider === 'claude' && x.sessionId)?.sessionId || ''; } catch { return ''; } }

// The folders of every running session, from Claude Code itself.
function runningFolders() { return new Promise((resolve, reject) => { execFile('claude', ['agents', '--json'], { timeout: 15000, maxBuffer: 8 * 1024 * 1024 }, (error, out) => { if (error) return reject(error); try { resolve(JSON.parse(out).map((a) => a.cwd).filter(Boolean)); } catch (e) { reject(e); } }); }); }

// The session keeps its own permission mode: reuse the flags its job last ran with.
function permissionFlags(sessionId, home = os.homedir()) {
  const jobs = path.join(home, '.claude', 'jobs');
  for (const job of (() => { try { return fs.readdirSync(jobs); } catch { return []; } })()) {
    let st; try { st = JSON.parse(fs.readFileSync(path.join(jobs, job, 'state.json'), 'utf8')); } catch { continue; }
    if (!String(st.linkScanPath || '').includes(sessionId)) continue;
    const f = st.respawnFlags || []; const out = [];
    for (let i = 0; i < f.length; i++) { if (f[i] === '--dangerously-skip-permissions') out.push(f[i]); else if (f[i] === '--permission-mode' && f[i + 1]) out.push(f[i], f[++i]); }
    return out;
  }
  return [];
}
function startSession({ root, sessionId, prompt, home }) { spawn('claude', ['--bg', '--resume', sessionId, prompt, ...permissionFlags(sessionId, home)], { cwd: root, detached: true, stdio: 'ignore' }).on('error', () => {}).unref(); }

// One pass. A session is woken only if: Claude, unread from an allowed contact, not on hold, not running, not woken lately.
async function tick({ sessions, dir, running = runningFolders, start = startSession, now = Date.now() }) {
  const due = sessions.filter((s) => s.agent === 'claude' && !isHeld(s.sessionRoot)).map((s) => ({ s, id: s.agent + '/' + s.name })).map((x) => ({ ...x, unread: comms.unread(dir, x.id).filter((m) => comms.isAllowed(dir, x.id, m.from)) })).filter((x) => x.unread.length);
  if (!due.length) return [];
  const folders = await running(); const woken = [];
  for (const { s, id, unread } of due) {
    if (folders.some((f) => f === s.sessionRoot || f.startsWith(s.sessionRoot + path.sep))) continue;
    if (wakes(dir, id).some((w) => now - Date.parse(w.at) < COOLDOWN_MS)) continue;
    const sessionId = lastSessionId(s.sessionRoot); if (!sessionId) continue;
    const from = [...new Set(unread.map((m) => m.from))];
    start({ root: s.sessionRoot, sessionId, prompt: `You have new messages on the agent portal from ${from.join(', ')}. Read them with: node ~/.config/agentlabs/agl/agl-talk.cjs inbox --read` });
    const entry = { id, at: new Date(now).toISOString(), by: from };
    fs.mkdirSync(dir, { recursive: true }); fs.appendFileSync(logFile(dir), JSON.stringify(entry) + '\n'); woken.push(entry);
  }
  return woken;
}

module.exports = { tick, wakes, isHeld, permissionFlags, COOLDOWN_MS };
