/* BGM(音の合成だけで作る。見本 docs/ui-sample-pc.html から) */
/* ---- BGM の見本(音の合成だけで作る。録音や外部の素材は使わない) ---- */
let AX=null, NB=null, BG=null;
const mf=m=>440*Math.pow(2,(m-69)/12);
function env(g,t,a,d,v){ g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(Math.max(v,.0002),t+a); g.gain.exponentialRampToValueAtTime(.0001,t+a+d); }
function osc(out,t,f,type,a,d,v,opt={}){ const o=AX.createOscillator(), g=AX.createGain(); o.type=type; o.frequency.setValueAtTime(f*(opt.bend||1),t); if(opt.bend) o.frequency.exponentialRampToValueAtTime(f,t+.05);
  if(opt.vib){ const l=AX.createOscillator(), lg=AX.createGain(); l.frequency.value=5.2; lg.gain.value=f*.012; l.connect(lg); lg.connect(o.frequency); l.start(t+.15); l.stop(t+a+d+.1); }
  env(g,t,a,d,v); o.connect(g); if(opt.lp){ const fl=AX.createBiquadFilter(); fl.type='lowpass'; fl.frequency.value=opt.lp; g.connect(fl); fl.connect(out); } else g.connect(out); o.start(t); o.stop(t+a+d+.05); }
