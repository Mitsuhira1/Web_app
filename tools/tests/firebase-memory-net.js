// Test-only Firebase API substitute. Never loaded by the shipped application.
export async function createNet() {
 const uid=crypto.randomUUID(), bus=new BroadcastChannel('firebase-regression');let roomId=null,role=null,cb={};
 const read=key=>JSON.parse(localStorage.getItem('test-'+key)||'null');
 const write=(key,value)=>localStorage.setItem('test-'+key,JSON.stringify(value));
 const clearAll=()=>{
  for(const k of ['room','hostUid','players','state','kicked'])localStorage.removeItem('test-'+k);
  for(let i=localStorage.length-1;i>=0;i--){const key=localStorage.key(i);if(key&&key.startsWith('test-cursor-'))localStorage.removeItem(key);}
 };
 let playerSig='',stateSig='',cursorSig='',hostUidSig='';
 const deliver=()=>{
  if(!roomId)return;
  if(!read('room')){roomId=null;role=null;cb.onRoomRemoved?.();return;}
  const kicked=read('kicked')||{};
  if(kicked[uid]){const kv=kicked[uid];roomId=null;role=null;cb.onKicked?.(kv);return;}
  const hUid=read('hostUid');
  if(hUid&&hUid!==hostUidSig){hostUidSig=hUid;cb.onHostUid?.(hUid);}
  const players=read('players')||{},state=read('state'),cursors={};
  for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key.startsWith('test-cursor-')){const c=JSON.parse(localStorage.getItem(key));if(c)cursors[c.uid]=c;}}
  const ps=JSON.stringify(players),ss=JSON.stringify(state),cs=JSON.stringify(cursors);
  if(ps!==playerSig){playerSig=ps;cb.onPlayers?.(players);}
  if(ss!==stateSig){stateSig=ss;cb.onState?.(state);}
  if(cs!==cursorSig){cursorSig=cs;cb.onCursors?.(cursors);}
 };
 setInterval(deliver,50);
 const notify=()=>{bus.postMessage({type:'state'});queueMicrotask(deliver);};
 bus.onmessage=e=>{if(e.data.type==='action'){if(role==='host')cb.onAction?.(e.data.action);}else deliver();};
 return {
  get uid(){return uid;},
  get role(){return role;},
  get roomId(){return roomId;},
  async syncDisconnectPolicy(){},
  async createRoom(player,state,callbacks){
   cb=callbacks||{};roomId='4829';role='host';playerSig='';stateSig='';cursorSig='';hostUidSig='';
   clearAll();
   write('room',roomId);write('hostUid',uid);write('kicked',{});
   write('players',{[uid]:{...player,uid,slot:0,role:'host',spectating:false,autoCpu:false,joinedAt:Date.now()}});
   write('state',state);notify();return {roomId,uid,slot:0};
  },
  async joinRoom(code,player,callbacks){
   if(!read('room')||String(code)!==String(read('room')))throw new Error(`部屋「${code}」が見つかりません`);
   cb=callbacks||{};roomId=String(code);role='guest';playerSig='';stateSig='';cursorSig='';hostUidSig='';
   const players=read('players')||{};
   const kicked=read('kicked')||{};delete kicked[uid];write('kicked',kicked);
   const existing=players[uid];
   const used=new Set(Object.values(players).map(p=>p&&typeof p.slot==='number'?p.slot:-1));
   if(!existing&&used.size>=6)throw new Error('部屋が満員です(最大6人)');
   let slot=existing&&typeof existing.slot==='number'?existing.slot:1;
   if(!existing){for(let s=0;s<6;s++){if(!used.has(s)){slot=s;break;}}}
   players[uid]={...player,uid,slot,role:'guest',spectating:false,autoCpu:false,joinedAt:Date.now()};
   write('players',players);notify();return {roomId,uid,slot,hostUid:read('hostUid')};
  },
  async chooseGame(choice,avatar){const players=read('players')||{};if(players[uid]){players[uid]={...players[uid],choice,avatar};write('players',players);notify();}},
  async setPlayerFlags(partial){const players=read('players')||{};if(players[uid]&&partial){players[uid]={...players[uid],...partial};write('players',players);notify();}},
  async transferHost(targetUid){
   if(role!=='host'||!targetUid||targetUid===uid)return;
   const players=read('players')||{};
   if(players[uid])players[uid]={...players[uid],role:'guest'};
   if(players[targetUid])players[targetUid]={...players[targetUid],role:'host'};
   role='guest';write('players',players);write('hostUid',targetUid);notify();
  },
  async assumeHost(){
   const players=read('players')||{};
   if(players[uid])players[uid]={...players[uid],role:'host'};
   role='host';write('players',players);write('hostUid',uid);notify();
  },
  async kickPlayer(targetUid){
   if(role!=='host'||!targetUid||targetUid===uid)return;
   const players=read('players')||{};delete players[targetUid];
   const kicked=read('kicked')||{};kicked[targetUid]=Date.now();
   localStorage.removeItem('test-cursor-'+targetUid);
   write('kicked',kicked);write('players',players);notify();
  },
  async writeState(state){write('state',Object.assign({},read('state')||{},state));notify();},
  async writeCursor(c){write('cursor-'+uid,{...c,uid});notify();},
  async sendAction(a){bus.postMessage({type:'action',action:{...a,uid}});},
  async leaveRoom(mode='leave'){
   const resolved=mode===true?'skip':mode===false?(role==='host'?'dissolve':'leave'):(mode||'leave');
   const wasRole=role;roomId=null;role=null;
   if(resolved==='skip')return;
   if(resolved==='dissolve'||(resolved==='auto'&&wasRole==='host')){clearAll();}
   else{const players=read('players')||{};delete players[uid];write('players',players);localStorage.removeItem('test-cursor-'+uid);}
   notify();
  },
  ensureAuth:async()=>uid
 };
}
