/* カジノ式ルーレット。賭け枠・配当・出目はコアと同じ定義を参照する。 */
window.rouletteReady = Promise.all([
  import('../../core/games/roulette.mjs'),
  import('./roulette-motion.mjs'),
]).then(([{ ROULETTE_SPOTS, pocketColor }, { makeRouletteSpin, restingPose }]) => {
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
    const pitch = 360 / b.wheelOrder.length;
    const point = (r, a) => [r * Math.sin(a * Math.PI / 180), -r * Math.cos(a * Math.PI / 180)].map(x => x.toFixed(2)).join(' ');
    function sector(outer, inner, left, right) {
      return `M${point(outer, left)}A${outer} ${outer} 0 0 1 ${point(outer, right)}L${point(inner, right)}A${inner} ${inner} 0 0 0 ${point(inner, left)}Z`;
    }
    const edge = pitch / 2;
    const pockets = b.wheelOrder.map((n, i) => {
      const angle = i * pitch;
      const selected = i === b.lastRound?.pocketIdx;
      return `<g transform="rotate(${angle})" data-roulette-pocket="${n}" data-pocket-index="${i}"${selected ? ' class="rq-hit-pocket"' : ''}>
        <path class="rq-pocket" fill="${C[pocketColor(n)]}" d="${sector(151, 104, -edge, edge)}"/>
        <path d="${sector(150, 132, .4-edge, edge-.4)}" fill="url(#rqEnamel)"/>
        <path d="${sector(131, 106, .5-edge, edge-.5)}" fill="#241b1a" opacity=".46"/>
        <path d="${sector(127, 109, 1-edge, edge-1)}" fill="${C[pocketColor(n)]}"/>
        <path d="${sector(128, 106, .8-edge, edge-.8)}" fill="url(#rqSlotDepth)"/>
        <path d="M${point(105, edge-1)}L${point(130, edge-1)}" stroke="#2c1e16" stroke-width="2.2"/>
        <path d="M${point(105, edge)}L${point(131, edge)}" stroke="#ad926d" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M${point(106, edge+.15)}L${point(130, edge+.15)}" stroke="#fff2cd" stroke-width=".65" stroke-linecap="round"/>
        <text y="-141.5" dominant-baseline="central">${n}</text></g>`;
    }).join('');
    // 止まったポケットの光るハイライト(外側は少しぼやけ、内側は輪郭がはっきり。点滅は CSS)。
    // Edge で固まらないように、ぼかしはフィルターを使わず、太さの違う半透明の線を重ねて作る。
    const hitIdx = b.lastRound?.pocketIdx;
    const glow = hitIdx == null ? '' : (() => {
      const d = sector(151, 104, -edge, edge);
      const halo = [[26, .06], [20, .09], [15, .13], [10.5, .2], [7, .3], [4.5, .42]].map(([w, o]) =>
        `<path d="${d}" fill="none" stroke="#ffcf3a" stroke-opacity="${o}" stroke-width="${w}" stroke-linejoin="round"/>`).join('');
      // 描き直しても点滅が最初からにならないよう、止まった時からの経過で始める
      const blink = wheel?.stoppedAt ? ` style="animation-delay:${-Math.round(performance.now() - wheel.stoppedAt)}ms"` : '';
      return `<g class="rq-hit-glow" transform="rotate(${hitIdx * pitch})"${blink}>${halo}
        <path d="${d}" fill="#ffe27a" fill-opacity=".28" stroke="#fff6c8" stroke-width="2.6" stroke-linejoin="round"/>
        <path d="${d}" fill="none" stroke="#b07a12" stroke-width=".7" stroke-linejoin="round"/></g>`;
    })();
    const diamonds = Array.from({length: 8}, (_, i) => `<use href="#rqDiamond" transform="rotate(${45*i}) translate(0 -165) rotate(${i % 2 ? 90 : 0})"/>`).join('');
    const veneer = Array.from({length: 12}, (_, i) => `<use href="#rqFlame" transform="rotate(${i*30}) scale(${i % 2 ? -1 : 1} 1)"/>`).join('');
    const spokes = [28,118,208,298].map(a => `<use href="#rqHandle" transform="rotate(${a})"/>`).join('');
    return `<svg class="rq-wheel" viewBox="-204 -204 408 408" aria-hidden="true">
      <defs>
        <radialGradient id="rqWood"><stop offset=".61" stop-color="#55261a"/><stop offset=".8" stop-color="#865038"/><stop offset=".91" stop-color="#643420"/><stop offset=".95" stop-color="#a96a41"/><stop offset=".98" stop-color="#82462d"/><stop offset="1" stop-color="#371c16"/></radialGradient>
        <radialGradient id="rqTrack"><stop offset=".76" stop-color="#451f19"/><stop offset=".825" stop-color="#8b4d30"/><stop offset=".895" stop-color="#a86a42"/><stop offset=".938" stop-color="#75412d"/><stop offset=".965" stop-color="#513022"/><stop offset="1" stop-color="#2e211c"/></radialGradient>
        <radialGradient id="rqCone" cx=".43" cy=".34" r=".72"><stop stop-color="#dda170"/><stop offset=".34" stop-color="#b17045"/><stop offset=".72" stop-color="#995b36"/><stop offset=".96" stop-color="#693620"/><stop offset="1" stop-color="#59311f"/></radialGradient>
        <linearGradient id="rqBrass" x1=".12" y1=".08" x2=".88" y2=".9"><stop stop-color="#fff0bd"/><stop offset=".22" stop-color="#d3a364"/><stop offset=".48" stop-color="#94643c"/><stop offset=".69" stop-color="#edc98c"/><stop offset=".82" stop-color="#ab7846"/><stop offset="1" stop-color="#65442d"/></linearGradient>
        <linearGradient id="rqSpun" x2="1" y2=".18"><stop stop-color="#71482b"/><stop offset=".19" stop-color="#c69a5d"/><stop offset=".43" stop-color="#ffdf99"/><stop offset=".58" stop-color="#e8c085"/><stop offset=".72" stop-color="#ae7c41"/><stop offset="1" stop-color="#744c2c"/></linearGradient>
        <radialGradient id="rqKnob" cx=".34" cy=".23" r=".75"><stop stop-color="#fff3c8"/><stop offset=".34" stop-color="#efc987"/><stop offset=".68" stop-color="#c39658"/><stop offset=".85" stop-color="#95663b"/><stop offset="1" stop-color="#6d482f"/></radialGradient>
        <linearGradient id="rqEnamel" x2="0" y2="1"><stop stop-color="#ffefcd" stop-opacity=".21"/><stop offset=".45" stop-color="#ffefcd" stop-opacity=".035"/><stop offset="1" stop-color="#150d13" stop-opacity=".28"/></linearGradient>
        <linearGradient id="rqSlotDepth" x1=".5" y1="0" x2=".6" y2="1"><stop stop-color="#150e11" stop-opacity=".54"/><stop offset=".35" stop-color="#150e11" stop-opacity=".05"/><stop offset=".86" stop-color="#fff2d4" stop-opacity=".08"/><stop offset="1" stop-color="#29190e" stop-opacity=".38"/></linearGradient>
        <radialGradient id="rqPorcelain" cx=".29" cy=".22" r=".86"><stop stop-color="#fffefd"/><stop offset=".42" stop-color="#fff8df"/><stop offset=".76" stop-color="#e5d5b7"/><stop offset=".96" stop-color="#b49878"/><stop offset="1" stop-color="#8a735e"/></radialGradient>
        <g id="rqFlame" fill="none" stroke-linecap="round">
          <path d="M1-101Q8-89 10-72T4-30M17-100Q25-84 22-75T15-58Q11-46 12-31" stroke="#542c1f" stroke-width="1.2" opacity=".20"/>
          <path d="M4-98Q14-85 12-72T6-40M19-96Q26-84 23-75T18-63" stroke="#f2c495" stroke-width=".8" opacity=".37"/>
          <path d="M13-98Q19-85 16-73T10-55M23-93Q27-88 26-83" stroke="#643824" stroke-width=".6" opacity=".35"/>
        </g>
        <g id="rqDiamond">
          <path d="M-7 1.5L0-2.5 7 1.5 0 5.2Z" fill="#342219" opacity=".7"/>
          <path d="M-7 0L0-3.6 7 0 0 3.6Z" fill="#cbb99c" stroke="#654e3f" stroke-width=".65"/>
          <path d="M-7 0L0-3.6 1-.4Z" fill="#f2e5c8"/><path d="M1-.4L7 0 0 3.6Z" fill="#8e7f6a"/>
        </g>
        <g id="rqHandle" stroke="#715033" stroke-width=".65">
          <path d="M-3-12L-2.2-43Q-2-48-4.3-51Q-6.8-55-4.5-58Q0-61 4.5-58Q6.8-55 4.3-51Q2-48 2.2-43L3-12Z" fill="url(#rqSpun)"/>
          <rect x="-3.5" y="-44" width="7" height="3.3" rx="1" fill="url(#rqBrass)"/>
          <ellipse cy="-56.4" rx="5.8" ry="5.3" fill="url(#rqKnob)"/>
        </g>
      </defs>
      <circle cy="1.5" r="199" fill="#3e251d" stroke="#302018" stroke-width="2"/>
      <circle r="198" fill="url(#rqWood)" stroke="#a16843" stroke-width="1.4"/>
      <g fill="none">
        <circle r="195.1" stroke="#e6b381" stroke-width="1.15"/><circle r="192.7" stroke="#58321f" stroke-width="1.25"/>
        <circle r="190.8" stroke="#ddab7a" stroke-width=".65"/><circle r="186.5" stroke="#301d17" stroke-width="2"/>
      </g>
      <circle r="185" fill="url(#rqTrack)" stroke="url(#rqBrass)" stroke-width="2.2"/>
      <circle r="181.8" fill="none" stroke="#e5bb86" stroke-opacity=".47" stroke-width=".9"/>
      <g fill="none" stroke-linecap="round" opacity=".40">
        <path d="M-186 42A191 191 0 0 1-31-188M-162-91A188 188 0 0 1-66-175" stroke="#ffe2ad" stroke-width="1.4"/>
        <path d="M152 114A190 190 0 0 1 38 186" stroke="#f4c79a" stroke-width=".8"/>
        <circle r="171.5" stroke="#673624" stroke-width=".8"/><circle r="169.3" stroke="#cc8c5d" stroke-width=".65"/>
      </g>
      ${diamonds}
      <circle r="155" fill="#251a18" stroke="url(#rqBrass)" stroke-width="2.1"/>
      <g class="rq-rotor" style="transform:rotate(${wheel.angle}deg)">
        <circle r="152" fill="#aa8b68"/>${pockets}${glow}
        <circle r="130.8" fill="none" stroke="#ebd6ac" stroke-width="1.15"/>
        <circle r="104.5" fill="url(#rqCone)" stroke="url(#rqBrass)" stroke-width="2.8"/>
        ${veneer}
        <g fill="none"><circle r="101.1" stroke="#713c27" stroke-width=".9"/><circle r="98.9" stroke="#efc48c" stroke-width=".6"/>
          <circle r="76.5" stroke="#b98150" stroke-width="1"/><circle r="74.9" stroke="#713d2a" stroke-opacity=".32" stroke-width=".8"/>
          <circle r="34" stroke="#733b27" stroke-width="1"/><circle r="31.8" stroke="#edc89d" stroke-width="1"/></g>
        <circle cy="2.5" r="28" fill="#47281c" opacity=".60"/>
        <circle r="27" fill="url(#rqBrass)" stroke="#70482e" stroke-width="1.3"/>
        <circle r="22.4" fill="url(#rqKnob)" stroke="#cfaa77"/>
        ${spokes}
        <circle cy="1.5" r="16" fill="#785031"/><circle r="15.2" fill="url(#rqBrass)" stroke="#664228"/>
        <circle r="11.6" fill="url(#rqKnob)" stroke="#b68a50" stroke-width="1.1"/>
      </g>
      <g class="rq-orbit">
        <g class="rq-ball-shadow"><ellipse cx="1.1" cy="-119.4" rx="6.5" ry="5.9" fill="#1e1210" opacity=".48"/><ellipse cx="1" cy="-120" rx="5.3" ry="4.8" fill="#281c16" opacity=".45"/></g>
        <g class="rq-ball"><g class="rq-ball-face">
          <circle cy="-121" r="6.1" fill="url(#rqPorcelain)" stroke="#8b7961" stroke-width=".65"/>
          <ellipse cx="-1.8" cy="-123.4" rx="1.75" ry=".95" transform="rotate(-30 -1.8 -123.4)" fill="#fff" opacity=".85"/>
        </g></g>
      </g>
    </svg>`;
  }

  // 賭けたチップの印: 大きさは桁によらず同じ丸。桁が多い時は字だけを小さくする
  function chipMark(color, amount) {
    // 1,000 以上は「1k」「1.5k」(正確な枚数は枠の説明に出ている)
    const text = amount >= 1000 ? `${Math.floor(amount / 100) / 10}k` : fmt(amount), k = [1, 1, 1, .8, .66, .56, .5][Math.min(6, text.length)];
    return `<span style="--chip:${color};--k:${k}">${text}</span>`;
  }

  // 回し終わった後の、自分のチップの増減(賭けていない回は出さない)
  function netBadge(b, A) {
    const seat = Number.isInteger(A.view?.mine) ? A.view.mine : A.mySeat, r = b.lastRound; // 観戦中(mine<0)は出さない
    if (!r || seat == null || seat < 0 || !r.wagered?.[seat]) return '';
    const net = r.nets[seat];
    return `<div class="rq-net ${net > 0 ? 'up' : net < 0 ? 'down' : 'even'}" role="status"><b>${net > 0 ? '+' : net < 0 ? '−' : '±'}${fmt(Math.abs(net))}</b><small>枚</small></div>`;
  }

  function renderTable(b, seats, can, chipIndex, spinning) {
    const positions = layouts[Number(b.wheelType === 'amer')];
    const bets = spinning ? b.lastRound.bets : b.bets;
    return `<section class="rq-felt" aria-label="ベッティングテーブル">
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
            ${stakes.length ? `<span class="rq-stakes" aria-hidden="true">${stakes.map(([p, amt]) => chipMark(p.color, amt)).join('')}</span>` : ''}
          </button>`;
        }).join('')}
      </div>
      <div class="rq-legend"><span><i class="split"></i>境界 18倍</span><span><i class="corner"></i>交点 9倍</span><span><i class="street"></i>3数字 12倍</span><span><i class="line"></i>6数字 6倍</span></div>
    </section>`;
  }

  function resultPanel(round, seats, history) {
    if (!round) return '';
    const rows = seats.map(({name, color, seat}) => `<tr><th scope="row"><i style="--seat:${color}"></i>${esc(name)}</th>
      <td>${fmt(round.wagered[seat])}</td><td>${fmt(round.payouts[seat])}</td>
      <td>${round.laPartageReturns[seat] ? fmt(round.laPartageReturns[seat]) : '—'}</td>
      <td class="${round.nets[seat] > 0 ? 'rq-profit' : ''}">${signed(round.nets[seat])}</td></tr>`).join('');
    return `<section class="rq-result"><h3><span class="rq-pocket-tag ${round.color}">${round.pocketStr}</span>第${round.roundNo}ラウンドの精算 <span>単位：枚</span></h3>
      <table><thead><tr><th scope="col">プレイヤー</th><th scope="col">賭け</th><th scope="col">受取</th><th scope="col" title="受取に含まれるラ・パルタージュの返還">うち返還</th><th scope="col">収支</th></tr></thead><tbody>${rows}</tbody></table><div class="rq-history" aria-label="出目履歴">${history}</div></section>`;
  }

  // 浮かせた回転盤を、フェードで閉じる(閉じている間に描き直しても、続きから消えるように leaveUntil で覚える)
  const LEAVE_MS = 340, SETTLE_MS = 2400, PRE_MS = 500; // PRE_MS: 回転盤が浮き出てから回し始めるまで
  function closeWheel() {
    if (!wheel) return;
    wheel.settleUntil = 0;
    clearTimeout(wheel.settleTimer);
    const layout = $('#boardwrap .rq-layout');
    if (!layout || !layout.classList.contains('is-settling')) return;
    const current = wheel;
    // 押して早く閉じた時は、CPU も消え終わったらすぐ打てるようにする
    if (current.A) { current.A.animClear(); current.A.anim(LEAVE_MS / current.A.speed); }
    current.leaveUntil = performance.now() + LEAVE_MS;
    layout.classList.replace('is-settling', 'is-leaving');
    current.leaveTimer = setTimeout(() => {
      if (wheel !== current) return;
      current.leaveUntil = 0;
      $('#boardwrap .rq-layout')?.classList.remove('is-leaving');
    }, LEAVE_MS);
  }

  function stopSpin() {
    if (!wheel) return;
    cancelAnimationFrame(wheel.frame);
    clearTimeout(wheel.timer);
    clearTimeout(wheel.soundTimer);
    clearTimeout(wheel.settleTimer);
    clearTimeout(wheel.leaveTimer);
    wheel.settleUntil = 0;
    wheel.leaveUntil = 0;
    wheel.cancelSound?.();
    wheel.duration = 0;
  }

  function updateWheel(b, A, match) {
    const round = b.lastRound?.roundNo || 0;
    const rest = restingPose(b.lastRound, b.wheelOrder.length);
    const now = performance.now();
    if (!wheel || wheel.match !== match || round < wheel.round || round > wheel.round + 1) {
      if (wheel?.duration && wheel.match === match) A.animClear();
      stopSpin();
      wheel = { match, round, angle: rest.rotor, orbit: rest.orbit, duration: 0 };
    } else if (round > wheel.round) {
      const plan = makeRouletteSpin(wheel.angle, b.lastRound, b.wheelOrder.length);
      stopSpin();
      const duration = A.reduce || (document.hidden && !S.set.bgSound) ? 0 : plan.duration * A.speed;
      const pre = duration ? PRE_MS : 0;
      wheel = { match, round, angle: rest.rotor, orbit: rest.orbit, plan, started: now + pre, duration, pre };
      $('#boardwrap').scrollTop = 0;
      if (duration) {
        // CPU は回転盤の表示が消えるまで(回る間+止まってから見せる間+消える間)次の手を打たない
        wheel.A = A;
        A.anim(plan.duration + (pre + SETTLE_MS + LEAVE_MS) / A.speed);
        const impacts = plan.impacts.map(hit => ({...hit, at: hit.at * A.speed}));
        const current = wheel;
        // 回る音も、回し始めに合わせる
        current.soundTimer = setTimeout(() => { if (wheel === current) current.cancelSound = sfx.rouletteSpin?.({duration, impacts, panAt: plan.panAt}); }, pre);
        current.timer = setTimeout(() => {
          if (wheel !== current || token !== match || S.screen !== 'play') return;
          current.duration = 0;
          // 止まった後も少しだけ浮かせたまま出目を見せる(押すと閉じる)。閉じる時はゆっくり消す。
          current.stoppedAt = performance.now();
          current.settleUntil = current.stoppedAt + SETTLE_MS;
          current.settleTimer = setTimeout(() => {
            if (wheel !== current || token !== match || S.screen !== 'play') return;
            closeWheel();
          }, SETTLE_MS);
          A.redraw();
        }, pre + duration);
      } else if (A.reduce) {
        wheel.cancelSound = sfx.rouletteSpin?.({duration: 0, impacts: [{at: 0, strength: .23, kind: 'settle', pan: 0}]});
      }
    } else if (A.reduce && wheel.duration) {
      stopSpin();
      A.animClear();
    }
    return wheel.duration > 0 && now - wheel.started < wheel.duration; // 回し始める前(started が先)も回っている扱い
  }

  function animateWheel(root, spinning) {
    const current = wheel;
    cancelAnimationFrame(current.frame);
    const rotor = root.querySelector('.rq-rotor'), orbit = root.querySelector('.rq-orbit');
    const ball = orbit.querySelector('.rq-ball'), shadow = orbit.querySelector('.rq-ball-shadow');
    const face = ball.querySelector('.rq-ball-face');
    let lastRadius, lastHeight;
    const setPose = ({rotor: bearing, orbit: azimuth, radius, height}) => {
      rotor.style.transform = `rotate(${bearing}deg)`;
      orbit.style.transform = `rotate(${azimuth}deg)`;
      // Separate contact shadow and sphere during flight. The highlight keeps
      // the direction of the table light throughout the ball's orbit.
      face?.setAttribute('transform', `rotate(${-azimuth} 0 -121)`);
      // Along the rim and inside the final pocket the ball and shadow stay at a fixed radius.
      if (height === 0 && lastHeight === 0 && radius === lastRadius) return;
      lastHeight = height;
      lastRadius = radius;
      const radialShift = 121 - radius;
      const az = azimuth * Math.PI / 180;
      const x = -height * Math.sin(az), y = -height * Math.cos(az);
      ball.setAttribute('transform', `translate(${x} ${radialShift + y})`);
      if (shadow) {
        shadow.setAttribute('transform', `translate(0 ${radialShift})`);
        shadow.style.opacity = String(.88 - .055 * height);
      }
    };
    if (!spinning) {
      setPose({rotor: current.angle, orbit: current.orbit, radius: current.round ? 121 : 179.5, height: 0});
      return;
    }
    function frame(now) {
      if (current !== wheel || !orbit.isConnected || !current.duration) return;
      const t = Math.max(0, (now - current.started) / current.duration);
      if (current.round > 1 && orbit.style.opacity !== '1') orbit.style.opacity = String(Math.min(1, t * 45));
      setPose(current.plan.poseAt(t));
      if (t < 1) current.frame = requestAnimationFrame(frame);
    }
    frame(performance.now());
  }

  function controls(b, A, can, chipIndex, spinning) {
    const me = ui.me;
    const confirm = b.confirmed.every((checked, seat) => checked || seat === me || (!b.bankrolls[seat] && b.maxRounds > 0));
    const list = [
      ['戻す', 2000, b.canUndo],
      ['クリア', 2001, b.canClear],
      ['前回と同じ', 2002, b.canRebet],
      ['2倍', 2003, b.canDouble],
      ...(b.maxRounds === 0 ? [['補充', 2005, b.canRebuy]] : []),
      [confirm ? '確定・スピン' : 'ベット確定', 2004, true],
    ];
    A.acts(list.map(([label, move, enabled]) => ({label, move: ui.enc(move), enabled: enabled && can(move)})));
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
    const hasRemovable = me >= 0 && b.tableTotals[me] > 0 && can(2001);
    dock.insertAdjacentHTML('afterbegin', `<div class="rq-tools"><div class="rq-wallet"><span>手元</span><b>${spinning || me < 0 ? '—' : fmt(b.chips[me] ?? 0)}</b> 枚</div>
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
    if (ui?.match !== match) ui = {match, round: b.roundNo, chip: 2, remove: false};
    if (ui.round !== b.roundNo) { ui.round = b.roundNo; ui.remove = false; }
    // みんなで同時に賭ける: 自分の席の分だけを扱い、送る手には席を含める(席 × SEAT + 手)
    const SEAT = 1000000, me = Number.isInteger(b.me) && b.me >= 0 && b.me < b.n ? b.me : -1;
    ui.me = me; ui.enc = (m) => Math.max(0, me) * SEAT + m;
    const ready = me >= 0 && !A.view.outcome && !busy && !b.confirmed[me];
    const legal = new Set(A.view.legal.filter(x => Math.floor(x / SEAT) === me).map(x => x % SEAT));
    const spinning = updateWheel(b, A, match);
    const can = m => ready && !spinning && legal.has(m);
    if (me < 0 || !b.tableTotals[me]) ui.remove = false;
    let chipIndex = ui.chip;
    while (chipIndex > 0 && me >= 0 && b.spotChips[chipIndex] > b.chips[me]) chipIndex--;
    const root = $('#boardwrap');
    const focused = document.activeElement;
    const savedFocus = ['data-roulette-chip', 'data-roulette-spot', 'data-roulette-remove', 'data-roulette-action']
      .find(key => focused?.hasAttribute(key));
    const seats = Array.from({ length: b.n }, (_, seat) => ({
      seat, name: A.name(seat), color: dot(seat),
    }));
    const last = b.lastRound;
    const roundNo = spinning ? last.roundNo : b.roundNo;
    const history = b.history.map(r => `<span class="rq-pocket-tag ${r.color}" title="第${r.roundNo}ラウンド" aria-label="第${r.roundNo}ラウンド ${r.pocketStr}">${r.pocketStr}</span>`).join('');
    A.round(`第${roundNo}ラウンド${b.maxRounds ? ` / ${b.maxRounds}` : '・エンドレス'}`);
    A.strip(seats.map(({seat, name, color}) => {
      const active = !spinning && !b.confirmed[seat]; // まだ賭けている人(同時に何人でも)
      const chips = spinning ? last.bankrollsAfter[seat] - last.payouts[seat] : b.chips[seat];
      const stake = spinning ? last.wagered[seat] : b.tableTotals[seat];
      const status = spinning || b.confirmed[seat] ? '確定済み' : active ? 'ベット中' : '待機';
      return `<div class="pl rq-player ${active ? 'turn' : ''}"><i class="dot" style="background:${color}"></i>
        <span class="who"><span class="nm">${esc(name)}</span><span class="nt">${status}</span></span>
        <span class="rq-player-money"><b class="num">${fmt(chips + stake)}</b><small>手元 ${fmt(chips)} / 賭け ${fmt(stake)}</small></span></div>`;
    }).join(''));
    // The bets and pockets shown during a spin belong to the settled round.
    // Keep that scene attached when chat or player status refreshes the board.
    if (spinning && wheel.scene && root.firstElementChild === wheel.scene) {
      wheel.scene.dataset.ready = String(ready);
      controls(b, A, can, chipIndex, true);
      return;
    }
    const settling = !spinning && wheel.settleUntil > performance.now();
    const leaving = !spinning && !settling && wheel.leaveUntil > performance.now();
    A.board(`<div class="rq-layout${spinning ? ' is-spinning' : settling ? ' is-settling' : leaving ? ' is-leaving' : ''}" data-ready="${ready}"${leaving ? ` style="--rq-leave-delay:${Math.round(performance.now() - wheel.leaveUntil + LEAVE_MS) * -1}ms"` : ''}>
      <section class="rq-wheel-panel" aria-label="${b.wheelType === 'amer' ? 'アメリカン' : 'ヨーロピアン'}ルーレット">
        ${wheelGraphic(b)}${(settling || leaving) ? netBadge(b, A) : ''}
      </section>
      <div class="rq-bets">${renderTable(b, seats, can, chipIndex, spinning)}
        ${!spinning ? resultPanel(last, seats, history) : ''}</div>
      </div>`, (data, button) => { if (data.rouletteSpot != null && button.getAttribute('aria-disabled') === 'false') A.play(ui.enc(Number(data.m))); });
    root.oncontextmenu = event => {
      const spot = event.target.closest('[data-roulette-spot]');
      if (!spot) return;
      event.preventDefault();
      const move = 1000 + Number(spot.dataset.rouletteSpot);
      if (can(move)) A.play(ui.enc(move));
    };
    const panel = root.querySelector('.rq-wheel-panel');
    if (panel) panel.onclick = () => closeWheel();
    controls(b, A, can, chipIndex, spinning);
    wheel.scene = spinning ? root.firstElementChild : null;
    animateWheel(root, spinning);
    if (savedFocus) {
      const button = document.querySelector(`[${savedFocus}="${focused.getAttribute(savedFocus)}"]`);
      if (button && !button.disabled && button.getAttribute('aria-disabled') !== 'true') button.focus({preventScroll: true});
    }
  };
  window.RENDER.roulette.leave = () => { stopSpin(); wheel = null; };
});
