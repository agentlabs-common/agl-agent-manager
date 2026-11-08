const { test } = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs/promises'); const path = require('node:path'); const os = require('node:os');
const { deliver } = require('../delivery.cjs'); const { check, newer } = require('../scripts/agl-skill-check.cjs'); const { migrateStatus } = require('../scripts/agl-migrate.cjs');

async function tmp(fn) { const base = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'agl-deliver-'))); try { await fn(base); } finally { await fs.rm(base, { recursive: true, force: true }); } }

test('delivery installs versioned skill folders, tools, the hook once, and the version file', async () => tmp(async (home) => {
  const ext = path.join(__dirname, '..');
  await fs.mkdir(path.join(home, '.claude'), { recursive: true });
  await fs.writeFile(path.join(home, '.claude', 'settings.json'), JSON.stringify({ theme: 'dark', hooks: { Stop: [{ hooks: [{ type: 'command', command: 'x' }] }] } }));
  const first = await deliver({ home, extensionPath: ext, version: '0.8.0', portalUrl: 'http://127.0.0.1:1/t/' });
  assert.equal(first.hook, 'added');
  const skill = await fs.readFile(path.join(home, '.claude', 'skills', 'agl-notes', 'SKILL.md'), 'utf8');
  assert.match(skill, /Installed by AGL Agent Manager 0\.8\.0\./); assert.ok(await fs.stat(path.join(home, '.agents', 'skills', 'agl-notes', 'SKILL.md')));
  const settings = JSON.parse(await fs.readFile(path.join(home, '.claude', 'settings.json'), 'utf8'));
  assert.equal(settings.theme, 'dark'); assert.equal(settings.hooks.Stop.length, 1, 'other hooks kept');
  assert.match(settings.hooks.UserPromptSubmit[0].hooks[0].command, /agl-skill-check\.cjs$/);
  assert.equal((await deliver({ home, extensionPath: ext, version: '0.8.0' })).hook, 'present', 'registered only once');
  const info = JSON.parse(await fs.readFile(path.join(home, '.config', 'agentlabs', 'agl', 'agent-portal.json'), 'utf8'));
  assert.equal(info.version, '0.8.0'); assert.equal(info.skills['agl-notes'], '0.8.0'); assert.deepEqual(info.formats, ['openui', 'html', 'md']);
  assert.ok(await fs.stat(info.tools.migrate));
  // A skill the user wrote is never replaced.
  const mine = path.join(home, '.claude', 'skills', 'agl-notes', 'SKILL.md'); await fs.writeFile(mine, '---\nname: agl-notes\n---\nmine');
  await deliver({ home, extensionPath: ext, version: '0.8.1' }); assert.equal(await fs.readFile(mine, 'utf8'), '---\nname: agl-notes\n---\nmine');
}));

test('the hook tells an AGL session once its skill is behind, lists files to migrate, and is silent otherwise', async () => tmp(async (home) => {
  const root = path.join(home, 'ws', '.sessions', 'claude', 'seat'); await fs.mkdir(path.join(root, '.agl', 'pages'), { recursive: true });
  await fs.writeFile(path.join(root, '.agl-session.json'), '{}'); await fs.writeFile(path.join(root, '.agl', 'STATUS.md'), '---\nstate: idle\n---\n');
  await fs.writeFile(path.join(root, '.agl', 'pages', 'design-a.md'), '# A'); await fs.writeFile(path.join(root, '.agl', 'pages', 'done-b.md'), '# B'); await fs.writeFile(path.join(root, '.agl', 'pages', 'done-b.openui'), 'root = Page()');
  assert.equal(check(path.join(root, 'repo'), home), '', 'no version file: silent');
  await deliver({ home, extensionPath: path.join(__dirname, '..'), version: '0.8.0' });
  const note = check(path.join(root, 'repo', 'src'), home);
  assert.match(note, /acknowledged none, installed 0\.8\.0/); assert.match(note, /\.agl\/STATUS\.md/); assert.match(note, /design-a\.md/); assert.doesNotMatch(note, /done-b\.md/);
  await fs.writeFile(path.join(root, '.agl', '.skill-version'), '0.8.0\n'); const after = check(root, home);
  assert.doesNotMatch(after, /skill was updated/, 'acknowledged: no skill note'); assert.match(after, /status keeper[\s\S]*No Responsibility page/, 'keeper reminders still come');
  assert.equal(check(home, home), '', 'not an AGL session: silent');
  assert.equal(newer('0.10.0', '0.9.9'), true); assert.equal(newer('0.8.0', '0.8.0'), false);
}));

