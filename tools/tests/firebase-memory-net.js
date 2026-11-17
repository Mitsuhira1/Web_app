// Test-only Firebase API substitute. Never loaded by the shipped application.
export async function createNet() {
 const uid=crypto.randomUUID(), bus=new BroadcastChannel('firebase-regression');let roomId=null,role=null,cb={};
 const read=key=>JSON.parse(localStorage.getItem('test-'+key)||'null');
 const write=(key,value)=>localStorage.setItem('test-'+key,JSON.stringify(value));
 let playerSig='',stateSig='',cursorSig='';
 const deliver=()=>{if(!roomId)return;if(!read('room'))return cb.onRoomRemoved?.();
  const players=read('players')||{},state=read('state'),cursors={};for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key.startsWith('test-cursor-')){const c=JSON.parse(localStorage.getItem(key));if(c)cursors[c.uid]=c}}
  const ps=JSON.stringify(players),ss=JSON.stringify(state),cs=JSON.stringify(cursors);
  if(ps!==playerSig){playerSig=ps;cb.onPlayers?.(players)}if(ss!==stateSig){stateSig=ss;cb.onState?.(state)}if(cs!==cursorSig){cursorSig=cs;cb.onCursors?.(cursors)}
 };
 setInterval(deliver,50);
 const notify=()=>{bus.postMessage({type:'state'});queueMicrotask(deliver);};
 bus.onmessage=e=>{if(e.data.type==='action'){if(role==='host')cb.onAction?.(e.data.action);}else deliver();};
 return {get uid(){return uid},get role(){return role},get roomId(){return roomId},
 async createRoom(player,state,callbacks){cb=callbacks;roomId='4829';role='host';write('room',roomId);write('players',{[uid]:{...player,uid,slot:0}});write('state',state);notify();return {roomId,uid,slot:0}},
 async joinRoom(code,player,callbacks){cb=callbacks;roomId=code;role='guest';const players=read('players')||{};const used=new Set(Object.values(players).map(p=>p.slot));let slot=1;while(used.has(slot))slot++;players[uid]={...player,uid,slot};write('players',players);notify();return {roomId,uid,slot}},
 async chooseGame(choice,avatar){const players=read('players');players[uid]={...players[uid],choice,avatar};write('players',players);notify()},
 async writeState(state){write('state',state);notify()},async writeCursor(c){write('cursor-'+uid,{...c,uid});notify()},
 async sendAction(a){bus.postMessage({type:'action',action:{...a,uid}})},
 async leaveRoom(){if(role==='host')write('room',null);else{const players=read('players');delete players[uid];write('players',players);localStorage.removeItem('test-cursor-'+uid)}notify();roomId=null;role=null;},ensureAuth:async()=>uid};
}
