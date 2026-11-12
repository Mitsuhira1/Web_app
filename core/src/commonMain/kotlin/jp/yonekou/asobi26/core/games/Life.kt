package jp.yonekou.asobi26.core.games

import jp.yonekou.asobi26.core.groupDigits
import jp.yonekou.asobi26.core.Brain
import jp.yonekou.asobi26.core.GameDef
import jp.yonekou.asobi26.core.Level
import jp.yonekou.asobi26.core.Outcome
import jp.yonekou.asobi26.core.Rules
import kotlin.random.Random

// ---------------- データの形(LifeData.kt が使う) ----------------

class LifeJob(val id: String, val name: String, val salary: Int, val upName: String, val upSalary: Int, val tier: Int)
class LifeTreasure(val id: String, val name: String, val value: Int, val tier: Int, val copies: Int, val special: String)
class LifeHouse(val id: String, val name: String, val price: Int, val capacity: Int)

/** 盤の1マス。種類ごとの働きは docs/life/人生すごろく-実装引き継ぎ.md の2章。 */
class LifeSquare(
    val id: Int, val x: Int, val y: Int, val row: Int, val zone: String, val type: String, val next: IntArray,
    val text: String = "", val texts: List<String>? = null, val amount: Int = 0, val amounts: IntArray? = null,
    val ticketMark: Boolean = false, val job: Int = -1, val freeterCut: Boolean = false,
    val children: Int = 0, val gift: Int = 0, val kind: String = "", val prize: Int = 0, val hit: IntArray? = null,
    val count: Int = 0, val picks: Int = 0, val price: Int = 0, val note: String = "",
) {
    /** 谷の格で変わる文面と額 */
    fun textAt(grade: Int): String = texts?.getOrNull(grade) ?: text
    fun amountAt(grade: Int): Int = amounts?.getOrNull(grade) ?: amount
    val isStop: Boolean get() = type == "stop"
    /** 通り過ぎても働くマス */
    val isRed: Boolean get() = type == "payday" || type == "house"
}

class LifeBoardData(val cols: Int, val rows: Int, val squares: List<LifeSquare>)

// ---------------- 局面 ----------------

/**
 * 1人分。職業・家・お宝の札が場にあるかは、全員の持ち物から求める(札が消えたり増えたりしない)。
 * job: 職業の番号(-1 = なし)。up: ランクアップした。freeter: フリーター。
 * house: 家の番号(-1 = なし)。cards: お宝の札の番号(Life.CARD_TYPE で種類)。
 * branch: 分かれ道で進む道(0 = 左)。finish: ゴールの着順(0 = まだ)。village: はじまりの村にいる。settled: 精算所を通った。
 */
data class LifePlayer(
    val pos: Int = 0,
    val money: Int = LifeData.startMoney,
    val loans: Int = 0,
    val job: Int = -1,
    val up: Boolean = false,
    val freeter: Boolean = false,
    val tickets: Int = 0,
    val children: Int = 0,
    val house: Int = -1,
    val cards: List<Int> = emptyList(),
    val branch: Int = 0,
    val finish: Int = 0,
    val village: Boolean = false,
    val settled: Boolean = false,
) {
    val done: Boolean get() = finish > 0 || village
}

/**
 * 局面。phase は場面(Life.P_*)。ask は場面の中の問い(Life.Q_*)。
 * remaining: 家を買うかを決める間に残っている歩数。target: 勝負の相手。
 * spins: これまでに回したルーレットの数(乱数はこの数と種からだけ決める)。
 * 画面のための記録: lastSpin(最後に出た数)・path(直前に通ったマス)・log(直前の手で起きたこと)・actor(直前の手の席)。
 */
data class LifeState(
    val seed: Long,
    val players: List<LifePlayer>,
    val turn: Int,
    val phase: Int,
    val ask: Int = 0,
    val remaining: Int = 0,
    val target: Int = -1,
    val grade: Int = 0,
    val spins: Int = 0,
    val goals: Int = 0,
    val moveSpin: Int = 0,
    val lastSpin: Int = 0,
    val path: List<Int> = emptyList(),
    val log: List<String> = emptyList(),
    val actor: Int = -1,
) {
    val over: Boolean get() = phase == Life.P_OVER
}

class Life(val n: Int, val long: Boolean) : Rules<LifeState> {
    override val playerCount = n
    val board: LifeBoardData = if (long) LONG else SHORT
    val sq: List<LifeSquare> get() = board.squares

    override fun initial(rng: Random): LifeState = LifeState(rng.nextLong(), List(n) { LifePlayer() }, 0, P_TURN)

