'use strict';
/* ぶにょぶにょ・パクリスの対局の進め方と画面の並び。
   - ひとりで遊ぶ: 自分の盤だけ。CPU を 1〜3 人入れると対戦(何本先取)。
   - みんなで遊ぶ: 部屋の 2〜4 人で対戦(何本先取)。盤は各自の画面で動かし、盤の文字列・点数・つぎを送る。
   画面: 自分の盤は右、相手は左。盤の下にスコアと名札。操作はキーボード(スマホは盤を指でなぞる)。 */
const fallingMatch = (() => {
  const games = {};
  let setupOnline = false, ses = null, timer, published, received = 0, nextRoundTimer = null;
  const prefs = store.get('fallingSetup', {});
  const preferences = id => ({speed:'standard', preview:true, sabotage:true, cpus:0, level:'normal', target:2, ...prefs[id]});
  const speedScale = {slow:1.55, standard:1, fast:.65};
  const MAX_PLAYERS = 4;
  const CPU_ICONS = ['ねこ','きつね','うさぎ'];
  const CPU_COLORS = ['#C8463C','#3E9B63','#7A5AC0'];
  const LEVELS = [['weak','よわい'],['normal','ふつう'],['strong','つよい']];
  const TARGETS = [['1','1本'],['2','2本'],['3','3本'],['5','5本']];

  /* ------------------------------------------------ 準備画面 */
  function setOption(id, key, value) {
    if (!games[id]) return;
    const p = preferences(id);
    if (key==='speed' && Object.hasOwn(speedScale,value)) p.speed=value;
    else if (key==='cpus' && ['0','1','2','3'].includes(value)) p.cpus=+value;
    else if (key==='level' && LEVELS.some(([v])=>v===value)) p.level=value;
    else if (key==='target' && TARGETS.some(([v])=>v===value)) p.target=+value;
    else if (key==='preview' || key==='sabotage') p[key]=value==='on';
    else return;
    prefs[id]=p; store.set('fallingSetup',prefs); render();
  }
  function setupHtml(id) {
    const p=preferences(id), g=games[id];
    const display=setupRow('次のブロックの表示',seg(id+':preview',[['on','表示'],['off','非表示']],p.preview?'on':'off'));
    const target=setupRow('何本先取',seg(id+':target',TARGETS,String(p.target)),'先に取った人の勝ち');
    if (setupOnline) {
      const many=activeMembers().length>MAX_PLAYERS;
      const left=extraParticipants(true)+(many?`<p class="dimtxt">この遊びは${MAX_PLAYERS}人までです。観戦に回る人を選んでください。</p>`:'')+
        setupPanel('ルール',setupRow('お邪魔を送る',seg(id+':sabotage',[['on','あり'],['off','なし']],p.sabotage?'on':'off'))+target);
      return extraSetupLayout(id,true,left,setupPanel('表示',display)+keyPanel(g),'data-'+id+'-start',many?{enabled:false}:{});
    }
    const cpu=setupRow('CPU',seg(id+':cpus',[['0','なし'],['1','1人'],['2','2人'],['3','3人']],String(p.cpus)),p.cpus?'CPU と対戦します':'ひとりで遊びます');
    const vs=p.cpus?setupRow('CPUの強さ',seg(id+':level',LEVELS,p.level))+target:'';
    const left=setupPanel('人数と相手',cpu+vs)+setupPanel('ルール',setupRow('落ちる速さ',seg(id+':speed',[['slow','ゆっくり'],['standard','標準'],['fast','速い']],p.speed)));
    return extraSetupLayout(id,false,left,setupPanel('表示',display)+keyPanel(g),'data-'+id+'-start',{modeLabel:p.cpus?'CPU と対戦':undefined});
  }
  const keyPanel = g => setupPanel('操作',`<div class="fkeys">${g.keyHelp.map(([k,t])=>`<span><kbd>${esc(k)}</kbd>${esc(t)}</span>`).join('')}</div>
    <p class="dimtxt">スマホは盤を指でなぞります(左右で移動・下へはらって一気に落とす・軽くたたいて回す)。</p>`);
  function setup(id, online) { setupOnline=online; go(id+'Setup'); }
  function start(id) {
    const p=preferences(id);
    if (setupOnline) {
      if (canStartExtraMatch() && activeMembers().length<=MAX_PLAYERS) boardMatch.start(id,true,{turnIndex:0,sabotage:p.sabotage,target:p.target});
    } else startLocal(id);
  }

  /* ------------------------------------------------ ひとり・CPU と対戦 */
  const cpuAv = i => { const k=typeof AV!=='undefined'?AV.findIndex(([n])=>n===CPU_ICONS[i]):-1; return k>=0?`<span class="avatar av">${avSvg(k)}</span>`:`<span class="avatar">C</span>`; };
  function startLocal(id) {
    stopSession();
    const p=preferences(id), n=Math.min(3,p.cpus);
    const players=[{pid:'me',name:meName(),av:meAv(),color:'#3F78C4',me:true}];
    for (let i=0;i<n;i++) players.push({pid:'cpu'+i,name:n>1?`CPU ${i+1}`:'CPU',av:cpuAv(i),color:CPU_COLORS[i],cpu:p.level});
    ses={id, mode:n?'cpu':'solo', players, target:p.target, round:0, wins:{}, speed:speedScale[p.speed]||1, result:null};
    newRound();
    go(id+'Play');
  }
  function newRound() {
    const g=games[ses.id]; g.releaseBoards(); FFX.clear();
    ses.round++; ses.result=null; ses.seed=crypto.getRandomValues(new Uint32Array(1))[0];
    ses.players.forEach((pl,i)=>{ pl.board=g.createBoard({seed:ses.seed, me:pl.me, cpuLevel:pl.cpu, hooks:hooksFor(pl,i)}); pl.board.nextAt=0; });
    ses.gen=(ses.gen||0)+1;
    if (S.screen===ses.id+'Play') render();
  }
  function stopSession() {
    clearTimeout(nextRoundTimer);
    if (ses) { games[ses.id]?.releaseBoards(); ses=null; }
  }
  function again() {
    if (!ses || ses.mode==='online') return;
    if (ses.mode==='cpu' && ses.matchOver) { ses.wins={}; ses.round=0; ses.matchOver=false; }
    newRound();
  }
  function roundEnd() {
    if (!ses || ses.result || ses.mode==='online') return;
    if (ses.mode==='solo') {
      const b=ses.players[0].board;
      ses.result={title:'ゲーム終了',sub:`スコア ${b.score.toLocaleString()}`+(ses.id==='bunyo'?` ・ 最大 ${b.maxChain} れんさ`:` ・ ${b.lines} ライン`),again:true};
      FSND.lose(); refresh(); return;
    }
    const alive=ses.players.filter(p=>!p.board.over);
    if (alive.length>1) return;
    const winner=alive[0]||ses.lastOver; ses.players.forEach(p=>p.board.stop());
    ses.wins[winner.pid]=(ses.wins[winner.pid]||0)+1;
    ses.matchOver=ses.wins[winner.pid]>=ses.target;
    winner.me?FSND.win():FSND.lose();
    ses.result={title:`${winner.me?'あなた':winner.name}の${ses.matchOver?'優勝!':'勝ち'}`,
      sub:ses.matchOver?'Enter キーか「もう一度」で、はじめから':'次の対戦へ…', again:ses.matchOver};
    refresh();
    if (!ses.matchOver) { const gen=ses.gen; nextRoundTimer=setTimeout(()=>{ if (ses&&ses.gen===gen) newRound(); },2800); }
  }

  /* ------------------------------------------------ 盤どうしのつながり(お邪魔・点数・つぎの表示) */
  function hooksFor(pl, i) {
    return {
      attack:(board,n)=>sendAttack(pl,i,n),
      over:board=>{ if (!ses) return; ses.lastOver=pl; if (ses.mode==='online') progress(ses.id); else roundEnd(); refresh(); },
      locked:()=>{ if (ses?.mode==='online'&&pl.me) progress(ses.id); },
      score:board=>{ const e=$('#fbs'+i); if (e) countScore(e,board.score); },
      next:board=>paintNext(pl,i),
      notice:board=>paintNotice(pl,i),
      chainText:(board,n,x,y)=>chainText(n,x,y,board.c),
      allClear:board=>{ const r=FFX.rel(board.view); chainText(0,r.x+r.w/2,r.y+r.h*.4,board.c,'全消し!'); },
      tag:(board,html,kind)=>{ if (pl.me||ses?.players.length===2) showTag(i,html,kind); }
    };
  }
  function sendAttack(pl, i, n) {
    if (!ses) return;
    const from=$('#fbf'+i);
    if (ses.mode==='online') {
      if (pl.me) progress(ses.id,n);
      const target=ses.players.find(p=>!p.me&&!p.remote?.over); const to=target&&$('#fbg'+ses.players.indexOf(target));
      if (from&&to) orb(from,to,n);
      return;
    }
    const others=ses.players.filter(p=>p!==pl&&!p.board.over); if (!others.length) return;
    ses.turn=(ses.turn||0)+1; const target=others[ses.turn%others.length], ti=ses.players.indexOf(target), to=$('#fbg'+ti);
    const deliver=()=>{ if (ses&&!target.board.over) target.board.receive(n); };
    if (from&&to) orb(from,to,n,deliver); else deliver();
  }
  function orb(fromEl, toEl, n, arrive) {
    const a=FFX.rel(fromEl), b=FFX.rel(toEl);
    FSND.orb(); FFX.orb({x:a.x+a.w/2,y:a.y+a.h*.35},{x:b.x+b.w/2,y:b.y+Math.min(b.h/2,40)},{color:ses?.id==='bunyo'?'#FFC2EA':'#7FE8FF',size:6+Math.min(14,n*1.2),dur:520,arrive});
  }
  function countScore(el, to) {
    const from=+el.dataset.v||0; el.dataset.v=to; const t0=performance.now();
    const step=now=>{ const t=Math.min(1,(now-t0)/380); el.innerHTML=scoreHtml(from+(to-from)*fallEase.out(t)); if (t<1&&el.isConnected) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  const scoreHtml = v => { const t=String(Math.max(0,Math.round(v))).padStart(8,'0'), i=t.search(/[1-9]/); return `<span class="z">${i<0?t.slice(0,7):t.slice(0,i)}</span>${i<0?'0':t.slice(i)}`; };
  function paintNext(pl, i) {
    const el=$('#fbn'+i); if (!el||!ses) return; const g=games[ses.id], sz=ses.layout?.sizes[i]; if (!sz) return;
    if (!preferences(ses.id).preview&&pl.me) { el.innerHTML=''; return; }
    const list=pl.board?pl.board.next:g.decodeNext(pl.remote?.next);
    el.innerHTML=g.nextHtml(list,sz.nc,pl.me?'right':'left','fnx'+i);
  }
  function paintNotice(pl, i) {
    const el=$('#fbg'+i); if (!el||!ses) return;
    const n=pl.board?pl.board.garbage:0, sz=ses.layout?.sizes[i];
    if (ses.id==='pakuris') { const b=el.querySelector('b'); if (b&&sz) b.style.height=Math.min(20,n)*sz.c+'px'; return; }
    let r=n; const icons=[]; for (const [size,cls] of [[30,'rock'],[6,'big'],[1,'sm']]) while (r>=size&&icons.length<6) { icons.push(cls); r-=size; }
    el.innerHTML=icons.map(c=>`<i class="${c}"></i>`).join('');
  }
  function chainText(n, x, y, c, text) {
    const st=$('#fallStage'); if (!st) return; const d=document.createElement('div'); d.className='fchain';
    d.style.left=x+'px'; d.style.top=y+'px'; d.style.setProperty('--cs',Math.max(14,Math.round(c*.85+n*1.5))+'px');
    d.innerHTML=text?`<span>${text}</span>`:`<b>${n}</b><span>れんさ!</span>`; st.appendChild(d); setTimeout(()=>d.remove(),1100);
  }
  function showTag(i, html, kind) {
    const box=$('#fbt'+i); if (!box) return; const t=document.createElement('div'); t.className='ftag '+kind; t.innerHTML=html; box.appendChild(t);
    setTimeout(()=>t.classList.add('out'),1900); setTimeout(()=>t.remove(),2220);
  }

  /* ------------------------------------------------ 画面の並び */
  /* 「つぎ」の欄の幅(盤の大きさで変わる) */
  const nextWidth = (id,c) => id==='bunyo' ? Math.max(9,Math.round(c*.78))+30 : c<18 ? Math.max(28,Math.round(c*2.4)) : Math.max(58,Math.min(84,Math.round(c*3.1)));
  /* 1人分の幅: 盤 + (パクリスは目盛り) + つぎ + すき間 */
  const playerWidth = (id,c) => games[id].W*c+4+(id==='pakuris'?11:0)+nextWidth(id,c)+10;
  function sizesFor(id, n) {
    const g=games[id], mob=isMob(), H=g.H, k=n-1;
    const aw=Math.max(260,(mob?window.innerWidth-24:window.innerWidth-340-44)), ah=Math.max(300,(mob?Math.min(window.innerHeight*.72,620):window.innerHeight-96));
    const cap=id==='bunyo'?46:30, fit=test=>{ for (let c=cap;c>6;c--) if (test(c)) return c; return 6; };
    const same=c=>({c,nc:c});
    if (n===1) return {mode:'solo',sizes:[same(fit(c=>playerWidth(id,c)<=aw&&H*c+90<=ah))]};
    if (!mob && n===2) { const c=fit(c=>2*playerWidth(id,c)+150+28<=aw&&H*c+90<=ah); return {mode:'duel',sizes:[same(c),same(c)]}; }
    const winH=44+28*n;
    if (mob) { // スマホ: 相手を上に小さく、自分を下に大きく
      const c2=fit(c=>k*playerWidth(id,c)+14*(k-1)<=aw&&H*c<=ah*.3), c1=fit(c=>playerWidth(id,c)<=aw&&H*c+90<=ah);
      return {mode:'stack',sizes:[same(c1),...Array.from({length:k},()=>same(c2))]};
    }
    const c1=fit(c=>{ const c2=Math.floor(c*.5); return playerWidth(id,c)+k*playerWidth(id,c2)+14*(k-1)+22<=aw&&H*c+90<=ah&&H*c2+70+16+winH<=ah; });
    return {mode:'multi',sizes:[same(c1),...Array.from({length:k},()=>same(Math.floor(c1*.5)))]};
  }
  const star = on => `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.8l2.5 5.2 5.6.8-4.1 3.9 1 5.6L10 14.6 5 17.3l1-5.6L1.9 7.8l5.6-.8z" fill="${on?'#F2C14E':'none'}" stroke="${on?'#FFF3C4':'#8C7652'}" stroke-width="1.3" stroke-linejoin="round"/></svg>`;
  function winHtml(players, wins, target, duel) {
    if (duel) { const [me,op]=players, s=(w,rev)=>{ const a=Array.from({length:target},(_,i)=>star(i<w)); return (rev?a.reverse():a).join(''); };
      return `<div class="fwin"><span class="cap">${target}本先取</span><div class="pill">${s(wins[op.pid]||0,true)}<span class="word">WIN</span>${s(wins[me.pid]||0)}</div></div>`; }
    const order=[...players.slice(1),players[0]];
    return `<div class="fwinboard"><div class="hd"><span class="word">WIN</span><span class="cap">${target}本先取</span></div>${order.map(p=>`<div class="r ${p.me?'me':''}"><i class="d" style="background:${p.color}"></i><span class="nm">${esc(p.name)}</span><span class="st">${Array.from({length:target},(_,k)=>star(k<(wins[p.pid]||0))).join('')}</span></div>`).join('')}</div>`;
  }
  function plateHtml(pl, small) {
    return `<div class="fplate ${small?'small':''}" style="--pc:${pl.color}">${pl.av}<span class="nm">${esc(pl.name)}</span></div>`;
  }
  function boardCol(pl, i, sz, opts={}) {
    const g=games[ses.id], c=sz.c, bw=g.W*c+4, small=c<18;
    const gauge=ses.id==='pakuris'?`<div class="fgauge" id="fbg${i}" style="height:${g.H*c+4}px"><b></b></div>`:'';
    const notice=ses.id==='bunyo'?`<div class="fnotice" id="fbg${i}" style="--nb:${Math.max(7,Math.round(c*.42))}px;height:${Math.max(9,Math.round(c*.5))}px"></div>`:'';
    const board=`<div class="fframe ${pl.me?'mine':''}" id="fbf${i}" style="--c:${c}px;--w:${g.W};--h:${g.H}"><div class="finner" id="fbv${i}"></div></div>`;
    const under=`<div class="funder" style="width:${bw}px"><div class="fscore" id="fbs${i}" data-v="${pl.board?.score??pl.remote?.score??0}" style="font-size:${Math.max(10,Math.min(30,bw*.11)).toFixed(1)}px">${scoreHtml(pl.board?.score??pl.remote?.score??0)}</div>${plateHtml(pl,small)}</div>`;
    const nextW=nextWidth(ses.id,c);
    const next=`<div class="fnext" id="fbn${i}" style="width:${nextW}px;${ses.id==='bunyo'?`margin-top:${Math.max(9,Math.round(c*.5))+4}px`:''}"></div>`;
    const tags=opts.tags?`<div class="ftags" id="fbt${i}"></div>`:'';
    const side=`<div class="fside">${next}${tags}</div>`;
    const col=`<div class="fcol">${notice}<div class="frow">${gauge}${board}</div>${under}</div>`;
    return `<div class="fplayer ${pl.me?'fme':''}">${opts.nextLeft?side+col:col+side}</div>`;
  }
  function arenaHtml() {
    const n=ses.players.length, L=sizesFor(ses.id,n); ses.layout=L;
    const me=ses.players[0], others=ses.players.slice(1), vs=ses.mode!=='solo';
    if (L.mode==='solo') return `<div class="farena solo">${boardCol(me,0,L.sizes[0],{tags:true})}</div>`;
    if (L.mode==='duel') return `<div class="farena duel">${boardCol(others[0],1,L.sizes[1],{tags:true})}<div class="fmid"><div class="fvs">VS</div>${vs?winHtml(ses.players,currentWins(),currentTarget(),true):''}</div>${boardCol(me,0,L.sizes[0],{nextLeft:true,tags:true})}</div>`;
    const opp=`<div class="fopps"><div class="foppsrow">${others.map((p,k)=>boardCol(p,k+1,L.sizes[k+1])).join('')}</div>${winHtml(ses.players,currentWins(),currentTarget(),false)}</div>`;
    return `<div class="farena ${L.mode}">${opp}${boardCol(me,0,L.sizes[0],{nextLeft:true,tags:true})}</div>`;
  }
  const currentWins = () => ses.mode==='online'?(boardMatch.state?.wins||{}):ses.wins;
  const currentTarget = () => ses.mode==='online'?(boardMatch.state?.target||2):ses.target;
  function resultHtml() {
    const r=ses.result; if (!r) return '';
    return `<div class="fresult" role="status"><b>${esc(r.title)}</b>${r.sub?`<span>${esc(r.sub)}</span>`:''}</div>`;
  }
  function sideHtml(id, on) {
    const g=games[id];
    const seats=`<div class="seats">${ses.players.map(p=>`<div class="seat ${p.me?'on':''}"><i class="dot" style="background:${p.color}"></i><span class="nm">${esc(p.name)}</span>${p.board?.over||p.remote?.over?'<small class="dimtxt">終了</small>':''}</div>`).join('')}</div>`;
    let status;
    if (ses.mode==='solo') status=ses.result?'ゲーム終了':'プレイ中';
    else if (ses.mode==='cpu') status=ses.result?(ses.matchOver?'対戦終了':'次の対戦へ'):`第${ses.round}戦`;
    else { const st=boardMatch.state; status=st?.finish?(st.matchOver?'対戦終了':'次の対戦へ'):(ses.players[0]?.board?`第${st?.round||1}戦`:'観戦中'); }
    const again=ses.result?.again?`<button class="btn primary" data-falling-again>もう一度</button>`:'';
    const keys=`<div class="panel fkeyhelp"><h3>操作</h3><div class="fkeys">${g.keyHelp.map(([k,t])=>`<span><kbd>${esc(k)}</kbd>${esc(t)}</span>`).join('')}</div></div>`;
    return playSide({seats,status:`<div class="status" id="fallStatus">${esc(status)}</div>`,actions:ruleButton(id)+again,on,content:keys});
  }
  function playHtml(id, on=false) {
    if (on) syncOnline(id);
    if (!ses || ses.id!==id) { if (!on) { startLocalSilently(id); } }
    if (!ses) return '<div class="screen"></div>';
    const label=ses.mode==='online'?playMode(true):ses.mode==='cpu'?'CPU と対戦':playMode(false);
    queueMicrotask(()=>mountViews());
    return `<div class="screen"><div class="stage fstage f-${id}" id="fallStage">
      ${playHeader(games[id].name,label,on?'data-extra-exit':`data-${id}-exit`)}
      ${arenaHtml()}${resultHtml()}
      ${playGear()}<canvas class="ffx" id="fallFx"></canvas><div class="cutlayer" id="cutlayer"></div></div>${sideHtml(id,on)}</div>`;
  }
  function startLocalSilently(id) {
    const p=preferences(id); stopSession();
    const players=[{pid:'me',name:meName(),av:meAv(),color:'#3F78C4',me:true}];
    ses={id,mode:'solo',players,target:p.target,round:0,wins:{},speed:speedScale[p.speed]||1,result:null};
    const g=games[id]; ses.round=1; ses.seed=crypto.getRandomValues(new Uint32Array(1))[0]; ses.gen=1;
    players[0].board=g.createBoard({seed:ses.seed,me:true,hooks:hooksFor(players[0],0)});
  }
  /* 描いた後に、盤の要素を各盤へ渡す */
  function mountViews() {
    if (!ses) return; const g=games[ses.id], stage=$('#fallStage'); if (!stage) return;
    FFX.attach($('#fallFx'));
    ses.players.forEach((pl,i)=>{
      const view=$('#fbv'+i), frame=$('#fbf'+i), sz=ses.layout.sizes[i]; if (!view) return;
      if (pl.board) pl.board.mount(view,frame,sz.c,'fg'+i);
      else view.innerHTML=g.boardSvg(pl.remote?.board,sz.c,'fm'+i);
      paintNext(pl,i); paintNotice(pl,i);
    });
    bindTouch($('#fbf0'));
  }
  function refresh() {
    if (!ses) return; const scr=ses.mode==='online'?'extraPlay':ses.id+'Play';
    if (S.screen===scr && !$('#sheetwrap')) render();
  }

  /* ------------------------------------------------ 時計(落ちる)・キー・指 */
  setInterval(() => {
    if (!ses || document.hidden) return;
    const scr=ses.mode==='online'?'extraPlay':ses.id+'Play'; if (S.screen!==scr) return;
    const now=performance.now(), g=games[ses.id];
    for (const pl of ses.players) { const b=pl.board; if (!b||b.over||b.stopped) continue;
      const ms=g.interval*(ses.mode==='online'?1:ses.speed);
      if (!b.nextAt) { b.nextAt=now+ms; continue; }
      if (now>=b.nextAt) { b.nextAt=now+ms; b.tick(); } }
  }, 40);
  const myBoard = id => ses && ses.id===id && ses.players[0]?.me ? ses.players[0].board : null;
  const activeFor = id => ses && ses.id===id && (S.screen===id+'Play' || (S.screen==='extraPlay' && boardMatch.state?.game===id));
  function key(id, k) {
    if (!activeFor(id)) return false;
    if (k==='Enter') { if (ses.result?.again) { again(); return true; } return false; }
    const a=games[id].keys[k]; if (!a) return false;
    const b=myBoard(id); if (b && !b.over) { games[id].act(b,a); if (a==='down') b.nextAt=performance.now()+games[id].interval*(ses.mode==='online'?1:ses.speed); }
    return true;
  }
  function action(id, a) { if (!activeFor(id)) return; const b=myBoard(id); if (a==='again') return again(); if (b&&!b.over) games[id].act(b,a); }
  function bindTouch(el) {
    if (!el || el._touch) return; el._touch=true; let s=null;
    el.addEventListener('pointerdown',e=>{ if (e.pointerType==='mouse') return; s={x:e.clientX,y:e.clientY,t:performance.now(),mx:0,moved:false}; el.setPointerCapture?.(e.pointerId); });
    el.addEventListener('pointermove',e=>{ if (!s||!ses) return; const b=myBoard(ses.id), c=ses.layout?.sizes[0]?.c||20; if (!b) return;
      const dx=e.clientX-s.x, steps=Math.trunc(dx/c)-s.mx;
      for (let i=0;i<Math.abs(steps);i++) games[ses.id].act(b,steps>0?'right':'left');
      if (steps) { s.mx+=steps; s.moved=true; } });
    el.addEventListener('pointerup',e=>{ if (!s||!ses) return; const b=myBoard(ses.id), dy=e.clientY-s.y, dt=performance.now()-s.t, c=ses.layout?.sizes[0]?.c||20;
      if (b) { if (dy>c*2.5&&dt<450) games[ses.id].act(b,'drop'); else if (!s.moved&&Math.abs(dy)<c*.6&&dt<300) { const r=el.getBoundingClientRect(); games[ses.id].act(b,e.clientX<r.left+r.width*.35?'rotateL':'rotate'); } }
      s=null; });
    el.addEventListener('pointercancel',()=>{ s=null; });
  }
  let resizeTimer;
  window.addEventListener('resize',()=>{ clearTimeout(resizeTimer); resizeTimer=setTimeout(()=>{ if (ses) refresh(); },180); },{passive:true});

  /* ------------------------------------------------ みんなで遊ぶ(部屋の対戦) */
  function seatPlayer(seat) {
    const p=fbState?.players?.[seat.id], slot=p?.slot??0;
    const av=Number.isInteger(p?.avatar)&&typeof AV!=='undefined'&&AV[p.avatar]?`<span class="avatar av">${avSvg(p.avatar)}</span>`:`<span class="avatar">${esc([...(seat.name||'?')][0])}</span>`;
    return {pid:seat.id,name:p?.name||seat.name,av,color:SEAT_COLORS[slot%6]};
  }
  function syncOnline(id) {
    const st=boardMatch.state; if (!st||st.game!==id) return;
    const key=st.id+':'+(st.round||1);
    if (!ses || ses.mode!=='online' || ses.key!==key) {
      if (ses) games[ses.id]?.releaseBoards();
      const meSeat=st.seats.find(p=>p.id===boardMatch.myId()), g=games[id];
      const others=st.seats.filter(p=>p!==meSeat);
      const players=[];
      if (meSeat) { const pl={...seatPlayer(meSeat),me:true}; players.push(pl); }
      for (const s of others) players.push({...seatPlayer(s),remote:{...s}});
      ses={id,mode:'online',key,players,round:st.round||1,result:null};
      if (meSeat) players[0].board=g.createBoard({seed:st.seed,me:true,hooks:hooksFor(players[0],0)});
      if (!meSeat && players.length) players[0].watch=true;
    }
  }
  function bind(id) {
    boardMatch.register(id,{
      initial(round) { round.seats=round.seats.slice(0,MAX_PLAYERS).map(p=>({...p,score:0,board:'',next:'',sequence:0,garbage:0,over:false}));
        return {seed:crypto.getRandomValues(new Uint32Array(1))[0],finish:false,round:1,wins:{},target:[1,2,3,5].includes(round.target)?round.target:2,matchOver:false}; },
      apply(state, action) {
        if (action.move==='nextRound') {
          if (action.uid!==state.owner||!state.finish||state.matchOver||action.round!==state.round) return false;
          state.round++; state.finish=false; state.winner=null; state.seed=crypto.getRandomValues(new Uint32Array(1))[0];
          state.seats.forEach(p=>Object.assign(p,{score:0,board:'',next:'',sequence:0,garbage:0,over:false})); return true;
        }
        const p=state.seats.find(q=>q.id===action.uid);
        const maximum=id==='bunyo'?72:200;
        if (!p||state.finish||p.over||action.move!=='progress'||action.seq!==p.sequence+1||
          typeof action.board!=='string'||action.board.length!==maximum||!/^[.0-8]+$/.test(action.board)||
          !Number.isSafeInteger(action.score)||action.score<p.score||action.score>p.score+1000000||
          !Number.isInteger(action.attack)||action.attack<0||action.attack>24) return false;
        const others=state.seats.filter(q=>q!==p&&!q.over);
        if (state.sabotage!==false&&action.attack&&others.length) { const enemy=others[(state.turnIndex++)%others.length]; enemy.garbage+=action.attack; }
        p.score=action.score; p.board=action.board; p.sequence=action.seq; p.over=action.over===true;
        if (typeof action.next==='string'&&/^[0-9A-Z]{0,8}$/.test(action.next)) p.next=action.next;
        state.finish=state.seats.filter(q=>!q.over).length<=1;
        if (state.finish) { state.winner=(state.seats.find(q=>!q.over)||p).id; state.wins=state.wins||{};
          state.wins[state.winner]=(state.wins[state.winner]||0)+1; state.matchOver=state.wins[state.winner]>=(state.target||2); }
        return true;
      },
      changed(state) {
        syncOnline(id);
        const key=state.id+':'+(state.round||1);
        if (published?.id!==key) { received=0; published={id:key,seq:0}; clearTimeout(timer); timer=setTimeout(()=>report(id),0); }
        const you=state.seats.find(p=>p.id===boardMatch.myId());
        if (you?.garbage>received) { const b=myBoard(id); if (b) b.receive(you.garbage-received); received=you.garbage; }
        if (state.finish && ses && !ses.result) {
          for (const pl of ses.players) pl.board?.stop();
          const w=state.seats.find(p=>p.id===state.winner), meWin=state.winner===boardMatch.myId();
          meWin?FSND.win():FSND.lose();
          ses.result={title:`${meWin?'あなた':w?.name||''}の${state.matchOver?'優勝!':'勝ち'}`,sub:state.matchOver?'':'次の対戦へ…'};
          if (state.matchOver===false && netApi?.role==='host') { clearTimeout(nextRoundTimer); const r=state.round; nextRoundTimer=setTimeout(()=>{ if (boardMatch.state?.round===r&&boardMatch.state.finish) boardMatch.send('nextRound',{round:r}); },3000); }
        }
      },
      html:()=>playHtml(id,true),
      draw:state=>drawOnline(id,state),
      stop:()=>{ published=null; clearTimeout(timer); clearTimeout(nextRoundTimer); if (ses?.mode==='online') stopSession(); }
    });
  }
  function drawOnline(id, state) {
    if (!ses || ses.mode!=='online') return;
    const g=games[id];
    ses.players.forEach((pl,i)=>{ if (pl.board) return; const s=state.seats.find(q=>q.id===pl.pid); if (!s) return;
      const changed=!pl.remote||pl.remote.board!==s.board||pl.remote.next!==s.next||pl.remote.score!==s.score||pl.remote.over!==s.over;
      pl.remote={...s}; if (!changed) return;
      const v=$('#fbv'+i), sz=ses.layout?.sizes[i]; if (v&&sz) v.innerHTML=g.boardSvg(s.board,sz.c,'fm'+i);
      const sc=$('#fbs'+i); if (sc) countScore(sc,s.score); paintNext(pl,i); });
    // 勝負がついた時・次の回になった時だけ描き直す(描き直しの中から draw が呼ばれても繰り返さない)
    const mark=(state.round||1)+':'+!!state.finish;
    if (ses.drawnMark!==mark) { ses.drawnMark=mark; ses.round=state.round||1; refresh(); }
  }
  function progress(id, garbage=0) {
    if (boardMatch.state?.game!==id||!published) return;
    published.pendingAttack=(published.pendingAttack||0)+garbage;
    clearTimeout(timer); timer=setTimeout(()=>report(id),75);
  }
  function report(id) {
    const state=boardMatch.state;
    if (!published||state?.game!==id||state.finish) return;
    const p=state.seats.find(q=>q.id===boardMatch.myId()), b=myBoard(id);
    if (!p||p.over||!b) return;
    if (p.sequence<published.seq) {
      if (Date.now()-published.sentAt>=1200) { published.sentAt=Date.now(); boardMatch.send('progress',published.outstanding); }
      clearTimeout(timer); timer=setTimeout(()=>report(id),120); return;
    }
    const pr=b.progress();
    if (pr.board===p.board&&pr.over===p.over&&pr.score===p.score&&!published.pendingAttack) return;
    published.seq++;
    const attack=Math.min(24,published.pendingAttack||0); published.pendingAttack=0;
    published.outstanding={...pr,attack,seq:published.seq}; published.sentAt=Date.now();
    boardMatch.send('progress',published.outstanding);
    clearTimeout(timer); timer=setTimeout(()=>report(id),150);
  }

  function register(game) { games[game.id]=game; bind(game.id); }
  function leave() { stopSession(); }
  return {register, setup, setupHtml, setOption, start, playHtml, key, action, again, leave, progress,
    linked:id=>boardMatch.state?.game===id, get session(){ return ses; }};
})();
