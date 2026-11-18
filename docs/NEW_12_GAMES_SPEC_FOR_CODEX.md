# 新規12ゲーム 処理仕様＆UI引き継ぎマニュアル (Codex向け)

このドキュメントは `web/pc-firebase/` に追加された **新規12ゲーム** のゲームロジック・ローカルルール・`move` エンコード・`viewJson` スキーマの完全仕様です。
盤面と操作は `web/pc-firebase/js/boards/twelve.js`、盤面の装飾は `web/pc-firebase/css/twelve.css` に実装済みです。設定とルール表示はコアのカタログを使います。

---

## 0. 共通アーキテクチャ

- **コア連携**:
  - `web/pc-firebase/core/extra-games.mjs` が 12 ゲームを `Catalog` と `extraView` に登録済みです。
  - 各ゲームのエンジンは `web/pc-firebase/core/games/<id>.mjs` にあります。
  - `viewJson(h, me)` の戻り値では、既存ゲームと同様に `state.board` に各ゲーム固有の JSON オブジェクト（`state.board.kind === '<id>'`）が入ります。
  - カード系ゲームのカードオブジェクトは `{ id: number, t: string }` です（`id`: `0..51` が `♠♥♦♣` × `A..K`、`52..53` が `JOKER`）。既存の `window.CARDFACE` や `js/boards/cards.js` のヘルパーがそのまま使えます。
  - 追加12ゲームの観戦画面は `view.mine === -1`、`board.me === -2` で、手札・駒色などの非公開情報を伏せ、`view.legal` を空にします。着席時の操作可否は `view.human` と合法手を照合します。
- **テストコマンド**:
  - `node tools/tests/test_extra_12_games.mjs` で全12ゲームの既定設定とローカルルールを合わせた27ケースのCPU完走・マスキング・Undo・復元が検証できます。
- **オフライン対応**:
  - `sw.js` が盤面のJSとCSS、`core/extra-games.mjs` と各ゲームのモジュールをキャッシュします。

---

## 一覧

| # | id | 名前 | カテゴリ | 人数 | Undo |
|---|---|---|---|---|---|
| 31 | `war` | 戦争 | CARD | 2人 | 不可 |
| 32 | `takoyaki` | たこやき | CARD | 2〜4人 | 不可 |
| 33 | `butanoshippo` | ぶたのしっぽ | CARD | 2〜6人 | 不可 |
| 34 | `oldmaid` | ババ抜き / ジジ抜き | CARD | 2〜6人 | 不可 |
| 35 | `hearts` | ハーツ | CARD | 4人 | 不可 |
| 36 | `ginrummy` | ジンラミー | CARD | 2人 | 不可 |
| 37 | `vulture` | ハゲタカのえじき | CARD | 2〜5人 | 不可 |
| 38 | `goita` | ごいた | BOARD | 4人(2vs2) | 不可 |
| 39 | `quarto` | クアルト | BOARD | 2人 | 可 |
| 40 | `geister` | ガイスター | BOARD | 2人 | 不可 |
| 41 | `rummikub` | ラミィキューブ | BOARD | 2〜4人 | 不可 |
| 42 | `pegsolitaire` | ペグ・ソリティア | BOARD | 1人 | 可 |

---

## 1. 戦争 (`war`)

- **概要**: お互いに山札から1枚ずつ出し、強い方が場の札を総取り。同じ強さなら「戦争」（伏せ札を出して次の札で勝負）。
- **ローカルルール (`options`)**:
  - `aRule`: `'strong'` (A最強・標準) / `'weak'` (A最弱)
  - `warCards`: `'1'` (1枚伏せ・日本式標準) / `'3'` (3枚伏せ・海外式)
  - `twoBeatsAce`: `'off'` / `'on'` (2がAに勝つ下克上)
  - `joker`: `'off'` (52枚) / `'on'` (ジョーカー2枚入り54枚・最強)
  - `winCond`: `'all'` (相手の札全取り) / `'rounds26'` (26戦勝負)
- **操作 (`move`)**:
  - `0`: カードを1枚出す（「カードを出す」ボタン / 山札タップ）
