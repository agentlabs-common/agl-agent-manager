// Status keeper checks: what an agent's pages get wrong against the status guide. Pure reads, no writes.
// Used by the portal (marks for the user) and by the update hook (a reminder at the agent's next prompt).
const fs = require('node:fs'); const path = require('node:path'); const crypto = require('node:crypto');
const read = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return undefined; } };
const mtime = (f) => { try { return fs.statSync(f).mtimeMs; } catch { return undefined; } };
const STATES = ['needs-you', 'blocked', 'working', 'done', 'idle'];
const PINNED = ['responsibility', 'questions'];
const STALE_MIN = 120; const GUESS_MIN = 60; const ANSWER_MIN = 15;

function statusOf(agl) {
  for (const [file, format] of [['STATUS.openui', 'openui'], ['STATUS.html', 'html'], ['STATUS.md', 'md']]) {
    const text = read(path.join(agl, file)); if (text === undefined) continue;
    const at = mtime(path.join(agl, file));
    if (format === 'openui') {
      const m = text.match(/^\s*root\s*=\s*Status\(\s*"((?:[^"\\]|\\.)*)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*,\s*\[([^\]]*)\]/m);
      return { format, at, state: m && m[1], headline: m && m[2], updated: m && m[3], open: m ? m[4].split(',').map((x) => x.trim()).filter(Boolean).length : 0 };
    }
    if (format === 'html') { const meta = (n) => (text.match(new RegExp('<meta\\s+name=["\']' + n + '["\']\\s+content=["\']([^"\']*)', 'i')) || [])[1]; return { format, at, state: meta('agl:state'), headline: meta('agl:headline'), updated: meta('agl:updated'), open: (text.match(/class="agl-decision"/g) || []).length }; }
    const f = {}; for (const l of ((text.match(/^---\n([\s\S]*?)\n---/) || [])[1] || '').split('\n')) { const k = l.match(/^(\w+):\s*(.*)$/); if (k) f[k[1]] = k[2].trim(); }
    const needs = (text.match(/## Needs you\n([\s\S]*?)(?=\n## |$)/) || [])[1] || '';
    return { format, at, state: f.state, headline: f.headline, updated: f.updated, open: (needs.match(/^\d+\./gm) || []).length };
  }
  return null;
}

