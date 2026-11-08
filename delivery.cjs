// Delivery on every activation (so on every plugin update): install the plugin's skills as whole folders stamped
// with the plugin version, put the agent tools at a stable path, register the skill-update hook once, and write the
// version file agents read to learn what the agent portal can show.
const fs = require('node:fs/promises'); const path = require('node:path');

const MARK = 'Installed by AGL Agent Manager';
const TOOLS = ['agl-migrate.cjs', 'agl-skill-check.cjs', 'keeper.cjs', 'comms.cjs', 'agl-talk.cjs'];
// waker.cjs runs only inside the extension.
// What each release asks agents to change in their own pages; the hook lists the files.
const MIGRATIONS = [{ since: '0.8.0', change: 'Pages and the status page move to OpenUI: STATUS.md to STATUS.openui, pages/*.md to pages/*.openui', tool: 'agl-migrate.cjs' },
  { since: '0.9.0', change: 'No page changes needed. New: name your lead (eighth Status argument), Pull and TeamStrip for leads, Custom blocks with Chart.js, containers listed live' },
  { since: '0.10.0', change: 'Agents talk through the portal with agl-talk: ask for contacts, stay listening. No page changes needed' }];
const FORMATS = ['openui', 'html', 'md'];

async function read(file) { try { return await fs.readFile(file, 'utf8'); } catch (e) { if (e.code === 'ENOENT') return undefined; throw e; } }
async function writeAtomic(file, text) { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file + '.tmp', text); await fs.rename(file + '.tmp', file); }

// Copy one skill folder; SKILL.md's marker line carries the version. Never replaces a skill the user wrote.
async function installSkillFolder(source, dest, version) {
  const current = await read(path.join(dest, 'SKILL.md'));
  if (current !== undefined && !current.includes(MARK)) return false;
  const files = await fs.readdir(source, { recursive: true, withFileTypes: true });
  let changed = false;
  for (const entry of files) {
    if (!entry.isFile()) continue;
    const from = path.join(entry.parentPath || entry.path, entry.name); const rel = path.relative(source, from); const to = path.join(dest, rel);
    let text = await fs.readFile(from, 'utf8');
    if (rel === 'SKILL.md') text = text.replace(/<!-- Installed by AGL Agent Manager[^>]*-->/, `<!-- ${MARK} ${version}. Edits are overwritten on update. -->`);
    if ((await read(to)) === text) continue;
    await writeAtomic(to, text); changed = true;
  }
  return changed;
}

// Register the hook once in ~/.claude/settings.json (approved by the user as Q11 A); keeps every other setting.
async function registerHook(home, command) {
  const file = path.join(home, '.claude', 'settings.json'); const text = await read(file);
  let settings = {}; if (text !== undefined) { try { settings = JSON.parse(text); } catch { return 'settings.json is not valid JSON; hook not added'; } }
  const groups = (((settings.hooks ||= {}).UserPromptSubmit) ||= []);
  if (JSON.stringify(groups).includes('agl-skill-check.cjs')) return 'present';
  groups.push({ hooks: [{ type: 'command', command }] });
  if (text !== undefined) await fs.writeFile(file + '.agl-backup', text);
  await writeAtomic(file, JSON.stringify(settings, null, 2) + '\n');
  return 'added';
}

async function deliver({ home, extensionPath, version, portalUrl = '', workspaceRoot = '' }) {
  const tools = path.join(home, '.config', 'agentlabs', 'agl');
  const skillsDir = path.join(extensionPath, 'skills'); const skills = {};
  for (const name of await fs.readdir(skillsDir).catch(() => [])) {
    for (const parent of [path.join(home, '.claude', 'skills'), path.join(home, '.agents', 'skills')]) await installSkillFolder(path.join(skillsDir, name), path.join(parent, name), version);
    skills[name] = version;
  }
  for (const tool of TOOLS) { const from = path.join(extensionPath, 'scripts', tool); const text = await read(from); if (text !== undefined && (await read(path.join(tools, tool))) !== text) await writeAtomic(path.join(tools, tool), text); }
  const hook = await registerHook(home, 'node ' + path.join(tools, 'agl-skill-check.cjs'));
  // One portal per VS Code window: agents find theirs under the workspace that holds their session folder.
  let portals = {}; try { portals = JSON.parse(await read(path.join(tools, 'agent-portal.json')) || '{}').portals || {}; } catch {}
  if (workspaceRoot && portalUrl) portals[workspaceRoot] = portalUrl;
  const info = { app: 'agent-portal', version, portalUrl, portals, formats: FORMATS, skills, tools: { migrate: path.join(tools, 'agl-migrate.cjs') }, migrations: MIGRATIONS, updated: new Date().toISOString() };
  await writeAtomic(path.join(tools, 'agent-portal.json'), JSON.stringify(info, null, 2) + '\n');
  return { hook, info };
}

module.exports = { deliver, installSkillFolder, registerHook, MIGRATIONS };
