# ルーレット (`roulette`) 処理仕様＆UI引き継ぎマニュアル (Codex向け)

このドキュメントは `web/pc-firebase/` に追加された **ルーレット (`roulette`, No.43)** のゲームロジック・ローカルルール・`move` エンコード・`viewJson` スキーマの完全仕様です。
**ゲームアイコン (`web/pc-firebase/js/art.js` の `AR.roulette`, 準備中リボン付き) とメニュー表示 (`web/pc-firebase/js/app.js` の `ORDER`, `.soon` 扱い) のみ追加済み** で、**盤面UI・デザイン・CSS・`window.RENDER.roulette` は未実装** のため、本仕様に従って盤面UIを実装してください。

---

## 0. 実装済みコアファイルと登録状況

- **ゲームエンジン**: `web/pc-firebase/core/games/roulette.mjs` (`ROULETTE_SPEC`, `ROULETTE_SPOTS`, `ROULETTE_CHIPS`, `EURO_WHEEL`, `AMER_WHEEL`, `RED_NUMS`, `pocketColor`)
- **カタログ登録**: `web/pc-firebase/core/extra-games.mjs` に `ROULETTE_SPEC` を登録済み（`catalogJson()` 全43種）。
- **Service Worker**: `web/pc-firebase/sw.js` に `./core/games/roulette.mjs` を追加済み（UI JSを追加した場合は `sw.js` にも追記してください）。
- **テスト**:
  - `node tools/tests/test_roulette_core.mjs`（152スポット・配当倍率・La Partage・Rebet/Undo/Double/Clear/Remove・エンドレスRebuy・全破産終了・`restoreMatch` 再現性・全難易度CPU完走）
  - `node tools/tests/test_extra_12_games.mjs`（全43ゲーム検証）

---

## 1. ゲーム基本仕様 & オプション (`options`)

| 項目 | 値 |
|---|---|
| `id` | `'roulette'` |
| `no` | `43` |
| `name` | `'ルーレット'` |
| `category` | `'BOARD'` (`Category_BOARD`) |
| `players` | `'1〜6人'` |
| `seatNames` | `['1番', '2番', '3番', '4番', '5番', '6番']` |
| `undoAllowed` | `false`（※手番内のベットやり直しは専用ムーブ `2000` を使用。確定・回転後のSession巻き戻しは不可） |

### ローカルルール / 設定オプション
- `players` (`group: 'rule'`, 既定 `'2'`): `'1'` (`1人(ソロ)`), `'2'`..`'6'` (`2人`..`6人`)
- `wheel` (`group: 'rule'`, 既定 `'euro'`):
  - `'euro'`: ヨーロピアン（`0` のみ、計37ポケット）
  - `'amer'`: アメリカン（`0` と `00`、計38ポケット）
- `startChips` (`group: 'rule'`, 既定 `'1000'`): `'500'`, `'1000'`, `'2000'`
- `rounds` (`group: 'rule'`, 既定 `'10'`):
  - `'5'` (5ラウンド) / `'10'` (10ラウンド) / `'15'` (15ラウンド) / `'0'` (エンドレス・チップ補充あり)
  - **終わり方(ラウンド数ありの時)**: 最終ラウンドの精算後、全員のチップが 0 枚になった時、または **2 人以上でチップが残っているのが 1 人だけになった時**(2026-11-22 追加。ユーザーの指示: 2 人なら 0 枚になった方がその場で負け。3 人以上は 1 人になるまで続け、0 枚の席は飛ばす)。この時の理由は `第Nラウンドで決着`。
- `laPartage` (`group: 'local'`, 既定 `'off'`):
  - `'off'`: 標準（`0`/`00` が出たら全アウトサイドベットも没収）
  - `'half'`: ラ・パルタージュ（`0` または `00` が出た時、イーブンマネー6枠 `out:low/even/red/black/odd/high` の賭け額の半額 `Math.floor(amt / 2)` を返還）

---

## 2. ホイール配列・色判定

- **ヨーロピアン (`EURO_WHEEL`, 37)**:
  `[0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]`
