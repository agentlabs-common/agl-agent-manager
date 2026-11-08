// Turn an agent's Markdown page into an OpenUI page for the agent portal.
// Usage: node scripts/agl-migrate.cjs <page.md> [--write]
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

if (require.main === module) {
  const [file, flag] = process.argv.slice(2);
  if (!file || !file.endsWith('.md')) { console.error('Usage: node scripts/agl-migrate.cjs <page.md> [--write]'); process.exit(2); }
  const program = migrate(fs.readFileSync(file, 'utf8'), path.basename(file, '.md'));
  if (flag === '--write') { const dest = file.replace(/\.md$/, '.openui'); fs.writeFileSync(dest + '.tmp', program); fs.renameSync(dest + '.tmp', dest); console.log('Wrote ' + dest); }
  else process.stdout.write(program);
}
module.exports = { migrate };
