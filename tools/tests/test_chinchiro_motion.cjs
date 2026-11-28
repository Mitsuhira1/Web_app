'use strict';
// Presentation invariants: the motion must never change the authoritative result,
// depend on screen refresh rate, overlap solid dice, or snap on the last frame.
const assert = require('node:assert/strict');
const motion = require('../../web/pc-firebase/js/boards/chinchiro-motion.js');
const normals = {1:[0,0,1],6:[0,0,-1],3:[1,0,0],4:[-1,0,0],2:[0,-1,0],5:[0,1,0]};
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const angle = (a,b) => 2*Math.acos(Math.min(1,Math.abs(a.reduce((s,v,i)=>s+v*b[i],0))));
// Every renderer vertex is a permutation of (±h, ±.84h, ±.84h).
// Use the full three-dimensional bounding sphere, valid at every orientation.
const solidRadius = Math.hypot(.16,.16*.84,.16*.84);
const upper = (q,n) => {
  const [x,y,z,w]=q;
  return 2*(x*z-y*w)*n[0]+2*(y*z+x*w)*n[1]+(1-2*(x*x+y*y))*n[2];
};
let checked=0, maxFinalDelta=0, maxEndRotation=0;
const stoppingPlaces = new Set();
function check(values,seed,escaped) {
  const clip=motion.build({values,seed,escaped});
  assert(clip.duration>=2.65 && clip.duration<=3.35);
  assert.equal(clip.dieSize,.32);
  assert(Math.abs(clip.frames.at(-1).t-clip.duration)<1e-9);
  const end=motion.sample(clip,clip.duration), before=motion.sample(clip,clip.duration-.001);
  assert(end.done);
  for(let i=0;i<3;i++) {
    const d=end.dice[i];
    assert(upper(d.q,normals[values[i]])>1-1e-9,`wrong face seed ${seed}, die ${i}`);
    assert.equal(d.outside,escaped&&i===2);
    assert.equal(d.visible,true);
    assert(Math.abs(d.z-motion.floorHeight(d.x,d.y,d.outside)-.16)<1e-8);
    if(!d.outside)assert(Math.hypot(d.x,d.y)<.77);
    else {assert(Math.hypot(d.x,d.y)>1);assert(d.x<1.06&&d.y<.96);}
    maxFinalDelta=Math.max(maxFinalDelta,distance(before.dice[i],d));
    maxEndRotation=Math.max(maxEndRotation,angle(before.dice[i].q,d.q));
    assert(distance(before.dice[i],d)<.0002,'final position must be continuous');
    assert(angle(before.dice[i].q,d.q)<.002,'final orientation must be continuous');
  }
  for(const f of clip.frames) {
    for(let i=0;i<3;i++) {
      const d=f.dice[i];
      assert([d.x,d.y,d.z,...d.q].every(Number.isFinite));
      assert(Math.abs(Math.hypot(...d.q)-1)<1e-9);
      if(!d.visible)continue;
      // The centre remains above the floor throughout each bounce, not just at rest.
      assert(d.z-motion.floorHeight(d.x,d.y,d.outside)>.1599);
      if(!escaped||i!==2)assert(Math.hypot(d.x,d.y)<.78,'a normal die left the bowl');
      for(let j=i+1;j<3;j++) {
        const other=f.dice[j];
        if(!other.visible||d.outside!==other.outside)continue;
        assert(distance(d,other)>2*solidRadius,`intersecting dice seed ${seed}`);
      }
    }
  }
  let previous=-1;
  for(const e of clip.events){
    assert(e.time>=previous&&e.time<=clip.duration);previous=e.time;
    assert(['ceramic','dice','wood'].includes(e.kind));
    assert(e.strength>0&&e.strength<=1&&Math.abs(e.pan)<=1);
    if(!escaped)assert.notEqual(e.kind,'wood');
  }
  stoppingPlaces.add(end.dice.map(d=>`${d.x.toFixed(2)},${d.y.toFixed(2)}`).join('|'));
  checked++;
  return clip;
}

// Every possible combination, including triples, sixes, and the escape rule.
for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)for(let c=1;c<=6;c++) {
  const seed=(a-1)*36+(b-1)*6+c-1;
  check([a,b,c],seed,false);
  check([a,b,c],seed,true);
}
// Previously problematic long settles must also reach an exact final face.
for(const seed of [451,170,512,734,1023,1500,1999])check([1,4,6],seed,true);
assert(stoppingPlaces.size>400,'throws must retain their natural landing places');
const reference=motion.build({values:[6,1,4],seed:'room-roll-52',escaped:true});
assert.deepEqual(reference,motion.build({values:[6,1,4],seed:'room-roll-52',escaped:true}));
assert.notDeepEqual(reference,motion.build({values:[6,1,4],seed:'room-roll-53',escaped:true}));
const unlabelled=motion.build({values:[2,3,5],seed:'room-roll-52',escaped:true});
// Assigning a result rotates the markings, never the geometric trajectory.
for(let i=0;i<reference.frames.length;i++)for(let d=0;d<3;d++) {
  const a=reference.frames[i].dice[d],b=unlabelled.frames[i].dice[d];
  assert.deepEqual([a.x,a.y,a.z,a.visible,a.outside],[b.x,b.y,b.z,b.visible,b.outside]);
}
const at30=Array.from({length:81},(_,i)=>motion.sample(reference,i/30));
for(const hz of [60,120]) {
  for(let frame=0;frame<=hz*2.65;frame++) {
    const pose=motion.sample(reference,frame/hz);
    if(frame%(hz/30)===0)assert.deepEqual(pose,at30[frame/(hz/30)]);
  }
}
assert.deepEqual(motion.sample(reference,-10),motion.sample(reference,0));
assert.deepEqual(motion.sample(reference,Infinity),motion.sample(reference,reference.duration));
assert.equal(motion.floorHeight(0,0),0);
assert(Math.abs(motion.floorHeight(1,0)-.48)<1e-12);
assert.equal(motion.floorHeight(1,0,true),-.12);
assert.throws(()=>motion.build({values:[1,2,7]}),TypeError);
assert.throws(()=>motion.build({values:[1,2]}),TypeError);
console.log(`Chinchiro motion: ${checked} clips passed; all faces, bounds, continuity, separation, determinism and 30/60/120 Hz verified.`);
console.log(`Final 1 ms displacement <= ${maxFinalDelta.toExponential(2)}, rotation <= ${maxEndRotation.toExponential(2)} rad.`);