    override fun toMove(s: LifeState): Int = if (s.over) -1 else s.turn

    // ---------------- 場の札 ----------------

    fun jobOwner(s: LifeState, j: Int): Int = s.players.indexOfFirst { it.job == j }
    fun houseCount(s: LifeState, h: Int): Int = s.players.count { it.house == h }
    fun houseFree(s: LifeState, h: Int): Boolean = houseCount(s, h) < LifeData.HOUSES[h].capacity
    fun cardOwner(s: LifeState, c: Int): Int = s.players.indexOfFirst { c in it.cards }
    fun ticketsLeft(s: LifeState): Int = LifeData.ticketPool - s.players.sumOf { it.tickets }
    fun poolCards(s: LifeState): List<Int> = (0 until CARD_COUNT).filter { cardOwner(s, it) < 0 }

    /** 引ける・選べるお宝(その時の谷の格で選べる種類。村のお宝とドッカン玉は入れない) */
    fun pickable(s: LifeState, draw: Boolean): List<Int> = poolCards(s).filter {
        val t = LifeData.TREASURES[CARD_TYPE[it]]
        t.tier <= s.grade && t.special != "village" && t.special != "dokkan" && !(draw && t.special == "dokkanReturn")
    }

    fun salary(p: LifePlayer, pip: Int): Int = when {
        p.job >= 0 -> LifeData.JOBS[p.job].let { if (p.up) it.upSalary else it.salary }
        p.freeter -> pip * LifeData.freeterSalaryPerPip
        else -> 0
    }

    fun jobName(p: LifePlayer): String = when {
        p.job >= 0 -> LifeData.JOBS[p.job].let { if (p.up) it.upName else it.name }
        p.freeter -> "フリーター"
        else -> "職業なし"
    }

    fun treasureValue(p: LifePlayer): Int =
        if (p.cards.any { LifeData.TREASURES[CARD_TYPE[it]].special == "dokkan" }) 0 else p.cards.sumOf { LifeData.TREASURES[CARD_TYPE[it]].value }

    /** 最後の計算(お金 + 家の3倍 + お宝 − 手形) */
    fun total(p: LifePlayer): Int =
        p.money + (if (p.house >= 0) LifeData.HOUSES[p.house].price * LifeData.houseSellRate else 0) + treasureValue(p) - p.loans * LifeData.loanRepayAtEnd

    /** 精算所の後か(後なら手形の返す額が変わる) */
    fun hasDokkan(p: LifePlayer): Boolean = p.cards.any { LifeData.TREASURES[CARD_TYPE[it]].special == "dokkan" }

    // ---------------- 合法手 ----------------

    override fun legalMoves(s: LifeState): IntArray {
        if (s.over) return IntArray(0)
        val p = s.players[s.turn]
        val out = ArrayList<Int>()
        when (s.phase) {
            P_TURN -> {
                if (p.finish > 0) for (k in 1..10) out.add(GUESS + k)
                else out.add(SPIN)
                if (!p.done && p.loans > 0 && p.money >= LifeData.loan) out.add(REPAY)
            }
            P_SPIN -> out.add(SPIN)
            P_YESNO -> { out.add(YES); out.add(NO) }
            P_HOUSE -> {
                for (h in LifeData.HOUSES.indices) if (houseFree(s, h)) out.add(HOUSE + h)
                out.add(NO)
            }
            P_TICKETS -> for (k in 0..minOf(2, p.tickets)) out.add(TICKETS + k)
            P_JOB -> { out.addAll(jobOptions(s, s.turn, s.ask == Q_GATE)); out.add(NO) }
            P_SEAT -> out.addAll(seatOptions(s))
            P_TREASURE -> for (c in treasureOptions(s)) out.add(CARD + c)
            P_BET -> for (a in 1..10) for (b in a + 1..10) out.add(BET + (a - 1) * 10 + (b - 1))
        }
        return out.toIntArray()
    }

    /** ランクアップ・転職・フリーターの就職で選べる手(チケットが要る) */
    fun jobOptions(s: LifeState, seat: Int, gate: Boolean): List<Int> {
        val p = s.players[seat]
        if (p.tickets < 1) return emptyList()
        val out = ArrayList<Int>()
        val free = LifeData.JOBS.indices.filter { jobOwner(s, it) < 0 }
        val tierJobs = free.filter { LifeData.JOBS[it].tier in 1..s.grade }
        val baseJobs = free.filter { LifeData.JOBS[it].tier == 0 }
        if (p.job < 0) {
            // フリーター(職業なし)の就職: はじめの職業か、その時の格の転職の札
            (baseJobs + tierJobs).sorted().forEach { out.add(JOB + it) }
            return out
        }
        val cur = LifeData.JOBS[p.job]
        if (cur.tier == 0 && !p.up && (gate || s.grade == 0)) out.add(RANKUP)
        if (gate || s.grade >= 1) {
            val change = if (tierJobs.isNotEmpty()) tierJobs else baseJobs
            change.forEach { out.add(JOB + it) }
        }
        return out
    }

