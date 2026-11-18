'use strict';
const bunyoGame=(()=>{
 const W=6,H=12,C=['red','blue','green','yellow','purple'];let cells,pair,next,score,chains,ended,seed,garbage=0,animating=false,matchEpoch=0,lastPair=null;
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return C[(seed>>>16)%C.length];};
 const around=i=>[i%W?i-1:-1,i%W<W-1?i+1:-1,i>=W?i-W:-1,i<W*(H-1)?i+W:-1].filter(v=>v>=0);
 function groups(a){const seen=new Set(),out=[];for(let i=0;i<a.length;i++){if(!a[i]||a[i]==='garbage'||seen.has(i))continue;const q=[i],g=[];seen.add(i);while(q.length){const k=q.pop();g.push(k);for(const j of around(k))if(!seen.has(j)&&a[j]===a[i]){seen.add(j);q.push(j);}}if(g.length>=4)out.push(g);}return out;}
 function gravity(a){for(let x=0;x<W;x++){let y=H-1;for(let z=H-1;z>=0;z--)if(a[z*W+x]){a[y*W+x]=a[z*W+x];if(y!==z)a[z*W+x]=null;y--;}for(;y>=0;y--)a[y*W+x]=null;}}
 function resolve(a){const steps=[];for(;;){const g=groups(a);if(!g.length)break;const deleted=new Set(g.flat());for(const i of [...deleted])for(const j of around(i))if(a[j]==='garbage')deleted.add(j);for(const i of deleted)a[i]=null;gravity(a);steps.push({removed:[...deleted],groups:g,board:a.slice()});}return steps;}
 function fresh(randomSeed){seed=randomSeed;garbage=0;animating=false;lastPair=null;matchEpoch++;cells=Array(W*H).fill(null);score=0;chains=0;ended=false;pair={x:2,y:0,dir:0,colors:[rand(),rand()]};next=[rand(),rand()];}
 const offs=[[0,-1],[1,0],[0,1],[-1,0]];
 function places(p=pair){return [[p.x,p.y],[p.x+offs[p.dir][0],p.y+offs[p.dir][1]]];}
 function fits(p){return places(p).every(([x,y])=>x>=0&&x<W&&y<H&&(y<0||!cells[y*W+x]));}
 function showSetup(){go('bunyoSetup');}
 function setup(on=false){fallingMatch.setup('bunyo',on);}
 function setupHtml(){return fallingMatch.setupHtml('bunyo');}
 function startSolo(){fresh(crypto.getRandomValues(new Uint32Array(1))[0]);go('bunyoPlay');}
 function active(){return S.screen==='bunyoPlay'||(S.screen==='extraPlay'&&fallingMatch.linked('bunyo'));}

 function step(dx,dy,rot=0){if(ended||!pair||animating)return;const p={...pair,x:pair.x+dx,y:pair.y+dy,dir:(pair.dir+rot+4)%4};if(fits(p)){pair=p;redraw();}else if(dy>0)drop();}
 function addGarbage(){
  const amount=Math.min(garbage,W*3);
  garbage-=amount;
  for(let i=0;i<amount;i++){
   const x=i%W;
   let y=0;
   while(y+1<H&&!cells[(y+1)*W+x])y++;
   if(cells[y*W+x]){ended=true;continue;}
   cells[y*W+x]='garbage';
  }
  if(amount&&!ended)sfx.play('WOOD',{volume:.12,rate:.82});
 }
 async function drop(){
  if(ended||animating)return;
  const currentEpoch=matchEpoch;
  while(fits({...pair,y:pair.y+1}))pair.y++;
  const positions=places();
  if(positions.some(([,y])=>y<0)){ended=true;redraw();fallingMatch.progress('bunyo');return;}
  for(const [k,[x,y]] of positions.entries())cells[y*W+x]=pair.colors[k];
  pair=null;
  const resolved=cells.slice(),result=resolve(resolved);
  chains=0;animating=true;redraw();
  for(const [i,step] of result.entries()){
   if(currentEpoch!==matchEpoch||!active())break;
   chains=i+1;
   for(const index of step.removed)document.querySelector(`[data-bunyo-index="${index}"]`)?.classList.add('popping');
   if(!S.set.reduce)await new Promise(r=>setTimeout(r,220));
   if(currentEpoch!==matchEpoch)return;
   cells=step.board;redraw();
   sfx.play('CARD_FLIP',{volume:.3,rate:1+Math.min(i,4)*.09});
  }
  if(currentEpoch!==matchEpoch)return;
  cells=resolved;chains=result.length;
  score+=result.reduce((n,s,k)=>n+s.removed.length*10*(k+1),0);
  const allClear=chains>0&&cells.every(v=>!v);
  if(chains>1)cut({text:`${chains}連鎖`,tone:'felt',ms:950});
  if(allClear)cut({text:'全消し',tone:'felt',ms:1300});
  const attack=chains?Math.min(24,Math.floor(result.reduce((n,s,k)=>n+s.removed.length*(k+1),0)/3)+(allClear?6:0)):0;
  const cancelled=Math.min(garbage,attack);garbage-=cancelled;
  addGarbage();
  pair={x:2,y:0,dir:0,colors:next};next=[rand(),rand()];
  if(!fits(pair))ended=true;
  animating=false;redraw();fallingMatch.progress('bunyo',attack-cancelled);
 }
 function drawCell(color,overlay=false,links=''){return `<span class="bunyo-piece ${color||'empty'} ${overlay?'falling':''} ${links}"><i class="eyes"><i></i><i></i></i></span>`;}
 function boardHtml(){const copy=cells.slice();if(pair&&!ended)places().forEach(([x,y],k)=>{if(y>=0&&x>=0&&x<W&&y<H)copy[y*W+x]=pair.colors[k]});return copy.map((v,i)=>{const links=v?['top','right','bottom','left'].filter((d,k)=>{const j=[i-W,i+1,i+W,i-1][k];return j>=0&&j<copy.length&&(k!==1||i%W<W-1)&&(k!==3||i%W>0)&&copy[j]===v;}).map(d=>'link-'+d).join(' '):'';return `<span class="bunyo-slot" data-bunyo-index="${i}">${v?drawCell(v,cells[i]!==v,links):''}</span>`;}).join('');}
 function redraw(){if(!active()||!cells)return;const b=document.getElementById('bunyoBoard');if(b){fallingMatch.paintMotion(b,boardHtml(),lastPair,pair);lastPair=pair&&{x:pair.x,y:pair.y};}const n=$('#bunyoNext');if(n)n.innerHTML=next.map(c=>drawCell(c)).join('');const s=document.getElementById('bunyoScore');if(s)s.textContent=score;const c=document.getElementById('bunyoChain');if(c)c.textContent=chains?`${chains}連鎖`:'';const o=document.getElementById('bunyoOver');if(o)o.hidden=!ended;const status=$('#fallingSoloStatus');if(status)status.textContent=ended?'ゲーム終了':'プレイ中';}
 function playHtml(on=false){
  const stats = `<div class="panel"><h3>スコア</h3><div class="row"><b id="bunyoScore">${score}</b><b id="bunyoChain">${chains?`${chains}連鎖`:''}</b></div></div>`;
  const preview = `<div class="panel"><h3>次のピース</h3><div class="bunyo-next" id="bunyoNext">${next.map(c=>drawCell(c)).join('')}</div></div>`;
  const side = fallingMatch.sidebar('bunyo',on,stats,preview,ended);
  return `<div class="screen"><div class="stage bunyo-stage">
    ${playHeader('ぶにょぶにょ',playMode(on),on?'data-extra-exit':'data-bunyo-exit')}
    <div class="bunyo-board" id="bunyoBoard">${boardHtml()}</div>
    <div class="bunyo-controls"><button data-bunyo="left" aria-label="左">◀</button><button data-bunyo="rotate" aria-label="回転">⟳</button><button data-bunyo="right" aria-label="右">▶</button><button data-bunyo="down" aria-label="落とす">▼</button></div>
    <div class="bunyo-over" id="bunyoOver" ${ended?'':'hidden'}>ゲーム終了</div>
    ${playGear()}<div class="cutlayer" id="cutlayer"></div></div>${side}</div>`;
 }
 function action(a){if(a==='left')step(-1,0);else if(a==='right')step(1,0);else if(a==='rotate')step(0,0,1);else if(a==='down')drop();}
 function key(k){const a={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'rotate',ArrowDown:'down',' ':'down'}[k];if(active()&&a){action(a);return true;}return false;}
 // The falling clock is independent of repainting the page. It only advances the
 // current game while its board is visible, so leaving the page cannot queue moves.
 fallingMatch.tick('bunyo',700,()=>active()&&!ended&&pair,()=>step(0,1));
 fallingMatch.bind('bunyo',{showSetup,startSolo,playHtml,redraw,startLinked:(s,playing)=>{fresh(s);ended=!playing;},
   receive:n=>{garbage+=n;},finish:()=>{ended=true;},progress:()=>({score,over:ended,
     board:cells.map(v=>v==='garbage'?'8':v?String(C.indexOf(v)):'.').join('')})});
 return {setup,setupHtml,start:()=>fallingMatch.start('bunyo'),playHtml,action,key,groups,resolve,gravity};
})();
