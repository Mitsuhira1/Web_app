# あそび箱30 Web 版

公開ページ: https://mitsuhira1.github.io/Web_app/ (一度開くと全部のファイルを端末に保存するので、ネットが切れても1人用・CPU対戦は遊べる。ホーム画面に追加もできる)

ボードゲーム・カードゲーム30種の Web アプリ(日本語のみ・スマホの縦画面が主)。
規則と CPU は、Android 版(日本アソビ大辞典30)と同じ Kotlin のコードを JavaScript にして使う。画面は新しく書いた(HTML/SVG)。

## 構成
- `app/` … 画面。元の Android アプリの Jetpack Compose のコード(ui/・AppModel・data/)を、Compose Multiplatform で WebAssembly にしたもの。Android にしかない部品だけを `web/` の置き換え部品(Shims)で同じ名前に用意し、元のコードはほぼそのまま。
- `core/` … Kotlin(Multiplatform: JVM と JS)。規則・CPU・通信の部屋・効果音の計算。`jsMain/Engine.kt` と `WebNet.kt` が画面への入口。
- `web/` … 画面(`app.js`・`games.js`・`games2.js`)、通信の部品(`net.js`)、効果音(`audio.js`)、字・録音・ライセンス。
- `tools/` … `build_web.sh`(JS を作って `web/core/` に入れる)、`subset_fonts.py`(字を軽くする)。

## 作り方・動かし方
```
tools/build_web.sh              # core を JS にして web/core/ へ(web/sw.js の保存の一覧も作り直す)
python3 -m http.server -d web   # http://localhost:8000
gradle :core:crossCheckJvm      # 規則の一致の試験(JVM 側)。JS 側は docs/STAGE1_NOTES.md
gradle :core:crossCheckJvm -Pmode=crypto   # 通信部品を JDK と照らし合わせる
```

## 進み具合(2026-11-12)
- 遊べる: 26 / 30(将棋・5五将棋・リバーシ・四つ並べ・五目ならべ・ヘックス・マンカラ・ナインメンズモリス・チェッカー・チェス・ドット＆ボックス・ヒット＆ブロー・ウサギと猟犬・チャイニーズチェッカー・ルドー・バックギャモン・碁・サイコロ役づくり・7ならべ・神経衰弱・Oh, No!・花札・ポーカー・テキサスポーカー・ブラックジャック・大富豪)。
- 画面がまだ: スピード・ソリティア・麻雀・道のりすごろく(規則と CPU は core に入っている)。
- 通信対戦: 招待コード/返信コードの手動交換と、中継(ntfy)による返信の自動送信(中継は未確認)。詳しくは `docs/CROSSPLAY.md`。
- 元の Android 版(0.5.11)との取り込み・通信の手順 2・規則の番号: `docs/ANDROID_SYNC.md`。規則は Android 版の再生の記録 90 本と全部一致(`node tools/replay_check.mjs`)。
- 通信の手順 2 の待った・チャット・古い版の表示に対応(スタンプの絵・制限時間のカウントダウン・チャットの吹き出しは未実装)。

## 使っている部品とライセンス
| 部品 | ライセンス |
|---|---|
| Kotlin(コンパイラ・標準ライブラリ) | Apache-2.0 |
| Compose Multiplatform・Skiko | Apache-2.0 |
| Skia | BSD-3-Clause |
| Zen Maru Gothic | SIL Open Font License 1.1 |
| Yuji Boku | SIL Open Font License 1.1 |
| 碁石の録音(KaTrain、Jordan Seaward) | MIT |
| 将棋の駒の録音(ShogiHome、Kubo Ryosuke) | MIT |
アプリの「ライセンス」画面にも載せている。AGPL の部品は使わない。

## 守ること
- 署名鍵・パスワード・個人のメールアドレスなどをこのリポジトリに入れない。
- コミット・プッシュはユーザーが言った時だけ。

## PC 版を Web で(Edge のアプリ版「遊びの箱30」)

- 公開ページ: https://mitsuhira1.github.io/Web_app/pc/ (Edge で開いて「アプリとしてインストール」すると、スタートメニュー・タスクバーから専用のウィンドウで開ける)
- 中身は Windows-Projects の `app/`(exe・動く見本と同じ)。`web/pc/` は手で直さず、元を直してから `python3 tools/sync_pc.py` で写す。
- Web 版だけで足すもの: `manifest.webmanifest`・`sw.js`(ネットにつながる時はいつも新しい版を取り、切れている時は保存した物で開く)・`pwa.js`(閉じる前の確認・ウィンドウの大きさ)。名前は「遊びの箱30」(exe は「日本アソビ大辞典30」)。
- 通信(`net.js`)は Web 版・アプリ版と同じなので、クロスプレイできる。

