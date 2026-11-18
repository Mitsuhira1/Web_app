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

### 2026-11-17 20:22(PST)/ Antigravity / ccr-efc07031-6exjqs
- 目的: ユーザーの指示。`web/pc-firebase/` の「みんなで遊ぶ」仕様拡張およびモバイル表示調整（7項目）。
  1. 部屋のアクティブ人数が選択ゲームの最大席数より多い場合、ホストがスタート押下時に観戦者を選ぶ確認シート（選択してスタート / キャンセル）を表示。
  2. 「みんなで遊ぶ」タブに公開・非公開設定を追加し、公開ルーム一覧を表示。
  3. 同じ位置にチャット ON/OFF（無効化）設定を追加し、無効時は送受信・スタンプ・通常チャット通知を抑止。
  4. 同じ位置に最大人数（2〜6人）・部屋のロック（これ以上入れない）設定を追加し、入室時に制御。
  5. 雰囲気（ガチ / ボチボチ / まったり）設定を追加し、公開ルーム一覧のクリックで確認シート（現在の人数 `〇/最大人数`・ステータス `ロビー`/`対局中`・チャット `ON`/`OFF`・雰囲気・選択中のゲーム + 参加/キャンセルボタン）を表示。
  6. スマホ版プレイヤー（幅920px以下または `(hover: none) and (pointer: coarse)`）はカーソルの送信・表示を行わない。
  7. スマホ版では左ナビの終了ボタン (`.quitbtn`) を表示しない。
- 変更:
  - `web/pc-firebase/js/net.js`: `DEFAULT_ROOM_SETTINGS`, `normalizeRoomSettings`, `extractPublicRooms`, `rooms/{roomId}/settings` 監視、`createRoom` / `joinRoom` での設定保存・ロック/最大人数チェック、`listPublicRooms`, `watchPublicRooms`, `updateRoomSettings`, `setPlayersSpectating` を追加。
  - `web/pc-firebase/js/online.js`: ルーム設定UI（作成前・作成後、ホスト編集可・ゲスト閲覧専用）、公開ルーム一覧 (`#pubroomsBox`) と詳細確認シート (`#pubroomDetail`)、チャット無効化 (`isChatEnabled()` / `.chat-off` / `CHAT_REQ|` 抑止)、スタート時観戦者選択シート (`openSpectatorSelectSheet`)、`onlineMenuDetail()` の定員超過時遷移許可と案内、`isMobileCursorOff()` によるポインター送受信・補間描画抑止、シート表示中の再描画抑止を実装。
  - `web/pc-firebase/js/app.js`: `isTouchDevice()` 追加、`rail()` でモバイル/タッチ端末の `.quitbtn` 非表示、`cursorOn()` でのモバイル/タッチ抑止、`render()` からの `syncPublicRoomsWatch()` 連携、`resize` 時のカーソル消去とブレークポイント再描画を追加。
  - `web/pc-firebase/css/app.css`: 公開ルーム一覧・詳細確認・無効チャット・観戦者選択用スタイルを追加し、`@media (max-width:920px)` と `@media (hover:none) and (pointer:coarse)` で `.quitbtn`, `.rcur`, `.aimring` を非表示化。
  - `tools/tests/firebase-memory-net.js`: メモリモックを `settings` 同期・ロック/定員チェック・`listPublicRooms`・`watchPublicRooms`・`updateRoomSettings`・`setPlayersSpectating` に対応。
  - `web/pc-firebase/sw.js`: キャッシュ名を `asobipcfb-20261117-room-pub-spec-mob-2` に更新。
