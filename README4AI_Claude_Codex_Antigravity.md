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
従来の WebRTC・STUN/TURN・ntfy・長い招待コード/返信コードのやり取りと UI を廃止し、Firebase Realtime Database (`asobi-box`) による 4 桁合言葉マッチング＋リアルタイム同期に置き換えた。将来 Android アプリ版・スマホ Web 版・Windows(.exe)版とクロスプレイする際も以下の汎用 JSON 構造に合わせる:

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
| Antigravity | `Web_app/web/pc-firebase/` の公開とコミット・プッシュ | `Web_app/web/pc-firebase/*` | 2026-11-16 |

## 5. 変更の記録(新しいものを上に)

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
