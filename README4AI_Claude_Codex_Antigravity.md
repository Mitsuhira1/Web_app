# README4AI — Claude・Codex・Antigravity(Gemini)共通の作業記録

> **AI へ: このリポジトリで作業する前に必ずこのファイルを最後まで読むこと。作業したら「5. 変更の記録」に追記すること。**
> 日本アソビ大辞典30 は 3 つの AI(Claude Code・Codex・Antigravity)で交代・同時に開発している。
> 他の AI が何を・なぜ変えたかを、このファイルだけで分かるようにする。

同じ内容のファイルが 2 つのリポジトリにある:
- `Mitsuhira1/Web_app` … `README4AI_Claude_Codex_Antigravity.md` (**現在の主開発対象**)
- `Mitsuhira1/Windows-Projects` … `README4AI_Claude_Codex_Antigravity.md`

## 1. いまの方針とブランチを分けた経緯(ユーザーの指示)
- **現在は `Web_app` リポジトリ(PC ブラウザ版)を軸に開発を進める。`Windows-Projects` は触らない。**
  - PC ブラウザ版のうまくいった変更を、後から必要に応じて他のバージョン(exe・スマホブラウザ版・Android 版)に広げる方針。
- **従来の PC Web アプリと Firebase 版を別パスで共存公開する**:
  - 従来の PC Web アプリ(WebRTC 版): `Web_app/web/pc/` → **https://mitsuhira1.github.io/Web_app/pc/** (無変更で維持)
  - Firebase 通信の PC Web アプリ: `Web_app/web/pc-firebase/` → **https://mitsuhira1.github.io/Web_app/pc-firebase/** (今後の PC Web 版の主開発場所)
- **ブランチを分けた経緯**:
  1. 当初 Claude Code で開発を進めていたが週間制限に達したため、Codex が別ブランチ `dev/pc-web-20261117` で作業を引き継いだ。
  2. そこへ Antigravity(Gemini)も加わり、3 つの AI を使い分ける体制になった。
  3. 同じブランチ名で作業すると履歴が衝突(競合)する恐れがあるため、AI ごとに作業ブランチを分けた:
     - Codex: `dev/pc-web-20261117`
     - Antigravity: **`antigravity/firebase-net-20261117`** (および GitHub Pages 公開用の `ccr-efc07031-6exjqs` への `web/pc-firebase/` 反映)
     - Claude: 再開時は `claude/…` など別名で作る
- 画面の言葉・資料・返事は日本語。コミット・プッシュはユーザーが言った時だけ。

## 2. 構成の要点(作業前に知っておくこと)
- **Firebase 通信対応の PC ブラウザ版は `Web_app/web/pc-firebase/` を直接編集する**(`Windows-Projects` は今後いじらない)。
- **従来の PC ブラウザ版 `Web_app/web/pc/` はそのまま残す**(作業中も従来の PC Web アプリを開けるようにするため)。
- 規則・CPU・通信の部屋進行: Kotlin(`core/`)→ JavaScript(`core/*.mjs`)。Android 版と同じコード。勝手に規則を変えない。
- 画面: `js/app.js` が中心。ビルドの仕組みなし・グローバル変数でつながる。`js/boards/fix.js`・`fix2.js` は前の関数を上書きする(読み込み順に依存)。

## 3. Firebase Realtime Database 通信仕様(`web/pc-firebase/`)
> **詳細な技術マニュアル・引き継ぎ資料**: [`docs/FIREBASE_NET_MANUAL_FOR_AI.md`](docs/FIREBASE_NET_MANUAL_FOR_AI.md) に全体アーキテクチャ、JSON スキーマ、`js/net.js` / `js/online.js` の全 API、Kotlin `OnlineRoom` とのブリッジ、ポインター補間、自動ゴミ削除、テスト手順をまとめてあります。通信周りを触る前や他環境へ移植する際は必ず参照してください。

従来の WebRTC・STUN/TURN・ntfy・長い招待コード/返信コードのやり取りと UI を廃止し、Firebase Realtime Database (`asobi-box`) による 4 桁ルームコードマッチング＋リアルタイム同期に置き換えた。将来 Android アプリ版・スマホ Web 版・Windows(.exe)版とクロスプレイする際も以下の汎用 JSON 構造に合わせる:

- **接続設定**: `web/pc-firebase/js/net.js` 先頭の `firebaseConfig` (プロジェクト `asobi-box`、`databaseURL: "https://asobi-box-default-rtdb.firebaseio.com"`)。
- **認証**: Firebase SDK (v11.0.1 CDN ES Modules) で起動時に `signInAnonymously` で匿名ログインし `uid` を取得。`file://` や WebView 等でストレージ制限エラーが出た場合は `inMemoryPersistence` に自動フォールバック。`auth/unauthorized-domain` 発生時は承認済みドメイン追加手順を画面とコンソールに案内。
- **データベース構造 (`rooms/{roomId}`)**:
  - `rooms/{roomId}/roomId`: 4 桁の数字文字列 (例 `"4829"`)
  - `rooms/{roomId}/hostUid`: ホストの `uid`
  - `rooms/{roomId}/createdAt`: `serverTimestamp()`
  - `rooms/{roomId}/players/{uid}`: `{ uid, name, slot, role: "host"|"guest", proto: 2, rules, joinedAt }`
  - `rooms/{roomId}/state`: `{ phase: "LOBBY"|"PLAYING", gameId, options, round, seed, seatSlots, names, moves, ready, members, chat, clock, undoAsk, undoResult, updatedAt }`
  - `rooms/{roomId}/actions/{pushId}`: ゲストからホストへの操作要求 (`{ type: "WIRE", text, uid, at }`)。ホストが処理したら即削除。
  - `rooms/{roomId}/cursors/{uid}`: `{ uid, x, y, active, slot, seat, name, updatedAt }` (`x`, `y` は `0.0`〜`1.0` の相対座標、100ms スロットル＆差分送信、タッチ離し時は `active: false` で半透明表示、受信側は `requestAnimationFrame` 線形補間)
- **ゴミデータの自動削除 (Cloud Functions 不使用)**:
  - (a) ホストは `onDisconnect(ref(db, "rooms/{roomId}")).remove()`、ゲストは自分の `players/{uid}` と `cursors/{uid}` に `onDisconnect().remove()` を設定。
  - (b) 部屋作成時に `rooms` 一覧を確認し、`createdAt` から 3 時間以上経過した古い部屋を自動削除してから 4 桁の未使用 ID を発行。
  - (c) 解散・退出ボタン押下時にも `leaveRoom()` で部屋(ホスト)または自分のプレイヤー/ポインターデータ(ゲスト)を即削除。

## 4. いま作業中(作業を始めたら書き、終わったら消す)
| AI | 作業の内容 | 触るファイル | 開始 |
|---|---|---|---|
| Codex | (`dev/pc-web-20261117` で作業中。Codex が記入) | | |

## 5. 変更の記録(新しいものを上に)

### 2026-11-17 / Codex / ルーム作成後の移動と選択枠の調整
- 目的: 作成後にゲームタブへ自動移動させない、みんなで遊ぶ右側の「ゲームを選ぶ」ボタンを削除、自分の希望色枠と既存ハイライトの重なりを解消、相手の希望枠と成績アイコンの角を整える。
- 変更: ホストのルーム作成成功時のmenu遷移を削除。参加者一覧と遊び方は表示を維持。ゲーム一覧へは既存の左ナビゲーションで移動する。
- 変更: 自分自身の希望枠だけ非表示。他端末には従来どおり自分の希望を共有し、アイコン・名前表示も保持。相手の枠は既存タイル選択と同じ3px/1pxのoutline、角丸に合わせ、はみ出しによる角の切れを解消。
- 変更: 成績の既存ゲームアイコンを82px角・角丸10pxで描画。元のゲームアートは変更しない。
- 検証: 2画面試験に作成後room維持・不要ボタン非表示・自分の色枠除外・相手枠の角丸/線位置を追加。成績試験に角丸確認を追加。対象はFirebase PC Web版のみ。

### 2026-11-17 / Codex / Firebase版の公開
- ユーザーから「コミットプッシュして公開」の指示を受け、今回のFirebase版UI・カーソル・効果音・成績の変更を公開ブランチ `ccr-efc07031-6exjqs` へ反映する。
- 最新リモート `da94b83` を親とする独立したコミットを作成し、今回の対象ファイルのみを採用。以前のスマートフォン版などの未完了変更は含めない。
- 公開パスは引き続き `web/pc-firebase/`。従来 `web/pc/`、Windows/Android版、公開ワークフローは変更しない。
- 検証: ローカル2画面の実core/UI回帰試験、音源と予約音の破棄、100msカーソル送信、全30ゲームの成績一覧、JS構文確認、差分の空白検査は合格。本番Firebaseでの実機クロスプレイは未検証。
- ロールバックはこの公開コミットのrevertで可能。作業全体のバックアップは `/workspace/.backups/` に維持。

