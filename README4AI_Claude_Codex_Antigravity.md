# README4AI — Claude・Codex・Antigravity(Gemini)共通の作業記録

> **AI へ: 先に [`START_HERE.md`](START_HERE.md) を読むこと。このファイルは 1〜4 章と、5 章の新しい数件だけを読めばよい(古い記録は読まない)。作業したら「5. 変更の記録」の先頭に追記すること。**
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

### 2026-11-21 / Claude / ぶにょぶにょ: 落とすと消える粒を先に光らせる、ぷよのふちを滑らかに
- ユーザーの指示: 落とした時に消える下のぷよもハイライト(連鎖で消える分はしない。2色消える時は両方)。`js/bunyo.js` の `popPreview()`: 今の位置で落とした形で最初に消える盤の粒(隣のお邪魔を含む)を `st.preview` に入れ、移動・回転のたびに計算し直す。`js/falling-fx.js`: 軸と同じ「ふちだけ白く光る輪」(`bunyoRim`)をその粒に重ねる。
- ふちが荒れて見える: つなげる処理のしきい値の傾き(26)が急すぎて、ふちが1画素未満で切り替わりギザギザになっていた。ぼかしの大きさに合わせて傾きをゆるめ(ふちが約1画素で切り替わる)、しきい値の位置は同じ。CSS の filter は足していない(Edge の決まりどおり)。
- 確かめたこと: 黄と緑が同時に消える盤で両方の3個が光る、2倍・等倍の画面とアイコンでふちが滑らか、規則の試験 11 件。Edge は未確認。

### 2026-11-21 / Claude / ぶにょぶにょ: 回る軸のハイライトを「ふちだけ白く光る」に
- ユーザーの指示: 粒全体を白くすると不自然。動画のように枠だけ光らせる。`js/falling-fx.js` の `bunyoSvg`: 軸の粒は元の色のまま、ふちに白い輪(細い線＋淡い広がり)を重ね、明るさをゆっくり波打たせる。`sw.js` のキャッシュ名を更新。
- 確かめたこと: Chromium で操作中の組を撮り、軸の粒だけふちが光ることを確認。エラーなし。

### 2026-11-21 / Claude / 胸毛絶体絶命: ほかの人のカーソルを盤に合わせて出す・公開
- `js/online.js` の `getViewportBox`: `#boardwrap` が無い画面では `.stage` を基準にしていたため、窓の大きさが違うとカーソルがずれた。胸毛絶体絶命の時は盤(`#mnTable .mn-board`、縦横比が決まっている)を基準にする。
- 確かめたこと(模擬通信): ゲスト 1500×900・ホスト 1280×800 で、ゲストが 10 番に乗せたカーソルがホストの画面の 10 番の中心(誤差 1px)に名前つきで出る。
- ユーザーの指示で公開用ブランチ `ccr-efc07031-6exjqs` に反映。

### 2026-11-21 / Claude / 新ゲーム「胸毛絶体絶命」を実装(50 種目)
- ユーザーが見本(胸毛は参考の絵に合わせた版)を了承 →「それで実装して、音とかもちゃんと作り込んで」。
- `js/munage.js`(新規): 坊主めくりと同じく `boardMatch` の上で動く(ひとりで遊ぶ: CPU 1〜5 人 / みんなで遊ぶ: 2〜6 人)。順にボタンを押し、点火スイッチ(1 個)を押した人がおっさんを飛ばす。設定: ボタン 12/24 個、飛ばした人の負け/勝ち、最初の手番、CPU の手番の長さ(`store` の `munageSetup`)。**点火スイッチの場所はホストの手元(`secret`)だけに置き、部屋の state には入れない**。ホストが代わった時は、押されていないボタンから選び直す。成績は `vs_munage`。
- 画面: 共通の `playHeader`・`playSide`・`playGear` を使う(左上の戻る・右の側板・左下の設定)。盤は `#mnTable`(class `boardwrap k-munage`。スマホの並びの CSS がそのまま効く)、席は `#strip`。スマホ幅は 24 個を 6 列 × 4 段にする。盤と打ち上げのアニメの絵は見本と同じ。`もう一度` は 1 人の時とホストだけ。
- 効果音(Web Audio で作る。設定の音量・消音・裏の音に従う): 押す(カチッ+コトン)/ セーフ(木琴 2 音)/ 残りが少ない時の心臓 / 導火線(シュボッ+パチパチ)/ 驚く顔(ジャーン)/ ドーン / 打ち上げ(上がる笛+風)/ キラーン / しょんぼりトロンボーン(勝ちの設定ではファンファーレ)。アニメはタップで最後のカットインまでとばせる。アニメーションの省略の設定では、アニメを出さず音とカットインだけ。
- つないだ所: `js/app.js`(ORDER・newGameSetup・画面 `munageSetup`・`data-munage-start`・設定の `munage:`・戻る・CAT)、`js/online.js`(準備画面の一覧)、`js/rules.js`(ルール)、`js/art.js`(アイコン)、`index.html`、`sw.js`(ファイルとキャッシュ名)、`START_HERE.md`、UI 試験の「49」を「50」に(`tools/tests/check_firebase_ui.py`・`check_records_ui.py`)。
- 確かめたこと(Chromium): PC 1280×800 とスマホ(iPhone 13 相当)で、メニュー → 準備 → 対局 → 点火 → アニメ → カットイン → もう一度(エラー無し)、模擬通信の 2 人対戦(ゲストに場所が送られない・両方でアニメ・もう一度の同期)、効果音を書き出して音量を測り調整(割れない)。`test_extra_12_games`・`test_roulette_core`・`test_spider_core`。未確認: Python の UI 試験(playwright for Python が無い)、本物の Firebase とスマホ実機。

### 2026-11-21 / Claude / 「胸毛絶体絶命」の見本: 胸毛を参考の絵(アニメ)の描き方に
- ユーザー: くるくるの線も「全然ダメ」。アニメの毛深い男性の絵を示して「こんな感じに」。
- `chestHair` を、短い毛の線(両端が細い形、`hairStroke`)を 2〜4 本ずつ束にし、胸の上・胸板・胸板の下の縁・真ん中〜おなか・肩の 20 か所(左右対称)に、体の丸みに沿う向きで散らす描き方に。盤面・コマ送り・動画・`hair_compare.png` を撮り直した。

### 2026-11-21 / Claude / 「胸毛絶体絶命」の見本: 胸毛を「手でくるくる描いた線」に
- ユーザー: 3 案(形・波線・ぼかし)は全部だめ。「手でくるくるくるって描いたような見た目でいい」。
- `docs/mockups/munage/munage_board.js` の `chestHair` を、案内の線に沿って輪を描くループの線(`coil`、トロコイド)に。胸の上を左右へ 9 輪、真ん中を へそ へ 7 輪。輪の大きさを ±20% 揺らす。A・B・C の案は削除。盤面・コマ送り・動画・`hair_compare.png` を撮り直した。

### 2026-11-21 / Claude / 「胸毛絶体絶命」の見本: 胸毛のやり直し(3 案)
- ユーザーの指示「胸毛のデザインやり直し」。前の版(細い毛を乱数で約 60 本)は落書きのように見えた。
- `docs/mockups/munage/munage_board.js` の `chestHair` を 3 案に: A 形で描く(塊の輪郭を滑らかな曲線にして縁を巻き毛の波に)/ B 波線で描く(胸の真ん中から外・下へ扇のように短い波線、へそへ細い筋)/ C ぼかし(ぼかした地と縁の細い毛)。どれも位置を下げて、ひげとつながらないようにした。見本の標準は B。比べる絵 `hair_compare.png`(`compare_hair.cjs`)。盤面・コマ送り・動画も B で撮り直した。

### 2026-11-21 / Claude / 「胸毛絶体絶命」の見本 第 3 版(サーカスの舞台・24 ボタン・アニメ映像)
- ユーザーの指示: 背景はカードゲーム風でなくてよい / 「点火スイッチは 1 つ」の札は不要 / ボタンを倍(24 個)にして 2 段 / おっさんを少し小さく / 胸毛はもじゃもじゃしすぎ、アニメのように自然に / 発射したらアニメの映像に切り替える / 動画で見られるように。
- 盤: 赤と生成りのしまの幕・左右の緞帳・床板・スポットライトの舞台。太鼓の台に臼砲。操作盤は紺に金縁、ボタンの数字は頭に。胸毛は胸の真ん中から外・下へ流れる短い毛(約 60 本)と薄い影。
- 外れ: 盤の導火線の先に火 → 黒帯つきのアニメ映像(驚く顔+集中線 → 導火線 → 白黒の「ドーン!!」→ カメラが追う打ち上げ → キラーン)→ アプリと同じ赤のカットイン。約 5 秒。
- 見本と動画: `docs/mockups/munage/`(README.md に GIF。launch.mp4)。アプリ本体はまだ変えていない。

### 2026-11-21 / Claude / 共通 UI の決まりを明記、「胸毛絶体絶命」の盤面見本をやり直し
- ユーザーの指示: 左上の戻る・盤面の一番右の側板・左下の設定(歯車)は**全ゲーム共通**。新しいゲームも作り直さない。見本も PC 版の実際の対局画面の中で作る。→ `CLAUDE.md` に「全ゲーム共通の画面部品」、`START_HERE.md` の守ることに 1 行。
- 胸毛絶体絶命: 前の見本(独自の見出し・空の背景の単独ページ)は不合格。実際の対局画面(たこやきの画面を借りて `#boardwrap` だけ差し替え)に、くるみ枠のフェルトの卓・木の丸台に載せた臼砲(中に胸毛のおっさん)・下に真鍮縁の操作盤と赤いボタン 12 個(押すと緑)を描いた見本を作った。外れを押すと導火線に火が走り、大砲が震え、全画面の空へ打ち上げ→キラーン→アプリと同じ赤のカットイン「ゲームオーバー / 〇〇の負け」。
- 見本: `docs/mockups/munage/`(`munage_board.js` を対局画面に差し込む。`shoot.cjs` で撮る)。**アプリ本体はまだ変えていない**。了承後に規則・CPU・盤を実装する。スマホ幅ではボタンが小さい(1 列 12 個)ので、実装時に 2 段にする。

