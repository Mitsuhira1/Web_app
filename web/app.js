// あそび箱30(試作)の画面。規則・CPU は worker.js 経由で Kotlin から作った JS を呼ぶ。
import { RENDER } from "./games.js";
import { tileArt } from "./art.js";
import * as mainCore from "./core/asobibako-web-core.mjs";
import { createNet } from "./net.js";
import { createSfx, moveSound, SHUFFLE_GAMES } from "./audio.js";
import { RENDER2 } from "./games2.js";
const RENDERERS = { ...RENDER, ...RENDER2 };
const PASS_MOVES = { reversi: 64, ludo: 99, backgammon: 999 };

const worker = new Worker("./worker.js", { type: "module" });
let seq = 1;
const pending = new Map();
let readyResolve;
const ready = new Promise((r) => (readyResolve = r));
worker.onmessage = (e) => {
  if (e.data.ready) return readyResolve();
  const p = pending.get(e.data.id);
  if (!p) return;
  pending.delete(e.data.id);
  e.data.error ? p.reject(new Error(e.data.error)) : p.resolve({ r: e.data.r, ms: e.data.ms });
};
worker.onerror = (e) => { document.getElementById("status").textContent = "読み込みに失敗しました:" + e.message; };
const callT = async (fn, ...args) => {
  await ready;
  return new Promise((resolve, reject) => {
    const id = seq++;
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, fn, args });
  });
};
const callW = async (fn, ...args) => (await callT(fn, ...args)).r;
let online = false; // 通信対戦中(部屋の計算は画面と同じスレッドの core で行う)
const call = async (fn, ...args) => (online && ONLINE_FNS.has(fn) ? mainCore[fn](...args) : callW(fn, ...args));
const ONLINE_FNS = new Set(["viewJson", "matchRecord"]);

