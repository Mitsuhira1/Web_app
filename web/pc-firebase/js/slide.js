'use strict';
const slideGame=(()=>{
 const scenery = {
  landscape:{name:'湖畔の村', src:'assets/slide-landscape.svg'},
  alpine:{name:'山あいの湖', src:'assets/slide-alpine.webp'},
  coast:{name:'夕暮れの岬', src:'assets/slide-coast.webp'}
 };
 const validPicture = id => id === 'numbers' || Object.hasOwn(scenery,id);
 const saved = store.get('slideSetup',{});
 let size = [3,4,5,6].includes(saved.size) ? saved.size : 4;
 let picture = validPicture(saved.picture) ? saved.picture : 'numbers';
 const shuffleSteps = {light:4, standard:40, deep:100};
 const preferences = {depth:'standard', numbers:true, guide:true, ...saved};
 let puzzle=null,matchId=null,onlineMode=false,ignoreId=null,started=0;
 const near=(i,n)=>[i%n?i-1:-1,i%n<n-1?i+1:-1,i>=n?i-n:-1,i<n*(n-1)?i+n:-1].filter(x=>x>=0);
 function make(n,seed,depth='standard'){const tiles=Array.from({length:n*n},(_,i)=>(i+1)%(n*n));let blank=n*n-1,prev=-1;for(let k=0;k<n*n*shuffleSteps[depth];k++){const cand=near(blank,n).filter(x=>x!==prev);seed=(Math.imul(seed,1664525)+1013904223)>>>0;const next=cand[seed%cand.length];tiles[blank]=tiles[next];tiles[next]=0;prev=blank;blank=next;}if(tiles.every((v,i)=>v===(i+1)%tiles.length)){const j=near(blank,n)[0];tiles[blank]=tiles[j];tiles[j]=0;}return {tiles,moves:0,done:false};}
 const win=()=>puzzle.tiles.every((v,i)=>v===(i+1)%puzzle.tiles.length);
 function setup(on=false){onlineMode=!!on;S.screen='slideSetup';render();}
 function setupHtml() {
  const nums = Array.from({length:size*size},(_,i)=>`<span>${(i+1)%(size*size)||''}</span>`).join('');
  const preview = (id, label, art) => `<button data-slide-picture="${id}" aria-pressed="${picture===id}">${art}<b>${label}</b></button>`;
  const image = ({src}) => `<span class="slide-choice-art"><img src="${src}" alt=""></span>`;
  const previews = preview('numbers','数字',`<span class="slide-choice-art slide-nums" aria-hidden="true">${nums}</span>`) +
    Object.entries(scenery).map(([id,art]) => preview(id,art.name,image(art))).join('');
  const pictures = setupPanel('盤面を選ぶ', `<div class="slide-choices" style="--slide-n:${size}">${previews}</div>`);
  const board = setupPanel('ルール', setupRow('盤面の大きさ', seg('slide:size',[3,4,5,6].map(n=>[n,`${n}×${n}`]),size)) +
    (onlineMode ? '' : setupRow('シャッフルの強さ', seg('slide:depth',[['light','軽め'],['standard','標準'],['deep','強め']],preferences.depth))));
  const toggle = (key,label) => setupRow(label, seg('slide:'+key,[['on','表示'],['off','非表示']],preferences[key]?'on':'off'));
  const display = setupPanel('表示', (toggle('numbers','風景のピース番号')) + toggle('guide','対局中の完成図'));
  return extraSetupLayout('slide',onlineMode,extraParticipants(onlineMode)+board+display,pictures,'data-slide-start');
 }
 function setOption(key,value) {
  if (key==='size' && [3,4,5,6].includes(+value)) size=+value;
  if (key==='depth' && Object.hasOwn(shuffleSteps,value)) preferences.depth=value;
  if (key==='numbers' || key==='guide') preferences[key]=value==='on';
  save();
  render();
 }
 function start() {
  if (onlineMode && !canStartExtraMatch()) return;
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  const state = {id:`${Date.now()}-${seed}`,phase:'playing',size,picture:picture==='numbers'?'numbers':'landscape',seed};
  if (picture!=='numbers' && picture!=='landscape') state.scenery=picture;
  if (onlineMode) netApi.writeState({slide:state}).catch(e=>toast({w:'通信エラー',t:e.message}));
  enter(state);
 }
 function enter(s,on=onlineMode) {
  if (!s || ![3,4,5,6].includes(s.size) || !['landscape','numbers'].includes(s.picture) || !Number.isInteger(s.seed) || s.id===matchId) return;
  size=s.size;picture=s.picture==='landscape' && Object.hasOwn(scenery,s.scenery) ? s.scenery : s.picture;matchId=s.id;
  puzzle=make(size,s.seed,!on && Object.hasOwn(shuffleSteps,preferences.depth)?preferences.depth:'standard');
  started=performance.now();onlineMode=on;go('slidePlay');if(onlineMode)players();
 }
 function showGuide() {
  const n=size;
  const goal = picture!=='numbers'
    ? `<img src="${scenery[picture].src}" alt="${scenery[picture].name}の完成図">`
    : `<span class="slide-choice-art slide-nums" style="--slide-n:${n}">${Array.from({length:n*n},(_,i)=>`<span>${(i+1)%(n*n)||''}</span>`).join('')}</span>`;
  openSheet(`<h2>完成図</h2><div class="slide-goal">${goal}</div><div class="btns"><button class="btn" data-sheetback>閉じる</button></div>`);
 }
 function remote(s){const v=s&&s.slide;if(!v||v.phase!=='playing'){if(S.screen==='slidePlay'&&onlineMode&&netApi?.role==='guest'){puzzle=null;matchId=null;S.screen='menu';render();}return;}if(v.id!==matchId&&v.id!==ignoreId)enter(v,true);}
 function players(){if(S.screen!=='slidePlay'||!puzzle||!netApi)return;const own=fbState.players[netApi.uid];if(!own)return;const save=own.slide;if(save&&save.id===matchId&&Array.isArray(save.tiles)&&save.tiles.length===size*size&&new Set(save.tiles).size===size*size&&save.tiles.every(v=>Number.isInteger(v)&&v>=0&&v<size*size)&&save.moves>puzzle.moves){puzzle.tiles=save.tiles.slice();puzzle.moves=save.moves;puzzle.done=win();redraw();}if(!save||save.id!==matchId)publish();side();}
 function publish(){if(!onlineMode||!netApi||!matchId)return;netApi.writeSlideProgress({id:matchId,moves:puzzle.moves,tiles:puzzle.tiles.slice(),done:puzzle.done,elapsedMs:puzzle.done?Math.round(performance.now()-started):null}).catch(e=>console.warn('[Slide]',e));}
 function move(value){if(!puzzle||puzzle.done)return;const i=puzzle.tiles.indexOf(+value),z=puzzle.tiles.indexOf(0);if(!near(z,size).includes(i))return;puzzle.tiles[z]=+value;puzzle.tiles[i]=0;puzzle.moves++;puzzle.done=win();redraw();publish();side();if(puzzle.done){if(!onlineMode){const stats=store.get('stats',{}),v=stats.solo_slide||[0];v[0]++;stats.solo_slide=v;store.set('stats',stats);}sfx.play('CARD_FLIP',{volume:.45});cut({text:'完成！',tone:'felt',ms:1400});}}
 function key(k){if(S.screen!=='slidePlay'||!puzzle||puzzle.done)return false;const z=puzzle.tiles.indexOf(0),x=z%size,y=Math.floor(z/size),at={ArrowLeft:x<size-1?z+1:-1,ArrowRight:x?z-1:-1,ArrowUp:y<size-1?z+size:-1,ArrowDown:y?z-size:-1}[k];if(at==null)return false;if(at>=0)move(puzzle.tiles[at]);return true;}
 function redraw(){if(!puzzle)return;puzzle.tiles.forEach((v,i)=>{if(!v)return;const e=document.querySelector(`[data-slide-tile="${v}"]`);if(e){e.style.left=`${i%size*100/size}%`;e.style.top=`${Math.floor(i/size)*100/size}%`;e.disabled=puzzle.done;}});const m=document.getElementById('slideMoves');if(m)m.textContent=puzzle.moves;const d=document.getElementById('slideDone');if(d)d.hidden=!puzzle.done;const status=$('#slideStatus');if(status)status.textContent=puzzle.done?'完成！':'ピースを動かしてください';}
 function side(){const e=document.getElementById('slidePlayers');if(!e||!puzzle)return;const list=onlineMode?Object.values(fbState.players||{}):[{name:meName(),slot:0,slide:{id:matchId,moves:puzzle.moves,done:puzzle.done,elapsedMs:puzzle.done?performance.now()-started:0}}];e.innerHTML=list.sort((a,b)=>a.slot-b.slot).map(p=>{const v=p.slide?.id===matchId?p.slide:null;return `<div class="seat"><i class="dot" style="background:${SEAT_COLORS[p.slot||0]}"></i><span class="nm">${esc(p.name||'プレイヤー')}</span><b>${v?v.done?`完成 ${Math.round(v.elapsedMs/1000)}秒`:`${v.moves}手`:'準備中'}</b></div>`}).join('');}
 function playHtml(){if(!puzzle)return '';const n=size,tiles=Array.from({length:n*n-1},(_,j)=>j+1).map(v=>{const i=puzzle.tiles.indexOf(v),sx=(v-1)%n,sy=Math.floor((v-1)/n);const bg=picture!=='numbers'?`background-image:url('${scenery[picture].src}');background-size:${n*100}% ${n*100}%;background-position:${sx*100/(n-1)}% ${sy*100/(n-1)}%`:'';return `<button class="slide-tile ${picture==='numbers'?'number':''}" data-slide-tile="${v}" style="width:${100/n}%;height:${100/n}%;left:${i%n*100/n}%;top:${Math.floor(i/n)*100/n}%;${bg}" aria-label="${v}のピース">${picture==='numbers'||preferences.numbers?`<span>${v}</span>`:''}</button>`}).join('');const actions = ruleButton('slide') + (preferences.guide ? '<button class="btn" data-slide-guide>完成図</button>' : '');
  const sidebar = playSide({seats:'<div class="seats" id="slidePlayers"></div>',
    status:`<div class="status" id="slideStatus">${puzzle.done?'完成！':'ピースを動かしてください'}</div>`,actions,on:onlineMode});
  return `<div class="screen"><div class="stage slide-stage">
    ${playHeader('スライドパズル',playMode(onlineMode),'data-slide-exit')}
    <div class="boardwrap" id="boardwrap"><div class="slide-board">${tiles}</div></div>
    <div class="slide-under">${n}×${n}　<span id="slideMoves">${puzzle.moves}</span>手 <strong id="slideDone" ${puzzle.done?'':'hidden'}>完成！</strong></div>
    ${playGear()}<div class="cutlayer" id="cutlayer"></div></div>${sidebar}</div>`;}

 function stop(){if(onlineMode&&netApi?.role==='host')netApi.writeState({slide:null}).catch(()=>{});else if(onlineMode)ignoreId=matchId;matchId=null;puzzle=null;onlineMode=false;}
 const save=()=>store.set('slideSetup',{...preferences,size,picture});return{setup,setupHtml,start,remote,players,move,key,side,playHtml,stop,setOption,showGuide,get size(){return size},set size(v){size=v;save()},get picture(){return picture},set picture(v){if(validPicture(v)){picture=v;save()}}};
})();
