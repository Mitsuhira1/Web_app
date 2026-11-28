# チンチロリンの器・サイコロ（2026-11-27）

Firebase版の実装から撮影した参照画像。`desktop.png`・`mobile.png`は共通UIを含む全体、`bowl-detail.png`は器とサイコロの拡大。`roll.webm`は実アプリで振る動きを録画したもの（約4.8秒、無音。ゲーム本体は衝突音あり）。従来の見本は上書きしていない。

器は33度の俯瞰で描く、青い染付のある白い陶器。厚い縁・高台・湾曲した内壁と接地影を持つ。サイコロはアイボリー、1の目は赤、その他は濃い墨色。角と辺を面取りした立体で、上面・側面の明暗と目のくぼみを描く。

動きは`web/pc-firebase/js/boards/chinchiro-motion.js`、描画と再生管理は`chinchiro-table.js`。出目はゲームが決めたものを使う。通常2.65〜3.35秒の投下・衝突・転がり・静止。器とサイコロ、サイコロ同士、飛び出して卓上へ落ちた時で衝突音を変える。

再現確認:

```sh
node tools/tests/test_chinchiro_motion.cjs
node tools/tests/test_chinchiro_core.mjs
node tools/tests/check_transient_audio.cjs
```

PC/スマホ幅のChromium、CPU、途中の再描画、タブ復帰、Firebaseメモリ通信のホスト・ゲスト・途中観戦で検証。実機スマホ・本番Firebaseは未検証。
