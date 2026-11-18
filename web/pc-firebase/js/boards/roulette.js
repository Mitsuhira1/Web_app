/* カジノ式ルーレット。賭け枠・配当・出目はコアと同じ定義を参照する。 */
window.rouletteReady = import('../../core/games/roulette.mjs').then(({ ROULETTE_SPOTS, pocketColor }) => {
  const C = { red: '#a92930', black: '#272326', green: '#237954' };
  const LABEL = { 'out:even': '偶数', 'out:odd': '奇数', 'out:red': '赤', 'out:black': '黒' };
  const DENOMS = ['#e4dac7', '#a83d41', '#378257', '#49435d', '#b6873b'];
  const fmt = n => Number(n).toLocaleString('ja-JP');
  const signed = n => n > 0 ? '+' + fmt(n) : fmt(n);
  const dot = seat => SEAT_COLORS[seat % SEAT_COLORS.length];
  const location = n => [1 + Math.floor((n - 1) / 3), 2 - ((n - 1) % 3)];
  const layouts = ['euro', 'amer'].map(type => ROULETTE_SPOTS.filter(s => !s.amerOnly || type === 'amer').map(s => ({
    ...s, ...coordinates(s, type === 'amer'),
  })));
  let ui;
  let wheel;

  function coordinates(s, american) {
    const [n, m] = s.nums.map(Number);
    if (s.kind === 'straight' && !n) {
      const split = american ? 1.5 : 3;
      return { x: 0, y: s.amerOnly ? split : 0, w: 1, h: split };
    }
    const [col, row] = location(n);
    switch (s.kind) {
      case 'straight': return { x: col, y: row, w: 1, h: 1 };
      case 'split': return m === n + 3
        ? { x: col + 1, y: row + .5, pin: 'split' }
        : { x: col + .5, y: row, pin: 'split' };
      case 'corner': return { x: col + 1, y: row, pin: 'corner' };
      case 'street': return { x: col + .5, y: 3.29, pin: 'street' };
      case 'line': return { x: col + 1, y: 3.29, pin: 'line' };
      case 'column': return { x: 13, y: row, w: 1, h: 1 };
      case 'dozen': return { x: col, y: 3.6, w: 4, h: 1 };
      default: return { x: 1 + (s.idx - 146) * 2, y: 4.6, w: 2, h: 1 };
    }
  }

  function wheelGraphic(b) {
    const angle = 360 / b.wheelOrder.length;
    const point = (r, a) => [r * Math.sin(a * Math.PI / 180), -r * Math.cos(a * Math.PI / 180)].map(x => x.toFixed(3)).join(' ');
    const pocket = (r, inner, a) => {
      const left = a - angle / 2, right = a + angle / 2;
      return `M ${point(r, left)} A ${r} ${r} 0 0 1 ${point(r, right)} L ${point(inner, right)} A ${inner} ${inner} 0 0 0 ${point(inner, left)} Z`;
    };
    const pockets = b.wheelOrder.map((n, i) => {
      const a = angle * i, hit = i === b.lastRound?.pocketIdx;
      return `<g data-roulette-pocket="${n}" data-pocket-index="${i}"${hit ? ' class="rq-hit-pocket"' : ''}>
        <path class="rq-pocket" d="${pocket(150, 104, a)}" fill="${C[pocketColor(n)]}"/>
        <path d="${pocket(150, 129, a)}" fill="#000" opacity=".24"/>
        <text transform="rotate(${a})" x="0" y="-139" dominant-baseline="central">${n}</text></g>`;
    }).join('');
    const diamonds = Array.from({ length: 8 }, (_, i) => `<rect x="-3" y="-169" width="6" height="6" rx="1" transform="rotate(${i * 45}) rotate(45 0 -166)"/>`).join('');
    return `<svg class="rq-wheel" viewBox="-204 -204 408 408" aria-hidden="true">
      <defs>
        <radialGradient id="rqWood" cx=".42" cy=".31" r=".7"><stop stop-color="#96704b"/><stop offset=".65" stop-color="#66331c"/><stop offset=".9" stop-color="#4d2619"/><stop offset="1" stop-color="#22110e"/></radialGradient>
        <radialGradient id="rqBowl" cx=".42" cy=".38" r=".63"><stop stop-color="#694630"/><stop offset=".74" stop-color="#382218"/><stop offset=".9" stop-color="#1e1413"/><stop offset="1" stop-color="#6c4e33"/></radialGradient>
        <linearGradient id="rqGold" x2=".75" y2="1"><stop stop-color="#f7d897"/><stop offset=".3" stop-color="#986238"/><stop offset=".58" stop-color="#e1b570"/><stop offset="1" stop-color="#88613e"/></linearGradient>
        <radialGradient id="rqBall" cx=".33" cy=".26"><stop stop-color="#fffdf1"/><stop offset=".48" stop-color="#fff4d5"/><stop offset="1" stop-color="#a68f67"/></radialGradient>
      </defs>
      <circle r="199" fill="url(#rqWood)" stroke="#291914" stroke-width="4"/>
      <circle r="192" fill="none" stroke="#c4844e" stroke-width="2"/>
      <circle r="184" fill="url(#rqBowl)" stroke="url(#rqGold)" stroke-width="5"/>
      <circle r="176" fill="none" stroke="#dcc090" stroke-opacity=".29"/>
      <g fill="url(#rqGold)" stroke="#bd8b59" stroke-width=".55">${diamonds}</g>
      <circle r="156" fill="#1d1512" stroke="url(#rqGold)" stroke-width="2"/>
      <g class="rq-rotor" style="transform:rotate(${wheel.angle}deg)">
        <circle r="152" fill="url(#rqGold)"/>${pockets}
        <circle r="103" fill="url(#rqBowl)" stroke="url(#rqGold)" stroke-width="4"/>
        <circle r="88" fill="none" stroke="#d7a562" stroke-opacity=".35" stroke-width="1.5"/>
        <circle r="69" fill="none" stroke="#d7a562" stroke-opacity=".2" stroke-width="1.5"/>
        <path d="M-54 0H54M0-54V54" stroke="url(#rqGold)" stroke-width="8" stroke-linecap="round"/>
        <circle r="26" fill="url(#rqGold)" stroke="#664026" stroke-width="2"/>
        <circle r="16" fill="url(#rqGold)" stroke="#ffe0a5" stroke-width="1.2"/>
      </g>
      <g class="rq-orbit"${b.lastRound ? '' : ' hidden'}>
        <g class="rq-ball"><circle cy="-119" r="6.4" fill="#0007"/><circle cy="-121" r="6" fill="url(#rqBall)" stroke="#f7e3b8" stroke-width=".6"/></g>
      </g>
    </svg>`;
  }

  function renderTable(b, seats, can, chipIndex, spinning) {
    const positions = layouts[Number(b.wheelType === 'amer')];
    const bets = spinning ? b.lastRound.bets : b.bets;
    return `<section class="rq-felt" aria-label="ベッティングテーブル">
      <div class="rq-tablehead"><b>ベッティングテーブル</b><span>${ui.remove ? '撤去する賭け枠を選択' : '数字・境界・交点にベット'}</span></div>
      <div class="rq-table${ui.remove ? ' removing' : ''}">
        ${positions.map(s => {
          const stakes = seats.filter(p => bets[p.seat]?.[s.id]).map(p => [p, bets[p.seat][s.id]]);
          const label = `${s.label}・配当 ${s.mult}倍${stakes.map(([p, amount]) => `・${p.name} ${fmt(amount)}枚`).join('')}`;
          const cls = s.kind === 'straight' ? pocketColor(s.nums[0]) : s.id === 'out:red' ? 'red' : s.id === 'out:black' ? 'black' : '';
          const displayed = !spinning && b.lastRound && s.kind === 'straight' && s.nums[0] === b.lastRound.pocketStr;
          const move = (ui.remove ? 1000 : chipIndex * 200) + s.idx;
          const available = can(move);
          const removable = can(1000 + s.idx);
          const visible = s.kind === 'column' ? '2:1' : LABEL[s.id] || s.label;
          return `<button class="rq-spot ${s.pin ? `rq-pin ${s.pin}` : `rq-cell ${s.kind}`} ${cls}${displayed ? ' is-hit' : ''}${stakes.length ? ' has-stakes' : ''}" type="button"
            data-roulette-spot="${s.idx}" data-m="${move}" data-remove="${removable}"
            aria-disabled="${!available}" ${available ? '' : 'tabindex="-1"'} aria-label="${esc(label)}" title="${esc(label)}"
            style="--x:${s.x};--y:${s.y};--w:${s.w || 0};--h:${s.h || 0}">
            ${s.pin ? '<span class="rq-pinmark" aria-hidden="true"></span>' : `<span class="rq-spotlabel">${visible}</span>`}
            ${stakes.length ? `<span class="rq-stakes" aria-hidden="true">${stakes.map(([p, amt]) => `<span style="--chip:${p.color}">${fmt(amt)}</span>`).join('')}</span>` : ''}
          </button>`;
        }).join('')}
      </div>
      <div class="rq-legend"><span><i class="split"></i>境界 18倍</span><span><i class="corner"></i>交点 9倍</span><span><i class="street"></i>3数字 12倍</span><span><i class="line"></i>6数字 6倍</span></div>
    </section>`;
  }

  function resultPanel(round, seats) {
    if (!round) return '';
    const rows = seats.map(({name, color, seat}) => `<tr><th scope="row"><i style="--seat:${color}"></i>${esc(name)}</th>
      <td>${fmt(round.wagered[seat])}</td><td>${fmt(round.payouts[seat])}</td>
      <td>${round.laPartageReturns[seat] ? fmt(round.laPartageReturns[seat]) : '—'}</td>
      <td class="${round.nets[seat] > 0 ? 'rq-profit' : ''}">${signed(round.nets[seat])}</td></tr>`).join('');
    return `<section class="rq-result"><h3>第${round.roundNo}ラウンドの精算 <span>単位：枚</span></h3>
      <table><thead><tr><th scope="col">プレイヤー</th><th scope="col">賭け</th><th scope="col">受取</th><th scope="col" title="受取に含まれるラ・パルタージュの返還">うち返還</th><th scope="col">収支</th></tr></thead><tbody>${rows}</tbody></table></section>`;
  }

  function updateWheel(b, A, match) {
    const round = b.lastRound?.roundNo || 0;
    const landing = b.lastRound ? -b.lastRound.pocketIdx * 360 / b.wheelOrder.length : 0;
    const now = performance.now();
    if (!wheel || wheel.match !== match || round < wheel.round) {
      wheel = { match, round, angle: landing, from: landing, started: 0, duration: 0 };
    } else if (round > wheel.round) {
      const from = wheel.angle;
      const angle = from + 3 * 360 + ((landing - from) % 360 + 360) % 360;
      wheel = { match, round, angle, from, started: now, duration: A.reduce ? 0 : 2450 * A.speed };
      const current = wheel;
      A.anim(2450);
      const root = $('#boardwrap');
      root.scrollTop = 0;
      const landed = transientAudio.guard(() => sfx.play('MARBLE', {volume: .54}));
      if (current.duration) {
        setTimeout(() => {
          if (wheel !== current || token !== match || S.screen !== 'play') return;
          landed();
          A.redraw();
        }, current.duration);
      } else {
        landed();
      }
    } else if (A.reduce) {
      wheel.duration = 0;
    }
    return now - wheel.started < wheel.duration;
  }

  function animateWheel(root) {
    const elapsed = Math.max(0, performance.now() - wheel.started);
    const easing = 'cubic-bezier(.18,.65,.25,1)';
    const rotation = (from, to) => [
      {transform: `rotate(${from}deg)`}, {transform: `rotate(${to}deg)`},
    ];
    const duration = wheel.duration;
    const tracks = [
      ['.rq-rotor', rotation(wheel.from, wheel.angle)],
      ['.rq-orbit', rotation(0, -1440)],
      ['.rq-ball', [
        {transform: 'translateY(-47px)'}, {transform: 'translateY(-47px)', offset: .66},
        {transform: 'translateY(-17px)', offset: .87}, {transform: 'translateY(4px)', offset: .96},
        {transform: 'translateY(0)'},
      ]],
    ];
    for (const [selector, frames] of tracks) {
      root.querySelector(selector).animate(frames, {duration, easing, fill: 'both'}).currentTime = elapsed;
    }
  }

  function controls(b, A, can, chipIndex, spinning) {
    const confirm = b.confirmed.every((checked, seat) => checked || seat === b.turn || (!b.bankrolls[seat] && b.maxRounds > 0));
    const list = [
      ['戻す', 2000, b.canUndo],
      ['クリア', 2001, b.canClear],
      ['前回と同じ', 2002, b.canRebet],
      ['2倍', 2003, b.canDouble],
      ...(b.maxRounds === 0 ? [['補充', 2005, b.canRebuy]] : []),
      [confirm ? '確定・スピン' : 'ベット確定', 2004, true],
    ];
    A.acts(list.map(([label, move, enabled]) => ({label, move, enabled: enabled && can(move)})));
    const dock = $('#acts');
    const actionRow = document.createElement('div');
    actionRow.className = 'rq-actions';
    for (const [i, button] of [...dock.children].entries()) {
      const [, move, enabled] = list[i];
      button.dataset.rouletteAction = move;
      button.setAttribute('aria-disabled', String(!enabled || !can(move)));
      actionRow.append(button);
    }
    dock.append(actionRow);
    const hasRemovable = b.tableTotals[b.turn] > 0 && can(2001);
    dock.insertAdjacentHTML('afterbegin', `<div class="rq-tools"><div class="rq-wallet"><span>手元</span><b>${spinning ? '—' : fmt(b.chips[b.turn] ?? 0)}</b> 枚</div>
      <div class="rq-denoms" role="group" aria-label="チップの額面">
        ${b.spotChips.map((n, i) => `<button type="button" class="rq-denom" data-roulette-chip="${i}" aria-label="${n}枚のチップ"
          aria-pressed="${!ui.remove && chipIndex === i}" ${can(i * 200) ? '' : 'disabled'} style="--chip:${DENOMS[i]}">${n}</button>`).join('')}
      </div>
      <button type="button" class="btn rq-remove" data-roulette-remove aria-pressed="${ui.remove}" ${hasRemovable ? '' : 'disabled'}>撤去</button></div>`);
    dock.querySelectorAll('[data-roulette-chip]').forEach(button => {
      button.onclick = () => { ui.chip = Number(button.dataset.rouletteChip); ui.remove = false; A.redraw(); };
    });
    dock.querySelector('[data-roulette-remove]').onclick = () => { ui.remove = !ui.remove; A.redraw(); };
  }

  window.RENDER.roulette = (b, A) => {
    const match = token;
    if (ui?.match !== match) ui = {match, turn: b.turn, chip: 2, remove: false};
    if (ui.turn !== b.turn) { ui.turn = b.turn; ui.remove = false; }
    const ready = A.view.human && !A.view.outcome && !busy && !A.remoteTurn;
    const legal = new Set(A.view.legal);
    const spinning = updateWheel(b, A, match);
    const can = m => ready && !spinning && legal.has(m);
    if (!b.tableTotals[b.turn]) ui.remove = false;
    let chipIndex = ui.chip;
    while (chipIndex > 0 && b.spotChips[chipIndex] > b.chips[b.turn]) chipIndex--;
    const root = $('#boardwrap');
    const focused = document.activeElement;
    const savedFocus = ['data-roulette-chip', 'data-roulette-spot', 'data-roulette-remove', 'data-roulette-action']
      .find(key => focused?.hasAttribute(key));
    const seats = Array.from({ length: b.n }, (_, seat) => ({
      seat, name: A.name(seat), color: dot(seat),
    }));
    const entries = spinning ? b.history.slice(0, -1) : b.history;
    const last = b.lastRound;
    const roundNo = spinning ? last.roundNo : b.roundNo;
    const history = entries.length
      ? entries.map(r => `<span class="rq-pocket-tag ${r.color}" title="第${r.roundNo}ラウンド" aria-label="第${r.roundNo}ラウンド ${r.pocketStr}">${r.pocketStr}</span>`).join('')
      : '<span class="rq-history-empty">出目がここに並びます</span>';
    A.round(`第${roundNo}ラウンド${b.maxRounds ? ` / ${b.maxRounds}` : '・エンドレス'}`);
    A.strip(seats.map(({seat, name, color}) => {
      const active = !spinning && seat === b.turn;
      const chips = spinning ? last.bankrollsAfter[seat] - last.payouts[seat] : b.chips[seat];
      const stake = spinning ? last.wagered[seat] : b.tableTotals[seat];
      const status = spinning || b.confirmed[seat] ? '確定済み' : active ? 'ベット中' : '待機';
      return `<div class="pl rq-player ${active ? 'turn' : ''}"><i class="dot" style="background:${color}"></i>
        <span class="who"><span class="nm">${esc(name)}</span><span class="nt">${status}</span></span>
        <span class="rq-player-money"><b class="num">${fmt(chips + stake)}</b><small>手元 ${fmt(chips)} / 賭け ${fmt(stake)}</small></span></div>`;
    }).join(''));
    A.board(`<div class="rq-layout${spinning ? ' is-spinning' : ''}" data-ready="${ready}">
      <section class="rq-wheel-panel" aria-label="${b.wheelType === 'amer' ? 'アメリカン' : 'ヨーロピアン'}ルーレット">
        ${wheelGraphic(b)}
        <div class="rq-readout"><p class="rq-wheel-type">${b.wheelType === 'amer' ? 'アメリカン · 38穴' : 'ヨーロピアン · 37穴'}</p>
          <p class="rq-current" role="status">${spinning ? 'スピン中…' : last ? `<span class="rq-pocket-tag ${last.color}">${last.pocketStr}</span>第${last.roundNo}ラウンドの出目` : 'ベット受付中'}</p>
          <div class="rq-history" aria-label="出目履歴">${history}</div></div>
      </section>
      <div class="rq-bets">${renderTable(b, seats, can, chipIndex, spinning)}
        ${!spinning ? resultPanel(last, seats) : ''}</div>
      </div>`, (data, button) => { if (data.rouletteSpot != null && button.getAttribute('aria-disabled') === 'false') A.play(Number(data.m)); });
    root.oncontextmenu = event => {
      const spot = event.target.closest('[data-roulette-spot]');
      if (!spot) return;
      event.preventDefault();
      const move = 1000 + Number(spot.dataset.rouletteSpot);
      if (can(move)) A.play(move);
    };
    controls(b, A, can, chipIndex, spinning);
    if (spinning) animateWheel(root);
    if (savedFocus) {
      const button = document.querySelector(`[${savedFocus}="${focused.getAttribute(savedFocus)}"]`);
      if (button && !button.disabled && button.getAttribute('aria-disabled') !== 'true') button.focus({preventScroll: true});
    }
  };
});