- **アメリカン (`AMER_WHEEL`, 38)**:
  `[0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, '00', 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 14, 2, 35]`
- **ポケット色**:
  - `'0'`, `'00'`: `'green'`
  - 赤 (`RED_NUMS`): `1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36` → `'red'`
  - 上記以外 (`1..36`): `'black'`

---

## 3. ベットスポット一覧 (`ROULETTE_SPOTS[0..151]`)

`web/pc-firebase/core/games/roulette.mjs` から `ROULETTE_SPOTS` を直接インポートして参照することも可能です。
各要素は `{ idx, id, kind, label, mult, nums, amerOnly, evenMoney }` を持ちます（`mult` は元本込み払い戻し倍率）。

| `idx` 範囲 | 件数 | `kind` | `id` 形式 | `mult` | 内容 |
|---|---|---|---|---|---|
| `0` | 1 | `straight` | `'s:0'` | `36` | 数字 `0` |
| `1..36` | 36 | `straight` | `'s:1'` .. `'s:36'` | `36` | 数字 `1..36` |
| `37` | 1 | `straight` | `'s:00'` | `36` | 数字 `00`（`amerOnly: true`。`wheel === 'euro'` では非合法） |
| `38..70` | 33 | `split` | `'sp:<n>-<n+3>'` (`n=1..33`) | `18` | 横隣2点スプリット (`[n, n+3]`) |
| `71..94` | 24 | `split` | `'sp:<n>-<n+1>'` (`c=0..11, r=1..2, n=c*3+r`) | `18` | 縦隣2点スプリット (`[n, n+1]`) |
| `95..106` | 12 | `street` | `'st:<n>'` (`n=1,4,...,34`) | `12` | 横1列3点ストリート (`[n, n+1, n+2]`) |
| `107..128` | 22 | `corner` | `'cn:<n>-<n+1>-<n+3>-<n+4>'` (`c=0..10, r=1..2`) | `9` | 4点角コーナー |
| `129..139` | 11 | `line` | `'ln:<n>'` (`n=1,4,...,31`) | `6` | 2列6点シックスライン (`[n..n+5]`) |
| `140..142` | 3 | `column` | `'col:1'`, `'col:2'`, `'col:3'` | `3` | コラム 2対1（`col:1`=`1,4..34`, `col:2`=`2,5..35`, `col:3`=`3,6..36`） |
| `143..145` | 3 | `dozen` | `'doz:1'`, `'doz:2'`, `'doz:3'` | `3` | ダズン（`1..12`, `13..24`, `25..36`） |
| `146..151` | 6 | `outside` | `'out:low'`, `'out:even'`, `'out:red'`, `'out:black'`, `'out:odd'`, `'out:high'` | `2` | イーブンマネー6種（`evenMoney: true`、`laPartage=half` 対象） |

---

## 4. 整数ムーブ体系 (`playMove`)

チップ額面配列: `ROULETTE_CHIPS = [1, 5, 25, 100, 500]` (`chipIdx = 0..4`)

| 値域 | 操作 | 合法条件 |
|---|---|---|
| `0..999` | チップ配置 (`chipIdx * 200 + spotIdx`) | `0 <= chipIdx < 5`, `0 <= spotIdx < 152`, `!(spot.amerOnly && wheel !== 'amer')`, `CHIPS[chipIdx] <= chips[turn]` |
| `1000..1151` | 個別撤去 (`1000 + spotIdx`) | 現在手番席の `bets[turn][spot.id] > 0` |
| `2000` | 手番内 Undo | `canUndo === true`（手番内の直前ベット編集を取り消し） |
| `2001` | クリア (`Clear`) | `canClear === true`（手番内の全ベットを手元に戻す） |
| `2002` | 前回と同じ (`Rebet`) | `canRebet === true`（現在ベット0 かつ 前ラウンドベット総額 <= 手元チップ） |
| `2003` | ベット2倍 (`Double / 2x`) | `canDouble === true`（現在ベット総額 > 0 かつ 現在ベット総額 <= 手元チップ） |
| `2004` | 確定 (`Confirm / Spin`) | 対局中は常に合法。最後の未確定席が押すと即座にホイール回転＆精算を実行 |
| `2005` | チップ補充 (`Rebuy`) | `canRebuy === true`（`rounds === 0` エンドレスで `chips[turn] === 0 && tableTotal === 0` のとき `startChips` に補充） |

