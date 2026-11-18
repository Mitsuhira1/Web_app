'use strict';

const poetCards = (() => {
  const princesses = new Set([2,9,19,38,53,54,56,57,58,59,60,61,62,65,67,72,80,88,89,90,92]);
  // 絵札の装束で判定する。頭巾の蝉丸（10番）は坊主札として扱う。
  const monks = new Set([8,10,12,21,47,66,69,70,82,85,86,87,95]);
  const cardRole = n => princesses.has(n+1) ? 'hime' : monks.has(n+1) ? 'bozu' : 'tono';
  const portrait = n => {
    // 43番は差し替え済みの個別絵を使う。
    if (n === 42) return '<span class="poet-illustration" aria-hidden="true" style="background-image:url(assets/poets/043.webp);--poet-art-size:100%;--poet-art-position:center"></span>';
    const cell = n % 25;
    const sheet = Math.floor(n / 25) + 1;
    const x = cell % 5 * 25;
    const y = Math.floor(cell / 5) * 25;
    return `<span class="poet-illustration" aria-hidden="true" style="background-image:url(assets/poets/sheet-${sheet}.webp);--poet-art-position:${x}% ${y}%"></span>`;
  };
  const face = n => {
    const author = hundredPoems[n][2];
    const lines = hundredPoemPrintLines[n];
    const columns = lines.map(line => `<span>${esc(line)}</span>`).join('');
    const longest = Math.max(...lines.map(line => [...line].length));
    return `<span class="poet-card portrait" aria-label="${esc(author+'　'+lines.join('　'))}">
      ${portrait(n)}
      <span class="poet-lines" style="--poet-line-length:${longest}">${columns}</span>
      <span class="poet-author" style="--author-length:${[...author].length}">${esc(author)}</span></span>`;
  };
  const shuffle = source => {
    const copy = source.slice();
    const random = crypto.getRandomValues(new Uint32Array(copy.length));
    for (let i=copy.length-1;i>0;i--) { const j=random[i]%(i+1); [copy[i],copy[j]]=[copy[j],copy[i]]; }
    return copy;
  };
  let online, stacks, timer, animationKey, scoredId;
  const all = hundredPoems.map((_,i)=>i);
  function setup(id,on=false) { online=on; go('poetSetup'); }
  let preferences = {cpu:1, first:'player', ...store.get('bozuSetup', {})};
  const cpuDelay = {短い:1800, ふつう:2700, 長い:3700};
  function setupHtml() {
    const people = online ? extraParticipants(true) : setupPanel('人数と相手',
      setupRow('CPUの人数', seg('bozu:cpu', [1,2,3,4,5].map(n=>[n,n+'人']), preferences.cpu)) +
      setupRow('最初の手番', seg('bozu:first', [['player','自分'],['cpu','CPU'],['random','ランダム']], preferences.first)) +
      setupRow('CPUの手番の長さ', seg('bozu:pace', CPU_PACE_CHOICES, preferences.pace || 'inherit')));
    const deck = setupPanel('ルール', setupRow('山札', '<b>4つ・各25枚</b>') +
      setupRow('蝉丸', '<b>坊主と同じ</b>'));
    return extraSetupLayout('bozu', online, people, deck, 'data-poet-start');
  }
  function setOption(key,value) {
    if (key === 'cpu' && [1,2,3,4,5].includes(+value)) preferences.cpu = +value;
    if (key === 'first' && ['player','cpu','random'].includes(value)) preferences.first = value;
    if (key === 'pace' && CPU_PACE_CHOICES.some(([id])=>id===value)) preferences.pace=value;
    store.set('bozuSetup', preferences);
    render();
  }
  function initial(round) {
    let turn = 0;
    if (!round.online) {
      const count = [1,2,3,4,5].includes(round.cpu) ? round.cpu : 1;
      for (let i = 0; i < count; i++) {
        round.seats.push({id:i?'cpu'+(i+1):'cpu',name:count===1?'CPU':'CPU '+(i+1)});
      }
      if (round.first === 'cpu') turn = 1;
      if (round.first === 'random') turn = shuffle(round.seats.map((_,i)=>i))[0];
    }
    round.seats = round.seats.map(p=>({...p,score:0}));
    animationKey = '';
    const deck = shuffle(all);
    stacks = [0,1,2,3].map(i=>deck.slice(i*25,i*25+25));
    return {piles:[25,25,25,25],discard:0,turn,last:-1,finish:false};
  }
  function apply(state,action) {
    if (state.finish || !state.seats.some(p=>p.id===action.uid)) return false;
    if (action.move!=='draw' || action.turn!==state.version || state.seats[state.turn].id!==action.uid) return false;
    const pile=stacks?.[action.cell];
    if (!Number.isInteger(action.cell) || !pile?.length) return false;
    const p=state.seats[state.turn];
    state.last=pile.pop(); state.piles=stacks.map(a=>a.length);
    const role=cardRole(state.last);
    if (role==='bozu') {
      state.discard+=p.score;
      p.score=0;
    } else {
      p.score++;
      if (role==='hime') {
        p.score+=state.discard;
        state.discard=0;
      }
    }
    state.turn=(state.turn+1)%state.seats.length;
    state.finish=stacks.every(a=>!a.length);
    return true;
  }
  function changed(state) {
    clearTimeout(timer);
    if (state.finish) {
      if (!state.online && scoredId!==state.id) {
        scoredId=state.id;
        const mine=state.seats.find(p=>p.id==='local');
        const bestCpu=Math.max(...state.seats.filter(p=>p!==mine).map(p=>p.score));
        const stats=store.get('stats',{}), key='vs_'+state.game;
        const result=stats[key]||[0,0,0];
        result[mine.score>bestCpu?0:mine.score<bestCpu?1:2]++;
        stats[key]=result;store.set('stats',stats);
      }
      return;
    }
    if (!state.online && state.seats[state.turn].id !== 'local') {
      const player = state.seats[state.turn];
      const cell = shuffle(state.piles.map((n,i)=>n?i:-1).filter(i=>i!==-1))[0];
      const {id,version:turn} = state;
      const current = () => S.screen==='extraPlay' && boardMatch.state?.id===id && boardMatch.state.version===turn;
      timer = setTimeout(async () => {
        if (!current()) return;
        await moveCpuCursor(player.name,[$(`[data-extra-poet-pick="${cell}"]`)],current);
        if (!current()) return;
        hideCursor();
        boardMatch.actionFromGuest({uid:player.id,id,move:'draw',cell,turn});
      }, cpuDelay[cpuPaceSetting(state.pace)] || 2700);
    }
  }
  function html(state) {
    const side = playSide({seats:'<div class="seats" id="poetScores"></div>',
      status:'<div class="status" id="poetStatus"></div>', actions:ruleButton('bozu'), on:state.online});
    return `<div class="screen"><main class="stage poet-stage">
      ${playHeader('坊主めくり', playMode(state.online), 'data-extra-exit')}
      <div class="poet-table" id="poetTable"></div>${playGear()}<div class="cutlayer" id="cutlayer"></div>
      </main>${side}</div>`;
  }
  function draw(state) {
    const table=$('#poetTable');if(!table)return;
    const seat=state.seats.find(p=>p.id===boardMatch.myId())?.id;
    const actionKey=state.id+'|'+state.version;
    const animate=actionKey!==animationKey;
    animationKey=actionKey;
    const active=state.seats[state.turn];
    const winners=state.seats.filter(p=>p.score===Math.max(...state.seats.map(q=>q.score))).map(p=>p.name);
    table.innerHTML=`<div class="poet-piles ${state.version===0?'dealing':''}">${state.piles.map((n,i)=>`<button class="poet-pick" data-extra-poet-pick="${i}" ${!n||state.finish||active.id!==seat?'disabled':''} aria-label="山札${i+1} 残り${n}枚"><span class="poet-card back"></span><b>${n}枚</b></button>`).join('')}</div>
      <div class="poet-open"><b>場の札 ${state.discard}枚</b>${state.last>=0?`<div class="${animate?'poet-flip':''}">${face(state.last)}</div>`:''}</div>`;
    $('#poetStatus').textContent=state.finish?winners.join('・')+'の勝ち':active.name+'の番';
    if(animate&&state.last>=0){
      sfx.play('CARD_FLIP');
      const role=cardRole(state.last);
      if(role!=='tono')transientAudio.later(()=>{if($('#poetTable')&&animationKey===actionKey)cut({text:role==='bozu'?'坊主':'姫',tone:role==='bozu'?'red':'gold',ms:1000});},240);
    }
    $('#poetScores').innerHTML=state.seats.map((p,i)=>`<div class="seat ${p===active?'turn':''}"><i class="dot" style="background:${SEAT_COLORS[i]}"></i><span class="nm">${esc(p.name)}</span><b>${p.score}枚</b></div>`).join('');
  }
  function button(d) {
    const state=boardMatch.state;
    if(d.extraPoetPick!==undefined) return boardMatch.send('draw',{cell:+d.extraPoetPick,turn:state.version});
  }
  const stop=()=>{clearTimeout(timer);stacks=null;};
  boardMatch.register('bozu',{initial,apply,changed,html,draw,button,stop});
  return {setup,setupHtml,setOption,start:()=>boardMatch.start('bozu',online,online?{}:preferences),face};
})();