const sfx = (() => { try { return createSfx(call); } catch { return { init: async () => {}, play() {}, enabled: true }; } })();
const $ = (id) => document.getElementById(id);
const THINK = [300, 800, 1500]; // 元のアプリと同じ(初級・中級・上級)
const PROTO = new Set(["reversi", "shogi", "gogo", "connect4", "gomoku", "hex", "mancala", "morris", "checkers", "chess", "dots", "hitblow", "hare", "chinese", "ludo", "backgammon", "go", "yacht", "sevens", "memory", "uno", "hanafuda", "poker", "holdem", "blackjack", "daifugo"]);
const store = {
  get(k, d) { try { const v = localStorage.getItem("asobi30." + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("asobi30." + k, JSON.stringify(v)); } catch {} },
};

// ---------------------------------------------------------------- 画面の切り替え・部品
const IC = {
  back: '<svg class="i" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  rules: '<svg class="i" viewBox="0 0 24 24"><path d="M5 4h9a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4z"/><path d="M9 9h6M9 13h5"/></svg>',
  undo: '<svg class="i" viewBox="0 0 24 24"><path d="M9 4L4 9l5 5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
  restart: '<svg class="i" viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/></svg>',
  chat: '<svg class="i" viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg>',
  games: '<svg class="i" viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>',
  people: '<svg class="i" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 14.2c3 .2 5.5 2.4 5.5 5.8"/></svg>',
  stats: '<svg class="i" viewBox="0 0 24 24"><path d="M5 20V11M12 20V5M19 20v-7"/></svg>',
  settings: '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>',
  play: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M8 5l11 7-11 7z" fill="currentColor"/></svg>',
};
const LEVEL = ["初級", "中級", "上級"];
function show(name) {
  for (const s of document.querySelectorAll(".screen")) s.classList.toggle("hidden", s.id !== name);
  window.scrollTo(0, 0);
}
function seg(el, items, value, onChange) {
  el.innerHTML = "";
  for (const [v, label] of items) {
    const b = document.createElement("button");
    b.textContent = label;
    b.setAttribute("aria-pressed", String(v === value));
    b.onclick = (e) => { e.stopPropagation(); onChange(v); seg(el, items, v, onChange); };
    el.appendChild(b);
  }
}
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const boxArt = (id) => tileArt(id);

// ---------------------------------------------------------------- 設定の値
function applyTheme(t) { if (t === "system") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", t); }
let theme = store.get("theme", "system");
applyTheme(theme);
let soundOn = store.get("sound", true);
sfx.enabled = soundOn;
let cpuLevel = store.get("cpu", 1);
let showHints = store.get("hints", true);
let pace = store.get("pace", 1); // CPUの手番の長さ 0短め 1普通 2長め
const PACE_MS = [250, 450, 800];

// ---------------------------------------------------------------- ホーム(ゲーム・みんなで遊ぶ・成績・設定)
let catalog = [];
let homeTab = 0, filter = store.get("filter", 0);
const NAV = [["ゲーム", IC.games], ["みんなで遊ぶ", IC.people], ["成績", IC.stats], ["設定", IC.settings]];
function showTab(i) {
  homeTab = i;
  ["tabGames", "tabTogether", "tabStats", "tabSettings"].forEach((id, k) => $(id).classList.toggle("hidden", k !== i));
  $("nav").innerHTML = NAV.map(([t, ic], k) => `<button role="tab" aria-selected="${k === i}" data-tab="${k}">${ic}<span>${t}</span></button>`).join("");
  $("nav").querySelectorAll("button").forEach((b) => (b.onclick = () => showTab(+b.dataset.tab)));
  if (i === 0) renderGames();
  if (i === 2) renderStats();
  if (i === 3) renderSettings();
  show("home");
}
const range = (players) => { const n = (players.match(/\d+/g) || ["2"]).map(Number); return [n[0], n[n.length - 1]]; };
const matchesFilter = (g) => { const [lo, hi] = range(g.players); return filter === 1 ? lo <= 2 && 2 <= hi : filter === 2 ? hi >= 3 : filter === 3 ? lo === 1 : true; };
function renderGames() {
  $("count").textContent = String(catalog.length);
  $("cpuChip").textContent = "CPU " + LEVEL[cpuLevel];
  renderContinue();
  seg($("filterSeg"), [[0, "すべて"], [3, "1人"], [1, "2人"], [2, "3人以上"]], filter, (v) => { filter = v; store.set("filter", v); renderGames(); });
  let html = "";
  for (const [cat, title] of [["BOARD", "ボードゲーム"], ["CARD", "カードゲーム"]]) {
    const games = catalog.filter((g) => g.category === cat && matchesFilter(g));
    if (!games.length) continue;
    html += `<div class="shelfhead"><b>${title}</b><i>${games.length}</i></div><div class="tiles">`;
    html += games.map((g) => `<button class="tile${PROTO.has(g.id) ? "" : " off"}" data-id="${g.id}"><div class="art">${boxArt(g.id)}</div><span class="nm">${esc(g.name)}</span><span class="pc">${esc(g.players)}</span></button>`).join("");
    html += "</div>";
  }
  $("shelf").innerHTML = html || '<p class="note">当てはまるゲームがありません</p>';
  $("shelf").querySelectorAll(".tile").forEach((b) => (b.onclick = () => openDetail(catalog.find((g) => g.id === b.dataset.id))));
}

// 続きから(途中の対局。1手も進んでいないものは出さない。新しい順に5つまで)
const savedList = () => store.get("saved", []).filter((s) => PROTO.has(s.id) && s.moves > 0).slice(0, 5);
function renderContinue() {
  const list = savedList();
  const box = $("continueBox");
  if (!list.length) { box.innerHTML = ""; return; }
  const name = (id) => (catalog.find((g) => g.id === id) || { name: id }).name;
  const [f, ...rest] = list;
  box.innerHTML = `<button class="cont" data-k="0"><div class="art">${boxArt(f.id)}</div><div style="min-width:0"><small>続きから</small><b>${esc(name(f.id))} ・ ${f.moves}手目</b></div><span class="go">${IC.play}</span></button>` +
    (rest.length ? `<div class="contsub">${rest.map((s, i) => `<button data-k="${i + 1}"><div class="art">${boxArt(s.id)}</div><div style="min-width:0"><b>${esc(name(s.id))}</b><small>${s.moves}手目</small></div></button>`).join("")}</div>` : "");
  box.querySelectorAll("[data-k]").forEach((b) => (b.onclick = () => resume(list[+b.dataset.k])));
}
let lastRecord = "";
function saveProgress() {
  if (online || !cur || h < 0 || !view || !lastRecord) return;
  const list = store.get("saved", []).filter((s) => s.id !== cur.id);
  if (!view.outcome && view.moves > 0) list.unshift({ id: cur.id, rec: lastRecord, moves: view.moves, mode, sub: playSubText(), opts: d ? d.opts : {} });
  store.set("saved", list.slice(0, 5));
}
async function resume(s) {
  cur = catalog.find((g) => g.id === s.id);
  if (!cur) return;
  online = false; token++; sel = null; mode = s.mode || "cpu";
  d = { opts: s.opts || {}, level: cpuLevel, mode, humans: 2, rotate: false, seat: 0, names: [] };
  h = await callW("restoreMatch", s.rec);
  if (h < 0) { toast("続きを読み込めませんでした"); return; }
  const v0 = JSON.parse(await call("viewJson", h, 0));
  mySeat = v0.mine >= 0 ? v0.mine : 0;
  lastSeat = mySeat;
  enterPlay(s.sub || "");
}

// 成績(CPUとの対戦の勝ち・負け・引き分け。ひとりで遊ぶゲームは遊んだ回数)
function recordStat(won, lost) {
  if (online || mode !== "cpu" || !view) return;
  const st = store.get("stats", {});
  const solo = view.seats.length === 1;
  const k = (solo ? "solo_" : "vs_") + cur.id;
  const a = st[k] || [0, 0, 0];
  if (solo) a[0]++; else if (won) a[0]++; else if (lost) a[1]++; else a[2]++;
  st[k] = a;
  store.set("stats", st);
}
function renderStats() {
  const st = store.get("stats", {});
  const rows = (prefix, fmt) => catalog.map((g) => [g, st[prefix + g.id]]).filter(([, a]) => a).map(([g, a]) => `<div class="row statrow"><div class="art">${boxArt(g.id)}</div><div class="k">${esc(g.name)}</div><div class="v">${fmt(a)}</div></div>`).join("");
  const vs = rows("vs_", (a) => { const n = a[0] + a[1] + a[2]; return `<b>勝率 ${n ? Math.round((a[0] * 100) / n) : 0}%</b>${a[0]}勝 ${a[1]}敗${a[2] ? ` ${a[2]}分` : ""}`; });
  const solo = rows("solo_", (a) => `<b>${a[0]}回</b>遊んだ`);
  $("tabStats").innerHTML = `<h1 class="tabttl">成績</h1><div class="pnlabel">CPUとの対戦</div><div class="panel">${vs || '<div class="row"><span class="note">記録なし</span></div>'}</div><div class="pnlabel">ひとりで</div><div class="panel">${solo || '<div class="row"><span class="note">記録なし</span></div>'}</div><div style="height:16px"></div><button class="bigbtn" id="clearStats">成績を消す</button>`;
  $("clearStats").onclick = () => {
    openSheet('<h2>成績を消しますか?</h2><div class="btns"><button class="main" id="csYes">消す</button><button id="csNo">やめる</button></div>');
    $("csYes").onclick = () => { store.set("stats", {}); closeSheet(); renderStats(); };
    $("csNo").onclick = closeSheet;
  };
}

// 設定の行の部品
function rowMini(label, items, value, onChange, sub) {
  const r = document.createElement("div");
  r.className = "row";
  r.innerHTML = `<div class="k">${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ""}</div><div class="mini"></div>`;
  seg(r.querySelector(".mini"), items, value, onChange);
  return r;
}
function rowSwitch(label, on, onChange, sub) {
  const r = document.createElement("div");
  r.className = "row";
  r.innerHTML = `<div class="k">${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ""}</div><button class="sw" role="switch" aria-checked="${on}" aria-label="${esc(label)}"></button>`;
  const b = r.querySelector(".sw");
  r.onclick = () => { on = !on; b.setAttribute("aria-checked", String(on)); onChange(on); };
  return r;
}
function panel(label, rows, off) {
  const frag = document.createDocumentFragment();
  const l = document.createElement("div"); l.className = "pnlabel" + (off ? " off" : ""); l.textContent = label;
  const p = document.createElement("div"); p.className = "panel" + (off ? " off" : "");
  rows.forEach((r) => r && p.appendChild(r));
  frag.append(l, p);
  return frag;
}
function renderSettings() {
  const t = $("tabSettings");
  t.innerHTML = '<h1 class="tabttl">設定</h1>';
  t.append(panel("テーマ", [rowMini("表示", [["light", "ライト"], ["dark", "ダーク"], ["system", "端末の設定"]], theme, (v) => { theme = v; store.set("theme", v); applyTheme(v); })]));
  t.append(panel("プレイ", [
    rowSwitch("置ける場所を表示", showHints, (v) => { showHints = v; store.set("hints", v); }, "リバーシ"),
    rowSwitch("効果音", soundOn, (v) => { soundOn = v; sfx.enabled = v; store.set("sound", v); if (v) sfx.play("TAP"); }),
    rowMini("CPUの手番の長さ", [[0, "短め"], [1, "普通"], [2, "長め"]], pace, (v) => { pace = v; store.set("pace", v); }),
    rowMini("CPUの強さ(初期選択)", [[0, "初級"], [1, "中級"], [2, "上級"]], cpuLevel, (v) => { cpuLevel = v; store.set("cpu", v); }),
  ]));
  const nameRow = document.createElement("div");
  nameRow.className = "row";
  nameRow.innerHTML = '<div class="k">名前</div><input class="txt" id="setName" maxlength="12" autocomplete="off">';
  const av = document.createElement("div");
  av.className = "row avrow";
  av.innerHTML = `${faceHtml(56)}<div class="avbtns"><button class="sbtn pri" id="avPick">写真を選ぶ</button>${avatar ? '<button class="sbtn" id="avClear">元に戻す</button>' : ""}<input type="file" id="avFile" accept="image/*" hidden></div>`;
  t.append(panel("プレイヤー", [nameRow, av]));
  $("avPick").onclick = () => $("avFile").click();
  $("avFile").onchange = (e) => { const f = e.target.files && e.target.files[0]; if (f) openCrop(f); e.target.value = ""; };
  if ($("avClear")) $("avClear").onclick = () => { avatar = null; store.set("avatar", null); renderSettings(); };
  $("setName").value = store.get("name", "あなた");
  $("setName").oninput = (e) => store.set("name", e.target.value);
  const lic = document.createElement("div"); lic.className = "row"; lic.innerHTML = '<div class="k">ライセンス</div><span class="note">›</span>'; lic.onclick = openLicenses;
  t.append(panel("このアプリについて", [lic]));
}

// ---------------------------------------------------------------- ゲームの設定(詳細)
let cur = null, d = null, mode = "cpu";
const isBool = (o) => o.values.length === 2 && o.values.every(([v]) => v === "true" || v === "false");
const fitsMini = (labels) => labels.length <= 3 && labels.join("").length <= 12;
async function openDetail(g) {
  cur = g;
  const prev = store.get("setup." + g.id, null);
  d = { opts: {}, level: cpuLevel, mode: "cpu", humans: 2, rotate: false, seat: 0, names: ["", "", "", "", "", ""], ...(prev || {}) };
  for (const o of g.options) if (d.opts[o.key] == null || !o.values.some(([v]) => v === d.opts[o.key])) d.opts[o.key] = o.default;
  $("detailBack").innerHTML = IC.back;
  $("detailRules").innerHTML = IC.rules + "<span>ルール</span>";
  show("detail");
  await renderDetail();
}
const engineOpts = () => cur.options.filter((o) => o.group !== "online").map((o) => `${o.key}=${d.opts[o.key] ?? o.default}`).sort().join(";");
async function renderDetail() {
  const g = cur;
  store.set("setup." + g.id, d);
  const body = $("detailBody");
  const y = body.scrollTop;
  const playable = PROTO.has(g.id);
  body.innerHTML = `<div class="hero"><div class="art">${boxArt(g.id)}</div><div><h2>${esc(g.name)}</h2><p>${esc(g.intro)}</p><div class="tags"><span>${esc(g.players)}</span><span>${g.category === "BOARD" ? "ボードゲーム" : "カードゲーム"}</span></div></div></div>`;
  $("startBtn").textContent = playable ? "スタート" : "準備中";
  $("startBtn").disabled = !playable;
  if (!playable) { body.insertAdjacentHTML("beforeend", '<p class="note">このゲームは Web 版ではまだ遊べません(準備中)。</p>'); return; }
  const total = await callW("seatCount", g.id, engineOpts());
  const solo = total === 1;
  const pass = d.mode === "pass";
  const canPass = range(g.players)[1] >= 2 && !["speed", "solitaire"].includes(g.id);
  const redraw = () => renderDetail();
  const save = () => store.set("setup." + g.id, d);
  if (canPass) {
    const l = document.createElement("div"); l.className = "pnlabel"; l.textContent = "遊び方";
    const s = document.createElement("div"); s.className = "segw";
    seg(s, [["cpu", "CPUと対戦"], ["pass", "手番ごとに交代"]], d.mode, (v) => { d.mode = v; redraw(); });
    body.append(l, s);
  }
  const ps = g.options.find((o) => o.key === "players");
  if (ps || !solo) {
    const rows = [];
    if (ps) {
      const vals = ps.values, idx = Math.max(0, vals.findIndex(([v]) => v === d.opts.players));
      const cpus = Math.max(0, total - (pass ? d.humans : 1));
      const r = document.createElement("div"); r.className = "row";
      r.innerHTML = `<div class="k">合計の人数${cpus ? `<small>CPU ${cpus}人</small>` : ""}</div><div class="step"><button aria-label="減らす" ${idx > 0 ? "" : "disabled"}>−</button><b>${esc(vals[idx][1])}</b><button aria-label="増やす" ${idx < vals.length - 1 ? "" : "disabled"}>＋</button></div>`;
      const [mi, pl] = r.querySelectorAll("button");
      mi.onclick = () => { d.opts.players = vals[idx - 1][0]; redraw(); };
      pl.onclick = () => { d.opts.players = vals[idx + 1][0]; redraw(); };
      rows.push(r);
    }
    if (!solo) {
      rows.push(rowMini("CPUの強さ", [[0, "初級"], [1, "中級"], [2, "上級"]], d.level, (v) => { d.level = v; save(); }));
      const so = [[0, g.seatNames[0]], [1, g.seatNames[1]], [-1, "ランダム"]];
      if (fitsMini(so.map((x) => x[1]))) rows.push(rowMini("手番", so, d.seat, (v) => { d.seat = v; save(); }));
      else { const r = document.createElement("div"); r.className = "row"; r.innerHTML = '<div class="k">手番</div>'; const b = document.createElement("div"); b.className = "rowbelow"; const s = document.createElement("div"); s.className = "segw"; seg(s, so, d.seat, (v) => { d.seat = v; save(); }); b.append(s); rows.push(r, b); }
    }
    body.append(panel("人数と相手", rows));
  }
  if (canPass) {
    d.humans = Math.min(Math.max(1, d.humans), total);
    const rows = [];
    const r = document.createElement("div"); r.className = "row";
    r.innerHTML = `<div class="k">交代する人${pass ? "" : "<small>「手番ごとに交代」を選ぶと変えられます</small>"}</div><div class="step"><button aria-label="減らす" ${d.humans > 1 ? "" : "disabled"}>−</button><b>${d.humans}人</b><button aria-label="増やす" ${d.humans < total ? "" : "disabled"}>＋</button></div>`;
    const [mi, pl] = r.querySelectorAll("button");
    mi.onclick = () => { d.humans--; redraw(); };
    pl.onclick = () => { d.humans++; redraw(); };
    rows.push(r);
    const one = document.createElement("div"); one.className = "row"; one.innerHTML = `<div class="k">1人目<small>表示名(設定で変更)</small></div><b>${esc(store.get("name", "あなた") || "プレイヤー1")}</b>`; rows.push(one);
    for (let i = 1; i < d.humans; i++) {
      const n = document.createElement("div"); n.className = "row"; n.innerHTML = `<div class="k">${i + 1}人目の名前</div><input class="txt" maxlength="12" autocomplete="off" style="width:150px">`;
      const inp = n.querySelector("input"); inp.value = d.names[i] || ""; inp.oninput = () => { d.names[i] = inp.value; save(); };
      rows.push(n);
    }
    rows.push(rowSwitch("手番ごとに画面を上下反対にする", d.rotate, (v) => { d.rotate = v; save(); }, "向かい合って座る時"));
    body.append(panel("手番ごとに交代", rows, !pass));
  }
  const optRow = (o) => {
    const val = d.opts[o.key] ?? o.default;
    const set = (v) => { d.opts[o.key] = v; redraw(); };
    if (isBool(o)) return [rowSwitch(o.label, val === "true", (v) => set(String(v)), o.hint || "")];
    if (fitsMini(o.values.map((x) => x[1]))) return [rowMini(o.label, o.values, val, set)];
    const r = document.createElement("div"); r.className = "row"; r.innerHTML = `<div class="k">${esc(o.label)}</div>`;
    const b = document.createElement("div"); b.className = "rowbelow"; const s = document.createElement("div"); s.className = "segw"; seg(s, o.values, val, set); b.append(s);
    return [r, b];
  };
  const ruleSpecs = g.options.filter((o) => o.key !== "players" && o.group === "rule");
  const localSpecs = g.options.filter((o) => o.group === "local");
  if (ruleSpecs.length || g.id === "reversi") {
    const rows = ruleSpecs.flatMap(optRow);
    if (g.id === "reversi") rows.push(rowSwitch("置ける場所を表示", showHints, (v) => { showHints = v; store.set("hints", v); }));
    body.append(panel("ルール", rows));
  }
  if (localSpecs.length) body.append(panel("ローカルルール", localSpecs.flatMap(optRow)));
  const ms = g.options.find((o) => o.key === "moveSeconds");
  if (ms) {
    const rows = optRow(ms);
    const tr = g.options.find((o) => o.key === "timeoutRule");
    if (tr && (d.opts.moveSeconds ?? ms.default) !== "0") rows.push(...optRow(tr));
    body.append(panel("時間", rows));
  }
  body.scrollTop = y;
}
$("detailBack").onclick = () => showTab(0);
$("detailRules").onclick = () => openRules(cur, "detail");
$("startBtn").onclick = () => startMatch(null);

// ---------------------------------------------------------------- ルール
let rulesReturn = "detail";
async function openRules(g, back) {
  rulesReturn = back;
  $("rulesBack").innerHTML = IC.back;
  $("rulesTitle").textContent = `${g.name}のルール`;
  const secs = JSON.parse(await callW("rulesJson", g.id));
  $("rulesBody").innerHTML = secs.map(([t, b]) => `<div class="rsec"><h3>${esc(t)}</h3><p>${esc(b)}</p></div>`).join("") || '<p class="note">ルールの説明はまだありません</p>';
  show("rules");
}
$("rulesBack").onclick = () => show(rulesReturn);

// ---------------------------------------------------------------- 対局
let h = -1, token = 0, view = null, mySeat = 0, sel = null, busy = false, thinkMs = 0, clock = null, lastSeat = 0;
const playSubText = () => (online ? "オンライン対戦" : mode === "pass" ? "手番ごとに交代" : "CPU " + LEVEL[d ? d.level : cpuLevel]);
async function startMatch(forceSeat) {
  online = false;
  token++;
  sel = null;
  mode = d.mode;
  let seat = forceSeat != null ? forceSeat : d.seat === -1 ? (Math.random() < 0.5 ? 0 : 1) : d.seat;
  const seed = String(Math.floor(Math.random() * 2 ** 40) + 1);
  if (mode === "pass") {
    const humans = Array.from({ length: d.humans }, (_, i) => i);
    const names = [store.get("name", "あなた") || "プレイヤー1", ...d.names.slice(1, d.humans).map((n, i) => n || `プレイヤー${i + 2}`)];
    h = await callW("newMatchNamed", cur.id, engineOpts(), seed, humans.join(","), d.level, names.join(","));
    seat = 0;
  } else h = await callW("newMatchNamed", cur.id, engineOpts(), seed, String(seat), d.level, store.get("name", "あなた") || "あなた");
  mySeat = seat;
  lastSeat = seat;
  enterPlay(playSubText());
}
function enterPlay(sub) {
  $("playBack").innerHTML = IC.back;
  $("playBox").innerHTML = boxArt(cur.id);
  $("playName").textContent = cur.name;
  $("playSub").textContent = sub;
  $("undoBtn").innerHTML = IC.undo + "<span>待った</span>"; $("undoBtn").setAttribute("aria-label", "待った");
  $("chatBtn").setAttribute("aria-label", "チャット"); $("playRules").setAttribute("aria-label", "ルール"); $("restartBtn").setAttribute("aria-label", "最初から");
  $("chatBtn").innerHTML = IC.chat + "<span>チャット</span>";
  $("playRules").innerHTML = IC.rules + "<span>ルール</span>";
  $("restartBtn").innerHTML = IC.restart + "<span>最初から</span>";
  $("resultPanel").classList.add("hidden");
  $("dev").textContent = "";
  busy = false;
  closeSheet();
  show("play");
  if (SHUFFLE_GAMES.has(cur.id)) setTimeout(() => sfx.play("SHUFFLE"), 250);
  refresh();
}
$("playBack").onclick = () => { token++; stopClock(); closeSheet(); $("resultPanel").classList.add("hidden"); if (online) leaveOnline(); else showTab(0); };
$("playRules").onclick = () => openRules(cur, "play");
$("restartBtn").onclick = () => {
  openSheet('<h2>最初からやり直しますか?</h2><div class="note">いまの対局は消えます。</div><div class="btns"><button class="main" id="rsYes">やり直す</button><button id="rsNo">続ける</button></div>');
  $("rsYes").onclick = () => { closeSheet(); startMatch(lastSeat); };
  $("rsNo").onclick = closeSheet;
};
$("undoBtn").onclick = async () => {
  if (online) { mainCore.onlineRequestUndo(); return; }
  if (busy) return;
  token++;
  busy = false;
  stopClock();
  await call("undoMove", h);
  sel = null;
  $("resultPanel").classList.add("hidden");
  await refresh();
};

async function refresh() {
  const my = token;
  view = JSON.parse(await call("viewJson", h, mySeat));
  if (my !== token) return;
  if (!online) lastRecord = await call("matchRecord", h);
  // 手番ごとに交代: いま番の人から見た画面にする
  if (mode === "pass" && view.human && view.toMove >= 0 && view.toMove !== mySeat) { mySeat = view.toMove; view = JSON.parse(await call("viewJson", h, mySeat)); }
  $("play").style.transform = mode === "pass" && d && d.rotate && view.seats.length === 2 && mySeat % 2 === 1 ? "rotate(180deg)" : "";
  render();
  saveProgress();
  if (view.outcome) { stopClock(); return showResult(); }
  if (view.human) {
    // 動かせる手が「パス」しかない時は、自動で指す
    const pm = PASS_MOVES[cur.id];
    if (pm != null && view.legal.length === 1 && view.legal[0] === pm) {
      setStatus("動かせないので、パスします");
      await new Promise((r) => setTimeout(r, 1100));
      if (my !== token) return;
      if (online) mainCore.onlinePlay(h, pm); else await call("playMove", h, pm);
      return refresh();
    }
    startClock(my);
    return;
  }
  stopClock();
  if (online && view.remote) { busy = false; render(); return; }
  cpuTurn(my);
}
async function cpuTurn(my) {
  busy = true;
  render();
  const t0 = performance.now();
  const lvl = view.seats[view.toMove] ? view.seats[view.toMove].level : cpuLevel;
  let mv, ms, hw = h;
  if (online) { // ホストの CPU の席。思考は Worker で、確定は通信の部屋で
    hw = await callW("restoreMatch", mainCore.matchRecord(h));
    ({ r: mv, ms } = await callT("cpuChoose", hw, THINK[lvl]));
    await callW("dropMatch", hw);
  } else ({ r: mv, ms } = await callT("cpuChoose", h, THINK[lvl]));
  thinkMs = ms;
  const wait = PACE_MS[pace] - (performance.now() - t0);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  if (my !== token) return; // 別の対局に変わった(「考え中」の印は新しい対局の側で消してある)
  busy = false;
  if (online) mainCore.onlineCpuPlay(h, mv); else await call("playMove", h, mv);
  playMoveSound(mv);
  await refresh();
}
async function humanMove(m) {
  if (!view.human || busy) return;
  sel = null;
  stopClock();
  const my = token;
  const ok = online ? mainCore.onlinePlay(h, m) : await call("playMove", h, m);
  if (ok) playMoveSound(m);
  if (my === token) await refresh();
}

// 制限時間(元のアプリと同じ: 自分の番で残り10秒から音、0で「ランダムな一手」か「負け」)
function stopClock() { if (clock) { clearInterval(clock.t); clock = null; } }
function startClock(my) {
  stopClock();
  const total = online ? 0 : +((d && d.opts.moveSeconds) || 0);
  if (!total) { renderTurnRow(); return; }
  clock = { left: total, t: null };
  renderTurnRow();
  clock.t = setInterval(async () => {
    if (my !== token || !clock) return stopClock();
    clock.left--;
    if (clock.left > 0 && clock.left <= 10) sfx.play(clock.left <= 3 ? "COUNT_LAST" : "COUNT");
    renderTurnRow();
    if (clock.left <= 0) {
      stopClock();
      sfx.play("TIMEUP");
      toast(d.opts.timeoutRule === "lose" && view.seats.length === 2 ? "時間切れです" : "時間切れなので、かわりに一手進めます");
      await call("timeoutPlay", h, d.opts.timeoutRule === "lose");
      if (my === token) refresh();
    }
  }, 1000);
}
function renderTurnRow() {
  if (!view) return;
  const txt = clock ? `<span class="clock${clock.left <= 10 ? " low" : ""}">残り ${clock.left} 秒</span>` : "<span>制限時間なし</span>";
  const res = view.canResign ? `<button class="resign" id="resignBtn" ${view.outcome || !view.human || busy ? "disabled" : ""}>降参</button>` : "";
  $("turnRow").innerHTML = txt + res;
  if ($("resignBtn")) $("resignBtn").onclick = () => {
    openSheet('<h2>降参しますか？</h2><div class="note">この対局はあなたの負けになります。</div><div class="btns"><button class="main" id="rgYes">降参する</button><button id="rgNo">対局を続ける</button></div>');
    $("rgYes").onclick = async () => { closeSheet(); stopClock(); if (online) mainCore.onlineResign(); else await call("resignMatch", h, mySeat); refresh(); };
    $("rgNo").onclick = closeSheet;
  };
}
const setStatus = (t) => { $("status").innerHTML = t ? `<span>${esc(t)}</span>` : ""; };

const PLATE = new Set(["reversi", "mancala", "dots", "gomoku", "hex", "morris", "hare", "checkers", "chess", "shogi", "gogo", "backgammon", "ludo", "chinese", "go"]);
function render() {
  const b = view.board;
  $("undoBtn").classList.toggle("hidden", online ? !ost : !(view.undoAllowed && view.seats.some((s) => !s.human)));
  $("undoBtn").disabled = online ? !(ost && ost.undoOk) || busy || view.moves === 0 || !!(ost && ost.undoAsk) : busy || view.moves === 0;
  $("chatBtn").classList.toggle("hidden", !online);
  $("chatBtn").disabled = !(ost && ost.chatOk);
  $("restartBtn").classList.toggle("hidden", online);
  $("acts").innerHTML = "";
  $("strip").innerHTML = "";
  if (!b) return;
  if (RENDERERS[b.kind]) RENDERERS[b.kind](b, api());
  else if (b.kind === "reversi") renderReversi(b);
  else renderShogi(b);
  setStatus(statusText(b));
  renderTurnRow();
}
function statusText(b) {
  if (view.outcome) return "";
  if (online && view.remote) return `${view.seats[view.toMove].name}の番です`;
  if (!view.human) return busy ? "CPUが考えています…" : "";
  switch (b.kind) {
    case "mancala": return b.extra ? "倉に入りました。もう1回まけます" : "あなたの番です";
    case "hitblow": case "yacht": return "";
    case "morris": return b.removing ? "ミル! 取る相手のコマ(赤い輪)を選んでください" : b.inHand[b.turn] > 0 ? `空いている点に置いてください(あと${b.inHand[b.turn]}個)` : "動かすコマを選び、行き先を選んでください";
    case "hex": return b.turn === 0 ? "赤の番: 上と下をつなぎます" : "青の番: 左と右をつなぎます";
    case "hare": return b.turn === 0 ? "猟犬を選んで動かします(左へは戻れません)" : "ウサギを選んで動かします";
    case "checkers": return b.paths.some((p) => Math.abs(Math.floor(p[0] / 8) - Math.floor(p[1] / 8)) === 2) ? "取れるコマがあります(必ず取ります)" : "あなたの番です";
    case "backgammon": return b.dice.length ? "動かす駒を選び、行き先を選んでください" : "サイコロを振ってください";
    case "ludo": return b.die ? `${b.die}が出ました。動かす駒を選んでください` : "サイコロを振ってください";
    case "shogi": return b.check ? "王手です" : "あなたの番です";
    case "chess": return b.check ? "チェックされています" : "あなたの番です";
    default: return mode === "pass" ? `${view.seats[view.toMove].name}の番です` : "あなたの番です";
  }
}
function api() {
  return {
    mySeat, view,
    name: (seat) => (seat === mySeat && mode !== "pass" ? "あなた" : view.seats[seat] && (view.seats[seat].human || view.seats[seat].remote) ? view.seats[seat].name : "CPU"),
    note: (seat) => { const s = view.seats[seat]; if (!s) return ""; if (seat === view.toMove && s.human) return "あなたの番"; if (seat === view.toMove && busy) return "考えています…"; if (!s.human && !s.remote) return LEVEL[s.level]; return cur.seatNames[seat] || ""; },
    strip: (html) => { $("strip").innerHTML = html; },
    board: (svg, onTap) => {
      const wrap = $("boardwrap");
      wrap.innerHTML = PLATE.has(cur.id) && svg.startsWith("<svg") ? `<div class="plate">${svg}</div>` : svg;
      wrap.onclick = (e) => { if (!busy) onTap(e.target.dataset || {}, e.target); };
    },
    acts: (list) => {
      const box = $("acts");
      box.innerHTML = "";
      for (const a of list) {
        const bt = document.createElement("button");
        bt.textContent = a.label;
        bt.disabled = !a.enabled || !view.human || busy;
        bt.onclick = () => humanMove(a.move);
        box.appendChild(bt);
      }
    },
    play: humanMove, redraw: render,
    sheet: (html, init) => { openSheet(html); if (init) init($("sheet")); }, closeSheet,
    get sel() { return sel; }, set sel(v) { sel = v; },
    get hints() { return showHints; },
    face: (size) => faceHtml(size, (store.get("name", "あなた") || "あ").slice(0, 1)),
  };
}
function playMoveSound(m) {
  const r = moveSound(cur.id, m);
  if (r) sfx.play(r[0], r[1] || {});
}

let resultSounded = -1;
function showResult() {
  const o = view.outcome;
  const pass = mode === "pass" && view.seats.filter((s) => s.human).length >= 2;
  const solo = view.seats.length === 1;
  const win = o.winner === mySeat || (solo && o.winner === 0);
  if (resultSounded !== token * 1000 + view.moves) {
    resultSounded = token * 1000 + view.moves;
    sfx.play(pass ? (o.winner < 0 ? "DRAW" : "WIN") : win ? "WIN" : o.winner < 0 ? "DRAW" : "LOSE");
    recordStat(win, !win && o.winner >= 0);
  }
  const title = pass ? (o.winner < 0 ? "引き分け" : `${view.seats[o.winner].name}の勝ち`) : solo && cur.id === "hitblow" ? (o.winner === 0 ? "正解!" : "終了") : solo && cur.id === "blackjack" ? (o.winner === 0 ? "勝ち" : o.winner < 0 ? "引き分け" : "負け") : solo ? "結果" : o.winner < 0 ? "引き分け" : win ? "勝利" : "敗北";
  const sc = view.scores && view.scores.length === 2 && !pass && cur.id !== "hitblow" ? `<div class="score">${view.scores[mySeat]} - ${view.scores[1 - mySeat]}</div>` : "";
  const p = $("resultPanel");
  if (online) {
    // 元のアプリと同じ: 再戦の準備を集める(ホストは参加者を確認して始める)/同じ部屋でほかのゲーム
    const ready = ost ? ost.ready.length : 0, total = ost ? ost.members.length : 0;
    const mineReady = ost && ost.ready.includes(ost.mySlot);
    p.innerHTML = `<div class="box"><div class="head"><div style="flex:1"><div class="ttl2${win ? " win" : ""}">${title}</div>${o.reason ? `<div class="why">${esc(o.reason)}</div>` : ""}</div>${sc}</div><div class="why">再戦の準備 ${ready}/${total}人</div><button class="bigbtn primary" id="rAgain" ${!isHostRoom() && mineReady ? "disabled" : ""}>${isHostRoom() ? "もう一度・参加者を確認" : mineReady ? "準備OK・ホストを待っています" : "もう一度"}</button><button class="bigbtn" id="rLobby">同じ部屋でほかのゲーム</button></div>`;
    p.classList.remove("hidden");
    $("rAgain").onclick = () => {
      mainCore.onlineAgain();
      if (!isHostRoom()) return;
      const names = () => ost.members.filter((m) => m.slot === ost.mySlot || ost.ready.includes(m.slot)).map((m) => esc(m.name)).join("・");
      openSheet(`<h2>もう一度</h2><div class="note" id="readyNames">準備ができた人: ${names()}</div><div class="btns"><button class="main" id="rgo">この人たちで始める</button><button id="rwait">待つ</button></div>`);
      $("rgo").onclick = () => { closeSheet(); mainCore.onlineStartReady(String(Math.floor(Math.random() * 2 ** 40) + 1)); };
      $("rwait").onclick = closeSheet;
    };
    $("rLobby").onclick = () => mainCore.onlineBackToLobby();
    return;
  }
  const two = view.seats.length === 2 && !pass;
  p.innerHTML = `<div class="box"><div class="head"><div style="flex:1"><div class="ttl2${win || pass ? " win" : ""}">${esc(title)}</div>${o.reason ? `<div class="why">${esc(o.reason)}</div>` : ""}</div>${sc}</div><div class="${two ? "two" : ""}"><button class="bigbtn primary" id="rAgain">もう一度</button>${two ? `<button class="bigbtn" id="rOther">${mySeat === 0 ? "後攻" : "先攻"}でもう一度</button>` : ""}</div><button class="bigbtn" id="rHome">ホーム</button></div>`;
  p.classList.remove("hidden");
  $("rAgain").onclick = () => { p.classList.add("hidden"); startMatch(lastSeat); };
  if ($("rOther")) $("rOther").onclick = () => { p.classList.add("hidden"); startMatch(1 - lastSeat); };
  $("rHome").onclick = () => { p.classList.add("hidden"); showTab(0); };
}
function openSheet(html, lock) { $("sheet").innerHTML = html; $("modal").dataset.lock = lock ? "1" : ""; $("modal").classList.remove("hidden"); }
$("modal").onclick = (e) => { if (e.target === $("modal") && !$("modal").dataset.lock) closeSheet(); };
function closeSheet() { $("modal").classList.add("hidden"); }

// ---------------------------------------------------------------- リバーシ
function renderReversi(b) {
  const my = mySeat;
  const A0 = api();
  const stripHtml = (seat, color, count) =>
    `<div class="pl${view.toMove === seat && !view.outcome ? " turn" : ""}"><span class="dot" style="background:${color}"></span><span class="who"><span class="nm">${A0.name(seat)}</span><span class="nt">${A0.note(seat)}</span></span><span class="num">${count}</span></div>`;
  $("strip").innerHTML = stripHtml(0, "#15151A", b.black) + stripHtml(1, "#F6F2E8;border:1px solid #B9AC8C", b.white);
  const legal = new Set(view.human && showHints ? view.legal : []);
  const canTap = new Set(view.human ? view.legal : []);
  let s = `<svg viewBox="0 0 84 84" role="img" aria-label="リバーシの盤">
  <defs>
    <radialGradient id="gB" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#6b6b72"/><stop offset=".35" stop-color="#2a2a30"/><stop offset="1" stop-color="#0c0c10"/></radialGradient>
    <radialGradient id="gW" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#ece7d9"/><stop offset="1" stop-color="#bdb59f"/></radialGradient>
  </defs>
  <rect x="0" y="0" width="84" height="84" rx="3" fill="#5A3A22"/>
  <rect x="2" y="2" width="80" height="80" fill="#2C6B4D"/>`;
  for (let i = 0; i <= 8; i++) s += `<path d="M${2 + i * 10} 2V82M2 ${2 + i * 10}H82" stroke="#17402D" stroke-width=".35"/>`;
  for (let i = 0; i < 64; i++) {
    const r = Math.floor(i / 8), c = i % 8, x = 2 + c * 10, y = 2 + r * 10;
    const v = b.cells[i];
    if (v) {
      s += `<circle cx="${x + 5.4}" cy="${y + 5.9}" r="4.1" fill="#000" opacity=".3"/><circle cx="${x + 5}" cy="${y + 5}" r="4.1" fill="url(#${v === 1 ? "gB" : "gW"})"/>`;
    } else if (legal.has(i)) s += `<circle cx="${x + 5}" cy="${y + 5}" r="1.3" fill="#FFFDF5" opacity=".8"/>`;
    if (b.last === i) s += `<circle cx="${x + 5}" cy="${y + 5}" r="4.9" fill="none" stroke="#E0AD4A" stroke-width=".7"/>`;
    s += `<rect x="${x}" y="${y}" width="10" height="10" fill="transparent" data-i="${i}"/>`;
  }
  s += "</svg>";
  const wrap = $("boardwrap");
  wrap.innerHTML = s;
  wrap.onclick = (e) => {
    const i = e.target.dataset && e.target.dataset.i;
    if (i == null) return;
    if (view.human && canTap.has(+i)) humanMove(+i);
  };
}

// ---------------------------------------------------------------- 将棋
const KIND_TXT = { 1: "歩", 2: "香", 3: "桂", 4: "銀", 5: "金", 6: "角", 7: "飛", 8: "玉", 9: "と", 10: "杏", 11: "圭", 12: "全", 13: "馬", 14: "龍" };
const HAND_ORDER = [7, 6, 5, 4, 3, 2, 1];
const mFrom = (m) => (m >> 1) >> 7, mTo = (m) => (m >> 1) & 127, mPromo = (m) => m & 1;

function piece(cx, cy, s, kind, owner, flipOwner, selected) {
  const rot = flipOwner ? ` transform="rotate(180 ${cx} ${cy})"` : "";
  const P = (dx, dy) => `${(cx + dx * s).toFixed(2)},${(cy + dy * s).toFixed(2)}`;
  const pts = [P(0, -.46), P(.32, -.30), P(.40, .44), P(-.40, .44), P(-.32, -.30)].join(" ");
  const sh = [P(0, -.46 + .05), P(.32, -.30 + .05), P(.40, .44 + .05), P(-.40, .44 + .05), P(-.32, -.30 + .05)].join(" ");
  const txt = kind === 8 && owner === 1 ? "王" : KIND_TXT[kind];
  const red = kind >= 9 ? "#B3261E" : "#1b140d";
  return `<g${rot}><polygon points="${sh}" fill="#B98F4C"/><polygon points="${pts}" fill="url(#gK)" stroke="${selected ? "#B98318" : "#8A6A35"}" stroke-width="${selected ? 0.9 : 0.35}"/><text class="kp" x="${cx}" y="${(cy + s * .22).toFixed(2)}" font-size="${(s * .56).toFixed(2)}" text-anchor="middle" fill="${red}">${txt}</text></g>`;
}

function renderShogi(b) {
  const W = b.w, N = W * W, C = 10, M = 2, HB = 11;
  const flip = mySeat === 1;
  const disp = (i) => { const r = Math.floor(i / W), c = i % W; return flip ? [W - 1 - r, W - 1 - c] : [r, c]; };
  const bottomSide = mySeat; // 下に座る側は自分
  const top = 1 - mySeat;
  const A1 = api();
  const tag = (seat) => `<div class="pl${view.toMove === seat && !view.outcome ? " turn" : ""}"><span class="dot" style="background:linear-gradient(#F3DCA8,#DEBA74);border-radius:4px"></span><span class="who"><span class="nm">${A1.name(seat)}</span><span class="nt">${seat === 0 ? "先手" : "後手"}${view.toMove === seat && view.human ? "・あなたの番" : ""}</span></span></div>`;
  $("strip").innerHTML = tag(mySeat) + tag(top);
  const size = W * C + M * 2;
  const height = size + HB * 2;
  let s = `<svg viewBox="0 0 ${size} ${height}" role="img" aria-label="将棋の盤"><defs><linearGradient id="gK" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F3DCA8"/><stop offset="1" stop-color="#DEBA74"/></linearGradient></defs>`;
  const oy = HB; // 盤の上端
  s += `<rect x="0" y="${oy}" width="${size}" height="${size}" rx="1.5" fill="#D9B77A"/><rect x="${M}" y="${oy + M}" width="${W * C}" height="${W * C}" fill="#E6C98F"/>`;
  for (let i = 0; i <= W; i++) s += `<path d="M${M + i * C} ${oy + M}V${oy + M + W * C}M${M} ${oy + M + i * C}H${M + W * C}" stroke="#6b4e25" stroke-width=".3"/>`;
  if (W === 9) for (const r of [3, 6]) for (const c of [3, 6]) s += `<circle cx="${M + c * C}" cy="${oy + M + r * C}" r=".7" fill="#6b4e25"/>`;
  // 選択と行き先
  const targets = new Map(); // 行き先のマス -> 手の一覧
  if (sel && view.human) for (const m of view.legal) if (mFrom(m) === sel.from) { const t = mTo(m); (targets.get(t) || targets.set(t, []).get(t)).push(m); }
  const cx = (i) => { const [, c] = disp(i); return M + c * C + C / 2; };
  const cy = (i) => { const [r] = disp(i); return oy + M + r * C + C / 2; };
  if (b.last >= 0) { const t = mTo(b.last); s += `<rect x="${cx(t) - C / 2}" y="${cy(t) - C / 2}" width="${C}" height="${C}" fill="#E0AD4A" opacity=".35"/>`; }
  for (let i = 0; i < N; i++) {
    const v = b.cells[i];
    if (!v) continue;
    const kind = Math.abs(v), owner = v > 0 ? 0 : 1;
    const isSel = sel && sel.from === i;
    s += piece(cx(i), cy(i), C, kind, owner, owner !== bottomSide, isSel);
  }
  for (const [t] of targets) s += `<circle cx="${cx(t)}" cy="${cy(t)}" r="1.5" fill="#B98318" opacity=".9"/>`;
  for (let i = 0; i < N; i++) s += `<rect x="${cx(i) - C / 2}" y="${cy(i) - C / 2}" width="${C}" height="${C}" fill="transparent" data-i="${i}"/>`;
  // 持ち駒
  const handRow = (side, yTop) => {
    let x = M + 1;
    let out = "";
    const hs = 8;
    for (const k of HAND_ORDER) {
      const n = b.hands[side * 8 + k];
      if (!n) continue;
      const mine = side === mySeat;
      const isSel = sel && sel.from === N + k && mine;
      out += piece(x + hs / 2, yTop + HB / 2, hs + 1.5, k, side, side !== bottomSide, isSel);
      if (n > 1) out += `<text x="${x + hs - .2}" y="${yTop + HB - 1.2}" font-size="3.4" font-weight="700" fill="#3a2a16" text-anchor="end">${n}</text>`;
      if (mine) out += `<rect x="${x - .5}" y="${yTop}" width="${hs + 1}" height="${HB}" fill="transparent" data-hand="${k}"/>`;
      x += hs + 2.4;
    }
    return out;
  };
  s += handRow(top, 0);
  s += handRow(bottomSide, oy + size);
  s += "</svg>";
  const wrap = $("boardwrap");
  wrap.innerHTML = s;
  wrap.onclick = (e) => {
    if (!view.human || busy) return;
    const d = e.target.dataset || {};
    if (d.hand != null) {
      const k = +d.hand;
      sel = sel && sel.from === N + k ? null : view.legal.some((m) => mFrom(m) === N + k) ? { from: N + k } : null;
      return render();
    }
    if (d.i == null) return;
    const i = +d.i;
    const ms = sel ? view.legal.filter((m) => mFrom(m) === sel.from && mTo(m) === i) : [];
    if (ms.length === 1) return humanMove(ms[0]);
    if (ms.length === 2) {
      const pro = ms.find((m) => mPromo(m)), no = ms.find((m) => !mPromo(m));
      openSheet(`<h2>成りますか</h2><div class="btns"><button class="main" id="pY">成る</button><button id="pN">成らない</button></div>`);
      $("pY").onclick = () => { closeSheet(); humanMove(pro); };
      $("pN").onclick = () => { closeSheet(); humanMove(no); };
      return;
    }
    const v = b.cells[i];
    const own = v !== 0 && (v > 0 ? 0 : 1) === mySeat;
    sel = own && view.legal.some((m) => mFrom(m) === i) && !(sel && sel.from === i) ? { from: i } : null;
    render();
  };
}


document.addEventListener("click", (e) => { if (e.target.closest && e.target.closest("button")) sfx.play(e.target.closest(".back") ? "BACK" : "TAP"); }, true);
call("catalogJson").then((t) => { catalog = JSON.parse(t); showTab(0); }).then(() => sfx.init()).catch((e) => { $("shelf").textContent = "読み込みに失敗しました:" + e.message; });


// ---------------------------------------------------------------- みんなで遊ぶ(通信対戦)
let ost = null, lastBeginSeq = 0, onlineBusy = false;
const drafts = { invite: "", replies: {} };
const isHostRoom = () => ost && ost.role === "host";
const MAX_MEMBERS = 6;
const FACE = ["#C8463C", "#3F78C4", "#3E9B63", "#E0AE36", "#7A5AC0", "#5A3A22"];
const ICON_GLOBE = '<svg class="i" viewBox="0 0 24 24" style="stroke:#fff"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/></svg>';
const ICON_ENTER = '<svg class="i" viewBox="0 0 24 24" style="stroke:#fff"><path d="M10 7l5 5-5 5M15 12H3"/><path d="M13 4h6v16h-6"/></svg>';
async function copy(t, btn) {
  try { await navigator.clipboard.writeText(t); toast("コピーしました"); }
  catch { toast("長押しで選んでコピーしてください"); }
  void btn;
}
async function share(t, btn) {
  try { if (navigator.share) { await navigator.share({ text: t }); return; } } catch { /* 送れない時はコピーにする */ }
  copy(t, btn);
}
createNet(mainCore, { changed: () => queueMicrotask(onlineChanged) });

$("hostIcon").innerHTML = ICON_GLOBE;
$("joinIcon").innerHTML = ICON_ENTER;
const myName = () => store.get("name", "あなた") || "あなた";
$("hostBtn").onclick = () => {
  mainCore.onlineSetLevel(cpuLevel);
  mainCore.onlineHost(myName());
  lastBeginSeq = 0;
  $("lobbyBack").innerHTML = IC.back;
  show("lobby");
  onlineChanged();
};
$("joinBtn").onclick = () => { $("joinBack").innerHTML = IC.back; show("join"); renderJoin(); };
$("joinBack").onclick = () => { mainCore.onlineJoinReset(); showTab(1); };
$("lobbyBack").onclick = () => leaveOnline();
$("lobbyChat").onclick = () => openChat();
$("toSettings").onclick = () => { $("osBack").innerHTML = IC.back; show("onlineSettings"); renderOnlineSettings(); };
$("osBack").onclick = () => show("lobby");
$("startOnline").onclick = () => {
  const ok = mainCore.onlineStart(String(Math.floor(Math.random() * 2 ** 40) + 1));
  if (!ok) alertBox("人数がこのゲームの席より多いか、このゲームを遊べない人がいます");
};
function leaveOnline() { mainCore.onlineLeave(); online = false; token++; ost = null; closeSheet(); $("play").style.transform = ""; showTab(1); }

function onlineChanged() {
  ost = JSON.parse(mainCore.onlineState());
  window.__ost = ost;
  if (ost.closed) { const msg = ost.closed; mainCore.onlineLeave(); online = false; token++; closeSheet(); showTab(1); alertBox(msg); return; }
  handleNotices();
  const cur2 = document.querySelector(".screen:not(.hidden)")?.id;
  if (ost.role === "guest" && cur2 === "join") { $("lobbyBack").innerHTML = IC.back; show("lobby"); }
  if (ost.beginSeq !== lastBeginSeq) {
    lastBeginSeq = ost.beginSeq;
    if (ost.match >= 0) return startOnlinePlay(ost.match);
  }
  if (cur2 === "play" && online && ost.phase === "LOBBY") { token++; online = false; $("resultPanel").classList.add("hidden"); $("lobbyBack").innerHTML = IC.back; show("lobby"); renderLobby(); return; }
  if (cur2 === "play" && online && view && view.outcome && !$("resultPanel").classList.contains("hidden")) { showResult(); if ($("readyNames")) $("readyNames").textContent = "準備ができた人: " + ost.members.filter((m) => m.slot === ost.mySlot || ost.ready.includes(m.slot)).map((m) => m.name).join("・"); return; }
  if (cur2 === "play" && online) { if (!onlineBusy) { onlineBusy = true; refresh().finally(() => (onlineBusy = false)); } return; }
  const now = document.querySelector(".screen:not(.hidden)")?.id;
  if (now === "join") renderJoin();
  if (now === "lobby") renderLobby();
  if (now === "onlineSettings") renderOnlineSettings();
}
function alertBox(msg) { openSheet(`<h2>お知らせ</h2><div class="note">${esc(msg)}</div><div class="btns"><button class="main" id="okBtn">閉じる</button></div>`); $("okBtn").onclick = closeSheet; }

// コードを見せる箱(コピー・送る)と、コードを入れる欄(元のアプリの CodeBox・CodeInput と同じ並び)
const codeBox = (code, key) => `<div class="codebox">${esc(code)}</div><div class="hrow"><button class="sbtn" data-copy="${key}">コピー</button><button class="sbtn pri" data-share="${key}">送る</button></div>`;
const codeInput = (label, button, key, value) => `<label class="lbl" for="in_${key}">${label}</label><textarea id="in_${key}" data-in="${key}" rows="3" class="txt wide" spellcheck="false">${esc(value || "")}</textarea><div><button class="sbtn pri" data-go="${key}" ${value && value.trim() ? "" : "disabled"}>${button}</button></div>`;
function wireCodes(root, codes, inputs) {
  root.querySelectorAll("[data-copy]").forEach((b) => (b.onclick = () => copy(codes[b.dataset.copy], b)));
  root.querySelectorAll("[data-share]").forEach((b) => (b.onclick = () => share(codes[b.dataset.share], b)));
  root.querySelectorAll("[data-in]").forEach((t) => (t.oninput = () => { inputs[t.dataset.in].set(t.value); const g = root.querySelector(`[data-go="${t.dataset.in}"]`); if (g) g.disabled = !t.value.trim(); }));
  root.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => inputs[b.dataset.go].go(root.querySelector(`[data-in="${b.dataset.go}"]`).value)));
}