- **`board` スキーマ**:
  ```json
  {
    "kind": "war", "me": 0, "turn": 0,
    "deckCounts": [26, 26], "wonCounts": [0, 0], "totalCounts": [26, 26],
    "faceUp": [null, null],       // 現在場に出ている表札 ({id, t} | null)
    "lastRevealed": [null, null], // 直前の勝負で出た札
    "potCount": 0,                // 場に溜まっている枚数
    "war": false,                 // 戦争中フラグ
    "warBlindLeft": [0, 0],       // 戦争で残っている伏せ札枚数
    "battles": 0, "maxBattles": 0, "lastWinner": -1
  }
  ```

---

## 2. たこやき (`takoyaki`)

- **概要**: 1〜10（たこ焼き）の裏向き10枚を先にすべて表向きにしたプレイヤーが勝ち。ラウンド制で勝つたびに目標枚数が1減る（設定可能）。
- **ローカルルール (`options`)**:
  - `players`: `'2'`〜`'4'` (既定 `'2'`)
  - `wild`: `'k_wild'` (Kのみワイルド・標準) / `'jqk_wild'` (J/Q/Kワイルド) / `'none'` (絵札なし)
  - `joker`: `'off'` (なし) / `'wild'` (ワイルド) / `'bomb'` (表札を1枚裏に戻して手番終了)
  - `roundDown`: `'single'` (1ラウンド勝負) / `'countdown'` (勝つと必要枚数が10→9→…と減る)
- **操作 (`move`)**:
  - フェーズ `'draw'`: `0` = 山札から引く、`1` = 捨て札の一番上を取る
  - フェーズ `'place'`: `10..19` = 自分の `0..9` 番スロット（数字 `1..10`）に置く。置けない場合は `20` で捨てて手番終了
  - フェーズ `'bomb'`: `30..39` = 自分の表札1枚を裏に戻して手番終了。表札がない場合は `20`
- **`board` スキーマ**:
  ```json
  {
    "kind": "takoyaki", "me": 0, "n": 2, "turn": 0, "phase": "draw",
    "roundNo": 1, "targets": [10, 10], "wins": [0, 0],
    "held": null,                 // 手番プレイヤーが持っているカード ({id, t} | null)
    "stockCount": 31, "discardTop": {"id": 22, "t": "♥10"}, "discardCount": 1,
    "boards": [[null, ...], ...], // 各プレイヤーの10枠（表向きのみカード表示、裏はnull）
    "open": [[false, ...], ...]   // 各枠が表向きかどうか
  }
  ```

---

## 3. ぶたのしっぽ (`butanoshippo`)

- **概要**: 円形に並べた52枚から1枚めくって中央に出し、直前の札と同じマークか数字なら場の札をすべて引き取る。山が尽きたとき手札が最少の人の勝ち。
- **ローカルルール (`options`)**:
  - `players`: `'2'`〜`'6'` (既定 `'4'`)
  - `matchRule`: `'suit_or_rank'` (マークまたは数字が同じ・標準) / `'suit_only'` (マークのみ同じ)
  - `joker`: `'off'` / `'take_all'` (ジョーカーで強制総取り)
  - `handPlay`: `'off'` (山からのみ) / `'on'` (引き取った手札も出せる)
- **操作 (`move`)**:
  - `0..(ring.length-1)`: 円形の `i` 番目の裏向き札をめくって中央へ出す（`ring[i] === 1` のみ合法）
  - `100 + idx`: 手札から `idx` 番目の札を出す（`handPlay === 'on'` 時）
- **`board` スキーマ**:
  ```json
  {
    "kind": "butanoshippo", "me": 0, "n": 4, "turn": 0,
    "ring": [1, 1, ...],          // ジョーカーなし52枚、あり54枚 (1=裏向きで残っている, 0=取得済み)
    "ringRemain": 52,
    "pileTop": null, "pileCount": 0,
    "handCounts": [0, 0, 0, 0],
    "myHand": [],                 // 自分の手札のみ公開
    "lastAction": null
  }
  ```

---

## 4. ババ抜き / ジジ抜き (`oldmaid`)

- **概要**: ペアを捨て、隣から1枚引いてペアができたら捨て、最後にババ（またはジジ）を持っていた人が負け。
- **ローカルルール (`options`)**:
  - `players`: `'2'`〜`'6'` (既定 `'4'`)
  - `variant`: `'baba'` (ババ抜き・JOKER 1枚) / `'jiji'` (ジジ抜き・52枚から1枚抜く) / `'queen'` (♠Qをババにするクイーン抜き)
  - `drawDir`: `'left'` (右隣/前順から引く・標準) / `'right'` (左隣から引く)
  - `shuffleHand`: `'on'` (シャッフルボタンあり) / `'off'` (なし)
