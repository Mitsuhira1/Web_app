'use strict';

const fallingMatch = (() => {
  let setupOnline = false, timer, published, received=0;
  const controllers = {};
  const prefs = store.get('fallingSetup',{});
  const preferences = id => ({speed:'standard', preview:true, sabotage:true, ...prefs[id]});
  const speedScale = {slow:1.55, standard:1, fast:.65};
  function setOption(id,key,value) {
    if (!controllers[id]) return;
    if (key==='speed' && !Object.hasOwn(speedScale,value)) return;
    prefs[id] = {...preferences(id),[key]:key==='speed'?value:value==='on'};
    store.set('fallingSetup',prefs);
    render();
  }
  function setupHtml(id) {
    const p=preferences(id);
    const playRule = setupOnline
      ? setupRow('お邪魔を送る',seg(id+':sabotage',[['on','あり'],['off','なし']],p.sabotage?'on':'off'))
      : setupRow('落下速度',seg(id+':speed',[['slow','ゆっくり'],['standard','標準'],['fast','速い']],p.speed));
    const display = setupRow(id==='bunyo'?'次のピース':'次のブロック',
      seg(id+':preview',[['on','表示'],['off','非表示']],p.preview?'on':'off'));
    return extraSetupLayout(id,setupOnline,extraParticipants(setupOnline)+setupPanel('ルール',playRule),
      setupPanel('表示',display),'data-'+id+'-start');
  }
  function tick(id, ms, active, step) {
    let next = 0;
    setInterval(() => {
      if (!active() || document.hidden) { next = 0; return; }
      const now = performance.now();
      if (next && now < next) return;
      const speed = linked(id) ? 1 : speedScale[preferences(id).speed] || 1;
      const due = next > 0;
      next = now + ms * speed;
      if (due) step();
    },50);
  }
  function bind(id, controller) {
    controllers[id]=controller;
    boardMatch.register(id,{
      initial(round) {round.seats=round.seats.map(p=>({...p,score:0,board:'',sequence:0,garbage:0,over:false}));return {seed:crypto.getRandomValues(new Uint32Array(1))[0],finish:false};},
      apply(state,action) {
        const p=state.seats.find(q=>q.id===action.uid);
        const maximum=id==='bunyo'?72:200;
        if(state.finish||p.over||action.move!=='progress'||action.seq!==p.sequence+1||
          typeof action.board!=='string'||action.board.length!==maximum||!/^[.0-8]+$/.test(action.board)||
          !Number.isSafeInteger(action.score)||action.score<p.score||action.score>p.score+1000000||
          !Number.isInteger(action.attack)||action.attack<0||action.attack>24) return false;
        const others=state.seats.filter(q=>q!==p&&!q.over);
        if(state.sabotage!==false&&action.attack&&action.score>p.score&&others.length) {
          const enemy=others[(state.turnIndex++)%others.length];
          enemy.garbage+=action.attack;
        }
        p.score=action.score;p.board=action.board;p.sequence=action.seq;p.over=action.over===true;
        state.finish=state.seats.filter(q=>!q.over).length<=1;
        if(state.finish)state.winner=(state.seats.find(q=>!q.over)||p).id;
        return true;
      },
      changed(state,previous) {
        const you=state.seats.find(p=>p.id===boardMatch.myId());
        if (published?.id!==state.id) {
          received=0;published={id:state.id,seq:0};
          controller.startLinked(state.seed,!!you);
          // Initial rendering occurs before the first incoming position.
          clearTimeout(timer);timer=setTimeout(()=>report(id),0);
        }
        if(you?.garbage>received){controller.receive(you.garbage-received);received=you.garbage;}
        if(state.finish)controller.finish();
      },
      html:()=>controller.playHtml(true), draw:state=>draw(id,state),
      stop:()=>{published=null;clearTimeout(timer);}
    });
  }
  function setup(id,online) { setupOnline=online; controllers[id].showSetup(); }
  function start(id) {
    if(setupOnline) {
      if (canStartExtraMatch()) boardMatch.start(id,true,{turnIndex:0,sabotage:preferences(id).sabotage});
    } else controllers[id].startSolo();
  }
  function linked(id) {return boardMatch.state?.game===id;}
  function progress(id,garbage=0) {
    if(!linked(id)||!published)return;
    published.pendingAttack=(published.pendingAttack||0)+garbage;
    clearTimeout(timer);
    timer=setTimeout(()=>report(id),75);
  }
  function report(id){
    const state=boardMatch.state;
    if(!published||state?.game!==id||state.finish)return;
    const p=state.seats.find(q=>q.id===boardMatch.myId());
    if(!p||p.over)return;
    if(p.sequence<published.seq){
      if(Date.now()-published.sentAt>=1200){
        published.sentAt=Date.now();
        boardMatch.send('progress',published.outstanding);
      }
      clearTimeout(timer);timer=setTimeout(()=>report(id),120);return;
    }
    const progress=controllers[id].progress();
    if(progress.board===p.board&&progress.over===p.over&&progress.score===p.score&&!published.pendingAttack)return;
    published.seq++;
    const attack=Math.min(24,published.pendingAttack||0);
    published.pendingAttack=0;
    published.outstanding={...progress,attack,seq:published.seq};
    published.sentAt=Date.now();
    boardMatch.send('progress',published.outstanding);
    clearTimeout(timer);timer=setTimeout(()=>report(id),150);

  }
  function draw(id,state){
    controllers[id].redraw();
    const panel=$('#fallingRivals');if(!panel)return;
    const seats=state.seats.filter(p=>p.id!==boardMatch.myId());
    panel.innerHTML=seats.map(p=>`<div class="falling-rival"><div class="row"><b>${esc(p.name)}</b>
      <span>${p.over?'終了':p.score}</span></div><div class="falling-mini ${id}" style="--columns:${id==='bunyo'?6:10}">
      ${[...p.board].map(code=>`<i data-tone="${code}"></i>`).join('')}</div></div>`).join('');
    const status=$('#fallingResult');
    if(status)status.textContent=state.finish?
      (state.seats.find(p=>p.id===state.winner)?.name||'')+'の勝ち':
      state.seats.some(p=>p.id===boardMatch.myId())?'対戦中':'観戦中';
  }
  function sidebar(id,on,score,next,ended) {
    const you=on?boardMatch.state?.seats.find(p=>p.id===boardMatch.myId()):{name:meName()};
    const seats=you?`<div class="seats"><div class="seat"><i class="dot" style="background:${SEAT_COLORS[on?ost?.mySlot||0:0]}"></i><span class="nm">${esc(you.name)}</span></div></div>`:'';
    const status=on?'<div class="status" id="fallingResult" aria-live="polite"></div>':
      `<div class="status" id="fallingSoloStatus">${ended?'ゲーム終了':'プレイ中'}</div>`;
    const preview=preferences(id).preview?next:'';
    return playSide({seats,status,actions:ruleButton(id),on,content:score+preview+(on?'<div id="fallingRivals"></div>':'')});
  }
  function paintMotion(element,markup,previous,current){
    if(element._markup===markup)return;
    element._markup=markup;
    element.innerHTML=markup;
    if(!previous||!current||S.set.reduce)return;
    const slot=element.firstElementChild;
    const dx=(previous.x-current.x)*slot.offsetWidth,dy=(previous.y-current.y)*slot.offsetHeight;
    if(!dx&&!dy)return;
    for(const item of element.querySelectorAll('.falling'))item.animate([
      {translate:`${dx}px ${dy}px`},{translate:'0 0'}
    ],{duration:dy?125:95,easing:'ease-out'});
  }
  return {bind,setup,setupHtml,setOption,start,linked,progress,sidebar,tick,paintMotion};
})();
