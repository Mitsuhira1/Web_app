'use strict';

const wolfGame = (() => {
  const labels = { villager:'村人', wolf:'人狼', seer:'占い師', medium:'霊媒師', guard:'騎士' };
  const abilities = {
    villager:'話し合いと投票に参加', wolf:'夜に一人を襲う', seer:'夜に一人を占う',
    medium:'追放された人の正体を知る', guard:'夜に一人を守る'
  };
  const powers = { wolf:'襲う', seer:'占う', guard:'守る' };
  const stamps = ['賛成！','待って！','占い結果は？','もう一度聞きたい'];
  const phaseLabel = { talk:'話し合い', vote:'投票', night:'夜', end:'結果' };
  const settings = { seats:6, minutes:3, voteSeconds:45, nightSeconds:45, wolves:1, seer:true, medium:true, guard:true, deadChat:false, pace:'', ...store.get('wolfSetup',{}) };
  let setupOnline = false, starting = false, host = null, snapshot = null, secret = null;
  let selected = '', keyPair, keyPromise, openedMatch = '', receivedVersion = -1;
  let recordedMatch = '';
  let animationQueue = Promise.resolve(), playback = 0;

  const participants = () => Object.values(fbState.players).filter(p=>!isSlotSpectating(p.slot)).sort((a,b) => a.slot-b.slot);
  const minimum = () => setupOnline ? Math.max(3, participants().length) : 3;
  function roster() {
    const roles = [...Array(settings.wolves).fill('wolf'), ...['seer','medium','guard'].filter(role => settings[role])];
    while (roles.length < settings.seats) roles.push('villager');
    return roles;
  }
  const canStart = () => !starting && settings.seats >= minimum() && settings.wolves * 2 < settings.seats &&
    roster().length === settings.seats && (!setupOnline || (canStartExtraMatch() && keyPair &&
      participants().every(p => p.uid === netApi.uid || p.wolfKey)));
  const player = uid => snapshot?.players.find(p => p.id === uid);
  const localId = () => snapshot?.online ? netApi?.uid : 'local';
  const me = () => player(localId());
  const living = state => state.players.filter(p => p.alive);
  const choose = values => values[Math.floor(Math.random() * values.length)];
  const values = list => Array.isArray(list) ? list : Object.values(list || {});
  // The host runs the rules. Other clients receive only their own private data.
  async function publicKey() {
    if (!globalThis.crypto?.subtle) return null;
    keyPromise ||= (async () => {
      keyPair = await crypto.subtle.generateKey({name:'RSA-OAEP', modulusLength:2048,
        publicExponent:new Uint8Array([1,0,1]), hash:'SHA-256'}, false, ['encrypt','decrypt']);
      const bytes = await crypto.subtle.exportKey('spki', keyPair.publicKey);
      return btoa(String.fromCharCode(...new Uint8Array(bytes)));
    })().catch(() => null);
    return keyPromise;
  }
  const importKey = value => crypto.subtle.importKey('spki',bytes(value),{name:'RSA-OAEP',hash:'SHA-256'},false,['encrypt']);
  const bytes = value => Uint8Array.from(atob(value), ch => ch.charCodeAt(0));
  const decode = async value => JSON.parse(new TextDecoder().decode(
    await crypto.subtle.decrypt('RSA-OAEP', keyPair.privateKey, bytes(value))
  ));
  async function encode(value,key) {
    const clear = new TextEncoder().encode(JSON.stringify(value));
    const cipher = await crypto.subtle.encrypt('RSA-OAEP',key,clear);
    return btoa(String.fromCharCode(...new Uint8Array(cipher)));
  }
  function setup(on = false) {
    setupOnline = on;
    settings.seats = Math.max(settings.seats, minimum());
    go('wolfSetup');
  }
  function option(label, key, options) {
    return setupRow(label, seg('wolf:'+key, options, key==='pace'?settings.pace||'inherit':String(settings[key])));
  }
  function setupHtml() {
    const enabled = [['true','使う'],['false','使わない']];
    const outdated = setupOnline && participants().some(p => p.uid !== netApi?.uid && !p.wolfKey);
    const cpus = Math.max(0,settings.seats-(setupOnline?participants().length:1));
    const playerRows = option('合計の人数','seats',[3,4,5,6].filter(n=>n>=minimum()).map(n=>[String(n),n+'人'])) +
      (setupOnline ? setupRow('対局者',`<b>${participants().length}人</b>`,participants().map(p=>p.name).join('・')) : '') +
      setupRow('CPUの人数',`<b>${cpus}人</b>`) +
      (cpus ? option('CPUの手番の長さ','pace',CPU_PACE_CHOICES) : '');
    const deal = roster();
    const roles = option('人狼の人数','wolves',[['1','1人'],['2','2人']]) +
      option('占い師','seer',enabled)+option('霊媒師','medium',enabled)+option('騎士','guard',enabled) +
      setupRow('役職の内訳',`<b>${Object.keys(labels).filter(role=>deal.includes(role)).map(role=>labels[role]+' '+deal.filter(r=>r===role).length).join('・')}</b>`);
    const seconds=[30,45,60,90].map(n=>[String(n),n+'秒']);
    const timing = option('話し合い','minutes',[1,2,3,5,10].map(n=>[String(n),n+'分'])) +
      option('投票','voteSeconds',seconds)+option('夜の行動','nightSeconds',seconds);
    const chat = option('死亡後のチャット','deadChat',[['false','参加不可'],['true','参加可']]);
    const notice = outdated ? '<p class="dimtxt">全員が最新版のアプリから入室すると始められます。</p>' :
      !canStart()&&!starting ? '<p class="dimtxt">対局者の人数と役職の組み合わせを確認してください。</p>' : '';
    return extraSetupLayout('wolf',setupOnline,setupPanel('人数と相手',playerRows+notice)+setupPanel('役職',roles),
      setupPanel('時間',timing)+setupPanel('チャット',chat),'data-wolf-start',{enabled:canStart(),label:starting?'準備中…':'スタート'});
  }
  function setOption(key, value) {
    if (!Object.hasOwn(settings,key) || starting) return;
    if (key==='pace' && !CPU_PACE_CHOICES.some(([id])=>id===value)) return;
    settings[key] = key==='pace' ? value : typeof settings[key] === 'boolean' ? value === 'true' : Number(value);
    store.set('wolfSetup',settings);
    render();
  }
  function line(state, text, entry = {}) {
    state.chat.push({ name:'進行', text, ...entry });
    if (state.chat.length > 80) state.chat.shift();
  }
  function event(state, text, kind = '') {
    line(state, text);
    state.events.push({ seq:++state.eventSeq, text, kind });
    if (state.events.length > 8) state.events.shift();
  }
  function enterPhase(state, phase, seconds) {
    state.phase = phase;
    state.deadline = Date.now() + seconds*1000;
    state.serial++;
    host.commands.clear();
    state.done = [];
    host.cpuAt = Date.now() + extraCpuDelay(host.pace);
  }
  function daybreak(state) {
    state.day++;
    enterPhase(state,'talk',state.minutes*60);
    event(state,`${state.day}日目　生存 ${living(state).length}人`);
    event(state,'話し合い');
  }
  async function start() {
    if (!canStart()) return;
    starting = true;
    const roomId = setupOnline ? netApi.roomId : null;
    const members = setupOnline ? participants() : [{uid:'local', name:meName(), slot:0}];
    const deal = roster();
    for (let i = deal.length-1; i > 0; i--) {
      const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i+1);
      [deal[i],deal[j]] = [deal[j],deal[i]];
    }
    render();
    try {
      const recipients = members.filter(p => p.wolfKey && p.uid !== netApi?.uid);
      const keys = new Map(await Promise.all(recipients.map(async p =>
        [p.uid, await importKey(p.wolfKey)]
      )));
      if (S.screen !== 'wolfSetup' || (roomId && netApi.roomId !== roomId)) return;
      const players = deal.map((_,i) => ({ id:members[i]?.uid || 'cpu-'+i, alive:true,
        name:members[i]?.name || 'CPU '+(i+1-members.length), cpu:i>=members.length }));
      host = { keys, keyData:new Map(recipients.map(p=>[p.uid,p.wolfKey])), roomId, deal, commands:new Map(), notes:new Map(), lastGuard:new Map(), cpuAt:0,
        publishing:false, dirty:false, voteSeconds:settings.voteSeconds, nightSeconds:settings.nightSeconds, pace:settings.pace,
        state:{ id:Array.from(crypto.getRandomValues(new Uint32Array(4)),n=>n.toString(16).padStart(8,'0')).join(''),
          online:!!roomId, players, roles:roster(), day:0, serial:0, version:0, deadChat:settings.deadChat,
          minutes:settings.minutes, chat:[], events:[], eventSeq:0, readyCount:0 } };
      daybreak(host.state);
      selected = '';
      S.screen = 'wolfPlay';
      applyHost();
      if (roomId) await publish();
    } catch (err) {
      console.warn('[Wolf]',err);
      toast({w:'人狼',t:'対局の準備ができませんでした'});
    } finally {
      starting = false;
      if (S.screen === 'wolfSetup') render();
    }
  }
  function hiddenInfo(game, id) {
    const index = game.state.players.findIndex(p=>p.id===id);
    const role = game.deal[index];
    return { r:role, n:game.notes.get(id) || null,
      w:role==='wolf' ? game.deal.flatMap((r,i)=>r==='wolf'&&i!==index?[i]:[]) : [] };
  }
  function applyHost() {
    const state = host.state;
    state.readyCount = state.phase === 'talk' ? host.commands.size : 0;
    state.done = [...host.commands.keys()];
    state.version++;
    apply({ ...state },hiddenInfo(host,localIdFor(state)));
    if (host.roomId) host.dirty = true;
  }
  const localIdFor = state => state.online ? netApi?.uid : 'local';
  async function publish() {
    const game = host;
    if (!game?.roomId || game.publishing) return;
    game.publishing = true;
    try {
      while (host === game && game.dirty && netApi?.roomId === game.roomId) {
        game.dirty = false;
        const state = structuredClone(game.state);
        const encrypted = await Promise.all([...game.keys].map(async ([uid,key]) =>
          [uid,await encode(hiddenInfo(game,uid),key)]
        ));
        if (host !== game || netApi.roomId !== game.roomId) return;
        if (game.dirty) continue;
        await netApi.writeState({wolf:{...state, private:Object.fromEntries(encrypted)}});
      }
    } catch (err) {
      game.dirty = true;
      console.warn('[Wolf] sync',err);
      toast({w:'人狼',t:'通信が途切れました。同期を再試行しています'});
      game.retryAt = Date.now() + 2500;
    } finally { game.publishing = false; }
  }
  async function playersChanged() {
    const game = host;
    if (!game?.roomId) return;
    for (const p of participants()) {
      if (!game.keys.has(p.uid) || !p.wolfKey || game.keyData.get(p.uid)===p.wolfKey) continue;
      try {
        const key = await importKey(p.wolfKey);
        if (host!==game || fbState.players[p.uid]?.wolfKey!==p.wolfKey) continue;
        game.keyData.set(p.uid,p.wolfKey);
        game.keys.set(p.uid,key);
        applyHost();
        publish();
      } catch (error) { console.warn('[Wolf] public key',error); }
    }
  }
  async function remote(roomState) {
    if (netApi?.role !== 'guest') return;
    const state = roomState?.wolf;
    if (!state) {
      if (snapshot?.online) { reset(); if (S.screen==='wolfPlay') go('room'); }
      return;
    }
    if (snapshot?.id === state.id && state.version <= receivedVersion) return;
    const roomId = netApi.roomId;
    const {private: packets, ...shared} = state;
    for (const field of ['players','roles','chat','events']) shared[field] = values(state[field]);
    let info = null;
    if (packets?.[netApi.uid] && keyPair) {
      try { info = await decode(packets[netApi.uid]); }
      catch (error) { console.warn('[Wolf] private data', error); }
    }
    const latest = fbState.roomState?.wolf;
    if (netApi?.roomId !== roomId || latest?.id !== state.id || latest.version !== state.version ||
        (snapshot?.id===state.id && state.version<=receivedVersion)) return;
    receivedVersion = state.version;
    apply(shared,info);
  }
  function apply(state, info) {
    const isNew = openedMatch !== state.id;
    const oldSerial = snapshot?.serial;
    const lastEvent = isNew ? 0 : snapshot.eventSeq;
    snapshot = state; secret = info;
    if (state.phase==='end' && !state.online && info?.r && recordedMatch!==state.id) {
      recordedMatch = state.id;
      const stats = store.get('stats',{});
      const result = stats.vs_wolf || [0,0,0];
      result[(state.winner==='wolf')===(info.r==='wolf')?0:1]++;
      stats.vs_wolf = result; store.set('stats',stats);
    }
    if (isNew) {
      if (state.online && S.screen==='play') leavePlay();
      openedMatch = state.id;
      S.screen='wolfPlay'; S.sel='wolf'; bgCtx(); render();
    } else if (oldSerial !== state.serial) selected = '';
    update();
    if (S.screen==='wolfPlay') {
      const fresh = values(state.events).filter(item => item.seq > lastEvent);
      animate(isNew && !host ? fresh.filter(e=>state.day===1 && (e.text==='話し合い'||e.seq===1)) : fresh);
    }
  }
  function reset() {
    host = snapshot = secret = null;
    openedMatch = selected = '';
    receivedVersion = -1;
    playback++;
    animationQueue = Promise.resolve();
  }
  const roleOf = (game, p) => game.deal[game.state.players.indexOf(p)];
  function candidates(state, p, role) {
    if (!p?.alive || (state.phase!=='vote' && (state.phase!=='night'||!powers[role]))) return [];
    return living(state).filter(target => target.id !== p.id &&
      (state.phase !== 'night' || ((role !== 'wolf' || roleOf(host,target) !== 'wolf') &&
        (role !== 'guard' || host.lastGuard.get(p.id) !== target.id))));
  }
  function localCandidates() {
    const p = me(), state = snapshot;
    if (!p?.alive || !secret ||
        (state.phase!=='vote' && (state.phase!=='night'||!powers[secret.r]))) return [];
    const partnerIndices = secret.w || [];
    return living(state).filter(target => target.id!==p.id &&
      (state.phase!=='night' || ((secret.r!=='wolf' || !partnerIndices.includes(state.players.indexOf(target))) &&
      (secret.r!=='guard' || secret.n?.[0]!=='guard' || secret.n[1]!==state.players.indexOf(target)))));
  }
  function isFinished(state) {
    const alive = living(state);
    const wolves = alive.filter(p => roleOf(host,p)==='wolf').length;
    if (wolves && wolves < alive.length-wolves) return false;
    enterPhase(state,'end',0);
    state.winner = wolves?'wolf':'village';
    event(state,wolves?'人狼陣営の勝ち':'村人陣営の勝ち','result');
    return true;
  }
  function plurality(inputs) {
    const votes = new Map();
    for (const id of inputs.filter(Boolean)) votes.set(id,(votes.get(id)||0)+1);
    const high = Math.max(0,...votes.values());
    return choose([...votes].filter(([,n])=>n===high).map(([id])=>id));
  }
  function advance(now) {
    const game = host, state = game.state;
    if (state.phase==='end') return false;
    let changed = false;
    const alive = living(state);
    if (now >= game.cpuAt) {
      const p = alive.find(p=>p.cpu && !game.commands.has(p.id));
      if (p) {
        game.cpuAt = now + extraCpuDelay(game.pace) / 2;
        const role = roleOf(game,p);
        if (state.phase==='talk') {
          if (!state.online) {
            const note = game.notes.get(p.id);
            if (role==='seer' && note?.[0]==='seer') {
              line(state,`占いました。${state.players[note[1]].name}は${note[2]?'人狼':'人間'}でした。`,{name:p.name});
            } else if (p===alive.find(v=>v.cpu)) {
              line(state,state.day===1?'気になる人はいますか？':'昨夜の結果も見て投票先を考えよう。',{name:p.name});
            }
          }
          game.commands.set(p.id,'ready');
        } else {
          game.commands.set(p.id,choose(candidates(state,p,role))?.id || '');
        }
        changed = true;
      }
    }
    const timeout = now >= state.deadline;
    const enough = game.commands.size >= (alive.length>=3?alive.length-1:alive.length);
    const soloReady = state.online || !state.players[0].alive || game.commands.has('local');
    if (state.phase==='talk' && (timeout || (enough && soloReady))) {
      enterPhase(state,'vote',host.voteSeconds);
      event(state,'投票開始');
      return true;
    }
    if (state.phase!=='talk' && (timeout || alive.every(p=>game.commands.has(p.id)))) {
      if (state.phase==='vote') {
        const exileId = plurality(alive.map(p=>game.commands.get(p.id)));
        const exile = state.players.find(p=>p.id===exileId);
        if (exile) {
          exile.alive = false;
          event(state,exile.name+'追放');
          for (const p of living(state).filter(p=>roleOf(game,p)==='medium')) {
            game.notes.set(p.id,['medium',state.players.indexOf(exile),roleOf(game,exile)==='wolf']);
          }
        } else line(state,'投票がなく、追放された人はいません');
        if (!isFinished(state)) { enterPhase(state,'night',host.nightSeconds); line(state,'夜'); }
      } else {
        const wolfVotes = alive.filter(p=>roleOf(game,p)==='wolf' && game.commands.get(p.id));
        const victimId = plurality(wolfVotes.map(p=>game.commands.get(p.id)));
        const victim = state.players.find(p=>p.id===victimId);
        const guarded = new Set();
        for (const p of alive) {
          const aim = state.players.find(q=>q.id===game.commands.get(p.id));
          if (!aim) continue;
          const i = state.players.indexOf(aim);
          switch (roleOf(game,p)) {
            case 'seer': game.notes.set(p.id,['seer',i,roleOf(game,aim)==='wolf']); break;
            case 'guard': guarded.add(aim.id); game.lastGuard.set(p.id,aim.id); game.notes.set(p.id,['guard',i]); break;
          }
        }
        if (victim && !guarded.has(victimId)) {
          victim.alive = false;
          if (!state.deadChat) {
            const attackers = wolfVotes.filter(p=>game.commands.get(p.id)===victimId);
            game.notes.set(victim.id,['killed',...attackers.map(p=>state.players.indexOf(p))]);
          }
          event(state,victim.name+'が殺された！','attack');
        } else line(state,'昨夜の犠牲者はいません');
        if (!isFinished(state)) daybreak(state);
      }
      return true;
    }
    return changed;
  }
  const canSpeak = (p, state) => !!p && (p.alive || state.deadChat);
  function canRoomChat(uid) { return !snapshot?.online || canSpeak(player(uid),snapshot); }
  async function actionFromGuest(action, local = false) {
    const game = host;
    if (!local && ['choose','skip'].includes(action.move)) return;
    if (action.move==='ballot') {
      if (!game || action.id!==game.state.id || !keyPair || typeof action.packet!=='string') return;
      try {
        const [id,serial,index,uid] = await decode(action.packet);
        if (host!==game || id!==game.state.id || uid!==action.uid) return;
        action = {...action, serial, move:index===-1?'skip':'choose', target:game.state.players[index]?.id};
      } catch { return; }
    }
    if (!game || action.id!==game.state.id || !game.state.players.some(p=>p.id===action.uid&&!p.cpu)) return;
    const state = game.state;
    const p = state.players.find(p=>p.id===action.uid);
    if (action.move==='chat') {
      if (!canSpeak(p,state) || typeof action.text!=='string') return;
      const text = action.text.trim().slice(0,80);
      if (!text) return;
      game.chatAt ||= new Map();
      if (Date.now()-(game.chatAt.get(p.id)||0)<400) return;
      game.chatAt.set(p.id,Date.now());
      line(state,text,{name:p.name,uid:p.id});
    } else {
      if (!p.alive || action.serial!==state.serial || game.commands.has(p.id)) return;
      const allowed = candidates(state,p,roleOf(game,p));
      if (action.move==='ready' && state.phase==='talk') game.commands.set(p.id,'ready');
      else if (action.move==='choose' && allowed.some(q => q.id===action.target)) game.commands.set(p.id,action.target);
      else if (action.move==='skip' && state.phase==='night' && !allowed.length) game.commands.set(p.id,'');
      else return;
      state.done = [...game.commands.keys()];
      advance(Date.now());
    }
    applyHost();
    publish();
  }
  async function send(move, data = {}) {
    if (!snapshot) return;
    const action = {type:'WOLF', id:snapshot.id, serial:snapshot.serial, move, ...data};
    if (host) return actionFromGuest({...action,uid:localId()},true);
    if (netApi?.role!=='guest') return;
    try {
      const roomId = netApi.roomId, uid = netApi.uid;
      if (move==='choose' || move==='skip') {
        const owner = participants().find(p=>p.slot===0);
        const index = snapshot.players.findIndex(p=>p.id===data.target);
        const packet = await encode([action.id,action.serial,index,uid],await importKey(owner.wolfKey));
        if (netApi.roomId!==roomId || snapshot?.id!==action.id) return;
        await netApi.sendAction({type:'WOLF',id:action.id,move:'ballot',packet});
      } else await netApi.sendAction(action);
    } catch { toast({w:'人狼',t:'操作を送信できませんでした'}); }
  }
  function chooseTarget(id) { selected = id; update(); }
  function act() {
    if (snapshot.phase==='talk') send('ready');
    else if (snapshot.phase==='end') exit();
    else if (snapshot.phase==='night' && !localCandidates().length) send('skip');
    else if (selected) send('choose',{target:selected});
  }
  function exit() {
    if (!snapshot?.online) {
      const out=()=>{ closeSheet(); go(roomActive()?'room':'menu'); };
      if (!snapshot || snapshot.phase==='end') return out();
      setTimeout(focusPrimary,0);
      openSheet('<h2>人狼の対局を終わりますか</h2><div class="btns"><button class="btn" data-sheetback>戻る</button><button class="btn danger" id="wolfEnd">終わる</button></div>');
      $('#wolfEnd').onclick = out;
      return;
    }
    if (!host) return go('room');
    const end = async () => {
      closeSheet();
      const game = host;
      reset();
      if (game.roomId===netApi?.roomId) {
        try { await netApi.writeState({wolf:null}); }
        catch { host=game; applyHost(); publish(); toast({w:'人狼',t:'対局を閉じられませんでした'}); return; }
      }
      go('room');
    };
    if (snapshot.phase==='end') return end();
    openSheet('<h2>人狼の対局を終わりますか</h2><div class="btns"><button class="btn" data-sheetback>戻る</button><button class="btn danger" id="wolfEnd">終わる</button></div>');
    $('#wolfEnd').onclick = end;
  }
  function resume() {
    if (snapshot?.online) { go('wolfPlay'); return true; }
    return false;
  }
  function stop() {
    playback++;
    animationQueue = Promise.resolve();
    if (!snapshot?.online) reset();
  }
  function playHtml() {
    if (!snapshot) return '';
    const seats = `<div class="seats"><div class="seat"><i class="dot" style="background:${SEAT_COLORS[ost?.mySlot]||SEAT_COLORS[0]}"></i>
      <span class="nm">${esc(me()?.name || meName())}</span><b id="wolfMyStatus"></b></div></div>`;
    const side = playSide({seats,status:`<div class="status">${snapshot.online&&!me()?'みんなで遊ぶ・観戦中':playMode(snapshot.online)}</div>`,
      actions:ruleButton('wolf')+`<button class="btn" data-wolf-help="roles">${ic('list')}役職の一覧</button>`,on:snapshot.online,extraClass:'wolf-common'});
    return `<div class="screen wolf-screen">
      <aside class="side wolf-info">
        ${playHeader('人狼', '', 'data-wolf-exit')}
        <div class="panel"><div class="row"><strong id="wolfDay"></strong><span id="wolfLiving"></span></div>
          <div class="row"><b id="wolfPhase"></b><time id="wolfTime" class="num"></time></div></div>
        <div class="panel" id="wolfRoleCard"><h3>あなたの役職</h3><div class="row"><b id="wolfRole"></b></div><p id="wolfPrivate" hidden></p></div>
        <div class="wolf-action"><div id="wolfHint" aria-live="polite"></div><div class="wolf-controls">
          ${playGear()}
          <button class="btn primary" id="wolfAct" data-wolf-act></button>
        </div></div>
      </aside>
      <main class="stage wolf-stage"><div id="wolfTargets"></div>
        <section class="chat wolf-village"><h3>村の話し合い</h3><div class="log" id="wolfLog" role="log"></div>
          <div class="stamps">${stamps.map((text,i)=>`<button data-wolf-stamp="${i}">${text}</button>`).join('')}</div>
          <form id="wolfForm"><input id="wolfInput" maxlength="80" placeholder="村に発言する" aria-label="村への発言"><button>送る</button></form>
        </section>
        <div class="cutlayer" id="cutlayer"></div><div class="wolf-attack" id="wolfAttack" hidden></div>
      </main>
      ${side}</div>`;
  }
  function noteText() {
    if (!secret) return '';
    const [kind,index,match] = secret.n || [];
    if (kind==='killed') return 'あなたを襲った人狼 '+secret.n.slice(1).map(i=>snapshot.players[i].name).join('、');
    if (kind==='seer' || kind==='medium') return (kind==='seer'?'占い結果':'霊媒結果')+'　'+snapshot.players[index].name+'は'+(match?'人狼':'人間');
    if (secret.w?.length) return '仲間の人狼　'+secret.w.map(i=>snapshot.players[i].name).join('、');
    return '';
  }
  function setText(id, text) { const el = $('#'+id); if (el && el.textContent!==String(text)) el.textContent = text; }
  function clock() {
    const left = Math.max(0,Math.ceil((snapshot.deadline-Date.now())/1000));
    setText('wolfTime',snapshot.phase==='end'?'':Math.floor(left/60)+':'+String(left%60).padStart(2,'0'));
  }
  function update() {
    const button = $('#wolfAct');
    if (S.screen!=='wolfPlay' || !button || !snapshot) return;
    const state = snapshot, p = me(), phase = state.phase;
    const submitted = values(state.done).includes(localId());
    const options = submitted ? [] : localCandidates();
    setText('wolfDay',state.day+'日目');
    setText('wolfLiving','生存 '+living(state).length+'人');
    setText('wolfPhase',phaseLabel[phase]); clock();
    setText('wolfRole',labels[secret?.r] || '確認中');
    $('#wolfRoleCard').hidden = !p;
    const result = noteText();
    setText('wolfPrivate',result); $('#wolfPrivate').hidden = !result;
    setText('wolfMyStatus',p?(p.alive?'生存':'死亡'):'観戦');
    const show = phase==='end' || (!!p?.alive && !!secret);
    button.hidden = !show;
    button.textContent = phase==='end'?'終了':submitted?'確定済み':phase==='talk'?'投票へ進む':
      phase==='vote'?'投票を確定':options.length?powers[secret?.r]:'夜明けを待つ';
    button.disabled = phase!=='end' && (submitted || ((phase==='vote'||options.length>0) && !selected));
    setText('wolfHint',phase==='end'?(state.winner==='wolf'?'人狼陣営の勝ち':'村人陣営の勝ち'):
      phase==='talk'?`投票準備　${state.readyCount || 0} / ${living(state).length}人`:
      options.length?(phase==='vote'?'追放する相手を選択':powers[secret?.r]+'相手を選択'):'');
    const markup = options.map(q=>`<button class="btn" data-wolf-target="${esc(q.id)}" aria-pressed="${selected===q.id}">${esc(q.name)}</button>`).join('');
    if ($('#wolfTargets').innerHTML !== markup) $('#wolfTargets').innerHTML = markup;
    const log = $('#wolfLog');
    if (log.dataset.version !== String(state.version)) {
      const follow = log.scrollHeight-log.clientHeight-log.scrollTop < 45;
      log.innerHTML = state.chat.map(item=>`<div class="msg ${item.uid===localId()?'mine':''}"><small>${esc(item.name)}</small>${esc(item.text)}</div>`).join('');
      if (follow) log.scrollTop = log.scrollHeight;
      log.dataset.version = state.version;
    }
    const speak = canSpeak(p,state);
    $('#wolfInput').placeholder = speak?'村に発言する':'発言できません';
    const commonDisabled = !canRoomChat(localId()) || !ost?.chatOk;
    document.querySelectorAll('#wolfForm input,#wolfForm button,[data-wolf-stamp]').forEach(el=>el.disabled=!speak);
    document.querySelectorAll('.wolf-common #chatf input,.wolf-common #chatf button,.wolf-common [data-stamp]').forEach(el=>el.disabled=commonDisabled);
    if (!commonDisabled) return;
    const picker = $('.wolf-common .stpanel');
    if (picker) { picker.remove(); S.stOpen = false; }
  }
  function help() {
    const roles = Object.keys(labels).filter(r=>snapshot.roles.includes(r)).map(r=>
      `<p><b>${labels[r]} × ${snapshot.roles.filter(v=>v===r).length}</b><br>${abilities[r]}</p>`).join('');
    openSheet('<h2>役職の一覧</h2>'+roles+'<div class="btns"><button class="btn" data-sheetback>閉じる</button></div>');
  }
  function attackScene() {
    return new Promise(resolve => {
      const box = $('#wolfAttack');
      if (!box || S.set.reduce) return resolve();
      const video = document.createElement('video');
      video.src='assets/wolf-night.mp4'; video.muted=true; video.playsInline=true;
      let timeout;
      const finish = () => { clearTimeout(timeout); video.remove(); if (box.isConnected) box.hidden=true; resolve(); };
      video.addEventListener('ended',finish,{once:true});
      video.addEventListener('error',finish,{once:true});
      box.replaceChildren(video); box.hidden=false;
      const session = playback;
      transientAudio.later(() => { if (session===playback && box.isConnected && !box.hidden) sfxCrumble(); },1200);
      timeout=setTimeout(finish,3600);
      video.play().catch(finish);
    });
  }
  function animate(events) {
    const session = playback;
    for (const item of events) {
      animationQueue = animationQueue.then(async () => {
        if (session!==playback || S.screen!=='wolfPlay' || document.hidden) return;
        if (item.kind==='attack') await attackScene();
        if (session!==playback || S.screen!=='wolfPlay' || document.hidden) return;
        await new Promise(resolve=>cut({text:item.text,tone:item.kind==='attack'?'red':'gold',
          font:'yo',ms:900,onEnd:resolve}));
      }).catch(error=>console.warn('[Wolf] animation',error));
    }
  }
  setInterval(() => {
    if (host) {
      if (advance(Date.now())) applyHost();
      if (host.dirty && !(Date.now()<host.retryAt)) publish();
    }
    if (snapshot && S.screen==='wolfPlay') clock();
  },250);
  return {setup,setupHtml,start,setOption,playHtml,update,chooseTarget,act,help,exit,resume,stop,reset,publicKey,remote,send,
    actionFromGuest,playersChanged,canRoomChat,stamp:i=>send('chat',{text:stamps[i]}),active:()=>!!snapshot?.online,
    refreshingSetup:()=>setupOnline&&!starting};
})();