    fun seatOptions(s: LifeState): List<Int> {
        val others = (0 until n).filter { it != s.turn }
        return if (s.ask == Q_TDUEL) others.filter { o -> s.players[o].cards.any { LifeData.TREASURES[CARD_TYPE[it]].special != "dokkan" } }.map { SEAT + it }
        else others.map { SEAT + it }
    }

    fun treasureOptions(s: LifeState): List<Int> = when (s.ask) {
        Q_TAKE -> s.players[s.target].cards.filter { LifeData.TREASURES[CARD_TYPE[it]].special != "dokkan" }.sorted()
        else -> pickable(s, draw = false)
    }

    // ---------------- 手を進める ----------------

    /** 手を進める時に使う、書き換えのできる作業場 */
    private inner class Work(s: LifeState) {
        val ps = s.players.toMutableList()
        var turn = s.turn
        var phase = s.phase
        var ask = s.ask
        var remaining = s.remaining
        var target = s.target
        var grade = s.grade
        var spins = s.spins
        var goals = s.goals
        var moveSpin = s.moveSpin
        var lastSpin = s.lastSpin
        val seed = s.seed
        val path = ArrayList<Int>()
        val log = ArrayList<String>()
        val me: Int = s.turn

        fun state(): LifeState = LifeState(seed, ps.toList(), turn, phase, ask, remaining, target, grade, spins, goals, moveSpin, lastSpin, path.toList(), log.toList(), me)

        fun spin(): Int {
            val r = Random(seed * 131 + spins * 104_729L + 7).nextInt(1, 11)
            spins++
            lastSpin = r
            return r
        }

        /** 乱数で 0 until size から1つ(お宝の山を引く時) */
        fun draw(size: Int): Int {
            val r = Random(seed * 131 + spins * 104_729L + 7).nextInt(size)
            spins++
            return r
        }

        /** 席の名前は画面で入れる([k] を k 番の席の名前に置きかえる) */
        fun name(i: Int) = "[$i]"
        fun p(i: Int = me) = ps[i]
        fun set(i: Int, f: (LifePlayer) -> LifePlayer) { ps[i] = f(ps[i]) }

        fun gain(i: Int, amt: Int) { if (amt > 0) set(i) { it.copy(money = it.money + amt) } }

        /** はらう。足りなければ自動で手形を出して借りる */
        fun pay(i: Int, amt: Int) {
            if (amt <= 0) return
            var q = p(i)
            var loans = q.loans
            var money = q.money
            while (money < amt) { money += LifeData.loan; loans++ }
            if (loans > q.loans) log.add("${name(i)}は手形を${loans - q.loans}枚出して借りた")
            q = q.copy(money = money - amt, loans = loans)
            ps[i] = q
        }

        fun transfer(from: Int, to: Int, amt: Int) { pay(from, amt); gain(to, amt) }

        fun gainTicket(i: Int, k: Int = 1) {
            var got = 0
            repeat(k) {
                val left = LifeData.ticketPool - ps.sumOf { it.tickets }
                if (p(i).tickets < LifeData.ticketMax && left > 0) { set(i) { it.copy(tickets = it.tickets + 1) }; got++ }
            }
            if (got > 0) log.add("ゆめチケットを${got}枚もらう")
        }

        fun giveCard(i: Int, c: Int) {
            for (o in ps.indices) if (c in ps[o].cards) set(o) { it.copy(cards = it.cards - c) }
            set(i) { it.copy(cards = it.cards + c) }
        }

        fun endTurn() {
            if (ps.all { it.done }) { phase = P_OVER; ask = 0; return }
            turn = (turn + 1) % n
            phase = P_TURN; ask = 0; remaining = 0; target = -1
        }

        fun paySalary(times: Int = 1) {
            val amt = salary(p(), moveSpin) * times
            if (amt > 0) { gain(me, amt); log.add("給料 $${fmt(amt)}") }
        }

        /** 歩く。止まるか、途中の家のマスで選ぶことがあれば止める */
        fun walk(steps0: Int) {
            var steps = steps0
            while (steps > 0) {
                val cur = sq[p().pos]
                if (cur.next.isEmpty()) break
                val nx = if (cur.next.size > 1) cur.next[p().branch.coerceIn(0, cur.next.size - 1)] else cur.next[0]
                set(me) { it.copy(pos = nx) }
                path.add(nx)
                steps--
                val t = sq[nx]
                if (t.type == "goal" || t.isStop) { steps = 0; break }
                if (steps > 0 && t.isRed) {
                    if (t.type == "payday") payday(t)
                    else if (t.type == "house" && canBuyHouse()) {
                        remaining = steps; phase = P_HOUSE; ask = Q_HOUSE
                        return
                    }
                }
            }
            remaining = 0
            land()
        }

        fun payday(t: LifeSquare) {
            if (t.freeterCut && p().job < 0 && !p().freeter) { set(me) { it.copy(freeter = true) }; log.add("職業がないのでフリーターになる") }
            paySalary()
        }

        fun canBuyHouse(): Boolean = p().house < 0 && LifeData.HOUSES.indices.any { h -> ps.count { it.house == h } < LifeData.HOUSES[h].capacity }

        /** 止まったマスの指示 */
        fun land() {
            val t = sq[p().pos]
            if (t.ticketMark) gainTicket(me)
            when (t.type) {
                "money" -> {
                    val a = t.amountAt(grade)
                    if (a >= 0) { gain(me, a); log.add("$${fmt(a)} もらう"); endTurn() }
                    else if (p().tickets > 0) { phase = P_YESNO; ask = Q_TICKET }
                    else { pay(me, -a); log.add("$${fmt(-a)} はらう"); endTurn() }
                }
                "giveAll" -> { for (o in ps.indices) if (o != me) transfer(me, o, t.amount); log.add("全員に $${fmt(t.amount)} ずつくばる"); endTurn() }
                "giveRight" -> { val o = (me + 1) % n; transfer(me, o, t.amount); log.add("${name(o)}に $${fmt(t.amount)} あげる"); endTurn() }
                "job" -> if (p().job < 0 && t.job >= 0 && ps.none { it.job == t.job }) { phase = P_YESNO; ask = Q_JOB } else endTurn()
                "payday" -> { payday(t); endTurn() }
                "house" -> if (canBuyHouse()) { phase = P_HOUSE; ask = Q_HOUSE } else endTurn()
                "ticket" -> { gainTicket(me); endTurn() }
                "child" -> {
                    set(me) { it.copy(children = it.children + t.children) }
                    log.add("子どもが${t.children}人ふえる")
                    for (o in ps.indices) if (o != me) transfer(o, me, t.gift)
                    endTurn()
                }
                "treasure" -> { drawTreasure(); endTurn() }
                "treasureBuy" -> if (pickable(state(), true).isNotEmpty()) { phase = P_YESNO; ask = Q_BUY } else endTurn()
                "treasurePick" -> if (pickable(state(), false).isNotEmpty()) { phase = P_TREASURE; ask = Q_PICK } else endTurn()
                "gamble" -> when (t.kind) {
                    "lottery" -> { phase = P_SPIN; ask = Q_LOTTERY }
                    "duel" -> { phase = P_SEAT; ask = Q_DUEL }
                    "treasureDuel" -> {
                        ask = Q_TDUEL
                        if (seatOptions(state().copy(ask = Q_TDUEL)).isNotEmpty()) phase = P_SEAT
                        else if (pickable(state(), false).isNotEmpty()) { log.add("お宝を持つ相手がいないので、場から1つ選ぶ"); phase = P_TREASURE; ask = Q_PICK }
                        else endTurn()
                    }
                    "numberBet" -> { phase = P_BET; ask = Q_BET }
                    else -> endTurn()
                }
                "hap" -> when (t.kind) {
                    "swapHouse" -> if (swapTarget() >= 0) { phase = P_YESNO; ask = Q_SWAP } else { log.add("取りかえる家がない"); endTurn() }
                    "loseTickets" -> { val k = minOf(t.count, p().tickets); set(me) { it.copy(tickets = it.tickets - k) }; log.add("ゆめチケットを${k}枚もどす"); endTurn() }
                    "gainTickets" -> { gainTicket(me, t.count); endTurn() }
                    "getDokkan" -> {
                        val c = DOKKAN_CARD
                        if (ps.none { c in it.cards }) { giveCard(me, c); log.add("ドッカン玉を受け取る") } else log.add("ドッカン玉はもう場にない")
                        endTurn()
                    }
                    else -> endTurn()
                }
                "bonus" -> { paySalary(LifeData.bonusSalaryTimes); endTurn() }
                "rank" -> if (jobOptions(state(), me, false).isNotEmpty()) { phase = P_JOB; ask = Q_RANK } else endTurn()
                "dokkanReturn" -> {
                    if (ps.none { ISHI_CARD in it.cards }) { giveCard(me, ISHI_CARD); log.add("ひかる石ころをもらう") }
                    if (hasDokkan(p())) { phase = P_YESNO; ask = Q_RETURN } else endTurn()
                }
                "dokkanPass" -> if (hasDokkan(p())) { phase = P_YESNO; ask = Q_PASS } else endTurn()
                "stop" -> when (t.kind) {
                    "marriage" -> { phase = P_SPIN; ask = Q_MARRIAGE }
                    "valley" -> { phase = P_TICKETS; ask = Q_VALLEY }
                    "gate" -> if (jobOptions(state(), me, true).isNotEmpty()) { phase = P_JOB; ask = Q_GATE } else endTurn()
                    "settle" -> { settle(); endTurn() }
                    else -> endTurn()
                }
                "goal" -> {
                    goals++
                    set(me) { it.copy(finish = goals) }
                    log.add("${goals}番目にゴール!")
                    if (pickable(state(), false).isNotEmpty()) { phase = P_TREASURE; ask = Q_GOAL } else endTurn()
                }
                else -> endTurn()
            }
        }

        fun drawTreasure() {
            val deck = pickable(state(), true)
            if (deck.isEmpty()) { log.add("お宝の山がない"); return }
            val c = deck[draw(deck.size)]
            giveCard(me, c)
            log.add("お宝「${LifeData.TREASURES[CARD_TYPE[c]].name}」をもらう")
        }

        /** いちばん高い家を持つ相手(自分の家より高い時だけ) */
        fun swapTarget(): Int {
            val mine = p().house
            if (mine < 0) return -1
            var best = -1
            for (o in ps.indices) if (o != me && ps[o].house >= 0 && LifeData.HOUSES[ps[o].house].price > LifeData.HOUSES[mine].price) {
                if (best < 0 || LifeData.HOUSES[ps[o].house].price > LifeData.HOUSES[ps[best].house].price) best = o
            }
            return best
        }

        fun settle() {
            val kids = p().children * LifeData.childBonus
            if (kids > 0) { gain(me, kids); log.add("子ども${p().children}人で $${fmt(kids)} もらう") }
            val need = p().loans * LifeData.loanRepayAtSettle
            if (need > 0 && p().money < need && p().house >= 0) {
                val h = LifeData.HOUSES[p().house]
                gain(me, h.price * LifeData.forcedSellRate); set(me) { it.copy(house = -1) }
                log.add("${h.name}を $${fmt(h.price * LifeData.forcedSellRate)} で売る")
            }
            if (need > 0 && p().money < need) {
                for (c in p().cards.sortedBy { LifeData.TREASURES[CARD_TYPE[it]].value }) {
                    if (p().money >= need) break
                    val t = LifeData.TREASURES[CARD_TYPE[c]]
                    if (t.value <= 0) continue
                    set(me) { it.copy(money = it.money + t.value * LifeData.forcedSellRate, cards = it.cards - c) }
                    log.add("お宝「${t.name}」を $${fmt(t.value * LifeData.forcedSellRate)} で売る")
                }
            }
            if (p().money >= need) {
                if (need > 0) log.add("手形${p().loans}枚を $${fmt(need)} で返す")
                set(me) { it.copy(money = it.money - need, loans = 0, settled = true) }
            } else {
                set(me) { it.copy(money = 0, loans = 0, house = -1, cards = emptyList(), tickets = 0, village = true, settled = true) }
                log.add("返しきれないので、持ち物を場にもどして「はじまりの村」へ")
            }
        }

        fun duelSpins(o: Int): Boolean {
            while (true) {
                val a = spin(); val b = spin()
                log.add("${name(me)}は $a、${name(o)}は $b")
                if (a != b) { lastSpin = a; return a > b }
            }
        }
    }

