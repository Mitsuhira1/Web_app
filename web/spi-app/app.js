'use strict';
/* SPI試験対策 Web版 — Android版アプリのWeb移植（UI・動作は同一） */

/* ================= utilities ================= */
const $app = document.getElementById('app');
const $dialog = document.getElementById('dialog-root');
const LABELS = ['ア', 'イ', 'ウ', 'エ', 'オ'];
const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩';

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function shuffle(a) {
  const arr = a.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* Explanation markup: **bold**, **__..__** / __..__ -> bold + red thick underline,
   circled number right after an underlined span -> red superscript. (Same rules as the Android app.) */
function renderMarkup(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  const plain = (t) => esc(t).replace(/\n/g, '<br>');
  while (i < n) {
    if (src.startsWith('**__', i)) {
      const end = src.indexOf('__**', i + 4);
      if (end < 0) { out += plain('**__'); i += 4; continue; }
      out += '<span class="mk-u"><b>' + plain(src.substring(i + 4, end)) + '</b></span>';
      let next = end + 4;
      if (next < n && CIRCLED.includes(src[next])) { out += '<sup class="mk-num">' + src[next] + '</sup>'; next += 1; }
      i = next;
    } else if (src.startsWith('**', i)) {
      const end = src.indexOf('**', i + 2);
      if (end < 0) { out += plain('**'); i += 2; continue; }
      out += '<b>' + plain(src.substring(i + 2, end)) + '</b>';
      i = end + 2;
    } else if (src.startsWith('__', i)) {
      const end = src.indexOf('__', i + 2);
      if (end < 0) { out += plain('__'); i += 2; continue; }
      out += '<span class="mk-u"><b>' + plain(src.substring(i + 2, end)) + '</b></span>';
      let next = end + 2;
      if (next < n && CIRCLED.includes(src[next])) { out += '<sup class="mk-num">' + src[next] + '</sup>'; next += 1; }
      i = next;
    } else {
      out += plain(src[i]);
      i += 1;
    }
  }
  return out;
}

/* ================= icons (Material) ================= */
const ICONS = {
  back: '<svg class="icon" viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>',
  settings: '<svg class="icon" viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z"/></svg>',
  play: '<svg class="icon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
  timer: '<svg class="icon" viewBox="0 0 24 24"><path d="M15 1H9v2h6V1zm-4 13h2V8h-2v6zm8.03 2.61 1.42-1.42C21.51 16.13 22 14.14 22 12c0-4.97-4.03-9-9-9-1.19 0-2.32.23-3.36.66L12 5.64 9.64 3.66C8.6 3.23 7.47 3 6.28 3H6.5C3.47 3.97 1 6.9 1 10.28h2C3.27 7.75 5.05 5.6 7.5 5.05L9 6.26l-1.25 1.03C5.9 8.68 5 10.77 5 13a8 8 0 1 0 16 0c0-1.05-.2-2.05-.57-2.97l-1.4 1.58zM13 19a6 6 0 1 1 0-12 6 6 0 0 1 0 12z" transform="translate(-1.5 1) scale(0.94)"/></svg>'
};
function markSvg(status, marked) {
  if (marked) {
    return '<svg width="26" height="26" viewBox="0 0 26 26"><path d="M13 3.5 L23.5 22.5 L2.5 22.5 Z" fill="#9AA0A6"/></svg>';
  }
  if (status === 1) {
    return '<svg width="26" height="26" viewBox="0 0 26 26"><circle cx="13" cy="13" r="9.2" fill="none" stroke="#43A047" stroke-width="2.6"/></svg>';
  }
  if (status === 2) {
    return '<svg width="26" height="26" viewBox="0 0 26 26"><g stroke="#E53935" stroke-width="2.6" stroke-linecap="round"><line x1="6.5" y1="6.5" x2="19.5" y2="19.5"/><line x1="19.5" y1="6.5" x2="6.5" y2="19.5"/></g></svg>';
  }
  return '';
}

/* ================= persistent store (localStorage) ================= */
const store = {
  data: { s: {}, c: {}, m: {} },
  load() {
    try {
      const raw = localStorage.getItem('spiWebProgress');
      if (raw) this.data = Object.assign({ s: {}, c: {}, m: {} }, JSON.parse(raw));
    } catch (e) { /* ignore */ }
  },
  save() {
    try { localStorage.setItem('spiWebProgress', JSON.stringify(this.data)); } catch (e) { /* ignore */ }
  },
  status(id) { return this.data.s[id] || 0; },
  setStatus(id, v) { this.data.s[id] = v; this.save(); },
  lastChoice(id) { return (id in this.data.c) ? this.data.c[id] : null; },
  setLastChoice(id, v) { this.data.c[id] = v; this.save(); },
  isMarked(id) { return !!this.data.m[id]; },
  setMarked(id, v) { if (v) this.data.m[id] = true; else delete this.data.m[id]; this.save(); },
  resetAll() { this.data = { s: {}, c: {}, m: {} }; this.save(); }
};
const settings = {
  theme: 'dark',
  load() {
    try { this.theme = localStorage.getItem('spiWebTheme') || 'dark'; } catch (e) { /* ignore */ }
    if (this.theme !== 'light') this.theme = 'dark';
  },
  set(t) {
    this.theme = t;
    try { localStorage.setItem('spiWebTheme', t); } catch (e) { /* ignore */ }
    applyTheme();
  }
};
function applyTheme() {
  document.body.dataset.theme = settings.theme;
  document.querySelector('meta[name="theme-color"]').setAttribute(
    'content', settings.theme === 'dark' ? '#111318' : '#F8F9FA');
}

/* ================= question bank ================= */
let BANK = null; // { genres: [{name, topics:[{name, group, questions:[q]}], questions:[q]}], byId: Map }
function buildBank(root) {
  const genres = [];
  const byId = new Map();
  for (const g of root.genres) {
    const topics = [];
    const gQuestions = [];
    for (const grp of g.groups) {
      for (const t of grp.topics) {
        const qs = t.questions.map((q) => {
          const question = {
            id: q.id, genre: g.name, group: grp.name, topic: t.name,
            text: q.question, choices: q.choices, answerIndex: q.answerIndex,
            detailedExplanation: q.detailedExplanation || '',
            choicesOrderFixed: q.choicesOrderFixed !== false,
            passage: q.passage || null
          };
          byId.set(question.id, question);
          gQuestions.push(question);
          return question;
        });
        topics.push({ name: t.name, group: grp.name, genre: g.name, questions: qs });
      }
    }
    genres.push({ name: g.name, topics, questions: gQuestions });
  }
  return { genres, byId };
}

/* ================= router & history (back-button) handling =================
   Invariant: the in-app screen stack mirrors the browser history we pushed.
   - push()          : stack +1, history.pushState +1
   - in-app back     : history.back() -> popstate performs the stack change
   - browser/phone back: same popstate path (identical behavior to in-app back)
   - dialog open     : back closes the dialog and re-arms history
   - exam in progress: back opens the quit-confirm dialog (same as Android)
   - home (menu)     : back opens the exit-confirm dialog                    */
let stack = [];
let histDepth = 0;
let openDialog = null;   // { kind: string }
let pendingAction = null; // 'practiceNext' | 'examQuit'
let exiting = false;

function topScreen() { return stack[stack.length - 1]; }

function pushScreen(s) {
  stack.push(s);
  history.pushState({ spi: 1 }, '');
  histDepth++;
  render(true);
}
function goBack() { history.back(); }

window.addEventListener('popstate', () => {
  if (exiting) { showEndScreen(); return; }
  histDepth = Math.max(0, histDepth - 1);

  if (openDialog) {
    closeDialog();
    history.pushState({ spi: 1 }, '');
    histDepth++;
    return;
  }
  if (pendingAction === 'practiceNext') {
    pendingAction = null;
    stack.pop(); // explanation
    const cur = topScreen();
    const nx = makePractice(cur.topic, cur.index + 1);
    stack[stack.length - 1] = nx;
    render(true);
    return;
  }
  if (pendingAction === 'examQuit') {
    pendingAction = null;
    stopExamTimer();
    stack.pop(); // exam
    render(true);
    return;
  }
  const top = topScreen();
  if (top && top.name === 'exam' && top.session && !top.session.finished) {
    openQuitConfirm();
    history.pushState({ spi: 1 }, '');
    histDepth++;
    return;
  }
  if (top && top.name === 'examResult') {
    stack = [{ name: 'home' }];
    render(true);
    return;
  }
  if (stack.length > 1) {
    stack.pop();
    render(true);
    return;
  }
  // On the home (menu) screen: exit immediately, no confirmation.
  doExit();
});

function doExit() {
  exiting = true;
  // Jump past every entry we own (plus the base entry): if the user came
  // from another page this leaves the app; if the app was opened directly
  // the go() is a no-op and the fallback timer shows the end screen.
  history.go(-(histDepth + 1));
  setTimeout(() => { if (exiting) showEndScreen(); }, 400);
}

function showEndScreen() {
  stopExamTimer();
  closeDialog();
  $app.innerHTML =
    '<div class="end-screen"><div>' +
    '<div class="e-title">終了しました</div>' +
    '<div class="e-sub">ご利用ありがとうございました。<br>このタブ（ページ）を閉じて終了してください。</div>' +
    '</div></div>';
  $app.classList.remove('hidden');
}

/* ================= dialogs ================= */
function dialogHtml(title, text, confirmLabel, dismissLabel, confirmRed) {
  return '<div class="dialog-scrim" data-daction="scrim">' +
    '<div class="dialog" role="alertdialog" aria-modal="true">' +
    '<div class="d-title">' + esc(title) + '</div>' +
    (text ? '<div class="d-text">' + esc(text) + '</div>' : '') +
    '<div class="d-actions">' +
    '<button class="text-btn" data-daction="dismiss">' + esc(dismissLabel) + '</button>' +
    '<button class="text-btn' + (confirmRed ? ' red' : '') + '" data-daction="confirm">' + esc(confirmLabel) + '</button>' +
    '</div></div></div>';
}
function showDialog(kind, html) {
  openDialog = { kind };
  $dialog.innerHTML = html;
}
function closeDialog() {
  openDialog = null;
  $dialog.innerHTML = '';
}
function openQuitConfirm() {
  showDialog('quit', dialogHtml('試験を中断しますか？', 'ここまでの回答は破棄されます。', '中断する', '続ける', true));
}
function openExitConfirm() {
  showDialog('exit', dialogHtml('終了しますか？', 'アプリを終了します。', '終了する', 'キャンセル', false));
}
function openFinishConfirm(session) {
  const unanswered = session.items.length - Object.keys(session.answers).length;
  const text = unanswered > 0
    ? '未回答の問題が ' + unanswered + ' 問あります。終了すると採点されます。'
    : '全問回答済みです。終了すると採点されます。';
  showDialog('finish', dialogHtml('試験を終了しますか？', text, '終了する', '続ける', false));
}
function openResetConfirm() {
  showDialog('reset', dialogHtml('進捗を消去しますか？',
    'すべての問題の正解・不正解・△マークの記録が消えます。この操作は取り消せません。',
    '消去する', 'キャンセル', true));
}
function openGridDialog(session) {
  const pos = session.current;
  let cells = '';
  session.items.forEach((item, idx) => {
    const cls = idx === pos ? ' current' : (idx in session.answers ? ' answered' : '');
    cells += '<button class="grid-cell' + cls + '" data-daction="jump" data-pos="' + idx + '">' + (idx + 1) + '</button>';
  });
  showDialog('grid',
    '<div class="dialog-scrim" data-daction="scrim"><div class="dialog" role="dialog" aria-modal="true">' +
    '<div class="d-title">問題一覧</div>' +
    '<div class="grid-wrap">' + cells + '</div>' +
    '<div class="d-actions"><button class="text-btn" data-daction="dismiss">閉じる</button></div>' +
    '</div></div>');
}

$dialog.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-daction]');
  if (!el || !openDialog) return;
  const action = el.dataset.daction;
  const kind = openDialog.kind;
  if (action === 'jump') {
    const pos = parseInt(el.dataset.pos, 10);
    const top = topScreen();
    closeDialog();
    if (top && top.name === 'exam') {
      top.session.current = pos;
      render(false);
    }
    return;
  }
  if (action === 'dismiss' || action === 'scrim') {
    if (action === 'scrim' && ev.target !== el) return;
    closeDialog();
    return;
  }
  if (action === 'confirm') {
    if (kind === 'quit') {
      closeDialog();
      pendingAction = 'examQuit';
      history.back();
    } else if (kind === 'finish') {
      const top = topScreen();
      closeDialog();
      if (top && top.name === 'exam') finishExam(top.session);
    } else if (kind === 'reset') {
      closeDialog();
      store.resetAll();
      render(false);
    } else if (kind === 'exit') {
      closeDialog();
      doExit();
    }
  }
});