test('migrateStatus keeps the index card and turns sections into a work item and a needs-you note', () => {
  const out = migrateStatus('---\nstate: needs-you\nheadline: Pick "A"\nupdated: 2026-11-07 21:00\n---\n## Needs you\n1. **A or B?** My pick: A.\n\n## Now\nBuilding the thing.\n\n## Progress (1/2)\n1. Repos cloned (done)\n2. Release\n\n## Done recently\n- Baseline green (evidence: 41/41)\n');
  assert.match(out, /^root = Status\("needs-you", "Pick \\"A\\"", "2026-11-07 21:00", \[n1\], \[w1\], \[\], \[\]\)/);
  assert.match(out, /m1 = Milestone\("Repos cloned", "done"\)/); assert.match(out, /m2 = Milestone\("Release", "todo"\)/);
  assert.match(out, /d1 = Delivery\("", "Baseline green", "41\/41"\)/); assert.match(out, /n1 = Callout\("needs-you"/);
});

test('keeper flags stale working, guessed times, hidden questions and missing responsibility; a tidy session passes', async () => tmp(async (base) => {
  const { check } = require('../scripts/keeper.cjs'); const agl = path.join(base, '.agl'); await fs.mkdir(path.join(agl, 'pages'), { recursive: true });
  const file = path.join(agl, 'STATUS.openui');
  await fs.writeFile(file, 'root = Status("working", "x", "2030-01-01 10:00", [q1], [], [], [])\n');
  const old = Date.now() - 3 * 3600e3; await fs.utimes(file, old / 1000, old / 1000);
  const codes = check(base).map((c) => c.code);
  for (const c of ['stale-working', 'future-time', 'question-hidden', 'no-responsibility']) assert.ok(codes.includes(c), c);
  const now = new Date(); const pad = (n) => String(n).padStart(2, '0'); const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  await fs.writeFile(file, `root = Status("idle", "Tidy", "${stamp}", [], [], [], [])\n`);
  await fs.writeFile(path.join(agl, 'pages', 'responsibility.openui'), 'root = Page("Responsibility", "s", "responsibility", "", "x", [])\n');
  await fs.writeFile(path.join(agl, 'pages', 'design-a.openui'), 'root = Page("Design A", "s", "design", "Agent portal", "x", [])\n');
  assert.deepEqual(check(base), []);
}));

test('feature requests come from custom blocks and custom pages; only named libraries load', async () => tmp(async (base) => {
  const { customReasons } = require('../scripts/keeper.cjs'); const { withKit, libText } = require('../kit.cjs');
  const pages = path.join(base, '.agl', 'pages'); await fs.mkdir(pages, { recursive: true });
  await fs.writeFile(path.join(pages, 'design-a.openui'), 'root = Page("A", "s", "design", "W", "x", [c])\nc = Custom("<div></div>", "needs a \\"gantt\\" chart", 240, ["chart"])\n');
  await fs.writeFile(path.join(pages, 'plan-b.html'), '<html><head><meta name="agl:custom" content="needs drag and drop"></head></html>');
  assert.deepEqual(customReasons(base).sort((a, b) => a.page.localeCompare(b.page)), [{ page: 'design-a', reason: 'needs a "gantt" chart' }, { page: 'plan-b', reason: 'needs drag and drop' }]);
  assert.equal(libText('nope'), ''); assert.equal(libText('__proto__'), '');
  assert.ok(withKit('<head><meta name="agl:libs" content="chart, nope"></head>').length > 100000, 'chart library inlined'); assert.ok(withKit('<head></head>').length < 100000, 'no library unless asked');
}));