    override fun play(s: LifeState, m: Int): LifeState {
        val w = Work(s)
        val me = s.turn
        val t = sq[s.players[me].pos]
        when (s.phase) {
            P_TURN -> when {
                m == REPAY -> {
                    w.set(me) { it.copy(money = it.money - LifeData.loan, loans = it.loans - 1) }
                    w.log.add("手形を1枚 $${fmt(LifeData.loan)} で返す")
                }
                m in GUESS + 1..GUESS + 10 -> {
                    val r = w.spin()
                    if (r == m - GUESS) { w.gain(me, LifeData.goalGuessPrize); w.log.add("${m - GUESS}が当たった! $${fmt(LifeData.goalGuessPrize)} もらう") }
                    else w.log.add("${m - GUESS}を予想、出たのは $r")
                    w.endTurn()
                }
                s.players[me].village -> {
                    val r = w.spin()
                    if (r == LifeData.villageHit) {
                        val holder = s.players.indexOfFirst { NEBUKURO_CARD in it.cards }
                        if (holder == me) { w.gain(me, LifeData.villagePrize); w.log.add("$r! $${fmt(LifeData.villagePrize)} もらう") }
                        else { w.giveCard(me, NEBUKURO_CARD); w.log.add("$r! ふしぎな寝ぶくろをもらう") }
                    } else w.log.add("出たのは $r")
                    w.endTurn()
                }
                else -> {
                    val r = w.spin()
                    w.moveSpin = r
                    w.log.add("$r 進む")
                    w.walk(r)
                }
            }
            P_SPIN -> {
                val r = w.spin()
                when (s.ask) {
                    Q_MARRIAGE -> {
                        val gift = r * LifeData.marriageGiftPerPip
                        for (o in 0 until n) if (o != me) w.transfer(o, me, gift)
                        val left = r <= LifeData.forkLeftMax
                        w.set(me) { it.copy(branch = if (left) 0 else 1) }
                        w.log.add("$r! 全員から $${fmt(gift)} ずつお祝い。${if (left) "近場コース" else "世界コース"}へ")
                    }
                    Q_VALLEY_COURSE -> {
                        val left = r <= LifeData.forkLeftMax
                        w.set(me) { it.copy(branch = if (left) 0 else 1) }
                        w.log.add("$r! ${if (left) "お金コース" else "お宝コース"}へ")
                    }
                    Q_LOTTERY -> {
                        if (t.hit?.contains(r) == true) { w.gain(me, t.prize); w.log.add("$r! 当たり! $${fmt(t.prize)} もらう") }
                        else w.log.add("$r 外れ")
                    }
                }
                w.endTurn()
            }
            P_YESNO -> {
                val yes = m == YES
                when (s.ask) {
                    Q_TICKET -> {
                        val a = -t.amountAt(s.grade)
                        if (yes) { w.set(me) { it.copy(tickets = it.tickets - 1) }; w.gain(me, a); w.log.add("ゆめチケットで「もらう」に変えて $${fmt(a)} もらう") }
                        else { w.pay(me, a); w.log.add("$${fmt(a)} はらう") }
                    }
                    Q_JOB -> if (yes) { w.set(me) { it.copy(job = t.job, freeter = false) }; w.log.add("${LifeData.JOBS[t.job].name}になる") }
                    Q_BUY -> if (yes) { w.pay(me, t.price); w.drawTreasure() }
                    Q_SWAP -> if (yes) {
                        val o = w.swapTarget()
                        val mine = w.p().house
                        val theirs = w.p(o).house
                        w.set(me) { it.copy(house = theirs) }; w.set(o) { it.copy(house = mine) }
                        w.log.add("${w.name(o)}と家を取りかえる")
                    }
                    Q_RETURN -> if (yes) { w.set(me) { it.copy(cards = it.cards - DOKKAN_CARD) }; w.log.add("ドッカン玉を場にもどす") }
                    Q_PASS -> if (yes) { val o = (me + 1) % n; w.giveCard(o, DOKKAN_CARD); w.log.add("ドッカン玉を${w.name(o)}に渡す") }
                }
                w.endTurn()
            }
            P_HOUSE -> {
                if (m != NO) {
                    val h = LifeData.HOUSES[m - HOUSE]
                    w.pay(me, h.price)
                    w.set(me) { it.copy(house = m - HOUSE) }
                    w.log.add("${h.name}を $${fmt(h.price)} で買う")
                }
                val rest = s.remaining
                w.phase = P_TURN
                if (rest > 0) w.walk(rest) else w.endTurn()
            }
            P_TICKETS -> {
                val k = m - TICKETS
                if (k > 0) {
                    w.set(me) { it.copy(tickets = it.tickets - k) }
                    val g = maxOf(s.grade, k)
                    if (g != s.grade) w.log.add("ゆめの谷が${LifeData.GRADES[g]}になる") else w.log.add("ゆめチケットを${k}枚使う")
                    w.grade = g
                }
                w.phase = P_SPIN; w.ask = Q_VALLEY_COURSE
            }
            P_JOB -> {
                if (m == RANKUP) {
                    w.set(me) { it.copy(tickets = it.tickets - 1, up = true) }
                    w.log.add("ランクアップ! ${jobName(w.p())}になる")
                } else if (m in JOB until JOB + LifeData.JOBS.size) {
                    w.set(me) { it.copy(tickets = it.tickets - 1, job = m - JOB, up = false, freeter = false) }
                    w.log.add("${LifeData.JOBS[m - JOB].name}になる")
                }
                w.endTurn()
            }
            P_SEAT -> {
                val o = m - SEAT
                if (s.ask == Q_DUEL) {
                    val win = w.duelSpins(o)
                    val winner = if (win) me else o
                    w.gain(winner, t.prize)
                    w.log.add("${w.name(winner)}の勝ち! $${fmt(t.prize)} もらう")
                    w.endTurn()
                } else {
                    val win = w.duelSpins(o)
                    if (win) { w.log.add("勝った! ${w.name(o)}のお宝を1つ選ぶ"); w.target = o; w.phase = P_TREASURE; w.ask = Q_TAKE }
                    else { w.log.add("負けた"); w.endTurn() }
                }
            }
            P_TREASURE -> {
                val c = m - CARD
                w.giveCard(me, c)
                w.log.add("お宝「${LifeData.TREASURES[CARD_TYPE[c]].name}」をもらう")
                w.endTurn()
            }
            P_BET -> {
                val a = (m - BET) / 10 + 1
                val b = (m - BET) % 10 + 1
                val r = w.spin()
                if (r == a || r == b) { w.gain(me, t.prize); w.log.add("$a と $b を予想。$r! 当たり! $${fmt(t.prize)} もらう") }
                else w.log.add("$a と $b を予想。出たのは $r")
                w.endTurn()
            }
        }
        return w.state()
    }