/* ================= shared components ================= */
function topBar(title, opts) {
  opts = opts || {};
  let actions = '';
  if (opts.settings) actions += '<button class="icon-btn" data-action="nav-settings" aria-label="設定">' + ICONS.settings + '</button>';
  if (opts.timerHtml) actions += opts.timerHtml;
  return '<div class="topbar">' +
    (opts.back ? '<button class="back-btn" data-action="' + (opts.backAction || 'back') + '" aria-label="戻る">' + ICONS.back + '</button>' : '') +
    '<div class="title">' + esc(title) + '</div>' +
    '<div class="actions">' + actions + '</div></div>';
}
function choiceRow(label, text, visual, action, didx) {
  const mark = visual === 'correct' ? '✓' : visual === 'wrongpick' ? '✕' : '';
  const attrs = action
    ? ' data-action="' + action + '" data-didx="' + didx + '"'
    : '';
  return '<button class="choice ' + visual + (action ? '' : ' static') + '"' + attrs + '>' +
    '<span class="clabel">' + esc(label) + '</span>' +
    '<span class="ctext">' + esc(text) + '</span>' +
    '<span class="cmark">' + mark + '</span></button>';
}
function passageCard(passage) {
  return '<div class="passage-card"><div class="p-label">本文</div>' +
    '<div class="p-body">' + esc(passage) + '</div></div>';
}
function progressBar(frac) {
  const pct = Math.max(0, Math.min(100, frac * 100));
  return '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%"></div></div>';
}

