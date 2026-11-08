// Which sessions need the user: a permission prompt, an agent whose status page says needs-you, a reply they
// have not looked at yet, or a running agent with portal contacts that is not listening for their messages.
// Claude Code's own state 'blocked' is not used: it stays on agents that are busy or idle and need nothing.
class Attention{
 constructor(){this.busy=new Map();this.unread=new Set();}
 // rows: sessions from `claude agents --json` (status busy|idle|waiting, state working|blocked|done…). focused(key): is that agent on screen now.
 update(rows,focused=()=>false){for(const row of rows){// Claude Code's status is busy whenever a background task runs, and every listening agent keeps one, so status says
  // nothing about a turn; its state field does: 'working' only during a turn (checked on live data).
  const busy=row.state==='working';if(this.busy.get(row.key)&&!busy&&!focused(row.key))this.unread.add(row.key);this.busy.set(row.key,busy);if(busy)this.unread.delete(row.key);}
  const result=new Map();for(const row of rows){const reason=row.status==='waiting'?'Waiting for your permission'+(row.waitingFor&&row.waitingFor!=='permission prompt'?': '+row.waitingFor:''):row.needsYou?'Question for you on the agent portal':this.unread.has(row.key)?'New reply':row.notListening?'Not listening for portal messages':'';if(reason)result.set(row.key,{reason,urgent:row.status==='waiting'||!!row.needsYou,...(reason==='Not listening for portal messages'?{quiet:true}:{})});}return result;}
 seen(key){this.unread.delete(key);}
}
module.exports={Attention};
