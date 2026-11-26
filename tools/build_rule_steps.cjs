// ルール説明(ステップ動画＋補足・ローカルルール・コツ)の取り込み。
// 使い方: node tools/build_rule_steps.cjs <rules-video フォルダ>
// 見本 <game>-rules.html から文面・ステップを取り出し、js/rules-steps.js を作り、使う動画だけ assets/rule-steps/ に入れる。
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = path.resolve(process.argv[2] || 'docs/mockups/rules-video');
const out = path.join(__dirname, '..', 'web', 'pc-firebase');
const dest = path.join(out, 'assets', 'rule-steps');
fs.rmSync(dest, { recursive: true, force: true }); fs.mkdirSync(dest, { recursive: true }); // 取り込み済みの動画は毎回作り直す(旧版を残さない)
// 見本のファイル名とアプリのゲーム ID が違う物(ほかは同じ)。spider・mine-versus は solitaire・mine の「種類」としてアプリ側で切り替える
const ID = { mj: 'mahjong', ohno: 'uno', texas: 'holdem', 'mine-versus': 'mineVersus' };
const data = {}; const used = new Set();
for (const f of fs.readdirSync(src).filter((n) => /-rules\.html$/.test(n)).sort()) {
  const fid = f.replace(/-rules\.html$/, ''), id = ID[fid] || fid; const h = fs.readFileSync(path.join(src, f), 'utf8');
  const m = /const STEPS = (\[[\s\S]*?\]);\s*\n/.exec(h); if (!m) throw new Error(f + ': STEPS なし');
  const steps = vm.runInNewContext(m[1]).map((s) => ({ t: s.t, d: s.d, src: s.src }));
  // 見本には 2 通りの書き方がある(<h2> の後に <div class="sec"> / <section class="sec"> の中に <h2>)。どちらも <h2> ごとに切って中身だけ取る
  const body = h.slice(h.indexOf('<div class="cols">'), h.lastIndexOf('<script>'));
  const secs = body.split(/<h2>/).slice(1).map((c) => {
    const [hd, ...rest] = c.split('</h2>'); let html = rest.join('</h2>').trim();
    html = html.replace(/^<div class="sec">/, '').trim();
    html = html.replace(/<section class="sec">\s*$/, '').trim();
    while (/<\/(div|section)>\s*$/.test(html)) html = html.replace(/<\/(div|section)>\s*$/, '').trim();
    return { h: hd.trim(), html: html.replace(/\n\s+/g, '\n') };
  });
  if (secs.map((s) => s.h).join() !== '補足,ローカルルール,コツ') throw new Error(f + ': 節が違う ' + secs.map((s) => s.h));
  steps.forEach((s) => { if (!fs.existsSync(path.join(src, s.src))) throw new Error(f + ': 動画なし ' + s.src); used.add(s.src); });
  data[id] = { steps, secs };
}
for (const v of used) fs.copyFileSync(path.join(src, v), path.join(dest, v));
fs.writeFileSync(path.join(out, 'js', 'rules-steps.js'), `/* ルール説明(動画のステップ形式)。tools/build_rule_steps.cjs で見本から作る。直接は直さない。 */\n'use strict';\nwindow.RULE_STEPS = ${JSON.stringify(data, null, 1)};\n`);
console.log(Object.keys(data).length, 'games', used.size, 'videos');
