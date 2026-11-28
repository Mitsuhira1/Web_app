# START_HERE — 最初に、これだけを読む

このリポジトリで作業する AI(Claude・Codex/GPT・Antigravity/Gemini など)と人は、**ほかのファイルを開く前に、このファイルを読む**。
目的は、読む必要のないファイルを読まず、文脈(コンテキスト)を節約すること。ここに書いた範囲だけを読み、足りない時だけ、表の「開くファイル」を 1 つずつ開く。
`README4AI_Claude_Codex_Antigravity.md` は**全部は読まない**(読み方は 3 章)。

最終更新: 2026-11-20

---

## 1. いまの方針(ユーザーの指示)
- **主開発は `web/pc-firebase/`**(PC ブラウザ版・Firebase 通信・「あそび箱50」)。スマホブラウザ版もこちらに移行した。
  ここで十分に作り込んでから、ほかの版(exe・Android など)に広げる。公開: https://mitsuhira1.github.io/Web_app/pc-firebase/
- 通信は **Firebase Realtime Database**(4 桁の部屋コード)。WebRTC・招待コード/返信コード・ntfy は**廃止**。
- ゲームは **50 種**(下の 5 章)。
- **進め方**: ユーザーがバグ・改善をその都度伝える → その分だけ直す。**返事にチェックリストを貼らない**。確認してほしい項目は `docs/CHECKLIST_PENDING.md` に追記する(チャットには「追記した」とだけ書く)。
- 公開・既定のブランチは `ccr-efc07031-6exjqs`(プッシュすると GitHub Pages に出る)。AI ごとの作業ブランチは `README4AI…` の 1 章。**コミット・プッシュはユーザーが言った時だけ**。

## 2. 読む順番
1. このファイル(全部)
2. 直す物に関係する時だけ:
   - 通信(部屋・同期・カーソル・チャット)→ `docs/FIREBASE_NET_MANUAL_FOR_AI.md`(285 行。関係する節だけ)
   - ほかの AI が最近何を変えたか → `README4AI_Claude_Codex_Antigravity.md` の **1〜4 章と、5 章の新しい 3〜5 件だけ**(5 章は新しい順。古い記録は読まない)
3. 5 章の表の「開くファイル」(大きいファイルは `grep -n` で場所を見て、その前後だけを読む)

## 3. 作業の後
- `README4AI_Claude_Codex_Antigravity.md` の 5 章の**先頭**に、短く記録を足す(日付 / AI / 何を・なぜ / 触ったファイル / 確かめたこと)。
- ほかの版(exe・Android・スマホ版)にも入れるべき変更は `docs/PORTING_TODO.md`(他バージョンへの引継ぎメモ)の先頭に足す。
- 確認してほしい項目は `docs/CHECKLIST_PENDING.md` に足す。

## 4. 読まないもの
| ファイル | 理由 |
|---|---|
| `web/pc-firebase/core/asobi-pc-core.mjs`(1.75MB) | 規則・CPU を JS にしたもの。直す時は関数名を `grep -n` して、その前後だけ |
| `web/pc-firebase/fonts/` `audio/` `icons/` `assets/`(絵・ルールの動画 40 本) | 字・音・絵・動画 |
| `web/pc-firebase/js/poems.js` | 百人一首の歌のデータ |
| `web/pc-firebase/js/boards/games1.js` `games2.js` | 古い盤の描き方(後のファイルで上書き。5 章の表にないゲームの時だけ) |
| `web/pc/` | 旧 PC 版(WebRTC)。**変えない・読まない** |
| `web/` 直下(`asobi.wasm`・`asobi.js`・`index.html` など)・`web/lite/`・`app/`・`core/` | 旧スマホ版(Compose・WebRTC)とその Kotlin。pc-firebase の作業では読まない |
| `docs/NEW_12_GAMES_SPEC_FOR_CODEX.md`(340 行)・`docs/ROULETTE_SPEC_FOR_CODEX.md`(163 行) | そのゲームを直す時だけ |
| `README4AI…` の 5 章の古い記録 | 2 章のとおり、新しい数件だけ |