/* ================= screen factories ================= */
function makePractice(topic, index) {
  const q = topic.questions[index];
  const base = q.choices.map((_, i) => i);
  const order = q.choicesOrderFixed ? base : shuffle(base);
  const last = store.lastChoice(q.id);
  return {
    name: 'practice', topic, index, order,
    selectedDisplay: last === null ? null : order.indexOf(last)
  };
}

/* ================= renderers ================= */
function solvedCount(questions) {
  return questions.reduce((acc, q) => acc + (store.status(q.id) === 1 ? 1 : 0), 0);
}

function renderHome() {
  const total = BANK.genres.reduce((a, g) => a + g.questions.length, 0);
  const solved = BANK.genres.reduce((a, g) => a + solvedCount(g.questions), 0);
  let genreCards = '';
  BANK.genres.forEach((g, gi) => {
    const gs = solvedCount(g.questions);
    genreCards +=
      '<div class="card pad clickable genre-card" data-action="nav-genre" data-gi="' + gi + '">' +
      '<div class="genre-card-main"><span class="play">' + ICONS.play + '</span>' +
      '<span class="gname">' + esc(g.name) + '</span>' +
      '<span class="gcount">' + gs + ' / ' + g.questions.length + ' 問</span></div>' +
      progressBar(g.questions.length ? gs / g.questions.length : 0) +
      '</div>';
  });
  return topBar('SPI試験対策', { settings: true }) +
    '<div class="content top-gap">' +
    '<div class="section-title">ひたすら解く</div>' +
    '<div class="body-medium muted">全体の進捗： ' + solved + ' / ' + total + ' 問 正解</div>' +
    genreCards +
    '<div class="section-title">本番モード</div>' +
    '<div class="card pad clickable exam-card" data-action="nav-exam">' +
    '<div class="genre-card-main"><span class="play">' + ICONS.timer + '</span>' +
    '<span class="gname">模擬試験</span></div>' +
    '<div class="desc">全40問（言語20問・非言語20問）を制限時間70分で解きます。終了後に点数とランク（S〜E）を表示します。</div>' +
    '</div>' +
    '<div class="bottom-spacer"></div></div>';
}

