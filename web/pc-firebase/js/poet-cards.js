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
  let online, stacks, timer, scoredId;
  const all = hundredPoems.map((_,i)=>i);
  function setup(id,on=false) { online=on; go('poetSetup'); }
  // ローカルルール: hime … 姫を引いた時に場札が無ければもう1枚引く / semi … 蝉丸を坊主と同じにするか、全員の札を場へ出すか
  let preferences = {cpu:1, first:'player', hime:'off', semi:'bozu', ...store.get('bozuSetup', {})};
  const SEMIMARU = 9; // 10番 蝉丸
  const cpuDelay = {短い:1800, ふつう:2700, 長い:3700};
  function setupHtml() {
    const people = online ? extraParticipants(true) : setupPanel('人数と相手',
      setupRow('CPUの人数', seg('bozu:cpu', [1,2,3,4,5].map(n=>[n,n+'人']), preferences.cpu)) +
      setupRow('最初の手番', seg('bozu:first', [['player','自分'],['cpu','CPU'],['random','ランダム']], preferences.first)) +
      setupRow('CPUの手番の長さ', seg('bozu:pace', CPU_PACE_CHOICES, preferences.pace || 'inherit')));
    const deck = setupPanel('ルール', setupRow('山札', '<b>4つ・各25枚</b>') +
      setupRow('姫で場札が無い時', seg('bozu:hime', [['off','そのまま'],['on','もう1枚引く']], preferences.hime)) +
      setupRow('蝉丸', seg('bozu:semi', [['bozu','坊主と同じ'],['all','全員の札を場へ']], preferences.semi)));
    return extraSetupLayout('bozu', online, people, deck, 'data-poet-start');
  }
  function setOption(key,value) {
    if (key === 'cpu' && [1,2,3,4,5].includes(+value)) preferences.cpu = +value;
    if (key === 'first' && ['player','cpu','random'].includes(value)) preferences.first = value;
    if (key === 'pace' && CPU_PACE_CHOICES.some(([id])=>id===value)) preferences.pace=value;
    if (key === 'hime' && ['on','off'].includes(value)) preferences.hime = value;
    if (key === 'semi' && ['bozu','all'].includes(value)) preferences.semi = value;
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
    const deck = shuffle(all);
    stacks = [0,1,2,3].map(i=>deck.slice(i*25,i*25+25));
    return {piles:[25,25,25,25],discard:0,turn,last:-1,finish:false,extra:false,
      hime:round.hime==='on'?'on':'off', semi:round.semi==='all'?'all':'bozu'};
  }
  function apply(state,action) {
    if (state.finish || !state.seats.some(p=>p.id===action.uid)) return false;
    if (action.move!=='draw' || action.turn!==state.version || state.seats[state.turn].id!==action.uid) return false;
    const pile=stacks?.[action.cell];
    if (!Number.isInteger(action.cell) || !pile?.length) return false;
    const p=state.seats[state.turn];
    state.last=pile.pop(); state.piles=stacks.map(a=>a.length);
    p.lastCard=state.last;
    const role=cardRole(state.last);
    const fieldBefore=state.discard;
    if (role==='bozu' && state.last===SEMIMARU && state.semi==='all') {
      // 蝉丸: 全員の持ち札を場へ
      for (const q of state.seats) { state.discard+=q.score; q.score=0; if (q!==p) q.lastCard=-1; }
    } else if (role==='bozu') {
      state.discard+=p.score;
      p.score=0;
    } else {
      p.score++;
      if (role==='hime') {
        p.score+=state.discard;
        state.discard=0;
      }
    }
    state.finish=stacks.every(a=>!a.length);
    // 姫を引いて場札が1枚も無かった時は、同じ人がもう1枚引く(続けて姫でも同じ)
    state.extra=role==='hime' && fieldBefore===0 && state.hime==='on' && !state.finish;
    if (!state.extra) state.turn=(state.turn+1)%state.seats.length;
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
      <div class="poet-table"><div class="poet-layout" id="poetTable"></div>${playGear()}</div><div class="cutlayer" id="cutlayer"></div>
      </main>${side}</div>`;
  }
  const roleName = {hime:'姫',bozu:'坊主',tono:'殿'};
  const cpuIcons = ['ねこ','きつね','うさぎ','ふくろう','だるま'];
  function seatIcon(state, player, index) {
    if (player.id === boardMatch.myId()) return meAv();
    const avatar = state.online ? fbState.players[player.id]?.avatar : AV.findIndex(([name]) => name === cpuIcons[index-1]);
    if (Number.isInteger(avatar) && AV[avatar]) return `<span class="avatar av">${avSvg(avatar)}</span>`;
    return `<span class="avatar">${esc([...player.name][0] || '？')}</span>`;
  }
  const stackDepth = (count, held = false) => Math.sqrt(count) * (held ? 1.8 : 3);
  function stack(count, held = false) {
    // 札の上面を持ち上げ、下端に紙の層を描く。卓上の山と小さい持ち札で同じ縮尺曲線を使う。
    const depth = stackDepth(count,held);
    return `<span class="poet-slot${held ? ' poet-hand' : ''}" data-count="${count}"
      aria-hidden="true" style="--depth:${depth.toFixed(2)}px">${count ? '<span class="poet-card back"></span>' : ''}</span>`;
  }
  function place(state, index, front, mine) {
    const player = state.seats[index];
    const count = state.seats.length;
    const offset = (index - front + count) % count;
    // 手前は固定し、残りの席を上半分の楕円に沿って並べる。
    const angle = count <= 2 ? 0 : (offset - count / 2) / (count - 2) * Math.PI * .84;
    const x = offset ? 50 + 40 * Math.sin(angle) : 50;
    const y = offset ? 38 - 26 * Math.cos(angle) : 78;
    const drawer = state.extra ? state.turn : (state.turn + count - 1) % count;
    const last = player.lastCard ?? (index === drawer ? state.last : -1);
    const role = last >= 0 ? roleName[cardRole(last)] : '';
    const who = mine === index ? '自分' : '';
    return `<div class="poet-place ${offset ? '' : 'front'} ${index===state.turn && !state.finish ? 'turn' : ''}"
      data-poet-seat="${index}" style="left:${x}%;top:${y}%;--seat:${SEAT_COLORS[index%SEAT_COLORS.length]}">
      <div class="poet-reveal poet-own" data-count="${player.score}" data-score="${player.score}" style="--k:${Math.min(1,Math.sqrt(player.score)/10).toFixed(3)}"
        aria-label="持ち札${player.score}枚">${last>=0 ? face(last) : ''}</div>
      <div class="poet-tally"><span class="poet-identity">${seatIcon(state,player,index)}<span class="poet-name">${esc(player.name)}</span></span>
      <span class="poet-role">${[who, role].filter(Boolean).join(' · ')}</span></div>
    </div>`;
  }
  function pileRow(state, canDraw) {
    const piles = state.piles.map((n,i)=>`<button class="poet-pick" data-extra-poet-pick="${i}"
      ${canDraw && n ? '' : 'disabled'} aria-label="山札${i+1} 残り${n}枚">
      ${stack(n)}<b>${n}枚</b></button>`).join('');
    return `<div class="poet-piles${state.version === 0 ? ' dealing' : ''}" style="--row-depth:${stackDepth(Math.max(...state.piles,state.discard))}px">
      <div class="poet-bank" role="group" aria-label="山札"><span class="poet-caption" aria-hidden="true">山札</span>${piles}</div>
      <div class="poet-pot"><span class="poet-caption">場札</span>${stack(state.discard)}<b>${state.discard}枚</b></div></div>`;
  }
  function fly(table, state, pile, drawer, own) {
    const origin = table.querySelector(`[data-extra-poet-pick="${pile}"] .poet-slot`);
    const target = table.querySelector(`[data-poet-seat="${drawer}"] .poet-reveal`);
    const start = (origin.firstElementChild || origin).getBoundingClientRect(), end = target.getBoundingClientRect();
    if (!end.width || !start.width) return 0;
    // 描画位置は着地点が基準。画面の拡大率に合わせて座標を CSS ピクセルへ戻す。
    const zoom = end.width / target.offsetWidth;
    const dx = (start.left + start.width/2 - end.left - end.width/2) / zoom;
    const dy = (start.top + start.height/2 - end.top - end.height/2) / zoom;
    const scale = start.width / end.width;
    const flight = document.createElement('div');
    flight.className = 'poet-flight';
    flight.setAttribute('aria-hidden','true');
    flight.innerHTML = `<span class="poet-card back"></span>${face(state.last)}`;
    target.classList.add('receiving');
    target.append(flight);
    const pose = (x,y,size,angle) => `perspective(900px) translate(${x}px,${y}px) scale(${size}) rotateY(${angle}deg)`;
    const lifted = own ? pose(dx*.55,dy*.62-12,(1+scale)/2,95) : pose(dx,dy-6,scale*1.12,180);
    const duration = own ? 750 : 1100;
    const motion = flight.animate([
      {transform:pose(dx,dy,scale,0),offset:0},
      {transform:lifted,offset:own ? .45 : .35},
      ...(!own ? [{transform:lifted,offset:.60}] : []),
      {transform:pose(0,0,1,180),offset:1}
    ], {duration,easing:'ease-in-out',fill:'both'});
    const settle = () => { target.classList.remove('receiving'); flight.remove(); };
    motion.onfinish = settle;
    motion.oncancel = settle;
    return duration;
  }
  function draw(state) {
    const table=$('#poetTable');if(!table)return;
    const key=state.id+'|'+state.version;
    if(table.dataset.frame===key)return;
    const consecutive=table.dataset.frame===state.id+'|'+(state.version-1);
    const previousPiles=consecutive ? table.dataset.piles.split(',').map(Number) : [];
    const pile=state.piles.findIndex((n,i)=>n<previousPiles[i]);
    const drawer=state.extra?state.turn:(state.turn+state.seats.length-1)%state.seats.length;
    const oldScore=table.querySelector(`[data-poet-seat="${drawer}"] [data-score]`)?.dataset.score;
    table.dataset.frame=key;
    table.dataset.piles=state.piles.join(',');
    const mine=state.seats.findIndex(p=>p.id===boardMatch.myId());
    const front=Math.max(0,mine);
    const active=state.seats[state.turn];
    const best=Math.max(...state.seats.map(p=>p.score));
    const winners=state.seats.filter(p=>p.score===best).map(p=>p.name);
    table.innerHTML=state.seats.map((_,i)=>place(state,i,front,mine)).join('')
      +pileRow(state,!state.finish && state.turn===mine);
    $('#poetStatus').textContent=state.finish?winners.join('・')+'の勝ち':active.name+(state.extra?'がもう1枚':'の番');
    $('#poetScores').innerHTML=state.seats.map((p,i)=>`<div class="seat ${!state.finish && i===state.turn?'turn':''}">${seatIcon(state,p,i)}<span class="nm">${esc(p.name)}</span><b>${p.score}枚</b></div>`).join('');
    if(pile<0 || state.last<0 || document.hidden)return;
    const reduced=S.set.reduce || matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration=reduced ? 0 : fly(table,state,pile,drawer,drawer===mine);
    const delta=state.seats[drawer].score-Number(oldScore);
    if(delta && !reduced){
      const gain=document.createElement('span');
      gain.className='poet-delta';
      gain.textContent=(delta>0?'+':'−')+Math.abs(delta)+'枚';
      gain.style.animationDelay=duration+'ms';
      table.querySelector(`[data-poet-seat="${drawer}"] .poet-tally`).append(gain);
    }
    sfx.play('CARD_FLIP');
    const role=cardRole(state.last);
    const semiAll=state.last===SEMIMARU && state.semi==='all';
    if(role!=='tono' && !reduced)transientAudio.later(()=>{
      if(!table.isConnected || table.dataset.frame!==key)return;
      cut({text:semiAll?'蝉丸 全員の札を場へ':roleName[role],tone:role==='bozu'?'red':'gold',ms:semiAll?1400:1000});
      if(state.extra)setTimeout(()=>{ if(table.isConnected && table.dataset.frame===key)cut({text:'もう1枚',tone:'gold',ms:900}); },1050);
    },duration);
  }
  function button(d) {
    const state=boardMatch.state;
    if(d.extraPoetPick!==undefined) return boardMatch.send('draw',{cell:+d.extraPoetPick,turn:state.version});
  }
  const stop=()=>{clearTimeout(timer);stacks=null;};
  boardMatch.register('bozu',{initial,apply,changed,html,draw,button,stop});
  return {setup,setupHtml,setOption,start:()=>boardMatch.start('bozu',online,online?{hime:preferences.hime,semi:preferences.semi}:preferences),face};
})();
