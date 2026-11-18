'use strict';

const poetCards = (() => {
  const women = new Set([2,9,19,38,53,54,56,57,58,59,60,61,62,65,67,72,79,88,89,90,92]);
  const monks = new Set([8,10,12,21,47,66,69,70,76,82,84,85,86,87,95]);
  const style = n => women.has(n+1)?2:monks.has(n+1)?1:0;
  const chunks = (s, width) => s.match(new RegExp('.{1,'+width+'}','gu'));
  const face = (n, read = true) => {
    const [upper,lower,author] = hundredPoems[n];
    return `<span class="poet-card ${read?'portrait':'verse'}" aria-label="${esc(read?author:lower)}">
      ${read?`<span class="poet-author">${esc(author)}</span><span class="poet-lines">${chunks(upper,6).map(s=>`<span>${s}</span>`).join('')}</span><img src="assets/poet-${style(n)}.svg" alt="">`:
        `<span class="poet-lines">${chunks(lower,5).map(s=>`<span>${s}</span>`).join('')}</span>`}</span>`;
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
  function setupHtml() {
    return `<div class="screen col"><div class="setuphead"><button class="btn" data-go="menu" aria-label="戻る">${ic('back')}</button>
      <span class="art">${artOf('bozu')}</span><div class="txt"><h2>坊主めくり</h2></div><span class="tagl">${online?'みんなで遊ぶ':'ひとりで遊ぶ'}</span></div>
      <div class="setupbody poet-setup"><div class="panel"><div class="row"><b>山札</b><span>4つ</span></div></div></div>
      <div class="setupfoot"><button class="btn" data-go="menu">戻る</button><button class="btn primary" data-poet-start>始める</button></div></div>`;
  }
  function initial(round) {
    if (!round.online) round.seats.push({id:'cpu',name:'CPU'});
    round.seats = round.seats.map(p=>({...p,score:0}));
    animationKey = '';
    const deck = shuffle(all);
    stacks = [0,1,2,3].map(i=>deck.slice(i*25,i*25+25));
    return {piles:[25,25,25,25],discard:0,turn:0,last:-1,finish:false};
  }
  function apply(state,action) {
    if (state.finish || !state.seats.some(p=>p.id===action.uid)) return false;
    if (action.move!=='draw' || action.turn!==state.version || state.seats[state.turn].id!==action.uid) return false;
    const pile=stacks?.[action.cell];
    if (!Number.isInteger(action.cell) || !pile?.length) return false;
    const p=state.seats[state.turn];
    state.last=pile.pop(); state.piles=stacks.map(a=>a.length);
    if (style(state.last)===1) { state.discard+=p.score; p.score=0; }
    else { p.score++; if (style(state.last)===2) {p.score+=state.discard;state.discard=0;} }
    state.turn=(state.turn+1)%state.seats.length;
    state.finish=stacks.every(a=>!a.length);
    return true;
  }
  function turnOrCpu(move, data) {
    if (!boardMatch.state) return;
    if (data?.cpu) {
      const {cpu,...args}=data;
      boardMatch.actionFromGuest({uid:'cpu',id:boardMatch.state.id,move,...args});
    } else boardMatch.send(move,data);
  }
  function changed(state) {
    clearTimeout(timer);
    if (state.finish) {
      if (!state.online && scoredId!==state.id) {
        scoredId=state.id;
        const mine=state.seats.find(p=>p.id==='local'), cpu=state.seats.find(p=>p.id==='cpu');
        const stats=store.get('stats',{}), key='vs_'+state.game;
        const result=stats[key]||[0,0,0];
        result[mine.score>cpu.score?0:mine.score<cpu.score?1:2]++;
        stats[key]=result;store.set('stats',stats);
      }
      return;
    }
    if (state.online&&netApi?.role!=='host') return;
    if (state.seats[state.turn].id==='cpu') {
      const pick = shuffle(state.piles.map((n,i)=>n?i:-1).filter(i=>i!==-1))[0];
      timer=setTimeout(()=>turnOrCpu('draw',{cell:pick,turn:state.version,cpu:true}),750);
    }
  }
  function html(state) {
    return `<div class="screen"><main class="stage poet-stage"><div class="stagehead"><button class="btn" data-extra-exit aria-label="戻る">${ic('back')}</button><h2>坊主めくり</h2></div>
      <div class="poet-table" id="poetTable"></div><button class="btn play-settings" data-playsettings aria-label="設定">${ic('set')}</button><div class="cutlayer" id="cutlayer"></div></main>
      <aside class="side"><div class="seats" id="poetScores"></div><div class="status" id="poetStatus"></div>
      <div class="ops"><button class="btn" data-extra-poet-rules>${ic('book')}ルール</button></div>
      ${state.online?chatBox():''}</aside></div>`;
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
      const type=style(state.last);
      if(type)transientAudio.later(()=>{if($('#poetTable')&&animationKey===actionKey)cut({text:type===1?'坊主':'姫',tone:type===1?'red':'gold',ms:1000});},240);
    }
    $('#poetScores').innerHTML=state.seats.map(p=>`<div class="seat ${p===active?'turn':''}"><span class="nm">${esc(p.name)}</span><b>${p.score}枚</b></div>`).join('');
  }
  function button(d) {
    const state=boardMatch.state;
    if(d.extraPoetPick!==undefined) return boardMatch.send('draw',{cell:+d.extraPoetPick,turn:state.version});
    if(d.extraPoetRules!==undefined) openSheet(`<h2>坊主めくり</h2><p>好きな山から1枚引きます。坊主を引くと手持ちの札を場に出し、姫を引くと場の札をすべてもらえます。最後に札が一番多い人が勝ちです。</p><div class="btns"><button class="btn" data-sheetback>閉じる</button></div>`);
  }
  const stop=()=>{clearTimeout(timer);stacks=null;};
  boardMatch.register('bozu',{initial,apply,changed,html,draw,button,stop});
  return {setup,setupHtml,start:()=>boardMatch.start('bozu',online,{}),face};
})();