function renderTopics(scr) {
  const genre = scr.genre;
  let html = topBar(genre.name, { back: true }) + '<div class="content top-gap">';
  let lastGroup = null;
  for (const t of genre.topics) {
    if (t.group !== lastGroup) {
      lastGroup = t.group;
      html += '<div class="group-header">' + esc(t.group) + '</div>';
    }
    const ts = solvedCount(t.questions);
    html +=
      '<div class="card topic-card clickable" data-action="nav-topic" data-tname="' + esc(t.name) + '">' +
      '<div class="row"><div class="tmain"><div class="tname">' + esc(t.name) + '</div>' +
      progressBar(t.questions.length ? ts / t.questions.length : 0) +
      '</div><div class="tcount">' + ts + ' / ' + t.questions.length + '</div></div></div>';
  }
  return html + '<div class="bottom-spacer"></div></div>';
}

function renderQList(scr) {
  const topic = scr.topic;
  let rows = '';
  topic.questions.forEach((q, i) => {
    rows += '<div class="qlist-row" data-action="nav-question" data-qi="' + i + '">' +
      '<span class="qno">問' + (i + 1) + '</span>' +
      '<span class="qtext">' + esc(q.text) + '</span>' +
      '<span class="mark-slot">' + markSvg(store.status(q.id), store.isMarked(q.id)) + '</span></div>';
  });
  return topBar(topic.name, { back: true }) +
    '<div class="content" style="gap:0">' + rows + '<div class="bottom-spacer"></div></div>';
}