// 参加する(招待コード)
function renderJoin() {
  const st = ost || JSON.parse(mainCore.onlineState());
  const j = st.join;
  let html = '<div class="pnlabel">招待コードで参加(オンライン)</div>';
  const codes = {}, inputs = {};
  if (j.reply) {
    const sent = j.auto === "SENT", sending = j.auto === "SENDING";
    html += `<div class="cardbox"><div>${sent ? "返信をホストに届けました。ホストの画面でつながるのを待っています…" : sending ? "返信をホストに届けています…" : "この返信コードをホストに送ってください。ホストが貼るとつながります"}</div>${sent || sending ? "" : codeBox(j.reply, "reply")}<div><button class="sbtn" id="joinRetry">やり直す</button></div></div>`;
    codes.reply = j.reply;
  } else if (j.busy) {
    html += '<p class="note">返信コードを作っています…</p>';
  } else {
    if (j.error) html += `<p class="red">${esc(j.error)}</p>`;
    html += `<div class="cardbox">${codeInput("ホストからの招待コード", "参加する", "inv", drafts.invite)}</div>`;
    inputs.inv = { set: (v) => (drafts.invite = v), go: (v) => { mainCore.onlineSetLevel(cpuLevel); mainCore.onlineJoin(myName(), v); onlineChanged(); renderJoin(); } };
  }
  html += '<p class="privacy">オンラインでは、つなぐ時だけ公開の中継サーバー(ntfy.sh)と STUN サーバーを使います。相手と自分のIPアドレスが、これらのサーバーに伝わります。</p>';
  const box = $("joinBody");
  box.innerHTML = html;
  wireCodes(box, codes, inputs);
  if ($("joinRetry")) $("joinRetry").onclick = () => { mainCore.onlineJoinReset(); renderJoin(); };
}