- **操作 (`move`)**:
  - `0..(targetHandCount - 1)`: 相手（`target`）の手札から `i` 番目を引く
  - `100`: 手番中に自分の手札を1回混ぜる（`allowShuffle` 時）
- **`board` スキーマ**:
  ```json
  {
    "kind": "oldmaid", "me": 0, "n": 4, "variant": "baba",
    "turn": 0, "target": 1,       // target = 引かれる相手の席番号
    "handCounts": [6, 7, 7, 7],
    "myHand": [{"id": 2, "t": "♠3"}, ...],
    "outOrder": [],               // 抜けた席番号順
    "loser": -1, "lastDraw": null, "allowShuffle": true, "removedCard": null
  }
  ```

---

## 5. ハーツ (`hearts`)

- **概要**: 4人用トリックテイキング。ハート（各1点）と♠Q（13点）を取らないように立ち回り、誰かが目標点に達したら最少点の人が勝ち。シュート・ザ・ムーンあり。
- **ローカルルール (`options`)**:
  - `target`: `'50'` / `'100'` (終了目標点)
  - `passRule`: `'standard'` (左→右→対面→なしの4週回) / `'none'` (パスなし)
  - `jd`: `'off'` / `'minus10'` (♦Jを取ると-10点ボーナス)
  - `queenBreaks`: `'off'`（標準） / `'on'`（♠Qを出したときもハートを解禁）
  - `shootMoon`: `'add26'` (他3人に+26点) / `'sub26'` (自分-26点)
- **操作 (`move`)**:
  - フェーズ `'pass'`: `0..51` (手札のカードID) で3枚選択/解除、`52` で3枚パス確定
  - フェーズ `'play'`: `0..51` (出せる合法カードのID)
- **`board` スキーマ**:
  ```json
  {
    "kind": "hearts", "me": 0, "roundNo": 1, "phase": "pass", "passDir": 1,
    "turn": 0, "trickNo": 1, "broken": false,
    "handCounts": [13, 13, 13, 13],
    "myHand": [...], "myPassPicks": [],
    "trick": [{"seat": 0, "card": {...}}, ...],
    "lastTrick": null, "roundPts": [0,0,0,0], "totalScores": [0,0,0,0]
  }
  ```

---

## 6. ジンラミー (`ginrummy`)

- **概要**: 10枚の手札で同数3〜4枚（セット）や同スート連番3枚以上（ラン）を作り、メルド以外の合計（デッドウッド）を10以下にしてノック／ジンを狙う2人用ゲーム。
- **ローカルルール (`options`)**:
  - `target`: `'50'` / `'100'` (勝利目標点)
  - `knockRule`: `'standard'` (10以下でノック可) / `'oklahoma'` (最初の表札の数字がノック上限) / `'straight_gin'` (ジン=0のみ)
  - `aceHigh`: `'low'` (Aは1のみ) / `'both'` (Q-K-Aもラン可)
- **操作 (`move`)**:
  - フェーズ `'draw'`: `0` = 山札から引く、`1` = 捨て札から引く
  - フェーズ `'discard'`: `10 + cardId` = 手札からそのカードを捨てる、`100 + cardId` = そのカードを捨ててノック／ジン宣言！
- **`board` スキーマ**:
  ```json
  {
    "kind": "ginrummy", "me": 0, "roundNo": 1, "turn": 0, "phase": "draw",
    "knockLimit": 10, "scores": [0, 0],
    "stockCount": 31, "discardTop": {...}, "discardCount": 1, "oppCount": 10,
    "myHand": [...],
    "myMelds": [[...]],           // 自動計算された最適メルド
    "myDeadwood": 39,             // 自動計算されたデッドウッド点
    "revealedHands": null, "lastRoundResult": null
  }
  ```

---

## 7. ハゲタカのえじき (`vulture`)

- **概要**: 中央に出た得点カード（−5〜−1、1〜10）に対し、全員が手札（1〜15）から1枚ずつ伏せて同時出し。一番大きい（マイナス時は一番小さい）人が獲得。**同じ数字を出した人はバッティングで無効**。
- **ローカルルール (`options`)**:
  - `players`: `'2'`〜`'5'` (既定 `'4'`)
  - `tieCarry`: `'discard'` (全員同値で流す) / `'carry'` (次のラウンドへキャリーオーバー)