function renderPractice(scr) {
  const q = scr.topic.questions[scr.index];
  const answered = scr.selectedDisplay !== null;
  const selectedOriginal = answered ? scr.order[scr.selectedDisplay] : null;
  const isCorrect = selectedOriginal === q.answerIndex;
  let choices = '';
  scr.order.forEach((origIdx, dispIdx) => {
    let visual = 'neutral';
    if (answered) {
      if (origIdx === q.answerIndex) visual = 'correct';
      else if (dispIdx === scr.selectedDisplay) visual = 'wrongpick';
      else visual = 'dimmed';
    }
    choices += choiceRow(LABELS[dispIdx], q.choices[origIdx], visual,
      answered ? null : 'answer-practice', dispIdx);
  });
  let banner = '';
  if (answered) {
    const ansDisp = scr.order.indexOf(q.answerIndex);
    banner =
      '<div class="banner ' + (isCorrect ? 'ok' : 'ng') + '">' +
      '<div class="b-title">' + (isCorrect ? '正解です！' : '不正解です') + '</div>' +
      '<div class="b-body">正解は' + LABELS[ansDisp] + 'の「' + esc(q.choices[q.answerIndex]) + '」です。</div></div>' +
      '<button class="btn block" data-action="show-explanation">解説を表示</button>';
  }
  return topBar(q.topic, { back: true }) +
    '<div class="content top-gap">' +
    '<div class="label-large muted">問 ' + (scr.index + 1) + ' / ' + scr.topic.questions.length +
    '（' + esc(q.genre) + '・' + esc(q.group) + '）</div>' +
    (q.passage ? passageCard(q.passage) : '') +
    '<div class="q-text pre-line">' + esc(q.text) + '</div>' +
    choices + banner +
    '<div class="bottom-spacer"></div></div>';
}

function explanationHtml(q, userChoice, showAnswerLine) {
  let choices = '';
  q.choices.forEach((c, idx) => {
    let visual = 'dimmed';
    if (idx === q.answerIndex) visual = 'correct';
    else if (idx === userChoice) visual = 'wrongpick';
    choices += choiceRow(LABELS[idx], c, visual, null, idx);
  });
  const answerLine = (userChoice !== null && userChoice !== undefined && userChoice !== q.answerIndex)
    ? '<div class="body-medium" style="color:var(--wrong)">あなたの回答：' +
      LABELS[userChoice] + 'の「' + esc(q.choices[userChoice]) + '」</div>'
    : '';
  return (q.passage ? passageCard(q.passage) : '') +
    '<div class="question-card"><div class="p-label">問題</div>' +
    '<div class="q-text pre-line">' + esc(q.text) + '</div></div>' +
    choices + answerLine +
    '<div class="title-medium bold">解説</div>' +
    '<div class="exp-text">' + renderMarkup(q.detailedExplanation) + '</div>' +
    '<div class="bottom-spacer-lg"></div>';
}

function renderExpP(scr) {
  const q = scr.topic.questions[scr.index];
  const marked = store.isMarked(q.id);
  const hasNext = scr.index < scr.topic.questions.length - 1;
  return topBar('解説', { back: true }) +
    '<div class="content top-gap">' + explanationHtml(q, scr.userChoice, true) + '</div>' +
    '<div class="bottombar">' +
    '<button class="btn outline' + (marked ? ' marked' : '') + '" data-action="toggle-mark">' +
    (marked ? '△ マーク済み' : '△ マークする') + '</button>' +
    (hasNext ? '<button class="btn" data-action="next-question">次の問題へ</button>' : '') +
    '</div>';
}

function renderExpE(scr) {
  const item = scr.session.items[scr.pos];
  const q = item.question;
  const userChoice = (scr.pos in scr.session.answers) ? scr.session.answers[scr.pos] : null;
  const marked = store.isMarked(q.id);
  return topBar('解説', { back: true }) +
    '<div class="content top-gap">' + explanationHtml(q, userChoice, true) + '</div>' +
    '<div class="bottombar">' +
    '<button class="btn outline' + (marked ? ' marked' : '') + '" data-action="toggle-mark">' +
    (marked ? '△ マーク済み' : '△ マークする') + '</button>' +
    '</div>';
}

