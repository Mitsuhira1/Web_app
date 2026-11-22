# コヨーテ (`coyote`) 処理仕様＆UI引き継ぎマニュアル

このドキュメントは `web/pc-firebase/` に追加された **コヨーテ (`coyote`, No.44)** のゲームロジック・ローカルルール・`move` エンコード・`viewJson` スキーマの完全仕様です。
**盤面UI・デザイン・CSS・アイコン・`js/app.js` の `ORDER` 登録・`window.RENDER.coyote` は未実装** のため、他AI・開発者が本仕様に従って盤面UIとメニュー統合を実装してください。

---

## 0. 実装済みコアファイルと登録状況

- **ゲームエンジン**: `web/pc-firebase/core/games/coyote.mjs`
  - エクスポート: `COYOTE_SPEC`, `COYOTE_CARDS`, `COYOTE_MOVE_COYOTE`, `COYOTE_MAX_BID`, `coyoteCardObj`, `evaluateCoyoteCards`
- **カタログ登録**: `web/pc-firebase/core/extra-games.mjs` に `COYOTE_SPEC` を登録済み。
- **Service Worker**: `web/pc-firebase/sw.js` の `FILES` に `./core/games/coyote.mjs` を追加済み（UIファイル追加時に `sw.js` へ追記すること）。
- **単体テスト**: `node tools/tests/test_coyote_core.mjs`（全通過確認済み）

---

## 1. ゲーム基本仕様 & オプション (`options`)

| 項目 | 値 |
|---|---|
| `id` | `'coyote'` |
| `no` | `44` |
| `name` | `'コヨーテ'` |
| `category` | `'CARD'` (`Category_CARD`) |
| `players` | `'2〜6人'` |
| `seatNames` | `['1番', '2番', '3番', '4番', '5番', '6番']` |
| `undoAllowed` | `false` |
| `concurrent` | `false`（順番手番制） |

### ローカルルール / 設定オプション
- `players` (`group: 'rule'`, 既定 `'4'`): `'2'`〜`'6'`（2〜6人）
- `specialCards` (`group: 'local'`, 既定 `'on'`):
  - `'on'`: あり(標準) — 特殊カード4枚を含む全36枚
  - `'off'`: なし(数字のみ) — 通常数字カード32枚のみ（初心者・時短向け）
- `lives` (`group: 'local'`, 既定 `'3'`):
  - `'3'`: 3回負けで脱落(標準)
  - `'2'`: 2回負けで脱落
  - `'1'`: 1回負けで即終了(時短) — 2人戦では1回負けたら即決着、3〜6人戦では1回負けで脱落し最後の1人が勝者

---

## 2. カード構成 (`COYOTE_CARDS[0..35]`) と合計値計算

### カード一覧（全36枚）
- **通常数字カード (`kind: 'num'`, `id: 0..31`, 計32枚)**:
  - `20` × 1 (`id: 0`), `15` × 2 (`1..2`), `10` × 3 (`3..5`), `5` × 4 (`6..9`), `4` × 4 (`10..13`), `3` × 4 (`14..17`), `2` × 4 (`18..21`), `1` × 4 (`22..25`), `0` × 3 (`26..28`), `-5` × 2 (`29..30`), `-10` × 1 (`31`)
- **特殊カード (`id: 32..35`, 計4枚)**:
  - `id: 32`: `kind: 'zero_reshuffle'`, `value: 0`, `label: '0(夜)'`, `short: '0★'` — 値は0。このカードが出たラウンド終了後、山札と捨て札をすべて混ぜてシャッフルし直す。
  - `id: 33`: `kind: 'double'`, `value: 0`, `label: '×2'`, `short: '×2'` — 場の合計値を2倍にする（負の合計も2倍）。
  - `id: 34`: `kind: 'max0'`, `value: 0`, `label: 'MAX→0'`, `short: 'MAX→0'` — 場にある正の数字カード(`value > 0`)のうち最大の1枚を0として扱う（同率最大が複数ある場合は1枚のみ0化。正の数字が無い場合は変化なし）。
  - `id: 35`: `kind: 'mystery'`, `value: 0`, `label: '?'`, `short: '?'` — コヨーテ指摘時の公開処理で山札から1枚追加でめくり、そのカードの値・効果を適用する（山札が空なら捨て札をシャッフルして引く）。

### 合計値計算の順序 (`evaluateCoyoteCards`)
1. `?` が場にあれば山札から1枚追加する（追加されたカードが `×2` / `MAX→0` / `0(夜)` でも有効）。
2. `MAX→0` があれば、正の数字カードの中で最大の1枚を `0` にする。
3. 数字カードの合計 `baseSum` を計算する。
4. `×2` があれば `finalTotal = baseSum * 2`、無ければ `finalTotal = baseSum`。

