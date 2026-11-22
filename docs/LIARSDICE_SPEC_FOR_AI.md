# ライアーズダイス / ブラフ (`liarsdice`) 処理仕様＆UI引き継ぎマニュアル

このドキュメントは `web/pc-firebase/` に追加された **ライアーズダイス (`liarsdice`, No.46)** のゲームロジック・ローカルルール・`move` エンコード・`viewJson` スキーマの完全仕様です。
**盤面UI・デザイン・CSS・アイコン・`js/app.js` の `ORDER` 登録・`window.RENDER.liarsdice` は未実装** のため、他AI・開発者が本仕様に従って盤面UIとメニュー統合を実装してください。

---

## 0. 実装済みコアファイルと登録状況

- **ゲームエンジン**: `web/pc-firebase/core/games/liarsdice.mjs`
  - エクスポート: `LIARSDICE_SPEC`, `LIARSDICE_MAX_DICE` (`5`), `LIARSDICE_MOVE_DOUBT` (`0`), `LIARSDICE_MOVE_EXACT` (`1`), `encodeLiarsBid`, `decodeLiarsBid`, `isHigherLiarsBid`, `countMatchingDice`
- **カタログ登録**: `web/pc-firebase/core/extra-games.mjs` に `LIARSDICE_SPEC` を登録済み。
- **Service Worker**: `web/pc-firebase/sw.js` の `FILES` に `./core/games/liarsdice.mjs` を追加済み。
- **単体テスト**: `node tools/tests/test_liarsdice_core.mjs`（全通過確認済み）

---

## 1. ゲーム基本仕様 & オプション (`options`)

| 項目 | 値 |
|---|---|
| `id` | `'liarsdice'` |
| `no` | `46` |
| `name` | `'ライアーズダイス'` |
| `category` | `'BOARD'` (`Category_BOARD`) |
| `players` | `'2〜6人'` |
| `seatNames` | `['1番', '2番', '3番', '4番', '5番', '6番']` |
| `undoAllowed` | `false` |
| `concurrent` | `false`（順番手番制） |

### ローカルルール / 設定オプション
- `players` (`group: 'rule'`, 既定 `'4'`): `'2'`〜`'6'`（2〜6人）
- `wildOnes` (`group: 'local'`, 既定 `'on'`):
  - `'on'`: あり(標準) — 「1」をすべての出目の代用とし、1の個数宣言は通常の半分（切り上げ）で上書き可能
  - `'off'`: なし — 「1」も通常出目（`1 < 2 < 3 < 4 < 5 < 6`）
- `exactRule` (`group: 'local'`, 既定 `'off'`):
  - `'off'`: なし(標準)
  - `'others_lose'`: 的中時・他全員−1個（外れると自分−1個）
  - `'gain_one'`: 的中時・自分＋1個回復（上限5個、外れると自分−1個）

---

## 2. 宣言の上書き規則 (`isHigherLiarsBid`)

- `wildOnes === false`: `qty > prev.qty` または (`qty === prev.qty && face > prev.face`)。
- `wildOnes === true`:
  - 通常出目 (`2..6`) → 通常出目 (`2..6`): `qty > prev.qty` または (`qty === prev.qty && face > prev.face`)
  - 通常出目 (`2..6`) → `1`: `qty >= Math.ceil(prev.qty / 2)`（例: `4が4個` → `1が2個`）
  - `1` → `1`: `qty > prev.qty`
  - `1` → 通常出目 (`2..6`): `qty >= prev.qty * 2 + 1`（例: `1が2個` → `2が5個` 以上）

---

## 3. 手 (`move`) エンコード

| `move` 値 | 定数 / ヘルパー | 意味 | 合法条件 |
|---|---|---|---|
| `0` | `LIARSDICE_MOVE_DOUBT` | ダウト！ | `currentBid !== null` |
| `1` | `LIARSDICE_MOVE_EXACT` | ジャスト(ピタリ)！ | `currentBid !== null && exactRule !== 'off'` |
| `100 + qty * 10 + face` | `encodeLiarsBid(qty, face)` | 「`face` が `qty` 個以上」と宣言 (`111..406`) | `qty <= totalDice` かつ `isHigherLiarsBid` |

---

## 4. `viewJson(h, me)` の `board` スキーマ

```json
{
  "kind": "liarsdice",
  "me": 0,
  "n": 4,
  "roundNo": 1,
  "turn": 0,
  "wildOnes": true,
  "exactRule": "off",
  "diceCounts": [5, 5, 5, 5],
  "totalDice": 20,
  "alive": [true, true, true, true],
  "dice": [[1, 2, 4, 4, 6], null, null, null],
  "myDice": [1, 2, 4, 4, 6],
  "currentBid": { "qty": 4, "face": 4 },
  "lastBidder": 0,
  "canDoubt": true,
  "canExact": false,
  "bidHistory": [{ "seat": 0, "qty": 4, "face": 4 }],
  "lastRound": null,
  "done": false
}
```

### `lastRound` スキーマ（ダウト / ジャスト解決直後にセット）
```json
{
  "roundNo": 1,
  "allDice": [[1, 2, 4, 4, 6], [1, 3, 5, 5, 6], ...],
  "bid": { "qty": 6, "face": 4 },
  "bidder": 0,
  "caller": 1,
  "action": "doubt",
  "actualCount": 4,
  "callerSuccess": true,
  "losers": [0],
  "gained": -1,
  "eliminated": []
}
```

### 隠匿情報マスキング仕様
- 対局中 (`done === false`): `dice[me]` と `myDice` のみ本人に開示、他人の `dice[i]` は `null`（観戦者 `me < 0` は全員 `null`）。
- 決着後 (`done === true`): 全員の最終ラウンドのサイコロを開示。

---

## 5. UI 実装・統合時のチェックリスト（他AI向け）

1. `js/app.js` の `ORDER` に `'liarsdice'` を追加、`js/art.js` にアイコン追加。
2. 盤面描画 (`window.RENDER.liarsdice`) を実装:
   - 自分のサイコロ出目 (`myDice`) と各プレイヤーのカップ・残りサイコロ個数 (`diceCounts`) を表示。
   - 宣言操作パネル（個数 `qty` × 出目 `1..6` の選択、`legal` に含まれる組み合わせのみ選択可能）＋「ダウト！」ボタン＋(`canExact` 時)「ジャスト！」ボタン。
   - `lastRound.roundNo` 更新時にカップ一斉オープン演出（対象出目とワイルドの `1` をハイライト、実数 `actualCount` vs 宣言 `bid.qty`、増減したサイコロを表示）。
3. `sw.js`・`START_HERE.md` を更新。
