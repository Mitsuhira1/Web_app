# Firebase Realtime Database 通信マニュアル（Codex・Claude 引き継ぎ資料）

最終更新: 2026-11-17 / 作成: Antigravity (Gemini)、追記: Codex

このドキュメントは、アソビ大辞典（あそび箱30）のオンライン通信を従来の WebRTC + STUN + ntfy（長い招待コード方式）から **Firebase Realtime Database（4桁のルームコードマッチング方式）** に置き換えた設計・データ構造・実装の詳細をまとめた引き継ぎマニュアルです。
Codex や Claude Code が今後 PC Web 版の改修や、スマホ Web 版・Android 版・Windows (`.exe`) 版への横展開を行う際は、この仕様に従ってください。

---

## 1. 開発場所とブランチ・公開 URL の整理

- **主開発リポジトリ**: `Mitsuhira1/Web_app`（**今後の開発は `Web_app` の PC Web 版を軸に進める。`Windows-Projects` はユーザーが指示するまで触らない**）
- **ブランチ構成**:
  - `antigravity/firebase-net-20261117`: Antigravity が Firebase 通信を実装した作業ブランチ
  - `ccr-efc07031-6exjqs`: GitHub Pages の公開ブランチ（ここに `web/pc-firebase/` を反映済み）
  - `dev/pc-web-20261117`: Codex の作業ブランチ
- **ディレクトリと公開 URL の使い分け**:
  | 区分 | ディレクトリ | 公開 URL | 内容 |
  |---|---|---|---|
  | **Firebase 通信版（今後の主軸）** | `Web_app/web/pc-firebase/` | `https://mitsuhira1.github.io/Web_app/pc-firebase/` | Firebase Realtime Database 通信版。今後の PC Web 版の改修はここで行う |
  | **従来版（保護）** | `Web_app/web/pc/` | `https://mitsuhira1.github.io/Web_app/pc/` | 従来の WebRTC 招待コード版。作業中も従来のアプリを開けるよう無変更で維持する |

---

## 2. 関連ファイル一覧（`Web_app/web/pc-firebase/`）

| ファイル | 役割 |
|---|---|
| `web/pc-firebase/js/net.js` | Firebase SDK (CDN ES Modules) の読み込み、匿名ログイン(`signInAnonymously`)、4桁ルーム作成・参加、`rooms/{roomId}` の監視・書き込み、ポインター送信、3時間経過部屋の削除・`onDisconnect`・退出時クリーンアップ |
| `web/pc-firebase/js/online.js` | 4桁のルームコードロビー画面 UI、Kotlin コア (`OnlineRoom` / `Session`) と Firebase の `state` / `actions` をつなぐ双方向ブリッジ、ポインター座標の正規化 (`0.0`〜`1.0`)・100ms スロットル送信・`requestAnimationFrame` 線形補間描画 |
| `web/pc-firebase/css/app.css` | 4桁のルームコード表示 (`.invite .code`)、リモートポインターの待機時（指を離した時）半透明表示 (`.rcur.live.idle`) |
| `web/pc-firebase/sw.js` | Service Worker（キャッシュ名プレフィックスを `asobipcfb-` に分離し、`web/pc/` の `asobipc-` と干渉しないように設定） |

---

## 3. Firebase 接続情報と認証仕様（`js/net.js`）

### 3.1 接続設定 (`firebaseConfig`)
`web/pc-firebase/js/net.js` の先頭で定義しています（`globalThis.FIREBASE_CONFIG` があればそちらを優先）：

```javascript
export const firebaseConfig = (typeof globalThis !== "undefined" && globalThis.FIREBASE_CONFIG) || {
  apiKey: "AIzaSyDbZ5C62b7j7DAUEDsQsKY9yeS33J3OwsI",
  authDomain: "asobi-box.firebaseapp.com",
  databaseURL: "https://asobi-box-default-rtdb.firebaseio.com",
  projectId: "asobi-box",
  storageBucket: "asobi-box.firebasestorage.app",
  messagingSenderId: "877962981660",
  appId: "1:877962981660:web:2ea06de9e197eb179f0ad9"
};
```

