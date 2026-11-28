(() => {
'use strict';
// Illustrated porcelain, with an orthographic camera shared by the bowl and dice.
// The static illustration is SVG. Only three bevelled solid dice and their contact
// shadows are painted each frame; no DOM layout or SVG filters run during a throw.
const C = Math.cos(Math.PI * 33 / 180), S = Math.sin(Math.PI * 33 / 180);
const PIPS = {1:[[0,0]],2:[[-1,-1],[1,1]],3:[[-1,-1],[0,0],[1,1]],4:[[-1,-1],[1,-1],[-1,1],[1,1]],5:[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]],6:[[-1,-1],[-1,0],[-1,1],[1,-1],[1,0],[1,1]]};
const FACES = [
  {n:[0,0,1],u:[1,0,0],v:[0,1,0],value:1},
  {n:[0,0,-1],u:[-1,0,0],v:[0,1,0],value:6},
  {n:[1,0,0],u:[0,0,-1],v:[0,1,0],value:3},
  {n:[-1,0,0],u:[0,0,1],v:[0,1,0],value:4},
  {n:[0,-1,0],u:[1,0,0],v:[0,0,1],value:2},
  {n:[0,1,0],u:[1,0,0],v:[0,0,-1],value:5}
];
const add = (a,b) => a.map((v,i)=>v+b[i]);
const mul = (a,n) => a.map(v=>v*n);
const rot = (p,q) => {
  const [x,y,z,w]=q, [a,b,c]=p;
  const tx=2*(y*c-z*b),ty=2*(z*a-x*c),tz=2*(x*b-y*a);
  return [a+w*tx+y*tz-z*ty,b+w*ty+z*tx-x*tz,c+w*tz+x*ty-y*tx];
};
const project = ([x,y,z]) => [200+164*x,228+164*(C*y-S*z)];
const depth = p => S*p[1]+C*p[2];
const path = (ctx,ps) => { ctx.beginPath();ps.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath(); };
const ellipse = (ctx,x,y,rx,ry,fill) => {ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();};
const bowl = () => {
  const ornament = Array.from({length:28},(_,i)=>{
    const a=(i+.5)/28*Math.PI*2, x=200+173*Math.cos(a), y=185+143*Math.sin(a);
    return `<path d="M-3 -2 Q0 -6 3 -2 M-3 2 Q0 -2 3 2" transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${a*180/Math.PI+90})"/>`;
  }).join('');
  return `<svg class="cc-porcelain" viewBox="0 0 400 400" aria-hidden="true"><defs>
    <radialGradient id="cc-shadow"><stop stop-color="#000" stop-opacity=".32"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <linearGradient id="cc-body" x1="0" y1="0" x2=".85" y2="1"><stop stop-color="#f8f5e9"/><stop offset=".4" stop-color="#e3e6df"/><stop offset=".75" stop-color="#afc2c7"/><stop offset="1" stop-color="#5c7889"/></linearGradient>
    <radialGradient id="cc-inside" cx=".48" cy=".68" r=".72" gradientTransform="translate(0 -.05) scale(1 1.08)"><stop stop-color="#fff9e9"/><stop offset=".43" stop-color="#f6f0df"/><stop offset=".68" stop-color="#d9dfd7"/><stop offset=".84" stop-color="#b5c4c3"/><stop offset="1" stop-color="#607e91"/></radialGradient>
    <linearGradient id="cc-lip" x1="0" y1="0" x2=".3" y2="1"><stop stop-color="#fffff5"/><stop offset=".4" stop-color="#f0f1e5"/><stop offset="1" stop-color="#c3d2d1"/></linearGradient>
    <linearGradient id="cc-blue" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#244f79"/><stop offset=".45" stop-color="#3e6c94"/><stop offset="1" stop-color="#173d64"/></linearGradient>
  </defs>
  <ellipse cx="204" cy="364" rx="176" ry="31" fill="url(#cc-shadow)"/>
  <ellipse cx="200" cy="355" rx="69" ry="22" fill="#90a9ae" stroke="#637f88"/>
  <ellipse cx="200" cy="352" rx="62" ry="17" fill="#e5e8dc"/>
  <path d="M20 185 C22 284 94 362 157 370 Q200 384 243 370 C306 362 378 284 380 185Z" fill="url(#cc-body)" stroke="#8da7b2" stroke-width="1.4"/>
  <path d="M44 260 C99 344 299 344 356 260 M62 286 C126 355 274 355 338 286" fill="none" stroke="#355d80" stroke-width="3" opacity=".72"/>
  <path d="M93 318 Q128 344 153 348 M166 351 Q201 359 235 352" fill="none" stroke="#fff9e9" stroke-width="3" opacity=".55" stroke-linecap="round"/>
  <ellipse cx="200" cy="187" rx="181" ry="149" fill="#8ba5af"/>
  <ellipse cx="200" cy="184" rx="181" ry="147" fill="url(#cc-lip)" stroke="#f5f7ed" stroke-width="2"/>
  <ellipse cx="200" cy="185" rx="174" ry="143" fill="none" stroke="url(#cc-blue)" stroke-width="3.5"/>
  <g fill="none" stroke="#35628a" stroke-width="1" opacity=".68">${ornament}</g>
  <ellipse cx="200" cy="185" rx="166" ry="139" fill="none" stroke="#426486" stroke-width="2"/>
  <ellipse cx="200" cy="185" rx="164" ry="137.5" fill="url(#cc-inside)"/>
  <path d="M49 144 A164 137.5 0 0 1 344 118" fill="none" stroke="#4c6b83" stroke-opacity=".3" stroke-width="3" stroke-linecap="round"/>
  <ellipse cx="200" cy="226" rx="74" ry="58" fill="none" stroke="#c8cdbf" stroke-opacity=".35" stroke-width="1"/>
  <ellipse cx="200" cy="226" rx="69" ry="54" fill="none" stroke="#fffdf0" stroke-opacity=".5" stroke-width="1.3"/>
  <path d="M70 96 A172 141 0 0 1 240 47" fill="none" stroke="#fffef3" stroke-width="3.2" stroke-linecap="round" opacity=".85"/>
  <path d="M57 238 A164 137.5 0 0 0 324 275" fill="none" stroke="#fff9e8" stroke-width="2" opacity=".5"/>
  </svg>`;
};

// A real chamfered polyhedron: six faces, twelve bevels and eight corner facets.
// Unlike six rounded HTML planes it has no holes at its edges while tumbling.
function geometry(size) {
  const h=size/2,k=h*.84,faces=[];
  for(const f of FACES) faces.push({...f,ps:[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>add(mul(f.n,h),add(mul(f.u,x*k),mul(f.v,y*k))))});
  for(let a=0;a<3;a++)for(let b=a+1;b<3;b++)for(const sa of [-1,1])for(const sb of [-1,1]){
    const c=3-a-b,n=[0,0,0];n[a]=sa/Math.SQRT2;n[b]=sb/Math.SQRT2;
    const ps=[[h,k,-k],[k,h,-k],[k,h,k],[h,k,k]].map(v=>{const p=[0,0,0];p[a]=sa*v[0];p[b]=sb*v[1];p[c]=v[2];return p;});
    faces.push({n,ps});
  }
  for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]) faces.push({n:mul([x,y,z],1/Math.sqrt(3)),ps:[[x*h,y*k,z*k],[x*k,y*h,z*k],[x*k,y*k,z*h]]});
  return faces;
}
const meshes = new Map();
function drawDie(ctx,d,size) {
  const center=[d.x,d.y,d.z], mesh=meshes.get(size)||geometry(size);meshes.set(size,mesh);
  const faces=mesh.map(f=>({...f,nw:rot(f.n,d.q),world:f.ps.map(p=>add(center,rot(p,d.q)))})).filter(f=>depth(f.nw)>.001);
  faces.sort((a,b)=>a.world.reduce((s,p)=>s+depth(p),0)/a.world.length-b.world.reduce((s,p)=>s+depth(p),0)/b.world.length);
  for(const f of faces){
    const ps=f.world.map(project), n=f.nw;
    const light=Math.max(0,(-.43*n[0]-.34*n[1]+.83*n[2]));
    const shade=.69+.31*light;
    const rgb=[255,249,230].map(v=>Math.round(v*shade));
    path(ctx,ps);ctx.fillStyle=`rgb(${rgb})`;ctx.fill();
    ctx.strokeStyle=`rgba(87,74,51,${f.value ? .11 : .07})`;ctx.lineWidth=.45;ctx.stroke();
    if(!f.value)continue;
    const axisU=rot(f.u,d.q),axisV=rot(f.v,d.q),surf=add(center,mul(n,size/2+.0002));
    for(const [px,py] of PIPS[f.value]){
      const pc=add(surf,add(mul(axisU,px*size*.245),mul(axisV,py*size*.245)));
      const r=size*(f.value===1?.111:.073);
      const circle=(radius,offset=0)=>Array.from({length:18},(_,i)=>{
        const a=i*Math.PI/9;return project(add(pc,add(mul(axisU,Math.cos(a)*radius),mul(axisV,Math.sin(a)*radius+offset))));
      });
      path(ctx,circle(r*1.12));ctx.fillStyle='#b0a897';ctx.fill();
      path(ctx,circle(r));ctx.fillStyle=f.value===1?'#a82e29':'#343833';ctx.fill();
      // An inset lip and a restrained lower reflection give the dots depth.
      const edge=circle(r*.76,size*.009);ctx.beginPath();edge.slice(1,8).forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.strokeStyle=f.value===1?'#d16755':'#747972';ctx.lineWidth=.55;ctx.stroke();
    }
  }
}
function paint(canvas,clip,t){
  const ctx=canvas.getContext('2d');
  const frame=window.ChinchiroMotion.sample(clip,t), ds=frame.dice.filter(d=>d.visible!==false);
  ctx.clearRect(0,0,400,400);
  // Floor shadows follow the actual ground position, tightening as dice land.
  for(const d of ds){
    const ground=window.ChinchiroMotion.floorHeight?window.ChinchiroMotion.floorHeight(d.x,d.y,d.outside):0;
    const [x,y]=project([d.x,d.y,ground]),height=Math.max(0,d.z-ground-clip.dieSize/2);
    const r=164*clip.dieSize*(.65+height*.15);
    ctx.save();ctx.translate(x+3,y+3);ctx.scale(1,C);
    const g=ctx.createRadialGradient(0,0,0,0,0,r);
    g.addColorStop(0,`rgba(46,45,34,${.32/(1+height*3)})`);g.addColorStop(.5,`rgba(46,45,34,${.15/(1+height*3)})`);g.addColorStop(1,'rgba(46,45,34,0)');
    ellipse(ctx,0,0,r,r,g);ctx.restore();
  }
  ds.sort((a,b)=>depth([a.x,a.y,a.z])-depth([b.x,b.y,b.z]));
  for(const d of ds)drawDie(ctx,d,clip.dieSize);
  canvas.dataset.settled=String(t>=clip.duration);
}
let active=null, raf=0;
function finish(s){s.start=-Infinity;s.eventIndex=s.clip.events.length;s.finished=true;}
document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&active){finish(active);if(active.canvas?.isConnected)paint(active.canvas,active.clip,active.clip.duration);}
  else if(active?.finished&&!active.notified&&active.canvas?.isConnected){active.notified=true;active.onDone?.();}
});
window.addEventListener('pagehide',()=>{if(active)finish(active);cancelAnimationFrame(raf);});
function prepare({key,values,seed,escaped,animate,speed=1,reduce=false}){
  const now=performance.now();
  if(!active||active.key!==key){
    const clip=window.ChinchiroMotion.build({values,seed,escaped});
    active={key,clip,speed,start:animate&&!reduce&&!document.hidden?now:-Infinity,eventIndex:0,notified:false,finished:!animate||reduce||document.hidden};
    if(active.finished)active.eventIndex=clip.events.length;
  }
  if(reduce||document.hidden)finish(active);
  active.remaining=Math.max(0,active.clip.duration*1000*active.speed-(now-active.start));
  active.resultDelay=Math.max(0,active.start+(active.clip.duration*1000+700)*active.speed-now);
  active.settleDelay=Math.max(0,active.start+(active.clip.duration*1000+1300)*active.speed-now);
  active.releaseDelay=Math.max(0,active.start+(active.clip.duration*1000+4800)*active.speed-now);
  return active;
}
function mount(el,s,onDone,hold=700){
  cancelAnimationFrame(raf);
  if(!el)return;
  const canvas=el.querySelector('canvas');s.canvas=canvas;s.onDone=onDone;
  const scale=Math.min(2,window.devicePixelRatio||1);
  canvas.width=400*scale;canvas.height=400*scale;canvas.getContext('2d').scale(scale,scale);
  const now=performance.now(),elapsed=(now-s.start)/1000/s.speed;
  // Re-mounting the same throw must not replay impacts that happened before it.
  while(s.eventIndex<s.clip.events.length&&s.clip.events[s.eventIndex].time<elapsed-.05)s.eventIndex++;
  let last=now,paintedFinal=false;
  const tick=now=>{
    if(active!==s||!canvas.isConnected)return;
    if(document.hidden){finish(s);paint(canvas,s.clip,s.clip.duration);return;}
    const t=Math.min(s.clip.duration,(now-s.start)/1000/s.speed);
    if(!paintedFinal)paint(canvas,s.clip,t);
    if(t>=s.clip.duration)paintedFinal=true;
    let played=0;
    while(s.eventIndex<s.clip.events.length&&s.clip.events[s.eventIndex].time<=t){
      const e=s.clip.events[s.eventIndex++];
      if(!s.finished&&now-last<120&&t-e.time<.075&&played++<2&&typeof sfx!=='undefined')sfx.chinchiroImpact(e);
    }
    // Porcelain has weight: only a hard impact produces a tiny, damped response.
    const recent=s.clip.events.slice(Math.max(0,s.eventIndex-3),s.eventIndex);
    const recoil=t<s.clip.duration?recent.reduce((sum,e)=>{
      const dt=t-e.time;
      return sum+(e.kind==='ceramic'&&dt>=0&&dt<.18?Math.sin(dt*88)*Math.exp(-dt*28)*e.strength*.38:0);
    },0):0;
    el.style.transform=Math.abs(recoil)>.005?`translateY(${recoil.toFixed(3)}px) rotate(${(recoil*.08).toFixed(3)}deg)`:'';
    last=now;
    el.classList.toggle('rolling',t<s.clip.duration);
    // Keep the final face visible for a beat before enabling another throw.
    if(now<s.start+(s.clip.duration*1000+hold)*s.speed)raf=requestAnimationFrame(tick);
    else if(!s.notified&&!s.finished){s.notified=true;s.finished=true;if(onDone)onDone();}
  };
  tick(now);
}
window.ChinchiroTable={prepare,mount,markup:()=>`${bowl()}<canvas class="cc-dice-layer" width="400" height="400" aria-hidden="true"></canvas>`};
})();
