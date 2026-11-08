// Turn an agent's Markdown page into an OpenUI page for the agent portal.
// Usage: node scripts/agl-migrate.cjs <page.md | STATUS.md> [--write]
//   Prints the OpenUI program; with --write, writes <page>.openui beside it and leaves the .md for the agent to
//   check and remove. Handles: # title / summary: / updated: / work: header, ## and ### headings, paragraphs,
//   - and 1. lists, | tables |, ``` code ```, > quotes, and inline <svg> diagrams.
const fs = require('node:fs'); const path = require('node:path');

const KINDS = ['proposal', 'design', 'guide', 'review', 'mockup', 'results', 'plan', 'investigation', 'responsibility', 'questions'];
const q = (v) => JSON.stringify(String(v ?? ''));

function migrate(text, slug = 'page') {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  const head = { title: slug, summary: '', updated: '', work: '' };
  let i = 0;
  for (; i < Math.min(lines.length, 8); i++) {
    const l = lines[i]; let m;
    if ((m = l.match(/^# (.+)/)) && head.title === slug) head.title = m[1].trim();
    else if ((m = l.match(/^(summary|updated|work):\s*(.*)$/))) head[m[1]] = m[2].trim();
    else if (l.trim() && !/^#/.test(l)) break;
  }
  const kind = KINDS.find((k) => slug === k || slug.startsWith(k + '-')) || 'page';
  const out = []; let n = 0; const id = (p) => p + (++n);
  const emit = (name, call) => { out.push(`${name} = ${call}`); return name; };
  const root = []; let section = null, sub = null;
  const target = () => (sub ? sub.blocks : section ? section.blocks : root);
  let para = [];
  const flush = () => { if (para.length) { target().push(emit(id('t'), `Text(${q(para.join('\n'))})`)); para = []; } };
  const closeSub = () => { flush(); if (sub) { section.blocks.push(emit(sub.name, `Section(${q(sub.heading)}, [${sub.blocks.join(', ')}], 3)`)); sub = null; } };
  const closeSection = () => { closeSub(); if (section) { root.push(emit(section.name, `Section(${q(section.heading)}, [${section.blocks.join(', ')}])`)); section = null; } };
  for (; i < lines.length; i++) {
    const l = lines[i]; let m;
    if ((m = l.match(/^## (.+)/))) { closeSection(); section = { name: id('s'), heading: m[1].trim(), blocks: [] }; continue; }
    if ((m = l.match(/^#{3,} (.+)/))) { closeSub(); if (!section) section = { name: id('s'), heading: head.title, blocks: [] }; sub = { name: id('s'), heading: m[1].trim(), blocks: [] }; continue; }
    if (/^```/.test(l)) { flush(); const body = []; for (i++; i < lines.length && !/^```/.test(lines[i]); i++) body.push(lines[i]); target().push(emit(id('c'), `Code(${q(body.join('\n'))})`)); continue; }
    if (/^\s*<svg[\s>]/i.test(l)) { flush(); const body = [l]; while (!/<\/svg>/i.test(body[body.length - 1]) && i + 1 < lines.length) body.push(lines[++i]); target().push(emit(id('f'), `Figure(${q(body.join('\n'))}, "")`)); continue; }
    if (/^\|/.test(l)) { flush(); const rows = []; for (; i < lines.length && /^\|/.test(lines[i]); i++) rows.push(lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())); i--;
      const [cols, ...rest] = rows; const body = rest.filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c)));
      target().push(emit(id('tb'), `Table([${cols.map(q).join(', ')}], [${body.map((r) => '[' + r.map(q).join(', ') + ']').join(', ')}])`)); continue; }
    if ((m = l.match(/^(\s*)([-*]|\d+\.)\s+(.*)/))) { flush(); const ordered = /\d/.test(m[2]); const items = [];
      for (; i < lines.length; i++) { const k = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.*)/); if (k) { items.push((k[1].length >= 2 ? '– ' : '') + k[3]); continue; }
        if (/^\s{2,}\S/.test(lines[i]) && items.length) { items[items.length - 1] += ' ' + lines[i].trim(); continue; } break; }
      i--; target().push(emit(id('l'), `Bullets([${items.map(q).join(', ')}]${ordered ? ', true' : ''})`)); continue; }
    if ((m = l.match(/^>\s?(.*)/))) { flush(); const body = [m[1]]; while (i + 1 < lines.length && /^>/.test(lines[i + 1])) body.push(lines[++i].replace(/^>\s?/, '')); target().push(emit(id('k'), `Callout("idle", ${q(body.join('\n'))})`)); continue; }
    if (!l.trim()) { flush(); continue; }
    para.push(l);
  }
  closeSection(); flush();
  return [`root = Page(${q(head.title)}, ${q(head.summary)}, ${q(kind)}, ${q(head.work)}, ${q(head.updated)}, [${root.join(', ')}])`, ...out].join('\n') + '\n';
}

// STATUS.md (front matter + sections) to STATUS.openui. Needs-you text becomes a callout for the agent to rewrite as
// Questions; Now, Progress and Done recently become one work item; the agent then splits it by real work items.
const STATES = ['needs-you', 'blocked', 'working', 'done', 'idle'];
function migrateStatus(text, now = new Date()) {
  const t = String(text).replace(/\r\n?/g, '\n'); const fm = t.match(/^---\n([\s\S]*?)\n---\n?/); const f = {};
  for (const l of (fm ? fm[1] : '').split('\n')) { const m = l.match(/^(\w+):\s*(.*)$/); if (m) f[m[1]] = m[2].trim(); }
  const body = fm ? t.slice(fm[0].length) : t; const sec = {}; let cur = null;
  for (const l of body.split('\n')) { const m = l.match(/^## (.+?)(?:\s*\(.*\))?\s*$/); if (m) { cur = m[1].trim().toLowerCase(); sec[cur] = []; } else if (cur) sec[cur].push(l); }
  const lines = (k) => (sec[k] || []).join('\n').trim();
  const items = (k) => (sec[k] || []).filter((l) => /^\s*([-*]|\d+\.)\s+/.test(l)).map((l) => l.replace(/^\s*([-*]|\d+\.)\s+/, '').trim());
  const state = STATES.includes(f.state) ? f.state : 'idle';
  const pad = (n) => String(n).padStart(2, '0'); const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const out = []; const needs = [];
  if (lines('needs you')) { out.push(`n1 = Callout("needs-you", ${q(lines('needs you') + '\n\nMigrated from STATUS.md: rewrite each item as a Question with options, a pick and what happens if nobody answers.')})`); needs.push('n1'); }
  const ms = items('progress').map((x, i) => { const done = /^\[x\]|\(done\)|— done|: done/i.test(x); const label = x.replace(/^\[[ x]\]\s*/i, '').replace(/\s*\(done[^)]*\)\s*$/i, ''); out.push(`m${i + 1} = Milestone(${q(label)}, ${q(done ? 'done' : 'todo')})`); return 'm' + (i + 1); });
  const ds = items('done recently').map((x, i) => { const ev = (x.match(/\(evidence:\s*([^)]*)\)/) || [])[1] || ''; out.push(`d${i + 1} = Delivery("", ${q(x.replace(/\s*\(evidence:[^)]*\)/, ''))}, ${q(ev || 'see the old status page')})`); return 'd' + (i + 1); });
  const goal = lines('now') || f.headline || '';
  out.unshift(`w1 = WorkItem("Current work", ${q(state === 'needs-you' ? 'working' : state)}, ${q(goal.replace(/\n+/g, ' '))}, [${ms.join(', ')}], [${ds.join(', ')}], "Split this into one work item per piece of work you were given.")`);
  const blocked = lines('blocked'); if (blocked) out.push(`k1 = Callout("blocked", ${q(blocked)})`);
  return [`root = Status(${q(state)}, ${q(f.headline || '')}, ${q(f.updated || stamp)}, [${needs.join(', ')}], [w1], [], [])`, ...out].join('\n') + '\n';
}

if (require.main === module) {
  const [file, flag] = process.argv.slice(2);
  if (!file || !file.endsWith('.md')) { console.error('Usage: node scripts/agl-migrate.cjs <page.md> [--write]'); process.exit(2); }
  const program = path.basename(file) === 'STATUS.md' ? migrateStatus(fs.readFileSync(file, 'utf8')) : migrate(fs.readFileSync(file, 'utf8'), path.basename(file, '.md'));
  if (flag === '--write') { const dest = file.replace(/\.md$/, '.openui'); fs.writeFileSync(dest + '.tmp', program); fs.renameSync(dest + '.tmp', dest); console.log('Wrote ' + dest); }
  else process.stdout.write(program);
}
module.exports = { migrate, migrateStatus };