### 3.2 CDN ES Modules 読み込み（ビルドツール不要）
`https://www.gstatic.com/firebasejs/11.0.1/` から以下の3モジュールを動的 `import()` しています：
- `firebase-app.js` (`initializeApp`, `getApps`, `getApp`)
- `firebase-auth.js` (`getAuth`, `initializeAuth`, `signInAnonymously`, `setPersistence`, `inMemoryPersistence`, `indexedDBLocalPersistence`, `browserLocalPersistence`)
- `firebase-database.js` (`getDatabase`, `ref`, `get`, `set`, `update`, `remove`, `push`, `onValue`, `onChildAdded`, `onDisconnect`, `serverTimestamp`)

### 3.3 匿名ログインと `file://` フォールバック
1. アプリ起動時に `ensureNet()` → `ensureAuth()` が呼ばれ、`signInAnonymously(auth)` でプレイヤー固有の `uid` を取得します。
2. Windows の `.exe` 版やローカルの `file://` から開かれた場合にブラウザストレージ制限でログインエラーにならないよう、`location.protocol === "file:"` の場合や `signInAnonymously` がストレージ系エラーを出した場合は **`inMemoryPersistence` に自動フォールバック** して再試行します。
3. `auth/unauthorized-domain` が発生した場合は、現在のドメイン名と「Firebase コンソール → Authentication → 設定 → 承認済みドメイン に追加してください」という案内を画面とコンソールに表示します。

---

## 4. Realtime Database の JSON データ構造（クロスプレイ共通仕様）

将来「Webブラウザ版」「Androidアプリ版」「Windows (`.exe`) 版」の3環境で同じ部屋に入ってクロスプレイできるよう、データベース上のパスとキー名を以下のシンプルな JSON 構造に統一しています。

```text
rooms/
  └── {roomId}                 // 4桁の数字文字列 (例: "4829")
        ├── roomId: "4829"
        ├── hostUid: "<ホストのuid>"
        ├── createdAt: 1794900618000   // serverTimestamp()
        ├── players/
        │     └── {uid}/
        │           ├── uid: "<uid>"
        │           ├── name: "プレイヤー名"
        │           ├── slot: 0        // ホストは 0、ゲストは 1〜5 (最大6人)
        │           ├── role: "host" | "guest"
        │           ├── proto: 2
        │           ├── rules: ""
        │           └── joinedAt: 1794900618000
        ├── state/
        │     ├── phase: "LOBBY" | "PLAYING"
        │     ├── gameId: "reversi"    // 選択中または対局中のゲームID
        │     ├── options: "moveSeconds=0;onlineUndo=0"
        │     ├── round: 1             // 何局目か (0 は開始前)
        │     ├── seed: "58392019482"  // 64bit乱数シード(10進文字列)
        │     ├── seatSlots: [0, 1]    // 各席に入るプレイヤーの slot (-1 は CPU)
        │     ├── names: ["太郎", "花子"]
        │     ├── moves: [19, 18, 26]  // 初手からの合法手の整数配列
        │     ├── ready: [0]           // 再戦準備完了した slot の配列
        │     ├── members: [{ slot: 0, name: "太郎" }, { slot: 1, name: "花子" }]
        │     ├── chat: [{ seq: 1, slot: 0, name: "太郎", kind: 0, body: "よろしく" }]
        │     ├── clock: { round: 1, index: 3, seconds: 15 } | null
        │     ├── undoAsk: { round: 1, id: 1, slot: 1, target: 2 } | null
        │     ├── undoResult: { seq: 1, round: 1, id: 1, ok: true, slot: 1, moves: [19, 18], by: -1 } | null
        │     └── updatedAt: 1794900625000
        ├── actions/
        │     └── {pushId}/            // ゲスト → ホストへの操作イベントキュー (処理直後にホストが削除)
        │           ├── type: "WIRE"
        │           ├── text: "REQ|1|0|19"  // REQ, UNDO_REQ, UNDO_VOTE, CHAT_REQ, RESIGN_REQ, AGAIN, LOBBY_REQUEST
        │           ├── uid: "<ゲストのuid>"
        │           └── at: 1794900624000
        └── cursors/
              └── {uid}/
                    ├── uid: "<uid>"
                    ├── x: 0.25        // 表示領域の左端 0.0 〜 右端 1.0
                    ├── y: 0.75        // 表示領域の上端 0.0 〜 下端 1.0
                    ├── active: true   // マウス操作中・タッチ中は true、指を離したら false
                    ├── slot: 1
                    ├── seat: 1
                    ├── name: "花子"
                    └── updatedAt: 1794900626000
```

