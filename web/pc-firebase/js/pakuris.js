'use strict';
const pakurisGame=(()=>{
 const W=10,H=20,SHAPES={I:[[0,1],[1,1],[2,1],[3,1]],O:[[1,0],[2,0],[1,1],[2,1]],T:[[1,0],[0,1],[1,1],[2,1]],S:[[1,0],[2,0],[0,1],[1,1]],Z:[[0,0],[1,0],[1,1],[2,1]],J:[[0,0],[0,1],[1,1],[2,1]],L:[[2,0],[0,1],[1,1],[2,1]]};
 let board,active,queue,bag,score,lines,ended,combo,seed,garbage=0,animating=false,matchEpoch=0,lastActive=null;
 function fillBag(){bag=Object.keys(SHAPES);for(let i=bag.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=(seed>>>16)%(i+1);[bag[i],bag[j]]=[bag[j],bag[i]];}}
 function take(){if(!bag.length)fillBag();return bag.pop();}
 function fresh(randomSeed){seed=randomSeed;garbage=0;animating=false;lastActive=null;matchEpoch++;board=Array(W*H).fill(null);bag=[];queue=[take(),take(),take()];score=0;lines=0;combo=0;ended=false;spawn();}
 function cells(p=active){return p.shape.map(([x,y])=>[p.x+x,p.y+y]);}
 function fits(p){return cells(p).every(([x,y])=>x>=0&&x<W&&y<H&&(y<0||!board[y*W+x]));}
 function spawn(){active={type:queue.shift(),shape:null,x:3,y:-1};active.shape=SHAPES[active.type].map(a=>a.slice());queue.push(take());if(!fits(active))ended=true;}
 function startSolo(){fresh(crypto.getRandomValues(new Uint32Array(1))[0]);go('pakurisPlay');}
 function showSetup(){go('pakurisSetup');}
 function setup(on=false){fallingMatch.setup('pakuris',on);}
 function playing(){return S.screen==='pakurisPlay'||(S.screen==='extraPlay'&&fallingMatch.linked('pakuris'));}

 function setupHtml(){return `<div class="screen col"><div class="setuphead"><button class="btn" data-go="menu" aria-label="戻る">${ic('back')}</button><span class="art">${artOf('pakuris')}</span><div class="txt"><h2>パクリス</h2></div></div><div class="setupbody"><div class="panel"><h3>${fallingMatch.online?'対戦':'ひとりで遊ぶ'}</h3></div></div><div class="setupfoot"><button class="btn" data-go="menu">戻る</button><button class="btn primary" data-pakuris-start>始める</button></div></div>`;}
 function tryMove(dx,dy){if(ended||animating)return false;const p={...active,x:active.x+dx,y:active.y+dy};if(fits(p)){active=p;redraw();return true;}if(dy>0)lock();return false;}
 function rotate(){if(ended||animating||active.type==='O')return;const shape=active.shape.map(([x,y])=>[3-y,x]);for(const dx of [0,-1,1,-2,2]){const p={...active,x:active.x+dx,shape};if(fits(p)){active=p;redraw();return;}}}
 async function lock(){
  if(ended||animating)return;
  const currentEpoch=matchEpoch, points=cells();
  if(points.some(([,y])=>y<0)){ended=true;redraw();fallingMatch.progress('pakuris');return;}
  for(const [x,y] of points)board[y*W+x]=active.type;
  const rows=Array.from({length:H},(_,i)=>i).filter(y=>board.slice(y*W,(y+1)*W).every(Boolean));
  const cleared=rows.length;animating=true;redraw();
  if(cleared){
   for(const y of rows)for(let i=0;i<W;i++)document.querySelector(`[data-pakuris-index="${y*W+i}"]`)?.classList.add('popping');
   sfx.play('CARD_FLIP',{volume:.42});
   if(!S.set.reduce)await new Promise(r=>setTimeout(r,160));
   if(currentEpoch!==matchEpoch)return;
   board=Array(cleared*W).fill(null).concat(board.filter((_,i)=>!rows.includes(Math.floor(i/W))));
   combo++;lines+=cleared;score+=([0,100,300,500,800][cleared]||800)*combo;
  }else combo=0;
  const allClear=cleared>0&&board.every(v=>!v);
  if(allClear)cut({text:'全消し',tone:'felt',ms:1300});
  const attack=(cleared>=2?cleared-1:0)+Math.max(0,combo-1)+(allClear?5:0);
  const cancel=Math.min(garbage,attack);garbage-=cancel;
  const incoming=Math.min(garbage,8);
  for(let i=0;i<incoming;i++){
   if(board.slice(0,W).some(Boolean))ended=true;
   const gap=(seed+i)%W;
   board=board.slice(W).concat(Array.from({length:W},(_,x)=>x===gap?null:'garbage'));
  }
  if(incoming)sfx.play('WOOD',{volume:.19});
  garbage-=incoming;spawn();animating=false;redraw();fallingMatch.progress('pakuris',attack-cancel);
 }
 function hardDrop(){if(ended||animating)return;while(fits({...active,y:active.y+1}))active.y++;lock();}
 function action(a){if(a==='left')tryMove(-1,0);else if(a==='right')tryMove(1,0);else if(a==='down')tryMove(0,1);else if(a==='rotate')rotate();else if(a==='drop')hardDrop();}
 function key(k){const a={ArrowLeft:'left',ArrowRight:'right',ArrowDown:'down',ArrowUp:'rotate',' ':'drop'}[k];if(playing()&&a){action(a);return true;}return false;}
 setInterval(()=>{if(playing()&&!document.hidden&&!ended&&active)tryMove(0,1);},650);
 function tile(v,falling){return v?`<span class="pakuris-block ${v} ${falling?'falling':''}"></span>`:'';}
 function boardHtml(){const a=board.slice();if(!ended&&!animating)cells().forEach(([x,y])=>{if(y>=0&&x>=0&&x<W&&y<H)a[y*W+x]=active.type;});return a.map((v,i)=>`<span class="pakuris-slot" data-pakuris-index="${i}">${tile(v,board[i]!==v)}</span>`).join('');}
 function redraw(){if(!playing()||!board)return;const e=document.getElementById('pakurisBoard');if(e){fallingMatch.paintMotion(e,boardHtml(),lastActive,animating?null:active);lastActive=animating?null:active&&{x:active.x,y:active.y};}const s=document.getElementById('pakurisScore');if(s)s.textContent=score;const l=document.getElementById('pakurisLines');if(l)l.textContent=lines;const n=document.getElementById('pakurisNext');if(n)n.innerHTML=queue.map(x=>`<span class="pakuris-block ${x}"></span>`).join('');const o=document.getElementById('pakurisOver');if(o)o.hidden=!ended;}
 function playHtml(on=false){return `<div class="screen"><div class="stage pakuris-stage"><div class="stagehead"><button class="btn" ${on?'data-extra-exit':'data-pakuris-exit'} aria-label="戻る">${ic('back')}</button><h2>パクリス</h2></div><div class="pakuris-board" id="pakurisBoard">${boardHtml()}</div><div class="pakuris-controls"><button data-pakuris="left" aria-label="左">◀</button><button data-pakuris="rotate" aria-label="回転">⟳</button><button data-pakuris="right" aria-label="右">▶</button><button data-pakuris="down" aria-label="下">▼</button><button data-pakuris="drop" aria-label="落下">⤓</button></div><div class="pakuris-over" id="pakurisOver" ${ended?'':'hidden'}>ゲーム終了</div><button class="btn play-settings" data-pakuris-settings aria-label="設定">${ic('set')}</button><div class="cutlayer" id="cutlayer"></div></div><aside class="side"><div class="panel"><h3>スコア</h3><div class="row"><span id="pakurisScore">${score}</span><span>ライン <b id="pakurisLines">${lines}</b></span></div></div><div class="panel"><h3>次のブロック</h3><div class="pakuris-next" id="pakurisNext">${queue.map(x=>`<span class="pakuris-block ${x}"></span>`).join('')}</div></div>${on?fallingMatch.sidebar():''}</aside></div>`;}
 fallingMatch.bind('pakuris',{showSetup,startSolo,playHtml,redraw,startLinked:(s,playing)=>{fresh(s);ended=!playing;},
   receive:n=>{garbage+=n;},finish:()=>{ended=true;},progress:()=>({score,over:ended,
     board:board.map(v=>v==='garbage'?'8':v?String(Object.keys(SHAPES).indexOf(v)):'.').join('')})});
 return {setup,setupHtml,start:()=>fallingMatch.start('pakuris'),playHtml,action,key};
})();