    override fun outcome(s: LifeState): Outcome? {
        if (!s.over) return null
        val order = ranking(s)
        return Outcome(order[0], "")
    }

    /** 順位(お金の多い順。同じならゴールの早い人、村の人はあと) */
    fun ranking(s: LifeState): List<Int> = (0 until n).sortedWith(
        compareByDescending<Int> { total(s.players[it]) }.thenBy { if (s.players[it].finish > 0) s.players[it].finish else 100 }.thenBy { it },
    )

    override fun scores(s: LifeState): IntArray = IntArray(n) { total(s.players[it]) }

    companion object {
        // 場面
        const val P_TURN = 0
        const val P_SPIN = 1
        const val P_YESNO = 2
        const val P_HOUSE = 3
        const val P_TICKETS = 4
        const val P_JOB = 5
        const val P_SEAT = 6
        const val P_TREASURE = 7
        const val P_BET = 8
        const val P_OVER = 9

        // 問い
        const val Q_MARRIAGE = 1
        const val Q_VALLEY = 2
        const val Q_VALLEY_COURSE = 3
        const val Q_LOTTERY = 4
        const val Q_TICKET = 5
        const val Q_JOB = 6
        const val Q_BUY = 7
        const val Q_SWAP = 8
        const val Q_RETURN = 9
        const val Q_PASS = 10
        const val Q_HOUSE = 11
        const val Q_RANK = 12
        const val Q_GATE = 13
        const val Q_DUEL = 14
        const val Q_TDUEL = 15
        const val Q_TAKE = 16
        const val Q_PICK = 17
        const val Q_GOAL = 18
        const val Q_BET = 19

        // 手
        const val SPIN = 0
        const val YES = 1
        const val NO = 2
        const val REPAY = 3
        const val RANKUP = 5
        const val SEAT = 10
        const val JOB = 20
        const val TICKETS = 40
        const val CARD = 50
        const val HOUSE = 100
        const val GUESS = 200
        const val BET = 300

        val SHORT: LifeBoardData by lazy { LifeData.shortBoard() }
        val LONG: LifeBoardData by lazy { LifeData.longBoard() }

        /** お宝の札(40枚)→ 種類 */
        val CARD_TYPE: IntArray = LifeData.TREASURES.flatMapIndexed { i, t -> List(t.copies) { i } }.toIntArray()
        val CARD_COUNT: Int = CARD_TYPE.size
        val DOKKAN_CARD: Int = CARD_TYPE.indexOfFirst { LifeData.TREASURES[it].special == "dokkan" }
        val ISHI_CARD: Int = CARD_TYPE.indexOfFirst { LifeData.TREASURES[it].special == "dokkanReturn" }
        val NEBUKURO_CARD: Int = CARD_TYPE.indexOfFirst { LifeData.TREASURES[it].special == "village" }

        fun fmt(v: Int): String = groupDigits(v)

        val brain = Brain<LifeState> { rules, s, seat, level, rng, _ -> LifeCpu.choose(rules as Life, s, seat, level, rng) }

        val def = GameDef(
            "life",
            { Life(it.int("players", 4).coerceIn(2, 6), it.str("length", "short") == "long") },
            brain,
            undoAllowed = false,
            seatsFor = { it.int("players", 4).coerceIn(2, 6) },
        )
    }
}