---

## 5. 同期フローの仕組み（Kotlin コアとの接続）

ゲームのルール判定・合法手チェック・乱数シードからの盤面再現は、Android 版と共通の Kotlin コード（`core/asobi-pc-core.mjs` 内の `OnlineRoom` / `Session`）が担っています。`online.js` は Kotlin コアを書き換えることなく、以下のように Firebase と橋渡ししています：

1. **ホスト側 (`role === "host"`)**:
   - `rooms/{roomId}/players` に新しいゲスト `{uid}` が追加されると、仮想ピア ID (`fb_1`, `fb_2`...) を割り当てて `mainCore.netLinked(peerId)` と `HELLO` を Kotlin の `OnlineRoom` に渡します。
   - ゲストが `rooms/{roomId}/actions/{pushId}` に書き込んだ要求（指し手 `REQ|...`、待った `UNDO_REQ` / `UNDO_VOTE`、チャット `CHAT_REQ`、再戦 `AGAIN` など）を `onChildAdded` で受け取って即削除し、`mainCore.netText(peerId, act.text)` に流します。
   - ホストの `OnlineRoom` が状態を変更すると `flushHostStateToFirebase()` が呼ばれ、`rooms/{roomId}/state` を一括 `update()` します。
2. **ゲスト側 (`role === "guest"`)**:
   - `rooms/{roomId}/state` の `onValue` リスナー（`applyRemoteStateOnGuest()`）で状態を受け取り、差分を検知してゲスト側の `OnlineRoom` に `WELCOME`・`ROSTER`・`BEGIN`・`MOVE`（1手進んだ時）または `SYNC`（複数手や復帰時）・`CLOCK`・`UNDO_ASK`・`UNDO_DONE`・`CHAT` を供給します。
   - ゲスト自身の操作は `createCoreBridge().backend.sendTo('host', text)` から `netApi.sendAction({ type: 'WIRE', text })` 経由で `rooms/{roomId}/actions` に push されます。

---

## 6. ポインター（マウス・タッチ）同期仕様

- ババ抜き・ジジ抜きでは承認済みの扇形の札がある盤面を基準にして、異なるウィンドウサイズでも同じ位置にカーソルを表示する。引くプレイヤーのポインターが札の上にある場合は、既存のカーソルデータに `maidIndex`（表裏の札を照合する0始まりの位置）と `maidMove`（着手数）を付与する。引かれる側だけが、その着手数の自分の手札で該当位置を強調する。札の数字やマークはこのデータで送らない。許可フィールドを列挙する Firebase Rules ではこの2つの任意の整数フィールドを許可する。

