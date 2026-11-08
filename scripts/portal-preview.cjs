// Run this checkout's status portal outside VS Code, to try page changes before a release.
// Usage: node scripts/portal-preview.cjs <workspace-root>... (each holding .sessions/<agent>/<folder>/)
// AGL_PORTAL_PORT and AGL_PORTAL_TOKEN keep the link the same across restarts; the token must be 20+ URL-safe characters.
const fs=require('node:fs/promises');const path=require('node:path');const{createPortal}=require('../portal.cjs');
const roots=process.argv.slice(2);if(!roots.length){console.error('Give one or more workspace roots.');process.exit(2);}
async function listSessions(){const rows=[];for(const root of roots){const base=path.join(root,'.sessions');for(const agent of await fs.readdir(base).catch(()=>[]))for(const folder of await fs.readdir(path.join(base,agent)).catch(()=>[])){const sessionRoot=path.join(base,agent,folder);const meta=await fs.readFile(path.join(sessionRoot,'.agl-session.json'),'utf8').then(JSON.parse).catch(()=>undefined);if(meta)rows.push({agent,folder,name:meta.name||folder,sessionRoot});}}return rows;}
const token=process.env.AGL_PORTAL_TOKEN;if(token!==undefined&&!/^[A-Za-z0-9_-]{20,}$/.test(token)){console.error('AGL_PORTAL_TOKEN must be 20+ URL-safe characters.');process.exit(2);}
createPortal({listSessions,port:Number(process.env.AGL_PORTAL_PORT)||0,...(token?{token}:{})}).url().then(url=>console.log(url));
