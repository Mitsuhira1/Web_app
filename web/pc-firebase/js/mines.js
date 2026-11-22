'use strict';
// マインスイーパー(ひとり・協力)。盤面の見た目・動き・設定は MineLink(ユーザーの別アプリ)に合わせた(2026-11-22)。
// 対戦は mine-versus.js。盤の描き方(paint)と拡大(zoom)は対戦でも使う。
const minesGame=(()=>{
 const LEVELS={easy:{label:'簡単',w:10,h:8,mines:10},normal:{label:'普通',w:18,h:14,mines:40},hard:{label:'難しい',w:24,h:20,mines:99},huge:{label:'超広域',w:32,h:28,mines:180},widest:{label:'最広域',w:56,h:32,mines:360}};
 const personal={confirm:true,show:true,share:true,firstFlag:false,swapButtons:false,noGuess:true,...store.get('minePersonal',{})};
 let playType=store.get('minePlayType','coop')==='versus'?'versus':'coop';
 const fmtTime=ms=>{const t=Math.max(0,ms|0);return `${Math.floor(t/60000)}:${String(Math.floor(t/1000)%60).padStart(2,'0')}`;};
 const fmtBest=ms=>`${fmtTime(ms)}.${Math.floor(ms/100)%10}`;
 const bests=()=>store.get('mineBest',{});
 function personalOptions(coop,on) {
  const rows = [['confirm','退出前に確認'],['firstFlag','最初から旗モード'],['swapButtons','左右クリックを入れ替える']];
  const cursorRows = [['show','相手のカーソルを表示'],['share','自分のカーソルを共有']];
  const rowFor = ([key,label]) => setupRow(label,sw('mine:'+key,personal[key]));
  const cursor = `<fieldset class="setup-availability" ${coop && on ? '' : 'disabled'}>${cursorRows.map(rowFor).join('')}</fieldset>`;
  return setupPanel('操作と表示', rows.map(rowFor).join('') + cursor);
 }
 function setPersonal(key,value){if(Object.hasOwn(personal,key)){personal[key]=value;store.set('minePersonal',personal);}}
 function exit(){
  if(!personal.confirm||board?.status!=='playing')return go(roomActive()?'room':'menu');
  openSheet('<h2>試合を抜けますか</h2><div class="btns"><button class="btn" data-sheetback>戻る</button><button class="btn danger" id="mineExitConfirm">抜ける</button></div>');
  $('#mineExitConfirm').onclick=()=>{closeSheet();go(roomActive()?'room':'menu');};
 }
 let res=null,resAt=0,shownStatus='playing',newBest=false;
 let level=Object.hasOwn(LEVELS,store.get('mineCoopLevel'))?store.get('mineCoopLevel'):'easy',board=null,flagMode=false,started=0,elapsed=0,onlineMode=false,matchId=null,ignoreId=null,history=[],lastVersion=-1,generating=0,lastTap={cell:-1,at:0};
 const around=(i,w,h)=>{const x=i%w,y=Math.floor(i/w),out=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if((dx||dy)&&x+dx>=0&&x+dx<w&&y+dy>=0&&y+dy<h)out.push((y+dy)*w+x+dx);return out;};
 // flags[i]: 0=なし、1〜6=旗を立てた人(席の番号+1。旗の色になる)
 class Board{
  constructor(level,seed){this.level=level;this.seed=seed>>>0;Object.assign(this,LEVELS[level]);this.mine=Array(this.w*this.h).fill(false);this.opened=Array(this.mine.length).fill(false);this.flags=Array(this.mine.length).fill(0);this.adj=Array(this.mine.length).fill(0);this.placed=false;this.safeCell=-1;this.openedSafe=0;this.status='playing';}
  place(safe){if(this.placed)return;this.safeCell=safe;const excluded=new Set([safe,...around(safe,this.w,this.h)]),cand=this.mine.map((_,i)=>i).filter(i=>!excluded.has(i));let seed=this.seed;for(let i=cand.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);[cand[i],cand[j]]=[cand[j],cand[i]];}for(let i=0;i<this.mines;i++)this.mine[cand[i]]=true;this.fillAdj();this.placed=true;}
  setLayout(layout,safe){this.safeCell=safe;this.mine=Array.from(layout,v=>!!v);this.mines=this.mine.filter(Boolean).length;this.fillAdj();this.placed=true;}
  fillAdj(){for(let i=0;i<this.mine.length;i++)this.adj[i]=around(i,this.w,this.h).filter(j=>this.mine[j]).length;}
  flag(i,owner=1){if(this.status!=='playing'||i<0||i>=this.mine.length||this.opened[i])return;this.flags[i]=this.flags[i]?0:owner;}
  open(i){if(this.status!=='playing'||i<0||i>=this.mine.length||this.opened[i]||this.flags[i])return;if(!this.placed)this.place(i);if(this.mine[i]){this.opened[i]=true;this.status='lost';return;}const todo=[i];this.opened[i]=true;while(todo.length){const at=todo.pop();this.openedSafe++;if(this.adj[at]===0)for(const j of around(at,this.w,this.h))if(!this.opened[j]&&!this.mine[j]&&!this.flags[j]){this.opened[j]=true;todo.push(j);}}if(this.openedSafe===this.mine.length-this.mines)this.status='won';}
  chord(i){if(!this.opened[i]||this.mine[i]||!this.adj[i])return;const n=around(i,this.w,this.h);if(n.filter(j=>this.flags[j]).length!==this.adj[i])return;for(const j of n)if(!this.opened[j]&&!this.flags[j])this.open(j);}
  // 9=閉じた 0〜8=数字 11=地雷(負けた時に見せる) 12=踏んだ地雷 20〜25=旗(20+席の番号)
  code(i){if(this.opened[i])return this.mine[i]?12:this.adj[i];if(this.flags[i])return 19+this.flags[i];return this.status==='lost'&&this.mine[i]?11:9;}
  get percent(){return Math.floor(this.openedSafe/(this.mine.length-this.mines)*100)}
  snapshot(){return{level:this.level,seed:this.seed,safeCell:this.safeCell,mines:this.mines,layout:this.placed?MineNoGuess.encode(this.mine):'',opened:this.opened.slice(),flags:this.flags.slice(),status:this.status,openedSafe:this.openedSafe};}
  restore(s){if(!s||s.level!==this.level||s.seed!==this.seed||s.opened?.length!==this.mine.length||s.flags?.length!==this.mine.length)throw Error('snapshot');const lay=s.layout&&MineNoGuess.decode(s.layout,this.mine.length,s.mines??this.mines);if(lay)this.setLayout(lay,s.safeCell);else if(s.safeCell>=0)this.place(s.safeCell);this.opened=s.opened.slice();this.flags=s.flags.map(v=>v===true?1:+v||0);this.status=s.status;this.openedSafe=s.openedSafe;}
 }

 // ---------------------------------------------------------------- 盤の描き方(対戦でも使う)
 const FLAG_SVG=c=>`<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M32 18L76 36L32 54Z" fill="${c}"/><rect x="30" y="18" width="6" height="58" fill="#14212b"/><rect x="22" y="74" width="42" height="7" fill="#14212b"/></svg>`;
 const MINE_SVG=c=>`<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="20" fill="${c}"/>${[0,1,2,3,4,5,6,7].map(k=>{const a=k*Math.PI/4,x=Math.cos(a),y=Math.sin(a);return `<line x1="${(50+x*22).toFixed(1)}" y1="${(50+y*22).toFixed(1)}" x2="${(50+x*34).toFixed(1)}" y2="${(50+y*34).toFixed(1)}" stroke="${c}" stroke-width="6" stroke-linecap="round"/>`}).join('')}</svg>`;
 const flagColor=code=>SEAT_COLORS[Math.min(SEAT_COLORS.length-1,Math.max(0,code-20))];
 const kindOf=code=>code===9?'hidden':code>=20?'flag':code===11||code===12?'mine':'open';
 // anim: [種類, 遅れ(ms), 外した旗の色]
 function cellHtml(code,i,o,anim){
  const fog=o.fog&&code>0&&code<9;
  let inner=code>=20?FLAG_SVG(flagColor(code)):code===11?MINE_SVG('#14212b'):code===12?MINE_SVG('#fff'):code>0&&code<9&&!fog?code:'';
  let cls='mine-cell '+kindOf(code),style='';
  if(anim){
   const [k,d,old]=anim;cls+=' ml-'+k;style=` style="--d:${Math.round(d)}ms"`;
   if(k==='rev'||k==='show')inner+='<i class="ml-peel"></i>';
   if(k==='unflag')inner+=`<i class="ml-flagout">${FLAG_SVG(flagColor(old))}</i>`;
   if(k==='boom')inner+='<i class="ml-burst"></i>';
  }
  return `<button class="${cls}" ${o.attr}="${i}" data-code="${code}"${style} aria-label="${i+1}番のマス" ${o.disabled?'disabled':''}>${inner}</button>`;
 }
 // el の子(マス)を codes に合わせる。変わったマスだけ作り直し、MineLink と同じ動き(剥がれる・旗が立つ・爆発)を付ける。
 function paint(el,codes,o){
  if(!el)return;
  const cols=o.cols,dist=(a,b)=>Math.hypot(a%cols-b%cols,Math.floor(a/cols)-Math.floor(b/cols));
  const prev=el._codes,fog=!!o.fog,dis=!!o.disabled;
  if(!prev||prev.length!==codes.length||el.children.length!==codes.length){
   el.innerHTML=codes.map((c,i)=>cellHtml(c,i,o)).join('');el._codes=codes.slice();el._fog=fog;el._dis=dis;return;
  }
  const changed=[];for(let i=0;i<codes.length;i++)if(prev[i]!==codes[i]||(el._fog!==fog&&codes[i]>0&&codes[i]<9))changed.push(i);
  if(el._dis!==dis){for(const b of el.children)b.disabled=dis;el._dis=dis;}
  el._fog=fog;
  if(!changed.length)return;
  const origin=o.origin>=0&&o.origin<codes.length?o.origin:changed[0];
  const boom=changed.find(i=>codes[i]===12&&prev[i]!==12);
  const center=boom??origin;let revealed=0,flagOn=0,flagOff=0;
  for(const i of changed){
   const a=prev[i],c=codes[i];let anim=null;
   if(c>=0&&c<9&&(a===9||a>=20)){anim=['rev',Math.min(dist(i,origin)*22,420)];revealed++;}
   else if(c>=20&&a===9){anim=['flag',0];flagOn++;}
   else if(c===9&&a>=20){anim=['unflag',0,a];flagOff++;}
   else if(c===12&&a!==12)anim=['boom',0];
   else if(c===11&&a!==11)anim=['show',250+Math.min(dist(i,center)*55,1000)];
   const child=el.children[i];if(child)child.outerHTML=cellHtml(c,i,o,anim);
  }
  el._codes=codes.slice();
  if(boom!=null){el.classList.remove('ml-shake');void el.offsetWidth;el.classList.add('ml-shake');}
  if(o.sound!==false){
   if(boom!=null||revealed)sfx.play('CARD_FLIP',{volume:revealed>1?.4:.3});
   if(flagOn||flagOff)sfx.play('TAP',{volume:.3});
  }
 }

 // ---------------------------------------------------------------- 盤だけの拡大・移動(2 本指・Ctrl+ホイール・トラックパッド)
 const Z={s:1,x:0,y:0};let lastLong=0,suppressUntil=0;
 const MAX_SCALE=6;
 function applyZoom(){
  const wrap=$('.mine-boardwrap'),bd=wrap&&wrap.querySelector('.mine-board');if(!bd)return;
  // 拡大は絵を引き伸ばさず、マスの大きさ(--zs)を変える(すき間・字がにじまない)。移動は translate
  bd.style.setProperty('--zs',Z.s);
  const mx=Math.max(0,(bd.offsetWidth-wrap.clientWidth)/2+8),my=Math.max(0,(bd.offsetHeight-wrap.clientHeight)/2+8);
  Z.x=Math.max(-mx,Math.min(mx,Z.x));Z.y=Math.max(-my,Math.min(my,Z.y));
  bd.style.transform=Z.s===1?'':`translate(calc(-50% + ${Z.x}px),calc(-50% + ${Z.y}px))`;
  const lab=wrap.querySelector('.mine-zoom');if(lab){lab.hidden=Z.s<=1.01;lab.textContent='×'+Z.s.toFixed(1);}
 }
 function resetZoom(){Z.s=1;Z.x=0;Z.y=0;applyZoom();}
 function zoomAt(s1,px,py){ // px,py: 盤の枠の中心からの位置
  s1=Math.max(1,Math.min(MAX_SCALE,s1));const k=s1/Z.s;Z.x=px-(px-Z.x)*k;Z.y=py-(py-Z.y)*k;Z.s=s1;if(s1===1){Z.x=0;Z.y=0;}applyZoom();
 }
 // 盤の枠に操作を付ける。onLong(マスの要素) は長押し(旗)。
 function mountZoom(onLong){
  const wrap=$('.mine-boardwrap');if(!wrap)return;
  applyZoom();
  if(wrap._zoom)return;wrap._zoom=true;
  const rel=(x,y)=>{const r=wrap.getBoundingClientRect();return [x-r.left-r.width/2,y-r.top-r.height/2];};
  // マスとマスのすき間を押した時は、いちばん近いマス(MineLink と同じく、押した位置のマス)
  const cellAt=(x,y,target)=>{
   const hit=target?.closest?.('[data-mine-cell],[data-extra-mine]');if(hit)return hit;
   const bd=wrap.querySelector('.mine-board'),cells=bd?.children;if(!cells?.length)return null;
   const r=bd.getBoundingClientRect(),cols=+getComputedStyle(wrap).getPropertyValue('--mine-cols')||1,rows=Math.ceil(cells.length/cols);
   const cx=Math.floor((x-r.left)/r.width*cols),cy=Math.floor((y-r.top)/r.height*rows);
   return cx>=0&&cx<cols&&cy>=0&&cy<rows?cells[cy*cols+cx]:null;
  };
  wrap.addEventListener('wheel',e=>{
   if(e.ctrlKey){e.preventDefault();const [px,py]=rel(e.clientX,e.clientY);zoomAt(Z.s*Math.exp(-Math.max(-50,Math.min(50,e.deltaY))*.01),px,py);}
   else if(Z.s>1){e.preventDefault();Z.x-=e.deltaX;Z.y-=e.deltaY;applyZoom();}
  },{passive:false});
  wrap.addEventListener('gesturestart',e=>e.preventDefault());
  const pts=new Map();let pinch=null,drag=null,timer=0;
  const clearLong=()=>{clearTimeout(timer);timer=0;};
  const move=e=>{
   if(!pts.has(e.pointerId))return;pts.set(e.pointerId,[e.clientX,e.clientY]);
   if(pinch&&pts.size>=2){
    const [a,b]=[...pts.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]),[mx,my]=rel((a[0]+b[0])/2,(a[1]+b[1])/2);
    const s1=Math.max(1,Math.min(MAX_SCALE,pinch.s*d/pinch.d)),k=s1/pinch.s;
    Z.s=s1;Z.x=mx-(pinch.mx-pinch.x)*k;Z.y=my-(pinch.my-pinch.y)*k;if(s1===1){Z.x=0;Z.y=0;}applyZoom();
   }else if(drag){
    const dx=e.clientX-drag.cx,dy=e.clientY-drag.cy;
    if(!drag.moved&&Math.hypot(dx,dy)>8){drag.moved=true;clearLong();}
    if(drag.moved&&Z.s>1){Z.x=drag.x+dx;Z.y=drag.y+dy;applyZoom();}
   }
  };
  const up=e=>{
   if(!pts.delete(e.pointerId))return;clearLong();
   if(pinch||drag?.moved)suppressUntil=performance.now()+200;
   if(pts.size<2)pinch=null;if(!pts.size){drag=null;removeEventListener('pointermove',move);removeEventListener('pointerup',up);removeEventListener('pointercancel',up);}
  };
  wrap.addEventListener('pointerdown',e=>{
   if(e.button>0)return;
   pts.set(e.pointerId,[e.clientX,e.clientY]);
   if(pts.size===1){addEventListener('pointermove',move);addEventListener('pointerup',up);addEventListener('pointercancel',up);}
   if(pts.size===2){
    clearLong();const [a,b]=[...pts.values()],[mx,my]=rel((a[0]+b[0])/2,(a[1]+b[1])/2);
    pinch={d:Math.max(1,Math.hypot(a[0]-b[0],a[1]-b[1])),s:Z.s,x:Z.x,y:Z.y,mx,my};drag=null;
   }else if(pts.size===1){
    drag={cx:e.clientX,cy:e.clientY,x:Z.x,y:Z.y,moved:false};
    if(e.pointerType!=='mouse'){
     const cell=cellAt(e.clientX,e.clientY,e.target);
     if(cell&&!cell.disabled)timer=setTimeout(()=>{timer=0;lastLong=performance.now();suppressUntil=lastLong+600;navigator.vibrate?.(15);onLong(cell);},450);
    }
   }
  });
  wrap.addEventListener('click',e=>{
   if(performance.now()<suppressUntil&&!e.target.closest('.mine-zoom')){e.stopPropagation();e.preventDefault();return;}
   if(e.target.classList.contains('mine-board')){const c=cellAt(e.clientX,e.clientY);if(c&&!c.disabled)c.click();}
  },true);
  wrap.addEventListener('contextmenu',e=>{if(performance.now()-lastLong<900){e.stopPropagation();e.preventDefault();}},true);
 }
 addEventListener('resize',()=>{if(S.screen==='minePlay'||S.screen==='extraPlay')applyZoom();});

 // ---------------------------------------------------------------- 準備画面
 function setup(on=false){onlineMode=on;go('mineSetup');}
 function setMode(value) {
  if (value!=='coop' && value!=='versus') return;
  playType=value;
  store.set('minePlayType',value);
  render();
 }
 function levelCards(key,active){
  const best=bests();
  return `<div class="mine-levels" data-seg="${key}">${Object.entries(LEVELS).map(([id,v])=>{
   const k=1.25;
   return `<button data-v="${id}" aria-pressed="${id===active}"><span class="mine-shape"><i style="width:${Math.round(v.w*k)}px;height:${Math.round(v.h*k)}px"></i></span><b>${v.label}</b><small>${v.w} × ${v.h} ・ 地雷 ${v.mines}</small>${best[id]?`<small class="best">自己ベスト ${fmtBest(best[id])}</small>`:''}</button>`;}).join('')}</div>`;
 }
 function setupHtml() {
  const versus = playType==='versus';
  const room = roomActive();
  const on = versus ? room : (onlineMode || canStartExtraMatch()) && room;
  const mode = setupPanel('遊び方', setupRow('プレイモード',seg('mine:mode', [['coop','協力'],['versus','対戦']], playType)));
  const activeLevel = versus ? mineVersus.selectedLevel : level;
  const details = mineVersus.setupPanels();
  const onlyVersus = html => `<fieldset class="setup-availability" ${versus ? '' : 'disabled'}>${html}</fieldset>`;
  const rules = setupPanel('ルール', `<div class="mine-levels-label">広さ</div>` + levelCards(versus ? 'mine-versus:level' : 'mine:level', activeLevel) +
    setupRow('運任せのない盤面',sw('mine:noGuess',personal.noGuess),'推測しなくても論理だけで解ける配置にします。') + onlyVersus(details.finish));
  const action = versus ? (room ? 'data-mine-vs-start' : 'data-go="room"') : 'data-mine-start';
  const participants = versus && !room
    ? setupPanel('人数と相手', setupRow('対局', '<b>ルームで募集</b>'))
    : extraParticipants(on);
  return extraSetupLayout('mine', on, mode + rules + participants, onlyVersus(details.rules) + personalOptions(!versus,on),
    action, {label:versus && !room?'ルームへ':'スタート',modeLabel:versus?'みんなで遊ぶ':undefined});
 }

 // ---------------------------------------------------------------- 対局
 function start() {
  if (canStartExtraMatch()) onlineMode=true;
  if (onlineMode && !canStartExtraMatch()) return;
  const seed=crypto.getRandomValues(new Uint32Array(1))[0];
  board=new Board(level,seed);started=0;elapsed=0;flagMode=personal.firstFlag;history=[];lastVersion=0;matchId=`${Date.now()}-${seed}`;generating=0;res=null;shownStatus='playing';newBest=false;setExtraResult(null);
  Z.s=1;Z.x=0;Z.y=0;
  go('minePlay');if(onlineMode)publish();
 }
 function publish(){if(!onlineMode||!board||netApi?.role!=='host')return;netApi.writeState({mine:{id:matchId,phase:'playing',level,seed:board.seed,version:lastVersion,board:board.snapshot()}}).catch(e=>console.warn('[Mine]',e));}
 function remote(state){const s=state?.mine;if(!s||s.phase!=='playing'){if(onlineMode&&S.screen==='minePlay'&&netApi?.role==='guest')go('menu');return;}if(netApi?.role==='host'||s.id===ignoreId)return;if(!LEVELS[s.level]||!Number.isInteger(s.seed)||!Number.isInteger(s.version))return;if(s.id!==matchId){onlineMode=true;matchId=s.id;level=s.level;board=new Board(level,s.seed);lastVersion=-1;started=performance.now();elapsed=0;res=null;shownStatus='playing';newBest=false;setExtraResult(null);flagMode=personal.firstFlag;Z.s=1;Z.x=0;Z.y=0;S.screen='minePlay';render();}if(s.version<=lastVersion)return;try{board.restore(s.board);lastVersion=s.version;redraw();}catch(e){console.warn('[Mine] invalid shared board',e);}}
 const slotOf=uid=>{const p=uid&&fbState?.players?.[uid];return Number.isInteger(p?.slot)?p.slot:0;};
 function actionFromGuest(act){if(netApi?.role!=='host'||!onlineMode||!board||act.id!==matchId)return;if(!['open','flag','undo'].includes(act.move)||!Number.isInteger(act.cell))return;if(act.move==='undo')undo();else move(act.cell,act.move==='flag',slotOf(act.uid));}
 function undo(){if((onlineMode&&netApi?.role!=='host')||!history.length||board?.status!=='lost')return;const snap=history.pop();board=new Board(level,board.seed);board.restore(snap);lastVersion++;publish();redraw();}
 function requestUndo(){if(!onlineMode||netApi?.role==='host')undo();else netApi?.sendAction({type:'MINE',id:matchId,move:'undo',cell:0}).catch(e=>console.warn('[Mine]',e));}
 function stop(){if(onlineMode&&netApi?.role==='host')netApi.writeState({mine:null}).catch(()=>{});else if(onlineMode)ignoreId=matchId;board=null;matchId=null;onlineMode=false;history=[];generating=0;}
 const boardStatus = () => ({playing:'安全なマスを開いてください',won:'クリア！',lost:'地雷を踏みました'})[board.status];
 const codes=()=>board.opened.map((_,i)=>board.code(i));
 const paintOpts=()=>({attr:'data-mine-cell',cols:board.w,origin:performance.now()-lastTap.at<800?lastTap.cell:-1});
 function playHtml() {
  if (!board) return '';
  const members = onlineMode ? activeMembers() : [{slot:0,name:meName()}];
  const seats = `<div class="seats">${members.map(p=>`<div class="seat"><i class="dot" style="background:${SEAT_COLORS[p.slot]}"></i><span class="nm">${esc(p.name)}</span></div>`).join('')}</div>`;
  const tap = seg('mine:tap',[['open','開く'],['flag','旗']],flagMode?'flag':'open');
  const content = setupPanel('操作',setupRow('マスの操作',tap)+setupRow('地雷',`<b>${board.mines}個</b>`)+setupRow('進捗',`<b id="mineSidePercent">${board.percent}%</b>`));
  const actions = ruleButton('mine')+`<button class="btn" data-mine-undo ${board.status==='lost'?'':'hidden'}>${ic('undo')}待った</button>`;
  const side = playSide({seats,status:`<div class="status" id="mineStatus">${boardStatus()}</div>`,actions,on:onlineMode,content});
  return `<div class="screen fit"><div class="stage mine-stage">
    ${playHeader('マインスイーパー',onlineMode?'みんなで遊ぶ・協力':'ひとりで遊ぶ','data-mine-exit')}
    <div class="mine-boardwrap" style="--mine-cols:${board.w};--mine-rows:${board.h}"><div id="boardwrap" class="mine-board">${codes().map((c,i)=>cellHtml(c,i,paintOpts())).join('')}</div><button class="mine-zoom" data-mine-zoomreset hidden aria-label="拡大を戻す"></button><div class="mine-gen" id="mineGen" hidden>運任せのない盤面を作っています…</div></div>
    <div class="mine-foot"><span>${FLAG_SVG(SEAT_COLORS[0]).replace('<svg','<svg class="mine-foot-flag"')} <b id="mineFlags">${board.mines-board.flags.filter(Boolean).length}</b></span><span id="mineTime">${fmtTime(board.status==='playing'&&started?performance.now()-started:elapsed)}</span><span id="minePercent">${board.percent}%</span></div>
    <div class="mine-tapseg">${tap}</div>
    ${playGear()}<div class="cutlayer" id="cutlayer"></div>${extraResultLayer(res&&performance.now()>=resAt?res:null)}</div>${side}</div>`;
 }
 function mounted(){if(S.screen!=='minePlay'||!board)return;const el=$('#boardwrap.mine-board');if(el){el._codes=codes();el._fog=false;el._dis=false;}mountZoom(cell=>move(+cell.dataset.mineCell,true));}
 function redraw(){
  if(S.screen!=='minePlay'||!board)return;
  paint($('#boardwrap.mine-board'),codes(),paintOpts());
  const undoButton=$('[data-mine-undo]');if(undoButton)undoButton.hidden=board.status!=='lost';
  const status=$('#mineStatus');if(status)status.textContent=boardStatus();
  const f=document.getElementById('mineFlags');if(f)f.textContent=board.mines-board.flags.filter(Boolean).length;
  const p=document.getElementById('minePercent');if(p)p.textContent=board.percent+'%';
  const sp=document.getElementById('mineSidePercent');if(sp)sp.textContent=board.percent+'%';
  tick();
  if(board.status!==shownStatus){
   shownStatus=board.status;
   if(board.status==='playing'){res=null;setExtraResult(null);}
   else{
    if(!elapsed&&started)elapsed=performance.now()-started;
    cut({text:board.status==='won'?'完成！':'残念！',tone:'felt',ms:1400});
    res=resultBox();resAt=performance.now()+1500;setExtraResult(res,1500);
   }
  }
 }
 // 終わった後の画面(MineLink の結果の画面と同じ中身: 勝ち負け・広さ・タイム・自己ベスト、もう一度・メニュー)
 function resultBox(){
  const won=board.status==='won',host=!onlineMode||netApi?.role==='host';
  return {title:won?(onlineMode?'成功！':'クリア！'):(onlineMode?'失敗…':'ゲームオーバー'),
   sub:`${LEVELS[level].label}　${fmtBest(elapsed)}`+(newBest?'　自己ベスト更新':''),
   exit:'data-mine-exit',again:host?'data-mine-again':'',undo:won?'':'data-mine-undo',
   wait:host?'':'ホストが次を始めるのを待っています',online:onlineMode};
 }
 function tick(){const t=document.getElementById('mineTime');if(t&&board)t.textContent=fmtTime(board.status==='playing'&&started?performance.now()-started:elapsed);}
 // 最初に開いたマスから、論理だけで解ける配置を作る(ホストだけ。作っている間は操作を受け付けない)
 function generate(i){
  const b=board,id=matchId,token=++generating;
  const show=setTimeout(()=>{const g=$('#mineGen');if(g&&generating===token)g.hidden=false;},250);
  MineNoGuess.generateAsync(b.w,b.h,b.mines,i,b.seed).then(r=>{
   clearTimeout(show);const g=$('#mineGen');if(g)g.hidden=true;
   if(generating!==token||board!==b||matchId!==id)return;
   generating=0;
   if(r?.layout)b.setLayout(r.layout,i);
   move(i,false);
  });
 }
 function move(i,flag=flagMode,slot=null){
  if(!board||board.status!=='playing'||!Number.isInteger(i)||i<0||i>=board.mine.length||generating)return;
  if(slot==null){lastTap={cell:i,at:performance.now()};slot=onlineMode?slotOf(netApi?.uid):0;}
  if(onlineMode&&netApi?.role==='guest'){netApi.sendAction({type:'MINE',id:matchId,move:flag?'flag':'open',cell:i}).catch(e=>console.warn('[Mine]',e));return;}
  if(!flag&&!board.placed&&!board.flags[i]&&personal.noGuess){generate(i);return;}
  const before=board.status,snap=board.snapshot();
  if(flag)board.flag(i,slot+1);
  else{if(board.opened[i])board.chord(i);else{if(!started)started=performance.now();board.open(i);}}
  history.push(snap);if(history.length>30)history.shift();
  if(onlineMode){lastVersion++;publish();}
  if(before!==board.status){
   elapsed=performance.now()-started;
   if(board.status==='won'&&!onlineMode){
    const stats=store.get('stats',{}),v=stats.solo_mine||[0];v[0]++;stats.solo_mine=v;store.set('stats',stats);
    const best=bests();if(!best[level]||elapsed<best[level]){best[level]=Math.round(elapsed);store.set('mineBest',best);newBest=true;}
   }
  }
  redraw();
 }
 setInterval(()=>{if(S.screen==='minePlay'&&board?.status==='playing'&&started)tick();},1000);
 return{setup,setupHtml,setMode,start,playHtml,mounted,move,exit,personal,personalOptions,setPersonal,remote,actionFromGuest,requestUndo,stop,Board,LEVELS,paint,cellHtml,mountZoom,resetZoom,resetZoomState:()=>{Z.s=1;Z.x=0;Z.y=0;},longPressedRecently:()=>performance.now()-lastLong<900,get level(){return level},set level(v){if(Object.hasOwn(LEVELS,v)){level=v;store.set('mineCoopLevel',v);}},get flagMode(){return flagMode},set flagMode(v){flagMode=!!v},get board(){return board}};
})();
