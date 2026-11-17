# Firebase Realtime Database 通信マニュアル（Codex・Claude 引き継ぎ資料）

最終更新: 2026-11-16 / 作成: Antigravity (Gemini)

このドキュメントは、アソビ大辞典（あそび箱30）のオンライン通信を従来の WebRTC + STUN + ntfy（長い招待コード方式）から **Firebase Realtime Database（4桁の合言葉マッチング方式）** に置き換えた設計・データ構造・実装の詳細をまとめた引き継ぎマニュアルです。
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
| `web/pc-firebase/js/online.js` | 4桁の合言葉ロビー画面 UI、Kotlin コア (`OnlineRoom` / `Session`) と Firebase の `state` / `actions` をつなぐ双方向ブリッジ、ポインター座標の正規化 (`0.0`〜`1.0`)・100ms スロットル送信・`requestAnimationFrame` 線形補間描画 |
| `web/pc-firebase/css/app.css` | 4桁の部屋番号表示 (`.invite .code`)、リモートポインターの待機時（指を離した時）半透明表示 (`.rcur.live.idle`) |
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

- **座標の正規化**:
  - `#boardwrap`（対局中の盤面領域）または `.stage` の `getBoundingClientRect()` を基準に、左上を `(0.0, 0.0)`、右下を `(1.0, 1.0)` とした相対割合（小数点第3位まで）に変換します。
  - 将棋・5五将棋・マンカラ・チェッカー・チェスなど、後手番（`seat === 1`）で盤面が180度反転するゲームでは、送信時・受信時に `1 - x`, `1 - y` で自動補正するため、スマホ（縦画面）とPC（横画面）や先手・後手の間で位置がズレません。
- **マウス＆タッチ対応と非アクティブ（半透明）表示**:
  - PC: `mousemove` で `active: true`、`mouseleave` / `blur` で `active: false` を送信。
  - スマホ・タブレット: `touchstart` / `touchmove` で `active: true`、`touchend` / `touchcancel` で指を離した瞬間に `active: false` を送信。
  - 受信側では `active: false` のポインターに `.idle` クラス（`opacity: 0.38`）を付与して半透明の待機表示にします。
- **無料枠の節約と滑らかな補間**:
  - 送信頻度は `POINTER_INTERVAL_MS = 100`（0.1秒に1回）に制限し、かつ前回の `(x, y, active)` シグネチャから変化があった時だけ `rooms/{roomId}/cursors/{uid}` を更新します。
  - 受信側は `requestAnimationFrame` ループ内で現在位置 `(curX, curY)` を目標位置 `(tx, ty)` へ線形補間（Lerp 係数 `0.32`）して滑らかに動かします。

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