- **操作 (`move`)**:
  - `1..15`: 手札から出す数字カード（席順に入力し、全員出し終えると自動で開票）
- **`board` スキーマ**:
  ```json
  {
    "kind": "vulture", "me": 0, "n": 4, "turn": 0, "roundNo": 1,
    "currentTarget": 4, "carryPot": [],
    "scores": [0, 0, 0, 0],
    "pickedFlags": [false, false, false, false],
    "myHand": [1, 2, ..., 15], "myPick": 0, "lastRound": null
  }
  ```

---

## 8. ごいた (`goita`)

- **概要**: 対面同士（0&2 vs 1&3）の2vs2チーム戦。8枚の手持ち駒（し・香・馬・銀・金・角・飛・王）を、相手の「攻め」を同じ駒（または王）で「受け」てから新たな「攻め」を出し、最初に8枚すべて出し切った人が属するチームが得点（最後の上がり駒の点。受けと攻めが同じなら2倍）。
- **ローカルルール (`options`)**:
  - `target`: `'100'` / `'150'` (先取目標点)
  - `kingDouble`: `'on'` (王上がり2倍あり) / `'off'` (なし)
  - `fiveShi`: `'redeal'` (手番で「し」5枚以上なら配り直し) / `'ignore'` (そのまま続行)
- **駒コード (`0..7`)**: `0:し(10)`, `1:香(20)`, `2:馬(20)`, `3:銀(30)`, `4:金(30)`, `5:角(40)`, `6:飛(40)`, `7:王(50)`
- **操作 (`move`)**:
  - フェーズ `'block'`: `0..7` = 受けに出す駒、`99` = パス（受けない）
  - フェーズ `'attack'`: `0..7` = 攻めに出す駒
- **`board` スキーマ**:
  ```json
  {
    "kind": "goita", "me": 0, "roundNo": 1, "turn": 0, "phase": "attack",
    "activeAttack": -1, "activeAttackName": "", "attacker": 0,
    "teamScores": [0, 0], "handCounts": [8, 8, 8, 8],
    "myHand": [0, 0, 0, 3, 3, 5, 5, 7],
    "played": [[], [], [], []],   // 各席の場に出た駒履歴（{piece, faceDown}）
    "lastRoundResult": null,
    "pieceNames": ["し","香","馬","銀","金","角","飛","王"],
    "piecePts": [10,20,20,30,30,40,40,50]
  }
  ```

---

## 9. クアルト (`quarto`)

- **概要**: 4×4盤で4つの特徴（色・高さ・形・穴）のうち1つ以上が共通する4つを縦・横・斜めに並べる。自分で置くコマは相手が選ぶ。
- **コマID (`0..15`)**: 4ビット表現
  - `bit 0` (`p & 1`): 色 (0=淡, 1=濃)
  - `bit 1` (`(p>>1) & 1`): 高さ (0=低, 1=高)
  - `bit 2` (`(p>>2) & 1`): 形 (0=丸, 1=四角)
  - `bit 3` (`(p>>3) & 1`): 穴 (0=なし, 1=あり)
- **ローカルルール (`options`)**:
  - `square2x2`: `'off'` (標準) / `'on'` (2×2の四角でも勝ち)
- **操作 (`move`)**:
  - フェーズ `'pick'`: `0..15` = 相手に渡す未使用コマID
  - フェーズ `'place'`: `0..15` = `chosenPiece` を置く盤面マス番号（`r*4+c`）
- **`board` スキーマ**:
  ```json
  {
    "kind": "quarto", "me": 0, "turn": 0, "phase": "pick",
    "board": [-1, ...],           // 長さ16 (-1=空, 0..15=コマID)
    "chosenPiece": -1, "usedMask": 0, "winLine": null,
    "square2x2": false, "lastCell": -1
  }
  ```

---

## 10. ガイスター (`geister`)

- **概要**: 6×6盤。自分からは青4・赤4が見え、相手からは色が見えない。相手青4全取り / 自赤4を相手に取らせる / 自青を相手側奥の角 `(0,0),(0,5)` (先手) または `(5,0),(5,5)` (後手) から脱出させる、のいずれかで勝ち。
- **ローカルルール (`options`)**:
  - `setup`: `'manual'` (初期配置で入れ替え可・標準) / `'random'` (即対局開始)
