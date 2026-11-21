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
  // ローカルルール: himeBonus … 姫ボーナス(姫を引いた時に場札が無ければもう1枚引く。既定で有効)
  // semi … 蝉丸を坊主と同じにするか、全員の札を場へ出すか / peek … めくれる札(各山の一番上)の坊主・姫の数を見せる
  let preferences = {cpu:1, first:'player', himeBonus:'on', semi:'bozu', peek:'on', ...store.get('bozuSetup', {})};
  delete preferences.hime; // 以前の項目(既定が「そのまま」だった)は引き継がない
  const SEMIMARU = 9; // 10番 蝉丸
  const cpuDelay = {短い:1800, ふつう:2700, 長い:3700};
  function setupHtml() {
    const people = online ? extraParticipants(true) : setupPanel('人数と相手',
      setupRow('CPUの人数', seg('bozu:cpu', [1,2,3,4,5].map(n=>[n,n+'人']), preferences.cpu)) +
      setupRow('最初の手番', seg('bozu:first', [['player','自分'],['cpu','CPU'],['random','ランダム']], preferences.first)) +
      setupRow('CPUの手番の長さ', seg('bozu:pace', CPU_PACE_CHOICES, preferences.pace || 'inherit')));
    const deck = setupPanel('ルール', setupRow('山札', '<b>4つ・各25枚</b>') +
      setupRow('姫ボーナス', seg('bozu:himeBonus', [['on','あり'],['off','なし']], preferences.himeBonus)) +
      setupRow('蝉丸', seg('bozu:semi', [['bozu','坊主と同じ'],['all','全員の札を場へ']], preferences.semi)) +
      setupRow('めくれる札の坊主・姫', seg('bozu:peek', [['on','数を見せる'],['off','見せない']], preferences.peek)));
    return extraSetupLayout('bozu', online, people, deck, 'data-poet-start');
  }
  function setOption(key,value) {
    if (key === 'cpu' && [1,2,3,4,5].includes(+value)) preferences.cpu = +value;
    if (key === 'first' && ['player','cpu','random'].includes(value)) preferences.first = value;
    if (key === 'pace' && CPU_PACE_CHOICES.some(([id])=>id===value)) preferences.pace=value;
    if (key === 'himeBonus' && ['on','off'].includes(value)) preferences.himeBonus = value;
    if (key === 'peek' && ['on','off'].includes(value)) preferences.peek = value;
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
      hime:round.hime==='off'?'off':'on', semi:round.semi==='all'?'all':'bozu', peek:round.peek==='off'?'off':'on', tops:topRoles()};
  }
  // 各山の一番上(次にめくれる札)にある坊主・姫の数。どの山かは知らせない。
  function topRoles() {
    const tops={bozu:0,hime:0};
    for (const pile of stacks || []) if (pile.length) { const r=cardRole(pile[pile.length-1]); if (r in tops) tops[r]++; }
    return tops;
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
    state.tops=topRoles();
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
        while (performance.now() < busyUntil) {
          await new Promise(r => setTimeout(r, busyUntil - performance.now() + 30));
          if (!current()) return;
        }
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
        aria-label="持ち札${player.score}枚">${last>=0 && player.score>0 ? face(last) : ''}</div>
      <div class="poet-tally"><span class="poet-identity">${seatIcon(state,player,index)}<span class="poet-name">${esc(player.name)}</span></span>
      <span class="poet-role">${[who, role].filter(Boolean).join(' · ')}</span></div>
    </div>`;
  }
  function pileRow(state, canDraw) {
    const piles = state.piles.map((n,i)=>`<button class="poet-pick" data-extra-poet-pick="${i}"
      ${canDraw && n ? '' : 'disabled'} aria-label="山札${i+1} 残り${n}枚">
      ${stack(n)}<b>${n}枚</b></button>`).join('');
    return `<div class="poet-piles${state.version === 0 ? ' dealing' : ''}" style="--row-depth:${stackDepth(Math.max(...state.piles,state.discard))}px">
      <div class="poet-bank" role="group" aria-label="山札"><span class="poet-caption" aria-hidden="true">山札</span>${omen(state)}${piles}</div>
      <div class="poet-pot"><span class="poet-caption">場札</span>${stack(state.discard)}<b>${state.discard}枚</b></div></div>`;
  }
  function omen(state) {
    if (state.peek!=='on' || state.finish || !state.tops) return '';
    const {bozu,hime}=state.tops;
    return `<div class="poet-omen${bozu?' danger':''}" aria-live="polite" aria-label="めくれる札に 坊主${bozu}枚 姫${hime}枚">
      <span class="bozu">坊主 <b>${bozu}</b>枚</span>・<span class="hime">姫 <b>${hime}</b>枚</span></div>`;
  }
  // 卓の中での位置(画面の拡大率を戻した CSS ピクセル)
  function boxIn(table, el) {
    const t = table.getBoundingClientRect(), r = el.getBoundingClientRect(), zoom = t.width / table.offsetWidth || 1;
    return {x:(r.left-t.left)/zoom, y:(r.top-t.top)/zoom, w:r.width/zoom, h:r.height/zoom};
  }
  // 持ち札の置き場・場札の見た目だけを、指定の枚数にする(状態は変えない)
  function showOwn(el, count) {
    if (!el) return;
    el.dataset.count = count;
    el.style.setProperty('--k', Math.min(1, Math.sqrt(count) / 10).toFixed(3));
  }
  function showPot(table, count) {
    const pot = table.querySelector('.poet-pot'); if (!pot) return;
    const slot = pot.querySelector('.poet-slot');
    slot.dataset.count = count;
    slot.style.setProperty('--depth', stackDepth(count).toFixed(2) + 'px');
    const back = slot.querySelector(':scope > .poet-card.back');
    if (count && !back) slot.insertAdjacentHTML('beforeend', '<span class="poet-card back"></span>');
    if (!count && back) back.remove();
    const label = pot.querySelector(':scope > b'); if (label) label.textContent = count + '枚';
  }
  // 引いた札を山から席へ運ぶ。着地した時に onLand を呼ぶ。
  function fly(table, state, pile, drawer, own, keep, onLand) {
    const origin = table.querySelector(`[data-extra-poet-pick="${pile}"] .poet-slot`);
    const target = table.querySelector(`[data-poet-seat="${drawer}"] .poet-reveal`);
    const start = (origin.firstElementChild || origin).getBoundingClientRect(), end = target.getBoundingClientRect();
    if (!end.width || !start.width) { onLand(); return 0; }
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
    const travel = own ? 750 : 1100;
    // 回転させる箱(.poet-flight)には透明度を付けない。付けると立体が平らになり、裏面が出てしまう。
    const motion = flight.animate([
      {transform:pose(dx,dy,scale,0),offset:0},
      {transform:lifted,offset:own ? .45 : .35},
      ...(!own ? [{transform:lifted,offset:.60}] : []),
      {transform:pose(0,0,1,180),offset:1}
    ], {duration:travel,easing:'ease-in-out',fill:'both'});
    let landed = false;
    const land = () => { if (!landed) { landed = true; onLand(); } };
    const settle = () => { land(); target.classList.remove('receiving'); flight.remove(); };
    // 坊主などで手元に札が残らない時は、着地した後に表の札だけを薄くして消す
    motion.onfinish = () => {
      if (keep) return settle();
      land();
      const fade = flight.querySelector(':scope > .portrait')?.animate([{opacity:1},{opacity:1,offset:.45},{opacity:0}],{duration:650,fill:'both'});
      if (!fade) return settle();
      fade.onfinish = settle; fade.oncancel = settle;
    };
    motion.oncancel = settle;
    return keep ? travel : travel + 650;
  }
  // 札の束を from から to へ 1 枚ずつ流す。1 枚着くたびに step(着いた枚数, 流す枚数) を呼ぶ。
  function stream(table, from, to, count, step, delay = 0) {
    const n = Math.min(count, 14), gap = n > 1 ? Math.min(85, 700 / (n - 1)) : 0, each = 520;
    const a = boxIn(table, from), b = boxIn(table, to);
    for (let i = 0; i < n; i++) {
      const card = document.createElement('span');
      card.className = 'poet-card back poet-stream';
      card.setAttribute('aria-hidden', 'true');
      card.style.cssText = `left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px`;
      table.append(card);
      const sx = a.x + a.w/2 - (b.x + b.w/2), sy = a.y + a.h/2 - (b.y + b.h/2), k = a.w / b.w;
      const tilt = (i % 3 - 1) * 7, lift = Math.min(60, Math.hypot(sx, sy) * .18);
      const move = card.animate([
        {transform:`translate(${sx}px,${sy}px) scale(${k}) rotate(${tilt}deg)`, opacity:0},
        {transform:`translate(${sx}px,${sy}px) scale(${k}) rotate(${tilt}deg)`, opacity:1, offset:.08},
        {transform:`translate(${sx*.5}px,${sy*.5 - lift}px) scale(${(k+1)/2}) rotate(${-tilt}deg)`, opacity:1, offset:.5},
        {transform:'translate(0,0) scale(1) rotate(0deg)', opacity:1}
      ], {duration:each, delay:delay + i*gap, easing:'cubic-bezier(.35,.1,.3,1)', fill:'backwards'});
      const done = () => { card.remove(); step(Math.round((i + 1) * count / n), count); };
      move.onfinish = done; move.oncancel = () => card.remove();
    }
    return delay + (n - 1) * gap + each;
  }
  let busyUntil = 0; // 札を動かしている間は CPU が次を引かない
  function draw(state) {
    const table=$('#poetTable');if(!table)return;
    const key=state.id+'|'+state.version;
    if(table.dataset.frame===key)return;
    const consecutive=table.dataset.frame===state.id+'|'+(state.version-1);
    const previousPiles=consecutive ? table.dataset.piles.split(',').map(Number) : [];
    const pile=state.piles.findIndex((n,i)=>n<previousPiles[i]);
    const drawer=state.extra?state.turn:(state.turn+state.seats.length-1)%state.seats.length;
    // 描き直す前の見た目(席ごとの枚数・一番上の札、場札の枚数)
    const before=state.seats.map((_,i)=>{
      const el=table.querySelector(`[data-poet-seat="${i}"] .poet-reveal`);
      return {score:Number(el?.dataset.score ?? 0), face:el?.querySelector(':scope > .portrait')?.outerHTML || ''};
    });
    const oldPot=Number(table.querySelector('.poet-pot .poet-slot')?.dataset.count ?? 0);
    table.dataset.frame=key;
    table.dataset.piles=state.piles.join(',');
    table.classList.remove('poet-busy');
    const mine=state.seats.findIndex(p=>p.id===boardMatch.myId());
    const front=Math.max(0,mine);
    const active=state.seats[state.turn];
    const best=Math.max(...state.seats.map(p=>p.score));
    const winners=state.seats.filter(p=>p.score===best).map(p=>p.name);
    table.innerHTML=state.seats.map((_,i)=>place(state,i,front,mine)).join('')
      +pileRow(state,!state.finish && state.turn===mine);
    $('#poetStatus').textContent=state.finish?winners.join('・')+'の勝ち':active.name+(state.extra?'がもう1枚':'の番');
    $('#poetScores').innerHTML=state.seats.map((p,i)=>`<div class="seat ${!state.finish && i===state.turn?'turn':''}">${seatIcon(state,p,i)}<span class="nm">${esc(p.name)}</span><b>${p.score}枚</b></div>`).join('');
    if(pile<0 || state.last<0 || document.hidden || !consecutive)return;
    const reduced=S.set.reduce || matchMedia('(prefers-reduced-motion: reduce)').matches;
    const role=cardRole(state.last);
    const semiAll=state.last===SEMIMARU && state.semi==='all';
    sfx.play('CARD_FLIP');
    if(!reduced){
      const reveal=i=>table.querySelector(`[data-poet-seat="${i}"] .poet-reveal`);
      const potSlot=()=>table.querySelector('.poet-pot .poet-slot');
      const live=()=>table.isConnected && table.dataset.frame===key;
      // 札が着くまでは前の枚数・前の札のまま見せる(厚みが先に変わらないように)
      const under=(i)=>{ const el=reveal(i); if(before[i].face && el && !el.querySelector(':scope > .poet-under')){ el.insertAdjacentHTML('afterbegin',before[i].face); el.firstElementChild.classList.add('poet-under'); } };
      const moving=state.seats.map((p,i)=>role==='bozu' && (i===drawer || semiAll) && before[i].score>0 ? before[i].score : 0);
      state.seats.forEach((p,i)=>{ if(i===drawer || moving[i]){ under(i); showOwn(reveal(i),before[i].score); } });
      showPot(table,oldPot);
      const keep=state.seats[drawer].score>0;
      const takeFromPot=role==='hime' ? oldPot : 0;
      const landed=()=>{
        if(!live())return;
        if(role!=='bozu'){
          showOwn(reveal(drawer),before[drawer].score+1);
          reveal(drawer)?.querySelector(':scope > .poet-under')?.remove();
        }
      };
      const duration=fly(table,state,pile,drawer,drawer===mine,keep,landed);
      const total=moving.some(Boolean)||takeFromPot ? 1 : 0;
      let end=duration;
      if(total){
        // カットインが終わってから札を流す
        const wait=duration+(S.set.cutin ? (semiAll?1400:1000)*SPEED()+320 : 180);
        table.classList.add('poet-busy');
        let finish=wait;
        transientAudio.later(()=>{
          if(!live())return;
          sfx.play('SHUFFLE');
          const pot=potSlot();
          if(role==='bozu'){
            let potNow=oldPot;
            moving.forEach((n,i)=>{
              if(!n)return;
              const from=reveal(i); let gone=0;
              stream(table,from,pot,n,(arrived)=>{
                if(!live())return;
                potNow+=arrived-gone; gone=arrived;
                showOwn(from,n-arrived); if(arrived>=n) from.querySelector(':scope > .poet-under')?.remove();
                showPot(table,potNow);
              });
            });
          }else{
            const to=reveal(drawer), base=before[drawer].score+1;
            stream(table,pot,to,takeFromPot,(arrived)=>{ if(!live())return; showPot(table,takeFromPot-arrived); showOwn(to,base+arrived); });
          }
        },wait);
        const longest=Math.max(...moving,takeFromPot);
        const n=Math.min(longest,14);
        finish=wait+(n>1?(n-1)*Math.min(85,700/(n-1)):0)+520;
        end=finish;
        setTimeout(()=>{ if(!live())return; table.classList.remove('poet-busy');
          // 最後は状態どおりの見た目にそろえる
          state.seats.forEach((p,i)=>{ if(i===drawer||moving[i]) showOwn(reveal(i),p.score); });
          showPot(table,state.discard);
        },finish+40);
      }
      busyUntil=performance.now()+end;
      const delta=state.seats[drawer].score-before[drawer].score;
      if(delta){
        const gain=document.createElement('span');
        gain.className='poet-delta';
        gain.textContent=(delta>0?'+':'−')+Math.abs(delta)+'枚';
        gain.style.animationDelay=end+'ms';
        table.querySelector(`[data-poet-seat="${drawer}"] .poet-tally`).append(gain);
      }
      if(role!=='tono')transientAudio.later(()=>{
        if(!live())return;
        // 筆文字・和の色(姫は桜色、坊主は墨色、蝉丸は古代紫)
        cut({text:semiAll?'蝉丸':roleName[role],sub:semiAll?'全員の札を場へ':'',font:'fude',
          tone:'wa-cut '+(semiAll?'murasaki':role==='bozu'?'sumi':'sakura'),ms:semiAll?1400:1000});
        if(state.extra)setTimeout(()=>{ if(live())cut({text:'姫ボーナス',sub:'もう1枚',font:'fude',tone:'wa-cut sakura',ms:1000}); },1050);
      },duration);
    }
  }
  function button(d) {
    const state=boardMatch.state;
    if(d.extraPoetPick!==undefined) return boardMatch.send('draw',{cell:+d.extraPoetPick,turn:state.version});
  }
  const stop=()=>{clearTimeout(timer);stacks=null;};
  boardMatch.register('bozu',{initial,apply,changed,html,draw,button,stop});
  return {setup,setupHtml,setOption,start:()=>{const rules={hime:preferences.himeBonus,semi:preferences.semi,peek:preferences.peek};
    return boardMatch.start('bozu',online,online?rules:{...preferences,...rules});},face};
})();
