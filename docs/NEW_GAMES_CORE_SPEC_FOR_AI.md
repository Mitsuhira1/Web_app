# 追加ゲームのコア引き継ぎ資料（UI担当AIへ）

最終更新: 2026-11-22 / 作成: Muse

このファイルは、盤面デザインを担当するAIへの引き継ぎ資料を**1つにまとめたもの**です。
ここに書いたゲームは、すべて **ゲームの処理（コア）だけが実装済み**で、**盤面UI・メニュー登録は未実装**です。

## 共通事項（全ゲーム）

- コアの場所: `web/pc-firebase/core/games/<id>.mjs`。`web/pc-firebase/core/extra-games.mjs` の `EXTRA_GAME_SPECS` に登録済みで、カタログ（`core.catalogJson()`）と対局エンジン（`newMatch` / `cpuChoose` / `playMove` / `viewJson`）から使えます。
- オフライン保存: 新規5ゲームのコアファイルは `web/pc-firebase/sw.js` の `FILES` に追加済み（キャッシュ名も更新済み）。UIでファイルを追加したら、そちらも `FILES` とキャッシュ名を直すこと。
- **UI担当がやること（全ゲーム共通）**:
  1. `web/pc-firebase/js/app.js` の `ORDER` に id を追加する（順序は no の順を推奨）。追加すると表示名が「あそび箱51」以降に変わる点に注意（`APP_NAME` は `ORDER.length` から自動生成）。
  2. `web/pc-firebase/js/boards/` に盤面描画を作る。**左上の戻る・右の側板・左下の設定（歯車）は全ゲーム共通部品**（`CLAUDE.md` 参照）。ゲーム側は `#boardwrap` の中だけを描く。
  3. メニューアイコン（`assets/game-icons/<id>.webp`）を用意し、`node tools/build_game_icons.cjs` の手順に従う。
  4. view の形式は各ゲームの `kind` を参照。各節の「view」欄が要点。完全な形はコアファイルの `attachView` を見ること（大きいファイルではないので該当箇所だけ読めばよい）。
- 手（move）はすべて整数。符号化はゲームごとに下記に明記した。
- CPU（brain）はコア側に実装済み。UI側でCPUの手を選ぶ処理は不要（エンジンの `cpuChoose` が呼ぶ）。
- 確かめたこと（2026-11-22）: 既存・新規すべてのテストファイル（`tools/tests/test_*.mjs` 13件）が合格。エンジン経由のスモークテスト（カタログ登録・`rulesJson` の節・CPU同士の完走）も新規5ゲームの代表オプションで合格。
- コミット・プッシュはユーザーが言った時だけ。この資料の対象作業では行っていない。

---

## 1. コヨーテ（既存・検証済み）

- id: `coyote` / no: 44 / CARD / 2〜6人
- 状態: **コア実装済み・テスト合格**（`tools/tests/test_coyote_core.mjs`）。詳細仕様は既存の `docs/COYOTE_SPEC_FOR_AI.md` を参照（この資料では重複させない）。
- 要点: 自分のカードだけ伏せ他全員は公開。宣言（合計以下で前の人より大きい数）か「コヨーテ」指摘。特殊カードは ×2 / MAX→0 / ? / 0（夜）の4種（全36枚）。オプション: `players`（既定4）、`specialCards`（on/off）、`lives`（1〜3、既定3。負け3回ではなくライフ制である点に注意）。
- UI: 未実装（盤面・`ORDER` 登録とも）。

## 2. スカル（既存・検証済み）

- id: `skull` / no: 45 / CARD / 3〜6人
- 状態: **コア実装済み・テスト合格**（`tools/tests/test_skull_core.mjs`）。詳細は `docs/SKULL_SPEC_FOR_AI.md`。
- 要点: 花3枚・ドクロ1枚。伏せて追加するかチャレンジ宣言→競り→宣言者が自分の場から先にめくる。オプション: `players`（既定4）、`targetPoints`（2=標準 / 1=時短）。
- UI: 未実装。

## 3. ライアーズダイス（既存・検証済み）

- id: `liarsdice` / no: 46 / BOARD / 2〜6人
- 状態: **コア実装済み・テスト合格**（`tools/tests/test_liarsdice_core.mjs`）。詳細は `docs/LIARSDICE_SPEC_FOR_AI.md`。
- 要点: 各5個のダイスを自分だけ見る。宣言は `encodeLiarsBid(qty, face)`（手=100+qty*10+face）、ダウト=0、ジャスト=1。オプション: `players`（既定4）、`wildOnes`（on=1がワイルド＋1の宣言は半分で上書き可）、`exactRule`（off / others_lose / gain_one）。
- UI: 未実装。

## 4. インカの黄金（既存・検証済み）