function renderSettings() {
  const t = settings.theme;
  return topBar('設定', { back: true }) +
    '<div class="content top-gap">' +
    '<div class="title-medium bold">テーマ</div>' +
    '<label class="radio-row" data-action="theme" data-v="dark"><span class="radio' + (t === 'dark' ? ' on' : '') + '"></span>ダークモード</label>' +
    '<label class="radio-row" data-action="theme" data-v="light"><span class="radio' + (t === 'light' ? ' on' : '') + '"></span>ライトモード</label>' +
    '<div class="title-medium bold" style="margin-top:16px">学習データ</div>' +
    '<div class="reset-link" data-action="reset-progress">進捗（正解・不正解・△マーク）をすべて消去</div>' +
    '<div class="caption" style="margin-top:16px">SPI試験対策 バージョン 1.1\n収録問題数：983問（言語493問・非言語490問）</div>' +
    '<div class="bottom-spacer"></div></div>';
}

/* ================= exam ================= */
const EXAM_SECONDS = 70 * 60;
function createExamSession() {
  const verbal = BANK.genres.find((g) => g.name === '言語');
  const nonverbal = BANK.genres.find((g) => g.name === '非言語');
  const picked = shuffle(verbal.questions).slice(0, 20)
    .concat(shuffle(nonverbal.questions).slice(0, 20));
  const items = picked.map((q) => {
    const base = q.choices.map((_, i) => i);
    return { question: q, order: q.choicesOrderFixed ? base : shuffle(base) };
  });
  return { items, answers: {}, current: 0, remaining: EXAM_SECONDS, finished: false, lastTick: 0 };
}
function rankFor(p) {
  if (p >= 90) return 'S';
  if (p >= 80) return 'A';
  if (p >= 65) return 'B';
  if (p >= 50) return 'C';
  if (p >= 35) return 'D';
  return 'E';
}
function rankColor(r) {
  return { S: '#FFB300', A: '#43A047', B: '#1E88E5', C: '#FB8C00', D: '#8E24AA', E: '#757575' }[r];
}
function rankMessage(r) {
  return {
    S: '素晴らしい成績です。本番でも高得点が期待できます。',
    A: '優秀な成績です。合格圏内と言えます。',
    B: '良好な成績です。苦手分野を復習してさらに伸ばしましょう。',
    C: '平均的な成績です。間違えた問題の解説を確認しましょう。',
    D: '基礎の復習が必要です。練習モードで繰り返し解きましょう。',
    E: 'まずは練習モードで基礎から固めましょう。'
  }[r];
}
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + ':' + String(s).padStart(2, '0');
}

let examTimerId = null;
function stopExamTimer() {
  if (examTimerId !== null) { clearInterval(examTimerId); examTimerId = null; }
}
function startExamTimer(session) {
  stopExamTimer();
  session.lastTick = Date.now();
  examTimerId = setInterval(() => {
    const top = topScreen();
    if (!top || top.name !== 'exam' || top.session !== session || session.finished) {
      stopExamTimer();
      return;
    }
    const now = Date.now();
    if (now - session.lastTick >= 950) {
      session.lastTick = now;
      session.remaining = Math.max(0, session.remaining - 1);
      const el = document.getElementById('exam-timer');
      if (el) {
        el.textContent = '残り ' + formatTime(session.remaining);
        el.classList.toggle('low', session.remaining <= 300);
      }
      if (session.remaining <= 0) finishExam(session);
    }
  }, 200);
}
function finishExam(session) {
  session.finished = true;
  stopExamTimer();
  pushScreen({ name: 'examResult', session });
}

function renderExamIntro() {
  return topBar('本番モード', { back: true }) +
    '<div class="content top-gap">' +
    '<div class="card pad">' +
    '<div class="title-medium bold" style="margin-bottom:8px">模擬試験の内容</div>' +
    '<div class="body-large" style="line-height:27px">' +
    '・全40問（言語20問・非言語20問）が出題されます。<br>' +
    '・制限時間は70分です。時間切れになると自動で終了します。<br>' +
    '・言語20問のあと、非言語20問の順に出題されます（各分野内はランダム）。途中で問題を行き来できます。<br>' +
    '・終了後に点数とランク（S〜E）を表示します。' +
    '</div></div>' +
    '<button class="btn block" data-action="exam-start">試験を開始する</button>' +
    '<div class="bottom-spacer"></div></div>';
}