- **座標の正規化**:
  - `#boardwrap`（対局中の盤面領域）または `.stage` の `getBoundingClientRect()` を基準に、左上を `(0.0, 0.0)`、右下を `(1.0, 1.0)` とした相対割合（小数点第3位まで）に変換します。
  - 将棋・5五将棋・マンカラ・チェッカー・チェスなど、後手番（`seat === 1`）で盤面が180度反転するゲームでは、送信時・受信時に `1 - x`, `1 - y` で自動補正するため、スマホ（縦画面）とPC（横画面）や先手・後手の間で位置がズレません。
- **マウス＆タッチ対応と非アクティブ（半透明）表示**:
  - PC: `mousemove` で `active: true`、`mouseleave` / `blur` で `active: false` を送信。
  - スマホ・タブレット: `touchstart` / `touchmove` で `active: true`、`touchend` / `touchcancel` で指を離した瞬間に `active: false` を送信。
  - 受信側では `active: false` のポインターに `.idle` クラス（`opacity: 0.38`）を付与して半透明の待機表示にします。
- **無料枠の節約と滑らかな補間**:
  - 送信頻度は `POINTER_INTERVAL_MS = 100`（0.1秒に1回）に制限し、かつ前回の `(x, y, active)` シグネチャから変化があった時だけ `rooms/{roomId}/cursors/{uid}` を更新します。
  - 受信側は `requestAnimationFrame` 内で受信時点の表示座標から目標座標まで120msで時間基準の線形補間を行います。描画のフレームレートに依存する係数は使用しません。

---

## 7. ゴミデータの自動削除仕様（Cloud Functions 不使用）

1. **切断時の自動削除 (`onDisconnect`)**:
   - ホストが部屋を作成した直後に `onDisconnect(ref(db, 'rooms/' + roomId)).remove()` を登録します。ホストがブラウザやアプリを閉じると部屋ごと自動削除されます。
   - ゲストが入室した直後に `onDisconnect(ref(db, 'rooms/' + roomId + '/players/' + myUid)).remove()` と `onDisconnect(ref(db, 'rooms/' + roomId + '/cursors/' + myUid)).remove()` を登録します。
2. **3時間以上経過した古い部屋の掃除 (`cleanupOldRooms`)**:
   - 新しく部屋を作成する際、`rooms` 一覧を取得して `Date.now() - createdAt >= 3 * 60 * 60 * 1000`（3時間）の部屋をすべて `remove()` してから、未使用の4桁ルーム ID を発行します。
3. **退出・解散ボタン押下時の削除 (`leaveRoom`)**:
   - ホストが「部屋を解散する」を押した時は `rooms/{roomId}` を即削除し、ゲストが「部屋を出る」を押した時は自分の `players/{uid}` と `cursors/{uid}` を即削除します。
   - ※ ホストが部屋を削除したことによってゲスト側の `onRoomRemoved` が発火した際は、`leaveRoom(true)`（`skipRemoteDelete = true`）を呼んで削除済みの部屋に再書き込みしないように制御しています。

---

## 8. 他の AI（Codex / Claude）への引き継ぎプロンプト（コピー用）

Codex に作業を引き継ぐ際は、以下のブロックをそのままコピーして貼ってください：

```text
リポジトリ Mitsuhira1/Web_app のブランチ `antigravity/firebase-net-20261117`（および公開ブランチ `ccr-efc07031-6exjqs`）に、Antigravity が実装した Firebase Realtime Database 通信版が入っています。
作業を始める前に必ず以下2つのファイルを読んでください：
1. `README4AI_Claude_Codex_Antigravity.md`（3つのAI共通の作業記録・方針）
2. `docs/FIREBASE_NET_MANUAL_FOR_AI.md`（Firebase 通信部分の仕様・JSON構造・引き継ぎマニュアル）

【重要なルール】
- 今後の開発は `Web_app` リポジトリの PC Web 版（`web/pc-firebase/`）を軸に進めてください。`Windows-Projects` は触らないでください。
- 従来の PC Web アプリ（`web/pc/`）はそのまま開けるように無変更で維持してください。
- 変更を加えたら必ず `README4AI_Claude_Codex_Antigravity.md` の「5. 変更の記録」に目的・変更内容・確認結果を追記してください。
```


