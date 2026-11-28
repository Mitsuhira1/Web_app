# ルール動画を録る道具(tools/rule_video)

実際のアプリ(`web/pc-firebase/`)を Playwright で動かして録り、注釈を重ねて `assets/rule-steps/` に mp4 を書く。
2026-11-28 にマンカラで作った。ほかのゲームも、この形で 1 つずつ作り直す予定。

## 使い方
```bash
python3 -m http.server -d web 8400 &          # リポジトリの一番上で
node tools/rule_video/mancala.cjs              # 6 本すべて(1 本 3〜4 分)
node tools/rule_video/mancala.cjs /tmp/out 2 5 # 出力先と、録るステップを選ぶ
node tools/rule_video/daifugo-plan.mjs         # 大富豪: 札の名前で書いた手順を確かめて daifugo-steps.json に
node tools/rule_video/daifugo.cjs              # 大富豪 8 本
node tools/build_rule_steps.cjs --text-only    # docs/mockups/rules-video/<id>-rules.html の文面を js/rules-steps.js に入れ直す
```
- 録り直したゲームは `tools/build_rule_steps.cjs` の `REMADE` に入れる(全体を取り込み直しても、その動画を消さない)。
- 録り直した動画は**新しいファイル名**にする(端末のキャッシュで古い版が見え続けるため。例 `mc-v2-step1.mp4`)。

## 仕組み
- `engine.cjs`: ページの時計(setTimeout・rAF・performance.now・CSS の動き)を 0.25 倍で流してコマ落ちを防ぎ、コマの時刻から動画の時間に直す。
  CPU の手は台本どおりにする(worker への `cpuChoose` を横取り)。`__hold` で CPU を止め、`__holdResult` で結果の画面を止める(説明の間だけ)。規則・盤の描き方はアプリのまま。
- `overlay.js`: 注釈(説明の文・囲み・名札・番号・矢印・カーソル)。時間は「動画の上の時間」で書く。
- `mancala.cjs`: 台本。見せない手(`prefix`)は `mancala-sim.cjs` で探した。
- `daifugo.cjs`: 台本。配り方(seed)を決め、CPU の手は始める前に全部入れておく(CPU が考え始めた後に入れると、CPU が自分の手を打ってしまう)。
- 盤の下に空きが無いゲーム(大富豪など)は、説明の文を右の側板の空いた欄に出す(`T.capBox`)。`T.avoid([...])` で避ける物を決めると、かぶった時に止まる。

## 注釈の決まり(ユーザーの指示 2026-11-28)
- 1 本目は「何をするゲームか」。専門の言葉(倉・横取りなど)は、出てきた所で説明する。
- 説明の文は盤の下の空いた所に、とげの無い札で。矢印は「動きの向き」を見せる時だけ(文と矢印を両方つけない)。
- 差す物が画面に出てから囲む・指す(まだ無い所を指さない。石が動いた後に、もう空の所を指さない)。
- カットイン・盤の演出(横取り!など)・結果の画面の間は、文も番号も出さない。説明はその前か後。
- ゆっくり(アプリの「ゆっくり」をさらに 1.25 倍)。文は 4 秒以上。
- 囲みは差す物と同じ形・ほぼ同じ大きさ(数の札などにかけない)。
- 名札・番号は、ほかの物(穴・札・駒・数の札・ほかの名札・囲み)にかぶせない。かぶる時は盤の外の空いた所(その物の上側など)へ。`overlay.js` がかぶりを調べて止まる。
- 見れば分かることは文にしない。
- 説明の文の字が丸ゴシック(太字の字の一覧)にあるか確かめる(無い字は別の書体で出る)。