function renderExam(scr) {
  const session = scr.session;
  const pos = session.current;
  const item = session.items[pos];
  const q = item.question;
  const answeredCount = Object.keys(session.answers).length;
  const myAnswer = (pos in session.answers) ? session.answers[pos] : null;
  let choices = '';
  item.order.forEach((origIdx, dispIdx) => {
    const visual = myAnswer === origIdx ? 'selected' : 'neutral';
    choices += choiceRow(LABELS[dispIdx], q.choices[origIdx], visual, 'answer-exam', dispIdx);
  });
  const timerHtml = '<div class="timer' + (session.remaining <= 300 ? ' low' : '') + '" id="exam-timer">残り ' +
    formatTime(session.remaining) + '</div>';
  const isLast = pos === session.items.length - 1;
  return topBar('模擬試験', { back: true, backAction: 'exam-back', timerHtml }) +
    '<div class="content top-gap">' +
    '<div class="exam-head"><span class="h-label">問 ' + (pos + 1) + ' / ' + session.items.length +
    '（' + esc(q.genre) + '・' + esc(q.topic) + '）</span>' +
    '<button class="text-btn red" data-action="exam-finish">終了する</button></div>' +
    '<div class="progress-track thin"><div class="progress-fill" style="width:' +
    (answeredCount / session.items.length * 100) + '%"></div></div>' +
    '<div class="label-large muted">回答済み ' + answeredCount + ' / ' + session.items.length + ' 問</div>' +
    (q.passage ? passageCard(q.passage) : '') +
    '<div class="q-text pre-line">' + esc(q.text) + '</div>' +
    choices +
    '<div class="bottom-spacer"></div></div>' +
    '<div class="bottombar">' +
    '<button class="btn outline" data-action="exam-prev"' + (pos === 0 ? ' disabled' : '') + '>前へ</button>' +
    '<button class="btn outline" data-action="exam-grid">一覧</button>' +
    (isLast
      ? '<button class="btn" data-action="exam-finish">終了する</button>'
      : '<button class="btn" data-action="exam-next">次へ</button>') +
    '</div>';
}

function renderExamResult(scr) {
  const session = scr.session;
  const total = session.items.length;
  let correct = 0;
  session.items.forEach((item, idx) => {
    if (session.answers[idx] === item.question.answerIndex) correct++;
  });
  const percent = total === 0 ? 0 : correct * 100 / total;
  const rank = rankFor(percent);
  const byGenre = new Map();
  session.items.forEach((item, idx) => {
    const g = item.question.genre;
    if (!byGenre.has(g)) byGenre.set(g, { c: 0, t: 0 });
    const e = byGenre.get(g);
    e.t++;
    if (session.answers[idx] === item.question.answerIndex) e.c++;
  });
  let genreRows = '';
  byGenre.forEach((v, name) => {
    genreRows += '<div class="body-medium">' + esc(name) + '： ' + v.c + ' / ' + v.t + ' 問正解</div>';
  });
  let review = '';
  session.items.forEach((item, idx) => {
    const answered = idx in session.answers;
    const ok = answered && session.answers[idx] === item.question.answerIndex;
    const st = !answered ? 0 : ok ? 1 : 2;
    review += '<div class="review-row" data-action="review" data-pos="' + idx + '">' +
      '<span class="qno">問' + (idx + 1) + '</span>' +
      '<span class="qtext">' + esc(item.question.text) + '</span>' +
      '<span class="mark-slot">' + markSvg(st, false) + '</span></div>';
  });
  return topBar('試験結果', { back: true }) +
    '<div class="content top-gap">' +
    '<div class="card rank-card"><div class="label-large muted">ランク</div>' +
    '<div class="rank-letter" style="color:' + rankColor(rank) + '">' + rank + '</div>' +
    '<div class="rank-score">' + correct + ' / ' + total + ' 問正解（' + Math.round(percent) + '%）</div>' +
    '<div class="rank-msg">' + rankMessage(rank) + '</div></div>' +
    '<div class="card pad"><div class="title-small bold" style="margin-bottom:6px">分野別の結果</div>' + genreRows + '</div>' +
    '<div class="title-medium bold">問題の振り返り</div>' +
    '<div>' + review + '</div>' +
    '<div class="bottom-spacer"></div></div>';
}