## 9. 2026-11-17 Codexの追記

### 2026-11-18 スライドパズルの追加データ

ホストは既存の `writeState` で `rooms/{roomId}/state/slide` に `{id,phase,size,picture,seed}` を書く。`size` は3〜6、`picture` は `landscape` または `numbers`。全参加者は同じ `seed` から合法手によるシャッフルを再現する。各プレイヤーは自分の `rooms/{roomId}/players/{uid}/slide` に `{id,moves,tiles,done,elapsedMs}` を書き、競争の進行と再表示に使う。既存の `state`、`players`、WebRTC版の処理は変更しない。この新フィールドを読まない旧クライアントは無視できる。

協力マインスイーパーはホストが `rooms/{roomId}/state/mine` に `{id,phase,level,seed,version,board}` を書く。`board` は地雷位置そのものではなく `{level,seed,safeCell,opened,flags,status,openedSafe}` のスナップショット。ゲストは `rooms/{roomId}/actions` に `{type:'MINE',id,move,cell}` を送る。`move` は `open`、`flag`、`undo`。ホストが操作を適用し、版を増やして `state/mine` を更新する。巻き戻し履歴はホストのメモリ内に最大30操作だけ保持するため、ホストの再読み込み後には以前の履歴は復元できない。

- **表示対象**: 相手ポインターは `S.screen === 'play'` の対局画面だけに表示する。ロビーを含むメニュー・設定・ゲーム選択では表示しない。ルームを維持したまま対局へ入る時は、新規の受信通知なしでも描画ループが表示を復元する。
- **表示層と色**: `.rcur.live` はbody直下のfixed要素で、盤面と右側UIの境界にまたがっても同じ色を保つ。色はplayersのslotを優先して決め、既存要素にも毎回反映する。ルームコードの仕様やJSONキーは変更していない。
- **送信**: 座標・activeに加えてslot/seatの変更も差分に含める。active=falseも含め、100ms以内に連続書込みしない。
- **初期状態適用**: 初期監視通知がOnlineRoomゲスト生成より先に到着し得るため、`startGuestOnlineRoom()` で `resetGuestApplied()` し、生成後にWELCOMEを再適用する。
- **効果音**: 通信の自分の操作は要求と確定を区別する。`humanMove`/CPUで予約せず、確定したmovesの差分で鳴らす。`refresh()` の更新世代で古い非同期結果を棄却し、前状態は待機より先に確保する。
- **タブ復帰**: `sfx.js` の `transientAudio` で一時音源・タイマーを管理する。非表示時に停止し、古い予約音を再開しない。停止中contextにバッファ音を積まない。明示的なバックグラウンド音設定は尊重する。
- **試験**: `tools/tests/firebase-memory-net.js` は試験用のAPI代替。製品からは読み込まない。`check_firebase_ui.py` は実際のKotlin coreを持つ2画面で手順を検証し、本番Firebaseの接続試験とは区別する。


## 10. 共通ゲーム一覧・希望ゲーム・左ナビ固定配置・途中入室観戦（2026-11-17）

「みんなで遊ぶ」はルーム作成・参加とルーム管理の入口。ルーム作成後は `room` に留まり、左ナビゲーションの「ゲーム」から `menu` の既存ゲーム一覧へ移動する。参加時の既存遷移は維持する。room右側の「ゲームを選ぶ」ボタンは置かない。