## 5. どこに何があるか(`web/pc-firebase/` の中。必要な時だけ開く)
| 直したいこと | 開くファイル |
|---|---|
| 画面の切り替え・対局の進め方・カットイン・結果・設定 | `js/app.js`(1940 行。`grep -n "^function 名前"`) |
| 見た目 | `css/app.css`(3000 行。後ろほど新しい)・追加ゲームは `css/twelve.css` |
| みんなで遊ぶ(部屋・同期・チャット・スタンプ・カーソル) | `js/online.js`(2240 行)・`js/net.js`(Firebase) |
| ルール説明 | `js/rules.js`(動画は `assets/rules/<id>.mp4`)。ステップ動画は `js/rules-steps.js`(`tools/build_rule_steps.cjs` で作る)・`assets/rule-steps/`。録り直しは `tools/rule_video/`(README) |
| 絵(アイコン・スタンプ・駒・札) | `js/art.js`(メニューのアイコンは画像 `assets/game-icons/`。絵を変えたら `node tools/build_game_icons.cjs`)。フェルトの地模様・マンカラの木枠は画像 `assets/tex/`(`node tools/build_textures.cjs`)、麻雀の牌は `assets/mj/`(`node tools/build_mahjong_tiles.cjs`) |
| 効果音 / BGM / ゲームパッド | `js/sfx.js` / `js/bgm.js` / `js/gamepad.js` |
| オフラインの保存(ファイルを足した時) | `sw.js` の `FILES` とキャッシュ名 |

**ゲームと、描き方のファイル**
| ファイル(`js/`) | ゲーム |
|---|---|
| `boards/basic.js` | 将棋・5五将棋・リバーシ・コネクトフォー |
| `boards/fix.js` | ヘックス・マンカラ・ドット&ボックス・ウサギと猟犬・ヒット&ブロー・ヨット |
| `boards/fix2.js` | 五目ならべ・碁・ナインメンズモリス・チェッカー・チェス・チャイニーズチェッカー・バックギャモン・ルドー |
| `boards/table.js` | 花札・7ならべ・神経衰弱・ポーカー・ホールデム・ブラックジャック・大富豪・Oh, No! |
| `boards/extra.js` / `boards/life.js` | 麻雀・スピード・ソリティア / 人生すごろく |
| `boards/twelve.js`(規則は `core/games/<id>.mjs`) | 戦争・たこ焼き・ぶたのしっぽ・ババ抜き・ハーツ・ジンラミー・ハゲタカ・ごいた・クアルト・ガイスター・ラミィキューブ・ペグ・ソリティア |
| `boards/nine.js`(規則は `core/games/<id>.mjs`、状態・カーソル・音は twelve.js 経由で委譲) | コヨーテ・スカル・ライアーズダイス・インカの黄金・6ニムト・ブロックス・コリドール・バトルシップ・チンチロリン |
| `boards/roulette.js`(＋ `roulette-motion.mjs`・`core/games/roulette.mjs`) | ルーレット |
| `slide.js` / `bunyo.js` / `pakuris.js` / `mines.js`・`mine-versus.js`・`mine-noguess.js` / `poet-cards.js` / `wolf.js` | スライドパズル / ぶにょぶにょ / パクリス / マインスイーパー / 坊主めくり / 人狼 |
| `falling-match.js`(対戦・先取・並び)・`falling-fx.js`(光・音・ぷよの描き方)・`css/falling.css` | ぶにょぶにょ・パクリス共通(規則の試験: `tools/tests/test_falling_rules.mjs`) |
| `munage.js`(＋ `css/munage.css`。見本は `docs/mockups/munage/`) | 胸毛絶体絶命(盤・アニメ・効果音・CPU すべてこの 1 ファイル) |

(`ORDER` は `js/app.js` 34 行目。ゲームを足したらここと上の表を直す)

## 6. 守ること
- **規則を勝手に変えない**。ほかの版と一緒に遊ぶ時に、同じ手から同じ局面になる必要がある。
- `web/pc/`(旧 PC 版)・Android 版のリポジトリは変えない。`Windows-Projects` も今は触らない。
- 個人の情報(メールアドレスなど)をファイル・コミット・外のサービスに入れない。
- ユーザーとのやりとりは日本語。直したこと・変えたファイル・確かめたこと/確かめていないことを分けて書く。返事の最後に「次にやること」を番号つきで短く。
- 画面を大きく変える時は、先に見本を見せて了承を得る。
- **左上の戻る・右の側板・左下の設定(歯車)は全ゲーム共通**。新しいゲームも作り直さず、盤(`#boardwrap`)だけを描く。見本も PC 版の実際の対局画面の中で作る。詳しくは `CLAUDE.md` の「全ゲーム共通の画面部品」。
- 見た目を直す時は、**盤面の表示部分の大きさをできるだけ変えず**、中の部品(札・駒・枠)の大きさや並びで直す。空き枠は札・駒と同じ大きさに。詳しくは `CLAUDE.md` の「見た目を直す時の基本方針」。

## 7. 試す(コマンドだけ)
```bash
python3 -m http.server -d web 8400        # http://localhost:8400/pc-firebase/
node tools/tests/test_extra_12_games.mjs  # 追加 12 ゲームの規則
node tools/tests/test_roulette_core.mjs   # ルーレット
# ほかの試験と使い方: tools/tests/README.md
```

## 8. このファイルの直し方
- 方針・ファイルの場所・ゲームが変わった時だけ直す。短く保つ(150 行を超えない)。作業の記録はここに書かず `README4AI…` の 5 章へ。