// 部屋(ロビー)
const ONLINE_GAMES = () => catalog.filter((g) => PROTO.has(g.id));
const maxPlayers = (g) => range(g.players)[1];
function renderLobby() {
  if (!ost) return;
  const host = ost.role === "host";
  $("lobbyTitle").textContent = host ? "あなたの部屋" : "部屋";
  $("lobbyChat").innerHTML = IC.chat + "<span>チャット</span>";
  $("lobbyChat").classList.toggle("hidden", !(ost.phase && ost.phase !== "JOINING" && ost.chatOk));
  const body = $("lobbyBody");
  body.querySelectorAll("textarea[data-in]").forEach((t) => (drafts.replies[t.dataset.in] = t.value));
  const gi = catalog.find((g) => g.id === ost.gameId);
  let html = "";
  if (ost.phase === "JOINING") html += '<div class="cardbox">ホストにつないでいます…</div>';
  if (ost.transportError) html += `<p class="red">${esc(ost.transportError)}</p>`;
  html += `<div class="pnlabel">参加者 ${ost.members.length}/${MAX_MEMBERS}</div><div class="cardbox">${ost.members.map((m, i) => { const me = m.slot === ost.mySlot; return `<div class="member">${me ? faceHtml(34, m.name.slice(0, 1), FACE[i % FACE.length]) : `<span class="face" style="background:${FACE[i % FACE.length]}">${esc(m.name.slice(0, 1))}</span>`}<span class="mn">${esc(m.name)}${me && m.name !== "あなた" ? "(あなた)" : ""}</span>${m.slot === 0 ? '<span class="tag">ホスト</span>' : ""}</div>`; }).join("")}</div>`;
  if (ost.legacy.length) html += `<p class="note">${ost.legacy.map(esc).join("・")}のアプリが古い版です。「待った」・チャット・時間切れの「負け」は使えません。</p>`;
  const codes = {}, inputs = {};
  if (host) {
    const games = ONLINE_GAMES();
    const blocked = games.map((g) => [g, JSON.parse(mainCore.onlineMismatch(g.id))]).filter(([, n]) => n.length);
    if (blocked.length) html += `<p class="red">${[...new Set(blocked.flatMap(([, n]) => n))].map(esc).join("・")}のアプリの版が違うので、${blocked.map(([g]) => esc(g.name)).join("・")}は選べません。</p>`;
    const can = games.filter((g) => maxPlayers(g) >= ost.members.length && !blocked.some(([b]) => b.id === g.id));
    html += `<div class="pnlabel">遊ぶゲーム</div><p class="note">${ost.members.length}人で遊べるゲーム</p><div class="ogrid">${can.map((g) => `<button class="og${g.id === ost.gameId ? " on" : ""}" data-game="${g.id}"><span class="ck">${g.id === ost.gameId ? "✓ " + esc(g.name) : ""}</span><span class="tile"><div class="art">${boxArt(g.id)}</div><span class="nm">${esc(g.name)}</span><span class="pc">${esc(g.players)}</span></span></button>`).join("")}</div>`;
    if (gi && maxPlayers(gi) < ost.members.length) html += '<p class="note">参加人数が増えました。人数に合うゲームを選んでください。</p>';
    html += '<div class="pnlabel">招待コード(1人に1つ)</div>';
    for (const v of ost.invites) {
      const msg = v.state === "CONNECTING" ? "つないでいます…" : v.state === "FAILED" ? "つながりませんでした" + (v.error ? `(${esc(v.error)})` : "") :
        v.auto === "LISTENING" ? "この招待コードを送ってください。相手がコードを貼ると、自動でつながります" : v.auto === "STARTING" ? "この招待コードを送ってください(自動で受け取る準備をしています)" : "この招待コードを送り、相手の「返信コード」を下に貼ってください";
      codes["i" + v.i] = v.code;
      inputs["r" + v.i] = { set: (t) => (drafts.replies["r" + v.i] = t), go: (t) => { mainCore.onlineInviteReply(v.i, t); drafts.replies["r" + v.i] = ""; } };
      html += `<div class="cardbox"><div>${msg}</div>${v.state === "WAITING_REPLY" ? codeBox(v.code, "i" + v.i) + codeInput("返信コード", "つなぐ", "r" + v.i, drafts.replies["r" + v.i]) : ""}<div><button class="sbtn" data-cancel="${v.i}">取り消す</button></div></div>`;
    }
    if (ost.bookError) html += `<p class="red">${esc(ost.bookError)}</p>`;
    html += `<div><button class="sbtn pri" id="makeInvite" ${ost.canCreate ? "" : "disabled"}>${ost.creating ? "作っています…" : "招待コードを作る"}</button></div>`;
  } else if (gi) {
    html += `<div class="pnlabel">遊ぶゲーム</div><div class="osgame"><div class="art" style="width:56px;height:56px;border-radius:14px">${boxArt(gi.id)}</div><div><b style="font-size:17px">${esc(gi.name)}</b><p>ホストが選んでいます</p></div></div>`;
    if (ost.phase === "LOBBY") html += '<p class="note">ホストが始めるのを待っています</p>';
  }
  body.innerHTML = html;
  wireCodes(body, codes, inputs);
  body.querySelectorAll("[data-cancel]").forEach((b) => (b.onclick = () => mainCore.onlineInviteCancel(+b.dataset.cancel)));
  body.querySelectorAll("[data-game]").forEach((b) => (b.onclick = () => { if (b.dataset.game !== ost.gameId) mainCore.onlineChoose(b.dataset.game, ""); $("osBack").innerHTML = IC.back; show("onlineSettings"); renderOnlineSettings(); }));
  if ($("makeInvite")) $("makeInvite").onclick = () => mainCore.onlineInviteCreate();
  $("lobbyBar").classList.toggle("hidden", !host);
  $("toSettings").disabled = !(gi && maxPlayers(gi) >= ost.members.length && ost.phase === "LOBBY");
}

