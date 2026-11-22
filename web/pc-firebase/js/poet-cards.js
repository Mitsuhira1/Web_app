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
  // semi … 蝉丸を坊主と同じにするか、全員の札を場へ出すか
  let preferences = {cpu:1, first:'player', himeBonus:'on', semi:'bozu', ...store.get('bozuSetup', {})};
  delete preferences.peek; // 山札の一番上の坊主・姫の数を見せる設定は廃止した
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
      setupRow('蝉丸', seg('bozu:semi', [['bozu','坊主と同じ'],['all','全員の札を場へ']], preferences.semi)));
    return extraSetupLayout('bozu', online, people, deck, 'data-poet-start');
  }
  function setOption(key,value) {
    if (key === 'cpu' && [1,2,3,4,5].includes(+value)) preferences.cpu = +value;
    if (key === 'first' && ['player','cpu','random'].includes(value)) preferences.first = value;
    if (key === 'pace' && CPU_PACE_CHOICES.some(([id])=>id===value)) preferences.pace=value;
    if (key === 'himeBonus' && ['on','off'].includes(value)) preferences.himeBonus = value;
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
    round.seats = round.seats.map(p=>({...p,score:0,pile:[]}));
    const deck = shuffle(all);
    stacks = [0,1,2,3].map(i=>deck.slice(i*25,i*25+25));
    return {piles:[25,25,25,25],discard:0,field:[],turn,last:-1,finish:false,extra:false,
      hime:round.hime==='off'?'off':'on', semi:round.semi==='all'?'all':'bozu'};
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
    // 札の並び(下→上)は見せ方のためだけに持つ。枚数(score・discard)の数え方は今までどおり。
    const field=state.field||(state.field=[]);
    const own=q=>q.pile||(q.pile=[]);
    if (role==='bozu' && state.last===SEMIMARU && state.semi==='all') {
      // 蝉丸: 全員の持ち札を場へ
      for (const q of state.seats) { state.discard+=q.score; q.score=0; field.push(...own(q)); q.pile=[]; if (q!==p) q.lastCard=-1; }
    } else if (role==='bozu') {
      state.discard+=p.score;
      p.score=0;
      field.push(...own(p)); p.pile=[];
    } else {
      p.score++;
      if (role==='hime') {
        p.score+=state.discard;
        state.discard=0;
        // 場札は姫の下へ入れ、姫が一番上
        own(p).push(...field); field.length=0;
      }
      own(p).push(state.last);
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
    const top = player.pile?.length ? player.pile[player.pile.length-1] : last;
    const role = last >= 0 ? roleName[cardRole(last)] : '';
    return `<div class="poet-place ${offset ? '' : 'front'} ${index===state.turn && !state.finish ? 'turn' : ''}"
      data-poet-seat="${index}" style="left:${x}%;top:${y}%;--seat:${SEAT_COLORS[index%SEAT_COLORS.length]}">
      <div class="poet-reveal poet-own" data-count="${player.score}" data-score="${player.score}" style="--k:${Math.min(1,Math.sqrt(player.score)/10).toFixed(3)}"
        aria-label="持ち札${player.score}枚">${top>=0 && player.score>0 ? face(top) : ''}</div>
      <div class="poet-tally"><span class="poet-identity">${seatIcon(state,player,index)}<span class="poet-name">${esc(player.name)}</span></span>
      <span class="poet-role">${role || '&nbsp;'}</span></div>
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

  // 卓の中での位置(画面の拡大率を戻した CSS ピクセル)
  function boxIn(table, el) {
    const t = table.getBoundingClientRect(), r = el.getBoundingClientRect(), zoom = t.width / table.offsetWidth || 1;
    return {x:(r.left-t.left)/zoom, y:(r.top-t.top)/zoom, w:r.width/zoom, h:r.height/zoom};
  }
  // 持ち札の置き場の見た目だけを「一番上の札・枚数」にする(状態は変えない)
  function showOwn(el, top, count) {
    if (!el) return;
    el.dataset.count = count;
    el.style.setProperty('--k', Math.min(1, Math.sqrt(count) / 10).toFixed(3));
    el.querySelectorAll(':scope > .portrait').forEach(c => c.remove());
    if (count > 0 && top >= 0) el.insertAdjacentHTML('afterbegin', face(top));
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
  // 置き場・場札の一番上の札の位置(厚みの分だけ上にずれている)
  const ownTop = el => el.querySelector(':scope > .portrait') || el;
  const potTop = table => { const slot = table.querySelector('.poet-pot .poet-slot'); return slot.querySelector(':scope > .poet-card.back') || slot; };
  const pose = (x,y,size,angle) => `perspective(900px) translate(${x}px,${y}px) scale(${size}) rotateY(${angle}deg)`;
  // 引いた札を山から席へ運ぶ。着地した時に onLand を呼ぶ。
  function fly(table, state, pile, drawer, own, onLand) {
    const origin = table.querySelector(`[data-extra-poet-pick="${pile}"] .poet-slot`);
    const target = table.querySelector(`[data-poet-seat="${drawer}"] .poet-reveal`);
    const start = (origin.firstElementChild || origin).getBoundingClientRect(), end = target.getBoundingClientRect();
    if (!end.width || !start.width) { onLand(); return 0; }
    const zoom = end.width / target.offsetWidth;
    // 着地点は、今の厚みの上(一番上の札の位置)。札は厚みの分だけ上にずらして描かれる。
    const topCard = target.querySelector(':scope > .portrait');
    const depth = topCard ? (end.top - topCard.getBoundingClientRect().top) / (end.width / target.offsetWidth) : 0;
    const dx = (start.left + start.width/2 - end.left - end.width/2) / zoom;
    const dy = (start.top + start.height/2 - end.top - end.height/2) / zoom + depth;
    const scale = start.width / end.width;
    const flight = document.createElement('div');
    flight.className = 'poet-flight';
    flight.setAttribute('aria-hidden','true');
    flight.innerHTML = `<span class="poet-card back"></span>${face(state.last)}`;
    target.classList.add('landing');
    target.append(flight);
    const lifted = own ? pose(dx*.55,dy*.62-12,(1+scale)/2,95) : pose(dx,dy-6,scale*1.12,180);
    const travel = own ? 750 : 1100;
    // 回転させる箱には透明度を付けない(付けると立体が平らになり、裏面が出る)
    const motion = flight.animate([
      {transform:pose(dx,dy,scale,0),offset:0},
      {transform:lifted,offset:own ? .45 : .35},
      ...(!own ? [{transform:lifted,offset:.60}] : []),
      {transform:pose(0,0,1,180),offset:1}
    ], {duration:travel,easing:'ease-in-out',fill:'both'});
    const settle = () => { onLand(); target.classList.remove('landing'); flight.remove(); };
    motion.onfinish = settle;
    motion.oncancel = () => { target.classList.remove('landing'); flight.remove(); };
    return travel;
  }
  // 札を 1 枚ずつ from から to へ流す。cards は流す順(一番上から)の札(-1 は裏しか分からない札)。
  // faceUp: 表向きで持ち上げ、飛びながら裏返す。under: 行き先の札の下へ入れる(z を下げる)。
  function stream(table, cards, fromEl, toEl, {faceUp, under, live, onLeave, onArrive}) {
    const n = cards.length; if (!n) return 0;
    const gap = Math.min(95, 1300 / n), each = 600;
    cards.forEach((card, i) => {
      setTimeout(() => {
        if (!live()) return;
        const a = boxIn(table, fromEl()), b = boxIn(table, toEl());
        const el = document.createElement('div');
        el.className = 'poet-stream' + (under ? ' under' : '');
        el.setAttribute('aria-hidden', 'true');
        el.style.cssText = `left:${a.x}px;top:${a.y}px;width:${a.w}px;height:${a.h}px`;
        el.innerHTML = `<span class="poet-card back"></span>${card >= 0 ? face(card) : '<span class="poet-card back portrait"></span>'}`;
        table.append(el);
        onLeave(i);
        const dx = b.x + b.w/2 - (a.x + a.w/2), dy = b.y + b.h/2 - (a.y + a.h/2), k = b.w / a.w;
        const lift = Math.min(70, Math.hypot(dx, dy) * .22), tilt = (i % 3 - 1) * 5;
        const s0 = faceUp ? 180 : 0;
        const motion = el.animate([
          {transform:`${pose(0,0,1,s0)} rotate(0deg)`},
          {transform:`${pose(dx*.5,dy*.5-lift,(1+k)/2,faceUp ? 90 : 0)} rotate(${tilt}deg)`, offset:.5},
          {transform:`${pose(dx,dy,k,0)} rotate(0deg)`}
        ], {duration:each, easing:'cubic-bezier(.4,.1,.3,1)', fill:'both'});
        motion.onfinish = () => { el.remove(); onArrive(i); };
        motion.oncancel = () => el.remove();
      }, i * gap);
    });
    return (n - 1) * gap + each;
  }
  // 札を動かす音は枚数に合わせる: 3 枚までは 1 枚ごとに「パサッ」、4〜9 枚はパラパラ 1 回、10 枚以上は途中でもう 1 回
  function cardSound(n, ms, live) {
    const few = n <= 3;
    return {
      start() { if (few) return; sfx.play('SHUFFLE', {volume: n < 10 ? .75 : 1}); if (n >= 10) setTimeout(() => { if (live()) sfx.play('SHUFFLE', {volume: .8}); }, ms / 2); },
      each() { if (few && live()) sfx.play('CARD', {volume: .8}); }
    };
  }
  let busyUntil = 0; // 札を動かしている間は、CPU も自分も次を引かない
  let shown = null;  // 前に描いた時の札の並び(持ち札・場札)
  const snapshot = state => ({id:state.id, version:state.version, discard:state.discard,
    field:state.field ? state.field.slice() : null,
    seats:state.seats.map(p=>({score:p.score, pile:p.pile ? p.pile.slice() : null, top:p.pile?.length ? p.pile[p.pile.length-1] : (p.score>0 ? (p.lastCard ?? -1) : -1)}))});
  // 並びが分からない札は -1(裏)で埋める。一番上だけは分かる。
  const pileOf = (seat) => seat.pile || Array.from({length:seat.score}, (_, i) => i === seat.score - 1 ? seat.top : -1);
  function draw(state) {
    const table=$('#poetTable');if(!table)return;
    const key=state.id+'|'+state.version;
    if(table.dataset.frame===key)return;
    const prev=shown && shown.id===state.id && shown.version===state.version-1 ? shown : null;
    shown=snapshot(state);
    const consecutive=table.dataset.frame===state.id+'|'+(state.version-1);
    const previousPiles=consecutive ? table.dataset.piles.split(',').map(Number) : [];
    const pile=state.piles.findIndex((n,i)=>n<previousPiles[i]);
    const drawer=state.extra?state.turn:(state.turn+state.seats.length-1)%state.seats.length;
    table.dataset.frame=key;
    table.dataset.piles=state.piles.join(',');
    table.classList.remove('poet-busy');
    table.querySelectorAll(':scope > .poet-stream').forEach(e=>e.remove());
    const mine=state.seats.findIndex(p=>p.id===boardMatch.myId());
    const front=Math.max(0,mine);
    const active=state.seats[state.turn];
    const best=Math.max(...state.seats.map(p=>p.score));
    const winners=state.seats.filter(p=>p.score===best).map(p=>p.name);
    table.innerHTML=state.seats.map((_,i)=>place(state,i,front,mine)).join('')
      +pileRow(state,!state.finish && state.turn===mine);
    $('#poetStatus').textContent=state.finish?winners.join('・')+'の勝ち':active.name+(state.extra?'がもう1枚':'の番');
    $('#poetScores').innerHTML=state.seats.map((p,i)=>`<div class="seat ${!state.finish && i===state.turn?'turn':''}">${seatIcon(state,p,i)}<span class="nm">${esc(p.name)}</span><b>${p.score}枚</b></div>`).join('');
    if(pile<0 || state.last<0 || document.hidden || !consecutive || !prev)return;
    const reduced=S.set.reduce || matchMedia('(prefers-reduced-motion: reduce)').matches;
    const role=cardRole(state.last);
    const semiAll=state.last===SEMIMARU && state.semi==='all';
    sfx.play('CARD_FLIP');
    if(reduced)return;
    const reveal=i=>table.querySelector(`[data-poet-seat="${i}"] .poet-reveal`);
    const live=()=>table.isConnected && table.dataset.frame===key;
    // 札が着くまでは、前の一番上の札と枚数のまま見せる(厚みが先に変わらないように)
    const before=prev.seats;
    const affected=state.seats.map((_,i)=>i===drawer || (role==='bozu' && semiAll && before[i].score>0));
    affected.forEach((on,i)=>{ if(on) showOwn(reveal(i),before[i].top,before[i].score); });
    showPot(table,prev.discard);
    table.classList.add('poet-busy');
    const duration=fly(table,state,pile,drawer,drawer===mine,()=>{
      if(!live())return;
      // 引いた札が一番上に乗る(坊主もいったん乗せる)
      showOwn(reveal(drawer),state.last,before[drawer].score+1);
    });
    let end=duration;
    const cutMs=role==='tono'||!S.set.cutin ? 0 : (semiAll?1400:1000)*SPEED()+(state.extra||(role==='hime'&&prev.discard>0)?900*SPEED()+250:0)+300;
    const startAt=duration+cutMs+120;
    let streamMs=0;
    if(role==='bozu'){
      // 手元の札を、一番上(坊主)から順に場札へ流す。持ち上げた時は表、飛びながら裏返す。
      const groups=state.seats.map((_,i)=>{
        if(!affected[i])return null;
        const cards=pileOf(before[i]).slice().reverse();
        if(i===drawer) cards.unshift(state.last);
        return cards.length?{i,cards}:null;
      }).filter(Boolean);
      const handTotal=groups.reduce((n,g)=>n+g.cards.length,0);
      const moved=state.discard-prev.discard;
      let arrived=0;
      if(groups.length){
        transientAudio.later(()=>{
          if(!live())return;
          const longestNow=Math.max(...groups.map(g=>g.cards.length));
          const snd=cardSound(handTotal,(longestNow-1)*Math.min(95,1300/longestNow)+600,live); snd.start();
          for(const g of groups){
            const el=reveal(g.i);
            streamMs=Math.max(streamMs,stream(table,g.cards,()=>ownTop(el),()=>potTop(table),{faceUp:true,live,
              onLeave:(k)=>{ if(!live())return; snd.each(); const rest=g.cards.length-1-k; showOwn(el,g.cards[k+1]??-1,rest); },
              onArrive:()=>{ if(!live())return; arrived++; showPot(table,prev.discard+Math.round(moved*arrived/handTotal)); }}));
          }
        },startAt);
        const longest=Math.max(...groups.map(g=>g.cards.length));
        streamMs=(longest-1)*Math.min(95,1300/longest)+600;
      }
    }else if(role==='hime' && prev.discard>0){
      // 場札を、一番上から順に姫の下へ滑り込ませる(裏のまま)
      const cards=(prev.field || Array(prev.discard).fill(-1)).slice().reverse();
      const el=reveal(drawer);
      const seatEl=el.closest('.poet-place');
      transientAudio.later(()=>{
        if(!live())return;
        const snd=cardSound(cards.length,(cards.length-1)*Math.min(95,1300/cards.length)+600,live); snd.start();
        seatEl.classList.add('taking');
        let got=0;
        stream(table,cards,()=>potTop(table),()=>el,{faceUp:false,under:true,live,
          onLeave:(k)=>{ if(!live())return; snd.each(); showPot(table,cards.length-1-k); },
          onArrive:()=>{ if(!live())return; got++; showOwn(el,state.last,before[drawer].score+1+got); }});
      },startAt);
      streamMs=(cards.length-1)*Math.min(95,1300/cards.length)+600;
    }
    end=streamMs?startAt+streamMs:duration+cutMs;
    busyUntil=performance.now()+end;
    setTimeout(()=>{ if(!live())return; table.classList.remove('poet-busy');
      reveal(drawer)?.closest('.poet-place')?.classList.remove('taking');
      // 最後は状態どおりの見た目にそろえる
      state.seats.forEach((p,i)=>{ if(affected[i]) showOwn(reveal(i),p.pile?.length?p.pile[p.pile.length-1]:(p.score>0?p.lastCard:-1),p.score); });
      showPot(table,state.discard);
    },end+60);
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
      // 姫の後: 場札があれば「+〇枚」、場札が無くてもう1枚引けるなら「もう一枚引く」(どちらも姫と同じ筆文字)
      if(role==='hime' && prev.discard>0) cut({text:'+'+prev.discard+'枚',font:'fude',tone:'wa-cut sakura',ms:900});
      if(state.extra) cut({text:'もう一枚引く',font:'fude',tone:'wa-cut sakura',ms:900});
    },duration);
  }
  function button(d) {
    const state=boardMatch.state;
    if(d.extraPoetPick!==undefined) return boardMatch.send('draw',{cell:+d.extraPoetPick,turn:state.version});
  }
  const stop=()=>{clearTimeout(timer);stacks=null;shown=null;};
  boardMatch.register('bozu',{initial,apply,changed,html,draw,button,stop});
  return {setup,setupHtml,setOption,start:()=>{const rules={hime:preferences.himeBonus,semi:preferences.semi};
    return boardMatch.start('bozu',online,online?rules:{...preferences,...rules});},face};
})();
