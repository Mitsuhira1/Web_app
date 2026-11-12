# 段階1 の記録(あそび箱30 Web 版)

## 決まったこと(ユーザーの指示)
- 作り方は A(core を Kotlin/JS にして、画面は新しく書く)。
- 古い版(規則の番号がない)とは、部屋に入れない(拒否)。
- 名前は「あそび箱30」。ゲーム名の変更: コネクトフォー→四つ並べ / ヨット→サイコロ役づくり / 人生すごろく→道のりすごろく(名前だけ。他の中身は変えない)。
- 起動画面の大きな題名「ゲームの棚 30」は、ユーザーが了承したデザインのまま。

## core の変更(元のアプリの `core/` との差)
- `Compat.kt`(新規): nowNanos・ThreadLocal・synchronized・groupDigits・JavaRandom。
- Game.kt: Budget の時刻を nowNanos に。 Search.kt: OutOfTime の fillInStackTrace を削除。
- Daifugo/Sevens: bitCount → countOneBits。 HitBlow: Arrays.fill → fill。 Life: "%,d" → groupDigits。
- MahjongCpu: 向聴数の記憶を LinkedHashMap(使われた順)から HashMap(8192 を超えたら全消去)へ。結果は同じで、記憶の入れ替え方だけが違う。
- Catalog.kt: 3つのゲーム名。
- `core/net/`・`DebugScenarios.kt` は、まだ入れていない(段階4で入れる)。

## 試験(JVM と JS で同じになること)
- `gradle :core:crossCheckJvm [-PcpuMoves=6]` と `crossCheckReport`(JS)の出力を比べる。
- 全30ゲーム×3つの種、席の並べ替え(java.util.Random と同じ計算)。2026-11-12: 規則だけ・CPU 最初の6手つきの両方で 94 行が完全に一致。

## 未確認
- ブラウザから ntfy へ(CORS)。この環境のプロキシが ntfy.sh を止めるため試せない。
- WebRTC の招待コードが Android 版とブラウザで噛み合うか。
- 実機(AQUOS wish5)での CPU の速さ。画面の「速さの試験」で測る。

## 実機の速さ(2026-11-12、SH-M32・Android 16 の WebView)
全30ゲームの規則の試験 1974ms。将棋・5五将棋の上級は上限(1.5 秒)まで考える。リバーシ上級 16ms。将棋の初級・中級が 2〜5ms なのは序盤の定跡。→ 案A で速さは問題なし。案B(Compose Wasm)の試作は作らない。

## 段階3の進み具合(画面)
- 遊べる(画面あり): 将棋・5五将棋・リバーシ・四つ並べ・五目ならべ・ヘックス・マンカラ・ナインメンズモリス・チェッカー・チェス(10/30)。
- 画面は `web/games.js`(盤ごとの描画)+ `web/app.js`(共通の進行)。盤の情報は `Engine.kt` の `viewJson` が返す。
- 未着手(20): ドット＆ボックス・サイコロ役づくり・ヒット＆ブロー・ウサギと猟犬・チャイニーズチェッカー・ルドー・バックギャモン・碁・麻雀・道のりすごろく・花札・大富豪・7ならべ・スピード・神経衰弱・ブラックジャック・テキサスポーカー・ポーカー・Oh, No!・ソリティア。
- まだ画面にない共通機能: 1手の制限時間、降参、途中保存、効果音、成績。