- ファイル: `web/pc-firebase/js/net.js`, `web/pc-firebase/js/online.js`, `web/pc-firebase/js/app.js`, `web/pc-firebase/css/app.css`, `web/pc-firebase/sw.js`, `tools/tests/firebase-memory-net.js`, `README4AI_Claude_Codex_Antigravity.md`
- 確認: `git diff --check`、`node --check` (`net.js`, `online.js`, `app.js`, `sw.js`, `firebase-memory-net.js`)、`node tools/tests/check_transient_audio.cjs`、`node tools/tests/check_cursor_send.cjs`、およびヘッドレス Chromium CDP 複数タブ E2E 検証（公開/非公開・チャット無効・最大人数3人制限・ロック拒否/解除・公開ルーム一覧と詳細シートのキャンセル/参加・人数超過時の観戦者選択シートとキャンセル/開始・PC間リモートカーソル送受信・スマホ幅/タッチ端末での終了ボタン非表示＆カーソル非送信/非表示・コンソールエラー0件）すべて合格。`web/pc/` と `Windows-Projects` は無変更。未コミット・未プッシュ。

### 2026-11-17 20:09(PST)/ Antigravity / ccr-efc07031-6exjqs
- 目的: ユーザーの指示。`web/pc-firebase/` でページをリロードした際、初期描画から `render()` → `bgmSync()` 実行までの間に BGM 操作部 (`#bgs`) が一瞬表示される問題を修正する。
- 変更:
  - `web/pc-firebase/index.html`: `<div class="bgstrip" id="bgs" role="group" aria-label="BGM" hidden></div>` のように初期状態へ `hidden` 属性を付与し、HTML 解析直後から非表示にして `#app` 描画後の `bgmSync()` で `S.set.bgm` に応じて表示制御されるように修正。
  - `web/pc-firebase/sw.js`: キャッシュ名を `asobipcfb-20261117-bgm-hide-1` に更新。
- ファイル: `web/pc-firebase/index.html`, `web/pc-firebase/sw.js`, `README4AI_Claude_Codex_Antigravity.md`
- 確認: `git diff --check`、`node --check web/pc-firebase/sw.js web/pc-firebase/js/bgm.js web/pc-firebase/js/app.js`、`node tools/tests/check_transient_audio.cjs`、`node tools/tests/check_cursor_send.cjs`、およびヘッドレス Chromium CDP 検証（リロード中の全 DOM/Mutation イベントで `bgm=false` 時は `#bgs` が一度も表示されないこと、`bgm=true` 時も `#app` 描画完了前に先行表示されないこと）すべて合格。未コミット・未プッシュ。

### 2026-11-17 18:50(PST)/ Antigravity / antigravity/firebase-net-20261117
- 目的: ユーザーの指示。`web/pc-firebase/`（同一公開パス `https://mitsuhira1.github.io/Web_app/pc-firebase/`）をベースに、スマートフォン向け Web 対応（縦スクロール解禁、コンパクト上段ナビ、スライドアップ詳細シート、全30ゲームのモバイル盤面最適化、タッチ/ピンチ操作改善）を発展させる。
- 変更:
  - `web/pc-firebase/index.html`: `viewport-fit=cover`、`mobile-web-app-capable`、`apple-mobile-web-app-capable`、`apple-mobile-web-app-status-bar-style` を追加。
  - `web/pc-firebase/js/app.js`: `isMob()` (`<= 920px`)、画面遷移関数 `go()` での `S.mobDetail = false` リセット、モバイル上段ルームバー(`.mob-roombar`)とスライドアップ詳細シート(`.detail.open` / `.detail-backdrop` / `.detail-mobhd`)、タイル単押しでシートを開きモバイル時は不要な再タップ音を抑制 (`clickSound()`)、`render()` 内でモバイル時は `body.style.height`/`width` 固定を解除（125%/150% 拡大時も縦スクロール可能に）、`setupDrag()` の `pointercancel` cleanup、ブラウザバック・リサイズ対応を追加。
  - `web/pc-firebase/js/online.js`: ルーム待機時の詳細シート `onlineMenuDetail()` にも `.detail-mobhd` 閉じるヘッダーと `.open` 状態を反映。
  - `web/pc-firebase/js/boards/life.js`: 人生すごろく盤面 `#lview` にタッチ向けズームオーバーレイ(`.lzoom`: `＋` / `－` / `◎`)と2本指ピンチズーム＋`pointercancel` cleanup を追加。
  - `web/pc-firebase/css/app.css`: `@media (hover:none) and (pointer:coarse)` の hover 抑止・`touch-action: manipulation`、`@media (max-width:920px)`・`(max-width:640px)`・`(max-height:540px) and (max-width:960px)` のレスポンシブスタイルを追加（`html, body { overflow-x: clip; overflow-y: visible }` で `.setupfoot` の `position: sticky` を有効化、4列ナビ、横並びフィルタ、対局右上設定ボタン、将棋/ヨット/ヒット＆ブロー縦積みレイアウト、カード卓/スピード/ソリティア/麻雀の手牌・卓サイズ調整、成績表・ルーム入力欄・すごろく/ルドーの座席バッジ最適化）。
  - `web/pc-firebase/sw.js`: キャッシュ名を `asobipcfb-20261117-mobile-web-1` に更新。
