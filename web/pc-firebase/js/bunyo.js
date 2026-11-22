'use strict';
/* ぶにょぶにょ: 規則(盤 6×12・4個つながると消える・連鎖・お邪魔)と、1枚の盤の動き、CPU。
   画面の並び・対戦・先取は falling-match.js。描き方と音は falling-fx.js。 */
const bunyoGame = (() => {
  const W = 6, H = 12, C = ['r','b','g','y','p'];
  const OFFS = [[0,-1],[1,0],[0,1],[-1,0]];   // 向き 0:子が上 1:右 2:下 3:左
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* ------------------------------------------------ 規則(画面に依存しない) */
  const emptyCells = () => Array.from({length:H}, () => Array(W).fill(null));
  function groupsOf(cells) {
    const seen = new Set(), out = [];
    for (let y=0;y<H;y++) for (let x=0;x<W;x++) {
      const k = cells[y][x]; if (!k || k==='n' || seen.has(y*W+x)) continue;
      const q=[[x,y]], g=[]; seen.add(y*W+x);
      while (q.length) { const [cx,cy]=q.pop(); g.push(cy*W+cx);
        for (const [dx,dy] of OFFS) { const nx=cx+dx, ny=cy+dy; if (nx<0||nx>=W||ny<0||ny>=H||seen.has(ny*W+nx)||cells[ny][nx]!==k) continue; seen.add(ny*W+nx); q.push([nx,ny]); } }
      if (g.length>=4) out.push(g);
    }
    return out;
  }
  /* 消えた粒の隣のお邪魔も一緒に消える */
  function popSet(cells, groups) {
    const set = new Set(groups.flat());
    for (const i of [...set]) { const x=i%W, y=Math.floor(i/W);
      for (const [dx,dy] of OFFS) { const nx=x+dx, ny=y+dy; if (nx>=0&&nx<W&&ny>=0&&ny<H&&cells[ny][nx]==='n') set.add(ny*W+nx); } }
    return set;
  }
  function gravity(cells) {
    for (let x=0;x<W;x++) { let to=H-1; for (let y=H-1;y>=0;y--) { const k=cells[y][x]; if (!k) continue; if (to!==y) { cells[to][x]=k; cells[y][x]=null; } to--; } }
  }
  /* 連鎖を最後まで進める(CPU の読みと試験用)。返り値: 段数と各段で消えた数 */
  function simulate(cells) {
    const steps=[];
    for (;;) { const g=groupsOf(cells); if (!g.length) break; const set=popSet(cells,g);
      for (const i of set) cells[Math.floor(i/W)][i%W]=null; gravity(cells); steps.push(set.size); }
    return steps;
  }
  const chainPoints = steps => steps.reduce((n,s,k)=>n+s*10*(k+1),0);
  const chainAttack = (steps, allClear) => steps.length ? Math.min(24, Math.floor(steps.reduce((n,s,k)=>n+s*(k+1),0)/3) + (allClear?6:0)) : 0;
  function makeRng(seed) { let s=seed>>>0; return () => { s=(Math.imul(s,1664525)+1013904223)>>>0; return C[(s>>>16)%C.length]; }; }
  const landRow = (cells,x) => { let y=H-1; while (y>=0 && cells[y][x]) y--; return y; };

  /* ------------------------------------------------ 1枚の盤 */
  class Board {
    constructor(o) {
      Object.assign(this, {seed:o.seed, me:!!o.me, cpu:o.cpu||null, hooks:o.hooks||{}, rand:makeRng(o.seed)});
      this.cells = emptyCells(); this.score = 0; this.maxChain = 0; this.chain = 0; this.over = false; this.garbage = 0; this.busy = false; this.gen = 0;
      this.queue = [[this.rand(),this.rand()],[this.rand(),this.rand()],[this.rand(),this.rand()]];
      this.st = {cells:this.cells, fallers:[], land:new Map(), pop:null, pair:null, markers:[]};
      this.disp = null; this.lastMove = 0;
      this.spawn();
    }
    get next() { return this.queue.slice(0,2); }
    places(p=this.pair) { return [[p.x,p.y],[p.x+OFFS[p.dir][0],p.y+OFFS[p.dir][1]]]; }
    fits(p) { return this.places(p).every(([x,y])=>x>=0&&x<W&&y<H&&(y<0||!this.cells[y][x])); }
    spawn() {
      const [a,b] = this.queue.shift(); this.queue.push([this.rand(),this.rand()]);
      this.pair = {x:2,y:0,dir:0,a,b}; this.pairId=(this.pairId||0)+1;
      this.disp = {x:2,y:-.6,ang:0,target:0};
      if (!this.fits(this.pair)) { this.pair=null; this.finish(); return; }
      this.updateMarkers(); this.dirty(); this.hooks.next?.(this);
      if (this.cpu) this.cpu.plan(this);
    }
    dirty() { this.st.dirty = true; }
    canAct() { return !this.stopped&&!this.over && !this.busy && this.pair; }
    snd(name,...a) { if (this.me) FSND[name](...a); }
    move(dx) {
      if (!this.canAct()) return false; const p={...this.pair,x:this.pair.x+dx};
      if (!this.fits(p)) return false; this.pair=p; this.snd('bMove'); this.updateMarkers(); this.dirty(); return true;
    }
    /* 回す: 壁や床に当たる時は反対へずらす。狭い所では上下を入れ替える */
    rotate(r=1) {
      if (!this.canAct()) return false;
      const dir=(this.pair.dir+r+4)%4, base={...this.pair,dir};
      const tries=[base,{...base,x:base.x-OFFS[dir][0]},{...base,y:base.y-OFFS[dir][1]}];
      let ok=tries.find(p=>(p.x!==this.pair.x||p.y!==this.pair.y||p===base)&&this.fits(p));
      let turn=r;
      if (!ok) { const flip={...this.pair,dir:(this.pair.dir+2)%4}; const f2=[flip,{...flip,y:flip.y-OFFS[flip.dir][1]}].find(p=>this.fits(p)); if (f2) { ok=f2; turn=2*r; } }
      if (!ok) return false;
      this.pair=ok; this.disp.target+=turn*Math.PI/2; this.snd('bRotate'); this.updateMarkers(); this.dirty(); return true;
    }
    soft() { if (!this.canAct()) return false; const p={...this.pair,y:this.pair.y+1}; if (this.fits(p)) { this.pair=p; this.dirty(); return true; } this.lock(); return false; }
    hard() { if (!this.canAct()) return; while (this.fits({...this.pair,y:this.pair.y+1})) this.pair.y++; this.lock(); }
    tick() { if (this.canAct()) this.soft(); }
    updateMarkers() {
      const p=this.pair; if (!p) { this.st.markers=[]; return; }
      const [[ax],[bx,by]]=this.places(p);
      if (ax===bx) { const y=landRow(this.cells,ax); const top=by<p.y; this.st.markers=[{x:ax,y:top?y:y-1,k:p.a},{x:ax,y:top?y-1:y,k:p.b}]; }
      else this.st.markers=[{x:ax,y:landRow(this.cells,ax),k:p.a},{x:bx,y:landRow(this.cells,bx),k:p.b}];
      this.st.preview=this.popPreview();
    }
    /* 今の位置で落とした時に、最初に消える盤の粒(連鎖で消える粒は含めない)。2色消える時は両方 */
    popPreview() {
      const c=this.cells.map(r=>r.slice()), mine=new Set();
      for (const m of this.st.markers) { if (m.y<0||m.y>=H) return null; c[m.y][m.x]=m.k; mine.add(m.y*W+m.x); }
      const g=groupsOf(c); if (!g.length) return null;
      const set=new Set(); for (const i of popSet(c,g)) if (!mine.has(i)) set.add(i);
      return set.size?set:null;
    }
    finish() { if (this.over) return; this.over=true; this.pair=null; this.st.pair=null; this.st.markers=[]; this.st.preview=null; this.dirty(); this.hooks.over?.(this); }
    receive(n) { this.garbage+=n; this.hooks.notice?.(this); }
    progress() { return {score:this.score, over:this.over,
      board:this.cells.flat().map(v=>v==='n'?'8':v?String(C.indexOf(v)):'.').join(''),
      next:this.next.map(([a,b])=>String(C.indexOf(a))+C.indexOf(b)).join('')}; }
    stop() { this.gen++; this.stopped=true; this.pair=null; this.busy=false; }
    /* 置く → 浮いた粒を落とす → 連鎖 → お邪魔 → 次の組 */
    async lock() {
      if (!this.canAct()) return;
      const gen=this.gen, p=this.pair, places=this.places(p);
      this.pair=null; this.st.pair=null; this.st.markers=[]; this.st.preview=null;
      if (places.some(([,y])=>y<0)) { this.finish(); return; }
      this.busy=true; const now=performance.now();
      places.forEach(([x,y],k)=>{ this.cells[y][x]=k?p.b:p.a; this.st.land.set(y*W+x,now); });
      this.snd('bLand'); this.dirty();
      const anim = this.view && this.view.isConnected && !S.set.reduce;
      if (anim) await sleep(90);
      await this.fall(gen, anim);
      if (gen!==this.gen) return;
      const steps=[]; this.chain=0;
      for (;;) {
        const g=groupsOf(this.cells); if (!g.length) break;
        const set=popSet(this.cells,g); steps.push(set.size); this.chain=steps.length;
        if (anim) await this.popAnim(set, steps.length, gen); if (gen!==this.gen) return;
        for (const i of set) this.cells[Math.floor(i/W)][i%W]=null;
        this.score+=set.size*10*steps.length; this.hooks.score?.(this);
        this.dirty();
        if (anim) await sleep(170);
        await this.fall(gen, anim); if (gen!==this.gen) return;
      }
      this.maxChain=Math.max(this.maxChain,steps.length);
      const allClear=steps.length>0&&this.cells.every(r=>r.every(v=>!v));
      if (allClear) this.hooks.allClear?.(this);
      const attack=chainAttack(steps,allClear), cancel=Math.min(this.garbage,attack);
      this.garbage-=cancel; this.hooks.notice?.(this);
      const sent=attack-cancel;
      if (sent>0) this.hooks.attack?.(this,sent,steps.length);
      await this.dropGarbage(gen, anim); if (gen!==this.gen) return;
      this.busy=false; this.hooks.locked?.(this,sent);
      if (!this.over) this.spawn();
    }
    async dropGarbage(gen, anim) {
      const amount=Math.min(this.garbage,W*3); if (!amount) return;
      this.garbage-=amount; this.hooks.notice?.(this);
      const stack=Array(W).fill(0), fallers=[];
      for (let i=0;i<amount;i++) { const x=i%W, y=landRow(this.cells,x)-stack[x];
        if (y<0) { this.finish(); continue; }
        stack[x]++; fallers.push({x,y:-1-Math.floor(i/W),to:y,k:'n',vy:0}); }
      if (anim) { this.st.fallers=fallers; let crashed=false;
        await this.runFallers(gen, (f)=>{ if(!crashed){ crashed=true; this.snd('crash'); this.shake(); } });
      } else { for (const f of fallers) this.cells[f.to][f.x]='n'; if (fallers.length) this.snd('crash'); }
      this.dirty();
    }
    /* 浮いた粒を落とす。つながっていた相手とは伸びてから切れる */
    async fall(gen, anim) {
      const moves=[];
      for (let x=0;x<W;x++) { let to=H-1; for (let y=H-1;y>=0;y--) { const k=this.cells[y][x]; if (!k) continue; if (to!==y) moves.push({x,from:y,to,k}); to--; } }
      if (!moves.length) return;
      if (!anim) { gravity(this.cells); this.dirty(); return; }
      const moving=new Set(moves.map(m=>m.from*W+m.x));
      for (const m of moves) { m.link=null; if (m.k==='n') continue;
        for (const dx of [-1,1]) { const xx=m.x+dx; if (xx>=0&&xx<W&&this.cells[m.from][xx]===m.k&&!moving.has(m.from*W+xx)) { m.link={x:xx,y:m.from}; break; } } }
      for (const m of moves) this.cells[m.from][m.x]=null;
      this.st.fallers=moves.map(m=>({x:m.x,y:m.from,to:m.to,k:m.k,vy:0,link:m.link}));
      await this.runFallers(gen, ()=>this.snd('bLand'));
      if (anim) await sleep(110);
    }
    runFallers(gen, onLand) {
      return new Promise(res=>{ let last=performance.now();
        const step=now=>{ if (gen!==this.gen) { this.st.fallers=[]; return res(); }
          const dt=Math.min(.05,(now-last)/1000); last=now; let landed=false;
          for (const f of this.st.fallers) { f.vy=Math.min(20,f.vy+70*dt); f.y+=f.vy*dt;
            if (f.y>=f.to) { f.y=f.to; f.done=true; this.cells[f.to][f.x]=f.k; this.st.land.set(f.to*W+f.x,now); landed=true; } }
          if (landed) onLand(); this.st.fallers=this.st.fallers.filter(f=>!f.done); this.dirty();
          this.st.fallers.length?requestAnimationFrame(step):res(); };
        requestAnimationFrame(step); });
    }
    /* 点滅 → 白く光る → はじけて色の粒が飛び散る。「○れんさ!」と、相手への光の玉 */
    async popAnim(set, n, gen) {
      this.st.pop={set,mode:'on'};
      for (let k=0;k<4;k++) { this.st.pop.mode=k%2?'on':'off'; this.dirty(); await sleep(60); if (gen!==this.gen) return; }
      this.st.pop.mode='white'; this.dirty(); await sleep(80); if (gen!==this.gen) return;
      const r=FFX.rel(this.view), c=this.c, pts=[...set].map(i=>({x:r.x+(i%W+.5)*c, y:r.y+(Math.floor(i/W)+.5)*c, k:this.cells[Math.floor(i/W)][i%W]}));
      for (const p of pts) { FFX.glow(p.x,p.y,c*.9,BUNYO_COLORS[p.k][0]); FFX.droplets(p.x,p.y,c,BUNYO_COLORS[p.k][0],BUNYO_COLORS[p.k][1],c<16?4:8); }
      FFX.sparkles(pts[0].x,pts[0].y,c*2,6,{vy:-40,size:c*.14,col:'#F2A91C'});
      this.snd('bPop',n);
      const cx=pts.reduce((s,p)=>s+p.x,0)/pts.length, cy=Math.min(...pts.map(p=>p.y))-c*.3;
      this.hooks.chainText?.(this,n,cx,cy);
      this.st.pop=null;
    }
    shake() { const b=this.frame; if (!b) return; b.classList.remove('fshake'); void b.offsetWidth; b.classList.add('fshake'); }
    /* 画面: 盤・つぎ。描くのは変わった時と動いている時だけ */
    mount(view, frame, c, fid) { this.view=view; this.frame=frame; this.c=c; this.fid=fid; this.dirty(); }
    frameTick(dt) {
      if (!this.view || !this.view.isConnected) return;
      const st=this.st, d=this.disp;
      if (this.pair) {
        d.x+=(this.pair.x-d.x)*Math.min(1,dt*18); d.ang+=(d.target-d.ang)*Math.min(1,dt*22);
        const ty=this.pair.y; d.y=Math.abs(ty-d.y)>2?ty:d.y+(ty-d.y)*Math.min(1,dt*14);
        st.pair={x:d.x,y:d.y,ang:d.ang,a:this.pair.a,b:this.pair.b};
      } else st.pair=null;
      /* 3 枚の層に分けて、変わった層だけ描く(前は組が出ている間、盤全体を毎フレーム描き直していて、スマホで重かった)
         base: 積もった粒・落ちる粒(フィルターで重い。変わった時だけ) / pair: 操作中の組(回る時だけ描き、動きは位置をずらすだけ) / fx: 光る印 */
      let L=this.lay;
      if (!L||L.base.parentNode!==this.view) {
        this.view.innerHTML='<div class="flayer"></div><div class="flayer fpc"></div><div class="flayer fpc"></div>';
        const [a,b,e]=this.view.children; L=this.lay={base:a,pair:b,fx:e,pairKey:null,fxOn:false}; st.dirty=true;
      }
      const c=this.c;
      if (st.dirty || st.fallers.length || st.land.size || st.pop) { st.dirty=false;
        L.base.innerHTML=bunyoSvg({cells:st.cells,fallers:st.fallers,land:st.land,pop:st.pop,noRim:true},c,this.fid); }
      if (st.pair) { const p=st.pair, key=p.a+p.b+p.ang.toFixed(3);
        if (key!==L.pairKey) { L.pairKey=key; L.pair.innerHTML=bunyoSvg({cells:[],pair:{x:0,y:0,ang:p.ang,a:p.a,b:p.b},noRim:true},c,this.fid+'p'); }
        L.pair.style.transform=`translate(${(p.x*c).toFixed(2)}px,${(p.y*c).toFixed(2)}px)`; }
      else if (L.pairKey!==null) { L.pairKey=null; L.pair.innerHTML=''; }
      const fx=st.pair||st.preview||st.markers.length;
      if (fx) { L.fx.innerHTML=bunyoOverlay(st,c); L.fxOn=true; } else if (L.fxOn) { L.fx.innerHTML=''; L.fxOn=false; }
    }
  }

  /* ------------------------------------------------ CPU
     置ける場所(最大22通り)を全部試し、連鎖・つながり・高さで点を付ける。強いと次の組まで読む。 */
  const LEVEL = { weak:{think:650,step:250,depth:1,noise:60,top:5}, normal:{think:380,step:130,depth:1,noise:12,top:2}, strong:{think:170,step:70,depth:2,noise:4,top:1} };
  function placements(cells, a, b) {
    const out=[];
    for (let dir=0;dir<4;dir++) for (let x=0;x<W;x++) {
      const sx=x+OFFS[dir][0]; if (sx<0||sx>=W) continue;
      const c=cells.map(r=>r.slice());
      if (x===sx) { const y=landRow(c,x); if (y<1) continue; c[y][x]=dir===0?a:b; c[y-1][x]=dir===0?b:a; }
      else { const ya=landRow(c,x), yb=landRow(c,sx); if (ya<0||yb<0) continue; c[ya][x]=a; c[yb][sx]=b; }
      out.push({x,dir,cells:c});
    }
    return out;
  }
  function shapeValue(c) {
    let v=0; const hs=[];
    for (let x=0;x<W;x++) hs.push(H-1-landRow(c,x));
    const maxH=Math.max(...hs); v-=maxH*3; v-=Math.max(0,hs[2]-7)*25+Math.max(0,hs[3]-8)*12;
    for (let x=0;x<W-1;x++) v-=Math.abs(hs[x]-hs[x+1])*1.5;
    const seen=new Set();
    for (let y=0;y<H;y++) for (let x=0;x<W;x++) { const k=c[y][x]; if (!k||k==='n'||seen.has(y*W+x)) continue;
      const q=[[x,y]]; let n=0; seen.add(y*W+x);
      while (q.length) { const [cx,cy]=q.pop(); n++; for (const [dx,dy] of OFFS) { const nx=cx+dx, ny=cy+dy; if (nx<0||nx>=W||ny<0||ny>=H||seen.has(ny*W+nx)||c[ny][nx]!==k) continue; seen.add(ny*W+nx); q.push([nx,ny]); } }
      v+=[0,0,4,10][Math.min(n,3)]; }
    return v;
  }
  function evaluate(cells, depthLeft, next, danger) {
    const steps=simulate(cells), n=steps.length;
    let v=shapeValue(cells);
    if (n>=2) v+=n*n*60; else if (n===1) v+=danger?80:-25;
    if (depthLeft>1 && next) { let best=-1e9; for (const pl of placements(cells,next[0],next[1])) best=Math.max(best,evaluate(pl.cells,depthLeft-1,null,danger)); v+=best*.85; }
    return v;
  }
  function cpuDriver(level) {
    const L=LEVEL[level]||LEVEL.normal;
    return { level, plan(board) {
      const gen=board.gen, pair=board.pair, id=board.pairId; if (!pair) return;
      setTimeout(async ()=>{
        if (gen!==board.gen||board.pairId!==id||!board.pair) return;
        const danger=Math.max(...Array.from({length:W},(_,x)=>H-1-landRow(board.cells,x)))>=8;
        const list=placements(board.cells,pair.a,pair.b).map(pl=>({...pl,v:evaluate(pl.cells,L.depth,board.next[0],danger)+(Math.random()-.5)*L.noise}));
        list.sort((p,q)=>q.v-p.v); const pick=list[Math.floor(Math.random()*Math.min(L.top,list.length))]; if (!pick) return board.hard();
        const turn=(pick.dir-board.pair.dir+4)%4;
        for (let i=0;i<(turn===3?1:turn);i++) { if (gen!==board.gen||!board.pair) return; board.rotate(turn===3?-1:1); await sleep(L.step); }
        for (let i=0;i<8&&board.pair&&board.pair.x!==pick.x;i++) { if (gen!==board.gen) return; if (!board.move(Math.sign(pick.x-board.pair.x))) break; await sleep(L.step); }
        if (gen===board.gen&&board.pair) { await sleep(L.step); if (gen===board.gen) board.hard(); }
      }, L.think*(.7+Math.random()*.6));
    }};
  }

  /* ------------------------------------------------ 相手の盤(通信で届いた文字列)と「つぎ」 */
  const decode = s => { const cells=emptyCells(); [...(s||'')].slice(0,W*H).forEach((ch,i)=>{ cells[Math.floor(i/W)][i%W]=ch==='8'?'n':ch==='.'?null:C[+ch]||null; }); return cells; };
  function boardSvg(str, c, fid) { return bunyoSvg({cells:decode(str)}, c, fid); }
  function nextHtml(list, c, side, fid) {
    if (!list||!list.length) return '';
    const big=Math.max(9,Math.round(c*.78)), small=Math.max(7,Math.round(c*.6)), Wd=big+30, r=side!=='left';
    const [p1,p2]=list;
    return `<span class="lbl">NEXT</span><div class="fb-bnext" style="width:${Wd}px;height:${big*2+small*2+50}px">
      <div class="nx first" style="${r?'right':'left'}:0;top:0;width:${big+20}px;height:${big*2+18}px"></div>
      ${p2?`<div class="nx" style="${r?'left':'right'}:0;top:${big*2+26}px;width:${small+20}px;height:${small*2+16}px"></div>`:''}
      <div class="p" style="${r?'right':'left'}:10px;top:9px">${bunyoPairSvg(p1[0],p1[1],big,fid+'a')}</div>
      ${p2?`<div class="p" style="${r?'left':'right'}:10px;top:${big*2+34}px">${bunyoPairSvg(p2[0],p2[1],small,fid+'b')}</div>`:''}</div>`;
  }
  const decodeNext = s => { const out=[]; for (let i=0;i+1<(s||'').length&&out.length<2;i+=2) out.push([C[+s[i]]||'n',C[+s[i+1]]||'n']); return out; };

  /* 画面が出ている間、盤を描き続ける */
  const boards = new Set();
  let lastFrame = performance.now();
  (function loop(now){ const dt=Math.min(.05,(now-lastFrame)/1000); lastFrame=now; for (const b of boards) b.frameTick(dt); requestAnimationFrame(loop); })(performance.now());

  const game = {
    id:'bunyo', name:'ぶにょぶにょ', W, H, interval:700,
    createBoard(o) { const b=new Board({...o, cpu:o.cpuLevel?cpuDriver(o.cpuLevel):null}); boards.add(b); return b; },
    releaseBoards() { for (const b of boards) b.stop(); boards.clear(); },
    boardSvg, nextHtml, decodeNext,
    keys: {ArrowLeft:'left',ArrowRight:'right',ArrowDown:'down',ArrowUp:'rotate',x:'rotate',X:'rotate',z:'rotateL',Z:'rotateL',Control:'rotateL',' ':'drop'},
    act(board, a) { if (a==='left') board.move(-1); else if (a==='right') board.move(1); else if (a==='rotate') board.rotate(1); else if (a==='rotateL') board.rotate(-1); else if (a==='down') board.soft(); else if (a==='drop') board.hard(); },
    keyHelp: [['← →','動かす'],['↑ / X','右に回す'],['Z','左に回す'],['↓','速く落とす'],['スペース','すぐ落とす']],
    /* 試験用 */
    rules: {W,H,groupsOf,popSet,gravity,simulate,chainPoints,chainAttack,makeRng,placements,evaluate}
  };
  return {
    ...game,
    setup: on => fallingMatch.setup('bunyo',on), setupHtml: () => fallingMatch.setupHtml('bunyo'),
    start: () => fallingMatch.start('bunyo'), playHtml: on => fallingMatch.playHtml('bunyo',on),
    key: k => fallingMatch.key('bunyo',k), action: a => fallingMatch.action('bunyo',a)
  };
})();
fallingMatch.register(bunyoGame);