---

## 3. 手 (`move`) エンコード

| `move` 値 | 意味 | 合法条件 |
|---|---|---|
| `0` (`COYOTE_MOVE_COYOTE`) | 「コヨーテ！」と指摘 | `currentBid > 0` のときのみ合法（初手では不可） |
| `1..160` | 数字 `move` を宣言 | `currentBid < move <= 160` のとき合法 |

- 上限 `160` が宣言された場合、次のプレイヤーは `0`（コヨーテ）のみ合法。
- 勝敗判定:
  - `bid > finalTotal` → 宣言者 (`lastBidder`) の負け（ライフ −1）
  - `bid <= finalTotal` → 指摘者 (`caller`) の負け（ライフ −1）
- 次ラウンドの開始プレイヤー: 敗者が生存していれば敗者、脱落した場合は敗者の次の生存者。
- 生存者が残り1人になった時点でゲーム終了（`outcome.winner = 勝者の席番号`, `outcome.reason = '第Nラウンドで決着'`）。
- `scores`: 各席の残りライフ `Int32Array`。

---

## 4. `viewJson(h, me)` の `board` スキーマ

```json
{
  "kind": "coyote",
  "me": 0,
  "n": 4,
  "roundNo": 1,
  "turn": 0,
  "maxLives": 3,
  "specialCards": true,
  "lives": [3, 3, 3, 3],
  "losses": [0, 0, 0, 0],
  "alive": [true, true, true, true],
  "cards": [
    { "hidden": true },
    { "id": 3, "kind": "num", "value": 10, "label": "10", "short": "10" },
    { "id": 33, "kind": "double", "value": 0, "label": "×2", "short": "×2" },
    null
  ],
  "currentBid": 12,
  "lastBidder": 0,
  "canCoyote": true,
  "minBid": 13,
  "maxBid": 160,
  "bidHistory": [
    { "seat": 0, "bid": 12 }
  ],
  "deckCount": 32,
  "discardCount": 0,
  "discard": [],
  "lastRound": null,
  "done": false
}
```

### 隠匿情報マスキング仕様
- 対局中 (`done === false`):
  - `cards[me]` は必ず `{ hidden: true }`（自分のカードは見えない）。
  - 他の生存者の `cards[i]` は `{ id, kind, value, label, short }` で完全公開。
  - 脱落者 (`!alive[i]`) は `null`。
  - 観戦者 (`me < 0 || me >= n`) は生存者全員が `{ hidden: true }`。
- 決着後 (`done === true`): 最終ラウンドに参加していた全員のカードが公開される。
- `deck`（山札の中身）は `viewJson` に一切含まれない（`deckCount` のみ）。

### `lastRound` スキーマ（コヨーテ判定直後にセット）
コヨーテが指摘されると即座に判定が行われ、決着していない場合は次ラウンドが自動配布されます。UI側では `lastRound.roundNo` の変化を検知して、公開演出（全員のカード表示・`?` カードめくり・`MAX→0`/`×2` の計算式・敗者表示）を行う設計です。

```json
{
  "roundNo": 1,
  "cards": [ { "id": 0, "kind": "num", "value": 20, "label": "20", "short": "20" }, ... ],
  "mysteryCard": null,
  "baseSum": 25,
  "maxZeroedId": null,
  "maxZeroedValue": 0,
  "doubled": false,
  "finalTotal": 25,
  "bid": 28,
  "bidder": 0,
  "caller": 1,
  "over": true,
  "loser": 0,
  "eliminated": false,
  "reshuffled": false
}
```

---

## 5. UI 実装・統合時のチェックリスト（他AI向け）

1. `web/pc-firebase/js/app.js` の `ORDER` に `'coyote'` を追加。
2. `web/pc-firebase/js/art.js` にメニューアイコンを追加し `node tools/build_game_icons.cjs` で画像生成。
3. 盤面描画 (`window.RENDER.coyote`) を実装:
   - 各プレイヤー席にカード（自分は裏向き、他人は表向き）と残りライフ（ハート/星等）を表示。
   - 自分の手番で数字入力（`minBid`〜`maxBid` のステッパー／クイック加算ボタン等）と「宣言」ボタン、および `canCoyote` 時の「コヨーテ！」ボタンを表示。
   - `lastRound.roundNo` が更新されたら、全員のカード公開＆合計計算の内訳（`?`・`MAX→0`・`×2`）＆敗者カットイン／オーバーレイを表示。
4. `web/pc-firebase/js/sfx.js` に効果音（宣言・コヨーテ指摘・カード公開）を追加。
5. `web/pc-firebase/sw.js` に新規UIファイルを追加しキャッシュ名を更新。
6. `START_HERE.md` のゲーム一覧表を更新。