- ファイル: `web/pc-firebase/index.html`, `web/pc-firebase/css/app.css`, `web/pc-firebase/js/app.js`, `web/pc-firebase/js/online.js`, `web/pc-firebase/js/boards/life.js`, `web/pc-firebase/sw.js`, `README4AI_Claude_Codex_Antigravity.md`
- 確認: `node --check`（編集JS4ファイル）、`git diff --check`、およびヘッドレス Chrome モバイル検証（390×844 初回画面・メニュー縦スクロール・詳細ボトムシート・設定sticky下部・ルーム・成績・設定全7カテゴリ・150%表示・ルールモーダル・全30ゲーム盤面、360×740主要12ゲーム、844×390横画面将棋、1280×800 PC版回帰）すべて `overflow: 0`・`ERRORS: NONE` で合格。主要画面と配布完了後の花札・ソリティア・麻雀・すごろく等のスクリーンショットを目視確認済み。`antigravity/firebase-net-20261117` および `ccr-efc07031-6exjqs` へコミット・プッシュ済み（`web/pc/`・`Windows-Projects` は無変更）。
- 他の AI への申し送り: `web/pc-firebase/` 側のモバイルレイアウトは `css/app.css` 末尾の `@media` 群と `app.js` の `isMob()` / `S.mobDetail` で管理している。`html, body` に `overflow-y: auto` を付けると `.setupfoot` の `position: sticky` が効かなくなるため `overflow-x: clip; overflow-y: visible` を維持すること。

### 2026-11-17 18:18(PST)/ Antigravity / antigravity/firebase-net-20261117
- 目的: ユーザーの指示。ヨット (`yacht`) で同じ目が5つ出たとき、プレイヤーとCPUがフルハウスとして得点・選択できていた不具合を修正する。
- 変更:
  - `web/pc-firebase/core/asobi-pc-core.mjs`:
    - `Companion_29.prototype.s20` の `c === 8`（フルハウス）から `element_0 === 5`（同じ目5つ）の判定を削除し、「同じ目3つ＋別の同じ目2つ」のときのみ合計点を返すように修正（同じ目5つは `0` 点となり、CPU の評価関数 `v20` でも不成立扱い `-12.0` となる）。
    - `Catalog()` 内のヨットの役説明「3つ+2つ(5つ同じも可)」を「3つ+2つ(別の目)」に更新。
  - `web/pc-firebase/js/boards/fix.js`: `ysc(dice, 8)` から `v.length === 1 ||` を削除し、補助ラベル `YH[8]` を「3 個 + 別の 2 個で合計」に更新。
  - `web/pc-firebase/js/boards/games2.js`: `yachtScore(dice, 8)` から `v.length === 1 ||` を削除。
  - `web/pc-firebase/sw.js`: キャッシュ名を `asobipcfb-20261117-yacht-fullhouse-fix-8` に更新。
- 確認: `node --check`、`git diff --check`、および Node 検証（1〜6 全種のゾロ目実対局・通常フルハウス `3+2`・フォーダイス `4+1`・ヨット判定、`ysc`/`yachtScore`/`rulesJson`、CPU レベル 0/1/2 選択と 150 局シミュレーション）合格。`antigravity/firebase-net-20261117` および `ccr-efc07031-6exjqs` へコミット・プッシュ済み。