- **左ナビゲーション (`.rail`) の「人数」フィルタとルーム情報 (`.room-summary`) の固定配置**:
  - `.tabs` の直下に「人数」フィルタ (`.rail-filter`) を配置し、**その下に**ルーム情報 (`roomSummary()`) を配置する。これによりルーム作成・退出の瞬間に「人数」フィルタが下へ押し下げられることがない。
  - 「人数」フィルタは「ゲーム」タブ (`menu`) のみで表示し、他のタブ (`room`・`records`・`settings`) では `.rail-filter.is-hidden` (`visibility: hidden; pointer-events: none;`) にして高さを維持する。これにより、全4タブのどの画面に切り替えても `.room-summary` の表示位置（Y座標）が一切動かない。
  - 「人数」フィルタを切り替えた際は1フレームでパッと切り替えず、`.main.filter-enter` と `.filter-pop` によるフェード＋スライドアニメーションを実行する（`html.reduce` 時は無効化）。
- **対局中ルームへの途中入室と観戦**:
  - `net.js` の `joinRoom()` はルームが対局中 (`phase === 'PLAYING'`) でも空きスロットがあれば入室を許可する。
  - `asobi-pc-core.mjs` の `beginOnline()` で自分のスロットが `seatSlots` に含まれない場合（途中入室者・3人目以降の観戦者）も `Session` を生成して `matchHandle` を設定する（全席 `mine = false, remote = true`）。また `setup$lambda_9` で観戦者の `undoOk` は常に `false` とする。
  - `online.js` の `applyRemoteStateOnGuest()` では `s.members` と `fbState.players` をスロット番号でマージし、ホストの次回 `state` 更新前でも途中入室ゲスト自身のスロットで即座に `WELCOME` / `ROSTER` / `BEGIN` / `SYNC` が適用され、対局画面 (`play`) に入ってリアルタイム観戦できるようにしている。
  - 観戦中 (`view.mine < 0`) はヘッダーに「みんなで遊ぶ・観戦中」を表示し、席0の名前・アイコンが観戦者自身のものに置き換わらないように制御し、部屋へ戻る際も降参扱いにせずいつでも「対局を観戦する」(`data-oreturn`) で対局画面へ戻れる。

追加フィールド（いずれも既存クライアントが無視できる任意フィールド）:

- `rooms/{roomId}/players/{uid}/choice`: 希望ゲームのID文字列。本人の希望のみ。`state/gameId` や `state/phase` は書き換えない。
- `rooms/{roomId}/players/{uid}/avatar`: 組込みアイコン番号（整数、未指定はnull）。写真や任意HTMLを配信しない。
- `netApi.chooseGame(gameId, avatar)`: 現在のuidのプレイヤーノードだけをupdateする。既存の切断時players削除で一緒に片付く。

`gameWishes()` は同じゲームを希望する複数人を、slotに対応する複数の色枠と右上のアイコン/名前で表示する。自分の色枠は既存のオレンジの選択ハイライトと重なるため描画しない（希望は他端末へ引き続き送信する）。他の人の枠はタイルの既存選択outlineと角丸を合わせる。希望の選択では設定画面へ遷移しない。`chooseOnline()` はホスト・参加人数2人以上を検査し、「対戦プレイ」から既存の設定へ進む。開始前にも2人以上を確認する。実際のゲーム設定、合法手、開始は引き続きホストのOnlineRoomが管理する。

Firebase Rulesを独自に厳格化しているプロジェクトでは、本人のplayersノードの `choice`（文字列）と `avatar`（整数/null）の更新を許可すること。ホストのstate更新権限や他プレイヤーの所有権を緩める必要はない。

---

## 11. ホスト管理・1人待ちプレイ・一律通知・CPU委任・観戦モード（2026-11-17）

