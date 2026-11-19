'use strict';
const minesGame=(()=>{
 const LEVELS={easy:{label:'簡単',w:10,h:8,mines:10},normal:{label:'普通',w:18,h:14,mines:40},hard:{label:'難しい',w:24,h:20,mines:99},huge:{label:'超広域',w:32,h:28,mines:180},widest:{label:'最広域',w:56,h:32,mines:360}};
 const personal={confirm:true,show:true,share:true,firstFlag:false,swapButtons:false,...store.get('minePersonal',{})};
 let playType=store.get('minePlayType','coop')==='versus'?'versus':'coop';
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
 let level=Object.hasOwn(LEVELS,store.get('mineCoopLevel'))?store.get('mineCoopLevel'):'easy',board=null,flagMode=false,started=0,elapsed=0,onlineMode=false,matchId=null,ignoreId=null,history=[],lastVersion=-1;
 const around=(i,w,h)=>{const x=i%w,y=Math.floor(i/w),out=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if((dx||dy)&&x+dx>=0&&x+dx<w&&y+dy>=0&&y+dy<h)out.push((y+dy)*w+x+dx);return out;};
 class Board{
  constructor(level,seed){this.level=level;this.seed=seed>>>0;Object.assign(this,LEVELS[level]);this.mine=Array(this.w*this.h).fill(false);this.opened=Array(this.mine.length).fill(false);this.flags=Array(this.mine.length).fill(false);this.adj=Array(this.mine.length).fill(0);this.placed=false;this.safeCell=-1;this.openedSafe=0;this.status='playing';}
  place(safe){if(this.placed)return;this.safeCell=safe;const excluded=new Set([safe,...around(safe,this.w,this.h)]),cand=this.mine.map((_,i)=>i).filter(i=>!excluded.has(i));let seed=this.seed;for(let i=cand.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);[cand[i],cand[j]]=[cand[j],cand[i]];}for(let i=0;i<this.mines;i++)this.mine[cand[i]]=true;for(let i=0;i<this.mine.length;i++)this.adj[i]=around(i,this.w,this.h).filter(j=>this.mine[j]).length;this.placed=true;}
  flag(i){if(this.status!=='playing'||i<0||i>=this.mine.length||this.opened[i])return;this.flags[i]=!this.flags[i];}
  open(i){if(this.status!=='playing'||i<0||i>=this.mine.length||this.opened[i]||this.flags[i])return;if(!this.placed)this.place(i);if(this.mine[i]){this.opened[i]=true;this.status='lost';return;}const todo=[i];this.opened[i]=true;while(todo.length){const at=todo.pop();this.openedSafe++;if(this.adj[at]===0)for(const j of around(at,this.w,this.h))if(!this.opened[j]&&!this.mine[j]&&!this.flags[j]){this.opened[j]=true;todo.push(j);}}if(this.openedSafe===this.mine.length-this.mines)this.status='won';}
  chord(i){if(!this.opened[i]||this.mine[i]||!this.adj[i])return;const n=around(i,this.w,this.h);if(n.filter(j=>this.flags[j]).length!==this.adj[i])return;for(const j of n)if(!this.opened[j]&&!this.flags[j])this.open(j);}
  code(i){if(this.opened[i])return this.mine[i]?12:this.adj[i];if(this.flags[i])return 20;return this.status==='lost'&&this.mine[i]?11:9;}
  get percent(){return Math.floor(this.openedSafe/(this.mine.length-this.mines)*100)}
  snapshot(){return{level:this.level,seed:this.seed,safeCell:this.safeCell,opened:this.opened.slice(),flags:this.flags.slice(),status:this.status,openedSafe:this.openedSafe};}
  restore(s){if(!s||s.level!==this.level||s.seed!==this.seed||s.opened?.length!==this.mine.length||s.flags?.length!==this.mine.length)throw Error('snapshot');if(s.safeCell>=0)this.place(s.safeCell);this.opened=s.opened.slice();this.flags=s.flags.slice();this.status=s.status;this.openedSafe=s.openedSafe;}
 }
 function setup(on=false){onlineMode=on;go('mineSetup');}
 function setMode(value) {
  if (value!=='coop' && value!=='versus') return;
  playType=value;
  store.set('minePlayType',value);
  render();
 }
 function setupHtml() {
  const versus = playType==='versus';
  const room = roomActive();
  const on = versus ? room : (onlineMode || canStartExtraMatch()) && room;
  const mode = setupPanel('遊び方', setupRow('プレイモード',seg('mine:mode', [['coop','協力'],['versus','対戦']], playType)));
  const activeLevel = versus ? mineVersus.selectedLevel : level;
  const difficulty = Object.entries(LEVELS).map(([id, data]) =>
    [id, data.label, versus && !mineVersus.levels.includes(id)]);
  const levelKey = versus ? 'mine-versus:level' : 'mine:level';
  const difficultyButtons = seg(levelKey, difficulty, activeLevel);
  const field = LEVELS[activeLevel];
  const details = mineVersus.setupPanels();
  const onlyVersus = html => `<fieldset class="setup-availability" ${versus ? '' : 'disabled'}>${html}</fieldset>`;
  const rules = setupPanel('ルール', setupRow('難易度',difficultyButtons,'盤面の広さと地雷の数が変わります。') +
    setupRow('盤面',`<b>${field.w}×${field.h} / 地雷 ${field.mines}個</b>`) + onlyVersus(details.finish));
  const action = versus ? (room ? 'data-mine-vs-start' : 'data-go="room"') : 'data-mine-start';
  const participants = versus && !room
    ? setupPanel('人数と相手', setupRow('対局', '<b>ルームで募集</b>'))
    : extraParticipants(on);
  return extraSetupLayout('mine', on, mode + rules + participants, onlyVersus(details.rules) + personalOptions(!versus,on),
    action, {label:versus && !room?'ルームへ':'スタート',modeLabel:versus?'みんなで遊ぶ':undefined});
 }
 function start() {
  if (canStartExtraMatch()) onlineMode=true;
  if (onlineMode && !canStartExtraMatch()) return;
  const seed=crypto.getRandomValues(new Uint32Array(1))[0];
  board=new Board(level,seed);started=0;elapsed=0;flagMode=personal.firstFlag;history=[];lastVersion=0;matchId=`${Date.now()}-${seed}`;
  go('minePlay');if(onlineMode)publish();
 }
 function publish(){if(!onlineMode||!board||netApi?.role!=='host')return;netApi.writeState({mine:{id:matchId,phase:'playing',level,seed:board.seed,version:lastVersion,board:board.snapshot()}}).catch(e=>console.warn('[Mine]',e));}
 function remote(state){const s=state?.mine;if(!s||s.phase!=='playing'){if(onlineMode&&S.screen==='minePlay'&&netApi?.role==='guest')go('menu');return;}if(netApi?.role==='host'||s.id===ignoreId)return;if(!LEVELS[s.level]||!Number.isInteger(s.seed)||!Number.isInteger(s.version))return;if(s.id!==matchId){onlineMode=true;matchId=s.id;level=s.level;board=new Board(level,s.seed);lastVersion=-1;started=performance.now();elapsed=0;flagMode=personal.firstFlag;S.screen='minePlay';render();}if(s.version<=lastVersion)return;try{board.restore(s.board);lastVersion=s.version;redraw();}catch(e){console.warn('[Mine] invalid shared board',e);}}
 function actionFromGuest(act){if(netApi?.role!=='host'||!onlineMode||!board||act.id!==matchId)return;if(!['open','flag','undo'].includes(act.move)||!Number.isInteger(act.cell))return;if(act.move==='undo')undo();else move(act.cell,act.move==='flag');}
 function undo(){if((onlineMode&&netApi?.role!=='host')||!history.length||board?.status!=='lost')return;const snap=history.pop();board=new Board(level,board.seed);board.restore(snap);lastVersion++;publish();redraw();}
 function requestUndo(){if(!onlineMode||netApi?.role==='host')undo();else netApi?.sendAction({type:'MINE',id:matchId,move:'undo',cell:0}).catch(e=>console.warn('[Mine]',e));}
 function stop(){if(onlineMode&&netApi?.role==='host')netApi.writeState({mine:null}).catch(()=>{});else if(onlineMode)ignoreId=matchId;board=null;matchId=null;onlineMode=false;history=[];}
 function cell(i){const code=board.code(i),content=code===20?'⚑':code===11||code===12?'✹':code===9||code===0?'':code;return `<button class="mine-cell ${code===9?'hidden':code===20?'flag':code===11||code===12?'mine':'open'}" data-mine-cell="${i}" data-code="${code}" aria-label="${i+1}番のマス">${content}</button>`;}
 const boardStatus = () => ({playing:'安全なマスを開いてください',won:'クリア！',lost:'地雷を踏みました'})[board.status];
 function playHtml() {
  if (!board) return '';
  const members = onlineMode ? activeMembers() : [{slot:0,name:meName()}];
  const seats = `<div class="seats">${members.map(p=>`<div class="seat"><i class="dot" style="background:${SEAT_COLORS[p.slot]}"></i><span class="nm">${esc(p.name)}</span></div>`).join('')}</div>`;
  const tap = seg('mine:tap',[['open','開く'],['flag','旗']],flagMode?'flag':'open');
  const content = setupPanel('操作',setupRow('マスの操作',tap)+setupRow('地雷',`<b>${board.mines}個</b>`)+setupRow('進捗',`<b id="mineSidePercent">${board.percent}%</b>`));
  const actions = ruleButton('mine')+`<button class="btn" data-mine-undo ${board.status==='lost'?'':'hidden'}>${ic('undo')}待った</button>`;
  const side = playSide({seats,status:`<div class="status" id="mineStatus">${boardStatus()}</div>`,actions,on:onlineMode,content});
  return `<div class="screen"><div class="stage mine-stage">
    ${playHeader('マインスイーパー',onlineMode?'みんなで遊ぶ・協力':'ひとりで遊ぶ','data-mine-exit')}
    <div class="mine-boardwrap"><div id="boardwrap" class="mine-board" style="--mine-cols:${board.w}">${board.opened.map((_,i)=>cell(i)).join('')}</div></div>
    <div class="mine-foot"><span>🚩 <b id="mineFlags">${board.mines-board.flags.filter(Boolean).length}</b></span><span id="mineTime">0秒</span><span id="minePercent">${board.percent}%</span></div>
    ${playGear()}<div class="cutlayer" id="cutlayer"></div></div>${side}</div>`;
 }
 function redraw(){if(S.screen!=='minePlay'||!board)return;board.opened.forEach((_,i)=>{const e=document.querySelector(`[data-mine-cell="${i}"]`);if(e&&+e.dataset.code!==board.code(i))e.outerHTML=cell(i);});const undoButton=$('[data-mine-undo]');if(undoButton)undoButton.hidden=board.status!=='lost';const status=$('#mineStatus');if(status)status.textContent=boardStatus();const f=document.getElementById('mineFlags');if(f)f.textContent=board.mines-board.flags.filter(Boolean).length;const p=document.getElementById('minePercent');if(p)p.textContent=board.percent+'%';const sp=document.getElementById('mineSidePercent');if(sp)sp.textContent=board.percent+'%';const t=document.getElementById('mineTime');if(t)t.textContent=Math.floor((board.status==='playing'&&started?performance.now()-started:elapsed)/1000)+'秒';}
 function move(i,flag=flagMode){if(!board||board.status!=='playing'||!Number.isInteger(i)||i<0||i>=board.mine.length)return;const f=flag;if(onlineMode&&netApi?.role==='guest'){netApi.sendAction({type:'MINE',id:matchId,move:f?'flag':'open',cell:i}).catch(e=>console.warn('[Mine]',e));return;}const before=board.status,snap=board.snapshot();if(f){board.flag(i);sfx.play('TAP',{volume:.3});}else{if(board.opened[i])board.chord(i);else{if(!board.placed)started=performance.now();board.open(i);}sfx.play('CARD_FLIP',{volume:.3});}history.push(snap);if(history.length>30)history.shift();if(onlineMode){lastVersion++;publish();}if(before!==board.status){elapsed=performance.now()-started;cut({text:board.status==='won'?'完成！':'残念！',tone:'felt',ms:1400});if(board.status==='won'&&!onlineMode){const stats=store.get('stats',{}),v=stats.solo_mine||[0];v[0]++;stats.solo_mine=v;store.set('stats',stats);}}redraw();}
 setInterval(()=>{if(S.screen==='minePlay'&&board?.status==='playing'&&started)redraw();},1000);
 return{setup,setupHtml,setMode,start,playHtml,move,exit,personal,personalOptions,setPersonal,remote,actionFromGuest,requestUndo,stop,Board,LEVELS,get level(){return level},set level(v){if(Object.hasOwn(LEVELS,v)){level=v;store.set('mineCoopLevel',v);}},get flagMode(){return flagMode},set flagMode(v){flagMode=!!v},get board(){return board}};
})();