### 2026-11-17 06:30(PST)/ Antigravity / antigravity/firebase-net-20261117
- 目的: ユーザーの指示（`web/pc-firebase/` のオンライン対戦強化7点）。
  1. プレイヤーリストからメンバーをクリックして「ホストを変更」（ルームコード維持）と「キック」を行えるようにする。
  2. ホストが試合・部屋から抜けた際、即解散ではなく他のプレイヤーがホストを引き継げるようにする（1人だけの時や明示的解散時は従来通り解散）。
  3. ルームを建てた状態でも1人プレイ（シングルプレイと同じ設定・内容、同時進行ゲーム対応）で待ち時間に遊べるようにし、誰かが参加したら「〇〇が参加しました。現在のゲームを終了しますか？」（続ける / 終了する）の確認を出す。1人プレイ中の参加者は進行中の盤面を観戦可能。
  4. 1人→2人目やマルチプレイ中を問わず、誰かが参加したら一律でチャットに「〇〇が参加しました」と通知を出す。
  5. 部屋を解散したらチャット内容（RTDB・コア・ローカル）を消去する。
  6. マルチプレイで着席プレイヤーが「CPUに操作を任せる」（難易度: **中級 (`level = 1`)**）に切り替えられる機能を追加し、他のプレイヤーには「CPUが操作中…」と表示する。
  7. ロビー/ゲーム選択に「観戦モード」を追加し、複数人ルーム内で一時的に対局から外れて途中入室時と同じ観戦画面で見られるようにする。
- 変更:
  - `web/pc-firebase/core/asobi-pc-core.mjs`: `HELLO` の任意 slot 指定、`CHAT` の `kind === 2` システム通知対応、`cpuChoose` の任意 `levelOverride` 引数追加、`onlineLeave` のチャット完全クリア、`onlineState()` への `seed`/`seatSlots` 露出、`onlineStartReady` / `onlineSystemChat` / `onlineStartParticipants` / `onlineAssumeHost` / `onlineConvertSeatToCpu` をエクスポート追加。
  - `web/pc-firebase/js/net.js`: `hostUid` / `kicked/{uid}` 監視、動的 `syncDisconnectPolicy(playerCount)`、`setPlayerFlags`、`transferHost`、`assumeHost`、`kickPlayer`、`leaveRoom(mode)`、動的 `startActionWatch`/`stopActionWatch` を実装。
  - `web/pc-firebase/js/online.js`: 上記 UI（メンバー操作シート、対局中メンバーシート、1人プレイ参加確認シート、観戦モード・CPU委任トグル）とホスト移譲/自動引き継ぎ/キック/一律システムチャット/1人待ちプレイ制御を実装。
  - `web/pc-firebase/js/app.js`: 1人待ちプレイ設定・同時進行ゲーム (`isConcurrent`/`cpuSeats`/`cpuChooseSeat`) 対応、対局中 `.online-ops`（`CPUに操作を任せる`/`メンバー`）追加、ホストによる中級 (`level=1`) 自動代理着手（`cpuTurnKey` 多重起動ガード含む）、CPU操作中の自手・待った・降参無効化と「CPUが操作中…」表示、ホスト離脱時の「ホストを引き継いで出る」確認を追加。
  - `web/pc-firebase/css/app.css`, `web/pc-firebase/sw.js`: バッジ・システムメッセージ・対局中追加ボタン用スタイルを追加し、キャッシュ名を `asobipcfb-20261117-online-room-features-7` に更新。
  - `tools/tests/firebase-memory-net.js`, `docs/FIREBASE_NET_MANUAL_FOR_AI.md`: テスト用メモリモックを新APIに対応させ、通信仕様書に第11章を追記。
- 確認: `node --check`、`check_transient_audio.cjs`、`check_cursor_send.cjs`、Playwright 3クライアント E2E 9シナリオ検証、および既存回帰検証（左ナビ固定位置・フィルタアニメーション・途中入室観戦・カーソル色/補間・二重効果音抑止・対局中設定・非表示タブ音声破棄）すべてエラー0で合格。`web/pc/` と `Windows-Projects` は無変更。未コミット・未プッシュ。

