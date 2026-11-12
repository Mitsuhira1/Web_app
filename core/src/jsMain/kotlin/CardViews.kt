import jp.yonekou.asobi26.core.games.*

/**
 * カードゲームの画面用の情報(JSON)。札・ボタン・点数を、ゲームごとに作る。
 * 札の type "t" は表の文字、red は赤い札、m は押した時に指す手(null = 押せない)、
 * opts は「どちらと合わせるか」のように押した後に選ぶ手、tog は押すと印が付くだけの札(ポーカーの交換)。
 */
class CCard(val t: String, val red: Boolean = false, val m: Int? = null, val back: Boolean = false, val hi: Boolean = false,
            val opts: List<Pair<String, Int>> = emptyList(), val tog: Int = -1, val empty: Boolean = false)
class CZone(val label: String, val cards: List<CCard>, val cols: Int = 0)
class CBtn(val label: String, val m: Int, val base: Boolean = false)
class CScore(val name: String, val value: String, val turn: Boolean)

private fun qs(s: String): String {
    val sb = StringBuilder("\"")
    for (c in s) when (c) { '"' -> sb.append("\\\""); '\\' -> sb.append("\\\\"); '\n' -> sb.append("\\n"); else -> sb.append(c) }
    return sb.append('"').toString()
}

fun cardsJson(info: String, zones: List<CZone>, buttons: List<CBtn>, scores: List<CScore>): String {
    val z = zones.joinToString(",", "[", "]") { zone ->
        val cs = zone.cards.joinToString(",", "[", "]") { c ->
            val o = c.opts.joinToString(",", "[", "]") { "[${qs(it.first)},${it.second}]" }
            "{\"t\":${qs(c.t)},\"red\":${c.red},\"m\":${c.m ?: "null"},\"back\":${c.back},\"hi\":${c.hi},\"opts\":$o,\"tog\":${c.tog},\"empty\":${c.empty}}"
        }
        "{\"label\":${qs(zone.label)},\"cols\":${zone.cols},\"cards\":$cs}"
    }
    val b = buttons.joinToString(",", "[", "]") { "{\"label\":${qs(it.label)},\"m\":${it.m},\"base\":${it.base}}" }
    val sc = scores.joinToString(",", "[", "]") { "{\"name\":${qs(it.name)},\"v\":${qs(it.value)},\"turn\":${it.turn}}" }
    return "{\"kind\":\"cards\",\"info\":${qs(info)},\"zones\":$z,\"buttons\":$b,\"scores\":$sc}"
}

private fun NEXT_OK(l: Set<Int>) = false
private fun cn(seat: Int, me: Int, n: Int = 0) = if (seat == me) "あなた" else if (n > 2) "CPU${seat}" else "CPU"
private val SUIT = Cards.SUITS
private fun face(c: Int) = SUIT[Cards.suit(c)] + Cards.rankLabel(c)