### 11.1 追加された Realtime Database フィールド
- `rooms/{roomId}/players/{uid}/spectating`: boolean（観戦モード状態。対局開始時の参加メンバーから除外される）
- `rooms/{roomId}/players/{uid}/autoCpu`: boolean（対局中の CPU 代理操作フラグ）
- `rooms/{roomId}/kicked/{uid}`: number（ホストによりキックされた時刻。該当ゲストが `onKicked` で検知して自動退出する）
- `rooms/{roomId}/state/hostSlot`: number（現在のホストの slot 番号）
- `rooms/{roomId}/state/soloIdle`: boolean（ホスト1人待ちプレイ中フラグ）
- `rooms/{roomId}/state/spectatorSlots`: number[]（観戦モード中プレイヤーの slot 一覧）
- `rooms/{roomId}/state/autoCpuSlots`: number[]（CPU 操作委任中の slot 一覧）
- `rooms/{roomId}/state/chat[]`: `kind === 2` をシステム通知（`name: ""`、入室「〇〇が参加しました」・退出・キック・ホスト交代など）として使用

※ Firebase Rules を厳格化する場合は、上記に加えて本人の `players/{uid}/spectating`・`autoCpu` の更新と、ホスト交代時 (`assumeHost` / `transferHost`) の `hostUid`・`players/{uid}/role`・`kicked/{uid}` の更新を許可すること。

### 11.2 ホスト変更・キック・ホスト離脱時の引き継ぎと解散
- **プレイヤー管理メニュー**: ホストが参加メンバー（`.room-members` / 部屋画面の `.seat-btn` / 対局中の「メンバー」シート）をクリックすると、「ホストを変更」「キック」を選べる。
- **ホスト変更 (`transferHost`)**: `hostUid` と双方の `players/{uid}/role` のみを更新し、**4桁のルームコード (`roomId`) は変更しない**。旧ホストは `demoteHostToGuest()`、新ホストは `promoteToHostFromState(false)` により `onlineAssumeHost(mySlot, snapshotJson)` で進行中盤面やチャットを保ったまま役割を切り替える。
- **ホスト離脱・切断時の引き継ぎ**: `netApi.syncDisconnectPolicy(playerCount)` により、`onDisconnect` で部屋丸ごと (`rooms/{roomId}`) を削除するのは **ホスト1人だけの時 (`playerCount <= 1`) のみ**。2人以上いる場合はホストも `players/{uid}` / `cursors/{uid}` のみ削除対象となり、ホストが抜けると最古参の残りプレイヤー (`nextHostCandidateUid`) が `promoteToHostFromState(true)` でホストを引き継ぐ。対局中のホスト退出確認でも「ホストを引き継いで出る」を選択可能（離脱ホストの席は `onlineConvertSeatToCpu` で CPU 席に変換）。
- **解散時のチャット消去**: 部屋を解散 (`leaveRoom('dissolve')`) した際は、`rooms/{roomId}` の削除と同時にコアの `get_chatLog()` および UI の `S.chat` を空にし、次の部屋へ会話が残らないようにする。

### 11.3 ルーム待機中の1人プレイ (`soloIdle`)・一律参加通知
- **1人待ちプレイ**: ホスト1人だけの時でもゲーム選択から「1人で遊ぶ」を開始可能。`soloEngineOpts()` により、CPU の強さ・先後手番・制限時間・各種ローカルルール・無制限「待った」などシングルプレイと同じ設定・同内容で遊べる（`speed`・`solitaire` 等の同時進行ゲームも `mainCore` 側の `isConcurrent` / `cpuSeats` / `cpuChooseSeat` で動作）。
- **参加時確認と観戦**: 1人プレイ中に誰か（`〇〇`）が入室すると、新参加者は進行中盤面をリアルタイム観戦でき、ホスト側には「〇〇が参加しました。現在のゲームを終了しますか？」（`続ける` / `終了する`）シートが表示される。
- **一律の参加チャット通知**: 1人→2人目・マルチプレイ `LOBBY` / `PLAYING` 中を問わず、新規プレイヤーが入室した際は `onlineSystemChat('${name}が参加しました')` (`kind: 2`) を全員のチャットへ一律配信する。