### 2026-11-17 01:07(PST)/ Antigravity / antigravity/firebase-net-20261117
- 目的: ユーザーの指示。左側ナビゲーション(`.rail`)のルーム情報(`.room-summary`)が「ゲーム」タブ(`menu`)でしか表示されず、タブを切り替えるたびに出たり消えたりして不自然だったため、すべての画面(`ゲーム`・`みんなで遊ぶ`・`成績`・`設定`)で同じ位置に表示するようにする。
- 変更:
  1. `web/pc-firebase/js/app.js` の `rail(cur)` で `${roomSummary()}` を `cur === 'menu'` の条件分岐の外（`.tabs` の直下）に出し、全タブ共通で同じ座標に表示。
  2. `web/pc-firebase/js/online.js` の `onlineChanged()` で `records`・`settings` 画面表示中もルーム状態・参加者の変化に応じて再描画されるよう更新し、`onlineClick` のコピーボタン反応をクリック対象ボタン優先に調整。
  3. `web/pc-firebase/sw.js` のキャッシュ名を更新し、`tools/tests/check_firebase_ui.py` に全タブでの `.room-summary` 表示と座標一致の検証を追加。
- ファイル: `web/pc-firebase/js/app.js`, `web/pc-firebase/js/online.js`, `web/pc-firebase/sw.js`, `tools/tests/check_firebase_ui.py`, `docs/FIREBASE_NET_MANUAL_FOR_AI.md`, `README4AI_Claude_Codex_Antigravity.md`

### 2026-11-17 / Codex / ブラウザのタブアイコンを角丸へ統一
- 目的: ブラウザに表示されるアプリアイコンも真四角を避ける。
- 変更: `web/pc-firebase/index.html` のfavicon参照を、既存の透過角丸素材 `icons/icon-round-192.png` へ変更。ホーム画面用・PWA用アイコンはすでに同じ角丸素材を使っているため、そのまま共用する。
- 確認: faviconの参照先が存在し、四隅が透過されたPNGであることを確認。Service Workerのキャッシュ名も更新。

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

### 2026-11-17 01:58(PST)/ Antigravity / antigravity/firebase-net-20261117 & ccr-efc07031-6exjqs
- 目的: ユーザーの指示(3点)。
  1. 左ナビ(`.rail`)の「人数」フィルタは「ゲーム」タブ(`menu`)のみ表示とし、切り替える際に1フレームで切り替えずアニメーションを付けること。また「人数」を上側・ルーム情報(`.room-summary`)をその下に配置し、ルーム情報が出た瞬間に「人数」が下に移動しないようにすること。他タブに切り替えた時もルーム情報の位置(Y座標)を変えないこと。
  2. ルームが試合中(`phase === 'PLAYING'`)でもルームに入ること自体を可能にし、対局画面を閲覧(観戦)できるようにすること。
  3. 改善完了後にコミット・プッシュして公開すること。
- 変更:
  - `web/pc-firebase/js/app.js`: `rail(cur)` で `.rail-filter` を `.tabs` の直下・`roomSummary()` の上に配置し、`menu` 以外のタブでは `.is-hidden` (`visibility: hidden; pointer-events: none;`) を付与して「人数」と `.room-summary` の座標を固定。フィルタ切り替え時に `.main.filter-enter` と `.filter-pop` を付与してアニメーション表示。観戦時(`online && view && view.mine < 0`)の `subText`（「みんなで遊ぶ・観戦中」）・`seatName`・`face`・`showResult`・`askQuit`・`goBack` を観戦者向けに調整。
  - `web/pc-firebase/css/app.css`: `.rail-filter.is-hidden` およびフィルタ切り替えアニメーション (`filterShelfIn`, `filterTileIn`, `filterBtnPop`) を追加。
  - `web/pc-firebase/core/asobi-pc-core.mjs`: `beginOnline` で自分のスロットが `seatSlots` に含まれない場合（途中入室者・3人目以降の観戦者）も `Session` を生成して `matchHandle` を設定するように変更。`setup$lambda_9` で観戦者の `undoOk` を常に `false` に維持。
  - `web/pc-firebase/js/online.js`: `applyRemoteStateOnGuest` で `s.members` と `fbState.players` をマージして途中入室直後から `WELCOME`/`ROSTER`/`BEGIN`/`SYNC` が通るように対応。観戦者が対局画面から部屋へ戻る際に降参扱いにしないよう `leaveOnlinePlay` を調整し、部屋・メニュー詳細から「対局を観戦する」(`data-oreturn`) で戻れるように対応。
  - `web/pc-firebase/sw.js`: キャッシュ名を `asobipcfb-20261117-spectate-filter-6` に更新。
  - `tools/tests/firebase-memory-net.js`, `tools/tests/check_firebase_ui.py`, `docs/FIREBASE_NET_MANUAL_FOR_AI.md`: 3クライアント（ホスト・ゲスト・途中入室観戦者）および左ナビ固定位置・フィルタアニメーションの自動検証とドキュメントを追加。