// ゲーム設定(部屋を保ったまま、選んだゲームの設定と開始)
function renderOnlineSettings() {
  if (!ost) return;
  const gi = catalog.find((g) => g.id === ost.gameId);
  if (!gi) return;
  $("osSub").textContent = `参加者 ${ost.members.length}人`;
  const opts = Object.fromEntries((ost.options || "").split(";").filter((x) => x.includes("=")).map((x) => [x.split("=")[0], x.slice(x.indexOf("=") + 1)]));
  const available = maxPlayers(gi) >= ost.members.length;
  const body = $("osBody");
  body.innerHTML = `<div class="osgame" style="margin-top:6px"><div class="art">${boxArt(gi.id)}</div><div><b>${esc(gi.name)}</b><p>${esc(gi.intro)}</p></div></div>` + (available ? "" : '<p class="note">参加人数が増えました。戻って人数に合うゲームを選んでください。</p>');
  if (isHostRoom() && available) {
    for (const o of gi.options) {
      if (o.key === "timeoutRule" && (opts.moveSeconds || "0") === "0") continue;
      const vals = o.key === "players" ? o.values.filter(([v]) => (+v || 0) >= ost.members.length) : o.values;
      const l = document.createElement("div"); l.className = "pnlabel";
      l.textContent = o.key === "players" ? `合計人数(CPU ${Math.max(0, (+(opts.players || o.default)) - ost.members.length)}人)` : o.label;
      const s = document.createElement("div"); s.className = "segw";
      seg(s, vals, opts[o.key] ?? o.default, (v) => {
        const n = { ...opts, [o.key]: v };
        mainCore.onlineChoose(ost.gameId, Object.entries(n).map(([k, x]) => `${k}=${x}`).sort().join(";"));
      });
      body.append(l, s);
    }
  }
  $("startOnline").disabled = !(isHostRoom() && available && ost.members.length >= 2 && ost.phase === "LOBBY");
}