### 11.4 離席時 CPU 操作委任 (`autoCpu`) と観戦モード (`spectating`)
- **CPUに操作を任せる**: 着席プレイヤーが対局中に `.online-ops` の「CPUに操作を任せる」を押すと `autoCpu = true` になり、他のプレイヤーにも「CPUが操作中…」と表示される。ホストが `cpuChoose(h, millis, 1)`（**中級・`level = 1`**）で代理着手し、本人が「CPU操作を解除」を押すまで本人の盤面操作・待った・降参は無効化される。
- **観戦モード**: ロビー / ゲーム選択で「観戦モード」を ON にしたメンバーは、`onlineStartParticipants()` による試合開始時の着席対象から外れ、途中入室時と同じ観戦者画面 (`view.mine === -1`) で対局を見られる（「もう一度」で次の対局へ参加可能）。

## 12. 人狼の同期（2026-11-18）

人狼の進行は `js/wolf.js` が管理する。ホストが既存の `writeState()` で `rooms/{roomId}/state/wolf` を更新し、終了時に削除する。Kotlin側は既存のロビーと共通チャットを担当する。人狼の状態がある間は、Web側で新しい対局の開始を抑止する。

- `players/{uid}/wolfKey` は入室時に設定する当人のRSA-OAEP公開鍵。ホスト管理の `state/wolf` には対局ID、進行版、昼夜・投票の段階と期限、各席の生死、村の発言、演出イベントを入れる。配られた役職と個別の能力結果は `state/wolf/private/{uid}` の暗号文で送る。ホストはルールの判定に必要な全役職をメモリ内に保持する。
- `actions/{pushId}` の `type: "WOLF"` をホストで処理する。投票と夜の対象はホストの鍵で暗号化する。ホストは対局ID、段階、参加者、有効な候補、重複操作を確認して適用する。死亡後のチャットを無効にした場合は、村の会話に加えて共通チャットの送信要求もホストで拒否する。
- 既存のFirebase Rulesで本人のプレイヤーノードの更新、本人のUIDを持つ操作の作成、ホストの状態更新を制御する。フィールドを列挙するルールでは `wolfKey` と `state/wolf`、`WOLF` 操作を許可する必要がある。Firebase本番のルールはこの作業で変更していない。

## 13. 札・対戦マインスイーパー・落ち物の同期（2026-11-18）

`js/board-match.js` がロビー、共通チャット、ゲストからの操作キューを再利用する。ホストは `state/boardMatch` に対局ID、ゲームID、版、席と公開できる進行を保存する。ゲストが `type: "BOARD_MATCH"` を送ると、ホストが現在の対局、送信者、手番や操作を照合して反映する。

- 坊主めくりは残り枚数と引いた札を同期し、山札の中身はホストが保持する。百人一首は読み上げ中の番号、盤上の札、取得と得点を同期する。次の読み順はホストが保持する。
- マインスイーパー対戦はホスト内で席ごとに盤面を管理し、公開するのはマスの表示コード、進捗、妨害の期限、得点と順位。初期地雷の座標はホストが保持する。
- ぶにょぶにょとパクリスは共通の初期乱数を配る。盤面の操作は各端末で行い、着地後の盤面、得点、お邪魔量の報告をホストが版つきで適用する。競技の不正防止を行うサーバーはない。
- ぶにょぶにょ・パクリスでホストが「お邪魔を送る」をオフにすると、`state/boardMatch.sabotage` が `false` になり、ホストは得点・盤面を反映しても相手にお邪魔を送らない。フィールドがない既存対局では従来どおり。落下速度の選択は1人用で、通信対戦の速度は標準。
- マインスイーパーの選択画面は `mine` を表示する。協力の `state/mine` と対戦の `state/boardMatch`（`game: "mineVersus"`）は従来の進行・操作形式を使う。プレイモード・難易度の選択は開始前にホストが行う。
- ホストが切断して交代した場合、ホストだけが保持していた盤面や山札を使う対局は終了してロビーに戻す。ロビーの引き継ぎと既存ゲームの同期は従来どおり行う。