- ファイル: `web/pc-firebase/js/app.js`, `web/pc-firebase/js/online.js`, `web/pc-firebase/css/app.css`, `web/pc-firebase/core/asobi-pc-core.mjs`, `web/pc-firebase/sw.js`, `tools/tests/firebase-memory-net.js`, `tools/tests/check_firebase_ui.py`, `docs/FIREBASE_NET_MANUAL_FOR_AI.md`, `README4AI_Claude_Codex_Antigravity.md`
- 確認: `node --check`、単体テスト (`check_transient_audio.cjs`, `check_cursor_send.cjs`)、および Playwright E2E (`check_firebase_ui.py`) 合格。
- 他の AI への申し送り: 左ナビの `.rail-filter` と `.room-summary` の順序・`.is-hidden` による高さ保持を崩さないこと。

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

### 2026-11-17 03:45(PST)/ Antigravity / antigravity/firebase-net-20261117
- 目的: ユーザーの指示。盤面デザイン・UI には一切手を付けず、新規12ゲーム（戦争、たこやき、ぶたのしっぽ、ババ抜き、ハーツ、ジンラミー、ハゲタカのえじき、ごいた、クアルト、ガイスター、ラミィキューブ、ペグ・ソリティア）のゲーム処理・CPU AI・ローカルルール・`viewJson`・`Catalog` 登録・Codex 引き継ぎ仕様書を実装する。
- 変更:
  - `web/pc-firebase/core/games/_utils.mjs` および `web/pc-firebase/core/games/{war,takoyaki,butanoshippo,oldmaid,hearts,ginrummy,vulture,goita,quarto,geister,rummikub,pegsolitaire}.mjs` を新規作成（全12ゲームのルール・ローカルルール・CPU AI・`viewJson` マスキングを実装）。
  - `web/pc-firebase/core/extra-games.mjs` を新規作成し、`web/pc-firebase/core/asobi-pc-core.mjs` の `Catalog()` と `extraView()` に最小フックを追加（全42ゲーム構成）。
  - `tools/tests/test_extra_12_games.mjs` を新規作成（全12ゲーム・ローカルルール26パターンの CPU 完走、非公開情報マスキング、`undoMove`、`restoreMatch` 検証）。
  - `docs/NEW_12_GAMES_SPEC_FOR_CODEX.md` を新規作成（Codex 向けの全12ゲーム仕様・`move` エンコード・`viewJson` スキーマ・UI 実装ガイド）。
- ファイル: `web/pc-firebase/core/games/*.mjs`, `web/pc-firebase/core/extra-games.mjs`, `web/pc-firebase/core/asobi-pc-core.mjs`, `tools/tests/test_extra_12_games.mjs`, `docs/NEW_12_GAMES_SPEC_FOR_CODEX.md`, `README4AI_Claude_Codex_Antigravity.md`
- 確認: `node tools/tests/test_extra_12_games.mjs` にて全件合格 (`ALL TESTS PASSED!`)。UI/CSS/盤面ファイル (`css/`, `js/boards/`, `js/art.js`, `js/app.js`) は無変更。
- 他の AI への申し送り: 盤面UI・描画の実装は [`docs/NEW_12_GAMES_SPEC_FOR_CODEX.md`](docs/NEW_12_GAMES_SPEC_FOR_CODEX.md) を参照してください。