async function startOnlinePlay(handle) {
  online = true;
  token++;
  sel = null;
  mode = "online";
  h = handle;
  cur = catalog.find((g) => g.id === ost.gameId) || cur;
  const v0 = JSON.parse(mainCore.viewJson(h, 0));
  mySeat = v0.mine >= 0 ? v0.mine : 0;
  enterPlay("オンライン対戦");
}


// ---------------------------------------------------------------- ライセンス
async function openLicenses() {
  const files = [["Zen Maru Gothic(字)", "licenses/ZenMaruGothic-OFL.txt"], ["Yuji Boku(将棋の駒・麻雀の牌の字)", "licenses/YujiBoku-OFL.txt"], ["効果音の録音(碁石=KaTrain、将棋の駒=ShogiHome)", "licenses/sounds.txt"], ["Kotlin(標準ライブラリ)", "licenses/kotlin.txt"]];
  let html = "<h2>ライセンス</h2>";
  for (const [name, f] of files) {
    let t = "(読み込めませんでした)";
    try { t = await (await fetch(f)).text(); } catch {}
    html += `<div class="lbl">${name}</div><pre class="benchout" style="max-height:9em;overflow:auto">${esc(t)}</pre>`;
  }
  openSheet(html + '<div class="btns"><button class="main" id="licOk">閉じる</button></div>');
  $("licOk").onclick = closeSheet;
};


