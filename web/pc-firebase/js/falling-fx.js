'use strict';
/* ぶにょぶにょ・パクリスで共有する「光・音・ぷよの描き方」。
   盤の地はメニューと同じ明るい色なので、光は「白い芯＋色のにじみ＋細い色の縁」で描く。
   音は動画を参考に、ブラウザの中で作る(音のファイルは使わない)。 */

const fallEase = { out:t=>1-(1-t)**3, inOut:t=>t<.5?4*t*t*t:1-(-2*t+2)**3/2, in:t=>t*t };
const fallRgba = (hex,a) => { const n=parseInt(hex.slice(1),16); return `rgba(${n>>16},${n>>8&255},${n&255},${a})`; };

/* ---------------------------------------------------------------- 音 */
const FSND = (() => {
  let ctx, master, nbuf;
  function ac() {
    if (!S.set.sound || typeof transientAudio !== 'undefined' && !transientAudio.allowed()) return null;
    const vol = (S.set.master ?? 100) / 100 * (S.set.sfxVol ?? 100) / 100;
    if (vol <= 0) return null;
    if (!ctx) {
      ctx = window.SFXCTX || new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp); comp.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(()=>{});
    if (ctx.state !== 'running') return null;
    master.gain.value = .55 * vol;
    return ctx;
  }
  function env(g,t,a,d,v) { g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(Math.max(v,.0002),t+a); g.gain.exponentialRampToValueAtTime(.0001,t+a+d); }
  function tone({type='sine',f0,f1=f0,dur=.12,vol=.2,a=.004,at=0}) {
    const c=ac(); if(!c) return; const t=c.currentTime+at, o=c.createOscillator(); o.type=type;
    o.frequency.setValueAtTime(f0,t); if(f1!==f0) o.frequency.exponentialRampToValueAtTime(f1,t+dur);
    const g=c.createGain(); env(g,t,a,dur,vol); o.connect(g); g.connect(master); o.start(t); o.stop(t+a+dur+.05);
  }
  function noise({dur=.1,vol=.2,type='bandpass',f0=1000,f1=f0,q=1,a=.003,at=0}) {
    const c=ac(); if(!c) return;
    if(!nbuf){ nbuf=c.createBuffer(1,c.sampleRate,c.sampleRate); const d=nbuf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; }
    const t=c.currentTime+at, s=c.createBufferSource(); s.buffer=nbuf; const f=c.createBiquadFilter(); f.type=type; f.Q.value=q;
    f.frequency.setValueAtTime(f0,t); if(f1!==f0) f.frequency.exponentialRampToValueAtTime(f1,t+dur);
    const g=c.createGain(); env(g,t,a,dur,vol); s.connect(f); f.connect(g); g.connect(master); s.start(t,Math.random()*.4); s.stop(t+a+dur+.05);
  }
  /* 細かいカチカチの粒が集まった乾いた音(ぶにょぶにょを回す音: 約0.05秒、300Hz〜6kHz) */
  function crackle({dur=.05,vol=.6,density=.035,at=0,lo=350,hi=5600}) {
    const c=ac(); if(!c) return; const t=c.currentTime+at, n=Math.round(c.sampleRate*dur);
    const buf=c.createBuffer(1,n,c.sampleRate), d=buf.getChannelData(0);
    for(let i=0;i<n;i++){ const e=Math.min(1,i/(n*.08))*Math.pow(1-i/n,1.3); d[i]=(Math.random()<density?Math.random()*2-1:(Math.random()*2-1)*.07)*e; }
    const s=c.createBufferSource(); s.buffer=buf;
    const hp=c.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=lo;
    const lp=c.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=hi;
    const lp2=c.createBiquadFilter(); lp2.type='lowpass'; lp2.frequency.value=hi;
    const g=c.createGain(); g.gain.value=vol; s.connect(hp); hp.connect(lp); lp.connect(lp2); lp2.connect(g); g.connect(master); s.start(t);
  }
  const semi=n=>2**(n/12), PENT=[0,2,4,7,9,12,14,16,19,21,24,26];
  return {
    /* ぶにょぶにょ: 柔らかく丸い音 */
    bMove(){ tone({type:'triangle',f0:420,dur:.03,vol:.05}); },
    bRotate(){ crackle({}); },
    bLand(){ tone({f0:340,f1:150,dur:.16,vol:.26}); tone({type:'triangle',f0:680,f1:300,dur:.09,vol:.05}); noise({type:'lowpass',f0:500,dur:.05,vol:.07}); },
    bPop(n){ const f=523*semi(PENT[Math.min(n-1,PENT.length-1)]);
      tone({f0:f*.7,f1:f*1.6,dur:.11,vol:.3}); tone({f0:f*2,dur:.26,vol:.08,a:.002}); tone({f0:f*3,dur:.16,vol:.035,a:.002});
      noise({f0:2600,dur:.07,vol:.12,q:.8});
      if(n>=2){ tone({type:'triangle',f0:f*1.26,dur:.18,vol:.07,at:.06}); tone({type:'triangle',f0:f*1.5,dur:.2,vol:.06,at:.11}); }
      if(n>=4){ tone({f0:f*4,dur:.3,vol:.04,at:.14}); noise({type:'highpass',f0:6000,dur:.35,vol:.045,at:.05}); } },
    orb(){ noise({f0:600,f1:3200,dur:.32,vol:.11,q:2}); tone({f0:900,f1:1800,dur:.25,vol:.035}); },
    bThud(){ noise({type:'lowpass',f0:320,dur:.06,vol:.1}); tone({f0:150,f1:60,dur:.08,vol:.08}); },
    /* お邪魔が落ちてきた時の「ドシャーン」 */
    crash(s=1){ tone({f0:120,f1:36,dur:.45,vol:.5*s,a:.003}); noise({type:'lowpass',f0:2600,f1:240,dur:.7,vol:.36*s,a:.004});
      noise({f0:650,dur:.22,vol:.22*s,q:.8}); crackle({dur:.34,vol:.5*s,density:.06,at:.005,hi:7000}); crackle({dur:.2,vol:.3*s,density:.04,at:.13}); },
    /* パクリス: 硬く澄んだ音 */
    pMove(){ tone({type:'square',f0:1500,dur:.012,vol:.025}); },
    pRotate(){ noise({type:'highpass',f0:3500,dur:.018,vol:.16}); tone({type:'square',f0:2200,f1:1600,dur:.03,vol:.045}); },
    pSpin(){ this.pRotate(); tone({type:'sawtooth',f0:420,f1:1700,dur:.16,vol:.05,at:.01}); tone({f0:1700,dur:.18,vol:.05,at:.16}); },
    pHard(){ noise({f0:1800,f1:380,dur:.07,vol:.14}); tone({f0:170,f1:45,dur:.16,vol:.5,at:.02}); noise({type:'lowpass',f0:260,dur:.1,vol:.24,at:.02}); },
    pLock(){ tone({type:'square',f0:900,dur:.02,vol:.045}); noise({type:'highpass',f0:3000,dur:.02,vol:.06}); },
    pClear(n,{ren=0,spin=false,b2b=false}={}){ const f=[0,784,880,988,1175][n]||784;
      noise({type:'highpass',f0:2500,f1:7000,dur:.26+.05*n,vol:.12+.03*n});
      for(const r of [1,2.76,5.4]) tone({f0:f*r,dur:.45,vol:.09/r,a:.002});
      if(n>=3) tone({type:'triangle',f0:f/2,dur:.5,vol:.1});
      if(n>=4){ tone({f0:95,f1:38,dur:.55,vol:.34}); [1,1.26,1.5,2].forEach((m,i)=>tone({type:'triangle',f0:f*m,dur:.32,vol:.07,at:.04*i})); }
      if(spin){ tone({type:'sawtooth',f0:330,f1:990,dur:.22,vol:.05}); [1,1.5,2].forEach((m,i)=>tone({f0:f*m,dur:.25,vol:.05,at:.05*i})); }
      if(ren>=1){ const nf=1047*semi(PENT[Math.min(ren-1,PENT.length-1)]); tone({type:'triangle',f0:nf,dur:.2,vol:.14,at:.02}); tone({f0:nf*2,dur:.15,vol:.05,at:.02}); }
      if(b2b){ tone({f0:f*2,dur:.3,vol:.06,at:.08}); tone({f0:f*2.5,dur:.3,vol:.06,at:.14}); tone({f0:f*3,dur:.3,vol:.05,at:.2}); } },
    pGarbage(){ this.crash(1.05); noise({type:'lowpass',f0:180,dur:.42,vol:.2}); },
    win(){ [0,4,7,12].forEach((n,i)=>tone({type:'triangle',f0:523*semi(n),dur:.3,vol:.12,at:i*.09})); },
    lose(){ [7,4,0].forEach((n,i)=>tone({type:'triangle',f0:392*semi(n),dur:.32,vol:.1,at:i*.12})); }
  };
})();