### 2026-11-17 / Codex / dev/pc-web-20261117
- 目的: Firebase版の相手カーソルの滑らかさ・初期色・盤面と右側UIの境界での色差、通信対戦の二重効果音、タブ復帰時の保留音を修正。対局中の設定と全ゲームの成績一覧を追加。
- 取り込み: `git fetch origin` 後、`origin/ccr-efc07031-6exjqs` の `web/pc-firebase/` と本記録・通信マニュアルを取得。既存の未コミット作業は維持。`Windows-Projects` と従来 `web/pc/` は編集していない。
- カーソル: 100ms差分送信を維持し、受信側を120msの時間基準補間へ変更。全UIDについて1つずつbody直下の固定表示で描画し、盤面や右側UIの重なり・再描画に左右されないよう修正。slotの色を毎回適用。最新の指示に従い、メニュー・ロビー・設定・ゲーム選択では非表示、対局だけ表示する。
- 効果音: ローカルの操作要求時に通信対戦の音を予約せず、確定した手の同期で1回再生。非同期refreshが前の状態を再度処理しないよう更新を先に確保し、古いrefreshも棄却する。非表示時は一時音源を停止・破棄し、予約音は世代・期限で取消。停止中AudioContextへの音の追加と復帰直後の遅延音を抑制。「バックグラウンドでも音を鳴らす」の指定は維持。
- ロビーとゲーム選択: ルーム作成・参加後はシングルと同じゲーム一覧へ移動。左にルームコード・参加者・解散/退出、右に説明とチャットを配置。ホストのみ、参加者を含む2人以上で「対戦プレイ」から設定へ進む。ゲストは希望ゲームの枠のみ選べ、`players/{uid}/choice` と任意の組込みアイコン番号 `avatar` で共有する。各枠の色線と右上のアイコン/名前を全員に表示。希望は助言であり実際のゲーム決定権はホストに維持。
- UI: 盤面左下に設定アイコン。既存の設定部品を浮かぶ画面で開き、対局とルームを維持する。成績は全30ゲームの一覧を初期表示し、未プレイをまとめ、各行左にゲームアイコンを追加。既存の勝敗・勝率・ひとりプレイ回数を維持。
- 併せて修正: 入室監視の初期通知がOnlineRoomゲスト生成より早く届いた場合にWELCOMEを適用済みと誤認しないよう、ゲスト作成時に差分管理をリセット。
- ファイル: `web/pc-firebase/js/net.js`, `js/online.js`, `js/app.js`, `js/sfx.js`, `css/app.css`, `sw.js`。新キャッシュ `asobipcfb-20261117-cursor-audio-room-2`。ルームコード表記・遊び方常時表示・Firebase JSON構造は維持。
- 検証: `tools/tests/check_firebase_ui.py` (実Kotlin coreのホスト/ゲスト2画面、通信APIのみローカル代替)、`check_transient_audio.cjs`、`check_cursor_send.cjs`、`check_records_ui.py` は合格。ルームの作成/参加、希望の色枠、ホスト限定開始、双方の各1手の音、設定を閉じても同じ対局を保持、対局のみカーソル表示、全30ゲームの成績一覧を確認。Firebase本番との実通信、iPhone実機は未検証。
- サンプル: `samples/index.html` からv4/v5とZIPを参照できるよう整理。演出調整は後回しのまま。
- 状態: 未コミット・未プッシュ・未公開。サンプルおよび既存作業の復元用バックアップは `/workspace/.backups/` に保持。

### 2026-11-17 00:04(PST)/ Antigravity / antigravity/firebase-net-20261117 & ccr-efc07031-6exjqs
- 目的: ユーザーの指示。(1) ボタンや入力欄の「4桁のルームコード」から不要な「4桁の」を外してシンプルに「ルームコード」とし（「遊び方」の説明文の中のみ「4桁のルームコード」と記載）、(2) 部屋を建てた後・入った後も「遊び方」のルームコード説明パネルが消えないように常時表示する。
- 変更: `web/pc-firebase/js/online.js` の `room()` 内の表記修正と `howtoPanel` の常時表示化、`web/pc-firebase/sw.js` のキャッシュ名更新。
- ファイル: `web/pc-firebase/js/online.js`, `web/pc-firebase/sw.js`, `README4AI_Claude_Codex_Antigravity.md`

### 2026-11-16 23:57(PST)/ Antigravity / antigravity/firebase-net-20261117 & ccr-efc07031-6exjqs
- 目的: ユーザーの指示。画面や説明文の「合言葉（部屋番号）」「部屋番号」という表記をすべて「ルームコード」に統一する。
- 変更: `web/pc-firebase/js/online.js`・`web/pc-firebase/js/net.js`・`web/pc-firebase/css/app.css`・`docs/FIREBASE_NET_MANUAL_FOR_AI.md` の表記を「ルームコード」に置き換え。
- ファイル: `web/pc-firebase/js/online.js`, `web/pc-firebase/js/net.js`, `web/pc-firebase/css/app.css`, `docs/FIREBASE_NET_MANUAL_FOR_AI.md`, `README4AI_Claude_Codex_Antigravity.md`

