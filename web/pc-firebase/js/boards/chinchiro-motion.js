/* チンチロリンの表示専用運動。結果を抽選しない。時間・長さは秒・椀の内径半径=1。
 * 小さい固定刻みで投下/斜面/衝突を先に計算し、描画は任意のフレームレートで補間する。
 * 出目は立方体の対称回転を軌跡全体に適用して合わせる。最後だけ目や位置をすり替えない。
 */
(function (root) {
  'use strict';
  // The bevelled solid has vertices (±HALF, ±.84*HALF, ±.84*HALF)
  // and their permutations. Its enclosing sphere radius is .24846, including
  // tumbling orientations; .253 leaves a small numerical clearance.
  const STEP = 1 / 120, SIZE = .32, HALF = SIZE / 2, BODY_R = .253;
  const NORMALS = {1:[0,0,1], 6:[0,0,-1], 3:[1,0,0], 4:[-1,0,0], 2:[0,-1,0], 5:[0,1,0]};
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * t * (10 + t * (-15 + 6 * t));
  const unit = a => { const n = Math.hypot(...a) || 1; return a.map(v => v / n); };
  const mul = (a,b) => [a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1], a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0], a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3], a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
  const inverse = q => [-q[0], -q[1], -q[2], q[3]];
  const axis = (a,r) => { const u=unit(a), s=Math.sin(r/2); return [u[0]*s,u[1]*s,u[2]*s,Math.cos(r/2)]; };
  const rotate = (q,v) => mul(mul(q,[...v,0]),inverse(q)).slice(0,3);
  const fromTo = (a,b) => {
    const d=a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
    return d < -.99999 ? axis(Math.abs(a[0]) < .8 ? [0,-a[2],a[1]] : [-a[1],a[0],0], Math.PI)
      : unit([a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0],1+d]);
  };
  const slerp = (a,b,t) => {
    let d=a.reduce((s,v,i)=>s+v*b[i],0); if(d<0){ b=b.map(v=>-v); d=-d; }
    if(d>.9995) return unit(a.map((v,i)=>lerp(v,b[i],t)));
    const angle=Math.acos(clamp(d,-1,1)), den=Math.sin(angle);
    return a.map((v,i)=>(v*Math.sin((1-t)*angle)+b[i]*Math.sin(t*angle))/den);
  };
  function random(seed) {
    let n = typeof seed === 'number' ? seed >>> 0 : 2166136261;
    if(typeof seed !== 'number') for(const ch of String(seed)) n=Math.imul(n^ch.charCodeAt(0),16777619)>>>0;
    return () => { n = (n + 0x6D2B79F5) >>> 0; let v=n; v=Math.imul(v^(v>>>15),v|1); v^=v+Math.imul(v^(v>>>7),v|61); return ((v^(v>>>14))>>>0)/4294967296; };
  }
  // Flat foot inside a continuously rising curved wall, rather than a flat disc.
  function floor(x,y,outside) {
    if(outside) return {z:-.12, dx:0, dy:0};
    const r=Math.hypot(x,y), s=Math.max(0,(r-.40)/.60), slope=1.6*s;
    return {z:.48*s*s, dx:r ? slope*x/r : 0, dy:r ? slope*y/r : 0};
  }
  function support(q) {
    return HALF * ([1,0,0].map((_,i)=>Math.abs(rotate(q,[+(i===0),+(i===1),+(i===2)])[2])).reduce((a,b)=>a+b,0));
  }
  function closestRest(q) {
    let n=[0,0,1], z=-2;
    for(const v of Object.values(NORMALS)){ const a=rotate(q,v); if(a[2]>z){ n=a; z=a[2]; } }
    return unit(mul(fromTo(n,[0,0,1]),q));
  }
  function build({values=[1,2,3], seed=1, escaped=false}={}) {
    if(!Array.isArray(values) || values.length !== 3 || values.some(v=>!Number.isInteger(v)||v<1||v>6)) throw new TypeError('Three die values from 1 to 6 are required');
    const rng=random(seed), direction=rng()<.5 ? -1 : 1, frames=[], events=[];
    const emit=(t,kind,strength,x) => {
      if(strength<.12) return;
      // A simultaneous hard contact is one impact, not three identical samples.
      const e=events[events.length-1];
      if(e && e.kind===kind && t-e.time<.036){ if(strength>e.strength){e.strength=clamp(strength,0,1); e.pan=clamp(x,-1,1);} return; }
      events.push({time:t,kind,strength:clamp(strength,0,1),pan:clamp(x,-1,1)});
    };
    const bodies=values.map((v,i)=>{
      const x=(i-1)*.44, y=i===1 ? -.58 : -.34;
      return {x,y,z:.89+i*.075,vx:direction*(-y*2.7)-x*.4,vy:direction*x*2.7-y*.35,vz:-.8,
        q:axis([rng()-.5,rng()-.5,rng()-.5],rng()*Math.PI*2),w:[(rng()-.5)*15,(rng()-.5)*15,(rng()-.5)*8],
        delay:i*.045, visible:i===0, rest:null, asleep:false, outside:false, escape:escaped&&i===2, value:v, lastHit:-1};
    });
    // The outside die is launched over the near rim. Its path is a ballistic arc,
    // followed by a short slide on the table; the game logic already chose this outcome.
    if(escaped){ const s=bodies[2]; s.x=.02; s.y=-.16; s.z=1.18; s.vx=2.35; s.vy=2.85; s.vz=.8; }
    const snapshot=t=>frames.push({t,dice:bodies.map(s=>({x:s.x,y:s.y,z:s.z,q:s.q.slice(),visible:s.visible,outside:s.outside}))});
    snapshot(0);
    let end=0;
    for(let step=1;step<=1080;step++) {
      const t=step*STEP;
      for(const s of bodies) {
        if(t<s.delay) continue;
        s.visible=true;
        if(s.asleep) continue;
        if(s.rest){
          const u=clamp((t-s.rest.start)/.46,0,1), e=smooth(u);
          // A short tipping motion about an edge retains its actual landing place.
          s.q=slerp(s.rest.q,s.rest.to,e);
          const decay=Math.exp(-12*STEP); s.vx*=decay; s.vy*=decay;
          s.x+=s.vx*STEP; s.y+=s.vy*STEP;
          s.z=floor(s.x,s.y,s.outside).z+support(s.q);
          if(u===1){ s.q=s.rest.to; s.z=floor(s.x,s.y,s.outside).z+HALF; s.vx=s.vy=s.vz=0; s.asleep=true; emit(t,s.outside?'wood':'ceramic',.10,s.x); }
          continue;
        }
        s.vz-=15.8*STEP;
        s.x+=s.vx*STEP; s.y+=s.vy*STEP; s.z+=s.vz*STEP;
        if(s.escape && !s.outside && Math.hypot(s.x,s.y)>.84){
          s.outside=true; const sp=Math.hypot(s.vx,s.vy)||1; s.vx=s.vx/sp*.62; s.vy=s.vy/sp*.62; s.vz=.40;
          s.w[0]+=7; s.w[2]-=4; emit(t,'ceramic',.72,s.x);
        }
        const f=floor(s.x,s.y,s.outside), h=support(s.q), n=unit([-f.dx,-f.dy,1]);
        const contact=s.z<f.z+h+.008;
        if(contact){
          s.z=Math.max(s.z,f.z+h);
          const vn=s.vx*n[0]+s.vy*n[1]+s.vz*n[2];
          if(vn<0){
            const restitution=vn<-.9 ? .36 : .06, impulse=-(1+restitution)*vn;
            s.vx+=impulse*n[0]; s.vy+=impulse*n[1]; s.vz+=impulse*n[2];
            if(vn<-.7) s.w=s.w.map(v=>v*.82);
            if(t-s.lastHit>.045){ emit(t,s.outside?'wood':'ceramic',-vn/7,s.x); s.lastHit=t; }
          }
          // Rolling resistance on the glaze. Unlike target-position springs, this
          // slows the current trajectory and leaves each throw in a different place.
          const speed=Math.hypot(s.vx,s.vy), friction=s.outside ? 6.5 : (t>1.3 ? 2.6 : 1.75);
          const k=speed ? Math.max(0,1-friction*STEP/speed) : 0;
          s.vx*=k; s.vy*=k;
          const blend=1-Math.exp(-11*STEP);
          s.w[0]=lerp(s.w[0],-s.vy/HALF,blend); s.w[1]=lerp(s.w[1],s.vx/HALF,blend); s.w[2]*=Math.exp(-3.8*STEP);
          if(t>1.0 && speed<(t>3?.65:.32) && Math.abs(s.vz)<(t>3?1.2:.8) && (s.outside||Math.hypot(s.x,s.y)<.48||t>3)) {
            s.rest={start:t,q:s.q.slice(),to:closestRest(s.q)};
          }
        }
        // The normal dice remain inside the lip, including corner clearance.
        const r=Math.hypot(s.x,s.y), limit=1-BODY_R;
        if(!s.escape && r>limit){
          const nx=s.x/r, ny=s.y/r, vn=s.vx*nx+s.vy*ny;
          s.x=nx*limit; s.y=ny*limit;
          if(vn>0){ s.vx-=1.6*vn*nx; s.vy-=1.6*vn*ny; s.vz+=Math.min(.75,vn*.18); emit(t,'ceramic',vn/4,s.x); s.w[2]+=direction*vn*1.1; }
        }
        const omega=Math.hypot(...s.w);
        if(omega>.0001) s.q=unit(mul(axis(s.w,omega*STEP),s.q));
        s.w=s.w.map(v=>v*Math.exp(-.42*STEP));
      }
      // Dice collide as conservative rounded bodies; vertical separation permits
      // a thrown die to pass above a die which has already reached the bottom.
      // Revisit the three pairs: resolving a third-die contact can otherwise
      // move the first pair back into one another within the same timestep.
      for(let pass=0;pass<3;pass++) {
      for(let i=0;i<3;i++) for(let j=i+1;j<3;j++) {
        const a=bodies[i],b=bodies[j];
        if(!a.visible||!b.visible||a.outside!==b.outside||(a.asleep&&b.asleep)) continue;
        const dx=b.x-a.x,dy=b.y-a.y;
        const low=Math.max(a.z,b.z)<.55;
        const dz=low ? 0 : b.z-a.z, d=Math.hypot(dx,dy,dz), min=2*BODY_R;
        if(d>=min||d<.00001) continue;
        const nx=dx/d,ny=dy/d,nz=dz/d, overlap=min-d;
        const wa=a.asleep?0:b.asleep?1:.5,wb=1-wa;
        a.x-=nx*overlap*wa; a.y-=ny*overlap*wa; a.z-=nz*overlap*wa;
        b.x+=nx*overlap*wb; b.y+=ny*overlap*wb; b.z+=nz*overlap*wb;
        const rv=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny+(b.vz-a.vz)*nz;
        if(rv<0){
          const imp=-rv*1.48;
          a.vx-=imp*nx*wa; a.vy-=imp*ny*wa; a.vz-=imp*nz*wa;
          b.vx+=imp*nx*wb; b.vy+=imp*ny*wb; b.vz+=imp*nz*wb;
          a.w[2]-=imp*.8*wa; b.w[2]+=imp*.8*wb;
          emit(t,'dice',-rv/4,(a.x+b.x)/2);
          if(imp>.24){ if(!a.asleep)a.rest=null; if(!b.asleep)b.rest=null; }
        }
      }
      // Pair separation can move a centre up the curved wall. Restore its floor
      // clearance, then let the next pass resolve any resulting pair contact.
      for(const s of bodies) if(s.visible&&!s.asleep) s.z=Math.max(s.z,floor(s.x,s.y,s.outside).z+support(s.q));
      }
      snapshot(t); end=t;
      if(bodies.every(s=>s.asleep)) break;
    }
    // Apply only a cube symmetry (90-degree axes) to all poses. Collision geometry
    // stays identical while every client sees the authoritative, supplied result.
    bodies.forEach((s,i)=>{
      const final=s.q;
      let top=1,best=-2;
      for(const [face,n] of Object.entries(NORMALS)){ const z=rotate(final,n)[2]; if(z>best){top=+face;best=z;} }
      const relabel=fromTo(NORMALS[s.value],NORMALS[top]);
      for(const f of frames) f.dice[i].q=unit(mul(f.dice[i].q,relabel));
    });
    // Preserve each impact and trajectory; long low-energy settles are presented
    // at one uniform speed, so no timestep or frame rate changes the physics.
    const duration=clamp(end,2.65,3.35), rate=end/duration;
    for(const f of frames) f.t/=rate;
    for(const e of events) e.time/=rate;
    return {duration,frames,events,dieSize:SIZE,radius:1,step:STEP/rate};
  }
  function sample(clip,time) {
    const t=clamp(Number(time)||0,0,clip.duration), pos=t/clip.step;
    const i=Math.min(clip.frames.length-2,Math.floor(pos)), a=clip.frames[Math.max(0,i)],b=clip.frames[Math.max(0,i)+1];
    const u=clamp((t-a.t)/(b.t-a.t),0,1);
    return {done:t>=clip.duration,dice:a.dice.map((v,j)=>({x:lerp(v.x,b.dice[j].x,u),y:lerp(v.y,b.dice[j].y,u),z:lerp(v.z,b.dice[j].z,u),q:slerp(v.q,b.dice[j].q,u),visible:u===1?b.dice[j].visible:v.visible,outside:u===1?b.dice[j].outside:v.outside}))};
  }
  const api=Object.freeze({build,sample,floorHeight:(x,y,outside=false)=>floor(x,y,outside).z});
  if(typeof module==='object'&&module.exports) module.exports=api;
  root.ChinchiroMotion=api;
})(typeof window !== 'undefined' ? window : globalThis);