// ---------------------------------------------------------------- 待った・お知らせ・チャット(通信の手順 2)
const STAMPS = ["よろしく", "いい手！", "ありがとう", "うれしい", "ぐぬぬ", "うーん", "まいった", "待って", "ごめん", "GG", "おどろき", "はやく", "がんばれ", "おつかれ", "ねむい", "やったー"];
let lastFlash = "0|", askShown = -1, chatOpenNow = false;
function toast(t) { const el = $("toast"); el.textContent = t; el.classList.remove("hidden"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.add("hidden"), 3500); }
function handleNotices() {
  if (ost.flash !== lastFlash) { lastFlash = ost.flash; const t = ost.flash.slice(ost.flash.indexOf("|") + 1); if (t) toast(t); }
  const ask = ost.undoAsk;
  if (ask && !ask.mine && askShown !== ask.id) {
    askShown = ask.id;
    openSheet(`<h2>待った</h2><div class="note">${esc(ask.name)}さんが「待った」を求めています。戻してよいですか</div><div class="btns"><button class="main" id="uYes">了承</button><button id="uNo">断る</button></div>`, true);
    $("uYes").onclick = () => { closeSheet(); mainCore.onlineVoteUndo(true); };
    $("uNo").onclick = () => { closeSheet(); mainCore.onlineVoteUndo(false); };
  } else if (!ask && askShown >= 0) { askShown = -1; if ($("uYes")) closeSheet(); }
  if (chatOpenNow) fillChat();
}
const chatText = (c) => (c.kind === 1 ? `【${STAMPS[+c.body] ?? "スタンプ"}】` : esc(c.body));
function fillChat() {
  const box = $("chatLog");
  if (!box) return;
  box.innerHTML = ost.chat.map((c) => `<div><b>${esc(c.name)}</b>${chatText(c)}</div>`).join("") || '<div class="note">まだ発言がありません</div>';
  box.scrollTop = box.scrollHeight;
}
function openChat() {
  chatOpenNow = true;
  openSheet(`<h2>チャット</h2><div class="chatlog" id="chatLog"></div><div class="stamps">${STAMPS.map((n, i) => `<button data-st="${i}">${n}</button>`).join("")}</div><div class="chatrow"><input id="chatIn" class="txt" maxlength="40" autocomplete="off"><button class="smallbtn" id="chatSend">送る</button></div><div class="btns" style="margin-top:10px"><button id="chatClose">閉じる</button></div>`);
  fillChat();
  $("chatSend").onclick = () => { const v = $("chatIn").value; if (v.trim() && mainCore.onlineSendChat(0, v)) $("chatIn").value = ""; };
  document.querySelectorAll("#sheet [data-st]").forEach((b) => (b.onclick = () => mainCore.onlineSendChat(1, b.dataset.st)));
  $("chatClose").onclick = () => { chatOpenNow = false; closeSheet(); };
}
$("chatBtn").onclick = openChat;