function check(sessionRoot, now = Date.now()) {
  const agl = path.join(sessionRoot, '.agl'); const out = []; const add = (code, text) => out.push({ code, text });
  const st = statusOf(agl);
  if (!st) { add('no-status', 'No status page yet: write .agl/STATUS.openui.'); return out; }
  if (st.format === 'md') add('old-format', 'Status page is still Markdown: migrate it to STATUS.openui.');
  if (!STATES.includes(st.state)) add('bad-state', `State "${st.state || ''}" is not one of ${STATES.join(', ')}.`);
  if ((st.headline || '').length > 80) add('long-headline', `Headline is ${st.headline.length} characters; keep it to 80.`);
  const age = (now - st.at) / 60000;
  if (st.state === 'working' && age > STALE_MIN) add('stale-working', `Says "working" but the status page hasn't changed for ${Math.round(age / 60)} h: update it, or set idle.`);
  const t = Date.parse(String(st.updated || '').replace(' ', 'T'));
  if (!Number.isNaN(t)) {
    if (t - now > 10 * 60000) add('future-time', `"updated" (${st.updated}) is in the future: take times from the clock.`);
    else if (Math.abs(t - st.at) / 60000 > GUESS_MIN) add('guessed-time', `"updated" (${st.updated}) is far from when the file was written: take times from the clock.`);
  }
  if (st.state === 'needs-you' && st.open === 0) add('needs-without-question', 'State is needs-you but no question is open.');
  if (st.open > 0 && st.state !== 'needs-you') add('question-hidden', `${st.open} open question${st.open > 1 ? 's' : ''} while the state is ${st.state}: set needs-you so they show.`);
  if (st.open > 3) add('too-many-questions', `${st.open} open questions; keep at most 3.`);
  let reviews = []; try { reviews = (JSON.parse(read(path.join(agl, 'reviews.json')) || '{}').items) || []; } catch {}
  const waiting = reviews.filter((r) => r.status === 'submitted' && (now - Date.parse(r.submittedAt)) / 60000 > ANSWER_MIN);
  if (waiting.length) add('answers-waiting', `${waiting.length} answer${waiting.length > 1 ? 's' : ''} from the user not handled yet (oldest ${Math.round((now - Math.min(...waiting.map((r) => Date.parse(r.submittedAt)))) / 60000)} min).`);
  const pages = (() => { try { return fs.readdirSync(path.join(agl, 'pages')); } catch { return []; } })();
  // What the user approved does not move: the latest approval of each page must match the page as it stands.
  const latest = {}; for (const r of reviews) if (r.kind === 'yes' && r.hash) latest[r.page] = r;
  for (const [page, r] of Object.entries(latest)) { const ext = ['openui', 'html', 'md'].find((e) => pages.includes(page + '.' + e)); if (!ext) continue; const now_ = crypto.createHash('sha256').update(read(path.join(agl, 'pages', page + '.' + ext)) || '').digest('hex').slice(0, 16); if (now_ !== r.hash) add('approved-changed', `Page "${page}" changed after the user approved it: state what changed, as a new version, and ask again.`); }
  if (!pages.some((f) => /^responsibility\.(openui|html|md)$/.test(f))) add('no-responsibility', 'No Responsibility page: write .agl/pages/responsibility.openui, or ask the user what you are responsible for.');
  // A page's newest format wins: an .md left beside its .openui or .html is a leftover, not a page of its own.
  const has = (slug, ext) => pages.includes(slug + '.' + ext);
  const untagged = pages.filter((f) => { const m = f.match(/^([a-z0-9][a-z0-9-]*)\.(openui|html|md)$/); if (!m || PINNED.includes(m[1])) return false; if (m[2] === 'md' && (has(m[1], 'openui') || has(m[1], 'html'))) return false; if (m[2] === 'html' && has(m[1], 'openui')) return false; const text = read(path.join(agl, 'pages', f)) || '';
    return m[2] === 'openui' ? /^\s*root\s*=\s*Page\(\s*"(?:[^"\\]|\\.)*"\s*,\s*"(?:[^"\\]|\\.)*"\s*,\s*"(?:[^"\\]|\\.)*"\s*,\s*""/m.test(text) : m[2] === 'html' ? !/name=["']agl:work["']/.test(text) : !/^work:/m.test(text.split('\n').slice(0, 8).join('\n')); });
  if (untagged.length) add('page-without-work', `Pages without a work item: ${untagged.join(', ')}.`);
  return out;
}

// Why agents went custom: each reason is a feature request for the next plugin version.
function customReasons(sessionRoot) {
  const dir = path.join(sessionRoot, '.agl', 'pages'); const out = [];
  const files = (() => { try { return fs.readdirSync(dir); } catch { return []; } })().map((f) => path.join(dir, f)); files.push(path.join(sessionRoot, '.agl', 'STATUS.openui'), path.join(sessionRoot, '.agl', 'STATUS.html'));
  for (const f of files) { const t = read(f); if (t === undefined) continue; const page = path.basename(f).replace(/\.\w+$/, '');
    if (f.endsWith('.openui')) for (const m of t.matchAll(/=\s*Custom\(\s*"(?:[^"\\]|\\.)*"\s*,\s*"((?:[^"\\]|\\.)*)"/g)) out.push({ page, reason: m[1].replace(/\\(.)/g, '$1') });
    if (f.endsWith('.html')) { const m = t.match(/<meta\s+name=["']agl:custom["']\s+content=["']([^"']*)/i); if (m) out.push({ page, reason: m[1] }); } }
  return out;
}

module.exports = { check, statusOf, customReasons };
