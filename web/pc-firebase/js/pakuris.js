'use strict';
/* パクリス: 規則(盤 10×20・7種のブロック・回転・Tスピン・BACK to BACK・REN・お邪魔)と、1枚の盤の動き、CPU。
   画面の並び・対戦・先取は falling-match.js。描き方と音は falling-fx.js。 */
const pakurisGame = (() => {
  const W = 10, H = 20, TYPES = ['I','O','T','S','Z','J','L'], LOCK_MS = 500;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  /* 向き0の形(左上を原点、x 右・y 下)。I は 4×4、O は真ん中2列、ほかは 3×3 の中で回す */
  const BASE = {I:[[0,1],[1,1],[2,1],[3,1]], O:[[1,0],[2,0],[1,1],[2,1]], T:[[1,0],[0,1],[1,1],[2,1]], S:[[1,0],[2,0],[0,1],[1,1]],
    Z:[[0,0],[1,0],[1,1],[2,1]], J:[[0,0],[0,1],[1,1],[2,1]], L:[[2,0],[0,1],[1,1],[2,1]]};
  const SHAPES = {};
  for (const k of TYPES) { const n=k==='I'?4:3; SHAPES[k]=[BASE[k]]; for (let r=1;r<4;r++) SHAPES[k].push(k==='O'?BASE.O:SHAPES[k][r-1].map(([x,y])=>[n-1-y,x])); }
  /* 壁・床に当たった時にずらす順(本家と同じ。y は下向きに直してある) */
  const up = list => list.map(([x,y])=>[x,-y||0]);
  const KICK = {
    '0>1':up([[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]]), '1>0':up([[0,0],[1,0],[1,-1],[0,2],[1,2]]),
    '1>2':up([[0,0],[1,0],[1,-1],[0,2],[1,2]]),    '2>1':up([[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]]),
    '2>3':up([[0,0],[1,0],[1,1],[0,-2],[1,-2]]),   '3>2':up([[0,0],[-1,0],[-1,-1],[0,2],[-1,2]]),
    '3>0':up([[0,0],[-1,0],[-1,-1],[0,2],[-1,2]]), '0>3':up([[0,0],[1,0],[1,1],[0,-2],[1,-2]])
  };
  const KICK_I = {
    '0>1':up([[0,0],[-2,0],[1,0],[-2,-1],[1,2]]), '1>0':up([[0,0],[2,0],[-1,0],[2,1],[-1,-2]]),
    '1>2':up([[0,0],[-1,0],[2,0],[-1,2],[2,-1]]), '2>1':up([[0,0],[1,0],[-2,0],[1,-2],[-2,1]]),
    '2>3':up([[0,0],[2,0],[-1,0],[2,1],[-1,-2]]), '3>2':up([[0,0],[-2,0],[1,0],[-2,-1],[1,2]]),
    '3>0':up([[0,0],[1,0],[-2,0],[1,-2],[-2,1]]), '0>3':up([[0,0],[-1,0],[2,0],[-1,2],[2,-1]])
  };
  /* 点数・送るお邪魔(今の規則に Tスピン・BACK to BACK を足した) */
  const SCORE = {normal:[0,100,300,500,800], spin:[400,800,1200,1600], mini:[100,200,400]};
  const ATTACK = {normal:[0,0,1,2,3], spin:[0,2,4,6], mini:[0,0,1]};
  const NAMES = ['','シングル','ダブル','トリプル','パクリス'];
  const emptyGrid = () => Array.from({length:H}, () => Array(W).fill(null));
  const cellsOf = p => SHAPES[p.k][p.r].map(([x,y])=>[p.x+x,p.y+y]);
  const fitsIn = (grid,p) => cellsOf(p).every(([x,y])=>x>=0&&x<W&&y<H&&(y<0||!grid[y][x]));
  const filledAt = (grid,x,y) => x<0||x>=W||y>=H||(y>=0&&!!grid[y][x]);
  /* Tスピン: 最後の操作が回転で、Tの中心の斜め4マスのうち3つ以上が埋まっている(壁・床も埋まっている扱い)。
     正面側の2マスが両方埋まっていないと「ミニ」(5番目のずらしで入った時は普通の Tスピン) */
  function spinKind(grid, p, lastRotate) {
    if (p.k!=='T'||!lastRotate) return null;
    const c=[[p.x,p.y],[p.x+2,p.y],[p.x+2,p.y+2],[p.x,p.y+2]].map(([x,y])=>filledAt(grid,x,y));
    if (c.filter(Boolean).length<3) return null;
    const front=[[0,1],[1,2],[2,3],[3,0]][p.r];
    return (c[front[0]]&&c[front[1]])||lastRotate.kick===4 ? 'spin' : 'mini';
  }
  function scoreFor(n, spin, b2b, combo) {
    const base = spin==='spin'?SCORE.spin[n]:spin==='mini'?(SCORE.mini[n]??400):SCORE.normal[n];
    return Math.round(base*(b2b?1.5:1)*(n?combo:1));
  }
  function attackFor(n, spin, b2b, combo, allClear) {
    if (!n) return 0;
    const base = spin==='spin'?ATTACK.spin[n]:spin==='mini'?(ATTACK.mini[n]??1):ATTACK.normal[n];
    return base+(b2b?1:0)+Math.max(0,combo-1)+(allClear?5:0);
  }
  function makeBag(seed) {
    let s=seed>>>0, bag=[];
    const take=()=>{ if(!bag.length){ bag=TYPES.slice(); for(let i=bag.length-1;i>0;i--){ s=(Math.imul(s,1664525)+1013904223)>>>0; const j=(s>>>16)%(i+1); [bag[i],bag[j]]=[bag[j],bag[i]]; } } return bag.pop(); };
    return {take, state:()=>s};
  }

  /* ------------------------------------------------ 1枚の盤 */
  class Board {
    constructor(o) {
      Object.assign(this,{seed:o.seed, me:!!o.me, cpu:o.cpu||null, hooks:o.hooks||{}});
      this.bag=makeBag(o.seed); this.grid=emptyGrid(); this.queue=[this.bag.take(),this.bag.take(),this.bag.take()];
      this.score=0; this.lines=0; this.combo=0; this.b2b=false; this.over=false; this.garbage=0; this.busy=false; this.gen=0;
      this.hide=null; this.shift=null; this.spawn();
    }
    get next() { return this.queue.slice(); }
    spawn() {
      const k=this.queue.shift(); this.queue.push(this.bag.take());
      this.piece={k,r:0,x:3,y:-1}; this.pieceId=(this.pieceId||0)+1; this.lastRotate=null; this.landAt=0; this.resets=0; this.held=false;
      if (!fitsIn(this.grid,this.piece)) { this.piece=null; this.finish(); return; }
      this.draw(); this.hooks.next?.(this);
      if (this.cpu) this.cpu.plan(this);
    }
    canAct() { return !this.stopped&&!this.over&&!this.busy&&this.piece; }
    snd(name,...a) { if (this.me) FSND[name](...a); }
    /* 着地している間に動かす・回すと、着地までの待ち(LOCK_MS)を数え直す(15 回まで。本家と同じ) */
    touched() { if (this.landAt&&this.resets<15) { this.landAt=performance.now(); this.resets++; } }
    /* ホールド: 今のブロックを取っておき、取っておいた物(無ければ次)を出す。1 つのブロックにつき 1 回まで */
    hold() {
      if (!this.canAct()||this.held) return false;
      const k=this.piece.k, prev=this.holdK; this.holdK=k;
      if (prev) { this.piece={k:prev,r:0,x:3,y:-1}; this.pieceId++; this.lastRotate=null; this.landAt=0; this.resets=0; this.spinGlow=false;
        if (!fitsIn(this.grid,this.piece)) { this.piece=null; this.finish(); return true; } this.draw(); }
      else this.spawn();
      this.held=true; this.snd('pRotate'); this.hooks.hold?.(this); return true;
    }
    move(dx) {
      if (!this.canAct()) return false; const p={...this.piece,x:this.piece.x+dx};
      if (!fitsIn(this.grid,p)) return false; this.piece=p; this.lastRotate=null; this.touched(); this.snd('pMove'); this.draw(); return true;
    }
    rotate(d=1) {
      if (!this.canAct()||this.piece.k==='O') return false;
      const from=this.piece.r, to=(from+d+4)%4, table=(this.piece.k==='I'?KICK_I:KICK)[from+'>'+to];
      for (let i=0;i<table.length;i++) { const [dx,dy]=table[i], p={...this.piece,r:to,x:this.piece.x+dx,y:this.piece.y+dy};
        if (!fitsIn(this.grid,p)) continue;
        this.piece=p; this.lastRotate={kick:i}; this.touched();
        const spin=spinKind(this.grid,p,this.lastRotate);
        this.spinGlow=!!spin; spin?this.snd('pSpin'):this.snd('pRotate');
        if (spin&&this.view) { const r=FFX.rel(this.view), c=this.c, [cx,cy]=[p.x+1,p.y+1]; FFX.sparkles(r.x+(cx+.5)*c,r.y+(cy+.5)*c,c*3,8,{vy:-30,size:c*.2,col:'#A24BD6'}); }
        this.draw(); return true; }
      return false;
    }
    soft() { if (!this.canAct()) return false; const p={...this.piece,y:this.piece.y+1}; if (!fitsIn(this.grid,p)) return false; this.piece=p; this.lastRotate=null; this.draw(); return true; }
    ghostDrop(p=this.piece) { let d=0; while (fitsIn(this.grid,{...p,y:p.y+d+1})) d++; return d; }
    hard() {
      if (!this.canAct()) return; const p=this.piece, d=this.ghostDrop();
      if (this.view&&this.view.isConnected&&d>0) { const r=FFX.rel(this.view), c=this.c, cells=cellsOf(p), xs=[...new Set(cells.map(q=>q[0]))], hex=PAKURIS_COLORS[p.k];
        const cols=xs.map(x=>{ const ys=cells.filter(q=>q[0]===x).map(q=>q[1]); return {x:r.x+x*c, top:r.y+(Math.min(...ys)-1)*c, bot:r.y+(Math.min(...ys)+d)*c+c*.5}; });
        const top0=r.y+Math.min(...cells.map(q=>q[1]))*c, top1=top0+d*c, x0=r.x+Math.min(...xs)*c, x1=r.x+(Math.max(...xs)+1)*c;
        FFX.trail(cols,hex,c); FFX.streaks(x0,x1,top0-c,top1+c*.5,c,hex);
        FFX.cellsGlow(cells.map(([x,y])=>({x:r.x+x*c,y:r.y+(y+d)*c,w:c,h:c})),280,hex);
        if (c>=14) FFX.sparkles((x0+x1)/2,top1,x1-x0,8,{vy:-110,size:c*.2,dur:750,col:hex});
        this.bump(); }
      this.piece={...p,y:p.y+d}; if (d>0) this.lastRotate=null; this.snd('pHard'); this.lock();
    }
    /* 落ちる時計。底に着いてもすぐには固めず、LOCK_MS(1 拍)待つ。その間は動かして・回してねじ込める(早送りの時も) */
    tick() {
      if (!this.canAct()) return;
      if (this.soft()) { this.landAt=0; return; }
      const now=performance.now();
      if (!this.landAt) this.landAt=now; else if (now-this.landAt>=LOCK_MS) this.lock();
    }
    finish() { if (this.over) return; this.over=true; this.piece=null; this.draw(); this.hooks.over?.(this); }
    receive(n) { this.garbage+=n; this.hooks.notice?.(this); }
    progress() { return {score:this.score, over:this.over,
      board:this.grid.flat().map(v=>v==='G'?'8':v?String(TYPES.indexOf(v)):'.').join(''), next:this.queue.join('')}; }
    stop() { this.gen++; this.stopped=true; this.piece=null; this.busy=false; }
    async lock() {
      if (!this.canAct()) return;
      const gen=this.gen, p=this.piece, cells=cellsOf(p);
      if (cells.some(([,y])=>y<0)) { this.finish(); return; }
      const spin=spinKind(this.grid,p,this.lastRotate);
      for (const [x,y] of cells) this.grid[y][x]=p.k;
      this.piece=null; this.busy=true; this.spinGlow=false;
      const rows=[]; for (let y=0;y<H;y++) if (this.grid[y].every(Boolean)) rows.push(y);
      const n=rows.length, anim=this.view&&this.view.isConnected&&!S.set.reduce;
      let sent=0;
      if (!n) { this.combo=0; this.snd('pLock'); this.draw(); if (spin) { this.score+=scoreFor(0,spin,false,1); this.hooks.score?.(this); this.hooks.tag?.(this,spin==='mini'?'Tスピン ミニ':'Tスピン','spin'); } }
      else {
        this.combo++; const hard=n===4||!!spin, b2b=hard&&this.b2b; this.b2b=hard;
        this.lines+=n;
        const allClear=this.grid.every((r,y)=>rows.includes(y)||r.every(v=>!v));
        this.score+=scoreFor(n,spin,b2b,this.combo); this.hooks.score?.(this);
        const ren=this.combo-1;
        if (b2b) this.hooks.tag?.(this,'BACK to BACK','b2b');
        if (spin) this.hooks.tag?.(this,spin==='mini'?'Tスピン ミニ':'Tスピン','spin');
        /* 4 段消し: 札(タグ)にはせず、ぶにょぶにょの「れんさ!」と同じく、消えた所に字で小さく出す */
        if (n===4) { if (this.view?.isConnected) { const r=FFX.rel(this.view), c=this.c; this.hooks.word?.(this,'パクリス',r.x+W*c/2,r.y+(rows[0]+2)*c); } }
        else this.hooks.tag?.(this,NAMES[n],'lines');
        if (ren>=1) this.hooks.tag?.(this,`<b>${ren}</b>REN`,'ren');
        if (allClear) this.hooks.tag?.(this,'全消し!','big');
        this.snd('pClear',n,{ren,spin:!!spin,b2b});
        if (anim) {
          this.hide=new Set(rows); this.draw(); const r=FFX.rel(this.view), c=this.c;
          FFX.lineClear(rows.map(y=>r.y+y*c),r.x,r.x+W*c,c,n+(spin?1:0)+(b2b?1:0));
          if (c>=14) FFX.sparkles(r.x+W*c*.5,r.y+rows[0]*c,W*c,6+n*4,{vy:-50,size:c*.2,dur:800});
          if (n===4||spin) FFX.flash(r.x,r.y,W*c,H*c,170,spin?'213,160,255':'255,255,255');
          if (n>=3||spin) this.shakeBoard();
          await sleep(450); if (gen!==this.gen) return;
        }
        const keep=this.grid.filter((_,y)=>!rows.includes(y)), shift={}; let ny=H-1;
        for (let y=H-1;y>=0;y--) { if (rows.includes(y)) continue; if (ny!==y) shift[ny]=ny-y; ny--; }
        this.grid=Array.from({length:n},()=>Array(W).fill(null)).concat(keep); this.hide=null; this.draw(anim?shift:null);
        const attack=attackFor(n,spin,b2b,this.combo,allClear), cancel=Math.min(this.garbage,attack);
        this.garbage-=cancel; sent=attack-cancel; this.hooks.notice?.(this);
        if (sent>0) this.hooks.attack?.(this,sent,rows);
        if (anim) { await sleep(130); if (gen!==this.gen) return; }
      }
      /* お邪魔: 1回に最大8列、下からせり上がる */
      const incoming=Math.min(this.garbage,8);
      if (incoming) {
        for (let i=0;i<incoming;i++) { if (this.grid[0].some(Boolean)) { this.finish(); break; }
          const gap=(this.bag.state()+i)%W; this.grid=this.grid.slice(1).concat([Array.from({length:W},(_,x)=>x===gap?null:'G')]); }
        this.garbage-=incoming; this.hooks.notice?.(this);
        const shift={}; for (let y=0;y<H;y++) shift[y]=-incoming;
        this.draw(anim?shift:null); this.snd('pGarbage'); if (anim) { this.shakeBoard(); await sleep(260); if (gen!==this.gen) return; }
      }
      this.busy=false; this.hooks.locked?.(this,sent);
      if (!this.over) this.spawn();
    }
    bump() { const b=this.frame; if (!b) return; b.classList.remove('fbump'); void b.offsetWidth; b.classList.add('fbump'); }
    shakeBoard() { const b=this.frame; if (!b) return; b.classList.remove('fshake'); void b.offsetWidth; b.classList.add('fshake'); }
    mount(view, frame, c) { this.view=view; this.frame=frame; this.c=c; this.draw(); }
    /* 積もったブロック(変わった時だけ描く)と、落ちているブロック・影(動かすたびに描く)を別の層にする(スマホで重かった) */
    draw(shift) {
      if (!this.view||!this.view.isConnected) return; const c=this.c;
      if (!this.gl||this.gl.parentNode!==this.view) { this.view.innerHTML='<div class="flayer"></div><div class="flayer fpc"></div>'; [this.gl,this.pl]=this.view.children; this.gridKey=null; }
      const key=this.grid.map(r=>r.map(v=>v||'.').join('')).join('')+(this.hide?[...this.hide].join(','):'');
      if (shift||key!==this.gridKey) { this.gridKey=key; let h='';
        this.grid.forEach((row,y)=>{ if (this.hide&&this.hide.has(y)) return;
          row.forEach((k,x)=>{ if (k) h+=pakurisBlock(x,y,k,c,'',shift&&shift[y]?`transform:translateY(${-shift[y]*c}px)`:''); }); });
        this.gl.innerHTML=h;
        if (shift) { const gl=this.gl; requestAnimationFrame(()=>requestAnimationFrame(()=>gl.querySelectorAll('.fblk').forEach(b=>b.style.transform=''))); } }
      let h='';
      if (this.piece) { const p=this.piece, d=this.ghostDrop(), cells=cellsOf(p);
        if (this.me&&d>0) h+=cells.map(([x,y])=>y+d>=0?pakurisBlock(x,y+d,p.k,c,'ghost'):'').join('');
        h+=cells.map(([x,y])=>y>=0?pakurisBlock(x,y,p.k,c,this.spinGlow?'spin':''):'').join(''); }
      this.pl.innerHTML=h;
    }
  }

  /* ------------------------------------------------ CPU
     置ける場所を全部試し、高さ・穴・でこぼこ・消える列で点を付ける。強いと次のブロックまで読む。 */
  const LEVEL = { weak:{think:600,step:170,depth:1,noise:2.2,top:4}, normal:{think:330,step:95,depth:1,noise:.4,top:2}, strong:{think:140,step:45,depth:2,noise:.15,top:1} };
  function drops(grid, k) {
    const out=[];
    for (let r=0;r<(k==='O'?1:4);r++) for (let x=-2;x<W;x++) {
      const p={k,r,x,y:-1}; if (!fitsIn(grid,p)) continue;
      while (fitsIn(grid,{...p,y:p.y+1})) p.y++;
      const cells=cellsOf(p); if (cells.some(([,y])=>y<0)) continue;
      const g=grid.map(row=>row.slice()); for (const [cx,cy] of cells) g[cy][cx]=k;
      const full=g.filter(row=>row.every(Boolean)).length;
      out.push({r,x,grid:full?Array.from({length:full},()=>Array(W).fill(null)).concat(g.filter(row=>!row.every(Boolean))):g,lines:full});
    }
    return out;
  }
  function judge(g, lines) {
    let agg=0, holes=0, bump=0, prev=null, maxH=0;
    for (let x=0;x<W;x++) { let h=0, seen=false;
      for (let y=0;y<H;y++) { if (g[y][x]) { if (!seen) { h=H-y; seen=true; } } else if (seen) holes++; }
      agg+=h; maxH=Math.max(maxH,h); if (prev!==null) bump+=Math.abs(h-prev); prev=h; }
    return -0.51*agg+0.76*lines*(lines>=4?1.6:1)-0.36*holes*1.9-0.18*bump-(maxH>14?(maxH-14)*2:0);
  }
  function cpuDriver(level) {
    const L=LEVEL[level]||LEVEL.normal;
    /* シングルプレイで設定・確認を開いている間は、CPU の手を進めない(app.js の modalPause) */
    const waitUi = async () => { while (typeof modalPause === 'function' && modalPause()) await sleep(200); };
    return { level, plan(board) {
      const gen=board.gen, id=board.pieceId;
      setTimeout(async ()=>{
        if (gen!==board.gen||board.pieceId!==id||!board.piece) return;
        await waitUi(); if (gen!==board.gen||board.pieceId!==id||!board.piece) return;
        const k=board.piece.k, nextK=board.queue[0];
        const list=drops(board.grid,k).map(d=>{ let v=judge(d.grid,d.lines);
          if (L.depth>1) { let best=-1e9; for (const e of drops(d.grid,nextK)) best=Math.max(best,judge(e.grid,e.lines)); v=v*.5+best*.5; }
          return {...d,v:v+(Math.random()-.5)*L.noise}; }).sort((a,b)=>b.v-a.v);
        const pick=list[Math.floor(Math.random()*Math.min(L.top,list.length))]; if (!pick) return board.hard();
        const turn=pick.r;
        if (turn===3) { board.rotate(-1); await sleep(L.step); } else for (let i=0;i<turn;i++) { if (gen!==board.gen||board.pieceId!==id) return; board.rotate(1); await sleep(L.step); }
        for (let i=0;i<12&&board.piece&&board.piece.x!==pick.x;i++) { if (gen!==board.gen||board.pieceId!==id) return; if (!board.move(Math.sign(pick.x-board.piece.x))) break; await sleep(L.step); }
        if (gen===board.gen&&board.pieceId===id) { await sleep(L.step); await waitUi(); if (gen===board.gen&&board.pieceId===id) board.hard(); }
      }, L.think*(.7+Math.random()*.6));
    }};
  }

  /* ------------------------------------------------ 相手の盤と「つぎ」 */
  function boardSvg(str, c) {
    let h=''; [...(str||'')].slice(0,W*H).forEach((ch,i)=>{ if (ch==='.') return; const k=ch==='8'?'G':TYPES[+ch]; if (k) h+=pakurisBlock(i%W,Math.floor(i/W),k,c); });
    return h;
  }
  function nextHtml(list, c) {
    if (!list||!list.length) return '';
    return `<span class="lbl">NEXT</span>`+list.slice(0,3).map((k,i)=>{ const cc=Math.max(4,Math.round(i?c*.45:c*.62)), s=SHAPES[k][0],
      mx=Math.max(...s.map(p=>p[0]))+1, mn=Math.min(...s.map(p=>p[1])), my=Math.max(...s.map(p=>p[1]))+1, mnx=Math.min(...s.map(p=>p[0]));
      return `<div class="nx ${i?'':'first'}" style="height:${(my-mn)*cc+(i?14:22)}px"><div class="mini" style="--c:${cc}px;width:${(mx-mnx)*cc}px;height:${(my-mn)*cc}px">${s.map(([x,y])=>pakurisBlock(x-mnx,y-mn,k,cc)).join('')}</div></div>`; }).join('');
  }
  function holdHtml(k, c, used) {
    const box=Math.round(c*2.6);
    if (!k) return `<span class="lbl">HOLD</span><div class="nx hold" style="height:${box}px"></div>`;
    const cc=Math.max(4,Math.round(c*.62)), s=SHAPES[k][0], mnx=Math.min(...s.map(p=>p[0])), mn=Math.min(...s.map(p=>p[1])), mx=Math.max(...s.map(p=>p[0]))+1, my=Math.max(...s.map(p=>p[1]))+1;
    return `<span class="lbl">HOLD</span><div class="nx hold ${used?'used':''}" style="height:${box}px"><div class="mini" style="--c:${cc}px;width:${(mx-mnx)*cc}px;height:${(my-mn)*cc}px">${s.map(([x,y])=>pakurisBlock(x-mnx,y-mn,k,cc)).join('')}</div></div>`;
  }
  const decodeNext = s => [...(s||'')].filter(k=>TYPES.includes(k)).slice(0,3);

  const boards=new Set();
  const game = {
    id:'pakuris', name:'パクリス', W, H, interval:650,
    createBoard(o) { const b=new Board({...o, cpu:o.cpuLevel?cpuDriver(o.cpuLevel):null}); boards.add(b); return b; },
    releaseBoards() { for (const b of boards) b.stop(); boards.clear(); },
    boardSvg, nextHtml, decodeNext, holdHtml, fastDrop:true,
    keys: {ArrowLeft:'left',ArrowRight:'right',ArrowDown:'down',ArrowUp:'rotate',x:'rotate',X:'rotate',z:'rotateL',Z:'rotateL',Control:'rotateL',' ':'drop',c:'hold',C:'hold',Shift:'hold'},
    act(board, a) { if (a==='left') board.move(-1); else if (a==='right') board.move(1); else if (a==='rotate') board.rotate(1); else if (a==='rotateL') board.rotate(-1); else if (a==='down') board.soft(); else if (a==='drop') board.hard(); else if (a==='hold') board.hold(); },
    keyHelp: [['← →','動かす'],['↑ / X','右に回す'],['Z / Ctrl','左に回す'],['↓','押している間は早送り'],['スペース','一気に落とす'],['C / Shift','ホールド']],
    /* 試験用 */
    rules: {W,H,SHAPES,KICK,KICK_I,fitsIn,cellsOf,spinKind,scoreFor,attackFor,makeBag,drops}
  };
  return {
    ...game,
    setup: on => fallingMatch.setup('pakuris',on), setupHtml: () => fallingMatch.setupHtml('pakuris'),
    start: () => fallingMatch.start('pakuris'), playHtml: on => fallingMatch.playHtml('pakuris',on),
    key: k => fallingMatch.key('pakuris',k), action: a => fallingMatch.action('pakuris',a)
  };
})();
fallingMatch.register(pakurisGame);
