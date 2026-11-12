# 元の Android 版との取り込み(0.5.11 時点)

元の `asobi/app/src/main/java/jp/yonekou/asobi26/core/` と `core/net/` を、Web 版の `core/src/commonMain/kotlin/jp/yonekou/asobi26/core/` に写している。
Android 版が「版」を上げたら、下の差分を残したまま取り込み直す。

## 通信の手順(Android 版 0.5.11 と同じ。Web 版が独自に決めたものはない)
- `Compat.PROTOCOL = 2`。HELLO / WELCOME / COMPAT / UNDO_* / CHAT* は `OnlineRoom.kt` のまま(Android 版の写し)。
- 規則の番号 `Compat.RULES` も同じ(全ゲーム 1)。Web 版の規則は Android 版の再生の記録(`asobi/docs/web-golden/replays.json`、30ゲーム×3つの種=90本)と全部一致したので、同じ番号を名乗る。
- 一致を確かめる: `node tools/replay_check.mjs <replays.json>`(JS を作ったあとで)。規則の番号が上がった時は、この記録も作り直されるので、必ず回す。
- 以前に私が試作で入れた `PV2` / `DENY|version` / BEGIN の末尾の番号は、Android 版の仕様と食い違うので外した。

## 元のコードから変えたところ(JS で動かすため。結果は変えない)
| ファイル | 変更 |
|---|---|
| `Game.kt` | `Budget` の時刻を `nowNanos()`(Shims.kt)に。`@Volatile` を外す |
| `Search.kt` | `OutOfTime` の `fillInStackTrace` の上書きを外す |
| `games/Checkers`・`ConnectFour`・`HareHounds`・`Mancala`・`Morris`・`Reversi` | `ThreadLocal` を Shims.kt のものに(import を足す) |
| `games/Daifugo`・`Sevens` | `bitCount` → `countOneBits()` |
| `games/HitBlow` | `Arrays.fill` → `fill`、`synchronized` を Shims.kt のものに |
| `games/Life` | `"%,d".format` → `groupDigits` |
| `games/MahjongCpu` | 向聴数の記憶を `LinkedHashMap`(使った順)から `HashMap`(8192 超で全消去)へ。結果は同じ |
| `Catalog.kt` | ゲーム名 3つ(四つ並べ・サイコロ役づくり・道のりすごろく) |
| `Compat.kt` | `cleanChat` の文字数の数え方を、JVM にしかない関数を使わない書き方に |
| `net/OnlineRoom.kt` | 席の並べ替えの `java.util.Random` → `JavaRandom`、`System.currentTimeMillis` → `currentTimeMillis()` |
| `net/InviteCodec.kt`・`RelayCrypto.kt`・`Invites.kt` | `java.util.zip`・`javax.crypto`・`Base64`・`javaClass` を、自前の `Platform.kt`(JDK と一致を試験済み)に |
| `audio/Synth.kt` | `System.arraycopy` → `copyInto` |
| 新規 | `Shims.kt`、`Platform.kt`、`NetCheck.kt`、`CrossCheck.kt` |
