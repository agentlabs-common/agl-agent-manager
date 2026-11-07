// Which sessions need the user: a permission prompt, a blocked agent, or a reply they have not looked at yet.
class Attention{
 constructor(){this.busy=new Map();this.unread=new Set();}
 // rows: sessions from `claude agents --json` (status busy|idle|waiting, state working|blocked|done…). focused(key): is that agent on screen now.
 update(rows,focused=()=>false){for(const row of rows){const busy=row.status==='busy'||row.state==='working';if(this.busy.get(row.key)&&!busy&&!focused(row.key))this.unread.add(row.key);this.busy.set(row.key,busy);if(busy)this.unread.delete(row.key);}
  const result=new Map();for(const row of rows){const reason=row.status==='waiting'?'Waiting for your permission'+(row.waitingFor&&row.waitingFor!=='permission prompt'?': '+row.waitingFor:''):row.state==='blocked'?'Waiting for you':this.unread.has(row.key)?'New reply':'';if(reason)result.set(row.key,{reason,urgent:row.status==='waiting'||row.state==='blocked'});}return result;}
 seen(key){this.unread.delete(key);}
}
module.exports={Attention};
