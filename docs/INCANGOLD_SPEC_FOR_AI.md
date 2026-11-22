# インカの黄金 (`incangold`) 処理仕様＆UI引き継ぎマニュアル

このドキュメントは `web/pc-firebase/` に追加された **インカの黄金 (`incangold`, No.47)** のゲームロジック・ローカルルール・`move` エンコード・`viewJson` スキーマの完全仕様です。
**盤面UI・デザイン・CSS・アイコン・`js/app.js` の `ORDER` 登録・`window.RENDER.incangold` は未実装** のため、他AI・開発者が本仕様に従って盤面UIとメニュー統合を実装してください。

---

## 0. 実装済みコアファイルと登録状況

- **ゲームエンジン**: `web/pc-firebase/core/games/incangold.mjs`
  - エクスポート: `INCANGOLD_SPEC`, `INCANGOLD_MOVE_RETURN` (`0`), `INCANGOLD_MOVE_CONTINUE` (`1`), `INCANGOLD_TOTAL_ROUNDS` (`5`), `INCANGOLD_HAZARD_TYPES`
- **カタログ登録**: `web/pc-firebase/core/extra-games.mjs` に `INCANGOLD_SPEC` を登録済み。
- **Service Worker**: `web/pc-firebase/sw.js` の `FILES` に `./core/games/incangold.mjs` を追加済み。
- **単体テスト**: `node tools/tests/test_incangold_core.mjs`（全通過確認済み）

---

## 1. ゲーム基本仕様 & オプション (`options`)

| 項目 | 値 |
|---|---|
| `id` | `'incangold'` |
| `no` | `47` |
| `name` | `'インカの黄金'` |
| `category` | `'BOARD'` (`Category_BOARD`) |
| `players` | `'3〜6人'` |
| `seatNames` | `['1番', '2番', '3番', '4番', '5番', '6番']` |
| `undoAllowed` | `false` |
| `concurrent` | `false`（※探検中の席が順に伏せて選択し、全員選んだ瞬間に一斉公開・解決する `vulture` 互換方式） |

### ローカルルール / 設定オプション
- `players` (`group: 'rule'`, 既定 `'4'`): `'3'`〜`'6'`（3〜6人）
- `artifacts` (`group: 'local'`, 既定 `'on'`):
  - `'on'`: あり(標準) — 各ラウンド開始時に遺物カードを1枚山札へ追加。1人だけで帰還した時のみ道にある遺物を独占獲得（累計1〜3枚目は5点、4〜5枚目は10点）。
  - `'off'`: なし

---

## 2. カード構成とルール詳細

- **宝石カード (15枚)**: `1, 2, 3, 4, 5, 5, 7, 7, 9, 11, 11, 13, 14, 15, 17`
- **障害カード (5種 × 各3枚 = 15枚)**: `snake`(毒蛇), `spider`(毒蜘蛛), `mummy`(ミイラ), `fire`(炎), `rock`(落石)
- **遺物カード (最大5枚)**: `artifacts === 'on'` のときラウンド `1..5` で各1枚追加。
- 各ラウンド開始時、1枚目が自動公開されます。
- 同じ種類の障害カードが2枚出るとバーストし、探検中の全員の `roundGems` が没収され、原因となった障害カード1枚は以降のラウンドから永久除外 (`removedHazards`) されます。
- 全5ラウンド終了時、`tentGems` が最大のプレイヤーが勝者（同率首位は `winner = -1` 引き分け）。

---

## 3. 手 (`move`) エンコード

| `move` 値 | 定数名 | 意味 |
|---|---|---|
| `0` | `INCANGOLD_MOVE_RETURN` | 帰る（キャンプに戻る） |
| `1` | `INCANGOLD_MOVE_CONTINUE` | 進む（探検を続ける） |

---

## 4. `viewJson(h, me)` の `board` スキーマ

```json
{
  "kind": "incangold",
  "me": 0,
  "n": 4,
  "roundNo": 1,
  "totalRounds": 5,
  "turn": 0,
  "useArtifacts": true,
  "tentGems": [0, 0, 0, 0],
  "roundGems": [2, 2, 2, 2],
  "inCave": [true, true, true, true],
  "pathGems": 1,
  "pathCards": [{ "kind": "gem", "value": 9, "label": "宝石9" }],
  "pathArtifactsCount": 0,
  "hazardCounts": {},
  "removedHazards": {},
  "artifactsClaimedTotal": 0,
  "nextArtifactValue": 5,
  "decided": [false, false, false, false],
  "myChoice": -1,
  "deckCount": 30,
  "lastStep": null,
  "lastRound": null,
  "done": false
}
```

### 隠匿情報マスキング仕様
- 他人の選択中身（進む/帰る）は一斉公開前には一切露出しない（`decided[i]` のみ公開、`myChoice` は本人のみ）。
- `deck` は非公開（`deckCount` のみ）。
- `lastStep` に直前の同時公開結果（`returners`, `stayers`, `sharedPathGems`, `claimedArtifactPts`, `claimedArtifactCount`, `bankedBySeat`, `drawnCard`, `busted`, `bustHazard`）、`lastRound` に直前ラウンド終了結果（`roundNo`, `busted`, `bustHazard`, `lostBySeat`, `tentGems`）を収録。

---

## 5. UI 実装・統合時のチェックリスト（他AI向け）

1. `js/app.js` の `ORDER` に `'incangold'` を追加、`js/art.js` にアイコン追加。
2. 盤面描画 (`window.RENDER.incangold`) を実装:
   - 上部/中央に探検の道 (`pathCards`)、道に落ちている宝石 (`pathGems`)、道の遺物 (`pathArtifactsCount`)、現在の障害アイコンを表示。
   - 各プレイヤー席に「テントの確定宝石 (`tentGems`)」「探検中の手持ち宝石 (`roundGems`)」「探検中/帰還済み状態 (`inCave`)」「選択済みバッジ (`decided`)」を表示。
   - 自分の手番で「進む (`1`)」「帰る (`0`)」の2択ボタンを表示。
   - `lastStep` / `lastRound` 更新時に一斉公開（帰還者＋持ち帰り宝石＋新カードめくり／バースト演出）を表示。
3. `sw.js`・`START_HERE.md` を更新。