- **操作 (`move`)**:
  - フェーズ `'setup'`: `a * 8 + b` (`0..63`) = 自陣8枠の `a` 番目と `b` 番目のオバケを入れ替える、`99` = 配置決定
  - フェーズ `'play'`: `from * 36 + to` (`0..1295`) = `from` から隣接マス `to` へ移動、`2000 + from` = 出口マスにいる青オバケを脱出させる
- **`board` スキーマ**:
  ```json
  {
    "kind": "geister", "me": 0, "turn": 0, "phase": "setup",
    "board": [0, 3, ...],         // 長さ36 (0=空, 1=青, 2=赤, 3=相手の隠されたオバケ)
    "owners": [-1, 1, ...],       // 長さ36 (-1=空, 0=先手, 1=後手)
    "captured": [{"blue":0,"red":0}, {"blue":0,"red":0}],
    "moves": 0, "lastFrom": -1, "lastTo": -1
  }
  ```

---

## 11. ラミィキューブ (`rummikub`)

- **概要**: 1〜13（4色×2組）＋ジョーカー2枚の106枚。グループ（同数字・異色3〜4枚）とラン（同色連番3枚以上）を場に出し、手牌をすべて出し切れば勝ち。
- **タイルオブジェクト**: `{ id: number, n: 1..13|0, c: 0..3|4, t: "1".."13"|"JOKER" }` (`c`: 0=赤, 1=青, 2=黒, 3=黄, 4=ジョーカー)
- **ローカルルール (`options`)**:
  - `players`: `'2'`〜`'4'` (既定 `'2'`)
  - `initialMeld`: `'30'` (初回は手牌のみで合計30点以上・標準) / `'off'` (制限なし)
  - `jokerPenalty`: `'30'` (残りジョーカー-30点) / `'50'` (-50点)
- **操作 (`move`)**:
  - `0`: このターンの操作を戻して山から1枚引き、手番終了
  - `1`: ターン確定（1枚以上出し、場の全組が有効で、初回30点条件を満たすときのみ合法）
  - `2`: このターンの操作をすべてリセット
  - `100 + r`: 自分の手牌の `r` 番目を選択
  - `2000 + s * 32 + i`: 場の組 `s` の `i` 番目のタイルを選択（初回出し完了後、または今ターン作った組のみ）
  - `500 + s`: 選択中タイルを場の組 `s` へ移動
  - `599`: 選択中タイルで新しい組を場に作る
  - `600`: 選択中の場のタイル（今ターン手牌から出したもののみ）を手牌に戻す
- **`board` スキーマ**:
  ```json
  {
    "kind": "rummikub", "me": 0, "players": 2, "turn": 0, "poolCount": 78,
    "table": [[...], ...],        // 場の組の配列
    "rackCounts": [14, 14],
    "racks": [[...], []],         // me の手牌のみ公開
    "initialDone": [false, false],
    "selected": null,             // {src:'rack',idx} | {src:'table',setIdx,tileIdx} | null
    "newlyPlayed": [],            // 今ターン出したタイルID配列
    "needInitial30": true, "lastAction": ""
  }
  ```

---

## 12. ペグ・ソリティア (`pegsolitaire`)

- **概要**: 1人用古典パズル。隣のペグを飛び越えて取り除き、最後に1本だけ残す（イギリス式で中央に残ればパーフェクト）。
- **ローカルルール (`options`)**:
  - `board`: `'english'` (イギリス式33穴・7×7十字) / `'european'` (ヨーロッパ式37穴) / `'triangle'` (三角形15穴)
- **操作 (`move`)**:
  - `from * 64 + to`: 穴インデックス `from` のペグを飛び越え先の空き穴 `to` へ移動
- **`board` スキーマ**:
  ```json
  {
    "kind": "pegsolitaire", "me": 0, "boardType": "english",
    "rows": 7, "cols": 7,
    "holes": [[0,2], [0,3], ...], // 各穴インデックス i の [row, col] 座標
    "cells": [1, 1, ..., 0, ...], // 1=ペグあり, 0=空き穴
    "pegsLeft": 32, "moves": 0, "centerIdx": 16, "lastFrom": -1, "lastTo": -1
  }
  ```