/* ---------------------------------------------------------------- 光と粒(舞台に重ねたキャンバス) */
const FFX = (() => {
  let cv, cx, dpr=1, items=[], host=null;
  function attach(canvas) { cv=canvas; cx=cv.getContext('2d'); host=cv.parentElement; items=[]; resize(); }
  function resize() { if(!cv) return; const r=host.getBoundingClientRect(); dpr=Math.min(2,window.devicePixelRatio||1);
    cv.width=Math.max(1,Math.round(r.width*dpr)); cv.height=Math.max(1,Math.round(r.height*dpr)); }
  function add(o) { if(!cv||!cv.isConnected||S.set.reduce&&!o.keep) return; o.t0=performance.now()+(o.delay||0); items.push(o); }
  function clear() { items=[]; }
  function loop(now) {
    if (cv && cv.isConnected) {
      cx.setTransform(dpr,0,0,dpr,0,0); cx.clearRect(0,0,cv.width,cv.height);
      items=items.filter(o=>{ const t=(now-o.t0)/o.dur; if(t<0) return true; if(t>=1){ o.end&&o.end(); return false; } o.draw(cx,t,(now-o.t0)/1000); return true; });
    } else if (items.length) { items.forEach(o=>o.end&&o.end()); items=[]; }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  function star(c,x,y,r,a,col) { c.save(); c.globalAlpha=Math.max(0,a); c.translate(x,y); c.fillStyle='#fff'; c.shadowColor=col; c.shadowBlur=r*2.2;
    c.strokeStyle=col; c.lineWidth=Math.max(1,r*.18); c.beginPath();
    for(let i=0;i<8;i++){ const rr=i%2?r*.28:r, an=i*Math.PI/4; c.lineTo(Math.cos(an)*rr,Math.sin(an)*rr); }
    c.closePath(); c.fill(); c.stroke(); c.restore(); }
  /* 舞台の中での要素の位置 */
  function rel(el) { if(!host||!el) return {x:0,y:0,w:0,h:0}; const s=host.getBoundingClientRect(), r=el.getBoundingClientRect(); return {x:r.left-s.left,y:r.top-s.top,w:r.width,h:r.height}; }
  return { attach, resize, clear, add, rel,
    glow(x,y,r,hex,dur=300){ add({dur,draw(c,t){ const rr=r*(.5+1.2*fallEase.out(t)), g=c.createRadialGradient(x,y,0,x,y,rr);
      g.addColorStop(0,`rgba(255,255,255,${1-t})`); g.addColorStop(.3,fallRgba(hex,(1-t)*.75)); g.addColorStop(1,fallRgba(hex,0));
      c.fillStyle=g; c.beginPath(); c.arc(x,y,rr,0,7); c.fill();
      c.strokeStyle=fallRgba(hex,.8*(1-t)); c.lineWidth=Math.max(1,r*.12*(1-t)); c.beginPath(); c.arc(x,y,r*(.6+1.6*fallEase.out(t)),0,7); c.stroke(); }}); },
    droplets(x,y,cell,col,dark,count=8){ for(let i=0;i<count;i++){ const an=-Math.PI/2+(Math.random()-.5)*Math.PI*1.7, sp=cell*(3.2+Math.random()*4.2),
      vx=Math.cos(an)*sp, vy=Math.sin(an)*sp-cell*1.5, g=cell*24, size=cell*(.1+Math.random()*.12), dur=480+Math.random()*200;
      add({dur,draw(c,t,s){ const px=x+vx*s, py=y+vy*s+.5*g*s*s, r=size*(1-.6*t), gr=c.createRadialGradient(px-r*.35,py-r*.4,r*.1,px,py,r);
        gr.addColorStop(0,'#fff'); gr.addColorStop(.35,col); gr.addColorStop(1,dark); c.globalAlpha=1-t*t; c.fillStyle=gr; c.beginPath(); c.arc(px,py,r,0,7); c.fill(); c.globalAlpha=1; }}); } },
    sparkles(x,y,spread,count,{vy=-60,dur=600,size=5,col='#2EB8E6'}={}){ for(let i=0;i<count;i++){ const ox=(Math.random()-.5)*spread, oy=(Math.random()-.5)*spread*.4,
      v=vy*(.5+Math.random()), vx=(Math.random()-.5)*30, sz=size*(.6+Math.random()*.8), d=dur*(.6+Math.random()*.6), delay=Math.random()*120;
      add({dur:d,delay,draw(c,t,s){ star(c,x+ox+vx*s,y+oy+v*s,sz*(1-.5*t),Math.sin(Math.PI*t),col); }}); } },
    orb(from,to,{color='#7FE8FF',size=10,dur=460,arrive}={}){ const mx=(from.x+to.x)/2, my=Math.min(from.y,to.y)-120, trail=[];
      if(!cv||!cv.isConnected||S.set.reduce){ arrive&&setTimeout(arrive,0); return; }
      add({dur,end:arrive,keep:true,draw(c,t){ const u=fallEase.inOut(t), x=(1-u)**2*from.x+2*(1-u)*u*mx+u*u*to.x, y=(1-u)**2*from.y+2*(1-u)*u*my+u*u*to.y;
        trail.push([x,y]); if(trail.length>12) trail.shift();
        trail.forEach(([tx,ty],i)=>{ const a=(i+1)/trail.length; c.globalAlpha=a*.5; c.fillStyle=color; c.beginPath(); c.arc(tx,ty,size*a*.8,0,7); c.fill(); });
        c.globalAlpha=1; const g=c.createRadialGradient(x,y,0,x,y,size*2.2); g.addColorStop(0,'#fff'); g.addColorStop(.3,color); g.addColorStop(1,'rgba(255,255,255,0)');
        c.fillStyle=g; c.beginPath(); c.arc(x,y,size*2.2,0,7); c.fill(); }}); },
    /* 一気に落とした道すじの光の残像(ブロックの色の柱。上から縮みながら消える) */
    trail(cols,hex,cell,dur=340){ add({dur,draw(c,t){ c.save(); const u=fallEase.in(t);
      for(const {x,top,bot} of cols){ const yt=top+(bot-top)*u, h=bot-yt; if(h<=1) continue; const g=c.createLinearGradient(0,yt,0,bot);
        g.addColorStop(0,fallRgba(hex,0)); g.addColorStop(.55,fallRgba(hex,.35*(1-t))); g.addColorStop(1,`rgba(255,255,255,${.95*(1-t)})`);
        c.fillStyle=g; c.shadowColor=hex; c.shadowBlur=cell*.5*(1-t); c.fillRect(x+cell*.06,yt,cell*.88,h);
        c.shadowBlur=0; c.fillStyle=`rgba(255,255,255,${.8*(1-t)})`; c.fillRect(x+cell*.47,yt+h*.25,cell*.06,h*.75); }
      c.restore(); }}); },
    streaks(x0,x1,yTop,yBot,cell,hex='#2EB8E6'){ const n=Math.round((x1-x0)/cell*3); for(let i=0;i<n;i++){ const x=x0+cell*.15+Math.random()*(x1-x0-cell*.3),
      len=(yBot-yTop)*(.35+Math.random()*.6), w=1+Math.random()*2.2, d=260+Math.random()*160;
      add({dur:d,draw(c,t){ const yb=yBot-(yBot-yTop)*.15*t, yt=yb-len*(1-t*.4)-cell*2*t, g=c.createLinearGradient(0,yt,0,yb);
        g.addColorStop(0,fallRgba(hex,0)); g.addColorStop(.6,fallRgba(hex,.55*(1-t))); g.addColorStop(1,`rgba(255,255,255,${1-t})`);
        c.fillStyle=g; c.shadowColor=hex; c.shadowBlur=6; c.fillRect(x-w/2,yt,w,yb-yt); c.shadowBlur=0; }}); } },
    cellsGlow(rects,dur=260,hex='#2EB8E6'){ add({dur,draw(c,t){ c.save(); c.fillStyle=`rgba(255,255,255,${.85*(1-t)})`; c.shadowColor=hex; c.shadowBlur=14*(1-t);
      for(const r of rects) c.fillRect(r.x+1,r.y+1,r.w-2,r.h-2); c.restore(); }}); },
    /* 列消し: 続いた列はひとまとまりの白い帯 → 左から縮み、水色の光が右へ走る */
    lineClear(rows,left,right,cell,k){ const hold=210, sweep=230, tail=200, dur=hold+sweep+tail, w=right-left;
      add({dur,draw(c,t){ const T=t*dur; c.save();
        const ranges=[]; for(const y of [...rows].sort((a,b)=>a-b)){ const r=ranges[ranges.length-1]; if(r&&Math.abs(y-(r.top+r.h))<1) r.h+=cell; else ranges.push({top:y,h:cell}); }
        for(const {top,h} of ranges){ const cy=top+h/2;
          if(T<hold){ const p=.9+.1*Math.sin(T/30); c.fillStyle=`rgba(255,255,255,${p})`; c.shadowColor='#2EB8E6'; c.shadowBlur=10+6*k; c.fillRect(left,top+1,w,h-2);
            c.shadowBlur=0; c.strokeStyle='rgba(46,184,230,.75)'; c.lineWidth=1.5; c.strokeRect(left+.75,top+1.75,w-1.5,h-3.5); }
          else if(T<hold+sweep){ const u=fallEase.inOut((T-hold)/sweep), xl=left+w*u;
            c.fillStyle=`rgba(214,196,255,${.4*(1-u)})`; c.fillRect(left,top+1,xl-left,h-2);
            c.fillStyle='#fff'; c.shadowColor='#2EB8E6'; c.shadowBlur=10+6*k; c.fillRect(xl,top+1,right-xl,h-2); c.shadowBlur=0;
            const rx=cell*(1.4+.55*k), ry=h/2+cell*(.45+.12*k), g=c.createRadialGradient(xl,cy,0,xl,cy,Math.max(rx,ry));
            g.addColorStop(0,'rgba(255,255,255,.95)'); g.addColorStop(.3,'rgba(46,184,230,.85)'); g.addColorStop(1,'rgba(46,184,230,0)');
            c.fillStyle=g; c.beginPath(); c.ellipse(xl,cy,rx,ry,0,0,7); c.fill(); }
          else { const u=(T-hold-sweep)/tail, rx=cell*(1.9+.8*k)*(1+u*.8), ry=(h/2+cell*.6)*(1+u*.3), ex=right+cell*.4+u*cell*2, g=c.createRadialGradient(ex,cy,0,ex,cy,Math.max(rx,ry));
            g.addColorStop(0,`rgba(255,255,255,${.9*(1-u)})`); g.addColorStop(.35,`rgba(46,184,230,${.75*(1-u)})`); g.addColorStop(1,'rgba(46,184,230,0)');
            c.fillStyle=g; c.beginPath(); c.ellipse(ex,cy,rx,ry,0,0,7); c.fill(); } }
        c.restore(); }}); },
    flash(x,y,w,h,dur=150,color='255,255,255'){ add({dur,draw(c,t){ c.fillStyle=`rgba(${color},${.55*(1-t)})`; c.fillRect(x,y,w,h); }}); }
  };
})();

/* ---------------------------------------------------------------- ぶにょぶにょの描き方
   同じ色の粒を1つの層にまとめ、ぼかし→しきい値でつなげる(くびれが自然にできる)。
   かたまりの厚みに光を当てて丸みとつやを出す。目は上から描く。 */
const BUNYO_COLORS = { r:['#F0364F','#7E0A1E'], b:['#2E7BEA','#0F3C86'], g:['#3DC43A','#0E6A1A'], y:['#F6BE1C','#8F5C04'], p:['#9C48E2','#4A1585'], n:['#D9D4CB','#7C766B'], w:['#FFFFFF','#B9B0A3'] };
const BUNYO_SHAPE = 'M-.47 .04C-.47 -.3 -.27 -.45 0 -.45C.27 -.45 .47 -.3 .47 .04C.47 .36 .32 .47 0 .47C-.32 .47 -.47 .36 -.47 .04Z';
const BUNYO_DROP = 'M0 -.62C.12 -.48 .44 -.24 .43 .08C.42 .36 .28 .47 0 .47C-.28 .47 -.42 .36 -.43 .08C-.44 -.24 -.12 -.48 0 -.62Z';
const bunyoTf = (px,py,c,sx=1,sy=1) => `translate(${px.toFixed(2)} ${(py+.47*c).toFixed(2)}) scale(${(c*sx).toFixed(3)} ${(c*sy).toFixed(3)}) translate(0 -.47)`;
function bunyoFilter(id,c) {
  // 光の計算(feDiffuseLighting・feSpecularLighting)は使わない。グラフィックの機能が使えない環境(Edge など)で
  // 描き直すたびに非常に重くなり、画面が固まったため。丸みは右下の内側の影で出し、つやは bunyoFace の白い楕円で出す。
  const blur=c*.07, sh=c*.09;
  return `<filter id="${id}" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
  <feGaussianBlur in="SourceGraphic" stdDeviation="${blur}" result="b"/><feColorMatrix in="b" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 26 -12" result="shape"/>
  <feOffset in="shape" dx="${-sh}" dy="${-sh}" result="o"/><feComposite in="shape" in2="o" operator="out" result="rim"/>
  <feGaussianBlur in="rim" stdDeviation="${c*.06}" result="rimb"/><feFlood flood-color="#000" flood-opacity=".32" result="fl"/>
  <feComposite in="fl" in2="rimb" operator="in" result="d"/><feComposite in="d" in2="shape" operator="in" result="d2"/>
  <feMerge><feMergeNode in="shape"/><feMergeNode in="d2"/></feMerge></filter>`;
}
function bunyoFace(px,py,c,sx,sy,k,white) {
  let s=`<g transform="${bunyoTf(px,py,c,sx,sy)}"><ellipse cx="-.13" cy="-.27" rx=".14" ry=".07" fill="#fff" opacity="${white?.4:.8}" transform="rotate(-20 -.13 -.27)"/><circle cx=".08" cy="-.33" r=".03" fill="#fff" opacity=".7"/>`;
  if (c < 14) { // 小さな盤は目を簡単に
    for (const d of [-1,1]) s+=`<ellipse cx="${d*.17}" cy=".06" rx=".13" ry=".16" fill="#fff"/><circle cx="${d*.15}" cy=".1" r=".07" fill="${k==='n'?'#5E574C':BUNYO_COLORS[k][1]}"/>`;
    return s+'</g>';
  }
  if (k==='n') return s+[-1,1].map(d=>{ const ex=d*.165, ey=.06; return `<ellipse cx="${ex}" cy="${ey}" rx=".13" ry=".16" fill="#fff" stroke="#A79F92" stroke-width=".022"/>`+
    `<ellipse cx="${ex-d*.02}" cy="${ey+.045}" rx=".07" ry=".09" fill="#5E574C"/><circle cx="${ex-d*.04}" cy="${ey+.01}" r=".028" fill="#fff"/>`; }).join('')+'</g>';
  for (const d of [-1,1]) { const ex=d*.165, ey=.05;
    s+=`<ellipse cx="${ex}" cy="${ey}" rx=".135" ry=".175" fill="#fff" ${white?'stroke="#B3AA9C" stroke-width=".025"':''} transform="rotate(${d*-8} ${ex} ${ey})"/>`;
    if (!white) s+=`<ellipse cx="${ex-d*.025}" cy="${ey+.045}" rx=".075" ry=".105" fill="${BUNYO_COLORS[k][1]}"/><circle cx="${ex-d*.045}" cy="${ey+.005}" r=".028" fill="#fff"/>`; }
  return s+'</g>';
}
function bunyoSquash(t) {
  const K=[[0,1.22,.74],[.28,.9,1.13],[.58,1.05,.96],[1,1,1]];
  for (let i=1;i<K.length;i++) if (t<=K[i][0]) { const a=K[i-1], b=K[i], u=(t-a[0])/(b[0]-a[0]); return [a[1]+(b[1]-a[1])*u, a[2]+(b[2]-a[2])*u]; }
  return [1,1];
}
const toWhite = (hex,k) => { const n=parseInt(hex.slice(1),16), m=v=>Math.round(v+(255-v)*k); return `rgb(${m(n>>16)},${m(n>>8&255)},${m(n&255)})`; };
/* st: {cells[H][W], pop:{set,mode}, land:Map, fallers:[], pair:{x,y,ang,a,b}, markers:[]} */
function bunyoSvg(st,c,fid,W=6,H=12) {
  const layers=new Map(), now=performance.now(); let faces='', top='';
  const L=(key,fill)=>{ if(!layers.has(key)) layers.set(key,{fill,items:[]}); return layers.get(key).items; };
  const at=(x,y)=>(y>=0&&y<H&&x>=0&&x<W)?st.cells[y][x]:null;
  const popMode=(x,y)=>st.pop&&st.pop.set.has(y*W+x)?st.pop.mode:null;
  for (let y=0;y<H;y++) for (let x=0;x<W;x++) {
    const k=at(x,y); if(!k) continue; const pm=popMode(x,y); if(pm==='off') continue;
    const i=y*W+x; let sx=1, sy=1; const an=st.land&&st.land.get(i);
    if (an!==undefined) { const t=(now-an)/240; if(t<1) [sx,sy]=bunyoSquash(t); else st.land.delete(i); }
    const white=pm==='white', px=(x+.5)*c, py=(y+.5)*c;
    const items=L(k==='n'?'n'+i:(white?'w':k), BUNYO_COLORS[white?'w':k][0]);
    items.push(`<path d="${BUNYO_SHAPE}" transform="${bunyoTf(px,py,c,sx,sy)}"/>`);
    if (k!=='n') { const same=(xx,yy)=>at(xx,yy)===k&&popMode(xx,yy)!=='off'&&(popMode(xx,yy)==='white')===white;
      if (same(x+1,y)) items.push(`<rect x="${px}" y="${py-c*.26}" width="${c}" height="${c*.52}"/>`);
      if (same(x,y+1)) items.push(`<rect x="${px-c*.26}" y="${py}" width="${c*.52}" height="${c}"/>`); }
    faces+=bunyoFace(px,py,c,sx,sy,k,white);
  }
  for (const f of st.fallers||[]) {
    const px=(f.x+.5)*c, py=(f.y+.5)*c, moving=f.vy>.6, sx=moving?.86:1, sy=moving?1.1:1, items=L(f.k==='n'?'nf'+f.x+'_'+f.to:f.k,BUNYO_COLORS[f.k][0]);
    items.push(`<path d="${moving?BUNYO_DROP:BUNYO_SHAPE}" transform="${bunyoTf(px,py,c,sx,sy)}"/>`);
    if (f.link) { const lx=(f.link.x+.5)*c, ly=(f.link.y+.5)*c, gap=Math.abs(py-ly), w=c*.5*Math.max(0,1-gap/(c*.9));
      if (w>c*.06) items.push(`<path d="M${px} ${py-w/2} L${lx} ${ly-w/2} L${lx} ${ly+w/2} L${px} ${py+w/2}Z"/>`); else f.link=null; }
    faces+=bunyoFace(px,py,c,sx,sy,f.k,false);
  }
  if (st.pair) {
    const p=st.pair, ax=(p.x+.5)*c, ay=(p.y+.5)*c, sx2=ax+Math.sin(p.ang)*c, sy2=ay-Math.cos(p.ang)*c;
    for (const m of st.markers||[]) top+=`<circle cx="${(m.x+.5)*c}" cy="${(m.y+.72)*c}" r="${c*.13}" fill="${BUNYO_COLORS[m.k][0]}" stroke="#fff" stroke-width="${c*.04}" opacity="${(.65+.3*Math.sin(now/120)).toFixed(2)}"/>`;
    /* 軸の粒は、粒全体が白っぽく明滅する */
    const glow=.55*(.5+.5*Math.sin(now/70)), same=p.a===p.b, ka='PA', kb=same?ka:'PB';
    L(ka,toWhite(BUNYO_COLORS[p.a][0],glow)).push(`<path d="${BUNYO_SHAPE}" transform="${bunyoTf(ax,ay,c)}"/>`);
    L(kb,BUNYO_COLORS[p.b][0]).push(`<path d="${BUNYO_SHAPE}" transform="${bunyoTf(sx2,sy2,c)}"/>`);
    if (same) L(ka).push(`<path d="M${ax} ${ay} L${sx2} ${sy2}" stroke="${BUNYO_COLORS[p.a][0]}" stroke-width="${c*.52}"/>`);
    faces+=bunyoFace(ax,ay,c,1,1,p.a,false)+bunyoFace(sx2,sy2,c,1,1,p.b,false);
  }
  let body=''; for (const {fill,items} of layers.values()) body+=`<g filter="url(#${fid})" fill="${fill}">${items.join('')}</g>`;
  return `<svg data-bunyo width="${W*c}" height="${H*c}" viewBox="0 0 ${W*c} ${H*c}" style="filter:drop-shadow(0 2px 2px #0002)"><defs>${bunyoFilter(fid,c)}</defs>${body}${faces}${top}</svg>`;
}
const bunyoPairSvg = (a,b,c,fid) => bunyoSvg({cells:[[b],[a]]},c,fid,1,2);

/* ---------------------------------------------------------------- パクリスのブロック */
const PAKURIS_COLORS = { I:'#2EC4E6', O:'#F7C531', T:'#A24BD6', S:'#4CC84A', Z:'#E8394C', J:'#2D6FE0', L:'#F28A22', G:'#A39C90' };
const pakurisBlock = (x,y,k,c,cls='',style='') => `<span class="fblk ${cls}" style="left:${x*c}px;top:${y*c}px;--k:${PAKURIS_COLORS[k]};${style}"><i></i></span>`;

/* ---------------------------------------------------------------- メニューのアイコン(今の盤と同じ描き方で作る) */
(() => {
  if (typeof AR === 'undefined') return;
  const bg = '<rect width="100" height="100" fill="#F3EFE6"/>';
  const frame = (x,y,w,h,c) => `<rect x="${x-1}" y="${y-1}" width="${w+2}" height="${h+2}" rx="3" fill="none" stroke="#CFC4AE" stroke-width="1.6"/>`+
    Array.from({length:Math.round(w/c)-1},(_,i)=>`<path d="M${x+(i+1)*c} ${y}V${y+h}" stroke="#2A2118" stroke-opacity=".08" stroke-width=".6"/>`).join('')+
    Array.from({length:Math.round(h/c)-1},(_,i)=>`<path d="M${x} ${y+(i+1)*c}H${x+w}" stroke="#2A2118" stroke-opacity=".08" stroke-width=".6"/>`).join('');
  /* ぶにょぶにょ: 盤の下6段 + 落ちてくる組 */
  const rows = ['..r...','..b...','p....y','p...yy','bbg.rp','bggnrp'];
  const cells = rows.map(r=>[...r].map(ch=>ch==='.'?null:ch));
  const bsvg = bunyoSvg({cells},14,'icBunyo',6,6).replace('<svg ','<svg x="8" y="8" ');
  AR.bunyo = `<svg viewBox="0 0 100 100" aria-hidden="true">${bg}${frame(8,8,84,84,14)}${bsvg}</svg>`;
  /* パクリス: 盤の下10段、落ちてくる T とその影、通った道の光 */
  const c=8, ox=10, oy=10, blk=(x,y,k,ghost)=>{ const col=PAKURIS_COLORS[k], X=ox+x*c, Y=oy+y*c;
    if (ghost) return `<rect x="${X+.6}" y="${Y+.6}" width="${c-1.2}" height="${c-1.2}" rx=".8" fill="${col}" fill-opacity=".16" stroke="${col}" stroke-width="1.1"/>`;
    return `<g><rect x="${X}" y="${Y}" width="${c}" height="${c}" rx=".8" fill="${col}"/><rect x="${X}" y="${Y}" width="${c}" height="${c*.16}" fill="#fff" opacity=".35"/>`+
      `<rect x="${X}" y="${Y+c*.7}" width="${c}" height="${c*.3}" fill="#000" opacity=".14"/><rect x="${X+c*.15}" y="${Y+c*.07}" width="${c*.7}" height="${c*.08}" fill="#fff" opacity=".7"/>`+
      `<rect x="${X+.3}" y="${Y+.3}" width="${c-.6}" height="${c-.6}" rx=".8" fill="none" stroke="#000" stroke-opacity=".35" stroke-width=".6"/></g>`; };
  const prow = ['..........','..........','..........','..........','.....LL...','......L...','JJ....L.ZZ','J..O..IZZ.','J.SOO.IIIS','OOSSLLIISS'];
  let p=''; prow.forEach((r,y)=>[...r].forEach((k,x)=>{ if (k!=='.') p+=blk(x,y,k); }));
  const T=[[1,0],[0,1],[1,1],[2,1]], tx=2, ty=1, gy=5;
  const trail=`<defs><linearGradient id="icPakTr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A24BD6" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".9"/></linearGradient></defs>`+
    `<rect x="${ox+(tx)*c}" y="${oy+(ty+2)*c}" width="${3*c}" height="${(gy-ty-1)*c}" fill="url(#icPakTr)" opacity=".75"/>`;
  p+=T.map(([x,y])=>blk(tx+x,gy+y,'T',true)).join('')+trail+T.map(([x,y])=>blk(tx+x,ty+y,'T')).join('');
  AR.pakuris = `<svg viewBox="0 0 100 100" aria-hidden="true">${bg}${frame(ox,oy,80,80,c)}${p}</svg>`;
})();