---

## 5. `viewJson(h, me)` `board` スキーマ

```json
{
  "kind": "roulette",
  "me": 0,
  "n": 2,
  "wheelType": "euro",
  "wheelOrder": [0, 32, 15, ...],
  "laPartage": "off",
  "startChips": 1000,
  "maxRounds": 10,
  "roundNo": 1,
  "turn": 0,
  "phase": "bet",
  "chips": [975, 1000],
  "tableTotals": [25, 0],
  "bankrolls": [1000, 1000],
  "confirmed": [false, false],
  "bets": [{ "out:red": 25 }, {}],
  "canUndo": true,
  "canClear": true,
  "canRebet": false,
  "canDouble": true,
  "canRebuy": false,
  "rebuyCounts": [0, 0],
  "spotChips": [1, 5, 25, 100, 500],
  "spotCount": 152,
  "lastRound": {
    "roundNo": 1,
    "pocket": 17,
    "pocketStr": "17",
    "pocketIdx": 8,
    "color": "black",
    "bets": [{ "out:red": 25 }, { "s:17": 10 }],
    "wagered": [25, 10],
    "payouts": [0, 360],
    "nets": [-25, 350],
    "laPartageReturns": [0, 0],
    "bankrollsAfter": [975, 1350]
  },
  "history": [
    { "roundNo": 1, "pocket": 17, "pocketStr": "17", "color": "black" }
  ]
}
```

### 各フィールド補足
- `chips[i]`: テーブルに置いた分を差し引いた手元残高。
- `tableTotals[i]`: 現在ラウンドで席 `i` がテーブルに置いている合計額。
- `bankrolls[i]`: `chips[i] + tableTotals[i]`（`core.scores` とも一致）。
- `confirmed[i]`: ラウンド内で確定済み（または `maxRounds > 0` で残高0のため自動スキップ）なら `true`。
- `lastRound`: 直前スピンの確定結果（1ラウンド目スピン前は `null`）。UI側のホイール回転アニメーションは `lastRound.roundNo` の変化を検知して、`lastRound.pocketIdx` / `lastRound.pocketStr` へ向けてアニメーションさせる設計を推奨します。
- `history`: 直近最大20スピンの履歴配列（古い→新しい順、末尾が最新）。
- **決定性**: `play(s, 2004)` の最終確定時のスピンは状態内PRNG (`rngState`, Mulberry32) を純粋に更新するため、`core.restoreMatch()` やオンライン通信の同期で全クライアントに同一の出目・配当が再現されます。

---

## 6. UI側で実装が必要な箇所 (Codex担当チェックリスト)

1. `web/pc-firebase/js/app.js`: メニュー表示順序 (`ORDER`) とカテゴリ (`CAT`) への `'roulette'` 追加。
2. `web/pc-firebase/js/art.js`: ゲームアイコン SVG (`AR.roulette`) 追加。
3. `web/pc-firebase/js/boards/*.js` (または専用ボードファイル + `index.html` / `sw.js`):
   - カジノルーレットホイール + 回転演出（`lastRound.roundNo` 変化でトリガー）
   - ベッティングテーブル（数字 `0`/`00`/`1..36`、スプリット/ストリート/コーナー/ライン境界タップ、コラム・ダズン・赤黒偶奇高低）
   - チップ選択バー (`1, 5, 25, 100, 500`) および `戻す(2000)` / `クリア(2001)` / `前回と同じ(2002)` / `2倍(2003)` / `確定(2004)` / `補充(2005)` ボタン
   - 結果出目バッジ・出目履歴・マルチプレイ時プレイヤー別チップ表示
4. `web/pc-firebase/css/app.css`: 盤面・ホイール・テーブルレイアウトのスタイル（レスポンシブ含む）。