### 2026-11-21 / Claude / ルーレット: スマホでは回転盤を回る時だけ中央に浮かせる。新ゲーム「胸毛絶体絶命」は見本だけ
- ルーレット(`js/boards/roulette.js`・`css/app.css`): 1 列の並び(`@container (max-width:875px) and (min-height:441px), (max-width:519px)`)では、ベット中は `.rq-wheel-panel` を隠し、`.is-spinning` の間だけ盤(#boardwrap)いっぱいの半透明の幕の中央に回転盤を出す。止まった後 1.6 秒は `.is-settling` で出目を見せ、押すと閉じる(`wheel.settleUntil`・`settleTimer`)。回っている間は盤のスクロールを止める。PC・横向きの 2 列の並びは変えていない。規則は変えていない。
- 胸毛絶体絶命(黒ひげ危機一髪がモチーフ): ユーザーの指示で、まず盤面の見本(動く HTML)を作って提案。リポジトリには入れていない。了承後に実装する。
- ファイル: `web/pc-firebase/js/boards/roulette.js`・`css/app.css`・`sw.js`(キャッシュ名)・`docs/CHECKLIST_PENDING.md`
- 確かめたこと(Chromium・iPhone 13 相当): ベット中は回転盤が非表示、スピン中は中央に表示、止まった後に消える、`test_roulette_core`。PC(1280px)は回転盤が横に出たままで変化なし。未確認: スマホ実機、通信対戦。ベッティングテーブル自体は iPhone 13 で盤の高さの約 1.9 倍あり、まだスクロールは残る。
### 2026-11-21 / Claude / Edge で画面が固まる不具合(原因と再発防止は CLAUDE.md)
- 原因: ぶにょぶにょの絵(`js/falling-fx.js` の `bunyoSvg`)の外側の `<svg>` に付けた CSS `filter: drop-shadow`。メニューのアイコンでは別の `<svg>` の中に入れて表示していて、Edge で描き直すと描画が終わらなくなる。CSS の影をやめ、SVG フィルターの最後の `feDropShadow` に置き換えた(光の計算は元のまま)。
- 調べる道具を残した: `?diag`・`?diag=deep`(記録、見るのは `diag.html`)、`?nofx=bunyo|svg|css`(フィルターを止める)、起動で止まった時の安全装置(`index.html`)。記録は `?diag` の時だけ動く。
- 確かめたこと: ユーザーの Edge で `nofx` の切り分け(bunyo・css で固まらない、svg で固まる)、修正後に普通の URL で固まらない。手元の Chromium では最初から再現しなかった。

### 2026-11-21 / Claude / 坊主めくり: 札の並びを持ち、坊主・姫の動きを作り直し、字の欠け
- 振り分けの確認: 名前(坊主 13・姫 21)と 100 枚の絵が全部合っていた。「殿で坊主になる」に見えたのは、CPU の坊主の動き・カットインが終わる前に自分が引けたため(前の坊主のカットインが後から出る)。動きとカットインが終わるまで山札を押せない(`.poet-busy`、CPU も `busyUntil` を待つ)。
- 状態に札の並びを足した(見せ方のためだけ。枚数の数え方は変えない): `seats[i].pile`・`field`(下→上)。姫は場札を姫の下へ入れ、姫が一番上。古い状態で並びが無い時は一番上以外を裏で見せる。
- `draw`: 前の描画の写し(`shown`)から、札が着くまで前の一番上・枚数を見せる(`showOwn(el, 一番上, 枚数)`)。坊主は坊主をいったん一番上に乗せ、上から 1 枚ずつ表で持ち上げて飛びながら裏返し場札へ(`stream`、3D の箱には透明度を付けない)。姫は場札を上から 1 枚ずつ裏のまま姫の札の下へ(`.poet-stream.under` と `.poet-place.taking`)。音は `SHUFFLE`。最後に状態どおりにそろえる。
- 字の欠け: `fonts/ZenAntique.woff2` に 篁・躬・岑・暹・殷・杣 が無く、別の字体で出ていた → `fonts/ZenAntique-Extra.woff2`(この 6 字だけ、`unicode-range`)。`fonts/YujiBoku-Koma.woff2` は駒の字だけの縮小版で、カットインは筆文字になっていなかった → `fonts/YujiBoku-Bozu.woff2`(Google Fonts の Yuji Boku・OFL から必要な字だけ、family 名 `Yuji Boku Fude`)。
- 確かめたこと(Chromium): 坊主(自分・CPU)・姫(自分・CPU)の途中のコマ、動きの後の枚数と状態の一致・並びの枚数の一致(1 局通して食い違い 0)、6 字の札、カットインの筆文字、`test_extra_12_games`。
- 未決: 坊主の札そのものは、今の規則では場札に数えない(見た目では手元の札と一緒に場札へ流れる)。

### 2026-11-21 / Claude / 人生すごろく: 止まったマスの説明の OK を押しても閉じなかったのを直した
- 原因: 盤のクリックは `js/app.js` の `wrap.onclick` が受けるが、演出の待ち時間(`busy`)は全部捨てる。説明の表示時間も `A.anim` で待ち時間に入れていたので、OK が届かなかった。
- `js/boards/life.js`: 説明の札(`#lstop` の OK・`#lsq` の 閉じる)に札自身の `onclick` を付けて、待ち時間でも閉じるようにした。消えた後は `hidden` にする(前は透明のまま残り、盤の真ん中のクリックをふさいでいた)。`sw.js` のキャッシュ名を更新。
- 確かめたこと: Chromium で CPU 戦を始めて回し、OK を押すと閉じる(直す前は閉じない)ことを確認。エラーなし。みんなで遊ぶでは未確認。

### 2026-11-21 / Claude / ぶにょぶにょ・パクリスのメニューのアイコンを今の盤に合わせた
- `js/falling-fx.js` の末尾で `AR.bunyo`・`AR.pakuris` を上書き(`js/art.js` の古い紫の盤・「準備中」の帯の絵は使わない)。盤と同じ描き方(ぷよはつながる粒、ブロックはすき間なし・Tの影と通った道の光)で、明るい地に細い枠とマス目。`sw.js` のキャッシュ名を更新。
- 確かめたこと: Chromium で2つのアイコンを描いて見た目を確認、エラーなし。

### 2026-11-21 / Claude / ぶにょぶにょ・パクリスの画面・演出・音を作り直し、CPU 対戦・何本先取・Tスピンを追加
- ユーザーの指示: 動画サンプルに似せて盤とアニメーションを作り直す(見本ページで了承済み)。盤の地はメニューと同じ。右の共通 UI・左下の設定・左上の戻るは共通。操作はキーボード中心で画面に操作ボタンを置かない。最大4人。
- 新規 `js/falling-fx.js`: 光と粒(キャンバス)・効果音(Web Audio で生成。回す音・ドシャーンなど)・ぷよの描き方(同じ色を SVG のぼかし＋しきい値でつなげ、光を当てる)・パクリスのブロック。新規 `css/falling.css`。
- `js/bunyo.js`・`js/pakuris.js`: 盤1枚の動き(Board)・CPU・規則を作り直し。ぶにょは色の順・点数・お邪魔は従来どおり。横置きで片方が浮いたまま残る不具合を直した。パクリスは**規則を追加**(ユーザー了承): SRS 回転(壁蹴り)・左回転・着地後1回分の猶予・Tスピン(3隅判定・ミニ)・BACK to BACK(点数1.5倍・お邪魔+1)。Tスピンのお邪魔 2/4/6、点数 800/1200/1600。普通の消し方・REN・全消しは従来どおり。
- `js/falling-match.js`: ひとり / CPU と対戦(1〜3人・3段階)/ みんなで遊ぶ(2〜4人)。何本先取(1・2・3・5)。自分の盤は右・相手は左、盤の下にスコアと名札、2人は中央に WIN と星、3〜4人は WIN の表。通信の progress に `next`(つぎ)を足し、boardMatch の state に `round`・`wins`・`target`・`matchOver`。ホストが勝負の約3秒後に `nextRound` を送る。古い版の progress(next なし)も受け付ける。
- `js/app.js`(画面を出る時の後片付け・「もう一度」・人数表記 1〜4人)・`js/gamepad.js`(左回転・すぐ落とす)・`js/rules.js`(操作・Tスピン・先取)・`index.html`・`sw.js`(キャッシュ名)。
- 試験: 新規 `tools/tests/test_falling_rules.mjs`(11件)。Playwright(ファイルを直接返す方法、メモリ版通信)で、CPU 1〜3人の対戦、回の進行と優勝、ひとりの終了と Enter でやり直し、実際の盤での Tスピン ダブル(1200点・BACK to BACK 成立)、3人の通信対戦(つぎの受け渡し・勝ち数・優勝)、スマホ幅(横スクロールなし)を確認。音は耳では未確認。スマホ実機・本物の Firebase は未確認。

### 2026-11-21 / Claude / 坊主めくり: 持ち札の厚みの時機、坊主・姫で札が流れる動き
- `js/poet-cards.js` の `draw`: 描き直しの前に各席の枚数・一番上の札と場札の枚数を覚え、描き直した後は札が着くまで前の見た目にする(`showOwn`・`showPot`。状態は変えない)。原因: 引いた瞬間に描き直すため、厚み(`--k`)が先に増えていた。着地で +1。
- 坊主(蝉丸で全員の時は全員分)は手元→場札、姫は場札→手元へ、札の裏を 1 枚ずつ流す(`stream`。最大 14 枚、間隔 85ms 以下、1 枚 520ms)。カットインの後に始め、`SHUFFLE` の音を鳴らす。1 枚着くたびに両方の枚数を少しずつ変え、最後に状態どおりにそろえる。
- 流している間は山札を押せない(`.poet-busy`)。CPU は `busyUntil` まで次を引かない。
- 確かめたこと(Chromium): 引いて 250ms 後は前の枚数のまま(6 回)、姫・坊主の流れのコマ、流し終わりの見た目が状態と一致(姫: 手元 8・場札 0、坊主: 手元 0・場札 17)。

### 2026-11-21 / Claude / ソリティア: スパイダーを追加、めくり・ドラッグの演出、K の枠
- スパイダー(`core/games/spider.mjs` 新規): 2組104枚・10列、マーク 1/2/4 種、K〜A が同じマークでそろうと自動で組札、8組で成功。配るのは空き列が無い時だけ。クロンダイクと同じ ConcurrentRules(多人数は同じ配札を各自で解く)、手の番号もクロンダイクと同じ形(列は 6+k)。`core/asobi-pc-core.mjs` は import・`initMetadataForClass(SpiderSolitaire…[ConcurrentRules])`・Outcome への包み・def と brain の分岐(`variant=spider`)・ゲーム名を「ソリティア」に・設定 `variant`(既定 klondike)と `suits` を足しただけ。**クロンダイクの規則は変えていない**。盤のデータは `kind:"solitaire", variant:"spider"`(盤の大きさの CSS `k-solitaire` をそのまま使うため)。
- 設定画面(`js/app.js`): 種類に応じてクロンダイク用(めくる枚数・周回)/スパイダー用(マークの数)だけを出す。`BREAK` の「(クロンダイク)」を削除。ヒントは `js/rules.js`。
- めくり(`css/app.css`): 回転中の表と裏が盤ごとの `--w` 指定で元の札より大きく(72→93px)、めくり終わりに大きさが飛んでいた → `.card-turn > .pcard{--w:inherit!important}`。`flipCard`(`js/app.js`)は複製の位置指定(position・left・top など)を消す(浮かせた札を返す時のため)。
- ドラッグ(`js/app.js` の `setupDrag`): 置いた時、ゴーストを次に盤を描くまで残し(最大 0.8 秒)、離した位置を `A.takeDrop()` で渡す。ゴーストの CSS transition(0.16 秒の遅れの原因)を切った。ソリティアは離した所から行き先へ 0.17 秒で滑らせる。動く札は `body` に浮かせた複製で飛ばす(列の欄が `overflow:hidden` で切れていたため)。表になった列の札はめくる演出。ほかのゲームは `takeDrop` を使っていないので見た目はゴーストが少し長く残るだけ。
- K の枠: `.sol .spile>.pcard.empty{width:100%}` と汎用 `.empty{padding:24px}` で札より大きかった → 札と同じ `--w`・余白 0。盤の外枠の大きさは変えていない。`fitSolitaire` は外枠の幅も上限にする(スパイダー10列がスマホではみ出したため)。
- 方針: `CLAUDE.md` に「見た目を直す時の基本方針(盤面の表示部分の大きさを極力変えない)」、`START_HERE.md` の守ることに1行。
- ファイル: `core/games/spider.mjs`(新規)・`core/asobi-pc-core.mjs`・`js/app.js`・`js/boards/extra.js`・`js/rules.js`・`css/app.css`・`sw.js`(キャッシュ名と spider.mjs)・`tools/tests/test_spider_core.mjs`(新規)・`CLAUDE.md`・`START_HERE.md`・`docs/CHECKLIST_PENDING.md`
- 確かめたこと(Chromium・1280px と 390px): めくり中の札の大きさが最後まで 72px、ドラッグ(1枚・2枚)で離した位置から行き先へ動き元の場所に戻らない、K の枠が札と同じ大きさ、スパイダーの設定・盤・配る演出・スマホ幅で10列が収まる、`test_spider_core`・`test_extra_12_games`・`test_roulette_core`。未確認: 通信対戦でのスパイダー、組札へ飛ぶ演出(13枚そろう場面は手で作れなかった)、Python の UI 試験。

### 2026-11-20 / Claude / クアルトを遠近法の 3D に、ペグの枠、坊主めくりの裏返り・山札の色
- クアルト(`js/boards/twelve.js` の `Q3`・`qRaw`・`qFit`・`qPiece`・`qShadow`・`boards.quarto`): ユーザー「平面に描いた感が強い・穴にはまっていない」。盤・穴・駒を 3 次元の座標で作り、遠近法で写して奥から順に描く(回転 24°・見下ろし 47°)。穴は開口部の中に奥の壁と底が見え、駒は穴の底(y=−0.15)に立てて、沈んだ部分は開口部の `clipPath` の中だけに描く。四角い駒は表を向いた面だけ光の向きで塗る。影は光と逆向きに盤へ落としてぼかす。置ける穴の見本は盤の svg の中に描き、`:has()` でボタンに乗せた時だけ出す。
- ペグ: 選んだ時の枠を、穴の縁(ソケットの box-shadow)と頭の丸(`.wood-peg::after`)に沿う緑の輪に変えた。当たり領域は見えない `::before` のまま。
- 坊主めくり: 前回、札を消す動きで回転する `.poet-flight` に opacity を付けたため立体が平らになり、めくる時に裏面が出ていた。回転の後に表の札(`.portrait`)だけを薄くするよう直した。予告は山札(4つ)の中央の上に「坊主 n枚・姫 n枚」。札の裏を卓の緑と分かれる紺＋金の縁に(山の側面も)。
- `sw.js` のキャッシュ名を更新。
- 確かめたこと(Chromium): クアルトの盤・駒・見本、ペグの選択の枠、坊主めくりの自分・CPU のめくる途中のコマ(表が見える)、`test_extra_12_games`。

### 2026-11-20 / Claude / クアルトの立体盤、ペグの当たり判定、ヨット CPU、坊主めくりの演出・設定
- クアルト(`js/boards/twelve.js`・`css/twelve.css`): 盤・穴・駒を同じ投影(45°回転・縦 0.56 倍)で描き直し、盤の前2面の厚み・穴の内壁・駒の影を光の向き(左上)に合わせた。置く駒の欄は固定の 104px 四方、残りの駒は 4×4 の固定の枠(使った駒は空き)。置ける穴に乗せると駒の見本を薄く出す。
- ペグ・ソリティア: 穴のボタンに `::before` の当たり領域(ペグの頭まで。隣とは重ならない)を足した。選んだペグは白＋緑の輪で持ち上げ、跳び先(ヒントあり)は緑の点線。
- ヨット(`core/asobi-pc-core.mjs` の `YACHT_AI`・`Yacht$Companion$brain$lambda`): CPU を書き直し。役ごとの値打ち(点＋上段ボーナスへの寄与−後に残した時の見込み点)を決め、残す目を期待値で選ぶ(上級は残りの振り直し回数ぶん先まで、初級・中級は1回先。初級は今の点だけ見る)。規則・手の番号は変えていない。自動対局 200 回の平均: 初級 138→160・中級 147→182・上級 169→185 点。**Kotlin(Android)側の CPU は未反映**。
- 坊主めくり(`js/poet-cards.js`・`css/app.css`・`js/rules.js`): 「姫で場札が無い時」を「姫ボーナス」(既定あり。保存キーを `himeBonus` に変え、前の `hime` は引き継がない)。新設定「めくれる札の坊主・姫」(既定は見せる): ホストが各山の一番上の役を数えて `state.tops` に入れ、山札の上に数だけ出す。カットインは `font:'fude'`(Yuji Boku)と `tone:'wa-cut sakura|sumi|murasaki'`、蝉丸(全員の札を場へ)は「蝉丸」、姫ボーナスのもう1枚は「姫ボーナス」。手札0枚の時は札を出さない(坊主の札は着地後に消える)。引いた時は前の札を `.poet-under` で着地まで残す。山札のホバー枠を赤に。
- `sw.js` のキャッシュ名を更新。
- 確かめたこと(Chromium): クアルト・ペグ・坊主めくりの PC 画面、坊主めくりのスマホ幅、ペグの頭を押して選び跳べる、ヨット CPU の場面別の判断と自動対局、`test_extra_12_games`・`test_roulette_core`。Python の UI 試験は playwright(Python)が無く未実行。通信対戦での坊主めくりの新設定は未確認。

### 2026-11-20 / Claude / マルチの切断・リロード復帰、名前の即時反映、坊主めくりのローカルルール ほか
- 通信(`js/net.js`・`js/online.js`): 切断時に `players/{uid}` を消すのをやめ、`offline: true, offlineAt` の印を付ける(全員・ホスト1人の時も)。`.info/connected` でつながり直したら切断予約を付け直し、印を消す(席が消されていたら空き席に入り直し `onRejoined`)。ホストは切断中の人を 45 秒(`OFFLINE_GRACE_MS`)待ってから外し(`removePlayer`・席は CPU)、ゲストはホストが 45 秒戻らない時だけ引き継ぐ。全員が切断中のまま 10 分の部屋は `cleanupOldRooms` が消す。公開一覧は接続中の人だけ数える。原因: スマホで画面を離れると onDisconnect で自分が部屋から消え、戻っても観戦が止まる・メニューに取り残される。
- リロード復帰: 部屋番号を `sessionStorage['asobi-fb-room']` に覚え、起動時に `tryRejoinRoom()`。`joinRoom` は同じ uid なら席・役割・観戦・CPU 委任を残す。前のホストは `promoteToHostFromState` で(知らせを出さずに)ホストに戻り対局画面へ。CPU 戦は `sessionStorage['asobi-play']` と保存済みの続き(`saved`)から `resume`。`ensureNet()` は同時に呼ばれても接続を1つだけ作る。
- 名前・アイコン: 設定で変えると `players/{uid}` の name/avatar を書き換え(`pushMyProfile`)。表示は `liveSlotName`・`slotAvHtml` で players の今の値を使う(コアの名簿は変えない)。
- スマホのマルチのメニュー: 1回目のタップは枠のハイライトと希望の送信だけ、同じゲームを2回目で説明。
- ヨット: 数の目の合計が 63 に届いた時に「(名前) ボーナス +35」のカットイン。チャイニーズチェッカー: アイコンを SVG(六芒星の盤と4色の玉)に変え、写真 `chinese.webp` を削除。ソリティア: 場札の列の札にも `touch-action:none`(スマホでドラッグが取り消されていた)。
- 坊主めくり(`js/poet-cards.js`): 設定に「姫で場札が無い時: そのまま/もう1枚引く」「蝉丸: 坊主と同じ/全員の札を場へ」(既定は従来どおり)。名前の横の枚数と小さな札束をやめ、各席の札の置き場に引いた札を表向きに積み、厚さで枚数を見せる。
- ファイル: `web/pc-firebase/js/{net,online,app,art,poet-cards,rules}.js`・`css/app.css`・`sw.js`(キャッシュ名)・`assets/game-icons/chinese.webp`(削除)・`tools/tests/firebase-memory-net.js`(uid を sessionStorage に保存、pagehide で切断中の印、`removePlayer`)・`docs/FIREBASE_NET_MANUAL_FOR_AI.md` 15 章
- 確かめたこと(Chromium・模擬通信): ゲスト・ホストのリロードで同じ席の対局画面に戻り続けて指せる(6 回)、ホストがタブを閉じると 45 秒後にゲストが引き継ぎ旧ホストを外す、名前変更が相手に即反映、CPU 戦のリロード再開、スマホのメニュー2段階、ソリティアのタッチドラッグ(直す前は場札で失敗)、坊主めくりのルール(札の総数 100 枚・姫のもう1枚・蝉丸)と PC/スマホの画面、ヨットのボーナス判定、既存テスト。本物の Firebase とスマホ実機は未確認。

### 2026-11-20 / Claude / 最初に読む START_HERE.md と、確認項目の置き場
- 目的: AI が読むファイルを絞って文脈を節約する(ユーザーの指示)。このファイルを毎回全部読まないようにした。
- `START_HERE.md`(新規): 方針・読む順番・読まないもの・49 種のゲームと描き方のファイル・守ること。`CLAUDE.md`・`AGENTS.md`・`GEMINI.md`(新規)・`README.md`・このファイルの冒頭を「先に START_HERE.md」に変更。
- `docs/CHECKLIST_PENDING.md`(新規): まだ答えのない確認項目の置き場。**ユーザーの指示: 返事にチェックリストを貼らない**。バグ・改善はユーザーがその都度伝える。
- アプリのコードは変えていない。

### 2026-11-19 / Codex / ルーレットのCPUベット演出と木製盤・絵札アイコン
- ルーレットはCPUがチップを置く前に額面と賭け枠を強調し、PCではカーソルを額面からその枠へ移動させる。最大4操作と確定の合計で約4秒に収まるよう、ルーレット専用の表示時間を設定した。
- ペグソリティアはアイコンに合わせた明るい丸木盤と、青・赤・木地の頭と軸があるペグに変更。3種類の盤で、跳んだ駒の色を維持する。ごいたは手駒・場の駒・一覧アイコンで共通の丸肩の駒を使い、将棋と同じ木地のグラデーションと墨文字で描いた。
- 坊主めくりは実際に使う持統天皇と前大僧正慈円の絵札を重ねた専用アイコンに変更し、PWAキャッシュに追加した。
- Chromiumの「長い」設定で4回配置と確定を通した時間は約3.8秒。PCのカーソル着地点、スマホの賭け枠表示、模擬Firebaseでの対戦・CPU委任・観戦、3種のペグ盤での着手を確認した。ローカル配信を停止した後の再読み込みでも新アイコンを表示。ルーレット・追加12ゲーム・カーソル送信・一過性効果音の既存テストに合格。

### 2026-11-19 / Codex / PC版坊主めくりの手前の絵札を中央に配置
- 手前の絵札を卓の水平中央に置き、名前と持ち札の枚数を右に配置した。めくり演出も同じ位置に着地する。
- Chromiumの幅1024px・1440pxで、名前の長さや得点の桁数にかかわらず、絵札と卓の中心の差は0.01px未満。幅390pxで従来の配置も確認した。

### 2026-11-19 / Codex / 坊主めくりの札束と席アイコン
- 四つの山に共通の「山札」見出しを付け、場札との間に余白と区切り線を置いた。山札・場札・全員の持ち札は、枚数が増えるほど紙の層が厚く見え、0枚で空枠になる。
- 卓上と右側の名前にプロフィールアイコンを表示し、CPUには席ごとに別の絵柄を割り当てた。設定ボタンは木枠の内側の左下に配置した。
- Chromiumで6人対局を100手進め、全ての札束と枚数の一致を検証。PC幅とスマホ幅（390・320px）で設定を開けること、2画面の模擬通信で札・得点が同期することを確認した。

### 2026-11-19 / Codex / 坊主めくりの座席・枚数表示と札を引く演出
- 自分を手前、対戦相手を卓の奥の円弧上に配置。各席に直近の絵札、役、持ち札の枚数を表示し、4山と場札の残数を中央の一列にまとめた。
- 自分が引いた札は手前へ運びながら大きく表返し、他の人の札は選んだ山で表返してからその席へ移動する。各席の直近の公開札を対局状態に保存し、途中表示や設定からの再描画では演出を再生しない。
- ChromiumのPC・スマホ幅で6席の配置、ソロとCPUの演出を確認。模擬Firebaseの2画面で互いの席から見た札・枚数の同期と動きを減らす設定を検証。全100枚の役判定・得点処理、音声・カーソルの既存テストも合格。

### 2026-11-19 / Codex / 元画像を使ったゲームアイコン4種
- 添付された `doc_for_asobi.zip` のJPEG 2枚から、クアルト、ペグ・ソリティア、人狼、チャイニーズチェッカーの絵柄だけを切り出した。元画像の画素を可逆WebPで保存し、ゲーム名と人数は画面の既存項目で表示する。
- Chromiumでゲーム一覧、詳細、成績、PWAのオフライン再読み込みで4枚の画像を確認した。

### 2026-11-19 / Codex / 捨て札のタッチドラッグと盤面表示を修正
- ソリティアではドラッグを有効にしたとき、最上段の捨て札から始めたタッチ操作をドラッグとして扱う。ポインター操作が中断された場合はドラッグを取り消す。
- ヨットのスマホ画面ではフォーダイスの補足を非表示にした。PCの対局画面では設定ボタンを上げ、下端のバーとの間隔を確保した。
- Chromiumで1枚・3枚めくりからマウスとタッチで組札・場札に移動できること、スマホ縦横とPCでのフォーダイス表示、設定ボタンの位置と動作を確認した。

### 2026-11-19 / Codex / 左上のアプリ名を収録数に合わせる
- PC Firebase版の左上のロゴにゲーム一覧の件数を表示する。Chromiumで一覧49件、左上のロゴとブラウザのタイトルが「あそび箱49」になることを確認した。

### 2026-11-19 / Antigravity / ccr-efc07031-6exjqs
- 目的: ユーザーの指示によるゲーム・UI・オンライン通信・ルール説明動画の計24項目の改善を実施する（Codex のルーレット刷新・追加12ゲーム・あそび箱49改修へ競合なく統合）。
  1. ソリティア（および大富豪・Oh, No!）で複数枚まとめてドラッグ移動する際、1枚だけでなく重なった束全体がついてくるドラッグゴーストにする。
  2. ソリティアで12枚以上や最大枚数を並べても盤面の下にはみ出さないよう、カードサイズと各列の重なり間隔を動的に自動調整する。
  3. マンカラの横取り時に、自分の最後の石と向かいの相手の石が放物線を描いて自分の倉へ飛び込むアニメーション・軌跡・`+N 横取り!` バッジ・効果音を追加する。
  4. 7ならべの持ち札をマーク（♠→♥→♦→♣）・数字順で常時ソートする。
  5. ウサギと猟犬のCPUが、負けるのを嫌って意味なく上下に往復する遅延挙動をやめ、前進手を優先するように改善する。
  6. Oh, No! に「まとめ出し」（`bundle=on/off`）ローカルルールを実装する（同じ数字・記号を複数枚まとめて選択・順番バッジ表示・一括出し・カットイン対応）。
  7. PCでゲームパッド（PAD）接続に対応する（左スティック/十字キーで2D空間フォーカス移動、右スティックでスクロール、A決定、B戻る/キャンセル、X/Yアクション、L1/R1タブ切替、STARTメニュー、接続トースト通知）。
  8. ソリティアの左上のめくり札（捨て札）で、重なった下の2枚の数字とマークも見えるよう左から右へ扇状にずらして表示する。
  9. ソリティアで解けない詰みの初期配札にならないよう、ソルバー検証を通過したクリア可能な配札のみを生成する。
  10. ソリティアで列やカードを移動した際のスライドアニメーション（FLIP WAAPI 補間）を実装する。
  11. ソリティアで全部並べた時に盤面の下にはみ出さないようにする（`fitSolitaire` + `ResizeObserver` で列ごとに `--sol-close` / `--sol-open` を動的圧縮）。
  12. ソリティアでダブルクリックにより並べられる場所（組札または場札列）へアニメーション付きで自動移動できるようにする。
  13. ソリティアのドロップ当たり判定を、カードのどこ（上端・下端）をつかんでドラッグしてもカード矩形の重なり面積で自然に判定されるように改善する。
  14. ルール説明のアニメーションを、実際の盤面全体を映し矢印と吹き出しを加えた分かりやすい短いループ動画（全40本・`assets/rules/<id>.mp4`）に刷新する。
  15. ブラックジャックで勝敗が決まってから勝ち等のカットインが出るまでの遅延を短縮する（`220ms` / ディーラーBJ `100ms`）。
  16. 運がないときに悲しむスタンプ「運がない…」（`sEx.gloom`・全28種）を追加する。
  17. 1人のプレイヤーしかいないのにリモートカーソルが分裂して複数人に見える不具合を修正する（UID/slot 所有者検証、slot 単位の最新1件重複排除、孤立 `.rcur.live` 除去、ホスト側の古い `cursors` 自動掃除）。
  18. ヨットのオンライン対戦で、相手が固定したサイコロの黄色い枠（`.yd.held`）がリアルタイムで表示されるように同期する（`cursors/{uid}.ykeep` / `players/{uid}.yachtKeep`）。
  19. 相手がウィンドウ外にカーソルを置いたとき、盤面外周の内側へ自然に吸着・半透明表示（`.rcur.live.out`）し、右端・下端では矢印と名前ラベルを内向きに反転させる。
  20. 相手のカーソルが見えなくなることがある不具合を修正する（`#boardwrap` 一時サイズ0での RAF ループ停止防止、`zoom` 補正、`drawPlay` 毎の `kickCursorLoop`）。
  21. チャット（スタンプ・定型文・自由入力）の受信通知トーストをより大きく目立つデザイン（`.toast.chat-toast`・「💬 チャット」バッジ・ポップ演出・5.2秒表示）に強化する。
  22. ヨットの盤面内のフォーダイスの説明を「同じ目４個で、５個の合計」として常時表示する。
  23. ヨットでヨット（50点）を達成してチェックを付けた時に「（プレイヤー名） ヨット」のカットインを入れる。
  24. (a) 他の人の手番が始まる時はカットインの効果音を鳴らさず自分の番の時だけ鳴らす。(b) ヨットでサイコロを振り終わる（揺れアニメーションが終わる）まで候補点数の数字を出さないようにする。
- 変更:
  - `web/pc-firebase/core/asobi-pc-core.mjs`: 7ならべ初期手札および手札配列のソート、ウサギと猟犬の猟犬CPU前進優先・上下反復ペナルティ、Oh, No! まとめ出し (`bundle=on/off`) ルール・合法手エンコード・`viewJson` `opts` 出力、ソリティア初期配札のソルバー検証 (`isSolitaireSolvable`) を実装。
  - `web/pc-firebase/js/app.js`: `setupDrag` の複数枚スタックゴースト (`o.getStack`) とカード矩形重なり面積によるドロップ先判定 (`findBestTarget`)、自分の手番のみ `sfxYourTurn` を鳴らす `turnCut`、ヨット達成時の `${seatName(p)} ヨット` カットイン、Oh, No! まとめ出しカットイン、目立つチャット通知トースト (`.chat-toast`)、`drawPlay` での `kickCursorLoop()` 呼び出しを実装。
  - `web/pc-firebase/js/boards/extra.js`: ソリティアの3枚扇状めくり札、スタックドラッグ (`getStack`)、グリップ位置非依存の `canDrop`、ダブルクリック自動移動 (`autoMove`)、全カード `[data-cid]` の FLIP スライドアニメーション、列ごとの動的縦間隔圧縮 (`fitSolitaire` + `ResizeObserver`) を実装（Codex の `A.flipCard`・`!A.reduce` 対応を維持）。
  - `web/pc-firebase/js/boards/fix.js`: マンカラ横取りアニメーション (`.mcap-stone` 放物線飛行・`.mcap-ring`・`.mcap-tag` `+N 横取り!`・`MARBLE` 効果音)、ヨットのフォーダイス盤面説明「同じ目４個で、５個の合計」、サイコロ振り中 (`shaking`) の候補点数非表示、オンライン相手キープ枠 (`syncOnlineYachtKeep` / `getOnlineYachtKeep`) のリアルタイム反映を実装。
  - `web/pc-firebase/js/boards/table.js`: Oh, No! まとめ出しUI（同数字複数選択・順番バッジ `.ubord`・`まとめ出し(N枚)` / `1枚で出す` ボタン・束ドラッグ・ワイルド色選択連携）、大富豪の束ドラッグゴースト、ブラックジャックの勝敗カットイン高速化 (`220ms`) を実装。
  - `web/pc-firebase/js/online.js`: ババ抜きカーソル照準 (`maidIndex`/`maidMove`) を維持したまま、カーソル分裂防止 (`isCursorOwnerValid`, `bySlot` 重複排除, `pruneStaleCursors`)、画面外 `out` フラグと外周クランプ・反転表示 (`.out`, `.flip-x`, `.flip-y`)、RAF 停止防止と `cssZoom()` 補正、ヨット `yachtKeep` リアルタイム同期を実装。
  - `web/pc-firebase/js/art.js`: 悲しむスタンプ `'運がない…'` (`sEx.gloom`) を追加（全28種）。
  - `web/pc-firebase/js/gamepad.js`（新規） / `web/pc-firebase/index.html`: Web Gamepad API によるコントローラー操作一式を実装し、`index.html` から読み込み。
  - `web/pc-firebase/js/rules.js` / `web/pc-firebase/assets/rules/*.mp4`（新規40本）: 実際の盤面全体を映し矢印と吹き出しで解説する短いループ動画40本を生成し、`demoHtml` / `startDemos` を `<video class="rule-vid">` 再生に刷新。
  - `web/pc-firebase/css/app.css` / `web/pc-firebase/sw.js`: ルーレット等の既存CSS・キャッシュ一覧を維持しつつ上記各機能のスタイルを追加し、`sw.js` の `FILES` に `./js/gamepad.js` と `./assets/rules/*.mp4`（40本）を追加、キャッシュ名を `asobipcfb-20261119-improvements-1` に更新。
- ファイル: `web/pc-firebase/core/asobi-pc-core.mjs`, `web/pc-firebase/js/app.js`, `web/pc-firebase/js/online.js`, `web/pc-firebase/js/art.js`, `web/pc-firebase/js/gamepad.js`, `web/pc-firebase/js/rules.js`, `web/pc-firebase/js/boards/extra.js`, `web/pc-firebase/js/boards/fix.js`, `web/pc-firebase/js/boards/table.js`, `web/pc-firebase/css/app.css`, `web/pc-firebase/index.html`, `web/pc-firebase/sw.js`, `web/pc-firebase/assets/rules/*.mp4`, `docs/FIREBASE_NET_MANUAL_FOR_AI.md`, `README4AI_Claude_Codex_Antigravity.md`
- 確認: `origin/ccr-efc07031-6exjqs` (`4e1821e`・ルーレット刷新＆あそび箱49) 上へリベース後、`git diff --check`、`node --check` 全変更ファイル、既存テスト群 (`test_extra_12_games.mjs`, `test_roulette_core.mjs`, `check_transient_audio.cjs`, `check_cursor_send.cjs`, `check_firebase_ui.py`)、ルーレット動作確認および全24項目 E2E Playwright 検証すべて合格。

### 2026-11-19 / Codex / PC版の設定・盤面・カード演出を調整
- 対局中の設定ウィンドウの大きさを固定し、タブ変更は右側の内容だけを更新する。歯車アイコンを差し替え、Chromeのボタン押下時のハイライトと対局終了画面の「待った」の補足を外した。収録49種に合わせて「あそび箱49」に更新した。
- マインスイーパーは対戦と協力で設定の並びを統一し、使えない項目を無効化した。ライト・ダークの盤面色と見出し色を調整した。コネクトフォーは設定に応じて仮置き後に着手を確定する。
- ごいたの駒とアイコン、クアルトの木目とくぼみ、ペグ・ソリティアの木枠と球、ラミィキューブの識別線と選択色を更新した。ルーレットの操作ボタンとチップの額面を拡大し、賭けても数字の位置を固定した。
- 戦争などの裏向きの札は表と裏を持たせて移動中に返す。ソリティアは捨て札3枚の数字とマークが見えるように重ねる。スライドパズルは数字を先頭に、風景画3種を同じタイル一覧に並べる。通信では既存の picture を維持し、追加の風景だけ scenery で伝える。
- Chromiumで仮置きと確定、設定の寸法、無効化したモード別設定、盤面のテーマ、札の表返しと捨て札、賭け前後の数字位置を確認した。追加ゲーム・ルーレットのコアテストと、模擬Firebaseの3クライアントテストに合格した。

### 2026-11-19 / Codex / スマホ幅での輪盤の描画負荷を軽減
- 外周走行中と着地後は、玉と影の位置が変わらないフレームでSVG属性の更新を省く。Chromiumのタッチ端末エミュレーションでCPUを4倍に減速し、通常演出と効果音を有効にして計測した。390×844で平均59fps、320×640で平均54fpsを記録し、両方で当選ポケットへの着地を確認した。

### 2026-11-19 / Codex / 回転中の輪盤の再描画を削減
- 手番や通信状態を更新する時も、同じスピンの輪盤と賭け枠のDOMを再利用する。回転はブラウザのフレーム時刻に合わせ、回転中だけ輪盤と玉の描画レイヤーを最適化する。
- Chromiumでスピン中に盤面更新を発生させ、輪盤の要素が維持されることと、玉が確定したポケットに着地することを確認した。

### 2026-11-19 / Codex / ルーレットの回転・着地・効果音を改修
- Firebase版の輪盤を拡大し、木目、真鍮の軸と仕切り、傾斜面の反射板、ポケットの深さを描き込んだ。輪盤の周りにあった方式名・受付表示・空の履歴案内を取り除き、出目履歴はベッティングテーブル下の精算欄にまとめた。
- 玉が回転盤と逆向きに外周を走り、減速して斜面を下り、反射板と仕切りで跳ねてから当選ポケットと一緒に止まる。転がる音と打音の位置、時刻、強さは同じ軌道から求める。アニメーション省略時には着地だけを示し、途中観戦では直前の出目を静止状態で表示する。
- 欧州式・米国式の全ポケットについて10ラウンド分（750通り）の着地点と衝突位置を検証した。ChromiumでPC・タブレット・スマホ幅での操作、6人交代、CPU対戦、模擬Firebaseの対戦・途中観戦、PWAオフラインでのルーレットと坊主めくりを確認した。ルーレット・追加12ゲーム・タブ復帰時の音・カーソルの既存テストも通過した。
- 実際のゲーム音声を含む収録で8回の衝突音を確認した。ChromiumのAudioContextで、タブを隠すと音が止まり、戻っても再生し直さず、盤面を離れた時にも再生中の音が止まることを確認した。

### 2026-11-18 / Codex / カジノ式ルーレットの盤面を公開
- Firebase版のルーレット（No.43）を遊べるようにした。ヨーロピアン37穴・アメリカン38穴の木製ホイール、151または152のベット枠、5種類のチップと席ごとの配色、前回の精算・ラ・パルタージュ返還・過去20回の出目を表示する。
- 数字・境界・交点と外側の枠へ直接賭けられる。個別撤去、直前操作を戻す、クリア、前回と同じ、2倍、確定、エンドレスの補充を盤面から使える。狭い画面は縦向きのテーブルを盤面内でスクロールし、チップと操作を画面下部に残す。
- 確定した出目に合わせてホイールと玉を動かし、演出の後で精算を表示する。アニメーション省略時と途中観戦で過去の結果を表示する時は確定位置をそのまま描く。CPUの手番の長さとカーソルは追加ゲームの共通設定を使う。ルール説明を追加し、PWAに描画スクリプトを登録した。
- エンジンの既存ムーブと同期状態を使用する。コアテスト、音のタブ復帰とカーソルのテスト、Chromiumのデスクトップ・タブレット・スマホ、6人の手番交代、エンドレスの補充、00での半額返還、模擬Firebaseの対戦・観戦・CPU委任・1人待機、オフライン起動と坊主めくりの札表示を確認した。

### 2026-11-18 / Codex / 追加ゲームの設定と対局UIの共通化
- PC Firebase版の既存ゲームと追加ゲームで、設定のヘッダー・2カラム・フッター、対局のヘッダー・右サイドバー・ルール・メンバー・チャット・設定ボタンの部品を共用した。人狼の村の会話は中央、投票は左下に配置している。
- 追加ゲームのCPUは標準2.7秒待ち、短い設定は1秒、長い設定は3.7秒とした。坊主めくりの短い設定は1.8秒。アニメーション省略時にも待ち時間を保つ。公開されている札・駒・操作があるときは、共通のCPUカーソルを動かしてから着手する。人狼のCPUは順に行動する。CPUがいるゲームの準備画面から個別のテンポを選ぶか、共通設定を使える。
- 坊主めくりはCPUの人数と最初の手番も記憶し、引いた札をPCで最大226px幅にした。スライドパズルに1人用のシャッフルの強さと完成図・番号表示、落ち物2作に1人用の落下速度、次のピースの表示と対戦時のお邪魔の切り替え、人狼に投票・夜の時間と役職の内訳を追加した。追加12ゲームの準備画面ではローカルルールの選択肢に補足を付けた。
- マインスイーパーを1件にまとめ、同じ準備画面で協力・対戦を選べるようにした。対戦の部屋と妨害条件、協力の待ったとカーソル設定を維持し、MineLinkの設定を参考に左右クリックを入れ替える項目を追加した。通信上のモード識別子は従来のまま。
- ChromiumでCPUの3段階の所要時間、坊主めくり・クアルトの着手前カーソル、人狼のCPUの順次行動、全12ゲームの起動と着手、オフライン起動を確認した。模擬Firebaseでは協力・対戦の両マインスイーパー、スライドの同一初期盤面、人狼の投票・チャット、対戦と観戦を確認した。

### 2026-11-18 / Codex / 承認済み追加12ゲームをGitHub Pagesへ反映
- 開発ブランチのコミット `1558799` に入っていた12ゲームを、坊主めくりの絵札とルーレットの準備中メニューが入った公開ブランチ `7a441b8` に統合した。公開版のゲーム一覧と成績は50件になり、承認済みの盤面と共通操作を既存の公開パスから利用できる。
- ごいたで「し」5枚の配り直しが同じ配分を繰り返して開始できない問題を修正した。同じシードで配り直し後の手を再現し、対局離脱後に古い非同期描画結果が適用される競合も修正した。
- 全12ゲームのブラウザ起動と着手、コア30ケースの完走、ごいたのシード1,000件と再開、ババ抜きのカーソル位置、模擬Firebaseの対戦・観戦、PWAのオフライン起動、坊主めくりの絵札表示を確認した。

### 2026-11-18 11:36(UTC)/ Antigravity / ccr-efc07031-6exjqs
- 目的: ユーザーの指示（「またルーレットを実装したい。ボードゲームとして。カジノでよく置いてあるタイプのやつ。」「君はデザインのセンスがないので、盤面のデザインとかは手をつけず、ゲームの中身の処理の部分のみ担当してください。」「アイコンだけ作って、メニューに貼っておいて。（準備中）」「公開しといて。坊主めくりをcodexで実装したので、コミットプッシュの際に消さないよう注意すること。」）に対応し、リモート `a5ef0fe`（Codex による坊主めくり絵札100枚実装）を統合維持したうえで、カジノ版ルーレット (`roulette`, No.43) のゲームロジック一式＋メニュー用アイコン（準備中）を実装・公開する。
- 変更:
  - `web/pc-firebase/core/games/roulette.mjs`: カジノ版ルーレットのエンジン `ROULETTE_SPEC` を新規作成（1〜6人、ヨーロピアン 37穴 / アメリカン `0・00` 38穴、初期チップ 500/1000/2000、ゲーム数 5/10/15/エンドレス(0・リバイ対応)、ラ・パルタージュ `off`/`half`、全152ベット枠 `ROULETTE_SPOTS[0..151]`＝ストレート36倍・スプリット18倍・ストリート12倍・コーナー9倍・ライン6倍・コラム/ダズン3倍・イーブンマネー2倍、手番内 Undo/Clear/Rebet/Double/Remove、状態内決定性 PRNG Mulberry32 スピン、`viewJson` `kind: 'roulette'`、3段階難易度 CPU AI）。
  - `web/pc-firebase/core/extra-games.mjs`: `ROULETTE_SPEC` を `EXTRA_GAME_SPECS` に登録（`catalogJson()` 全43種）。
  - `web/pc-firebase/js/art.js`: `AR.roulette` を追加（深緑フェルト＋木製ホイール＋緑0/赤黒18区画＋金枠＋4本スポークタレット＋白玉＋カジノチップを `Iwip(...)` で描画し、左上「準備中」斜めリボン付き）。
  - `web/pc-firebase/js/app.js`: `ORDER` 末尾に `'roulette'` を追加し、`playable(id)` で `category === 'BOARD'` の未実装ゲームが `window.RENDER.cards` により誤ってプレイ可能扱いにならないよう修正（メニューでは `.tile.soon` ＋「1〜6人・準備中」、詳細欄では「このゲームは準備中です」・`進む` 無効、`ルール` ボタンは閲覧可能）。
  - `web/pc-firebase/sw.js`: `a5ef0fe` の `./assets/poets/*` すべてを維持したまま `./core/games/roulette.mjs` を `FILES` に追加し、キャッシュ名を `asobipcfb-20261118-roulette-icon-1` に更新。
  - `tools/tests/test_roulette_core.mjs` / `tools/tests/test_extra_12_games.mjs`: カタログ43種チェック・152スポット・全倍率・ラ・パルタージュ・Rebet/Undo/Double/Clear/Remove・エンドレス Rebuy・全破産終了・`restoreMatch` 一致・全難易度1〜6人CPU完走テストを追加。
  - `docs/ROULETTE_SPEC_FOR_CODEX.md`: Codex 向けのルーレット仕様＆UI引き継ぎマニュアルを新規作成。
  - 盤面描画・CSS・坊主めくり関連ファイル (`assets/poets/*`, `js/poems.js`, `js/poet-cards.js`)・`index.html`・`web/pc/`・`Android-Projects`・`Windows-Projects` は破壊・削除せず維持。
- ファイル: `web/pc-firebase/core/games/roulette.mjs`, `web/pc-firebase/core/extra-games.mjs`, `web/pc-firebase/js/art.js`, `web/pc-firebase/js/app.js`, `web/pc-firebase/sw.js`, `tools/tests/test_roulette_core.mjs`, `tools/tests/test_extra_12_games.mjs`, `docs/ROULETTE_SPEC_FOR_CODEX.md`, `README4AI_Claude_Codex_Antigravity.md`
- 確認: `git diff --check`、`node --check` (`roulette.mjs`, `extra-games.mjs`, `art.js`, `app.js`, `poet-cards.js`, `poems.js`, `sw.js`)、`node tools/tests/test_roulette_core.mjs`、`node tools/tests/test_extra_12_games.mjs`、`node tools/tests/check_transient_audio.cjs`、`node tools/tests/check_cursor_send.cjs`、ヘッドレス Chromium CDP 検証（メニュー38種表示・ルーレット `.soon` ＆ SVGアイコン・坊主めくり絵札プレイ動作ともにエラー0）すべて合格。`ccr-efc07031-6exjqs` へコミット・プッシュ済み。
- 他の AI への申し送り: 盤面UI (`window.RENDER.roulette`) 実装時は [`docs/ROULETTE_SPEC_FOR_CODEX.md`](docs/ROULETTE_SPEC_FOR_CODEX.md) を参照し、完成後に `art.js` の `AR.roulette` を `Iwip` から `I` に切り替えてください（`app.js` の `playable()` は `window.RENDER.roulette` を定義すると自動で有効化されます）。

### 2026-11-18 / Codex / 坊主めくりの絵札100枚を反映
- 公開ブランチの `bf35c23` を基に、坊主めくりに確認済みの人物画100枚、歌人名・和歌の縦書き、無地の青緑の裏面を組み込んだ。オフラインでも絵札を表示できるように PWA キャッシュを更新した。
- 絵札の装束と歌番号を照合し、殿66枚・姫21枚・坊主13枚（10番の蝉丸を含む）に分類した。79番の左京大夫顕輔・76番の法性寺入道前関白太政大臣・84番の藤原清輔朝臣は殿、80番の待賢門院堀河は姫。得点とカットインは同じ分類を参照する。
- 確認用の画像で下辺が欠けていたため、札を1枚ずつ表示して書き出し直し、101面の緑枠が四辺にあることを確認した。サンプルの PDF と ZIP、閲覧用の軽量PDF・画像を更新した。
- 全100枚の得点と終了判定、Chromium でのオフラインCPU戦、模擬 Firebase の2画面での絵札・得点同期、追加12ゲームの既存コアテストを確認した。本番 Firebase は未検証。
- ユーザーの公開指示に合わせ、この絵札の変更を GitHub Pages の公開ブランチ `ccr-efc07031-6exjqs` に反映する。

### 2026-11-18 08:54(UTC)/ Antigravity / ccr-efc07031-6exjqs
- 目的: ユーザーの指示。「もう 百人一首 消して坊主めくり はそのまま」に対応し、`web/pc-firebase/` から「百人一首」(`karuta`) を完全削除し、「坊主めくり」(`bozu`) は「準備中」リボン付きのまま維持・プレイ可能にする。
- 変更:
  - `web/pc-firebase/js/app.js`: `ORDER` と `CAT` から `'karuta'` を削除（メニュー合計 37 種）、`newGameSetup.karuta`・`go()` 内の `poetCards.stopAudio()`・`SDEF.about` の VOICEVOX 読み上げ音声行・`poet:count` セグメント分岐を削除。
  - `web/pc-firebase/js/art.js`: `AR.karuta` を削除（`AR.bozu` の `Iwip(...)` は維持）。
  - `web/pc-firebase/js/poet-cards.js`: `karuta` 専用処理・読み上げ音声関連 (`audio/karuta/manifest.json` 読込・`.mp3` 再生・`stopAudio`)・枚数オプション・`boardMatch.register('karuta', ...)` を削除し、`bozu`（坊主めくり、4つの山・`hundredPoems` 利用）のみに簡素化。
  - `web/pc-firebase/css/app.css`: コメント更新および `karuta` 専用の未使用セレクタ（`.poet-card.verse`, `.poet-reading`, `.poet-read-text`, `.poet-grid` 等）を削除（`bozu` 用の `.poet-*` スタイルはすべて維持）。
  - `web/pc-firebase/licenses.html`: 百人一首 VOICEVOX 予定表記の `<p>` 行を削除。
  - `web/pc-firebase/audio/karuta/manifest.json`（および `audio/karuta/` ディレクトリ）: 削除。
  - `web/pc-firebase/sw.js`: `FILES` から `./audio/karuta/manifest.json` を削除し、キャッシュ名を `asobipcfb-20261118-remove-karuta-1` に更新（`bozu` が依存する `./js/poems.js` は維持）。
- ファイル: `web/pc-firebase/js/app.js`, `web/pc-firebase/js/art.js`, `web/pc-firebase/js/poet-cards.js`, `web/pc-firebase/css/app.css`, `web/pc-firebase/licenses.html`, `web/pc-firebase/sw.js`, `web/pc-firebase/audio/karuta/manifest.json`（削除）, `README4AI_Claude_Codex_Antigravity.md`
- 確認: `git diff --check`、`node --check` (`app.js`, `art.js`, `poet-cards.js`, `sw.js`)、`node tools/tests/check_transient_audio.cjs`、`node tools/tests/check_cursor_send.cjs`、`node tools/tests/test_extra_12_games.mjs`、ヘッドレス Chromium CDP 検証5種（`karuta_remove_verify.py`：メニュー37種・成績・設定「アプリについて」・`licenses.html` に百人一首/VOICEVOX なし、坊主めくり「準備中」リボン維持・4つの山配札/手番/カットイン/CPU 動作・エラー0およびスクリーンショット目視確認 + `yacht_zoom_verify.py`, `tablet_verify.py`, `mobile_ux_verify.py`, `e2e_verify.py`）すべて合格。`web/pc/`・`Android-Projects`・`Windows-Projects` は無変更。`ccr-efc07031-6exjqs` へコミット・プッシュ済み。

### 2026-11-18 07:49(UTC)/ Antigravity / ccr-efc07031-6exjqs
- 目的: ユーザーの指示（3項目）。
  1. `web/pc-firebase/` のヨット (`yacht`) 盤面を Android アプリ版（`YachtBoard`）に合わせて刷新する。
  2. スワイプ／ピンチによるブラウザの拡大縮小を無効にする（1本指のスクロール・操作は維持）。
  3. 追加8ゲーム（`slide`, `bunyo`, `pakuris`, `mine`, `mineVersus`, `wolf`, `bozu`, `karuta`）について、選択・プレイ可能な状態を保ったまま未完成であることを伝えるためアイコンに「準備中」を表示する。
- 変更:
  - `web/pc-firebase/js/boards/fix.js` (`yacht`):
    - 木枠＋放射状グリーンフェルト皿（`.ytray` > `.ytray-in`）内に横1列5個サイコロ（未振りは薄い1点 `.d2.zero`、キープは黄枠 `.held` + `aria-pressed`）、金色の手番行（`.yturn-line`）、ガイド文言（`.yguide`、Android 版の文言に統一）、`振る／振り直す` ボタン（`.yroll`、全5個キープや振り演出中は無効化）を配置。
    - 得点表（`.ysheet`）を `役` ＋プレイヤー列（アクティブ手番 `th.on`）、1行表示の役名、`6の目` 直後の `小計 / ボーナス`（`${t}/63` または緑字 `${t} +35`）、`合計`、最後の確定セル金枠（`td.ylast .ycell-in`）、候補行アンバー強調＋**1タップ即時確定**（2段階選択 `yPick` を廃止）に変更。
  - `web/pc-firebase/css/app.css`:
    - Android 版の配色・構成に沿った `.yacht2` / `.ytray` / `.ytray-in` / `.ydice` / `.yturn-line` / `.yguide` / `.yroll` / `.ysheet` スタイルを実装し、旧来の `.yturn`/`.yleft` 競合スタイルを削除。
    - スマホ縦（`max-width:680px and min-height:541px`）・省高スマホ縦4人戦（`max-height:760px`）・タブレット縦・スマホ横（`max-height:540px and max-width:960px`）で全15行（`合計` 含む）が画面内に収まるよう調整。
    - `html, body` に `touch-action: pan-x pan-y` を設定（`.toast` / `.lview` の `touch-action: none` は維持）。
  - `web/pc-firebase/index.html`: `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">` を設定。
  - `web/pc-firebase/js/app.js`: `document` に `gesturestart`/`gesturechange`/`gestureend` と2本指以上の `touchstart`/`touchmove` への `preventDefault()`（`{ passive: false }`、1本指タッチは妨げない）を追加。
  - `web/pc-firebase/js/art.js`: `<clipPath id="xSqC">` と `iWip()` / `Iwip()` を追加し、`slide`, `bunyo`, `pakuris`, `mine`, `mineVersus`, `bozu`, `karuta`, `wolf` のアイコン左上に金色斜めリボン「準備中」を表示（`.tile.soon` や操作制限は付けず選択・プレイ可能なまま維持）。
  - `web/pc-firebase/sw.js`: キャッシュ名を `asobipcfb-20261118-yacht-nozoom-wip-1` に更新。
- ファイル: `web/pc-firebase/js/boards/fix.js`, `web/pc-firebase/css/app.css`, `web/pc-firebase/index.html`, `web/pc-firebase/js/app.js`, `web/pc-firebase/js/art.js`, `web/pc-firebase/sw.js`, `README4AI_Claude_Codex_Antigravity.md`
- 確認: `git diff --check`、`node --check` (`art.js`, `app.js`, `fix.js`, `sw.js`)、`node tools/tests/check_transient_audio.cjs`、`node tools/tests/check_cursor_send.cjs`、`node tools/tests/test_extra_12_games.mjs`、ヘッドレス Chromium CDP 検証5種（`yacht_zoom_verify.py`、`icon_check.py` 目視確認、`tablet_verify.py`、`mobile_ux_verify.py`、`e2e_verify.py`）すべて合格。`web/pc/`・`Android-Projects`・`Windows-Projects` は無変更。`ccr-efc07031-6exjqs` へコミット・プッシュ済み。

### 2026-11-18 / Codex / 承認済み追加12ゲームのPC Firebase版実装
- 作業ブランチは `dev/extra-12-games-20261118`。公開ブランチ `762faf7` を起点に、戦争、たこやき、ぶたのしっぽ、ババ抜き・ジジ抜き、ハーツ、ジンラミー、ハゲタカのえじき、ごいた、クアルト、ガイスター、ラミィキューブ、ペグ・ソリティアを追加した。
- 承認済みの12盤面を `js/boards/twelve.js` と `css/twelve.css` に移し、共通の対局画面、コアの合法手、準備画面とルールに接続。ゲーム一覧・成績用のアイコン、PWAキャッシュ、既存のカード配りと同系統の移動・めくり・効果音を追加した。
- カタログにある既存のローカルルールを準備画面で選べるようにした。ババ抜きには♠Qをババにするクイーン抜き、ハーツには♠Qでハートを解禁する選択を追加。手札を混ぜる操作は仕様書に沿って自分の手札を対象にする。
- ババ抜きで札を引かれる側には、引く側のカーソルと、指している札に対応する自分の手札位置を表示。扇形の相対座標と札の位置番号を使い、異なる画面サイズでも照合する。観戦用の表示では各席の非公開情報と合法手を伏せる。
- 検証は、全12ゲームのブラウザ着手、27ケースのCPU完走、追加ルール・待った・復元、Firebase代替通信での2人対戦と途中観戦、ババ抜きの異なる画面サイズでの札位置照合、成績50件、オフライン起動とオフライン着手。承認画像と同一局面を並べ、共通UIと盤面を目視で比較した。本番Firebaseと実機ブラウザは未検証。


### 2026-11-18 06:01(UTC)/ Antigravity / ccr-efc07031-6exjqs
- 目的: ユーザーの指示。「ゲームのアイコンがシンプルすぎるので 他のアイコンと合わせて ちゃんと作り込んでください。」に対応し、追加8ゲーム（`slide`, `bunyo`, `pakuris`, `mineVersus`, `mine`, `bozu`, `karuta`, `wolf`）のアイコンを既存30種と揃う質感・密度の `100×100` SVG へ刷新し、各所（メニュー・詳細・準備画面・成績・再開カード・公開ルーム一覧/詳細）で統一描画されるようにする。
- 変更:
  - `web/pc-firebase/js/art.js`:
    - 共有 `<defs>` に他アイコンと衝突しない `x` プレフィックスのグラデーション・クリッピング（`xSlSky`, `xSlWat`, `xSlWel`, `xSlC`, `xBunBg`, `xBunR`, `xBunB`, `xBunG`, `xBunY`, `xPakBg`, `xMinBg`, `xMinTl`, `xVsB`, `xVsR`, `xWlfS`, `xWlfM`）を追加。
    - 補助関数 `iSlideTile`, `iBunBlob`, `iTet`, `iMinCov`, `iMinOpn`, `iNavalMine`, `iMineFlag`, `iPoetFigure` と `I(bg, body)` ベースのリッチアイコン8種を `Object.assign(AR, ...)` に追加（既存の `xSh` ドロップシャドウ・`xGr` 木目・`xNo` ノイズ・`xVig` ビネットと共通質感）。
      - `slide`: 木枠＋彫り込みスロット＋風景画（富士山・桜・コテージ・ヨット）のベベル付3×3タイルと番号バッジ・移動矢印。
      - `bunyo`: 深紫盤面に白ハイライト＆目つきのぷっくり緑連結ぷよ・赤青黄ぷよ＋連鎖スパークル。
      - `pakuris`: ダークバイオレット盤面にファセット（面取り立体）付きテトリミノ5種とゴースト枠・落下トレイル。
      - `mine`: スチールティール盤面・数字掘り込みセル・立体カバー・旗・棘付き機雷・協力2色ポインター。
      - `mineVersus`: 青対赤のスプリット背景を金色稲妻で分割し、盾・氷結結晶・赤青旗＋数字タイル・中央機雷を配置。
      - `bozu`: フェルト地に格子裏札・扇を持つ姫札・剃髪と数珠付きの坊主札を扇状に配置。
      - `karuta`: フェルト地に詠み手札（歌人）・金のスワイプ軌跡・桜花びら・金霞＋朱印＋縦書き「はるすぎて」の取り札を配置。
      - `wolf`: 夜空＋星＋クレーター付き満月＋村の灯りと針葉樹林の前で月光リムライトを浴びて遠吠えする人狼シルエット。
  - `web/pc-firebase/js/app.js`: `artOf(id)` を全38種共通の `art(ART_ID[id] || id) || ''` に簡素化し、フォールバック絵文字分岐を削除。
  - `web/pc-firebase/js/bunyo.js`, `web/pc-firebase/js/pakuris.js`, `web/pc-firebase/js/mine-versus.js`, `web/pc-firebase/js/poet-cards.js`: それぞれの `.setuphead` で絵文字や無アイコンだった部分を `<span class="art">${artOf(...)}</span>` に統一。
  - `web/pc-firebase/sw.js`: キャッシュ名を `asobipcfb-20261118-icons-craft-1` に更新。
- ファイル: `web/pc-firebase/js/art.js`, `web/pc-firebase/js/app.js`, `web/pc-firebase/js/bunyo.js`, `web/pc-firebase/js/pakuris.js`, `web/pc-firebase/js/mine-versus.js`, `web/pc-firebase/js/poet-cards.js`, `web/pc-firebase/sw.js`, `README4AI_Claude_Codex_Antigravity.md`
- 確認: `git diff --check`、`node --check` (`art.js`, `app.js`, `bunyo.js`, `pakuris.js`, `mine-versus.js`, `poet-cards.js`, `sw.js`)、`node tools/tests/check_transient_audio.cjs`、`node tools/tests/check_cursor_send.cjs`、`node tools/tests/test_extra_12_games.mjs`、ヘッドレス Chromium CDP 検証（`mobile_ux_verify.py`・`tablet_verify.py`・`e2e_verify.py`、メニュー38件＋成績 `.record-art svg` 38件＋追加8ゲームの `.setuphead .art svg` 全描画・エラー0、大小アイコン目視確認）すべて合格。`web/pc/` と `Windows-Projects` は無変更。`ccr-efc07031-6exjqs` へコミット・プッシュ済み。

### 2026-11-17 21:33(PST)/ Antigravity / ccr-efc07031-6exjqs
- 目的: ユーザーの指示（2項目）。
  1. スマホ縦画面（対局画面 `.play-screen`）で下側が空く問題に対し、Android アプリ版 / `web/lite/` 準拠の配置（上部ナビ＋設定ボタン → プレイヤー札 `#strip` → ステータス＋手数 → 中央盤面 `#boardwrap` を残り領域いっぱいに拡大 → `#acts`・`.ops`・`.online-ops` を下端固定）へ再構成して下側の空白を解消する。
  2. ブラウザの戻るボタンや Android 画面下部の戻るボタン押下時、サイトを即終了するのではなくゲーム内の戻るボタン（`goBack()`）と同じ動作（シート/スタンプ/チャットポップアップ/モーダル/詳細シートを閉じる、対局中は確認シートを出す、設定/準備/成績/ルーム画面からはメニューや部屋へ戻る等）をするようにする。
- 変更:
  - `web/pc-firebase/css/app.css`:
    - スマホ縦専用ルール `@media (max-width:680px) and (min-height:541px)` を `html:has(.play-screen), body:has(.play-screen)` の `100dvh; overflow: hidden;` 固定＋ `.play-screen` の CSS Grid（`.stage, .side { display: contents }`、Row 1 `.stagehead` → Row 2 `#strip` → Row 3 `.status`/`.sidenote:not(.custom)` → Row 4-5 `#countbar`/`.countline`（時間制限なし時は `display: none`）→ Row 6 `minmax(0,1fr)` の `#boardwrap`（`container-type: size` で `100cqw`/`100cqh` に応じて将棋/カード/麻雀/ソリティア/人生すごろく等を拡大）→ Row 7-10 `#acts`/`.sidenote.custom`/`.ops`/`.online-ops` を下端固定）へ刷新。`gap: 0 6px` と要素ごとの明示的 `margin-top` により空行による余分な縦ギャップを防止。
    - 狭幅 `@media (max-width:640px)` 時の `#bgs` 2段折り返しに対する `.chatfab` / `#chatpop` の下端余白調整を追加し、ヨット/ヒット＆ブローには `#boardwrap` 内部スクロールを維持して操作バー下端固定を保証。
  - `web/pc-firebase/js/app.js`:
    - `canGoBackInApp()`, `syncAppHistory()`, 起動時 `asobiGuard` リセット、`popstate` リスナー、`pointerdown`/`keydown`（capture）でのガード同期フォールバックを追加し、`render()`・`openSheet()`（シート置換時は中間 `history.back()` を発火させない）・`closeSheet()`・`togglePlayChat()` と連携。合わせて `goBack()` でモーダル閉鎖時に試聴 BGM (`PV`) を停止するよう修正。
  - `web/pc-firebase/js/online.js`: `refreshChat()` とスタンプパネル外タップ (`pointerdown`) による状態変化時にも `syncAppHistory()` を同期。
  - `web/pc-firebase/sw.js`: `f77d707` で統合された8ゲームファイル群を維持したままキャッシュ名を `asobipcfb-20261118-mob-board-back-2` に更新。
- ファイル: `web/pc-firebase/css/app.css`, `web/pc-firebase/js/app.js`, `web/pc-firebase/js/online.js`, `web/pc-firebase/sw.js`, `README4AI_Claude_Codex_Antigravity.md`
- 確認: `git diff --check`、`node --check` (`app.js`, `online.js`, `sw.js`)、`node tools/tests/check_transient_audio.cjs`、`node tools/tests/check_cursor_send.cjs`、`node tools/tests/test_extra_12_games.mjs`、ヘッドレス Chromium CDP 検証3種（`mobile_ux_verify.py`・`tablet_verify.py`・`e2e_verify.py`）すべて合格、`ccr-efc07031-6exjqs` へリベース＆統合再検証の上でプッシュ済み。`web/pc/` と `Windows-Projects` は無変更。

### 2026-11-18 / Codex / 追加8ゲームをGitHub Pagesへ反映
- ユーザー検証のため、追加8ゲームのコミット `964ec47` を公開ブランチ `ccr-efc07031-6exjqs` の `de1fb18` に統合。公開側のスマートフォン表示、ルーム設定、公開ルーム一覧と両立するよう競合箇所を調整した。
- 統合後のPC版で8ゲームの起動・ルーム対戦・協力と既存の対局、観戦、成績を検証。コア12ゲームのテストと、PWAのオフライン起動も確認した。通信はローカルのFirebase API代替を使った。

### 2026-11-18 / Codex / 依頼されていた追加8ゲームをFirebase PC版で遊べるようにする
- 対戦マインスイーパー、坊主めくり、百人一首をメニューに追加。既存の協力マインスイーパー、スライドパズル、ぶにょぶにょ、パクリス、人狼と合わせて8ゲーム。マインスイーパーの協力は1人でも遊べ、失敗直前まで戻せる。
- MineLink PCの添付ソースを参照し、対戦の同一初期配置、6つの妨害、ポイント、難易度、順位、地雷の凍結、盾の設定を反映。協力には5難易度とカーソルの表示・共有設定を追加。
- 落ち物2作は同一の初期乱数で対戦を始め、消去・連鎖によるお邪魔、相殺、全消し、相手の盤面、敗着を同期。操作、消去、着地の表示には手元のオリジナル素材を使用。
- 坊主めくりは100枚から4つの山を作り、好きな山を選んで引ける。百人一首は同じ札のスタイルで上の句と取り札を表示する。絵は保存済みの見本の仮絵。読み上げは提供される音源を `web/pc-firebase/audio/karuta/001.mp3` のように置き、再生可能な札番号を同ディレクトリの `manifest.json` に配列として登録すると有効になる。VOICEVOX表記は既存のクレジットに掲載。
- リモートの `8101c9c` を作業ツリーへ取り込み、既存の通信拡張と統合。ゲーム開始・進行はPCブラウザとローカルのFirebase API代替で検証した。
- ユーザーの指示により、動作確認済みの `8101c9c` を親とし、追加8ゲームの実装・検証設定・作業記録を `dev/new-games-20261118` にコミットする。

### 2026-11-17 21:06(PST)/ Antigravity / ccr-efc07031-6exjqs
- 目的: ユーザーの指示（3項目 + 初回起動競合修正）。
  1. スマホ版 (`isMob()`) の対局画面 (`.play-screen`) でなるべくスクロール不要にし、オンライン対局中のチャットは丸いフローティングボタン (`.chatfab`)＋未読バッジを押すと浮き出るポップアップ (`#chatpop`) にする。
  2. 公開ルーム一覧の更新ボタン (`[data-pubrefresh]`) を回転矢印アイコン (`IC.refresh` + `.is-spin`) にする。
  3. ゲームの人数フィルター切替時、ワンフレーム切替ではなくアニメーション（FLIP 移動・退場ゴースト・順次フェードイン）で切り替える。
  4. あわせて冷起動・リロード直後に `online.js` の `setTimeout(..., 0)` が `app.js` 読込前 (`coreReady` 未定義) に発火して `netReady` が `false` のまま止まる場合があった競合を修正。
- 変更:
  - `web/pc-firebase/js/art.js`: `IC.refresh`（回転矢印 SVG）と `IC.chat`（吹き出し SVG）を追加。
  - `web/pc-firebase/js/app.js`:
    - メニューの人数フィルター切替を `menuMainHtml()` + `switchPlayerFilter(v)` へ分離し、`.rail` を再生成せずに Web Animations API で残存タイルの FLIP 移動・除外タイルの `.tile-ghost-out` フェード縮小退場・新規タイルの順次登場・見出しフェードを実行（`S.set.reduce` 時は即切替、`.main.filter-enter.filter-anim` で既存テスト互換維持）。
    - スマホ対局画面で `.side .chat` を省略し、円形 `.chatfab`（`.chatfab-badge` 未読数表示）＋ `.chatpop-back` / `#chatpop` ポップアップ（`togglePlayChat`, `syncChatFab`, `playChatPopHtml`）を `#boardwrap` を再描画せず開閉可能に実装。`Escape` / `goBack()` / リサイズ時は閉じるように対応。
    - `drawClock()` で時間制限なし時に `#countbar`・`.countline` へ `.no-limit` クラスを付与しスマホ表示時に高さを詰めるよう調整。
  - `web/pc-firebase/js/online.js`:
    - `[data-pubrefresh]` をアイコンのみの丸ボタン `.pubrefresh-btn` に変更し、`refreshPublicRooms()` で最低 450ms `.is-spin` 回転クラスを付与。
    - `onlineChanged()` と `refreshChat()` でスマホ対局中のチャット受信時に未読数 `S.chatUnread` を更新し、`.side .chat, #chatpop .chat` の両方を更新・`sendChat()` のスタンプ送信時も対局中は `refreshChat()` のみ呼んで盤面維持。
    - `ensureNet()` の自動起動を `document.readyState === 'loading'` 時は `DOMContentLoaded` 後に遅延し、`app.js` の `coreReady` 初期化前発火による失敗を防止。
  - `web/pc-firebase/css/app.css`: `.pubrefresh-btn` / `@keyframes pubSpin`、`.chatfab` / `.chatfab-badge` / `#chatpop`（BGM バー `#bgs:not([hidden])` 回避位置）、`.tile-ghost-out`、および `@media (max-width:680px)` / `@media (max-height:540px) and (max-width:960px)` 向けの `.play-screen` 省スペース無スクロール配置（`.no-limit` 非表示、`.status`＋`.sidenote:not(.custom)` の同列配置、4列 `.ops`、人生すごろくの `.lside` 横並びルーレット、将棋/ヨット/ヒット＆ブロー/カード/麻雀/ソリティア等の `dvh` ベース調整、横画面 2カラム `100dvh` 固定）を追加。
  - `web/pc-firebase/sw.js`: キャッシュ名を `asobipcfb-20261117-mob-noscroll-anim-4` に更新。
- ファイル: `web/pc-firebase/js/art.js`, `web/pc-firebase/js/app.js`, `web/pc-firebase/js/online.js`, `web/pc-firebase/css/app.css`, `web/pc-firebase/sw.js`, `README4AI_Claude_Codex_Antigravity.md`
- 確認: `git diff --check`、`node --check` (`art.js`, `app.js`, `online.js`, `sw.js`)、`node tools/tests/check_transient_audio.cjs`、`node tools/tests/check_cursor_send.cjs`、`node tools/tests/test_extra_12_games.mjs`、ヘッドレス Chromium CDP 検証3種（`tablet_verify.py`・`e2e_verify.py`・`mobile_ux_verify.py`: フィルターアニメーション＋省モーション対応、スマホ縦 `390×844` 全30ゲーム / `360×740` 主要12ゲーム / スマホ横 `844×390` 主要12ゲームのすべてで縦横ページスクロール0、公開ルーム更新アイコン回転、オンラインスマホの `.chatfab` 未読バッジ・スタンプ・チャット送受信時の盤面非再描画、主要スクリーンショット目視確認）すべて合格。`web/pc/` と `Windows-Projects` は無変更。`ccr-efc07031-6exjqs` へコミット・プッシュ済み。

### 2026-11-17 20:41(PST)/ Antigravity / ccr-efc07031-6exjqs
- 目的: ユーザーの指示。`web/pc-firebase/` をタブレット（縦・横）でブラウザ表示したときも PC 版の基本構成（左ナビ `.rail` ＋ 中央 `.main`/`.stage` ＋ 右 `.detail`/`.side`）のまま違和感なく収まるように調整し、終了ボタン (`.quitbtn`) を非表示にする。
- 変更:
  - `web/pc-firebase/js/app.js`: `isMob()` の閾値をスマホ向け（`innerWidth <= 680` または低高さ横画面 `innerWidth <= 960 && innerHeight <= 540`）に引き下げ、タブレット縦横を PC 構成のまま維持。`isTouchDevice()` に UA (`/iPad|Android|Tablet|PlayBook|Silk/i`) および iPadOS デスクトップモード判定 (`platform === 'MacIntel' && maxTouchPoints > 1`) を追加し、`rail()` で `.quitbtn` を非表示化。
  - `web/pc-firebase/js/online.js`: `isMobileCursorOff()` にも `isTouchDevice()` 判定を追加し、タッチタブレット端末でもポインター送受信・補間描画を抑止。
  - `web/pc-firebase/css/app.css`: スマホ専用 `@media (max-width:920px)` を `@media (max-width:680px), (max-width:960px) and (max-height:540px)` へ移行したうえで、タブレット幅帯 (`681px〜1120px`, `681px〜880px`) のカラム幅・設定パネル・セグメントボタン折り返し・BGM ストリップ・成績表・ガイド配置を調整。さらにタブレット縦画面 (`681px〜960px` かつ `orientation: portrait`) 向けに `cqh` 依存で崩れやすかった盤面（将棋の駒台縦配置、ヨット・ヒット＆ブローの縦並び、花札等カード卓・スピード・ソリティアの縦横比、麻雀の正方形盤面と横スクロール手牌、人生すごろくのルーレット幅）を最適化。
  - `web/pc-firebase/sw.js`: キャッシュ名を `asobipcfb-20261117-tablet-ui-3` に更新。
- ファイル: `web/pc-firebase/js/app.js`, `web/pc-firebase/js/online.js`, `web/pc-firebase/css/app.css`, `web/pc-firebase/sw.js`, `README4AI_Claude_Codex_Antigravity.md`
- 確認: `git diff --check`、`node --check` (`app.js`, `online.js`, `sw.js`)、`node tools/tests/check_transient_audio.cjs`、`node tools/tests/check_cursor_send.cjs`、ヘッドレス Chromium CDP タブレット＋各種ビューポート検証（PC `1280×800`・タブレット縦 `744×1133` / `768×1024` / `820×1180`・タブレット横 `1024×768` / `1180×820`・iPadOS `MacIntel + maxTouchPoints=5`・スマホ縦横 `390×844` / `844×390` のメニュー/部屋/成績/設定/準備/主要11盤面すべて横溢れ0＆主要スクリーンショット目視確認）、および 5 クライアント E2E（公開部屋/詳細確認/ロック/定員超過観戦選択/スマホ・タブレットでの終了ボタン非表示＆カーソル非送受信/エラー0）すべて合格。`web/pc/` と `Windows-Projects` は無変更。`ccr-efc07031-6exjqs` へコミット・プッシュ済み。

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
### 2026-11-18 / Codex / Firebase版に人狼を実装
- 採用されたPCサンプルに合わせ、左右のパネルを同じ幅にし、左に進行情報と下端の投票操作、中央に村の話し合い、右に対局共通パネルを配置。参加者名は対象を選ぶ場面で表示する。
- ゲーム一覧からひとりで遊ぶ場合と、ルームのホストが対戦を開始する場合に対応。3〜6席で空席はCPUが担当する。人数、話し合いの時間、特殊役職、死亡者のチャット参加を開始前に選べる。
- ホストが昼夜・投票・役職の行動を判定し、Firebaseの既存のルームで同期する。個人の役職と能力の結果は暗号化し、村の話し合いと共通のルームチャットの両方に死亡後の制限を適用。襲撃演出は保存済みの動画から盤面部分を使用し、既存のカットインを再生する。
- PCブラウザでソロと3クライアントのルーム同期、役職の暗号化、投票、占い、死亡後の発言制限、襲撃動画からカットインへの切り替えを確認。既存のFirebase UIと成績の回帰試験も合格。通信試験にはローカルのFirebase API代替を使用した。

### 2026-11-18 / Codex / 人狼のPCサンプル改訂6
- 右にFirebase版の共通パネルのスタイル、席表示、ルール・役職一覧とルームチャットを戻し、中央に村の話し合いを配置。右と同じ340pxの左バーに日数・人数・時間・自分の役職を表示し、投票と夜の確定操作を下端に固定。
- PCブラウザで左右幅、投票、占い、二つのチャットとスタンプを確認。ギャラリーと改訂6のZIPに保存。

### 2026-11-18 / Codex / PC人狼の話し合いサンプル改訂5
- 話し合い中は生存人数を上部にまとめ、チャットを画面幅いっぱいに配置。投票・夜の対象指定時に選べる相手だけを表示する。PC幅で発言、投票、占い、翌日の候補非表示を確認。

### 2026-11-18 / Codex / 人狼とスライドパズルの操作サンプル改訂4
- 人狼の話し合いではPCの右カラムを広げ、スマホで発言と入力欄を最初に表示。役職・時間・死亡後チャットの設定から、投票・追放・夜の能力を操作できるオフラインサンプルを追加。保存済みの人狼動画2本を引き継いだ。
- スライドパズルは完成図から一枚絵または数字を選び、3×3〜6×6の盤面でピースを動かせる。サンプルの対戦相手は同じ初期配置から始める模擬プレイヤー。
- 閲覧用の入口は `samples/boards-20261118/index.html`、保存用は `samples/board-samples-20261118-r4.zip`。

### 2026-11-18 / Codex / MineLink サンプル改訂3
- 再添付ZIPの Level・Config・VersusPrefs・ScreensHome・ScreensPlay・Palette に沿って盤面と操作できる設定サンプルを改訂。対戦は自分の盤面、相手の進捗、妨害6種。協力は共有盤面と仲間のカーソル。ポイントの難易度別保存、範囲、初期値への復帰、スマホ幅を確認。
- 改訂2のZIPを元に差し替え、人狼を含む他ゲームのファイルが同一であることを照合。入口は samples/boards-20261118/index.html、配布物は samples/board-samples-20261118-r3.zip。


- 2026-11-18 / Codex / 人狼の再制作動画2本の保管。専用ZIPを `samples/werewolf-animations-20261118.zip` に保存し、元MP4・改訂2の全体ZIP・ダウンロード用コピーの各動画がバイト単位で一致することを確認。

### 2026-11-18 / Codex / サンプル改訂2
- 添付映像のフレームを落ち物2作のサンプルに直接使用。左にパクリス、右にぶにょぶにょを配置し、同色4個消去からの2連鎖とお邪魔、試作の目を反映。参考フレームは一覧から閲覧可能。
- スライドと人狼の設定をオフラインでも操作できるように追加。4サイズ・絵柄、役職・時間・死亡後チャットの切替をブラウザで確認。MineLink の以前の添付パスが現在の環境にないため未照合の設定画像を改訂版ZIPから除外。
- 保存用ZIPは `samples/board-samples-20261118-r2.zip`。前版ZIPは保持。


### 2026-11-18 / Codex / 新規ゲーム8盤面のサンプル再制作
- 会話の仕様と参考映像に沿って盤面・設定・意匠14枚と演出動画10本を作成した。入口は `samples/boards-20261118/index.html`。閲覧に必要な実ファイルと照合値を `samples/board-samples-20261118.zip` に収録。各動画の H.264/AAC デコードと ZIP の検査を実施。札の絵は仮絵で、MineLink 元アプリの設定との一致は未確認。


### 2026-11-18 / Codex / 参考映像の保管状況を確認
- 目的: ユーザーが後から参照できるように求めたサンプルの実ファイルを確認し、実在する資料だけを参照可能にする。
- 結果: 過去に記録された盤面サンプル v4/v5 と ZIP は、このチェックアウト・取得したリモート履歴・現在のバックアップに存在しない。下記の過去記録は当時の報告であり、現時点の保存状態を示さない。
- 変更: ユーザー添付のぶにょぶにょ・パクリス参考映像2本を `samples/references/` に保管し、スマートフォンでも開ける `index.html` と `samples/README.md` を追加。32 MiBの取得上限を超える `Video Project 3.mp4` は未保管と明記。
- 制限: 今回保管したものは参考映像であり、失われた盤面サンプルを復元したものではない。未コミット・未プッシュ。

### 2026-11-18 / Codex / dev/new-games-20261118 (作業中)
- 目的: Firebase PC Web 版に新規ゲームを追加する。公開済みの `web/pc/` と他プラットフォームは変更しない。
- 変更: スライドパズルの3×3〜6×6、完成図を使う風景・数字の選択、共通シャッフルのオンライン競争を追加。ぶにょぶにょの同色4個消去、パクリスのライン消去と自動落下、マインスイーパーのソロ盤面・Firebase 協力盤面・ホスト権限での失敗前への待ったを追加し、メニュー・成績・画面内設定・キャッシュ・VOICEVOX クレジットにも反映。
- 制限: ぶにょぶにょとパクリスの対戦・お邪魔、マインスイーパーの対戦と MineLink 固有設定、坊主めくり・百人一首の指定された実カード、人狼は未実装。これらを完成扱いにしない。MineLink のソース ZIP と実カード画像は現在の作業環境にない。
- 確認: Firebase 版の既存3画面回帰テストと4ゲームのスマホ幅ブラウザ表示、ぶにょぶにょの4個消去条件、スライドの2画面共通盤面、マインスイーパーの2画面協力操作・巻き戻しを確認。本番 Firebase 通信・iPhone 実機は未検証。未コミット・未プッシュ・未公開。

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
- サンプル: 当時は `samples/index.html` からv4/v5とZIPを参照できると報告したが、2026-11-18の確認では実ファイルは見つからなかった。
- 状態: 当時は未コミット・未プッシュ・未公開。現在の `/workspace/.backups/` には後日のアプリ作業用バックアップのみあり、v4/v5サンプルは含まれない。

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