fun cardsView(st: Any?, rules: Any?, me: Int, legal: IntArray, human: Boolean): String? {
    val L = if (human) legal.toSet() else emptySet()
    when (st) {
        is SevensState -> {
            val zones = ArrayList<CZone>()
            for (suit in 0 until 4) zones.add(CZone(SUIT[suit], (0 until 13).map { k ->
                val c = suit * 13 + k
                if (st.onTable(c)) CCard(face(c), Cards.isRed(c)) else CCard(Cards.rankLabel(c), empty = true)
            }, 13))
            val mine = (0 until 52).filter { st.has(me, it) }
            zones.add(CZone("あなたの手札(${mine.size}枚)", mine.map { c -> CCard(face(c), Cards.isRed(c), if (c in L) c else null) }))
            val btn = if (Sevens.PASS in L) listOf(CBtn("パス(${st.passes[me]}/${Sevens.MAX_PASS}回目)", Sevens.PASS)) else emptyList()
            return cardsJson("", zones, btn, (0 until st.players).map { CScore(cn(it, me, st.players), if (st.place[it] >= 0) "${st.place[it] + 1}位" else if (st.out[it]) "失格" else "${st.count(it)}枚", st.turn == it) })
        }
        is MemoryState -> {
            val missed = st.missed?.toSet() ?: emptySet()
            val cells = st.layout.indices.map { i ->
                val up = st.taken[i] >= 0 || i == st.open1 || i in missed
                val c = st.layout[i]
                if (up) CCard(face(c), Cards.isRed(c), null, hi = i in missed) else CCard("", back = true, m = if (i in L) i else null)
            }
            val cols = if (st.layout.size > 40) 8 else 7
            return cardsJson("", listOf(CZone("", cells, cols)), emptyList(), (0 until st.players).map { CScore(cn(it, me, st.players), "${st.pairs[it]}組", st.turn == it) })
        }
        is OhNoState -> {
            val top = st.discard.lastOrNull()
            val colName = OhNo.colors.getOrElse(st.color) { "" }
            val zones = ArrayList<CZone>()
            zones.add(CZone("場(いまの色: $colName)", if (top != null) listOf(CCard(OhNo.label(top), st.color % 2 == 0)) else emptyList()))
            val hand = st.hands[me]
            zones.add(CZone("あなたの手札(${hand.size}枚)", hand.mapIndexed { i, c ->
                val plain = OhNo.PLAY + i * 4
                val direct = if (plain in L) plain else null
                val wild = OhNo.value(c) >= 13
                val opts = if (wild) (0..3).filter { OhNo.PLAY + i * 4 + it in L }.map { OhNo.colors[it] + "にする" to OhNo.PLAY + i * 4 + it } else emptyList()
                CCard(OhNo.label(c), OhNo.color(c) == 0, if (wild) null else direct, opts = opts, hi = st.drawn == i)
            }))
            val btn = ArrayList<CBtn>()
            if (st.swapping) for (p in 0 until st.hands.size) if (OhNo.SWAP + p in L) btn.add(CBtn("${cn(p, me, st.hands.size)}と交換", OhNo.SWAP + p))
            else {
                btn.add(if (st.drawn < 0) CBtn("引く", OhNo.DRAW) else CBtn("パス", OhNo.PASS))
                btn.add(CBtn("Oh, No!", OhNo.DECLARE))
            }
            return cardsJson(if (st.pending > 0) "次の人は${st.pending}枚引きます" else "", zones, btn.filter { it.m in L }.ifEmpty { btn }, st.hands.indices.map { CScore(cn(it, me, st.hands.size), "${st.hands[it].size}枚", st.turn == it) })
        }
        is HanaState -> {
            val label = { c: Int -> Hanafuda.months[c / 4] + "・" + Hanafuda.label(c).substringAfterLast('・') }
            val zones = ArrayList<CZone>()
            val oppSeat = 1 - me
            zones.add(CZone("相手の取り札(${st.captured[oppSeat].size}枚)", st.captured[oppSeat].map { CCard(label(it)) }))
            val targets = HashMap<Int, ArrayList<Pair<String, Int>>>()
            if (st.phase == 0 && human) for (m in legal) {
                val c = (m - Hanafuda.PLAY) / 64; val t = (m - Hanafuda.PLAY) % 64 - 1
                targets.getOrPut(c) { ArrayList() }.add((if (t >= 0) "${label(t)}と合わせる" else "場に出す") to m)
            }
            zones.add(CZone("場札", st.field.map { CCard(label(it)) }))
            if (st.drawn >= 0) zones.add(CZone("山から引いた札", listOf(CCard(label(st.drawn), hi = true))))
            val hand = st.hands[me]
            zones.add(CZone("あなたの手札", hand.map { c -> val o = targets[c] ?: emptyList<Pair<String, Int>>(); CCard(label(c), m = if (o.size == 1) o[0].second else null, opts = if (o.size > 1) o else emptyList()) }))
            zones.add(CZone("あなたの取り札(${st.captured[me].size}枚)", st.captured[me].map { CCard(label(it)) }))
            val btn = ArrayList<CBtn>()
            if (human) when (st.phase) {
                1 -> for (m in legal) { val t = m - Hanafuda.TAKE - 1; btn.add(CBtn(if (t >= 0) "${label(t)}を取る" else "場に出す", m)) }
                2 -> { btn.add(CBtn("こいこい", Hanafuda.KOI)); btn.add(CBtn("勝負(あがり)", Hanafuda.STOP)) }
                3 -> btn.add(CBtn("次へ", Hanafuda.NEXT))
            }
            return cardsJson("${st.round + 1}局目 " + st.result, zones, btn, (0..1).map { CScore(cn(it, me), "${st.points[it]}文", st.turn == it) })
        }
        is PokerState -> {
            val zones = ArrayList<CZone>()
            val showAll = st.result != null || st.over
            for (p in 0 until st.players) if (p != me) zones.add(CZone("${cn(p, me, st.players)}(${if (st.folded[p]) "降り" else "賭け${st.bets[p]}"})", st.hands[p].map { if (showAll && !st.folded[p]) CCard(face(it), Cards.isRed(it)) else CCard("", back = true) }))
            val discard = st.phase == 1 && human
            zones.add(CZone(if (discard) "あなたの手札(替える札を選ぶ)" else "あなたの手札", st.hands[me].mapIndexed { k, c -> CCard(face(c), Cards.isRed(c), tog = if (discard) k else -1) }))
            val btn = ArrayList<CBtn>()
            if (discard) btn.add(CBtn("交換して進む", 100, base = true))
            else {
                val toCall = st.bets.max() - st.bets[me]
                if (Poker.FOLD in L) btn.add(CBtn("降りる", Poker.FOLD))
                if (Poker.CALL in L) btn.add(CBtn(if (toCall > 0) "コール($toCall)" else "チェック", Poker.CALL))
                if (Poker.RAISE in L) btn.add(CBtn("レイズ", Poker.RAISE))
            }
            val info = "ポット ${st.pot}" + (st.result?.let { " / " + it.text } ?: "")
            return cardsJson(info, zones, btn, (0 until st.players).map { CScore(cn(it, me, st.players), "${st.chips[it]}", st.turn == it) })
        }
        is HoldemState -> {
            val zones = ArrayList<CZone>()
            val show = if (st.street == 0) 0 else if (st.street == 1) 3 else if (st.street == 2) 4 else 5
            zones.add(CZone("共通の札(ポット ${st.bets.sum() + st.invested.sum() - st.bets.sum()})", st.board.take(show).map { CCard(face(it), Cards.isRed(it)) }))
            val showdown = st.street >= 4 || st.over
            for (p in st.hands.indices) if (p != me) zones.add(CZone("${cn(p, me, st.hands.size)}(${if (p in st.folded) "降り" else "賭け${st.bets[p]}"})", st.hands[p].map { if (showdown && p !in st.folded) CCard(face(it), Cards.isRed(it)) else CCard("", back = true) }))
            zones.add(CZone("あなたの手札(賭け${st.bets[me]})", st.hands[me].map { CCard(face(it), Cards.isRed(it)) }))
            val btn = ArrayList<CBtn>()
            if (st.street == 4 || NEXT_OK(L)) { if (Holdem.NEXT in L) btn.add(CBtn("次の手へ", Holdem.NEXT)) }
            if (Holdem.NEXT !in L) {
                val call = (st.bets.max() - st.bets[me]).coerceAtLeast(0)
                if (Holdem.FOLD in L) btn.add(CBtn("降りる", Holdem.FOLD))
                if (Holdem.CALL in L) btn.add(CBtn(if (call > 0) "コール($call)" else "チェック", Holdem.CALL))
                val raises = L.filter { it >= Holdem.RAISE }.sorted()
                if (raises.isNotEmpty()) {
                    btn.add(CBtn("レイズ(${raises.first() - Holdem.RAISE})", raises.first()))
                    val big = raises.firstOrNull { it - Holdem.RAISE >= st.bets.max() * 3 } ?: raises.last()
                    if (big != raises.first()) btn.add(CBtn("レイズ(${big - Holdem.RAISE})", big))
                }
                if (Holdem.ALL_IN in L) btn.add(CBtn("オールイン", Holdem.ALL_IN))
            }
            return cardsJson("${st.round + 1}手目 " + st.lastAction + (if (st.payouts.isNotEmpty()) " 配当 " + st.payouts.joinToString("/") else ""), zones, btn, st.chips.indices.map { CScore(cn(it, me, st.chips.size), "${st.chips[it]}", st.turn == it) })
        }
        is BjState -> {
            val zones = ArrayList<CZone>()
            val res = st.result
            val dealerCards = res?.dealer ?: st.dealer
            zones.add(CZone("ディーラー", dealerCards.mapIndexed { i, c -> if (i == 1 && res == null) CCard("", back = true) else CCard(face(c), Cards.isRed(c)) }))
            for (p in 0 until st.players) st.hands[p].forEachIndexed { hi, h ->
                val label = "${cn(p, me, st.players)}の手(${h.total}${if (h.bust) " バースト" else ""}・賭け${h.bet})"
                if (p == me || res != null || true) zones.add(CZone(label, h.cards.map { CCard(face(it), Cards.isRed(it)) }))
            }
            val btn = ArrayList<CBtn>()
            for (m in legal) if (human) btn.add(CBtn(when {
                m >= Blackjack.BET -> "${m - Blackjack.BET}点を賭ける"; m == Blackjack.HIT -> "ヒット"; m == Blackjack.STAND -> "スタンド"; m == Blackjack.DOUBLE -> "ダブル"; m == Blackjack.SPLIT -> "スプリット"; else -> "$m"
            }, m))
            return cardsJson("${st.round + 1}回目" + (res?.let { " 結果 " + it.delta.joinToString("/") { d -> if (d > 0) "+$d" else "$d" } } ?: ""), zones, btn, (0 until st.players).map { CScore(cn(it, me, st.players), "${st.chips[it]}", st.turn == it) })
        }
        is DaifugoState -> {
            fun cn2(c: Int) = if (c == Daifugo.JOKER) "JK" else face(c)
            fun bits(x: Long) = (0..52).filter { (x shr it) and 1L == 1L }
            val zones = ArrayList<CZone>()
            zones.add(CZone("場" + (if (st.rev) "(革命中)" else ""), if (st.field >= 0) bits(Daifugo.decode(st.field).cards).map { CCard(cn2(it), it != Daifugo.JOKER && Cards.isRed(it)) } else emptyList()))
            zones.add(CZone("あなたの手札", bits(st.hands[me]).map { CCard(cn2(it), it != Daifugo.JOKER && Cards.isRed(it)) }))
            val btn = ArrayList<CBtn>()
            if (human) for (m in legal.take(80)) btn.add(CBtn(when {
                m == Daifugo.PASS -> "パス"; m == Daifugo.JOKER1 -> "ジョーカー"
                m in 100 until 10000 || m in 2000 until 10000 -> bits(Daifugo.decode(m).cards).joinToString(" ") { cn2(it) }
                m in Daifugo.GIVE2 until Daifugo.GIVE1 -> { val a = (m - Daifugo.GIVE2) / 64; val b = (m - Daifugo.GIVE2) % 64; "${cn2(a)}と${cn2(b)}を渡す" }
                m in Daifugo.GIVE1 until Daifugo.SEVEN -> "${cn2(m - Daifugo.GIVE1)}を渡す"
                m in Daifugo.SEVEN until Daifugo.TEN -> "7渡し ${cn2(m - Daifugo.SEVEN)}"
                m in Daifugo.TEN until Daifugo.BOMB -> "10捨て ${cn2(m - Daifugo.TEN)}"
                else -> "12ボンバー ${m - Daifugo.BOMB}"
            }, m))
            return cardsJson("${st.round + 1}回戦", zones, btn, (0 until st.players).map { CScore(cn(it, me, st.players), "${st.hands[it].countOneBits()}枚・${st.points[it]}点", st.turn == it) })
        }
    }
    return null
}