- id: `incangold` / no: 47 / BOARD / 3〜6人
- 状態: **コア実装済み・テスト合格**（`tools/tests/test_incangold_core.mjs`）。詳細は `docs/INCANGOLD_SPEC_FOR_AI.md`。
- 要点: 全5ラウンド。同時選択（進む=1 / 帰る=0）は「未選択の次の席を toMove が指す」方式で、view では他人の選択は decided フラグのみ。オプション: `players`（既定4）、`artifacts`（on/off）。
- UI: 未実装。

---

## 5. 6ニムト（新規）

- id: `take6` / no: 48 / CARD / 2〜6人
- ファイル: `web/pc-firebase/core/games/take6.mjs`、テスト: `tools/tests/test_take6_core.mjs`（合格）
- オプション:
  - `players`: 2〜6（既定4）
  - `professional`: off（標準、1〜104全使用）/ on（人数×10+4 枚まで）
  - `endMode`: single（標準、1ラウンドで失点最少の勝ち）/ to66（誰かの累計失点が66を超えるまでラウンド反復）
- 手の符号化:
  - カード選択フェーズ（`phase:'choose'`）: 手 = カード番号そのもの（1〜104）
  - 列選択フェーズ（`phase:'rowPick'`）: 手 = 列番号（0〜3）。どの列の末尾よりも小さいカードを出した時だけ発生する
- 進行: 全員同時に1枚選択（incangold と同じ「未選択の次の席」方式）→ 小さい順に自動配置（末尾が自分より小さく最も大きい列の末尾へ。6枚目になった人がその列の5枚を引き取る）。`bullHeads(n)` を export（55→7、11の倍数→5、10の倍数→3、5で終わる→2、他→1）。
- view（kind:'take6'）: `phase`、自分の手札 `myHand`、人数分 `handCounts`、公開の4列 `rows` と各列の牛合計、ラウンド失点 `roundScores` と累計 `totalScores`、選択済みフラグ `decided`、自分の選択 `myChoice`（他人の選択カードは公開前は見えない）、直近の解決 `lastReveal`（公開カードと、誰がどの列を引き取ったか）。
- scores: 累計失点（小さいほど良い）。勝者は最小の席、同点は引き分け（winner -1）。

## 6. ブロックス（新規）

- id: `blokus` / no: 49 / BOARD
- ファイル: `web/pc-firebase/core/games/blokus.mjs`、テスト: `tools/tests/test_blokus_core.mjs`（合格）
- オプション:
  - `players`: 2〜4（既定4）
  - `board`: '20'（標準、20×20）/ 'duo'（14×14・2人専用、1人が2色ずつ担当。players の値によらず2席になる）
- 色と手番: 色は標準では席と同数。duo は4色を席0=色0・2、席1=色1・3が担当。状態に `currentColor` を持ち、`toMove` は現在の色の担当席を返す。置けない色は自動でスキップされる。
- 開始角: 色0=左上、色1=右上、色2=右下、色3=左下。初手は自分の開始角を必ず含む。以後は自色と角でのみ接し、辺では接しないこと。
- ピース: `BLOKUS_PIECES`（21種、合計89マス）を export。向きは `orientationsFor(pieceIdx)`（回転・反転の重複を除いた配列）。
- 手の符号化: `move = (((pieceIdx*8)+oriIdx)*boardSize + y)*boardSize + x`（x,y は向きの外接矩形の左上）。`decodeBlokusMove(move, boardSize)` を export。パスは `BLOKUS_MOVE_PASS = 999999`（合法配置が無い時だけ legalMoves に出る）。
- view（kind:'blokus'）: `board`（1次元配列、-1=空、他は色番号）、`currentColor`、`currentSeat`、色ごとの残りピースと残りマス数、色別・席別スコア、`lastAction`。
- 得点: 席ごと「残りマス数 − ボーナス」（小さいほど良い）。ボーナスは、色を全部置き切ると15点、さらにその色の最後のピースが1マスなら5点（得点から引く）。全ピース置き切った2人対戦では scores が負値（-20）になり得る仕様。

## 7. コリドール（新規）

- id: `quoridor` / no: 50 / BOARD / 2〜4人
- ファイル: `web/pc-firebase/core/games/quoridor.mjs`、テスト: `tools/tests/test_quoridor_core.mjs`（合格）
- オプション: `players`: 2 / 3 / 4（既定2）。壁は2人=各10枚、3人以上=各5枚。**3人は本実装の拡張**（公式は2人・4人）。
- 開始位置（x,y）: 席0=(4,8)→ゴール y=0、席1=(4,0)→ゴール y=8、席2=(0,4)→ゴール x=8、席3=(8,4)→ゴール x=0。
- 手の符号化:
  - コマ移動: 移動先セル `y*9+x`（0〜80）。相手コマへのジャンプ・斜め移動も移動先セルで表す
  - 壁: `100 + (y*8+x)*2 + (縦?1:0)`（範囲は **100〜227**）。`decodeQuoridorMove(m)` を export
