# スカル (`skull`) 処理仕様＆UI引き継ぎマニュアル

このドキュメントは `web/pc-firebase/` に追加された **スカル (`skull`, No.45)** のゲームロジック・ローカルルール・`move` エンコード・`viewJson` スキーマの完全仕様です。
**盤面UI・デザイン・CSS・アイコン・`js/app.js` の `ORDER` 登録・`window.RENDER.skull` は未実装** のため、他AI・開発者が本仕様に従って盤面UIとメニュー統合を実装してください。

---

## 0. 実装済みコアファイルと登録状況

- **ゲームエンジン**: `web/pc-firebase/core/games/skull.mjs`
  - エクスポート: `SKULL_SPEC`, `SKULL_CARD_FLOWER` (`0`), `SKULL_CARD_SKULL` (`1`), `SKULL_MOVE_PASS`, `SKULL_MOVE_PLACE_FLOWER`, `SKULL_MOVE_PLACE_SKULL`, `SKULL_MOVE_REVEAL_BASE`, `SKULL_MOVE_DISCARD_FLOWER`, `SKULL_MOVE_DISCARD_SKULL`
- **カタログ登録**: `web/pc-firebase/core/extra-games.mjs` に `SKULL_SPEC` を登録済み。
- **Service Worker**: `web/pc-firebase/sw.js` の `FILES` に `./core/games/skull.mjs` を追加済み。
- **単体テスト**: `node tools/tests/test_skull_core.mjs`（全通過確認済み）

---

## 1. ゲーム基本仕様 & オプション (`options`)

| 項目 | 値 |
|---|---|
| `id` | `'skull'` |
| `no` | `45` |
| `name` | `'スカル'` |
| `category` | `'CARD'` (`Category_CARD`) |
| `players` | `'3〜6人'` |
| `seatNames` | `['1番', '2番', '3番', '4番', '5番', '6番']` |
| `undoAllowed` | `false` |
| `concurrent` | `false`（順番手番制） |

### ローカルルール / 設定オプション
- `players` (`group: 'rule'`, 既定 `'4'`): `'3'`〜`'6'`（3〜6人）
- `targetPoints` (`group: 'local'`, 既定 `'2'`):
  - `'2'`: 2ポイント先取(標準)
  - `'1'`: 1ポイント先取(時短)

---

## 2. フェーズ (`phase`) とルール詳細

各プレイヤーは初期状態で「花3枚・ドクロ1枚」の計4枚を所有します。

1. `initial_place`: ラウンド開始時、生存者全員が自分の前に1枚ずつ伏せて置きます。全員置き終わると `play_or_bid` へ。
2. `play_or_bid`: 手番プレイヤーは「手札から1枚伏せて自分の山の上に追加」または「チャレンジ枚数 (`1..totalPlaced`) を宣言」を選びます。
   - 手札が0枚の場合は必ずチャレンジ宣言。
   - 宣言枚数が `totalPlaced`（場の総枚数）ちょうどの場合、セリを飛ばして即 `reveal` へ。
3. `bidding`: 誰かが宣言した後のセリ。未パスの生存者が順に「より大きい枚数 (`currentBid + 1 .. totalPlaced`)」を宣言するか「パス (`0`)」を選びます。
   - 最高宣言者以外の全員がパス、または `totalPlaced` 宣言で `reveal` へ。
4. `reveal`: 最高宣言者 (`challenger`) がカードをめくります。
   - **自分の場に未公開カードが残っている間は必ず自分の山の上からめくる**（`mustRevealOwn === true`）。
   - 自分の山をすべてめくり終えたら、未公開カードが残っている他人の山から1つ選んで上からめくる。
   - 花を宣言枚数ぶん連続でめくればチャレンジ成功（+1pt、目標ポイント到達で勝利、未到達なら `challenger` を親にして次ラウンド）。
   - ドクロをめくると失敗：
     - **自分のドクロ**かつ花・ドクロ両方所有している場合 → `discard_own` フェーズへ（自分で捨てる種別を選ぶ）。
     - **自分のドクロ**で1種しか残っていない場合 → 自動でその1枚を永久喪失。
     - **他人のドクロ**の場合 → 決定論的PRNGで持ちカードからランダム1枚を永久喪失。次ラウンドの親はそのドクロの持ち主。
   - 持ちカードが0枚になると脱落。生存者が残り1人になったらその1人の勝利。
