'use strict';

const fallingMatch = (() => {
  let setupOnline = false, timer, published, received=0;
  const controllers = {};
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
        if(action.attack&&action.score>p.score&&others.length) {
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
    if(setupOnline)boardMatch.start(id,true,{turnIndex:0});else controllers[id].startSolo();
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
      (state.seats.find(p=>p.id===state.winner)?.name||'')+'の勝ち':'';
  }
  function sidebar(){return '<div id="fallingRivals"></div><b id="fallingResult" aria-live="polite"></b>'+chatBox();}
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
  return {bind,setup,start,linked,progress,sidebar,paintMotion,get online(){return setupOnline;}};
})();