- 壁の表現: `hWalls[y][x]` は行 y と y+1 の境界に列 x・x+1 にわたる横壁、`vWalls[y][x]` は列 x と x+1 の境界に行 y・y+1 にわたる縦壁。壁の重なり・交差は禁止。全員のゴール経路が残らない壁は legalMoves に出ない（BFS検証済み）。`quoridorPathLength(s, seat)` を export。
- view（kind:'quoridor'）: `pawns`（席ごと座標）、`wallsLeft`、`hWalls` / `vWalls`、`turn`、`lastAction`。全公開。
- scores: 各席のゴールまでの最短経路長。

## 8. バトルシップ（新規）

- id: `battleship` / no: 51 / BOARD / 2人専用
- ファイル: `web/pc-firebase/core/games/battleship.mjs`、テスト: `tools/tests/test_battleship_core.mjs`（合格）
- 艦隊: `BATTLESHIP_FLEET = [5,4,3,3,2]`、盤面10×10。
- オプション:
  - `salvo`: off（標準、1手番1発）/ on（自分の未撃沈艦の数だけ連続発射）
  - `chain`: off（標準）/ on（ヒットしたら追加発射。salvo 併用時はヒットで shotsLeft を消費しない）
  - `noAdjacent`: off（標準）/ ortho（自艦同士の上下左右の隣接禁止）/ all（斜めも禁止）
- フェーズ: `place`（配置、席0が5隻→席1が5隻。どの艦から置いてもよい）→ `battle` → `done`。
- 手の符号化:
  - 配置: `shipIdx*1000 + dir*100 + (y*10+x)`（dir 0=横、1=縦）。`shipCells(shipIdx, dir, x, y)`、`encodePlaceMove` / `decodePlaceMove` を export
  - 攻撃: `y*10+x`（0〜99、相手盤面の座標）
- view（kind:'battleship'）: **隠し情報のマスクが重要**。自分の盤面（自艦＋被弾結果）と、敵盤面は自分の射撃結果のみ（未攻撃=unknown、撃沈した艦だけマスと長さを公開）。観戦者（me=-1）には両者とも未撃沈艦は出ない。配置中の `lastAction` の座標も本人以外には伏せられる。UI側は view の値をそのまま描けば漏れない。
- scores: 各席が撃沈した相手艦の数。

## 9. チンチロリン（新規）

- id: `chinchiro` / no: 52 / **CARD**（ダイスゲームだが賭けチップ精算が中心のため CARD 分類とした。liarsdice の BOARD とは異なる判断）
- ファイル: `web/pc-firebase/core/games/chinchiro.mjs`、テスト: `tools/tests/test_chinchiro_core.mjs`（合格）
- オプション:
  - `players`: 2〜6（既定4）
  - `bet`: '10'（標準）/ '20'（1回の賭けチップ）
  - `drawRule`: banker（標準、同役は親の勝ち）/ push（精算なし）
  - `bankerInstant`: off（標準）/ on（親が強役・6の目で即勝ち、ヒフミ・目なし・1の目で即負け）
  - `shonben`: off（標準）/ on（振るたび5%でションベン＝即負け、再現可能な乱数で判定）
- 進行: 親→次の席から順に子が振る。全員が1回ずつ親を務めたら終了、チップ（初期100）最多の勝ち。チップがマイナスでも脱落なし。
- 手: `CHINCHIRO_MOVE_ROLL = 0` の1種類のみ（振る）。役が出れば確定、目なしは最大3回まで振り直し。
- 役の評価: `evaluateChinchiro(dice)` が `{kind, rank, point, mult, label}` を返す。rank はピンゾロ600、アラシ500+出目、シゴロ400、通常目100+point、目なし0、ヒフミ-100、ションベン-200。精算は `settleChinchiro(bankerEval, childEval, bet, drawRule)` を export（金額は bet×勝者の mult。ただし負け側がヒフミの場合は2倍が優先される場合がある: `max(勝者mult, 2)`）。
- view（kind:'chinchiro'）: `roundNo`、`banker`、`chips`、現在の振り手と試行回数、現在のサイコロ、確定した全席の役、精算結果 `lastRound`（誰から誰へ何枚）。全公開。
- scores: チップ数。

---

## UI担当への注意（設計判断の記録）

- コリドールの壁の手の範囲は 100〜227 です（「100〜355」ではありません）。
- ブロックスの開始角は色順に左上・右上・右下・左下です。2〜3人でも色番号の若い順に角を使います。
- バトルシップの配置は「艦の番号順」ではなく、任意の艦から置けます。
- チンチロリンの精算でチップ総和は保存されます（ゼロサム）。テストで検証済み。
- 6ニムトの同時選択は、他ゲーム（incangold）と違い解決途中で「列選択」の割り込みフェーズが入ります。UIは `phase` を見て出し分けてください。