const INS={
  koto:(o,t,m,d,v)=>{osc(o,t,mf(m),'triangle',.004,1.4,v*.5,{bend:1.03});osc(o,t,mf(m)*2,'sine',.004,.6,v*.18);osc(o,t,mf(m)*3,'sine',.003,.25,v*.08)},
  shami:(o,t,m,d,v)=>{osc(o,t,mf(m),'sawtooth',.003,.34,v*.32,{lp:2400,bend:1.02})},
  flute:(o,t,m,d,v)=>{osc(o,t,mf(m),'sine',.09,d*.95,v*.42,{vib:1});osc(o,t,mf(m)*2,'sine',.09,d*.8,v*.06)},
  piano:(o,t,m,d,v)=>{osc(o,t,mf(m),'triangle',.005,Math.max(.5,d*1.2),v*.42);osc(o,t,mf(m)*2,'sine',.005,.4,v*.1)},
  harp:(o,t,m,d,v)=>{osc(o,t,mf(m),'sawtooth',.002,.5,v*.22,{lp:3200})},
  box:(o,t,m,d,v)=>{osc(o,t,mf(m),'sine',.002,1.6,v*.4);osc(o,t,mf(m)*4,'sine',.002,.3,v*.05)},
  bass:(o,t,m,d,v)=>{osc(o,t,mf(m),'sine',.01,Math.max(.3,d*.9),v*.6);osc(o,t,mf(m)*2,'triangle',.01,.2,v*.1)},
  vib:(o,t,m,d,v)=>{osc(o,t,mf(m),'sine',.004,Math.max(.8,d*1.3),v*.4);osc(o,t,mf(m)*4,'sine',.004,.15,v*.06)},
  taiko:(o,t,m,d,v)=>{const os=AX.createOscillator(),g=AX.createGain();os.frequency.setValueAtTime(140,t);os.frequency.exponentialRampToValueAtTime(55,t+.18);env(g,t,.003,.3,v);os.connect(g);g.connect(o);os.start(t);os.stop(t+.4)},
  noise:(o,t,m,d,v)=>{const b=AX.createBufferSource(),g=AX.createGain(),f=AX.createBiquadFilter();b.buffer=NB;f.type='highpass';f.frequency.value=m;env(g,t,.002,.05,v);b.connect(f);f.connect(g);g.connect(o);b.start(t);b.stop(t+.12)},
};
const sq=(E,ins,b,list,v)=>{ list.forEach(([m,d])=>{ if(m) E.push([ins,b,m,d,v]); b+=d; }); };
const CHD={C:[48,[60,64,67]],G:[43,[59,62,65]],F:[41,[60,65,69]]};
const TR={
 wa1:{name:'縁側',bpm:66,total:32,build(E){ sq(E,'koto',0,[[69,1],[70,.5],[69,.5],[67,2],[63,1],[62,3],[67,1],[69,1],[70,1],[74,1],[75,.5],[74,.5],[70,1],[69,2],[74,1.5],[70,.5],[69,1],[67,1],[69,1],[63,1],[62,2],[62,.5],[63,.5],[67,1],[69,1],[70,1],[69,1],[67,1],[62,2]],.9);
   for(let b=0;b<32;b+=4){ E.push(['koto',b,38,2,.7]); E.push(['koto',b+2,45,2,.5]); }
   [14,30].forEach(b=>[74,70,69,67,63,62].forEach((m,i)=>E.push(['koto',b+1+i*.1,m,1,.35]))); }},
 wa2:{name:'縁日',bpm:108,total:32,build(E){ sq(E,'shami',0,[[67,.5],[69,.5],[72,1],[69,.5],[67,.5],[64,1],[62,.5],[64,.5],[67,1],[64,1],[62,1],[60,.5],[62,.5],[64,.5],[67,.5],[69,1],[72,1],[74,1],[72,.5],[69,.5],[67,2],[76,1],[74,.5],[72,.5],[69,1],[72,1],[74,.5],[72,.5],[69,.5],[67,.5],[64,1],[67,1],[69,.5],[67,.5],[64,.5],[62,.5],[60,1],[62,1],[64,1],[62,1],[60,2]],1);
   for(let b=0;b<32;b+=4){ E.push(['taiko',b,0,0,.55]); E.push(['taiko',b+1.5,0,0,.35]); E.push(['taiko',b+2,0,0,.5]); E.push(['noise',b+3,5000,0,.12]); E.push(['koto',b,48,2,.35]); } }},
 wa3:{name:'月見',bpm:56,total:32,build(E){ sq(E,'flute',0,[[76,3],[77,1],[76,2],[72,2],[71,3],[69,1],[71,2],[72,1],[71,1],[69,2],[65,2],[64,4],[65,2],[69,2],[64,4]],.9);
   for(let b=0,i=0;b<32;b+=4,i++){ [52,59,64].forEach((m,k)=>E.push(['koto',b+k*.12,m,2,.5])); E.push(['koto',b+2,i%2?59:57,2,.4]); } }},
 yo1:{name:'ワルツ',bpm:132,total:48,build(E){ sq(E,'piano',0,[[76,2],[79,1],[84,3],[83,2],[81,1],[79,3],[77,2],[74,1],[71,2],[74,1],[72,2],[76,1],[79,3],[81,2],[84,1],[81,3],[79,2],[76,1],[72,3],[74,1],[77,1],[74,1],[71,2],[74,1],[72,3]],.9);
   'CCGGGGCCFFCCGGCC'.split('').forEach((c,i)=>{ const [r,ch]=CHD[c], b=i*3; E.push(['bass',b,r,1,.6]); [1,2].forEach(k=>ch.forEach(m=>E.push(['piano',b+k,m,.6,.22]))); }); }},
 yo2:{name:'書斎',bpm:96,total:32,build(E){ const C=[[57,60,64,69],[62,65,69,74],[55,59,62,67],[60,64,67,72],[53,57,60,65],[62,65,69,74],[52,56,59,64],[57,60,64,69]], top=[76,77,74,76,72,74,71,69];
   C.forEach((ch,i)=>{ const b=i*4; [0,1,2,3,2,1,2,1].forEach((k,j)=>E.push(['harp',b+j*.5,ch[k],.5,.8])); const r=ch[0]-(ch[0]>55?24:12); E.push(['bass',b,r,2,.5]); E.push(['bass',b+2,r+7,2,.35]); E.push(['flute',b,top[i],4,.5]); }); }},
 yo3:{name:'オルゴール',bpm:84,total:32,build(E){ sq(E,'box',0,[[83,1],[79,1],[74,2],[76,1],[79,1],[83,2],[84,1.5],[83,.5],[79,2],[81,1],[78,1],[74,2],[83,1],[86,1],[91,2],[88,1],[86,1],[83,2],[84,1],[79,1],[76,1],[79,1],[78,1],[81,1],[79,2]],.9);
   [[55,62,71],[52,59,67],[48,55,64],[50,57,66],[55,62,71],[52,59,67],[48,55,64],[50,57,66]].forEach((c,i)=>[0,1,2,1,0,1,2,1].forEach((k,j)=>E.push(['box',i*4+j*.5,c[k],.5,.4]))); }},
 lg1:{name:'ラウンジ',bpm:120,total:32,build(E){ sq(E,'bass',0,[38,41,45,44,43,47,50,47,48,52,55,57,45,49,52,49,50,48,45,41,43,45,47,43,48,52,55,52,48,43,45,47].map(m=>[m,1]),.9);
   [[60,65,69],[59,65,69],[59,64,67],[61,64,67],[60,65,69],[59,65,69],[57,60,64],[57,60,64]].forEach((ch,i)=>[1.667,3.667].forEach(o=>ch.forEach(m=>E.push(['piano',i*4+o,m,.5,.3]))));
   for(let b=0;b<32;b++){ E.push(['noise',b,7000,0,.07]); if(b%2) E.push(['noise',b+.667,7000,0,.045]); }
   sq(E,'vib',0,[[77,2],[76,1],[74,1],[71,1.5],[74,.5],[77,2],[76,2],[79,1],[76,1],[73,1],[76,1],[79,2],[77,1],[76,1],[74,1],[72,1],[71,2],[74,2],[72,4]],.8); }},
 lg2:{name:'夕暮れ',bpm:100,total:32,build(E){ const C=[[41,48,[57,60,64]],[41,48,[57,60,64]],[43,50,[59,62,65]],[43,50,[59,62,65]],[43,50,[58,62,65]],[36,43,[58,60,64]],[41,48,[57,60,64]],[36,43,[58,60,64]]];
   C.forEach(([r,f,ch],i)=>{ const b=i*4; E.push(['bass',b,r,1.5,.8]); E.push(['bass',b+1.5,f,.5,.5]); E.push(['bass',b+2,r,1.5,.7]); E.push(['bass',b+3.5,f,.5,.5]); [0,1.5,3].forEach(o=>ch.forEach(m=>E.push(['koto',b+o,m,.5,.3]))); for(let j=0;j<8;j++) E.push(['noise',b+j*.5,8000,0,j%2?.03:.05]); });
   sq(E,'flute',0,[[72,3],[69,1],[72,4],[71,3],[67,1],[71,4],[70,2],[74,2],[72,2],[70,1],[67,1],[69,4]],.8); }},
};
['wa1','wa2','wa3'].forEach(k=>TR[k].g='wa'); ['yo1','yo2','yo3'].forEach(k=>TR[k].g='yo'); ['lg1','lg2'].forEach(k=>TR[k].g='cd');
INS.sax=(o,t,m,d,v)=>osc(o,t,mf(m-12),'sawtooth',.04,Math.max(.2,d*.95),v*.24,{lp:1500,vib:1,bend:.98});
Object.keys(TR).forEach(k=>{ const tr=TR[k], b0=tr.build, t0=tr.total, reps=Math.max(2,Math.round(130/(t0*60/tr.bpm))); tr.total=t0*reps; tr.build=E=>{ const E1=[]; b0(E1); for(let i=0;i<reps;i++) E1.forEach(e=>E.push([e[0],e[1]+i*t0,e[2],e[3],e[4]])); }; });
INS.erhu=(o,t,m,d,v)=>osc(o,t,mf(m),'sawtooth',.06,Math.max(.2,d*.95),v*.2,{lp:1900,vib:1,bend:.97});
/* 自動で作る曲: 種(seed)から、動機 A・B・C を作って A A B A / C C B 終 の形に並べる */
function rng(seed){ return ()=>{ seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const SC={mix:[0,2,4,5,7,9,10],maj:[0,2,4,5,7,9,11],min:[0,2,3,5,7,8,10],dor:[0,2,3,5,7,9,10],pen:[0,2,4,7,9],miy:[0,1,5,7,8]};
const RH={4:[[1,1,1,1],[2,1,1],[1,1,2],[1.5,.5,1,1],[.5,.5,1,.5,.5,1],[1,.5,.5,2],[2,2],[.5,.5,.5,.5,1,1],[3,1]],3:[[1,1,1],[2,1],[1,2],[1,.5,.5,1],[.5,.5,1,1],[3],[1.5,.5,1]]};
const LEAD2={box:'piano',piano:'vib',vib:'piano',flute:'piano',koto:'flute',erhu:'koto',harp:'flute',sax:'vib'};
function genTrack(o){ const sec=(seed,L)=>{ const E=[];
  const r=rng(seed), sc=SC[o.scale], n=sc.length, M=o.meter, penta=n<7;
  const deg=d=>o.root+12*Math.floor(d/n)+sc[((d%n)+n)%n];
  const P=penta?Array(8).fill(0):[[0,0,3,4,0,5,3,4],[0,5,3,4,0,5,4,0],[0,3,0,4,5,3,4,0],[0,4,5,2,3,0,3,4]][r()*4|0];
  const sh=b=>{ const p=P[b%8]; return p>3?p-7:p; };
  const mot=()=>{ const rh=RH[M][r()*RH[M].length|0]; let x=(penta?[0,3,5]:[0,2,4])[r()*3|0]; return {rh,rel:rh.map((_,i)=>{ if(i) x=Math.max(-2,Math.min(n+2,x+[-2,-1,-1,1,1,2,0][r()*7|0])); return x; })}; };
  const A=mot(), B=mot(), C=mot();
  [A,A,B,A,C,C,B,null,A,A,B,A,C,B,A,null].forEach((m,bar)=>{ const b0=bar*M; if(!m){ E.push([L,b0,deg(n+(bar===15?0:penta?3:4)),M,.9]); return; }
    let b=b0; m.rh.forEach((d,i)=>{ let t=b; if(o.comp==='swing'&&t%1===.5) t+=.167; const dd=n+m.rel[i]+sh(bar);
      if(o.gr&&d>=1&&t>.2&&r()<.5) E.push([L,t-.1,deg(dd+1),.1,.5]); E.push([L,t,deg(dd),d,.9]); b+=d; }); });
  for(let bar=0;bar<16;bar++){ const b=bar*M, c=sh(bar), ct=(penta?[0,3,n]:[0,2,4].concat(o.sev?[6]:[])).map(d=>deg(d+c)-12); let bs=deg(c)-24; if(bs<33) bs+=12;
    const ch=(t,v,d=.5)=>ct.forEach(m=>E.push(['piano',t,m,d,v]));
    switch(o.comp){
      case 'waltz': E.push(['bass',b,bs,1,.6]); for(let k=1;k<M;k++) ch(b+k,.2); break;
      case 'arp': for(let j=0;j<M*2;j++) E.push([o.cins||'harp',b+j*.5,ct[[0,1,2,1][j%4]%ct.length],.5,.45]); E.push(['bass',b,bs,2,.45]); break;
      case 'alberti': for(let j=0;j<M*2;j++) E.push(['piano',b+j*.5,ct[[0,2,1,2][j%4]],.5,.26]); E.push(['bass',b,bs,2,.45]); break;
      case 'march': E.push(['bass',b,bs,.8,.6]); E.push(['bass',b+2,bs+7,.8,.5]); ch(b+1,.2,.25); ch(b+3,.2,.25); break;
      case 'swing': { const th=ct[1]-ct[0]; [0,th,7,th].slice(0,M).forEach((x,k)=>E.push(['bass',b+k,bs+x,1,.8])); [1.667,3.667].forEach(t=>{ if(t<M) ch(b+t,.26); });
        for(let k=0;k<M;k++){ E.push(['noise',b+k,7000,0,.06]); if(k%2) E.push(['noise',b+k+.667,7000,0,.04]); } break; }
      case 'bossa': E.push(['bass',b,bs,1.5,.8]); E.push(['bass',b+1.5,bs+7,.5,.5]); E.push(['bass',b+2,bs,1.5,.7]); E.push(['bass',b+3.5,bs+7,.5,.5]);
        [0,1.5,3].forEach(t=>ct.forEach(m=>E.push(['koto',b+t,m,.5,.26]))); for(let j=0;j<8;j++) E.push(['noise',b+j*.5,8000,0,j%2?.03:.05]); break;
      case 'drone': E.push(['koto',b,bs+12,2,.6]); E.push(['koto',b+M/2,bs+19,2,.4]); if(bar%4===3) [n+3,n+2,n+1,n,3,2].forEach((d,i)=>E.push(['koto',b+M-1+i*.1,deg(d),1,.3])); break;
      case 'pulse': for(let j=0;j<M*2;j++) E.push(['koto',b+j*.5,bs+(j%2?19:12),.5,j%2?.22:.32]); E.push(['noise',b+1,2600,0,.07]); E.push(['noise',b+3,2600,0,.07]); break;
    } } return E; };
  /* 16 小節を 1 つの区切りにして、2〜3 分になるまで並べる(奇数番目は別の動機、後半は別の楽器) */
  const sb=16*o.meter, reps=Math.max(2,Math.round(140/(sb*60/o.bpm)));
  return {name:o.name,g:o.g,bpm:o.bpm,total:sb*reps,build(E){ for(let k=0;k<reps;k++) sec(o.seed+(k%2)*977,(k>>1)%2?(LEAD2[o.lead]||o.lead):o.lead).forEach(e=>{ e[1]+=k*sb; E.push(e); }); }}; }
[ ['mn','机の上',{seed:11,bpm:80,meter:4,scale:'maj',root:60,lead:'box',comp:'arp',cins:'box'}],
  ['mn','ひだまり',{seed:12,bpm:88,meter:4,scale:'maj',root:65,lead:'piano',comp:'alberti'}],
  ['mn','箱庭',{seed:13,bpm:76,meter:3,scale:'maj',root:62,lead:'box',comp:'waltz'}],
  ['mn','午後三時',{seed:14,bpm:92,meter:4,scale:'maj',root:67,lead:'vib',comp:'bossa'}],
  ['mn','棚の前',{seed:15,bpm:84,meter:4,scale:'pen',root:60,lead:'piano',comp:'arp',cins:'box'}],
  ['wa','石庭',{seed:21,bpm:70,meter:4,scale:'miy',root:62,lead:'koto',comp:'drone'}],
  ['ch','茶館',{seed:31,bpm:72,meter:4,scale:'pen',root:62,lead:'erhu',comp:'drone',gr:1}],
  ['ch','点心',{seed:32,bpm:118,meter:4,scale:'pen',root:65,lead:'koto',comp:'pulse',gr:1}],
  ['ch','雀荘',{seed:33,bpm:96,meter:4,scale:'pen',root:67,lead:'erhu',comp:'pulse',gr:1}],
  ['yo','舞踏会',{seed:41,bpm:138,meter:3,scale:'maj',root:65,lead:'piano',comp:'waltz'}],
  ['yo','回廊',{seed:42,bpm:100,meter:4,scale:'min',root:62,lead:'flute',comp:'arp',cins:'harp'}],
  ['yo','行進',{seed:43,bpm:112,meter:4,scale:'maj',root:60,lead:'piano',comp:'march'}],
  ['yo','暖炉',{seed:44,bpm:84,meter:4,scale:'maj',root:67,lead:'flute',comp:'alberti'}],
  ['yo','古城',{seed:45,bpm:120,meter:3,scale:'min',root:57,lead:'harp',comp:'waltz'}],
  ['yo','時計台',{seed:46,bpm:90,meter:4,scale:'maj',root:62,lead:'box',comp:'arp',cins:'harp'}],
  ['yo','並木道',{seed:47,bpm:104,meter:4,scale:'maj',root:58,lead:'piano',comp:'alberti'}],
  ['cd','カウンター',{seed:51,bpm:126,meter:4,scale:'maj',root:60,lead:'vib',comp:'swing',sev:1}],
  ['cd','角の席',{seed:52,bpm:112,meter:4,scale:'dor',root:62,lead:'piano',comp:'swing',sev:1}],
  ['cd','テラス',{seed:53,bpm:98,meter:4,scale:'maj',root:65,lead:'flute',comp:'bossa',sev:1}],
  ['cd','真夜中',{seed:54,bpm:84,meter:4,scale:'dor',root:57,lead:'vib',comp:'swing',sev:1}],
  ['cd','配り番',{seed:55,bpm:132,meter:4,scale:'maj',root:67,lead:'piano',comp:'swing',sev:1}],
  ['cd','海辺',{seed:56,bpm:104,meter:4,scale:'maj',root:62,lead:'vib',comp:'bossa',sev:1}],
  ['cd','切り札',{seed:57,bpm:116,meter:4,scale:'min',root:60,lead:'piano',comp:'march'}],
  ['cd','三拍子',{seed:58,bpm:140,meter:3,scale:'maj',root:58,lead:'vib',comp:'waltz',sev:1}],
  ['jz','夜更け',{seed:61,bpm:132,meter:4,scale:'dor',root:62,lead:'vib',comp:'swing',sev:1}],
  ['jz','二番テーブル',{seed:62,bpm:96,meter:4,scale:'dor',root:57,lead:'sax',comp:'swing',sev:1}],
  ['jz','雨宿り',{seed:63,bpm:152,meter:4,scale:'mix',root:65,lead:'piano',comp:'swing',sev:1}],
  ['jz','閉店前',{seed:64,bpm:76,meter:4,scale:'maj',root:60,lead:'sax',comp:'swing',sev:1}],
  ['jz','角を曲がって',{seed:65,bpm:118,meter:4,scale:'mix',root:58,lead:'vib',comp:'swing',sev:1}],
  ['jz','終電',{seed:66,bpm:108,meter:4,scale:'dor',root:60,lead:'sax',comp:'swing',sev:1}],
  ['jz','氷の音',{seed:67,bpm:88,meter:4,scale:'maj',root:65,lead:'piano',comp:'swing',sev:1}],
  ['jz','裏通り',{seed:68,bpm:144,meter:4,scale:'dor',root:64,lead:'vib',comp:'swing',sev:1}],
  ['jz','三時の客',{seed:69,bpm:124,meter:3,scale:'mix',root:62,lead:'sax',comp:'waltz',sev:1}],
  ['jz','最後の一曲',{seed:70,bpm:70,meter:4,scale:'maj',root:58,lead:'vib',comp:'swing',sev:1}],
].forEach(([g,name,o],i)=>TR['g'+i]=genTrack({...o,g,name}));
Object.values(TR).forEach(t=>{ if(t.g==='cd'||t.g==='jz') t.g='yo'; });
const GEN={all:'すべて',mn:'メニュー',wa:'和風',yo:'洋風',ch:'中華風'};
const GGAMES={mn:'メニュー・設定・部屋の画面',wa:'将棋・5五将棋・碁・五目ならべ・花札',yo:'チェス・リバーシ・コネクトフォーなどの盤のゲームと、トランプのゲーム(ジャズを含む)',ch:'麻雀'};
const PL={genre:'all',id:null,repeat:false,paused:false,ctx:null}; let PV=null;
S.off=S.off||[];
const pool=()=>{ const a=Object.keys(TR).filter(k=>!S.off.includes(k)), g=a.filter(k=>PL.genre==='all'||TR[k].g===PL.genre); return g.length?g:a; };
/* 場面に合うジャンルを初期選択にする(メニュー=メニュー、将棋・碁・花札=和風、麻雀=中華風、ほか=洋風) */
const gameGenre=id=>['shogi','minishogi','go','gomoku','hanafuda'].includes(id)?'wa':id==='mahjong'?'ch':'yo';
const ctxGenre=()=>bgmGenreFor();
function bgmPick(){ const p=pool(), q=p.filter(k=>k!==PL.id), l=q.length?q:p; if(l.length) bgmPlay(l[Math.random()*l.length|0]); else bgmStop(); }
function bgCtx(force){ const g=ctxGenre(); if(!g||(g===PL.ctx&&!force)) return; PL.ctx=g; PL.genre=g; if(S.set.bgm&&!PL.paused&&!PV&&(!BG||TR[PL.id].g!==g)) bgmPick(); bgmSync(); }
const gv=()=>S.mute?0:S.vol*.6*(S.set.master/100);
/* 再生: 先の 0.5 秒ぶんだけを順に予約する(再生位置を動かせる。通信対戦とは無関係で、端末ごとに別) */
let bgSeeking=false;
function newGain(){ const g=AX.createGain(), cp=AX.createDynamicsCompressor(); g.gain.value=gv(); g.connect(cp); cp.connect(AX.destination); return g; }
function bgCut(){ const og=BG.g; try{ og.gain.setTargetAtTime(0,AX.currentTime,.03); }catch(e){} setTimeout(()=>og.disconnect(),300); }
function bgmPlay(id,pos,force){ if(!S.set.bgm&&!force) return; AX=AX||new (window.AudioContext||window.webkitAudioContext)(); AX.resume(); PL.paused=false;
  if(!NB){ NB=AX.createBuffer(1,AX.sampleRate*.2,AX.sampleRate); const d=NB.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; }
  if(BG) bgCut(); const tr=TR[id], raw=[]; tr.build(raw); const spb=60/tr.bpm;
  BG={id,spb,dur:tr.total*spb,E:raw.map(e=>[e[1]*spb,e]).sort((x,y)=>x[0]-y[0]),g:newGain(),idx:0,t0:0}; PL.id=id; bgSeek(pos||0,true); }
function bgSeek(p,first){ if(!BG)return; if(!first){ bgCut(); BG.g=newGain(); } BG.t0=AX.currentTime+.08-p; const i=BG.E.findIndex(e=>e[0]>=p); BG.idx=i<0?BG.E.length:i; }
const bgPos=()=>!BG?0:PL.paused?PL.pp:Math.max(0,Math.min(BG.dur,AX.currentTime-BG.t0));
setInterval(()=>{ if(!BG||PL.paused||AX.state!=='running')return; const p=AX.currentTime-BG.t0;
  while(BG.idx<BG.E.length&&BG.E[BG.idx][0]<p+.5){ const [t,e]=BG.E[BG.idx++]; INS[e[0]](BG.g,Math.max(AX.currentTime,BG.t0+t),e[2],e[3]*BG.spb,e[4]); }
  if(p>=BG.dur){ if(PV){ PV=null; bgmStop(); if(S.set.bgm) bgmPick(); render(); } else if(PL.repeat) bgmPlay(BG.id); else bgmNext(1); bgmSync(); } },150);
function bgmStop(){ if(!BG)return; bgCut(); BG=null; }
function bgmNext(dir){ const p=pool(), i=p.indexOf(PL.id); if(!p.length) return bgmStop(); bgmPlay(p[i<0?0:(i+dir+p.length)%p.length]); }
function bgAct(a){ if(!S.set.bgm) return;
  if(a==='prev'){ if(BG&&bgPos()>3) bgSeek(0); else bgmNext(-1); } if(a==='next') bgmNext(1); if(a==='rep') PL.repeat=!PL.repeat;
  if(a==='mute'){ S.mute=!S.mute; if(BG&&!PL.paused) BG.g.gain.value=gv(); }
  if(a==='toggle'){ if(!BG) bgmPick(); else if(PL.paused){ PL.paused=false; BG.g=newGain(); bgSeek(PL.pp,true); } else { PL.pp=bgPos(); PL.paused=true; bgCut(); } }
  if(a==='genre'){ const k=Object.keys(GEN); PL.genre=k[(k.indexOf(PL.genre)+1)%k.length]; if(BG&&!PL.paused&&PL.genre!=='all'&&TR[PL.id].g!==PL.genre) bgmPick(); }
  bgmSync(); }
const mmss=t=>`${t/60|0}:${String(t%60|0).padStart(2,'0')}`;
const bgs=$('#bgs');
IC.spk='<path d="M4 9.500v5h3.500l4.500 4v-13l-4.500 4z"/><path d="M15.500 9a4.500 4.500 0 010 6M18 6.500a8 8 0 010 11"/>'; IC.mute='<path d="M4 9.500v5h3.500l4.500 4v-13l-4.500 4z"/><path d="M16 9.500l5 5M21 9.500l-5 5"/>';
bgs.innerHTML=`${[['prev','前の曲'],['toggle','再生'],['next','次の曲'],['rep','リピート再生']].map(([a,l])=>`<button data-bg="${a}" title="${l}" aria-label="${l}">${ic(a==='toggle'?'play':a)}</button>`).join('')}
  <input type="range" id="bgSeek" min="0" max="1000" value="0" aria-label="再生位置"><span class="num bgtime" id="bgTime">0:00 / 0:00</span><span class="bgname" id="bgName"></span><button data-bg="genre" class="bggen" id="bgGen" title="ジャンル" aria-label="ジャンル"></button>
  <button data-bg="mute" id="bgMute" title="消音" aria-label="消音">${ic('spk')}</button><input type="range" id="bgVol" min="0" max="100" value="60" aria-label="BGMの音量">`;
function setVol(v){ S.vol=v/100; S.mute=false; if(BG&&!PL.paused) BG.g.gain.value=gv(); const a=$('#volIn'), b=$('#bgVol'); if(a) a.value=v; b.value=v; $('#bgMute').innerHTML=ic('spk'); }
$('#bgVol').addEventListener('input',e=>setVol(+e.target.value));
bgs.addEventListener('click',e=>{ const b=e.target.closest('button'); if(b) bgAct(b.dataset.bg); });
$('#bgSeek').addEventListener('input',e=>{ bgSeeking=true; if(BG) $('#bgTime').textContent=`${mmss(e.target.value/1000*BG.dur)} / ${mmss(BG.dur)}`; });
$('#bgSeek').addEventListener('change',e=>{ bgSeeking=false; if(!BG)return; const p=e.target.value/1000*BG.dur; if(PL.paused) PL.pp=p; else bgSeek(p); });
setInterval(()=>{ if(!BG||bgSeeking)return; const p=bgPos(); $('#bgSeek').value=p/BG.dur*1000; $('#bgTime').textContent=`${mmss(p)} / ${mmss(BG.dur)}`; },300);
function bgmSync(){ const playing=BG&&!PL.paused, t=bgs.querySelector('[data-bg="toggle"]'); t.innerHTML=ic(playing?'pause':'play'); t.title=playing?'一時停止':'再生'; t.setAttribute('aria-label',t.title);
  const r=bgs.querySelector('[data-bg="rep"]'); r.classList.toggle('on',PL.repeat); r.setAttribute('aria-pressed',PL.repeat);
  $('#bgGen').textContent=GEN[PL.genre]; $('#bgMute').innerHTML=ic(S.mute||S.vol===0?'mute':'spk'); $('#bgVol').value=Math.round(S.vol*100); $('#bgName').textContent=BG?TR[PL.id].name:''; bgs.hidden=!S.set.bgm;
  bgs.querySelectorAll('button,input').forEach(e=>e.disabled=!S.set.bgm); if(!BG){ $('#bgSeek').value=0; $('#bgTime').textContent='0:00 / 0:00'; }
}
function bgm(){ return `<div class="screen"><div class="main"><h2 class="pagehead">BGMの見本</h2>
  <div class="panel" style="max-width:560px;margin-bottom:16px"><div class="row"><span>BGM</span>${sw('bgm',S.set.bgm)}</div><div class="row"><span>音量</span><span class="ctl"><input type="range" id="volIn" min="0" max="100" value="${Math.round(S.vol*100)}" style="flex:1" aria-label="音量"></span></div></div>
  <div class="cols">${Object.keys(GGAMES).map(g=>`<div class="panel"><h3>${GEN[g]} ${Object.keys(TR).filter(k=>TR[k].g===g).length}曲</h3><p class="bgmg">${GGAMES[g]}</p><div class="bgml">
    ${Object.keys(TR).filter(k=>TR[k].g===g).map(id=>`<button class="btn ${BG&&PL.id===id?'gold':''}" data-bgm="${id}">${TR[id].name}</button>`).join('')}</div></div>`).join('')}</div></div></div>`; }

