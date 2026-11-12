// Android 版の再生の記録(asobi/docs/web-golden/replays.json)を Web 版の規則で再生して、途中の手がすべて合法で、勝者・得点が一致するかを確かめる。
// 使い方: node tools/replay_check.mjs <replays.json> [core の .mjs]
import fs from "node:fs";
const file = process.argv[2];
const core = await import(process.argv[3] || "file:///home/user/Web_app/core/build/compileSync/js/main/productionLibrary/kotlin/asobibako-web-core.mjs");
const d = JSON.parse(fs.readFileSync(file, "utf8"));
let bad = 0, runs = 0, games = 0;
for (const [id, g] of Object.entries(d.games)) {
  games++;
  let gameBad = 0;
  for (const r of g.runs) {
    runs++;
    const h = core.newMatch(id, "", String(r.seed), "", 0);
    if (h < 0) { gameBad++; console.log("NG 作れない", id); continue; }
    let ok = true, why = "";
    for (let i = 0; i < r.moves.length; i++) {
      if (!core.playMove(h, r.moves[i])) { ok = false; why = "手" + i + "(" + r.moves[i] + ")が通らない"; break; }
    }
    if (ok) {
      const s = JSON.parse(core.matchSummary(h));
      const wantWinner = r.finished ? r.winner : -9;
      if (s.winner !== wantWinner) { ok = false; why = "勝者 " + s.winner + " ≠ " + wantWinner; }
      else if (r.scores && JSON.stringify(s.scores) !== JSON.stringify(r.scores)) { ok = false; why = "得点 " + JSON.stringify(s.scores) + " ≠ " + JSON.stringify(r.scores); }
    }
    if (!ok) { gameBad++; console.log("NG", id, "seed", r.seed, why); }
    core.dropMatch(h);
  }
  bad += gameBad;
  if (gameBad) console.log("  →", id, "で", gameBad, "件");
}
console.log(`再生の記録: ${games} ゲーム ${runs} 本、不一致 ${bad} 件`);
process.exit(bad ? 1 : 0);
