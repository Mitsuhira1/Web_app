const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');let now=0,nextId=0,timers=[],events={},starts=0,stops=0,disconnected=0;
const context={console,performance:{now:()=>now},document:{hidden:false,addEventListener:(n,f)=>(events[n]??=[]).push(f)},window:{addEventListener(){}},S:{set:{bgSound:false,master:100,sfxVol:100}},setTimeout:(f,d)=>timers.push({f,at:now+d,id:++nextId}),fetch:async()=>{throw Error('not used')}};
const source=()=>({playbackRate:{},addEventListener(){},connect(){return {connect(){}}},start(){starts++},stop(){stops++},disconnect(){disconnected++}});
class Audio{constructor(){this.state='running';this.destination={}}createBufferSource(){return source()}createGain(){return {gain:{},connect(){}}}createBuffer(){return {getChannelData:()=>new Float32Array(1)}}}
context.window.AudioContext=Audio;vm.createContext(context);vm.runInContext(fs.readFileSync('web/pc-firebase/js/sfx.js','utf8')+';globalThis.gate=transientAudio;globalThis.make=createSfx;',context);
const event=()=>events.visibilitychange.forEach(f=>f());const advance=ms=>{now+=ms;const ready=timers.filter(t=>t.at<=now);timers=timers.filter(t=>t.at>now);ready.forEach(t=>t.f())};
(async()=>{let called=0;context.gate.later(()=>called++,100);context.document.hidden=true;event();advance(200);assert.equal(called,0);context.gate.later(()=>called++,0);advance(1);assert.equal(called,0);
const old=context.gate.guard(()=>called++);context.document.hidden=false;event();advance(400);old();assert.equal(called,0);context.gate.later(()=>called++,50);advance(50);assert.equal(called,1);
const src=source();context.gate.track(src);context.document.hidden=true;event();assert.equal(stops,1);assert.equal(disconnected,1);context.document.hidden=false;event();advance(400);
const sfx=context.make(async fn=>fn==='soundList'?JSON.stringify([{name:'TAP',volume:1,variants:1}]):fn==='soundRate'?44100:[0]);await sfx.init();sfx.play('TAP');assert.equal(starts,1);context.document.hidden=true;event();sfx.play('TAP');assert.equal(starts,1);context.document.hidden=false;event();sfx.play('TAP');assert.equal(starts,1);advance(400);sfx.play('TAP');assert.equal(starts,2);
context.window.SFXCTX.state='suspended';sfx.play('TAP');assert.equal(starts,2);context.window.SFXCTX.state='running';sfx.play('TAP');assert.equal(starts,3);
context.gate.later(()=>called++,50);advance(1000);assert.equal(called,1);
context.S.set.bgSound=true;context.document.hidden=true;event();sfx.play('TAP');assert.equal(starts,4);
console.log('PASS: hidden suppression, stopped sources, epoch cancellation, delayed expiry, suspended context, return quiet period, new sounds, bgSound opt-in');})().catch(e=>{console.error(e);process.exitCode=1});
