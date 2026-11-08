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
  await fs.writeFile(path.join(root, '.agl', '.skill-version'), '0.8.0\n'); assert.equal(check(root, home), '', 'acknowledged: silent');
  assert.equal(check(home, home), '', 'not an AGL session: silent');
  assert.equal(newer('0.10.0', '0.9.9'), true); assert.equal(newer('0.8.0', '0.8.0'), false);
}));

test('migrateStatus keeps the index card and turns sections into a work item and a needs-you note', () => {
  const out = migrateStatus('---\nstate: needs-you\nheadline: Pick "A"\nupdated: 2026-11-07 21:00\n---\n## Needs you\n1. **A or B?** My pick: A.\n\n## Now\nBuilding the thing.\n\n## Progress (1/2)\n1. Repos cloned (done)\n2. Release\n\n## Done recently\n- Baseline green (evidence: 41/41)\n');
  assert.match(out, /^root = Status\("needs-you", "Pick \\"A\\"", "2026-11-07 21:00", \[n1\], \[w1\], \[\], \[\]\)/);
  assert.match(out, /m1 = Milestone\("Repos cloned", "done"\)/); assert.match(out, /m2 = Milestone\("Release", "todo"\)/);
  assert.match(out, /d1 = Delivery\("", "Baseline green", "41\/41"\)/); assert.match(out, /n1 = Callout\("needs-you"/);
});
