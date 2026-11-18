'use strict';

const mineVersus = (() => {
  const attacks = [
    ['fog','霧',10], ['freeze','凍結',15], ['unflag','旗消し',15],
    ['shield','盾',20], ['reseal','再封印',25], ['mines','地雷追加',40]
  ];
  const levels = ['easy','normal','hard'];
  const defaults = () => ({ sabotage:true, endRank:3, penalty:10, freeze:3, stock:true, lock:0,
    enabled:attacks.map(()=>true), costs:{} });
  let preferences = store.get('mineVersusSettings',defaults()), target, fields = new Map(), selectedLevel='normal', drawnVersion=-1, needsFlag=false;
  const seconds = until => Math.max(0,Math.ceil(((until||0)-Date.now())/1000));
  const random = () => crypto.getRandomValues(new Uint32Array(1))[0];
  const costs = () => preferences.costs[selectedLevel] || attacks.map(a=>Math.round(a[2]*[.5,1,1.8][levels.indexOf(selectedLevel)]));
  const level = key => minesGame.LEVELS[key];
  function neighbors(board, cell) {
    const x=cell%board.w,y=Math.floor(cell/board.w), result=[];
    for (let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
      if ((dx||dy)&&x+dx>=0&&x+dx<board.w&&y+dy>=0&&y+dy<board.h) result.push((y+dy)*board.w+x+dx);
    }
    return result;
  }
  function solvable(board, start, revealed=[]) {
    const open = new Set(revealed.filter(i=>!board.mine[i])), mines = new Set();
    function reveal(i) {
      const queue=[i];
      for(let n=0;n<queue.length;n++){
        const cell=queue[n];if(open.has(cell)||board.mine[cell])continue;
        open.add(cell);
        if(!board.adj[cell])queue.push(...neighbors(board,cell));
      }
    }
    reveal(start);
    for(let previous=-1;previous!==open.size+mines.size;){
      previous=open.size+mines.size;
      const constraints=[];
      for(const cell of open) {
        const near=neighbors(board,cell), unknown=near.filter(i=>!open.has(i)&&!mines.has(i));
        if(!unknown.length)continue;
        const needs=board.adj[cell]-near.filter(i=>mines.has(i)).length;
        if(!needs)unknown.forEach(reveal);
        else if(needs===unknown.length)unknown.forEach(i=>mines.add(i));
        else constraints.push([unknown,needs]);
      }
      if(open.size+mines.size!==previous)continue;
      for(const [small,count] of constraints)for(const [large,total] of constraints){
        if(small.length>=large.length||!small.every(i=>large.includes(i)))continue;
        const extra=large.filter(i=>!small.includes(i));
        if(total===count)extra.forEach(reveal);
        else if(total-count===extra.length)extra.forEach(i=>mines.add(i));
      }
    }
    return open.size===board.mine.length-board.mines;
  }
  function fillAdjacent(board) {
    board.adj=board.mine.map((_,i)=>neighbors(board,i).filter(n=>board.mine[n]).length);
  }
  function initial(round) {
    fields=new Map();drawnVersion=-1;target='';needsFlag=false;
    let grid=new minesGame.Board(round.level,random());
    const center=Math.floor(grid.h/2)*grid.w+Math.floor(grid.w/2);
    for(let i=0;i<100;i++){
      grid=new minesGame.Board(round.level,random());grid.place(center);
      if(solvable(grid,center))break;
    }
    grid.open(center);
    for(const seat of round.seats){
      const board=new minesGame.Board(round.level,grid.seed);
      board.restore(grid.snapshot());
      fields.set(seat.id,board);
    }
    round.seats=round.seats.map(p=>({...p,points:0,hits:0,shields:0,done:0,cooldowns:{},recent:[]}));
    const state={roundStart:Date.now(),notice:'',finish:false};
    round.seats.forEach(p=>refresh(p,fields.get(p.id)));
    return state;
  }
  function refresh(p,board) {
    p.codes=board.mine.map((mine,i)=>board.opened[i]?(mine?12:board.adj[i]):board.flags[i]?20:9);
    p.percent=board.percent;
    p.left=board.mines-board.flags.filter(Boolean).length-p.hits;
  }
  function open(p,board,cell,now,state) {
    const before=board.opened.slice();
    const reveal = i => {
      if(board.opened[i]||board.flags[i])return;
      if(board.mine[i]){
        board.opened[i]=true;p.hits++;p.points=0;p.freezeTo=now+state.config.penalty*1000;
      } else board.open(i);
    };
    if(!board.opened[cell])reveal(cell);
    else if(!board.mine[cell]&&board.adj[cell]){
      const near=neighbors(board,cell);
      if(near.filter(i=>board.flags[i]||(board.opened[i]&&board.mine[i])).length===board.adj[cell])near.forEach(reveal);
    }
    let changed=false;
    for(let i=0;i<before.length;i++)if(!before[i]&&board.opened[i]){
      changed=true;
      if(!board.mine[i]){p.points+=board.adj[i]?2:1;p.recent.push(i);}
    }
    if(p.freezeTo===now+state.config.penalty*1000)p.points=0;
    if(p.recent.length>30)p.recent.splice(0,p.recent.length-30);
    return changed;
  }
  function sabotage(state,p,q,index,now){
    const item=attacks[index], cfg=state.config;
    const cost=cfg.cost[index];
    if(!item||!cfg.sabotage||!cfg.enabled[index]||p.points<cost)return false;
    if(item[0]==='shield'){
      if((!cfg.stock&&p.shields)||p.shieldTo>now)return false;
      p.points-=cost;p.shields++;state.notice=p.name+'が盾を装備';return true;
    }
    if(!q || q===p || q.done || (p.cooldowns?.[q.id]||0)>now)return false;
    const board=fields.get(q.id);
    p.points-=cost;p.cooldowns ||= {};p.cooldowns[q.id]=now+10000;
    state.notice=p.name+' → '+q.name+'　'+item[1];
    if(q.shields){q.shields--;q.shieldTo=now+cfg.lock*1000;state.notice+='（盾で防御）';return true;}
    switch(item[0]){
      case 'fog':q.fogTo=now+8000;break;
      case 'freeze':q.freezeTo=Math.max(q.freezeTo||0,now)+cfg.freeze*1000;break;
      case 'unflag':{
        const flags=board.flags.map((set,i)=>set?i:-1).filter(i=>i>=0);
        for(let k=Math.ceil(flags.length/2);k>0;k--)board.flags[flags.splice(random()%flags.length,1)[0]]=false;
        break;
      }
      case 'reseal':{
        let count=5;
        while(q.recent.length&&count>0){
          const i=q.recent.pop();
          if(board.opened[i]&&!board.mine[i]){board.opened[i]=false;board.openedSafe--;count--;}
        }
        break;
      }
      case 'mines':{
        const candidates=board.mine.map((v,i)=>!v&&!board.opened[i]&&!board.flags[i]?i:-1).filter(i=>i>=0);
        const seen=board.opened.flatMap((v,i)=>v?[i]:[]);
        let added=0;
        for(let attempt=0;candidates.length&&added<2&&attempt<32;attempt++){
          const i=candidates.splice(random()%candidates.length,1)[0];
          board.mine[i]=true;board.mines++;fillAdjacent(board);
          if(solvable(board,board.safeCell,seen))added++;
          else{board.mine[i]=false;board.mines--;fillAdjacent(board);}
        }
        if(!added){p.points+=cost;delete p.cooldowns[q.id];state.notice='追加できる地雷がありません';}
        break;
      }
    }
    refresh(q,board);
    return true;
  }
  function apply(state,action){
    const p=state.seats.find(v=>v.id===action.uid),now=Date.now(),board=fields.get(p?.id);
    if(!board||state.finish||p.done)return false;
    if(action.move==='attack')return sabotage(state,p,state.seats.find(q=>q.id===action.target),action.index,now);
    const i=action.cell;
    if(!Number.isInteger(i)||i<0||i>=board.mine.length||(p.freezeTo||0)>now)return false;
    if(action.move==='flag'){if(board.opened[i])return false;board.flag(i);}
    else if(action.move==='open'){if(!open(p,board,i,now,state))return false;}
    else return false;
    if(board.openedSafe>=board.mine.length-board.mines){
      p.done=now;
      board.status='won';
      if(state.seats.filter(q=>q.done).length>=Math.min(state.config.endRank||state.seats.length,state.seats.length)){
        state.finish=true;
        state.ranking=state.seats.slice().sort((a,b)=>a.hits-b.hits||Number(!a.done)-Number(!b.done)||
          (a.done||0)-(b.done||0)||b.percent-a.percent).map(q=>q.id);
      }
    }
    refresh(p,board);
    return true;
  }
  function setup(){go('mineVersusSetup');}
  function setupHtml(){
    const number=(key,label,min,max,val)=>`<label>${label} <input type="number" data-mine-vs-pref="${key}" min="${min}" max="${max}" value="${val}"></label>`;
    const check=(key,label,val)=>`<label><input type="checkbox" data-mine-vs-pref="${key}" ${val?'checked':''}> ${label}</label>`;
    return `<div class="screen col"><div class="setuphead"><button class="btn" data-go="menu" aria-label="戻る">${ic('back')}</button><div class="txt"><h2>マインスイーパー（対戦）</h2></div></div>
      <div class="setupbody mine-versus-setup"><div class="panel"><h3>難易度</h3><div class="row">${seg('mine-versus:level',levels.map(k=>[k,level(k).label]),selectedLevel)}</div>
      <h3>妨害</h3><div class="row">${check('sabotage','妨害あり',preferences.sabotage)}</div>
      ${attacks.map((a,i)=>`<div class="row">${check('enabled:'+i,a[1],preferences.enabled[i])}${number('cost:'+i,'必要ポイント',1,999,costs()[i])}</div>`).join('')}
      <h3>終了条件と待ち時間</h3><div class="row"><label>対戦終了 <select data-mine-vs-pref="endRank">${[1,2,3,0].map(n=>`<option value="${n}" ${preferences.endRank===n?'selected':''}>${n?n+'位まで決まったら':'全員が終えたら'}</option>`).join('')}</select></label></div>
      <div class="row">${number('penalty','地雷を踏んだ後の凍結（秒）',0,60,preferences.penalty)}</div>
      <div class="row">${number('freeze','妨害の凍結（秒）',1,30,preferences.freeze)}</div>
      <div class="row">${check('stock','盾をためる',preferences.stock)}${number('lock','盾の待ち時間（秒）',0,120,preferences.lock)}</div>
      <div class="row"><button class="btn" data-mine-vs-reset>初期値に戻す</button></div></div>${minesGame.personalOptions(false)}</div>
      <div class="setupfoot"><button class="btn" data-go="menu">戻る</button><button class="btn primary" data-mine-vs-start ${netApi?.role==='host'&&activeMembers().length>=2?'':'disabled'}>対戦を始める</button></div></div>`;
  }
  function pref(input){
    const [key,index]=input.dataset.mineVsPref.split(':');
    const value=input.type==='checkbox'?input.checked:input.type==='number'?
      Math.min(+input.max,Math.max(+input.min,Math.round(input.valueAsNumber||0))):+input.value;
    if(key==='cost'){
      const next=costs().slice();next[index]=value;preferences.costs[selectedLevel]=next;
    }else if(key==='enabled')preferences.enabled[index]=value;
    else preferences[key]=value;
    store.set('mineVersusSettings',preferences);
  }
  const start=()=>boardMatch.start('mineVersus',true,{level:selectedLevel,config:{...structuredClone(preferences),cost:costs().slice()}});
  function html(state){
    return `<div class="screen"><div class="stage mine-duel"><div class="stagehead"><button class="btn" data-extra-exit aria-label="戻る">${ic('back')}</button><h2>マインスイーパー（対戦）</h2></div>
      <div class="mine-boardwrap"><div class="mine-board" id="duelBoard" style="--mine-cols:${level(state.level).w}"></div></div>
      <div class="mine-foot" id="duelInfo"></div><button class="btn play-settings" data-playsettings aria-label="設定">${ic('set')}</button><div class="cutlayer" id="cutlayer"></div></div>
      <aside class="side"><div class="seats" id="duelSeats"></div><div id="duelTools"></div>${chatBox()}</aside></div>`;
  }
  function draw(state){
    const element=$('#duelBoard');if(!element)return;
    const p=state.seats.find(p=>p.id===boardMatch.myId());
    const watched=p||state.seats[0];
    const other=state.seats.filter(q=>q!==p&&!q.done);
    if(!other.some(q=>q.id===target))target=other[0]?.id;
    const frozen=seconds(p?.freezeTo),fogged=seconds(watched.fogTo);
    if(element.dataset.signature!==[state.id,state.version,frozen>0,fogged>0].join(':')){
      element.dataset.signature=[state.id,state.version,frozen>0,fogged>0].join(':');
      element.innerHTML=watched.codes.map((code,i)=>`<button class="mine-cell ${code===20?'flag':code===12?'mine':code===9?'hidden':'open'}" data-code="${code}"
        data-extra-mine="${i}" aria-label="${i+1}番のマス" ${!p||state.finish||p.done||frozen?'disabled':''}>${code===20?'⚑':code===12?'✹':code===9||!code||fogged?'':code}</button>`).join('');
    }
    $('#duelInfo').textContent=`⚑ ${watched.left}　 ${p?.points||0} pt　 ${frozen?'凍結 '+frozen+'秒':fogged?'霧 '+fogged+'秒':state.notice||''}`;
    if(state.finish)$('#duelInfo').textContent=state.ranking.map((id,i)=>`${i+1}位 ${state.seats.find(q=>q.id===id)?.name}`).join(' ／ ');
    const side=$('#duelSeats');if(side.dataset.version!==String(state.version)){
      side.dataset.version=state.version;
      side.innerHTML=state.seats.map(q=>`<div class="seat"><span class="nm">${esc(q.name)}</span><b>${q.percent}%</b><small>地雷 ${q.hits}</small></div>`).join('');
    }
    const tools=$('#duelTools');
    if(!p||state.finish||p.done){tools.replaceChildren();return;}
    const options=`<div class="panel"><div class="row"><button class="btn" aria-pressed="${needsFlag}" data-extra-mine-mode>旗モード</button></div>
      ${state.config.sabotage?`<div class="row">妨害の対象 <select data-mine-vs-target>${other.map(q=>`<option value="${esc(q.id)}" ${q.id===target?'selected':''}>${esc(q.name)}</option>`).join('')}</select></div>
      <div class="ops">${attacks.map(([key,label],i)=>`<button class="btn" data-extra-mine-attack="${i}" ${!state.config.enabled[i]||p.points<state.config.cost[i]||
        (key==='shield'? (!state.config.stock&&p.shields)||seconds(p.shieldTo):!target||seconds(p.cooldowns?.[target]))?'disabled':''}>${label} ${state.config.cost[i]}pt</button>`).join('')}</div>`:''}</div>`;
    if(tools.dataset.markup!==options){tools.dataset.markup=options;tools.innerHTML=options;}
    if(drawnVersion!==state.version){if(state.version>0)sfx.play('TAP',{volume:.28});drawnVersion=state.version;}
  }
  function button(d){
    if(d.extraMine!==undefined)return boardMatch.send(needsFlag?'flag':'open',{cell:+d.extraMine});
    if(d.extraMineMode!==undefined){needsFlag=!needsFlag;return draw(boardMatch.state);}
    if(d.extraMineAttack!==undefined)return boardMatch.send('attack',{index:+d.extraMineAttack,target});
  }
  setInterval(()=>{if(S.screen==='extraPlay'&&boardMatch.state?.game==='mineVersus')draw(boardMatch.state);},250);
  boardMatch.register('mineVersus',{initial,apply,html,draw,button,stop:()=>fields.clear()});
  return {setup,setupHtml,start,pref,setLevel:v=>{selectedLevel=v;render();},setTarget:v=>{target=v;draw(boardMatch.state);},
    reset:()=>{const stored={...preferences.costs};delete stored[selectedLevel];preferences={...defaults(),costs:stored};store.set('mineVersusSettings',preferences);render();}};
})();