// ---------------------------------------------------------------- Android の戻るボタン(ブラウザの「戻る」)
// 履歴に「戻るための1段」を置いておき、戻るが押されたらアプリの中で一つ前の画面へ戻して、また1段置き直す。
// ホームのゲームのタブで押した時だけ、そのままページを離れる。
const BACK_BUTTON = { play: "playBack", detail: "detailBack", rules: "rulesBack", join: "joinBack", lobby: "lobbyBack", onlineSettings: "osBack" };
let leaving = false;
// Chrome(Android)は、ページが「操作されていない時」に積んだ履歴の段を、戻るボタンで飛ばす(元のページごと飛ばすこともある)。
// だから段は、Chrome が「操作した」と数える時(指を離した時・クリック・キー)にだけ積む。戻るを続けて押せるよう、3段までためる
const TRAP_MAX = 3;
let traps = 0;
function fillTraps() {
  try { while (traps < TRAP_MAX) { history.pushState({ asobi: 1 }, ""); traps++; } } catch { /* 履歴が使えない時は何もしない */ }
}
function inAppBack() {
  const modal = $("modal");
  if (!modal.classList.contains("hidden")) { if (!modal.dataset.lock) closeSheet(); return true; }
  const scr = document.querySelector(".screen:not(.hidden)")?.id;
  if (scr === "home") { if (homeTab !== 0) { showTab(0); return true; } return false; }
  const id = BACK_BUTTON[scr];
  if (id && $(id)) { $(id).click(); return true; }
  return false;
}
function askExit() {
  openSheet('<h2>このアプリを終了しますか?</h2><div class="btns"><button class="main" id="exitYes">終了する</button><button id="exitNo">キャンセル</button></div>');
  $("exitNo").onclick = closeSheet;
  $("exitYes").onclick = () => {
    closeSheet();
    leaving = true;
    try { window.close(); } catch { /* 閉じられない時は履歴を戻ってページを離れる */ }
    // ためた段とこのページの最初の段をさかのぼる。前のページがあればそこへ戻り、なければ次の戻るでブラウザが閉じる
    history.go(-(traps + 1));
    traps = 0;
    setTimeout(() => { leaving = false; }, 1500);
  };
}
try {
  for (const ev of ["pointerup", "click", "keydown"]) window.addEventListener(ev, () => { if (!leaving) fillTraps(); }, { capture: true, passive: true });
  window.addEventListener("popstate", () => {
    if (leaving) return;
    traps = Math.max(0, traps - 1);
    if (!inAppBack()) askExit();
  });
} catch { /* 履歴が使えない場面(埋め込みなど)では、戻るボタンの対応をしない */ }

// ---------------------------------------------------------------- ネットが切れても遊べるように(全部のファイルを端末に保存する)
if ("serviceWorker" in navigator) {
  // 新しい版を保存し終えたら、1回だけ読み込み直して新しい版に入れ替える(古い版が出たままにならないように)
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloaded) return;
    const scr = document.querySelector(".screen:not(.hidden)")?.id;
    if (scr === "play" || scr === "lobby" || scr === "join" || scr === "onlineSettings") return; // 対局中・通信中は入れ替えない(次に開いた時)
    reloaded = true;
    location.reload();
  });
  navigator.serviceWorker.register("./sw.js").then((r) => r.update()).catch(() => { /* 保存できない場面(埋め込みなど)では、ふつうに読む */ });
}


// ---------------------------------------------------------------- プレイヤーの写真(元のアプリの AvatarSetting・AvatarCrop と同じ流れ)
// 選んだ写真を、丸い枠の中で動かす・拡大縮小して保存する。保存した写真と設定は、この端末のブラウザに残る(開き直しても消えない)
let avatar = store.get("avatar", null);
function faceHtml(size, fallback = "あ", color = "#C8463C") {
  const st = `width:${size}px;height:${size}px;border-radius:50%;flex:none;`;
  return avatar ? `<img class="avatar" src="${avatar}" alt="" style="${st}object-fit:cover">` : `<span class="face" style="${st}background:${color};display:inline-flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:${Math.round(size * 0.42)}px">${esc(fallback)}</span>`;
}
function openCrop(file) {
  openSheet('<h2>写真の位置と大きさ</h2><div class="note" id="cropMsg">写真を読み込んでいます…</div>', true);
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onerror = () => { URL.revokeObjectURL(url); openSheet('<h2>写真の位置と大きさ</h2><div class="note">この写真は読み込めませんでした</div><div class="btns"><button id="cropNo">キャンセル</button></div>'); $("cropNo").onclick = closeSheet; };
  img.onload = () => {
    const S = Math.min(300, window.innerWidth - 64);
    const base = Math.max(S / img.naturalWidth, S / img.naturalHeight);
    let zoom = 1, x = 0, y = 0; // x, y: 写真の中心が枠の中心からずれている量(画面の px)
    openSheet(`<h2>写真の位置と大きさ</h2><div class="crop" id="cropStage" style="width:${S}px;height:${S}px"><img id="cropImg" src="${url}" alt="" draggable="false"><div class="cropmask"></div></div><input type="range" id="cropZoom" min="1" max="4" step="0.01" value="1" aria-label="大きさ" class="cropzoom"><div class="btns"><button class="main" id="cropOk">この位置で保存</button><button id="cropNo">キャンセル</button></div>`, true);
    const el = $("cropImg"), stage = $("cropStage");
    const clamp = () => {
      const w = img.naturalWidth * base * zoom, h = img.naturalHeight * base * zoom;
      x = Math.min((w - S) / 2, Math.max(-(w - S) / 2, x));
      y = Math.min((h - S) / 2, Math.max(-(h - S) / 2, y));
    };
    const draw = () => {
      clamp();
      const w = img.naturalWidth * base * zoom, h = img.naturalHeight * base * zoom;
      el.style.width = w + "px"; el.style.height = h + "px";
      el.style.left = (S - w) / 2 + x + "px"; el.style.top = (S - h) / 2 + y + "px";
    };
    draw();
    // 1本の指で動かし、2本の指で拡大縮小(下の棒でも大きさを変えられる)
    const pts = new Map();
    let last = null, lastDist = 0;
    stage.onpointerdown = (e) => { stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); last = [e.clientX, e.clientY]; if (pts.size === 2) { const [a, b] = [...pts.values()]; lastDist = Math.hypot(a[0] - b[0], a[1] - b[1]); } };
    stage.onpointermove = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size >= 2) {
        const [a, b] = [...pts.values()];
        const dd = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (lastDist) { const nz = Math.min(4, Math.max(1, zoom * dd / lastDist)); x *= nz / zoom; y *= nz / zoom; zoom = nz; $("cropZoom").value = String(zoom); }
        lastDist = dd;
      } else if (last) { x += e.clientX - last[0]; y += e.clientY - last[1]; }
      last = [e.clientX, e.clientY];
      draw();
    };
    stage.onpointerup = stage.onpointercancel = (e) => { pts.delete(e.pointerId); lastDist = 0; const r = [...pts.values()][0]; last = r ? [...r] : null; };
    $("cropZoom").oninput = (e) => { const nz = +e.target.value; x *= nz / zoom; y *= nz / zoom; zoom = nz; draw(); };
    $("cropNo").onclick = () => { URL.revokeObjectURL(url); closeSheet(); };
    $("cropOk").onclick = () => {
      // 枠の中に見えている所を 256×256 にして保存する
      const out = 256, k = out / S;
      const c = document.createElement("canvas"); c.width = out; c.height = out;
      const w = img.naturalWidth * base * zoom, h = img.naturalHeight * base * zoom;
      c.getContext("2d").drawImage(img, ((S - w) / 2 + x) * k, ((S - h) / 2 + y) * k, w * k, h * k);
      try {
        avatar = c.toDataURL("image/jpeg", 0.88);
        store.set("avatar", avatar);
      } catch { avatar = null; }
      URL.revokeObjectURL(url);
      closeSheet();
      renderSettings();
    };
  };
  img.src = url;
}
