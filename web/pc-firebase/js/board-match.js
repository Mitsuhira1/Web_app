'use strict';

// Browser-native games share the existing room and host action queue.
const boardMatch = (() => {
  const games = new Map();
  let state, visibleId, version = -1, sending = false, pending, retry;
  const matchId = () => Array.from(crypto.getRandomValues(new Uint32Array(4)),n=>n.toString(16).padStart(8,'0')).join('');
  const myId = () => state?.online ? netApi?.uid : 'local';
  function seats(online) {
    return online ? Object.values(fbState.players).filter(p=>!isSlotSpectating(p.slot))
      .sort((a,b)=>a.slot-b.slot).map(({uid,name})=>({id:uid,name})) : [{id:'local',name:meName()}];
  }
  function show(next, begin = false) {
    const previous = state;
    state = next;
    const game = games.get(state.game);
    if (begin) {
      visibleId = state.id;
      S.sel = state.game==='mineVersus' ? 'mine' : state.game;
      game.changed?.(state,previous);
      go('extraPlay');
    } else game.changed?.(state,previous);
    if (S.screen==='extraPlay') game.draw(state);
  }
  async function flush() {
    if (sending || !pending) return;
    sending = true;
    while (pending && netApi?.role==='host') {
      const update = pending; pending = null;
      if (update.roomId!==netApi.roomId) continue;
      try { await netApi.writeState({boardMatch:update.state}); }
      catch (error) {
        console.warn('[BoardMatch]',error);
        if (update.roomId===netApi?.roomId) pending ||= update;
        clearTimeout(retry); retry=setTimeout(flush,1500);
        break;
      }
    }
    sending = false;
  }
  function publish(next) {
    pending = {state:next && structuredClone(next),roomId:netApi?.roomId};
    flush();
  }
  function start(id, on, options) {
    if (on && (netApi?.role!=='host' || seats(true).length<2 || active())) return;
    const round = {id:matchId(),game:id,online:on,version:0,owner:on?netApi.uid:'local',seats:seats(on),...options};
    const game = games.get(id);
    Object.assign(round,game.initial(round));
    version = 0;
    show(round,true);
    if (on) publish(round);
  }
  function remote(room) {
    if (netApi?.role!=='guest') return;
    const next = room?.boardMatch;
    if (!next) {
      if (state?.online) { reset(); if (S.screen==='extraPlay') go('room'); }
      return;
    }
    if (!games.has(next.game) || (state?.id===next.id && version>=next.version)) return;
    version = next.version;
    show(next,visibleId!==next.id);
  }
  function actionFromGuest(action) {
    if (!state || action.id!==state.id || !state.seats.some(p=>p.id===action.uid)) return;
    if (state.online && (netApi?.role!=='host' || !fbState.players[action.uid])) return;
    if (!games.get(state.game).apply(state,action)) return;
    state.version++;
    show(state);
    if (state.online) publish(state);
  }
  function send(move, data = {}) {
    if (!state) return;
    const action = {type:'BOARD_MATCH',id:state.id,move,...data};
    if (!state.online || netApi?.role==='host') actionFromGuest({...action,uid:myId()});
    else netApi.sendAction(action).catch(()=>toast({w:'お知らせ',t:'操作を送信できませんでした'}));
  }
  function reset() {
    if (state) games.get(state.game).stop?.();
    state=null;visibleId=null;version=-1;pending=null;
    clearTimeout(retry);
  }
  function exit() {
    if (!state?.online) {
      const leave=()=>{ closeSheet(); reset(); go(roomActive()?'room':'menu'); };
      // 対局の途中(1 手以上進めて、まだ勝負がついていない)なら、ほかのゲームと同じく確認する
      if (!state || state.finish || !(state.version>0)) return leave();
      setTimeout(focusPrimary, 0);
      openSheet('<h2>対局を終了しますか</h2><p>途中の対局は保存されません。</p><div class="btns"><button class="btn" data-sheetback>キャンセル</button><button class="btn gold" id="extraLeave">終了する</button></div>');
      $('#extraLeave').onclick = leave;
      return;
    }
    if (netApi?.role!=='host') return go('room');
    const end=()=>{closeSheet(); reset(); publish(null); go('room');};
    if (state.game==='mineVersus' && (!minesGame.personal.confirm || state.finish)) return end();
    openSheet('<h2>対局を終了しますか</h2><div class="btns"><button class="btn" data-sheetback>戻る</button><button class="btn danger" id="extraEnd">終了する</button></div>');
    $('#extraEnd').onclick = end;
  }
  function resume() {
    if (!state?.online) return false;
    go('extraPlay'); games.get(state.game).draw(state); return true;
  }
  const active = () => !!state?.online;
  function playHtml() { return state ? games.get(state.game).html(state) : ''; }
  function draw() { if (state) games.get(state.game).draw(state); }
  function button(data) { if (state) return games.get(state.game).button?.(data); }
  return {register:(id,game)=>games.set(id,game), start, remote, actionFromGuest, send, reset, exit, resume,
    active, playHtml, draw, button, myId, get state(){return state;}};
})();