### 2026-11-16 23:54(PST)/ Antigravity / antigravity/firebase-net-20261117 & ccr-efc07031-6exjqs
- 目的: ユーザーの指示。GPT の Codex（および Claude Code）に通信部分の実装を引き継ぐための詳細マニュアルを作成する。
- 変更: [`docs/FIREBASE_NET_MANUAL_FOR_AI.md`](docs/FIREBASE_NET_MANUAL_FOR_AI.md) を新規作成し、`AGENTS.md`・`CLAUDE.md`・`README4AI_Claude_Codex_Antigravity.md` からリンクを追加。
- ファイル: `docs/FIREBASE_NET_MANUAL_FOR_AI.md`, `AGENTS.md`, `CLAUDE.md`, `README4AI_Claude_Codex_Antigravity.md`
- 他の AI への申し送り: 通信部分の仕組み・データベース構造・Kotlin `OnlineRoom` との連携・ポインター同期・自動クリーンアップ・変更時の注意点はすべて `docs/FIREBASE_NET_MANUAL_FOR_AI.md` にまとめてあります。

### 2026-11-16 23:48(PST)/ Antigravity / antigravity/firebase-net-20261117 & ccr-efc07031-6exjqs
- 目的: ユーザーの指示に従い、(1) 今後の開発を `Web_app` 軸に統一(`Windows-Projects` は今後いじらない)、(2) 従来の PC Web アプリ(`web/pc/`)を無変更で残したまま、Firebase 通信版を別パス `web/pc-firebase/` (`https://mitsuhira1.github.io/Web_app/pc-firebase/`) として配置してコミット・プッシュする。
- 変更:
  1. `Web_app/web/pc/` を元の状態(従来の WebRTC 版)に戻し、Firebase 通信版一式を `Web_app/web/pc-firebase/` に配置(Service Worker キャッシュ名も `asobipcfb-*` に分離して `web/pc/` と干渉しないように設定)。
  2. GitHub Pages のデプロイ対象ブランチ(`ccr-efc07031-6exjqs`)にも取り込んでプッシュし、`https://mitsuhira1.github.io/Web_app/pc-firebase/` で公開されるようにした。
- ファイル: `Web_app/web/pc-firebase/**`, `README4AI_Claude_Codex_Antigravity.md`, `AGENTS.md`, `CLAUDE.md`
- 確認: `web/pc/` が変更前のコミット `8066825` と完全一致していること(`git diff` 空)、および `web/pc-firebase/` で本番 Firebase(`asobi-box`)の 2 台接続・4 桁部屋作成・参加・対局同期が動くことを確認。
- 他の AI への申し送り: これからの PC ブラウザ版の開発は `Web_app` リポジトリの `web/pc-firebase/` を軸に進めること。`Windows-Projects` はユーザーが拡大を指示するまで変更しない。

### 2026-11-16 23:38(PST)/ Antigravity / antigravity/firebase-net-20261117
- 目的: ユーザーから提供された Firebase プロジェクト `asobi-box` の `firebaseConfig` を設定し、本番の Firebase Realtime Database (`https://asobi-box-default-rtdb.firebaseio.com`) を使ったオンライン通信を検証する。
- 変更: `js/net.js` の `firebaseConfig` に `asobi-box` の接続情報を設定。
- 確認: 本番の Firebase (`asobi-box`) に 2 つの独立したヘッドレス Chromium インスタンス(ホスト＋ゲスト)から接続する E2E 試験を実施し、匿名認証・4 桁部屋作成・ゲスト入室・リバーシ対局の手の同期・解散時の部屋削除がすべて成功することを確認。

### 2026-11-16 22:24(PST)/ Antigravity / antigravity/firebase-net-20261117
- 目的: ユーザーの指示。不安定・低速だった WebRTC + 公開 STUN + ntfy + 長い招待コードの通信処理と UI をすべて削除し、Firebase Realtime Database を使った 4 桁合言葉ロビー・状態同期・ポインター同期・自動ゴミ削除に書き換える。
- 変更: `js/net.js`・`js/online.js`・`css/app.css` を Firebase Realtime Database 仕様に書き換え。
- 確認: 30 ゲーム 90 本の規則再生テスト不一致 0 件、および E2E 試験合格。

### 2026-11-16 21:25(PST)/ Antigravity / antigravity/firebase-net-20261117
- 目的: ユーザーの指示。Codex の `dev/pc-web-20261117` と競合しないよう、Antigravity は別の名前のブランチ `antigravity/firebase-net-20261117` で作業する。

### 2026-11-16 21:15(PST)/ Antigravity / dev/pc-web-20261117
- 目的: ユーザーの指示。3 つの AI が互いの変更を読めるよう、共通の記録ファイル `README4AI_Claude_Codex_Antigravity.md`・`AGENTS.md`・`CLAUDE.md` を作成。
