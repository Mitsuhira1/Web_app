(()=>{
// 盤面と操作の対応。ルールと合法手の判定はコアが担当する。
const at = (x,y,html) => `<div class="anchor" style="left:${x}px;top:${y}px">${html}</div>`;
const lab = (s) => `<span class="board-label">${s}</span>`;
const note = (s) => `<span class="board-note">${s}</span>`;
const labelAt=(x,y,s)=>at(x,y,lab(s));
const card = (c,w=74,cls='',key='') => {
  const style=`style="--cw:${w}px" ${key ? `data-piece="${key}"` : ''}`;
  if(!c) return `<span class="pc back ${cls}" ${style}></span>`;
  if(c.t==='JOKER')return `<span class="pc joker ${cls}" ${style}><i class="ix">JO<br>KER</i><b>★</b></span>`;
  const [s,...r]=c.t; return `<span class="pc ${'♥♦'.includes(s)?'r':''} ${cls}" ${style}><i class="ix">${r.join('')}<br>${s}</i><b>${s}</b></span>`;
};
const row=(html,gap=7)=>`<div class="piece-row" style="gap:${gap}px">${html.join('')}</div>`;
const deck=(n,w=76,key='')=>n>0?`<div class="card-stack" ${key ? `data-piece="${key}"` : ''}>${card(null,w)}</div>`:slot(w);
const slot=(w=70)=>`<span class="pc slot" style="--cw:${w}px"></span>`;
const table=(body,cls='')=>`<div class="twelve-table table ${cls}"><div class="feltin"></div></div>${body}`;
const own=(text)=>lab(text || 'あなた');
const seatAt = (A,x,y,i,count) => at(x,y,`<div class="seat-name" data-public-seat="${i}"><i>${esc(A.name(i)[0])}</i>${esc(A.name(i))}${count!=null?`<em>${count}枚</em>`:''}</div>`);
const countSeats = A => A.view.seats.length;
const ownSeat = (b) => Math.max(0, b.me);
const relSeat = (b,A,offset) => (ownSeat(b)+offset)%countSeats(A);
const handWidth = (preferred,count,gap) => Math.min(preferred,Math.floor((814-gap*(count-1))/Math.max(1,count)));
const control = (html,attr,label,enabled=true,cls='') => enabled
  ? `<button type="button" class="twelve-control ${cls}" ${attr} aria-label="${esc(label)}">${html}</button>`
  : `<span class="twelve-static ${cls}" ${attr}>${html}</span>`;
const move = (A,m,html,label,cls='') => control(html,`data-m="${m}"`,label,A.canPlay && A.legal.has(m),cls);
const groupCards=(a,w,gap=5)=>row(a.map(c=>card(c,w)),gap);
const boards = {};
boards.war = (b,A) => {
  const body = [
    labelAt(450,84,'第'+Math.max(1,b.battles)+'戦'),
    at(450,266,'<span class="versus">対</span>')
  ];
  for (const offset of [0,1]) {
    const i=relSeat(b,A,offset), x=offset?579:321, stock=offset?764:136;
    const face=b.faceUp[i];
    const rem=b.warBlindLeft[i];
    const faceHtml=face ? card(face,114,i===b.lastWinner?'hi':'','war-face-'+i) : slot(114);
    const stack=b.totalCounts[i] ? deck(b.deckCounts[i],69,'war-deck-'+i) : slot(69);
    body.push(seatAt(A,x,145,i),at(x,274,faceHtml),at(stock,271,
      i===b.turn ? move(A,0,stack,'札を出す') : stack));
    body.push(at(stock,347,note('山札 '+b.deckCounts[i]+'枚')),at(x,395,lab('獲得 '+b.wonCounts[i]+'枚')));
    if (b.war) body.push(at(x,429,note('伏せ札 あと'+rem+'枚')));
  }
  if (b.war) body.push(at(450,472,lab('戦争　場札 '+b.potCount+'枚')));
  return table(body.join(''),'oval');
};

boards.takoyaki = (b,A) => {
  const me=ownSeat(b);
  const layout=(seat,cx,cy,w,interactive) => {
    const dx=w+14,dy=w*1.4+18;
    return b.boards[seat].slice(0,b.targets[seat]).map((c,j)=>{
      const x=cx+(j%5-2)*dx,y=cy+(Math.floor(j/5)-.5)*dy;
      const m=(b.phase==='bomb'?30:10)+j;
      const face=card(c,w,interactive&&A.legal.has(m)?'selectable':'','tako-'+seat+'-'+j);
      const contents=face+(!c?`<b class="slot-num">${j+1}</b>`:'');
      return at(x,y,interactive?move(A,m,contents,(j+1)+'番の札'):contents);
    }).join('');
  };
  const oppX=b.n===2?[395]:b.n===3?[240,525]:[197,395,593];
  const oppW=b.n===2?51:b.n===3?40:25;
  let html='';
  oppX.forEach((x,i)=>{
    const seat=relSeat(b,A,i+1);
    html+=seatAt(A,b.n===2?122:x,b.n===2?128:68,seat)+layout(seat,x,b.n===2?138:157,oppW,false);
  });
  html+=seatAt(A,122,365,me)+layout(me,395,385,69,b.me===me);
  html+=at(738,119,move(A,0,deck(b.stockCount,57),'山札から引く'))+at(738,175,note('山札 '+b.stockCount+'枚'));
  html+=at(738,246,move(A,1,b.discardTop?card(b.discardTop,57,'','tako-discard'):slot(57),'捨て札を引く'))+at(738,301,note('捨て札'));
  html+=at(738,415,b.held?card(b.held,80,'hi','tako-held'):slot(80))+at(738,492,lab('引いた札'));
  return table(html,'rect');
};

boards.butanoshippo = (b,A) => {
  const handPlay=A.canPlay && A.view.legal.some(m=>m>=100);
  let html='';
  b.ring.forEach((exists,i)=>{
    if(!exists)return;
    const a=2*Math.PI*i/b.ring.length-Math.PI/2;
    const face=move(A,i,card(null,47,'','ring-'+i),(i+1)+'番の札をめくる');
    html+=at(450+251*Math.cos(a),(handPlay?223:266)+(handPlay?127:151)*Math.sin(a),
      `<div style="transform:rotate(${a*180/Math.PI+90}deg)">${face}</div>`);
  });
  const dy=handPlay?-43:0;
  html+=at(450,247+dy,b.pileTop?card(b.pileTop,82,'','pig-pile'):slot(82));
  html+=at(450,329+dy,lab('場札 '+b.pileCount+'枚'))+at(450,handPlay?410:493,note('残り '+b.ringRemain+'枚'));
  if(handPlay){
    const width=handWidth(62,b.myHand.length,3);
    html+=at(450,482,row(b.myHand.map((c,i)=>move(A,100+i,card(c,width,'','pig-hand-'+i),c.t+'を出す')),3));
  }
  return table(html,'oval');
};

boards.oldmaid = (b,A) => {
  if (b.target < 0) {
    const remaining=b.myHand.length?b.myHand:[b.removedCard].filter(Boolean);
    return table(at(450,250,groupCards(remaining,104)),'rect');
  }
  const cards=b.handCounts[b.target];
  const spread=Math.min(9,92/Math.max(1,cards-1));
  const radius=325, width=Math.min(91, 1160/Math.max(1,cards));
  let fan='';
  for(let i=0;i<cards;i++){
    const theta=(i-(cards-1)/2)*spread, rad=theta*Math.PI/180;
    const contents=move(A,i,card(null,width,'','maid-fan-'+i),(i+1)+'番目の札を引く');
    fan+=at(450+Math.sin(rad)*radius,235+radius*(1-Math.cos(rad)),
      `<div class="maid-fan-card" data-maid-index="${i}" style="transform:rotate(${theta}deg)">${contents}</div>`);
  }
  const hand=row(b.myHand.map((c,i)=>`<span data-maid-own="${i}">${card(c,handWidth(78,b.myHand.length,8),'','maid-own-'+i)}</span>`),8);
  const ownHand=b.me<0?'':at(450,380,own(esc(A.name(b.me))))+at(450,456,hand);
  return table(seatAt(A,450,99,b.target,cards)+fan+ownHand,'rect');
};

boards.hearts = (b,A) => {
  const coords=[[450,323],[345,236],[450,158],[555,236]];
  let html='';
  [[160,229],[450,69],[740,229]].forEach(([x,y],i)=>{
    const s=relSeat(b,A,i+1);
    html+=seatAt(A,x,y,s,b.handCounts[s]);
  });
  for (let i=0;i<4;i++) {
    const seat=relSeat(b,A,i), trick=b.trick.find(t=>t.seat===seat);
    if (b.phase==='play') html+=at(...coords[i],trick?card(trick.card,67,'','hearts-trick-'+seat):slot(61));
  }
  const passing=b.phase==='pass';
  if (passing && b.me>=0) {
    const partner=b.passDir>0?b.passDir:null;
    const label=partner==null?'手札交換':A.name(relSeat(b,A,partner))+' に渡す札';
    html+=at(450,185,lab(esc(label)))+at(450,277,row(Array.from({length:3},(_,i)=>{
      const c=b.myHand.find(c=>c.id===b.myPassPicks[i]); return c?card(c,58):slot(58);
    })));
  }
  html+=at(450,407,lab(passing?'手札交換':'第'+b.trickNo+'トリック'));
  const w=handWidth(63,b.myHand.length,5);
  html+=at(450,489,row(b.myHand.map(c=>move(A,c.id,
    card(c,w,b.myPassPicks.includes(c.id)?'hi':A.canPlay&&!A.legal.has(c.id)?'muted':'','hearts-hand-'+c.id),
    c.t+(passing?'を選ぶ':'を出す'))),5));
  return table(html,'handtable');
};

boards.ginrummy = (b,A) => {
  let html=seatAt(A,450,83,relSeat(b,A,1),b.oppCount);
  html+=at(356,237,move(A,0,deck(b.stockCount,91),'山札から引く'));
  html+=at(536,237,move(A,1,b.discardTop?card(b.discardTop,91,'','gin-discard'):slot(91),'捨て札を引く'));
  html+=at(356,326,lab('山札 '+b.stockCount+'枚'))+at(536,326,lab('捨て札'));
  const melded=new Set(b.myMelds.flat().map(c=>c.id));
  const sets=[...b.myMelds,b.myHand.filter(c=>!melded.has(c.id))];
  const w=handWidth(64,b.myHand.length,Math.max(1,sets.length*2));
  const hand=sets.map((set,i)=>`<div class="meld ${i===sets.length-1?'loose':''}">${row(set.map(c=>{
    const selected=A.selected===c.id;
    const face=card(c,w,selected?'hi':'','gin-hand-'+c.id);
    return b.phase==='discard'?control(face,`data-src="${c.id}"`,c.t+'を選ぶ',A.canPlay&&(A.legal.has(10+c.id)||A.legal.has(100+c.id))):face;
  }),1)}</div>`);
  if (b.me>=0) html+=at(450,402,lab('デッドウッド '+b.myDeadwood+'点'))+at(450,489,row(hand,12));
  return table(html,'handtable');
};
const bird=`<svg viewBox="0 0 120 96" width="104" height="83" aria-hidden="true"><g fill="none" stroke="#e1ae65" stroke-width="1" opacity=".45"><circle cx="61" cy="44" r="31"/><circle cx="61" cy="44" r="26"/></g><path d="M8 28Q25 31 42 38L50 43Q59 41 66 47Q72 33 103 16L116 12 107 23 112 21 99 32 104 30 91 42 96 39 82 53Q73 61 67 64L60 81 56 74 52 78 52 64Q45 60 43 54L29 50 32 48 18 43 24 44 12 35 19 37Z" fill="#f0c37d"/><path d="M46 52Q44 44 48 39Q52 32 58 36L63 38 62 43 58 40Q54 39 55 45L58 50 63 54 57 59Z" fill="#fff5d9"/><path d="M59 37l7 3-4 4-1-3z" fill="#ad5a40"/><circle cx="56" cy="37.5" r="1.3" fill="#322532"/></svg>`;
const bid=n=>`<span class="bid"><b>${n}</b><i>◆</i></span>`;
boards.vulture = (b,A) => {
  let html=at(450,209,`<div class="prize">${bird}<b>${b.currentTarget>0?'+':''}${b.currentTarget}</b></div>`)+at(450,308,lab('得点札'));
  const pos=[[200,161],[608,88],[700,185],[321,74]];
  for(let i=1;i<b.n;i++){
    const [x,y]=pos[i-1], seat=relSeat(b,A,i);
    html+=seatAt(A,x,y,seat)+at(x,y+73,b.pickedFlags[seat]?card(null,53,'','bid-'+seat):slot(53));
  }
  html+=seatAt(A,297,287,ownSeat(b))+at(297,348,b.myPick?bid(b.myPick):slot(48));
  const round='第'+b.roundNo+'戦'+(b.carryPot.length?'　持ち越し '+b.carryPot.join('・'):'');
  html+=at(450,87,lab(round))+at(450,490,row(b.myHand.map(n=>move(A,n,bid(n),n+'を出す')),5));
  return table(html,'handtable');
};
const piece=(v,b,size=56)=>`<svg class="goita-piece" style="--p:${size}px" viewBox="-23 -34 46 71" aria-hidden="true">${goitaStone(0,0,0,v<0?'':esc(b.pieceNames[v]))}</svg>`;
boards.goita = (b,A) => {
  let html='<div class="goita-table"></div>';
  const places=[[450,342],[201,223],[450,104],[699,223]];
  for(let i=0;i<4;i++){
    const seat=relSeat(b,A,i),[x,y]=places[i];
    html+=at(x,y-46,`<span class="goita-name team${seat%2}" data-public-seat="${seat}">${esc(A.name(seat))}</span>`);
    const pairs=b.played[seat].map((p,j)=>`<div class="goita-play" data-piece="goita-${seat}-${j}">${piece(p,b,40)}<small>${j%2?'攻め':'受け'}</small></div>`);
    html+=at(x,y+14,row(pairs,5));
  }
  if(b.activeAttack>=0) html+=at(450,226,`<span class="attack-name">攻め <strong>${b.activeAttackName}</strong></span>`);
  if(b.me>=0) html+=at(450,489,`<div class="wood-rack">${row(b.myHand.map(p=>move(A,p,piece(p,b,63),b.pieceNames[p]+'を出す')),12)}</div>`);
  return html;
};
const svg=(w,h,body)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`;
const qName=p=>[p&1?'濃色':'淡色',p&2?'高':'低',p&4?'四角':'丸',p&8?'穴あり':'穴なし'].join('・');
// クアルト: 盤・穴・駒を 3 次元の座標で作り、遠近法で写して描く(奥から順に塗る)。
// 座標: 盤の上面が y=0、x は右、z は手前。升は 1。光は左手前の上から。
const Q3={yaw:24*Math.PI/180, pitch:47*Math.PI/180, dist:11, holeR:.37, holeD:.15, light:(()=>{const v=[-.55,1,.42],n=Math.hypot(...v);return v.map(x=>x/n);})()};
const qRaw=(x,y,z)=>{
  const c=Math.cos(Q3.yaw),s=Math.sin(Q3.yaw),xr=x*c-z*s,zr=x*s+z*c;
  const cp=Math.cos(Q3.pitch),sp=Math.sin(Q3.pitch);
  const up=y*cp-zr*sp, depth=Q3.dist-(y*sp+zr*cp);
  return [xr/depth,-up/depth,depth];
};
// 範囲 pts(生の座標)を幅 w・高さ h に収める写し方
const qFit=(pts,w,h,m)=>{
  let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
  for(const [x,y,z] of pts){const r=qRaw(x,y,z);x0=Math.min(x0,r[0]);x1=Math.max(x1,r[0]);y0=Math.min(y0,r[1]);y1=Math.max(y1,r[1]);}
  const k=Math.min((w-2*m)/(x1-x0),(h-2*m)/(y1-y0)),ox=w/2-k*(x0+x1)/2,oy=h/2-k*(y0+y1)/2;
  return (x,y,z)=>{const r=qRaw(x,y,z);return [ox+k*r[0],oy+k*r[1],r[2]];};
};
const qPath=pts=>'M'+pts.map(p=>p[0].toFixed(1)+' '+p[1].toFixed(1)).join('L')+'Z';
const qCircle=(P,cx,y,cz,r,n=40)=>Array.from({length:n},(_,i)=>{const a=i/n*2*Math.PI;return P(cx+r*Math.cos(a),y,cz+r*Math.sin(a));});
const qHull=pts=>{
  const a=pts.slice().sort((p,q)=>p[0]-q[0]||p[1]-q[1]),cr=(o,p,q)=>(p[0]-o[0])*(q[1]-o[1])-(p[1]-o[1])*(q[0]-o[0]);
  const lo=[],hi=[];
  for(const p of a){while(lo.length>1&&cr(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop();lo.push(p);}
  for(const p of a.slice().reverse()){while(hi.length>1&&cr(hi[hi.length-2],hi[hi.length-1],p)<=0)hi.pop();hi.push(p);}
  return lo.slice(0,-1).concat(hi.slice(0,-1));
};
const qShade=(hex,k)=>'#'+[1,3,5].map(i=>Math.max(0,Math.min(255,Math.round(parseInt(hex.slice(i,i+2),16)*k))).toString(16).padStart(2,'0')).join('');
const qWood=id=>id&1?'#8a5434':'#ecc68e';
const qDim=id=>({tall:!!(id&2),square:!!(id&4),hole:!!(id&8),h:(id&2?1.0:.52),r:.30,half:.235});
// 駒 1 個。base は底の高さ(穴の底なら -holeD)。cut を渡すと、その高さより下は描かない。
const qPiece=(id,P,cx,cz,base,uid,cut=null)=>{
  const d=qDim(id),col=qWood(id),L=Q3.light,top=base+d.h+Q3.holeD,bot=cut==null?base:Math.max(base,cut);
  let out='';
  if(d.square){
    const h=d.half,c=[[-h,-h],[h,-h],[h,h],[-h,h]].map(([x,z])=>[cx+x,cz+z]);
    const normals=[[0,0,-1],[1,0,0],[0,0,1],[-1,0,0]];
    for(let i=0;i<4;i++){
      const [ax,az]=c[i],[bx,bz]=c[(i+1)%4];
      const f=[P(ax,bot,az),P(bx,bot,bz),P(bx,top,bz),P(ax,top,az)];
      const area=(f[1][0]-f[0][0])*(f[2][1]-f[0][1])-(f[1][1]-f[0][1])*(f[2][0]-f[0][0]);
      if(area<=0) continue; // 裏を向いた面
      const n=normals[i],lam=Math.max(0,n[0]*L[0]+n[2]*L[2]);
      out+=`<path d="${qPath(f)}" fill="${qShade(col,.52+.62*lam)}"/><path d="${qPath(f)}" fill="url(#q3-grain)" opacity=".35"/>`;
    }
    const t=c.map(([x,z])=>P(x,top,z));
    out+=`<path d="${qPath(t)}" fill="${qShade(col,.62+.5*L[1])}" stroke="${qShade(col,.55)}" stroke-width=".7"/>`;
  }else{
    const B=qCircle(P,cx,bot,cz,d.r,36),T=qCircle(P,cx,top,cz,d.r,36);
    const side=qHull(B.concat(T));
    out+=`<path d="${qPath(side)}" fill="url(#q3-cyl${id&1})"/><path d="${qPath(side)}" fill="url(#q3-grain)" opacity=".3"/>`;
    out+=`<path d="${qPath(T)}" fill="${qShade(col,.62+.5*L[1])}" stroke="${qShade(col,.55)}" stroke-width=".7"/>`;
  }
  if(d.hole){
    const rim=qCircle(P,cx,top,cz,.12,28),floor=qCircle(P,cx,top-.13,cz,.12,28),cid=`q3h-${uid}`;
    out+=`<clipPath id="${cid}"><path d="${qPath(rim)}"/></clipPath><path d="${qPath(rim)}" fill="${qShade(col,.32)}"/>`+
      `<path d="${qPath(floor)}" fill="${qShade(col,.5)}" clip-path="url(#${cid})"/>`;
  }
  return out;
};
// 駒の影(光と逆向きに盤の上へ落とす)
const qShadow=(id,P,cx,cz)=>{
  const d=qDim(id),L=Q3.light,H=d.h,pts=[];
  const k=[-L[0]/L[1],-L[2]/L[1]];
  const ring=d.square?[[-d.half,-d.half],[d.half,-d.half],[d.half,d.half],[-d.half,d.half]]:Array.from({length:24},(_,i)=>{const a=i/24*2*Math.PI;return [d.r*Math.cos(a),d.r*Math.sin(a)];});
  for(const [x,z] of ring){pts.push(P(cx+x,0,cz+z));pts.push(P(cx+x+k[0]*H,0,cz+z+k[1]*H));}
  return `<path d="${qPath(qHull(pts))}" fill="#2a170c" opacity=".30" filter="url(#q3-blur)"/>`;
};
const qDefs=`<defs>
  <linearGradient id="q3-cyl0" x2="1"><stop stop-color="#d9ad70"/><stop offset=".22" stop-color="#fbe2b4"/><stop offset=".55" stop-color="#e2b273"/><stop offset="1" stop-color="#93622f"/></linearGradient>
  <linearGradient id="q3-cyl1" x2="1"><stop stop-color="#7a4a2d"/><stop offset=".22" stop-color="#aa7149"/><stop offset=".55" stop-color="#7a472b"/><stop offset="1" stop-color="#3a2014"/></linearGradient>
  <linearGradient id="q3-top" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f3d39f"/><stop offset=".6" stop-color="#ddb07a"/><stop offset="1" stop-color="#c8945c"/></linearGradient>
  <linearGradient id="q3-side" x2="1"><stop stop-color="#a8754a"/><stop offset=".5" stop-color="#8a5b38"/><stop offset="1" stop-color="#5e3b25"/></linearGradient>
  <linearGradient id="q3-wall" x2="0" y2="1"><stop stop-color="#4a2c18"/><stop offset=".5" stop-color="#7a5232"/><stop offset="1" stop-color="#a57a52"/></linearGradient>
  <pattern id="q3-grain" width="80" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(-8)">
    <path d="M0 4q20-2 40 0t40 0M0 10q26-2 52 0t28 0" fill="none" stroke="#5a3a22" stroke-opacity=".22" stroke-width="1"/>
  </pattern>
  <filter id="q3-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2"/></filter>
</defs>`;
// 置く駒・残りの駒の欄: どの駒でも同じ枠(高い駒が収まる大きさ)に描く
const qBoxP=(()=>{const pts=[];for(const [x,z] of [[-.32,-.32],[.32,-.32],[.32,.32],[-.32,.32]])for(const y of [0,1.0+Q3.holeD])pts.push([x,y,z]);return pts;})();
const qBox=(p,w,h,uid)=>{
  if(p<0) return svg(w,h,'');
  const P=qFit(qBoxP,w,h,3);
  const sh=qCircle(P,.06,0,-.04,.36,24);
  return svg(w,h,`<path d="${qPath(sh)}" fill="#160c06" opacity=".35"/>`+qPiece(p,P,0,0,0,uid));
};
boards.quarto = (b,A) =>{
  const W=620,H=470,E=2.3,T=.3,RC=.28;
  // 盤の外形(角を丸めた正方形)
  const outline=y=>{const pts=[];for(const [cx,cz,a0] of [[E-RC,E-RC,0],[-(E-RC),E-RC,90],[-(E-RC),-(E-RC),180],[E-RC,-(E-RC),270]])for(let i=0;i<=6;i++){const a=(a0+i*15)*Math.PI/180;pts.push([cx+RC*Math.cos(a),y,cz+RC*Math.sin(a)]);}return pts;};
  const fitPts=outline(0).concat(outline(-T));
  for(const x of [-1.5,1.5])for(const z of [-1.5,1.5])fitPts.push([x,1.0+Q3.holeD,z]);
  const P=qFit(fitPts,W,H,16);
  const proj=a=>a.map(([x,y,z])=>P(x,y,z));
  const top=proj(outline(0)),body=qHull(top.concat(proj(outline(-T))));
  const inner=proj(outline(0).map(([x,y,z])=>[x*.93,y,z*.93]));
  let art=qDefs+`<path d="${qPath(qHull(proj(outline(-T-.05)).map(([x,y])=>[x+4,y+5])))}" fill="#2a170c" opacity=".28" filter="url(#q3-blur)"/>
  <path d="${qPath(body)}" fill="url(#q3-side)" stroke="#4a2c1a" stroke-width="1.2"/>
  <path d="${qPath(body)}" fill="url(#q3-grain)" opacity=".5"/>
  <path d="${qPath(top)}" fill="url(#q3-top)" stroke="#6e4628" stroke-width="1.2"/>`;
  // 木目(盤の上の線を遠近で写す)
  for(let i=0;i<26;i++){
    const z=-E+.1+i*(2*E-.2)/25,ph=i*1.7,pts=[];
    for(let j=0;j<=24;j++){const x=-E+.08+j*(2*E-.16)/24;pts.push(P(x,0,z+.035*Math.sin(x*1.3+ph)+.02*Math.sin(x*3.1+ph*2)));}
    art+=`<path d="M${pts.map(p=>p[0].toFixed(1)+' '+p[1].toFixed(1)).join('L')}" fill="none" stroke="${i%3?'#7a4e2c':'#fff2d4'}" stroke-opacity="${i%3?.13:.22}" stroke-width="${i%4?.8:1.3}"/>`;
  }
  art+=`<path d="${qPath(inner)}" fill="none" stroke="#7a4f2e" stroke-opacity=".45" stroke-width="1.4"/>
  <path d="${qPath(inner.map(([x,y])=>[x,y+1.2]))}" fill="none" stroke="#fff0cf" stroke-opacity=".4" stroke-width="1"/>`;
  const cell=i=>[(i%4)-1.5,(i>>2)-1.5];
  const R=Q3.holeR,D=Q3.holeD;
  // 穴: 開口部(縁)の内側に、奥の壁と底が見える
  const holes=[];
  b.board.forEach((_,i)=>{
    const [x,z]=cell(i),rim=qCircle(P,x,0,z,R),floor=qCircle(P,x,-D,z,R);
    holes[i]=rim;
    art+=`<g data-quarto-cell="${i}"><clipPath id="q3c-${i}"><path d="${qPath(rim)}"/></clipPath>
      <path d="${qPath(qCircle(P,x,0,z,R+.035))}" fill="#c39060" opacity=".55"/>
      <path d="${qPath(rim)}" fill="url(#q3-wall)"/>
      <path d="${qPath(floor)}" fill="#946640" clip-path="url(#q3c-${i})"/>
      <path d="${qPath(rim)}" fill="none" stroke="#3e2414" stroke-opacity=".55" stroke-width="1"/></g>`;
  });
  const items=[];
  b.board.forEach((p,i)=>{if(p>=0)items.push({p,i});});
  const ghosts=b.phase==='place'&&b.chosenPiece>=0?b.board.map((p,i)=>p<0&&A.legal.has(i)?i:-1).filter(i=>i>=0):[];
  for(const i of ghosts) items.push({p:b.chosenPiece,i,ghost:true});
  for(const it of items){const [x,z]=cell(it.i);it.depth=P(x,.5,z)[2];}
  items.sort((a,z)=>z.depth-a.depth);
  for(const it of items) if(!it.ghost){const [x,z]=cell(it.i);art+=qShadow(it.p,P,x,z);}
  for(const it of items){
    const [x,z]=cell(it.i),uid=(it.ghost?'g':'b')+it.i;
    // 穴の中に沈んだ部分は開口部の中だけに見え、盤より上はそのまま見える
    const body=`<g clip-path="url(#q3c-${it.i})">${qPiece(it.p,P,x,z,-D,uid+'a')}</g>${qPiece(it.p,P,x,z,-D,uid,0)}`;
    art+=it.ghost?`<g class="q-ghost" data-ghost="${it.i}">${body}</g>`:`<g data-piece="quarto-${it.p}">${body}</g>`;
  }
  const OX=330-W/2,OY=290-H/2;
  const targets=b.board.map((p,i)=>{
    if(!(p<0&&b.phase==='place'&&A.legal.has(i))) return '';
    const rim=holes[i],xs=rim.map(q=>q[0]),ys=rim.map(q=>q[1]);
    const cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
    return at(OX+cx,OY+cy,move(A,i,`<i class="q-target" style="width:${(Math.max(...xs)-Math.min(...xs)+6).toFixed(0)}px;height:${(Math.max(...ys)-Math.min(...ys)+6).toFixed(0)}px"></i>`,'マス '+(i+1)));
  }).join('');
  const ghostCss=ghosts.length?`<style>${ghosts.map(i=>`.twelve-scene:has(.twelve-control[data-m="${i}"]:is(:hover,:focus-visible)) .q-ghost[data-ghost="${i}"]`).join(',')}{opacity:.5}</style>`:'';
  const pool=Array.from({length:16},(_,p)=>{
    if(b.usedMask&(1<<p)) return '<span class="q-empty"></span>';
    return b.phase==='pick'?move(A,p,qBox(p,50,62,'p'+p),qName(p)+'を渡す','q-cell'):`<span class="q-cell">${qBox(p,50,62,'p'+p)}</span>`;
  }).join('');
  const chosen=`<div class="chosen" ${b.chosenPiece>=0?`data-piece="quarto-${b.chosenPiece}"`:''}>${qBox(b.chosenPiece,84,100,'c')}</div>`;
  return ghostCss+at(330,290,svg(W,H,art))+targets+at(752,272,`<div class="qtray"><div class="tray-title">置く駒</div>${chosen}<div class="tray-title">残りの駒</div><div class="qpool">${pool}</div></div>`);
};
const ghost=(value)=>{
 const color=['','#368ab6','#c55c48','#cec2a5'][value],edge=['','#1e4962','#6c352c','#7e735f'][value];
 const fill=value===3?'url(#ghost-other)':'url(#ghost-own)';
 return svg(64,68,`<ellipse cx="33" cy="59" rx="25" ry="7" fill="#30291e" opacity=".28"/><path d="M8 53Q14 44 13 32Q12 13 25 9Q45 1 51 21Q53 29 51 36Q51 47 59 54Q61 60 55 61L47 57Q42 66 34 59Q27 68 20 59Q12 65 7 60Q4 58 8 53Z" fill="${fill}" stroke="${edge}" stroke-width="1.7"/>${value===3?'<ellipse cx="26" cy="27" rx="2.5" ry="4" fill="#5a5046"/><ellipse cx="39" cy="27" rx="2.5" ry="4" fill="#5a5046"/>':`<circle cx="33" cy="43" r="10" fill="${color}" stroke="${edge}" stroke-width="1.7"/><ellipse cx="30.5" cy="39.5" rx="3.7" ry="2.4" fill="#fff" opacity=".74"/>`}`);
};
const ghostHome=[[25,26,27,28,31,32,33,34],[1,2,3,4,7,8,9,10]];
boards.geister = (b,A) =>{
  const defs=svg(0,0,'<defs><radialGradient id="ghost-own" cx=".33" cy=".24" r=".9"><stop stop-color="#fffcf0"/><stop offset=".64" stop-color="#f4edd7"/><stop offset="1" stop-color="#a89f8b"/></radialGradient><radialGradient id="ghost-other" cx=".33" cy=".24" r=".9"><stop stop-color="#fffbec"/><stop offset=".66" stop-color="#eae0c7"/><stop offset="1" stop-color="#a2977d"/></radialGradient></defs>');
  const selected=A.selected ?? -1;
  const setup=b.phase==='setup';
  const home=ghostHome[b.me] || [];
  const cells=b.me===1?b.board.slice().reverse():b.board;
  const squares=cells.map((p,j)=>{
    const i=b.me===1?35-j:j;
    const a=home.indexOf(selected), n=home.indexOf(i);
    const swap=setup && a>=0 && n>=0 && A.legal.has(Math.min(a,n)*8+Math.max(a,n));
    const target=!setup && selected>=0 && A.legal.has(selected*36+i);
    const own=b.me>=0 && b.owners[i]===b.me;
    const dest=(swap||target)&&A.hints
      ? '<i class="dest-dot"></i>':'';
    const arrow={0:'↖',5:'↗',30:'↙',35:'↘'}[j];
    const contents=(arrow?`<b class="exit">${arrow}</b>`:'')+(p?ghost(p):'')+dest;
    return control(contents,`data-src="${i}" data-piece="ghost-${i}"`,'マス '+(j+1),
      A.canPlay&&(own||target),`ghost-cell parity${(Math.floor(j/6)+j%6)%2} ${i===selected?'picked':''}`);
  }).join('');
  return defs+at(450,270,`<div class="ghost-board">${squares}</div>`);
};
const tile=t=>`<span class="rummi-tile t${t.c}" data-piece="rummi-${t.id}"><b>${t.n||'★'}</b>${t.n===6 || t.n===9 ? '<i></i>' : ''}</span>`;
boards.rummikub = (b,A) =>{
 const scrollTable=b.table.length>9||b.table.some(set=>set.length>5);
 const groups=b.table.map((set,si)=>{
   const tiles=set.map((t,i)=>move(A,2000+si*32+i,tile(t),'場の'+t.t,
     b.selected?.src==='table'&&b.selected.setIdx===si&&b.selected.tileIdx===i?'tile-picked':''));
   const dest=A.legal.has(500+si);
   return `<div class="tile-set" data-rummi-set="${si}">${row(tiles,2)}${dest?move(A,500+si,'＋','この組に置く','tile-add'):''}</div>`;
 }).join('');
 const hand=b.racks[b.me]||[],cut=Math.ceil(hand.length/2);
 const rack=hand.map((t,i)=>move(A,100+i,tile(t),t.t+'を選ぶ',b.selected?.src==='rack'&&b.selected.idx===i?'tile-picked':''));
 const rackHtml=b.me<0?'':at(450,458,`<div class="tile-rack">${row(rack.slice(0,cut),4)}${cut<rack.length?row(rack.slice(cut),4):''}</div>`);
 return table(at(450,67,lab('山 '+b.poolCount+'枚'))+at(450,224,`<div class="tile-melds ${scrollTable?'scroll-table':''}">${groups}</div>`)+rackHtml,'rect tile-table');
};
boards.pegsolitaire = (b,A) =>{
 const from=A.selected ?? -1;
 const jumps=new Set([...A.legal].filter(m=>Math.floor(m/64)===from).map(m=>m%64));
 const sources=new Set([...A.legal].map(m=>Math.floor(m/64)));
 const holes=b.holes.map(([r,c],i)=>{
   const triangle=b.boardType==='triangle', x=triangle ? 199+(c-r/2)*70 : 13+c*62;
   const y=triangle ? 75+r*62 : 13+r*62;
   // A jump moves two holes in each affected direction, preserving both parities and the peg's finish.
   const finish = c%2===0 ? 'blue' : r%2===0 ? 'red' : 'maple';
   const cell=b.cells[i] ? `<i class="wood-peg ${finish}"></i>` : '';
   const attrs=`data-src="${i}" data-piece="peg-${i}" style="left:${x}px;top:${y}px"`;
   return control(cell,attrs,'穴 '+(i+1), A.canPlay&&(sources.has(i)||jumps.has(i)),`peg-socket ${i===from?'chosen-peg':''} ${jumps.has(i)&&A.hints?'aim':''}`);
 }).join('');
 return at(450,274,`<div class="peg-board"><div class="peg-inner">${holes}</div></div>`);
};
function seatDetail(b,i) {
  switch(b.kind){
    case 'war': return '持ち札 '+b.totalCounts[i]+'枚';
    case 'takoyaki': return '表向き '+b.open[i].filter(Boolean).length+' / '+b.targets[i];
    case 'butanoshippo': return '引き取り '+b.handCounts[i]+'枚';
    case 'oldmaid': return '手札 '+b.handCounts[i]+'枚';
    case 'hearts': return '今回 '+b.roundPts[i]+'点　合計 '+b.totalScores[i]+'点';
    case 'ginrummy': case 'vulture': return b.scores[i]+'点';
    case 'goita': return ['先手組','後手組'][i%2]+' '+b.teamScores[i%2]+'点　手駒 '+b.handCounts[i]+'枚';
    case 'quarto': return i===0?'駒を置く':'駒を渡す';
    case 'geister': return '捕獲　青 '+b.captured[i].blue+'　赤 '+b.captured[i].red;
    case 'rummikub': return '手牌 '+b.rackCounts[i]+'枚';
    case 'pegsolitaire': return '残り '+b.pegsLeft+'本';
  }
}

const localSelectionGames = new Set(['ginrummy','geister','pegsolitaire']);
const select = (b,A,index) => {
  if (!A.canPlay) return;
  if (b.kind==='geister') {
    const from=A.selected;
    if (from!=null && from!==index) {
      const a=ghostHome[b.me]?.indexOf(from), z=ghostHome[b.me]?.indexOf(index);
      const m=b.phase==='setup'?Math.min(a,z)*8+Math.max(a,z):from*36+index;
      if ((b.phase!=='setup'||(a>=0&&z>=0)) && A.legal.has(m)) return A.play(m);
    }
    if (b.owners[index]!==b.me) return;
  }
  if (b.kind==='pegsolitaire') {
    const m=A.selected*64+index;
    if (A.selected!=null && A.legal.has(m)) return A.play(m);
    if (!b.cells[index]) return;
  }
  A.sel=A.selected===index?null:{kind:b.kind,seat:b.me,moves:A.view.moves,index};
  A.redraw();
};

function actionList(b,A) {
  let actions=[];
  switch(b.kind) {
    case 'war': actions=[[0,b.warBlindLeft[b.turn]?'伏せ札を出す':'札を出す']]; break;
    case 'takoyaki': actions=b.phase==='draw'?[[0,'山札から引く'],[1,'捨て札を引く']]:[[20,b.phase==='bomb'?'手番を終える':'捨てる']]; break;
    case 'oldmaid': if(b.allowShuffle) actions=[[100,'手札を混ぜる']]; break;
    case 'hearts': if(b.phase==='pass') actions=[[52,'3枚を渡す']]; break;
    case 'ginrummy': actions=b.phase==='draw'?[[0,'山札から引く'],[1,'捨て札を引く']]:
      [[A.selected==null?-1:10+A.selected,'捨てる'],[A.selected==null?-1:100+A.selected,'ノック・ジン']]; break;
    case 'goita': if(b.phase==='block') actions=[[99,'パス']]; break;
    case 'geister': actions=b.phase==='setup'?[[99,'配置決定']]:[...A.legal].filter(m=>m>=2000).map(m=>[m,'脱出']); break;
    case 'rummikub':
      actions=[[2,'戻す'],[0,'山から引く']];
      if(b.selected) actions.push([599,'新しい組']);
      if(A.legal.has(600)) actions.push([600,'手牌に戻す']);
      actions.push([1,'ターン確定']);
      break;
  }
  return actions.map(([m,label])=>({label,move:m,enabled:A.canPlay&&A.legal.has(m)}));
}

function seatDetail(b,i) {
  switch(b.kind){
    case 'war': return '持ち札 '+b.totalCounts[i]+'枚';
    case 'takoyaki': return '表向き '+b.open[i].filter(Boolean).length+' / '+b.targets[i]+(b.wins[i]?'　'+b.wins[i]+'勝':'');
    case 'butanoshippo': return '引き取り '+b.handCounts[i]+'枚';
    case 'oldmaid': return b.outOrder.includes(i)?(b.outOrder.indexOf(i)+1)+'位で上がり':'手札 '+b.handCounts[i]+'枚';
    case 'hearts': return '今回 '+b.roundPts[i]+'点　合計 '+b.totalScores[i]+'点';
    case 'ginrummy': case 'vulture': return b.scores[i]+'点';
    case 'goita': return ['先手組','後手組'][i%2]+' '+b.teamScores[i%2]+'点　手駒 '+b.handCounts[i]+'枚';
    case 'quarto': return i===b.turn?(b.phase==='place'?'駒を置く':'駒を渡す'):(b.phase==='place'?'駒を渡す':'駒を置く');
    case 'geister': return '捕獲　青 '+b.captured[i].blue+'　赤 '+b.captured[i].red;
    case 'rummikub': return '手牌 '+b.rackCounts[i]+'枚';
    case 'pegsolitaire': return '残り '+b.pegsLeft+'本';
  }
}

function status(b) {
  switch (b.kind) {
    case 'takoyaki': return b.phase==='bomb'?'裏に戻す札を選んでください':b.phase==='place'?'札を置く場所を選んでください':'札を引いてください';
    case 'oldmaid': return '相手の裏向きの札を1枚選んでください';
    case 'hearts': return b.phase==='pass'?'渡す札を3枚選んでください':'出す札を選んでください';
    case 'ginrummy': return b.phase==='draw'?'札を引いてください':'捨てる札を選んでください';
    case 'vulture': return '出す札を選んでください';
    case 'goita': return b.phase==='block'?'受ける駒を選ぶか、パスしてください':'攻める駒を選んでください';
    case 'quarto': return b.phase==='pick'?'相手に渡す駒を選んでください':'渡された駒を置いてください';
    case 'geister': return b.phase==='setup'?'駒を2つ選んで入れ替えられます':'駒と移動先を選んでください';
    case 'rummikub': return b.selected?'組を選ぶか、新しい組を作ってください':'手牌か場の牌を選んでください';
    case 'pegsolitaire': return 'ペグと飛び越え先の穴を選んでください';
    default: return '';
  }
}

const sceneObserver=new ResizeObserver(entries=>{
  for(const {target} of entries) fitScene(target);
});
let observedWrap;
function fitScene(wrap) {
  const scene=wrap.querySelector('.twelve-scene');
  if (!scene) return;
  let ratio=Math.max(.1,Math.min((wrap.clientWidth-22)/900,(wrap.clientHeight-12)/560));
  // ペグ・ソリティアは場面(900×560)の中に丸い盤(498px)だけを描く。スマホでは場面の幅で縮めると盤が小さすぎるので、
  // 盤(影を含めて約 520×530)が横幅いっぱいになるように拡大する(PC の大きさは変えない)
  if (scene.dataset.game==='pegsolitaire' && wrap.clientWidth<600)
    ratio=Math.max(ratio,Math.min((wrap.clientWidth-12)/520,(wrap.clientHeight-12)/530));
  scene.style.setProperty('--scene-scale',ratio);
}

let previous;
function readPositions(wrap) {
  const boxes=new Map();
  wrap.querySelectorAll('[data-piece]').forEach(node=>{
    boxes.set(node.dataset.piece,node.getBoundingClientRect());
  });
  return boxes;
}
function animateFrom(node,from,A,flip=false) {
  const to=node.getBoundingClientRect();
  const scene=node.closest('.twelve-scene');
  const scale=scene.getBoundingClientRect().width/900;
  if (!scale || !to.width || !to.height) return;
  const dx=(from.left+from.width/2-to.left-to.width/2)/scale;
  const dy=(from.top+from.height/2-to.top-to.height/2)/scale;
  if (!flip && Math.abs(dx)+Math.abs(dy)<3) return;
  const start = `translate(${dx}px,${dy}px)`;
  if (flip && node.matches('.pc:not(.back, .slot)')) A.flipCard(node,360,'pc');
  node.animate([{transform:start},{transform:'none'}],
    {duration:360*A.speed,easing:'cubic-bezier(.2,.9,.3,1)'});
  A.land(160);
  A.anim(380);
}
function animateMove(wrap,b,A,last) {
  if (!last || last.handle!==A.handle || last.moves+1!==A.view.moves || A.reduce) return;
  const old=last.board, m=A.lastMove, actor=old.turn;
  const boardBox=wrap.getBoundingClientRect();
  const point=(x,y)=>({left:boardBox.left+boardBox.width*x,top:boardBox.top+boardBox.height*y,width:0,height:0});
  const place=(key,from,flip=false)=>{
    const el=wrap.querySelector(`[data-piece="${key}"]`);
    if(el && from) animateFrom(el,from,A,flip);
  };
  const boxes=last.boxes;
  const pile=(side)=>point(side,.37);
  switch(b.kind) {
    case 'war':
      for(const i of [0,1]) if(b.faceUp[i]?.id!==old.faceUp[i]?.id) place('war-face-'+i,boxes.get('war-deck-'+i)||pile(i===ownSeat(b)?.17:.82),true);
      break;
    case 'takoyaki':
      if(m>=10&&m<20) place('tako-'+actor+'-'+(m-10),boxes.get('tako-held'));
      if(b.held?.id!==old.held?.id) place('tako-held',m===1?boxes.get('tako-discard'):m>=10&&m<20?boxes.get('tako-'+actor+'-'+(m-10)):pile(.8),m===0);
      if(old.phase==='bomb'&&m>=30) place('tako-'+actor+'-'+(m-30),boxes.get('tako-'+actor+'-'+(m-30)),true);
      break;
    case 'butanoshippo':
      if(b.pileTop?.id!==old.pileTop?.id) place('pig-pile',boxes.get('ring-'+m)||boxes.get('pig-hand-'+(m-100)),m<100);
      break;
    case 'oldmaid':
      if(m===100 && b.me===actor) {
        wrap.querySelectorAll('[data-maid-own] .pc').forEach((node,i)=>node.animate([
          {transform:'translateX('+((i%2?1:-1)*19)+'px) rotate('+(i%2?12:-12)+'deg)'},{transform:'none'}
        ],{duration:330*A.speed,delay:i*12*A.speed}));
        A.anim(490);
      } else if (m!==100) {
        const from=boxes.get('maid-fan-'+m);
        let addedToHand=false;
        if (b.me===actor) {
          const received=b.myHand.find(c=>!old.myHand.some(q=>q.id===c.id));
          if(received) {
            place('maid-own-'+b.myHand.indexOf(received),from,true);
            addedToHand=true;
          }
        }
        if (from && !addedToHand) flyMaid(wrap,A,from,actor===b.me?.78:.24);
      }
      break;
    case 'hearts':
      if(b.phase==='play'){
        const from=boxes.get('hearts-hand-'+m)||point(.5,actor===b.me?.85:.27);
        if(b.trick.some(t=>t.seat===actor)) place('hearts-trick-'+actor,from,actor!==b.me);
        else if(old.trick.length===3) {
          const cards=b.lastTrick?.cards || [...old.trick,{seat:actor,card:old.myHand.find(c=>c.id===m)}];
          flashHearts(wrap,b,A,cards,actor,from);
        }
      }
      break;
    case 'ginrummy':
      if(b.discardTop?.id!==old.discardTop?.id && old.phase==='discard') place('gin-discard',boxes.get('gin-hand-'+(m-(m>=100?100:10)))||point(.5,.24),actor!==b.me);
      break;
    case 'vulture':
      if(b.roundNo!==old.roundNo || A.view.outcome) flashVulture(wrap,b,A);
      else if(b.pickedFlags[actor]) place('bid-'+actor,point(.5,.83),true);
      break;
    case 'goita':
      if(b.played[actor]?.length>old.played[actor]?.length) place('goita-'+actor+'-'+(b.played[actor].length-1),point(.5,actor===b.me?.85:.30));
      break;
    case 'quarto':
      if(old.phase==='place' && b.lastCell>=0) {
        place('quarto-'+old.chosenPiece,boxes.get('quarto-'+old.chosenPiece));
      }
      break;
    case 'geister':
      if (b.lastTo>=0 && b.lastFrom>=0) {
        const ghost=wrap.querySelector(`[data-piece="ghost-${b.lastTo}"] svg`);
        if(ghost&&boxes.has('ghost-'+b.lastFrom)) animateFrom(ghost,boxes.get('ghost-'+b.lastFrom),A);
      }
      break;
    case 'rummikub':
      for(const target of wrap.querySelectorAll('[data-piece]')) {
        const oldBox=boxes.get(target.dataset.piece);
        if(oldBox) animateFrom(target,oldBox,A);
      }
      break;
    case 'pegsolitaire': {
      const peg=wrap.querySelector(`[data-piece="peg-${b.lastTo}"] .wood-peg`);
      if(peg&&boxes.has('peg-'+b.lastFrom)) animateFrom(peg,boxes.get('peg-'+b.lastFrom),A);
      break;
    }
  }
}
function flyMaid(wrap,A,from,targetY) {
  const scene=wrap.querySelector('.twelve-scene');
  scene.insertAdjacentHTML('beforeend',at(450,560*targetY,card(null,76,'','maid-flight')));
  const el=scene.querySelector('[data-piece="maid-flight"]');
  animateFrom(el,from,A,true);
  el.animate([{opacity:1},{opacity:1,offset:.65},{opacity:0}],{duration:370*A.speed,fill:'forwards'}).finished.then(()=>el.parentElement.remove(),()=>{});
}
function flashHearts(wrap,b,A,cards,actor,from) {
  const scene=wrap.querySelector('.twelve-scene');
  const coords=[[450,323],[345,236],[450,158],[555,236]];
  for(const {seat,card:c} of cards) {
    if(!c) continue;
    const i=(seat-ownSeat(b)+4)%4;
    scene.insertAdjacentHTML('beforeend',at(...coords[i],card(c,67,'','heart-flash-'+seat)));
    const el=scene.querySelector(`[data-piece="heart-flash-${seat}"]`);
    if(seat===actor) animateFrom(el,from,A,true);
    removeAfter(el,A,590);
  }
}
function flashVulture(wrap,b,A) {
  if(!b.lastRound) return;
  const scene=wrap.querySelector('.twelve-scene');
  const pos=[[297,348],[200,234],[608,161],[700,258],[321,147]];
  const points=b.lastRound.potSum;
  scene.insertAdjacentHTML('beforeend',at(450,209,`<div class="prize">${bird}<b>${points>0?'+':''}${points}</b></div>`));
  removeAfter(scene.lastElementChild.firstElementChild,A,680);
  b.lastRound.picks.forEach((n,seat)=>{
    if(n<1) return;
    const [x,y]=pos[(seat-ownSeat(b)+b.n)%b.n];
    scene.insertAdjacentHTML('beforeend',at(x,y,`<div class="bid-reveal ${b.lastRound.winner===seat?'won':''}">${bid(n)}</div>`));
    const el=scene.lastElementChild.firstElementChild;
    el.animate([{transform:'rotateY(85deg)'},{transform:'none'}],{duration:260*A.speed});
    removeAfter(el,A,680);
  });
}
function removeAfter(el,A,wait) {
  el.animate([{opacity:1},{opacity:0}],{duration:160*A.speed,delay:wait*A.speed,fill:'forwards'}).finished.then(()=>el.parentElement.remove(),()=>{});
  A.anim(wait+160);
}

function renderTwelve(b,base) {
  const A=base;
  A.canPlay=A.view.human&&!A.view.outcome&&!busy&&!isMySeatAutoCpu();
  A.legal=new Set(A.canPlay?A.view.legal:[]);
  A.selected=localSelectionGames.has(b.kind)&&A.sel?.kind===b.kind&&A.sel.moves===A.view.moves&&A.sel.seat===b.me?A.sel.index:null;
  A.strip(A.view.seats.map((s,i)=>{
    const avatar=b.me===i&&mode!=='pass'?A.face():`<span class="dot face">${esc(A.name(i)[0])}</span>`;
    return `<div class="pl${A.view.toMove===i?' turn':''}">${avatar}<span class="who"><span class="nm">${esc(A.name(i))}</span><span class="nt">${esc(seatDetail(b,i))}</span></span></div>`;
  }).join(''));
  const wrap=document.getElementById('boardwrap');
  const scrollPositions=b.kind==='rummikub'
    ? ['.tile-melds','.tile-rack'].map(selector=>[selector,wrap.querySelector(selector)?.scrollTop||0])
    : [];
  A.board(`<div class="twelve-scene" data-game="${b.kind}" data-ready="${A.canPlay}">${boards[b.kind](b,A)}</div>`,d=>{
    if(!A.canPlay) return;
    if(d.src!=null) return select(b,A,Number(d.src));
    if(d.m!=null&&A.legal.has(Number(d.m))) A.play(Number(d.m));
  });
  for(const [selector,top] of scrollPositions) {
    const area=wrap.querySelector(selector);
    if (area) area.scrollTop=top;
  }
  A.acts(actionList(b,A));
  if (observedWrap!==wrap) {
    if (observedWrap) sceneObserver.unobserve(observedWrap);
    sceneObserver.observe(wrap);
    observedWrap=wrap;
  }
  fitScene(wrap);
  if (!previous||previous.handle!==A.handle||previous.moves!==A.view.moves) {
    const boxes=readPositions(wrap);
    animateMove(wrap,b,A,previous);
    previous={handle:A.handle,moves:A.view.moves,board:b,boxes};
  }
}

for (const id of Object.keys(boards)) window.RENDER[id]=renderTwelve;
window.TWELVE_HAS = id => Object.hasOwn(boards,id) || !!(window.NINE_HAS && window.NINE_HAS(id));
window.TWELVE_STATUS=b => status(b) || (window.NINE_STATUS ? window.NINE_STATUS(b) : '');
window.TWELVE_AIM = (b,mv,seat,q,button) => {
  const move = n => q(`[data-m="${n}"]`);
  // 手札や非公開の配置を狙うと答えが見えるため、その場合は公開されている場所だけを示す。
  switch (b.kind) {
    case 'war': return [move(0)];
    case 'takoyaki':
      if (b.phase==='draw') return [move(mv)];
      if (mv===20) return [move(1)];
      return [q(`[data-piece="tako-${seat}-${mv % 10}"]`)];
    case 'butanoshippo': return [mv<100 ? move(mv) : q('[data-piece="pig-pile"]')];
    case 'oldmaid': return mv===100 ? [] : [q(`[data-maid-index="${mv}"]`)];
    case 'hearts': case 'vulture': return [q(`[data-public-seat="${seat}"]`)];
    case 'ginrummy': return [move(b.phase==='draw'?mv:1)];
    case 'goita': return [mv===99 ? button(/^パス$/) : q(`[data-public-seat="${seat}"]`)];
    case 'quarto':
      return b.phase==='pick' ? [move(mv)] : [q('.qtray .chosen'),q(`[data-quarto-cell="${mv}"]`)];
    case 'geister': {
      if (b.phase==='setup') return mv===99 ? [button(/配置決定/)] : [];
      const cell = i => q(`.ghost-cell[data-src="${i}"]`);
      return mv>=2000 ? [cell(mv-2000)] : [cell(Math.floor(mv/36)),cell(mv%36)];
    }
    case 'rummikub':
      if (mv>=2000) return [move(mv)];
      if (mv>=500 && mv<599) return [q(`[data-rummi-set="${mv-500}"]`)];
      return mv===0 || mv===1 ? [button(mv===0?/山から引く/:/ターン確定/)] : [];
    default: return window.NINE_AIM ? window.NINE_AIM(b,mv,seat,q,button) : [];
  }
};
})();