/**
 * CPU。見えている盤と持ち物だけで決める(この先のルーレットの数は読まない)。
 * 初級: 適当(回せる時は回す)。中級: 素直に得をする手。上級: 中級に加えて、チケットの使い道・手形・お宝の値打ちを考える。
 */
object LifeCpu {
    fun choose(g: Life, s: LifeState, seat: Int, level: Level, rng: Random): Int {
        val legal = g.legalMoves(s)
        if (legal.size == 1) return legal[0]
        val p = s.players[seat]
        if (level == Level.EASY) {
            if (Life.SPIN in legal) return Life.SPIN
            return legal[rng.nextInt(legal.size)]
        }
        val hard = level == Level.HARD
        val t = g.sq[p.pos]
        return when (s.phase) {
            Life.P_TURN -> {
                if (p.finish > 0) return legal.filter { it >= Life.GUESS }.let { it[rng.nextInt(it.size)] }
                // 手形: 中級はお金に余裕がある時、上級は精算所の前なら返せるだけ返す(25,000 より 20,000 で返す方が得)
                val margin = if (hard && !p.settled) 0 else 30_000
                if (Life.REPAY in legal && p.money >= LifeData.loan + margin) Life.REPAY else Life.SPIN
            }
            Life.P_YESNO -> when (s.ask) {
                Life.Q_TICKET -> {
                    val a = -t.amountAt(s.grade)
                    val keep = if (hard) wantTickets(g, s, seat) else 0
                    if (a >= 8000 && (p.tickets > keep || a >= 30_000)) Life.YES else Life.NO
                }
                Life.Q_BUY -> if (hard || p.money >= t.price) Life.YES else Life.NO
                else -> Life.YES
            }
            Life.P_HOUSE -> {
                val houses = legal.filter { it != Life.NO }
                if (houses.isEmpty()) return Life.NO
                if (hard) houses.maxBy { LifeData.HOUSES[it - Life.HOUSE].price }
                else houses.filter { LifeData.HOUSES[it - Life.HOUSE].price <= p.money + 40_000 }.maxByOrNull { LifeData.HOUSES[it - Life.HOUSE].price }
                    ?: houses.minBy { LifeData.HOUSES[it - Life.HOUSE].price }
            }
            Life.P_TICKETS -> {
                val most = legal.maxOf { it } - Life.TICKETS
                val use = if (hard) {
                    // ランクアップ・転職の分を1枚残す。格を上げても下がらないので、上がらない枚数は使わない
                    val spare = p.tickets - 1
                    val want = if (spare >= 2) 2 else if (spare == 1) 1 else 0
                    if (want <= s.grade) 0 else want
                } else if (p.tickets >= 3) 1 else 0
                Life.TICKETS + minOf(use, most)
            }
            Life.P_JOB -> {
                val cur = g.salary(p, 5)
                val best = legal.filter { it != Life.NO }.maxByOrNull { m -> jobSalary(p, m) } ?: return Life.NO
                if (jobSalary(p, best) > cur) best else Life.NO
            }
            Life.P_SEAT -> {
                val seats = legal.toList()
                if (s.ask == Life.Q_TDUEL && hard) seats.maxBy { o -> s.players[o - Life.SEAT].cards.maxOf { LifeData.TREASURES[Life.CARD_TYPE[it]].value } }
                else if (hard) seats.maxBy { o -> g.total(s.players[o - Life.SEAT]) }
                else seats[rng.nextInt(seats.size)]
            }
            Life.P_TREASURE -> legal.maxBy { LifeData.TREASURES[Life.CARD_TYPE[it - Life.CARD]].value * 100 - it }
            else -> legal[rng.nextInt(legal.size)]
        }
    }

    private fun jobSalary(p: LifePlayer, m: Int): Int = when {
        m == Life.RANKUP -> LifeData.JOBS[p.job].upSalary
        m >= Life.JOB -> LifeData.JOBS[m - Life.JOB].salary
        else -> 0
    }

    /** 上級: この先のランクアップ・転職のために残したいチケットの数 */
    private fun wantTickets(g: Life, s: LifeState, seat: Int): Int {
        val p = s.players[seat]
        val zone = g.sq[p.pos].zone
        return if (zone == "town" || zone == "near" || zone == "world" || zone == "field" || zone.startsWith("valley")) 1 else 0
    }
}