/* ================= main render ================= */
function render(animate, preserveScroll) {
  const savedY = preserveScroll ? window.scrollY : 0;
  const top = topScreen();
  if (!top) return;
  let html = '';
  switch (top.name) {
    case 'home': html = renderHome(); break;
    case 'topics': html = renderTopics(top); break;
    case 'qlist': html = renderQList(top); break;
    case 'practice': html = renderPractice(top); break;
    case 'expP': html = renderExpP(top); break;
    case 'expE': html = renderExpE(top); break;
    case 'settings': html = renderSettings(); break;
    case 'examIntro': html = renderExamIntro(); break;
    case 'exam': html = renderExam(top); break;
    case 'examResult': html = renderExamResult(top); break;
  }
  $app.innerHTML = '<div class="screen' + (animate ? '' : ' no-anim') + '">' + html + '</div>';
  if (top.name === 'exam' && !top.session.finished) startExamTimer(top.session);
  else stopExamTimer();
  window.scrollTo(0, preserveScroll ? savedY : 0);
}

/* ================= app-level events ================= */
$app.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const action = el.dataset.action;
  const top = topScreen();
  switch (action) {
    case 'back': goBack(); break;
    case 'nav-settings': pushScreen({ name: 'settings' }); break;
    case 'nav-genre': {
      const g = BANK.genres[parseInt(el.dataset.gi, 10)];
      pushScreen({ name: 'topics', genre: g });
      break;
    }
    case 'nav-topic': {
      const t = top.genre.topics.find((x) => x.name === el.dataset.tname);
      if (t) pushScreen({ name: 'qlist', topic: t });
      break;
    }
    case 'nav-question': {
      pushScreen(makePractice(top.topic, parseInt(el.dataset.qi, 10)));
      break;
    }
    case 'nav-exam': pushScreen({ name: 'examIntro' }); break;
    case 'answer-practice': {
      const dispIdx = parseInt(el.dataset.didx, 10);
      const q = top.topic.questions[top.index];
      const origIdx = top.order[dispIdx];
      top.selectedDisplay = dispIdx;
      store.setStatus(q.id, origIdx === q.answerIndex ? 1 : 2);
      store.setLastChoice(q.id, origIdx);
      render(false, true);
      break;
    }
    case 'show-explanation': {
      const q = top.topic.questions[top.index];
      const userChoice = top.order[top.selectedDisplay];
      pushScreen({ name: 'expP', topic: top.topic, index: top.index, userChoice });
      break;
    }
    case 'toggle-mark': {
      const q = top.name === 'expP'
        ? top.topic.questions[top.index]
        : top.session.items[top.pos].question;
      store.setMarked(q.id, !store.isMarked(q.id));
      render(false, true);
      break;
    }
    case 'next-question': {
      pendingAction = 'practiceNext';
      history.back();
      break;
    }
    case 'theme': settings.set(el.dataset.v); render(false); break;
    case 'reset-progress': openResetConfirm(); break;
    case 'exam-start': pushScreen({ name: 'exam', session: createExamSession() }); break;
    case 'exam-back': openQuitConfirm(); break;
    case 'answer-exam': {
      const dispIdx = parseInt(el.dataset.didx, 10);
      top.session.answers[top.session.current] = top.session.items[top.session.current].order[dispIdx];
      render(false, true);
      break;
    }
    case 'exam-prev':
      if (top.session.current > 0) { top.session.current--; render(false); }
      break;
    case 'exam-next':
      if (top.session.current < top.session.items.length - 1) { top.session.current++; render(false); }
      break;
    case 'exam-grid': openGridDialog(top.session); break;
    case 'exam-finish': openFinishConfirm(top.session); break;
    case 'review': {
      pushScreen({ name: 'expE', session: top.session, pos: parseInt(el.dataset.pos, 10) });
      break;
    }
  }
});

/* ================= boot ================= */
(async function boot() {
  settings.load();
  applyTheme();
  store.load();
  const startedAt = Date.now();
  try {
    const res = await fetch('spi_bank.json');
    BANK = buildBank(await res.json());
  } catch (e) {
    document.querySelector('.splash-sub').textContent = '問題データの読み込みに失敗しました。通信環境を確認して再読み込みしてください。';
    return;
  }
  const wait = Math.max(0, 1100 - (Date.now() - startedAt));
  setTimeout(() => {
    history.replaceState({ spi: 0 }, '');
    // Guard entry: makes the first Back press on the home screen fire
    // popstate (exit confirm) instead of leaving the page immediately.
    history.pushState({ spi: 1 }, '');
    histDepth = 1;
    stack = [{ name: 'home' }];
    $app.classList.remove('hidden');
    render(true);
    const splash = document.getElementById('splash');
    splash.classList.add('fade');
    setTimeout(() => splash.remove(), 350);
  }, wait);
})();