5. `discard_own`: 自分のドクロを踏んだ際、永久に失うカード（花またはドクロ）を選択。選択後に次ラウンドへ。
6. `done`: 決着済み。

---

## 3. 手 (`move`) エンコード

| `move` 値 | 定数名 | 意味 | 合法フェーズ |
|---|---|---|---|
| `0` | `SKULL_MOVE_PASS` | パス | `bidding` |
| `1..24` | — | 枚数宣言 (`1..totalPlaced` / `currentBid+1..totalPlaced`) | `play_or_bid`, `bidding` |
| `100` | `SKULL_MOVE_PLACE_FLOWER` | 花を伏せて置く | `initial_place`, `play_or_bid` |
| `101` | `SKULL_MOVE_PLACE_SKULL` | ドクロを伏せて置く | `initial_place`, `play_or_bid` |
| `200..205` | `SKULL_MOVE_REVEAL_BASE + seat` | 指定席の山の上から1枚めくる | `reveal` |
| `300` | `SKULL_MOVE_DISCARD_FLOWER` | 花を1枚永久喪失 | `discard_own` |
| `301` | `SKULL_MOVE_DISCARD_SKULL` | ドクロを1枚永久喪失 | `discard_own` |

---

## 4. `viewJson(h, me)` の `board` スキーマ

```json
{
  "kind": "skull",
  "me": 0,
  "n": 4,
  "roundNo": 1,
  "phase": "play_or_bid",
  "turn": 0,
  "targetPoints": 2,
  "points": [0, 0, 0, 0],
  "alive": [true, true, true, true],
  "totalCards": [4, 4, 4, 4],
  "handCounts": [3, 3, 3, 3],
  "myHand": { "flowers": 2, "skulls": 1 },
  "myOwned": { "flowers": 3, "skulls": 1 },
  "stacks": [
    [{ "revealed": false, "card": 0 }],
    [{ "revealed": false, "hidden": true }],
    [{ "revealed": false, "hidden": true }],
    [{ "revealed": false, "hidden": true }]
  ],
  "stackCounts": [1, 1, 1, 1],
  "revealedCounts": [0, 0, 0, 0],
  "totalPlaced": 4,
  "currentBid": 0,
  "challenger": -1,
  "passed": [false, false, false, false],
  "bidHistory": [],
  "revealedCount": 0,
  "revealedSeq": [],
  "mustRevealOwn": false,
  "lastRound": null,
  "done": false
}
```

### 隠匿情報マスキング仕様
- `myHand` / `myOwned`: 本人 (`0 <= me < n`) のみ開示、観戦者 (`me < 0`) は `null`。
- `stacks[i]`: インデックス `0` が底、末尾が一番上。
  - 公開済みカード (`revealed: true`) または決着後 (`done: true`) は全員に `card` (`0`=花, `1`=ドクロ) を開示。
  - 未公開カードは本人の山 (`i === me`) のみ `card` を開示し、他人の山は `{ revealed: false, hidden: true }`。
- `lastRound.lostCard`: 他人のドクロでランダム喪失したカードの種別は、本人または決着後のみ開示（他人からは `null`）。

---

## 5. UI 実装・統合時のチェックリスト（他AI向け）

1. `js/app.js` の `ORDER` に `'skull'` を追加、`js/art.js` にアイコンを追加して画像生成。
2. 盤面描画 (`window.RENDER.skull`) を実装:
   - 各プレイヤーのマット上に積まれたカード枚数と公開済みカード（花/ドクロ）、ポイント、残り持ちカード総数を表示。
   - `initial_place` / `play_or_bid`: 花/ドクロを伏せるボタン＋チャレンジ宣言（数値選択）。
   - `bidding`: 現在の最高宣言・パス済み表示・上げ幅選択・パスボタン。
   - `reveal`: 自分の山が残っている間は自分の山を強調（`mustRevealOwn`）、その後はめくれる他人の山をクリック可能に。
   - `discard_own`: 花かドクロのどちらを永久に捨てるか選択モーダル／ボタン。
   - `lastRound.roundNo` 更新時にチャレンジ結果（成功＋1pt／ドクロ被弾）を演出表示。
3. `sw.js`・`START_HERE.md` を更新。
