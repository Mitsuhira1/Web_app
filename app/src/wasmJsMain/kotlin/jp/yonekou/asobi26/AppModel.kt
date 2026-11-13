package jp.yonekou.asobi26

import jp.yonekou.asobi26.web.*

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.foundation.lazy.grid.LazyGridState
import jp.yonekou.asobi26.core.Budget
import jp.yonekou.asobi26.core.Catalog
import jp.yonekou.asobi26.core.GameDef
import jp.yonekou.asobi26.core.GameInfo
import jp.yonekou.asobi26.core.GameOptions
import jp.yonekou.asobi26.core.Level
import jp.yonekou.asobi26.core.MatchRecord
import jp.yonekou.asobi26.core.Seat
import jp.yonekou.asobi26.core.Session
import jp.yonekou.asobi26.core.ConcurrentRules
import jp.yonekou.asobi26.core.games.*
import jp.yonekou.asobi26.audio.Sfx
import jp.yonekou.asobi26.data.Prefs
import kotlin.random.Random

/** 画面 */
sealed class Screen {
    /** ホーム(下のタブで ゲーム / みんなで遊ぶ / 成績 を切り替える) */
    data object Home : Screen()
    data class Detail(val gameId: String) : Screen()
    data class Rules(val gameId: String) : Screen()
    data object Play : Screen()
    data object Settings : Screen()
    /** 通信対戦の部屋(名簿・ゲームを選ぶ・招待コード) */
    data object Lobby : Screen()
    data object RoomSettings : Screen()
    /** 部屋に参加する(近くの部屋を探す・招待コードを貼る) */
    data object Join : Screen()
}

/**
 * 画面の状態と対局の進行をまとめる。メインスレッドだけで使う。
 * CPU の思考は専用スレッド1本で行い、結果はメインスレッドで「その時の局面のまま」なら適用する。
 */
class AppModel(app: Application) : AndroidViewModel(app) {
    /** ゲームの一覧のスクロール位置(ゲームから戻った時に、前の位置から始める) */
    val homeGrid = LazyGridState()
    private val prefs = Prefs(app)
    private val main = Handler(Looper.getMainLooper())
    private val cpuThread = Executors.newSingleThreadExecutor { r ->
        Thread({ Process.setThreadPriority(Process.THREAD_PRIORITY_BACKGROUND); r.run() }, "cpu").apply { isDaemon = true }
    }

    val reviewMove: Int? get()=when(val state=session?.state){
        is MahjongState->if(state.phase==2)Mahjong.NEXT else null
        is HoldemState->if(state.street==4&&!state.over)Holdem.NEXT else null
        is HanaState->if(state.phase==3&&!state.over)Hanafuda.NEXT else null
        else->null
    }
    val canAdvanceRound: Boolean get()=reviewMove!=null&&(!onlineGame||room?.isHost==true)

    var clockRemaining by mutableIntStateOf(-1)
        private set
    /** 時間が切れた合図(「時間切れ」の演出に使う)。seat = 切れた人の席、lose = その人の負けになった */
    class TimeUp(val seq: Int, val seat: Int, val lose: Boolean)
    var timeUp by mutableStateOf<TimeUp?>(null)
        private set
    private fun markTimeUp(ses: Session<*>, seat: Int) {
        timeUp = TimeUp((timeUp?.seq ?: 0) + 1, seat, ses.options.str("timeoutRule", "move") == "lose" && ses.seats.size == 2 && (!onlineGame || room?.supports(jp.yonekou.asobi26.core.Compat.TIMEOUT_LOSE) != false))
    }
    private var clockGeneration = 0
    private var clockTask: Runnable? = null
    private fun cancelTurnClock() {
        clockGeneration++; clockTask?.let { main.removeCallbacks(it) }; clockTask = null; clockRemaining = -1
    }
    private fun scheduleTurnClock() {
        cancelTurnClock()
        val ses = session ?: return
        val seconds = ses.options.int("moveSeconds", 0).takeIf { it in listOf(15, 30, 60, 120) } ?: return
        if (ses.outcome != null || reviewMove!=null) return
        if(ses.rules is ConcurrentRules<*>){scheduleConcurrentClock(ses,seconds);return}
        clockRemaining = seconds
        if (onlineGame && room?.isHost != true) return // 参加者はホストの残り時間を表示するだけ
        val generation = clockGeneration
        val version = ses.version
        var deadline = 0L
        var published = -1
        val task = object : Runnable {
            override fun run() {
                if (generation != clockGeneration || session !== ses || ses.version != version || ses.outcome != null) return
                if (handover || animating || ses.isCpuTurn || remoteQueue.isNotEmpty()) { main.postDelayed(this, 250); return }
                // 「待った」の返事を集めている間は、時計を止める
                if (room?.undoVote != null) { if (deadline != 0L) deadline += 250; main.postDelayed(this, 250); return }
                if (deadline == 0L) deadline = SystemClock.elapsedRealtime() + seconds * 1000L
                val left = ((deadline - SystemClock.elapsedRealtime() + 999) / 1000).toInt().coerceAtLeast(0)
                clockRemaining = left
                if (onlineGame && left != published) { room?.shareClock(ses.moves.size, left); published = left }
                if (left > 0) { main.postDelayed(this, 250); return }
                @Suppress("UNCHECKED_CAST") val typed = ses as Session<Any?>
                val timeoutState = typed.state; val timeoutSeat = typed.toMove; val timeoutIndex = typed.moves.size
                // 設定が「負け」で2人のゲームなら、時間切れの人の負け。それ以外は合法な手を1つ進める
                // 古い版の人がいる通信対戦では、時間切れの「負け」の手が通じないので、ランダムな一手にする
                val lose = ses.options.str("timeoutRule", "move") == "lose" && ses.seats.size == 2 && (!onlineGame || room?.supports(jp.yonekou.asobi26.core.Compat.TIMEOUT_LOSE) != false)
                markTimeUp(ses, timeoutSeat)
                cpuThread.execute {
                    val move = if (lose) Session.timeoutMove(timeoutSeat) else jp.yonekou.asobi26.core.TimeoutPolicy.choose(typed, timeoutState, timeoutSeat, timeoutIndex)
                    main.post {
                        if (generation != clockGeneration || session !== ses || ses.version != version || ses.outcome != null) return@post
                        val index = ses.moves.size
                        if (ses.submit(move)) {
                            if (onlineGame) room?.share(index, move)
                            if (lose) { stopThinking(); resetAnimation() } else markPending(ses)
                            tick++; afterChange()
                        }
                    }
                }
            }
        }
        clockTask = task; main.post(task)
    }

    private var simultaneousClockSession: Session<*>? = null
    private var simultaneousDeadlines = LongArray(0)
    private var simultaneousClockMoves = 0
    private fun scheduleConcurrentClock(ses: Session<*>, seconds: Int) {
        val now=SystemClock.elapsedRealtime()
        if(simultaneousClockSession !== ses) {
            simultaneousClockSession=ses;simultaneousDeadlines=LongArray(ses.seats.size){now+seconds*1000L};simultaneousClockMoves=ses.moves.size
        } else if(ses.moves.size>simultaneousClockMoves) {
            val rules=ses.rules as ConcurrentRules<*>
            for(m in ses.moves.drop(simultaneousClockMoves))rules.actor(m).takeIf{it in simultaneousDeadlines.indices}?.let{simultaneousDeadlines[it]=now+seconds*1000L}
            simultaneousClockMoves=ses.moves.size
        }
        val mine=ses.seats.indexOfFirst{it.human}.coerceAtLeast(0)
        clockRemaining=((simultaneousDeadlines[mine]-now+999)/1000).toInt().coerceAtLeast(0)
        if(onlineGame && room?.isHost != true)return
        val generation=clockGeneration
        val published=IntArray(ses.seats.size){-1}
        val task=object:Runnable{
            override fun run(){
                if(generation!=clockGeneration||session !== ses||ses.outcome!=null)return
                @Suppress("UNCHECKED_CAST") val typed=ses as Session<Any?>
                val rules=typed.rules as ConcurrentRules<Any?>
                for(p in ses.seats.indices.filter{ses.seats[it].human||ses.seats[it].remote}){
                    val legal=rules.legalMovesFor(typed.state,p)
                    if(legal.isEmpty()){simultaneousDeadlines[p]=SystemClock.elapsedRealtime()+seconds*1000L;continue}
                    val left=((simultaneousDeadlines[p]-SystemClock.elapsedRealtime()+999)/1000).toInt().coerceAtLeast(0)
                    if(p==mine)clockRemaining=left
                    if(onlineGame&&published[p]!=left){room?.shareSeatClock(ses.moves.size,p,left);published[p]=left}
                    if(left==0){
                        var move=typed.def.brain.choose(rules,typed.state,p,Level.NORMAL,Random.Default,Budget(80))
                        if(ses.def.id=="solitaire"&&move%1_000_000==1)move=legal.firstOrNull{it%1_000_000!=1}?:move
                        if(move in legal){val index=ses.moves.size
                            if(ses.submit(move)){if(onlineGame)room?.share(index,move);tick++;afterChange();return}
                        }
                    }
                }
                main.postDelayed(this,250)
            }
        }
        clockTask=task;main.post(task)
    }

    var yachtSelectionIndex by mutableIntStateOf(-1)
        private set
    var yachtSelection by mutableIntStateOf(0)
        private set
    fun selectYachtDice(mask: Int) {
        val ses = session ?: return
        if (!ses.isHumanTurn || ses.def.id != "yacht" || mask !in 0..31 || animating || handover || ses.outcome != null) return
        yachtSelectionIndex = ses.moves.size; yachtSelection = mask
        if (onlineGame) room?.selectDice(ses.moves.size, mask)
    }

    fun resign() {
        val ses = session ?: return
        if (!ses.canResign || ses.outcome != null || handover) return
        val seat = if (localPass) ses.toMove else ses.seats.indexOfFirst { it.human }
        if (seat !in ses.seats.indices || !ses.seats[seat].human) return
        val move = Session.resignMove(seat)
        if (onlineGame && room?.isHost == false) {
            room?.requestResign()
        } else {
            val index = ses.moves.size
            if (ses.submit(move)) {
                stopThinking(); resetAnimation()
                if (onlineGame) room?.share(index, move)
                tick++; afterChange()
            }
        }
    }

    // ---- 設定 ----
    var themeMode by mutableIntStateOf(prefs.themeMode)
        private set
    var showHints by mutableStateOf(prefs.showHints)
        private set
    var tapSound by mutableStateOf(prefs.tapSound)
        private set
    /** CPU の手番の長さ 0=短め 1=普通 2=長め */
    var cpuPace by mutableIntStateOf(prefs.cpuPace.coerceIn(0, 2))
        private set
    fun changeCpuPace(v: Int) { cpuPace = v.coerceIn(0, 2); prefs.cpuPace = cpuPace; jp.yonekou.asobi26.ui.CpuPace.factor = PACE[cpuPace] }
    init { jp.yonekou.asobi26.ui.CpuPace.factor = PACE[prefs.cpuPace.coerceIn(0, 2)] }
    /** 間の長さの倍率(CPU の手の前の間・動き) */
    private val pace: Float get() = PACE[cpuPace]
    var defaultLevel by mutableIntStateOf(prefs.defaultLevel)
        private set
    var playerName by mutableStateOf(prefs.playerName)
        private set

    /** 初回起動の「表示名とアイコン」の入力を済ませたか */
    var onboarded by mutableStateOf(prefs.onboarded)
        private set
    /** 初回の入力を終える。名前が空なら今のまま(スキップ) */
    fun finishOnboarding(name: String) {
        if (name.isNotBlank()) changePlayerName(name.trim())
        onboarded = true
        prefs.onboarded = true
    }

    /** プレイヤーのアイコン(写真。null = 決まった絵) */
    var avatar by mutableStateOf(jp.yonekou.asobi26.data.Avatar.load(app)?.asImageBitmap())
        private set
    /** 写真を読めなかった時 true(設定に一言出す) */
    var avatarFailed by mutableStateOf(false)
        private set

    fun changeAvatar(uri: Uri) {
        val app = getApplication<Application>()
        // 写真の読み込みは重いので、別スレッドで行う
        Thread {
            val bmp = jp.yonekou.asobi26.data.Avatar.save(app, uri)
            main.post { if (bmp != null) { avatar = bmp.asImageBitmap(); avatarFailed = false } else avatarFailed = true }
        }.start()
    }

    fun saveAvatarCrop(bitmap: Bitmap, zoom: Float, x: Float, y: Float) {
        Thread {
            val result = jp.yonekou.asobi26.data.Avatar.saveCrop(getApplication(), bitmap, zoom, x, y)
            main.post { if (result != null) { avatar = result.asImageBitmap(); avatarFailed = false } else avatarFailed = true }
        }.start()
    }

    fun clearAvatar() {
        jp.yonekou.asobi26.data.Avatar.clear(getApplication())
        avatar = null
        avatarFailed = false
    }

    fun changeTheme(mode: Int) {
        themeMode = mode
        prefs.themeMode = mode
        Prefs.applyTheme(mode)
    }

    fun changeHints(on: Boolean) { showHints = on; prefs.showHints = on }
    fun changeTapSound(on: Boolean) { tapSound = on; prefs.tapSound = on; sfx.enabled = on }

    /** 効果音(設定の「効果音」でまとめて鳴らす/鳴らさない) */
    val sfx: Sfx = Sfx(app).apply { enabled = prefs.tapSound }
    fun changeDefaultLevel(level: Int) { defaultLevel = level; prefs.defaultLevel = level }
    fun changePlayerName(name: String) {
        val clean = name.filter { it != '|' && it != ',' && it != ':' && it != ';' && it != '=' && it != '\n' }.take(12)
        playerName = clean
        prefs.playerName = clean.ifBlank { "あなた" }
    }

    // ---- 画面遷移 ----
    val backStack = mutableStateListOf<Screen>(Screen.Home)
    val screen: Screen get() = backStack.last()

    /** ホームの下のタブ(0=ゲーム 1=みんなで遊ぶ 2=成績) */
    var homeTab by mutableIntStateOf(0)
    var confirmRoomReturn by mutableStateOf(false)
    var confirmReplay by mutableStateOf(false)
    var localPass by mutableStateOf(false)
        private set
    var handover by mutableStateOf(false)
        private set
    private var lastHumanSeat = -1
    fun acceptHandover() { handover = false }
    fun returnToRoom() { confirmRoomReturn = false; room?.backToLobby() }
    private fun showRoom() {
        cancelTurnClock()
        confirmReplay = false; confirmRoomReturn = false; localPass = false; handover = false
        stopThinking(); resetAnimation(); forcedPass = false
        remoteQueue.clear(); waitingEcho = false; undoAsk = null
        onlineGame = false; session = null; info = null
        backStack.clear(); backStack.add(Screen.Home); backStack.add(Screen.Lobby)
    }
    fun confirmOnlineReplay() {
        confirmReplay = false
        val r = room ?: return
        if (!r.isHost || session?.outcome == null) return
        startOnlineGame(r.readySlots.toSet() + r.mySlot)
    }

    /** ゲーム一覧の人数のしぼり込み(0=すべて 1=2人 2=3人以上 3=1人) */
    var playerFilter by mutableIntStateOf(0)

    fun open(s: Screen) {
        backStack.add(s)
    }

    /** 戻る。ホームなら false(アプリを閉じる) */
    fun back(): Boolean {
        if (backStack.size <= 1) return false
        if (screen == Screen.Play && onlineGame) { confirmRoomReturn = true; return true }
        if (screen == Screen.Play) leavePlay()
        if (screen == Screen.Lobby) leaveRoom()
        if (screen == Screen.Join) cancelJoin()
        backStack.removeAt(backStack.lastIndex)
        return true
    }

    /** ホーム(ゲームのタブ)へ戻る */
    fun goHome() {
        if (onlineGame) { confirmRoomReturn = true; return }
        if (screen == Screen.Play) leavePlay()
        if (room != null || joinFlow != null || scanner != null) leaveRoom()
        while (backStack.size > 1) backStack.removeAt(backStack.lastIndex)
        homeTab = 0
    }

    // ---- 続きから ----
    val saved = mutableStateListOf<MatchRecord>().apply { addAll(prefs.savedMatches()) }

    private fun refreshSaved() {
        saved.clear()
        saved.addAll(prefs.savedMatches())
    }

    // ---- 対局 ----
    var session: Session<*>? by mutableStateOf(null)
        private set
    var info: GameInfo? by mutableStateOf(null)
        private set

    /** 対局の状態が変わるたびに増える(画面はこれを読んで描き直す) */
    var tick by mutableIntStateOf(0)
        private set
    var cpuThinking by mutableStateOf(false)
        private set

    /**
     * 盤のアニメーション中(この間は人の操作も CPU の手の適用も待つ)。
     * - busyCount: 盤や記録の行がアニメーションしている数(重なっても数えられるように数で持つ)
     * - pendingVersion: 手を適用した直後〜盤がその手を描き始めるまでの「つなぎ」。
     *   これがないと、適用から盤のアニメーション開始までの1コマの間に結果の板が出たり、CPU の次の手が入ったりする。
     */
    private var busyCount by mutableIntStateOf(0)
    private var pendingVersion by mutableIntStateOf(-1)
    val animating: Boolean get() = busyCount > 0 || pendingVersion >= 0
    private var settledAt = 0L

    fun changeAnimating(on: Boolean) {
        if (on) busyCount++ else {
            busyCount = (busyCount - 1).coerceAtLeast(0)
            settledAt = SystemClock.uptimeMillis()
        }
    }

    /** 盤が version の局面を描き終えた(アニメーションがあれば終わった) */
    fun boardShown(version: Int) {
        if (pendingVersion in 0..version) {
            pendingVersion = -1
            settledAt = SystemClock.uptimeMillis()
        }
    }

    /** 手を適用した直後に呼ぶ。盤が描き終えるまで animating になる(盤が応えない時のために数秒で外す) */
    private fun markPending(ses: Session<*>) {
        if(ses.rules is ConcurrentRules<*>)return
        val v = ses.version
        pendingVersion = v
        main.postDelayed({ if (pendingVersion == v && session === ses) pendingVersion = -1 }, PENDING_LIMIT_MS)
    }

    private fun resetAnimation() {
        busyCount = 0
        pendingVersion = -1
    }
    private var budget: Budget? = null
    private var thinkGen = 0

    /**
     * 新しい対局。humanSeat: 人の席(-1 = ランダム)。1人用(ひとりで)なら CPU はいない。
     */
    /** 前回この遊びを始めた時の設定(設定・強さ・手番)。なければ null */
    fun savedSetup(gameId: String): Triple<GameOptions, Int, Int>? = prefs.lastSetup(gameId)?.split('|')?.takeIf { it.size == 3 }?.let {
        Triple(GameOptions.decode(it[0]), it[1].toIntOrNull() ?: defaultLevel, it[2].toIntOrNull() ?: 0)
    }

    /** 設定の画面で変えた設定を、すぐ保存する(アプリを閉じても残る) */
    fun saveSetup(gameId: String, options: GameOptions, level: Level, humanSeat: Int) {
        prefs.saveSetup(gameId, options.encode() + "|" + level.ordinal + "|" + humanSeat)
    }

    fun startGame(gameInfo: GameInfo, options: GameOptions, level: Level, humanSeat: Int) {
        if (onlineGame) leaveRoom()
        val def = gameInfo.def ?: return
        val n = def.seatsFor(options)
        val me = if (n == 1) 0 else if (humanSeat in 0 until n) humanSeat else Random.nextInt(n)
        localPass = options.str("localMode", "cpu") == "pass"
        prefs.saveSetup(gameInfo.id, options.encode() + "|" + level.ordinal + "|" + humanSeat)
        lastHumanSeat = -1
        val humanCount = if (localPass) options.str("humans", n.toString()).toIntOrNull()?.coerceIn(1, n) ?: n else 1
        val seats = List(n) { i ->
            // 手番ごとに交代: 1人目は表示名(設定)、2人目からはゲームの設定で決めた名前
            if (localPass && i < humanCount) Seat(true, level, if (i == 0) playerName.ifBlank { "プレイヤー1" } else options.str("pname${i + 1}", "").ifBlank { "プレイヤー${i + 1}" }) else if (!localPass && i == me) Seat(true, level, playerName.ifBlank { "あなた" }) else Seat(false, level, "CPU")
        }
        begin(gameInfo, Session(def, options, seats, Random.nextLong()))
    }

    /** 保存してある途中の対局を再開する */
    fun resume(rec: MatchRecord) {
        if (onlineGame) leaveRoom()
        val gi = Catalog.byId(rec.gameId) ?: return
        val def = gi.def ?: return
        val ses = restore(def, rec)
        if (ses == null) {
            prefs.removeMatch(rec.gameId) // 壊れた記録は消す
            refreshSaved()
            return
        }
        begin(gi, ses)
    }

    private fun <S> restore(def: GameDef<S>, rec: MatchRecord): Session<S>? = Session.restore(def, rec)

    private fun begin(gi: GameInfo, ses: Session<*>) {
        yachtSelectionIndex = -1; yachtSelection = 0
        stopThinking()
        resetAnimation()
        forcedPass = false
        localPass = !onlineGame && ses.options.str("localMode", "cpu") == "pass"
        handover = false; lastHumanSeat = -1
        info = gi
        session = ses
        tick++
        if (screen != Screen.Play) open(Screen.Play)
        afterChange()
    }

    /** 人の操作。手番でない・合法でない手は何もしない(false)。 */
    fun humanMove(m: Int): Boolean {
        val ses = session ?: return false
        val advance=reviewMove!=null&&m==reviewMove&&canAdvanceRound
        if(reviewMove!=null&&!advance)return false
        if ((!ses.isHumanTurn&&!advance) || cpuThinking || animating || handover || undoAsk != null) return false
        @Suppress("UNCHECKED_CAST") val concurrent=ses.rules as? ConcurrentRules<Any?>
        if(concurrent != null && ses.seats.getOrNull(concurrent.actor(m))?.human != true)return false
        val r = room
        if (onlineGame && r != null && !r.isHost) {
            // 参加者: 自分の手はホストへ送り、ホストが確かめて全員へ配った手(MOVE)で進める
            if (waitingEcho || !legalNow(ses, m)) return false
            waitingEcho = true
            if(concurrent != null)r.requestConcurrent(m) else r.request(ses.moves.size, m)
            return true
        }
        val index = ses.moves.size
        if (!ses.submit(m)) return false
        if (onlineGame && r != null) r.share(index, m)
        markPending(ses)
        tick++
        afterChange()
        return true
    }

    private fun <S> legalNow(ses: Session<S>, m: Int): Boolean = ses.rules.isLegal(ses.state, m)

    // ---- 通信のチャット・スタンプ ----
    /** 届いたチャット(自分のも)。kind 0 = 文字、1 = スタンプ(body = 番号)。at = 届いた時刻(SystemClock.elapsedRealtime) */
    class ChatItem(val id: Int, val slot: Int, val name: String, val mine: Boolean, val kind: Int, val body: String, val at: Long)
    val chatLog = mutableStateListOf<ChatItem>()
    var chatUnread by mutableIntStateOf(0)
    var chatOpen by mutableStateOf(false)
        private set
    fun openChat(open: Boolean) { chatOpen = open; if (open) chatUnread = 0 }
    /** 部屋の全員がチャットに対応している時 true(古い版の人がいると使えない) */
    val chatSupported: Boolean get() = room?.supports(jp.yonekou.asobi26.core.Compat.CHAT) == true
    fun sendChat(kind: Int, body: String): Boolean = room?.sendChat(kind, body) ?: false
    fun notifyChatUnsupported() {
        val names = room?.legacyNames().orEmpty()
        showFlash(if (names.isEmpty()) "いまはチャットを使えません" else "${names.joinToString("・")}のアプリが古いので、チャットは使えません")
    }

    // ---- 通信の「待った」(全員の了承が要る) ----
    /** 返事を集めている「待った」。mine = 自分が押した、answered = 自分はもう返事をした */
    class UndoAsk(val id: Int, val name: String, val mine: Boolean, val answered: Boolean)
    var undoAsk by mutableStateOf<UndoAsk?>(null)
        private set
    /** 画面に少しの間だけ出す知らせ(「待った」の結果など) */
    var flash by mutableStateOf<String?>(null)
        private set
    private var flashSeq = 0
    private fun showFlash(text: String) {
        flash = text
        val seq = ++flashSeq
        main.postDelayed({ if (seq == flashSeq) flash = null }, 3200)
    }
    /** 自分が使った「待った」の回数(この対局) */
    var myUndoUsed by mutableIntStateOf(0)
        private set
    /** ホスト: 人ごとの使った回数と、断られた時の手数(同じ局面で何度も押せないように) */
    private val undoUsed = HashMap<Int, Int>()
    private val undoDeclinedAt = HashMap<Int, Int>()
    private var myUndoDeclinedAt = -1
    /** 設定の回数(0 = なし、-1 = 制限なし) */
    val onlineUndoLimit: Int get() = if (room?.supports(jp.yonekou.asobi26.core.Compat.UNDO) != true) 0 else session?.takeIf { onlineGame && it.def.undoAllowed && it.rules !is ConcurrentRules<*> }?.options?.int("onlineUndo", 0) ?: 0
    val onlineUndoLeft: Int get() = onlineUndoLimit.let { if (it < 0) -1 else (it - myUndoUsed).coerceAtLeast(0) }
    val canOnlineUndo: Boolean
        get() {
            val ses = session ?: return false
            val r = room ?: return false
            val limit = onlineUndoLimit
            if (limit == 0 || (limit > 0 && myUndoUsed >= limit)) return false
            if (undoAsk != null || r.undoVote != null || ses.outcome != null || reviewMove != null || waitingEcho) return false
            if (ses.moves.size == myUndoDeclinedAt) return false
            val seat = ses.seats.indexOfFirst { it.human }
            return ses.undoTargetFor(seat) != null
        }
    fun requestOnlineUndo() { if (canOnlineUndo) room?.requestUndo() }
    fun answerUndo(yes: Boolean) {
        val a = undoAsk ?: return
        if (a.mine || a.answered) return
        undoAsk = UndoAsk(a.id, a.name, false, true)
        room?.voteUndo(yes)
    }

    fun undo() {
        val ses = session ?: return
        if (animating) return
        stopThinking()
        forcedPass = false
        if (ses.undo()) tick++
        afterChange()
    }

    /** 同じ設定でもう一度。swapSeats なら人とCPUの席を入れ替える。 */
    fun rematch(swapSeats: Boolean) {
        if (onlineGame) { room?.again(); if (room?.isHost == true) confirmReplay = true; return }
        val ses = session ?: return
        val gi = info ?: return
        val seats = if (swapSeats && ses.seats.size == 2) ses.seats.reversed() else ses.seats
        begin(gi, newSession(ses, seats))
    }

    private fun <S> newSession(old: Session<S>, seats: List<Seat>): Session<S> = Session(old.def, old.options, seats, Random.nextLong())

    val canUndo: Boolean
        get() {
            val ses = session ?: return false
            // 終局後(負けた後など)も戻せる。人が1手以上指している時だけ
            return !onlineGame && ses.def.undoAllowed && ses.seats.any { !it.human } && ses.canUndo()
        }

    private fun afterChange() {
        val current = session
        if (localPass && current != null && current.isHumanTurn && current.toMove != lastHumanSeat && current.outcome == null) {
            lastHumanSeat = current.toMove; handover = false
        }
        recordResult()
        saveNow()
        scheduleCpu()
        scheduleTurnClock()
    }

    // ---- 成績 ----
    /** 成績の表示用(変わったら増える) */
    var statsVersion by mutableIntStateOf(0)
        private set
    private var recordedFor: Session<*>? = null

    /** 対局が終わった時に1回だけ成績へ記録する(待ったで戻して終わり直しても、同じ対局は1回だけ) */
    private fun recordResult() {
        if (onlineGame || localPass) return // 人どうしはCPU成績に含めない
        val ses = session ?: return
        val out = ses.outcome ?: return
        if (recordedFor === ses) return
        recordedFor = ses
        val human = ses.seats.indexOfFirst { it.human }
        if (human < 0) return
        if (ses.seats.size == 1) {
            if (ses.def.id == "yacht") {
                // ひとりのヨット: 点数が記録(高いほど良い)
                prefs.recordSolo(ses.def.id, true, scoresOf(ses)?.getOrNull(0) ?: 0, higherIsBetter = true)
            } else {
                prefs.recordSolo(ses.def.id, out.winner == 0, ses.moves.size)
            }
        } else {
            val cpu = ses.seats.firstOrNull { !it.human } ?: return // 人どうしは数えない
            val r = when (out.winner) { -1 -> 2; human -> 0; else -> 1 }
            prefs.recordVsCpu(ses.def.id, cpu.level.ordinal, r)
        }
        statsVersion++
    }

    private fun <S> scoresOf(s: Session<S>): IntArray? = s.rules.scores(s.state)

    fun statsOf(gameId: String): Prefs.Stats = prefs.stats(gameId)

    fun clearStats() {
        prefs.clearStats()
        statsVersion++
    }

    /** 途中の対局を保存する(終わった対局は消す) */
    fun saveNow() {
        if (onlineGame) return // 通信対戦は「続きから」に残さない
        val ses = session ?: return
        // 終わった対局と、まだ1手も進んでいない対局は「続きから」に残さない
        if (ses.outcome != null || ses.moves.isEmpty()) prefs.removeMatch(ses.def.id)
        else if (ses.seats.any { !it.human } || ses.seats.size == 1) prefs.saveMatch(ses.record())
        refreshSaved()
    }

    /** 人の番だがパスしかできない(リバーシで置ける所がない)ので、自動でパスするのを待っている */
    var forcedPass by mutableStateOf(false)
        private set

    /** CPU の番をとばす(ヨット)。動きを見せずに、人の番まで一気に進める */
    private var fastCpuState by mutableStateOf(false)
    var fastCpu: Boolean
        get() = fastCpuState
        set(v) { fastCpuState = v; jp.yonekou.asobi26.ui.CpuPace.skip = v }

    /** CPU とだけ対戦している時、CPU の番の動きをとばして自分の番まで進める(画面のダブルタップ) */
    fun skipCpu() {
        val ses = session ?: return
        if (onlineGame || localPass || ses.outcome != null || !ses.isCpuTurn) return
        fastCpu = true
    }

    private var concurrentScheduled: Session<*>? = null
    private var concurrentCpuSeat = 0
    private fun scheduleConcurrent(ses: Session<*>) {
        if(concurrentScheduled === ses || ses.outcome != null || (onlineGame && room?.isHost != true))return
        val cpus=ses.seats.indices.filter{!ses.seats[it].human && !ses.seats[it].remote}
        if(cpus.isEmpty())return
        concurrentScheduled=ses
        val seat=cpus[(concurrentCpuSeat++)%cpus.size]
        val wait=if(ses.def.id == "speed")when(ses.seats[seat].level){Level.EASY->1100L;Level.NORMAL->700L;Level.HARD->400L}else 600L
        main.postDelayed({
            if(concurrentScheduled !== ses)return@postDelayed
            concurrentScheduled=null
            if(session !== ses || ses.outcome != null)return@postDelayed
            @Suppress("UNCHECKED_CAST") val typed=ses as Session<Any?>
            val rules=typed.rules as ConcurrentRules<Any?>
            val legal=rules.legalMovesFor(typed.state,seat)
            if(legal.isNotEmpty()) {
                val move=typed.def.brain.choose(rules,typed.state,seat,typed.seats[seat].level,Random.Default,Budget(80))
                val index=typed.moves.size
                if(move in legal && typed.submit(move)){if(onlineGame)room?.share(index,move);tick++;afterChange()}
            }
            if(session === ses)scheduleConcurrent(ses)
        },wait)
    }
    private fun scheduleCpu() {
        val ses = session ?: return
        if(reviewMove!=null)return
        if(ses.rules is ConcurrentRules<*>){scheduleConcurrent(ses);return}
        if (ses.isHumanTurn || ses.outcome != null) fastCpu = false
        if (ses.isHumanTurn) { schedulePass(ses); return }
        if (!ses.isCpuTurn) return
        startThinking(ses)
    }

    private fun <S> schedulePass(ses: Session<S>) {
        val pass = ses.def.passMove ?: return
        val legal = ses.rules.legalMoves(ses.state)
        if (legal.size != 1 || legal[0] != pass) return
        forcedPass = true
        val version = ses.version
        fun tryPass() {
            if (session !== ses || ses.version != version) { forcedPass = false; return }
            if (handover || animating || SystemClock.uptimeMillis() - settledAt < SETTLE_MS) { main.postDelayed({ tryPass() }, 60); return }
            forcedPass = false
            humanMove(pass) // 参加者も必ずホストの確定を待ち、全端末に同じパスを流す
        }
        main.postDelayed({ tryPass() }, 1300)
    }

    private fun <S> startThinking(ses: Session<S>) {
        val seat = ses.toMove
        val level = ses.seats[seat].level
        val state = ses.state
        val version = ses.version
        val gen = ++thinkGen
        val b = Budget(THINK_MS[level.ordinal])
        budget = b
        cpuThinking = true
        val started = System.currentTimeMillis()
        val rng = Random(System.nanoTime())
        // Web 版: 考えるのは別スレッド(Worker)。ブラウザは1スレッドなので、ここで考えると画面の動きが止まるため。
        // 局面は「同じ種と手の並び」で Worker の側に作り直す(規則は同じコード)。古い結果は gen と version で捨てる
        val record = MatchRecord(ses.def.id, ses.options, ses.seats, ses.seed, ses.moves.toList()).encode()
        @Suppress("UNUSED_VARIABLE") val unusedRng = rng
        WebCpu.choose(record, THINK_MS[level.ordinal].toInt()) { m ->
            val move = if (m >= 0 && ses.rules.isLegal(state, m)) m else {
                // 思考の失敗で落とさない(合法手から選び直す)
                val legal = ses.rules.legalMoves(state)
                if (legal.isEmpty()) -1 else legal[0]
            }
            // 速すぎると何が起きたか見えないので、少しだけ間を取る
            val wait = if (fastCpu) 0L else ((MIN_THINK_MS * pace).toLong() - (System.currentTimeMillis() - started)).coerceAtLeast(0)
            main.postDelayed({ applyCpuMove(ses, gen, version, move) }, wait)
        }
    }

    /** CPU の手を適用する。盤のアニメーション中なら終わるまで待つ */
    private fun <S> applyCpuMove(ses: Session<S>, gen: Int, version: Int, move: Int) {
        if (gen != thinkGen || session !== ses || ses.version != version) return
        if (animating) {
            main.postDelayed({ applyCpuMove(ses, gen, version, move) }, 60)
            return
        }
        // 直前の手の動きが終わってすぐ次の手を打つと見えないので、少し間を空ける
        val rest = if (fastCpu) 0L else (SETTLE_MS * pace).toLong() - (SystemClock.uptimeMillis() - settledAt)
        if (rest > 0) {
            main.postDelayed({ applyCpuMove(ses, gen, version, move) }, rest)
            return
        }
        cpuThinking = false
        budget = null
        val index = ses.moves.size
        if (move >= 0 && ses.submit(move)) {
            if (onlineGame) room?.share(index, move)
            markPending(ses)
            tick++
            afterChange()
        }
    }

    private fun stopThinking() {
        thinkGen++
        budget?.cancelled = true
        budget = null
        cpuThinking = false
    }

    private fun leavePlay() {
        cancelTurnClock()
        if (onlineGame) leaveRoom()
        saveNow()
        stopThinking()
        resetAnimation()
        forcedPass = false
        session = null
        info = null
    }

    // =====================================================================
    // 通信対戦(MineLink の通信を使う。送るのは開始の情報と手だけ)
    // =====================================================================

    /** 近く(Bluetooth / Wi-Fi Direct) */
    private var nearbyOrNull: jp.yonekou.asobi26.net.NearbyTransport? = null
    private val nearby: jp.yonekou.asobi26.net.NearbyTransport
        get() = nearbyOrNull ?: jp.yonekou.asobi26.net.NearbyTransport(getApplication()).also { nearbyOrNull = it }
    /** 遠く(WebRTC)。重いので使う時まで作らない */
    private var rtcOrNull: jp.yonekou.asobi26.net.WebRtcTransport? = null
    private val rtc: jp.yonekou.asobi26.net.WebRtcTransport
        get() = rtcOrNull ?: jp.yonekou.asobi26.net.WebRtcTransport(getApplication()).also {
            it.onInviteEvent = { onlineChanged() }
            rtcOrNull = it
        }
    /** 返信コードを自動で受け渡す中継(ntfy)。使うまでスレッドも作らない */
    private val relay = jp.yonekou.asobi26.net.NtfyRelay(post = { f -> main.post { f() } })

    var room by mutableStateOf<jp.yonekou.asobi26.core.net.OnlineRoom?>(null)
        private set
    /** いまの部屋がオンライン(招待コード)か */
    var roomOnline by mutableStateOf(false)
        private set
    var scanner by mutableStateOf<jp.yonekou.asobi26.core.net.RoomScanner?>(null)
        private set
    var invites by mutableStateOf<jp.yonekou.asobi26.core.net.InviteBook?>(null)
        private set
    var joinFlow by mutableStateOf<jp.yonekou.asobi26.core.net.JoinFlow?>(null)
        private set
    /** 部屋が閉じた理由など(画面に1回出す) */
    var onlineNotice by mutableStateOf<String?>(null)
    /** 通信の状態が変わった(画面の描き直し) */
    var onlineTick by mutableIntStateOf(0)
        private set
    /** いまの対局が通信対戦か */
    var onlineGame by mutableStateOf(false)
        private set
    /** 参加者: 自分の手をホストへ送って、返ってくるのを待っている */
    private var waitingEcho = false
    /** 届いた手(何手目, 手)。動きの途中なら待ってから順に進める */
    private val remoteQueue = ArrayDeque<Pair<Int, Int>>()
    private var pumping = false

    /** 通信対戦で遊べるゲーム(2人以上で遊べるもの) */
    val onlineGames: List<GameInfo>
        get() = listOf("life", "mahjong", "hanafuda", "speed", "holdem", "uno", "solitaire", "daifugo", "sevens", "poker", "memory", "blackjack", "ludo", "chinese", "yacht", "reversi", "gomoku", "connect4", "shogi", "gogo", "chess", "backgammon", "dots", "mancala", "hex", "morris", "hare", "checkers", "go")
            .mapNotNull { Catalog.byId(it)?.takeIf { g -> g.playable } }

    fun maxPlayers(gi: GameInfo): Int = gi.options.firstOrNull { it.key == "players" }?.values?.mapNotNull { it.first.toIntOrNull() }?.maxOrNull() ?: gi.def?.seatsFor(GameOptions()) ?: 0
    fun canChooseOnline(gi: GameInfo): Boolean = maxPlayers(gi) >= (room?.members?.size ?: 1) && room?.rulesMismatch(gi.id).isNullOrEmpty()
    /** このゲームを一緒に遊べない人(規則の番号が違う=アプリの版が違う人)の名前 */
    fun mismatchNames(gi: GameInfo): List<String> = room?.rulesMismatch(gi.id) ?: emptyList()

    private fun onlineChanged() {
        onlineTick++
        reconcileOnline()
    }

    /** ホスト: 部屋を作る。online = 招待コードで遠くの人を招く */
    fun hostRoom(online: Boolean) {
        leaveRoom()
        val net: jp.yonekou.asobi26.core.net.Transport = if (online) rtc else nearby
        val r = jp.yonekou.asobi26.core.net.OnlineRoom.host(net, playerName.ifBlank { "あなた" }, advertise = !online)
        setupRoom(r)
        r.choose("daifugo", GameOptions())
        if (online) {
            val book = jp.yonekou.asobi26.core.net.InviteBook(rtc, relay, { true }) { jp.yonekou.asobi26.core.net.OnlineRoom.MAX - r.members.size }
            book.onChanged = { onlineChanged() }
            invites = book
        }
        roomOnline = online
        room = r
        open(Screen.Lobby)
    }

    /** 参加者: 近くの部屋を探し始める */
    fun startScan() {
        scanner?.stop()
        val sc = jp.yonekou.asobi26.core.net.RoomScanner(nearby)
        sc.onChanged = { onlineChanged() }
        scanner = sc
        sc.start()
    }

    fun stopScan() {
        scanner?.stop()
        scanner = null
    }

    /** 参加者: 見つけた近くの部屋に入る */
    fun joinNearby(found: jp.yonekou.asobi26.core.net.RoomScanner.Found) {
        stopScan()
        val r = jp.yonekou.asobi26.core.net.OnlineRoom.guest(nearby, playerName.ifBlank { "あなた" }, found.id)
        setupRoom(r)
        roomOnline = false
        room = r
        open(Screen.Lobby)
    }

    /** 参加者: 招待コードを貼って、返信コードを作る */
    fun submitInvite(code: String) {
        val flow = joinFlow ?: jp.yonekou.asobi26.core.net.JoinFlow(rtc, relay) { true }.also { f ->
            f.onChanged = { onlineChanged() }
            joinFlow = f
        }
        flow.submit(code)
        onlineChanged()
    }

    fun cancelJoin() {
        joinFlow?.reset()
        joinFlow = null
        stopScan()
        if (room == null) closeTransports()
        onlineChanged()
    }

    private fun setupRoom(r: jp.yonekou.asobi26.core.net.OnlineRoom) {
        r.onChanged = { onlineChanged() }
        r.onBegin = { b -> beginOnline(r, b) }
        r.onConcurrent = { slot, move ->
            @Suppress("UNCHECKED_CAST") val ses=session as? Session<Any?>
            val rules=ses?.rules as? ConcurrentRules<Any?>
            if(!onlineGame || ses==null || rules==null || r.begin?.seatSlots?.getOrNull(rules.actor(move)) != slot || !rules.isLegal(ses.state,move)) false
            else {
                val index=ses.moves.size
                if(ses.submit(move)){r.share(index,move);tick++;afterChange();true}else false
            }
        }
        r.onMove = { index, move -> if (onlineGame && session != null) { remoteQueue.addLast(index to move); pumpRemote() } }
        r.onSync = { moves -> syncTo(moves) }
        r.canAccept = { slot, index, move ->
            val ses = session
            val b = r.begin
            ses != null && b != null && ses.outcome == null && index == ses.moves.size + remoteQueue.size &&
                (if(reviewMove!=null) slot==0&&move==reviewMove
                else if(ses.rules is ConcurrentRules<*>) (ses.rules as ConcurrentRules<*>).actor(move).let { b.seatSlots.getOrNull(it) == slot }
                else Session.resignSeat(move)?.let { seat -> ses.canResign && b.seatSlots.getOrNull(seat) == slot }
                    ?: (ses.toMove >= 0 && b.seatSlots.getOrNull(ses.toMove) == slot))
        }
        r.currentMoves = { session?.moves?.toList() ?: emptyList() }
        r.onChat = { c ->
            val mine = c.slot == r.mySlot
            chatLog.add(ChatItem(c.seq, c.slot, c.name, mine, c.kind, c.body, SystemClock.elapsedRealtime()))
            while (chatLog.size > 100) chatLog.removeAt(0)
            if (!mine) {
                if (!chatOpen) chatUnread++
                sfx.play(jp.yonekou.asobi26.audio.Sound.CHAT)
            }
        }
        r.undoTarget = { slot ->
            val ses = session
            val b = r.begin
            val limit = ses?.options?.int("onlineUndo", 0) ?: 0
            if (!onlineGame || ses == null || b == null || ses.outcome != null || reviewMove != null || ses.rules is ConcurrentRules<*> || !r.supports(jp.yonekou.asobi26.core.Compat.UNDO) ||
                remoteQueue.isNotEmpty() || limit == 0 || (limit > 0 && (undoUsed[slot] ?: 0) >= limit) || undoDeclinedAt[slot] == ses.moves.size) null
            else ses.undoTargetFor(b.seatSlots.indexOf(slot))
        }
        r.onUndoAsk = { v ->
            undoAsk = UndoAsk(v.id, v.name, v.slot == r.mySlot, v.slot == r.mySlot)
            sfx.play(jp.yonekou.asobi26.audio.Sound.KNOCK)
            // ホスト: 20秒たっても返事がそろわなければ、了承されなかったことにする
            if (r.isHost) main.postDelayed({ r.expireUndo(v.id) }, UNDO_WAIT_MS)
        }
        r.onUndoApply = { v ->
            val ses = session
            if (ses != null && onlineGame && ses.rewindTo(v.target)) {
                undoUsed[v.slot] = (undoUsed[v.slot] ?: 0) + 1
                remoteQueue.clear(); waitingEcho = false
                stopThinking(); resetAnimation(); forcedPass = false
                ses.moves.toList()
            } else null
        }
        r.onUndoDone = { v, ok, moves, by ->
            if (undoAsk?.id == v.id) undoAsk = null
            val mine = v.slot == r.mySlot
            if (ok) {
                if (mine) myUndoUsed++
                if (r.isHost) { tick++; afterChange() } else syncTo(moves)
                showFlash("全員が了承したので、${if (mine) "あなた" else v.name}の「待った」で戻しました")
            } else if (by == -3) {
                showFlash("いまは「待った」できません")
            } else {
                session?.let { if (r.isHost) undoDeclinedAt[v.slot] = it.moves.size; if (mine) myUndoDeclinedAt = it.moves.size }
                showFlash(when {
                    by == -2 -> "返事がそろわなかったので、そのまま続けます"
                    by == v.slot -> "「待った」は取り消されました"
                    by == r.mySlot -> "了承しなかったので、そのまま続けます"
                    else -> "${r.nameOf(by)}が了承しなかったので、そのまま続けます"
                })
            }
        }
        r.onResign = { slot ->
            val original = session
            val originalRound = r.begin
            fun finishResign() {
                val ses = session
                if (ses == null || ses !== original || r.begin !== originalRound || ses.outcome != null || !ses.canResign) return
                if (remoteQueue.isNotEmpty()) { main.postDelayed({ finishResign() }, 60); return }
                val seat = r.begin?.seatSlots?.indexOf(slot) ?: -1
                if (seat in ses.seats.indices) {
                    val move = Session.resignMove(seat)
                    val index = ses.moves.size
                    if (ses.submit(move)) { stopThinking(); resetAnimation(); r.share(index, move); tick++; afterChange() }
                }
            }
            finishResign()
        }
        r.onSelection = { index, mask ->
            val ses = session
            if (onlineGame && ses != null && ses.def.id == "yacht" && index >= ses.moves.size && index >= yachtSelectionIndex) {
                yachtSelectionIndex = index; yachtSelection = mask
            }
        }
        r.canSelect = { slot, index, _ ->
            val ses = session
            val st = ses?.state as? jp.yonekou.asobi26.core.games.YachtState
            st != null && !st.over && st.rollsLeft < 3 && index == ses.moves.size && r.begin?.seatSlots?.getOrNull(st.turn) == slot
        }
        r.onSeatClock = { index, seat, seconds -> if(onlineGame && index==session?.moves?.size && session?.seats?.getOrNull(seat)?.human==true)clockRemaining=seconds }
        r.onClock = { index, seconds ->
            val ses = session
            if (onlineGame && ses != null && index == ses.moves.size) {
                if (seconds == 0 && clockRemaining > 0) markTimeUp(ses, ses.toMove)
                clockRemaining = seconds
            }
        }
        r.onLobby = { showRoom() }
        r.canAgain = { session?.outcome != null }
        r.onLeft = { slot -> seatToCpu(slot) }
    }

    fun chooseOnlineGame(id: String) {
        val r = room ?: return
        val gi = Catalog.byId(id) ?: return
        if (!r.isHost || r.phase != jp.yonekou.asobi26.core.net.OnlineRoom.Phase.LOBBY || !canChooseOnline(gi)) return
        var opts = if (id == "blackjack") GameOptions(mapOf("bjStyle" to "pot")) else GameOptions()
        gi.options.firstOrNull { it.key == "players" }?.let { spec ->
            val total = maxOf(r.members.size, gi.def!!.seatsFor(opts))
            spec.values.mapNotNull { it.first.toIntOrNull() }.filter { it >= total }.minOrNull()?.let { opts = opts.with("players", it.toString()) }
        }
        r.choose(id, opts)
    }

    /** ホスト: 選んでいるゲームで対局を始める */
    fun startOnlineGame(participants: Set<Int>? = null) {
        val r = room ?: return
        if (!r.isHost) return
        val gi = Catalog.byId(r.gameId) ?: return
        val def = gi.def ?: return
        val count = participants?.size ?: r.members.size
        if (maxPlayers(gi) < count) { onlineNotice = "このゲームは${maxPlayers(gi)}人までです"; return }
        mismatchNames(gi).takeIf { it.isNotEmpty() }?.let { onlineNotice = "${it.joinToString("・")}のアプリが古いので、このゲームは一緒に遊べません。アプリを新しくしてもらってください"; return }
        var opts = if (gi.id == "blackjack" && !r.options.values.containsKey("bjStyle")) r.options.with("bjStyle", "pot") else r.options
        // 人数を選べるゲームは、部屋の人数に合わせる(足りない席は CPU)
        val spec = gi.options.firstOrNull { it.key == "players" }
        if (spec != null && def.seatsFor(opts) < count) {
            val best = spec.values.map { it.first }.filter { (it.toIntOrNull() ?: 0) >= count }.minByOrNull { it.toInt() } ?: spec.values.last().first
            opts = opts.with("players", best)
        }
        // 席数だけでなく、規則と参加者へ送る開始情報にも同じ人数を使う。
        r.choose(gi.id, opts)
        r.start(def.seatsFor(opts), Random.nextLong(), participants ?: r.members.map { it.slot }.toSet())
    }

    private fun beginOnline(r: jp.yonekou.asobi26.core.net.OnlineRoom, b: jp.yonekou.asobi26.core.net.OnlineRoom.Begin) {
        localPass = false; handover = false
        if (r.mySlot !in b.seatSlots) { showRoom(); onlineNotice = "今回は参加せず、部屋で待機します"; return }
        val gi = Catalog.byId(b.gameId) ?: return
        val def = gi.def ?: return
        val level = Level.values()[defaultLevel.coerceIn(0, 2)]
        val seats = b.seatSlots.mapIndexed { i, slot ->
            val mine = slot == r.mySlot
            // ホストの端末では CPU の席はこの端末の CPU が指す。参加者の端末では、人も CPU もすべて相手(通信で届く)
            Seat(human = mine, level = level, name = if (mine) playerName.ifBlank { "あなた" } else b.names[i], remote = !mine && !(r.isHost && slot < 0))
        }
        remoteQueue.clear()
        waitingEcho = false
        undoAsk = null; myUndoUsed = 0; myUndoDeclinedAt = -1; undoUsed.clear(); undoDeclinedAt.clear()
        onlineGame = true
        @Suppress("UNCHECKED_CAST")
        begin(gi, Session(def as GameDef<Any?>, b.options, seats, b.seed))
    }

    /** 届いた手を、動きの終わりを待ちながら順に進める */
    private fun pumpRemote() {
        if (pumping) return
        val ses = session
        if (ses == null || remoteQueue.isEmpty()) return
        if (ses.rules !is ConcurrentRules<*> && (animating || SystemClock.uptimeMillis() - settledAt < SETTLE_MS)) {
            pumping = true
            main.postDelayed({ pumping = false; pumpRemote() }, 60)
            return
        }
        val (index, move) = remoteQueue.removeFirst()
        val r = room
        when {
            index < ses.moves.size -> {}
            index > ses.moves.size -> { remoteQueue.clear(); r?.needSync() }
            else -> {
                if (ses.submit(move)) {
                    if (r != null && r.isHost) r.share(index, move)
                    waitingEcho = false
                    stopThinking()
                    if (Session.resignSeat(move) != null || Session.timeoutSeat(move) != null) resetAnimation() else markPending(ses)
                    tick++
                    afterChange()
                } else if (r != null && !r.isHost) { remoteQueue.clear(); r.needSync() }
            }
        }
        if (remoteQueue.isNotEmpty()) pumpRemote()
    }

    /** 参加者: 手の並びを送り直された。同じ始まりから作り直す */
    private fun syncTo(moves: List<Int>) {
        val ses = session ?: return
        val gi = info ?: return
        val rec = MatchRecord(ses.def.id, ses.options, ses.seats, ses.seed, moves)
        @Suppress("UNCHECKED_CAST")
        val back = Session.restore(ses.def as GameDef<Any?>, rec) ?: return
        remoteQueue.clear()
        waitingEcho = false
        stopThinking()
        resetAnimation()
        info = gi
        session = back
        tick++
        afterChange()
    }

    /** ホスト: 抜けた人の席を CPU にする(その席の手はこの端末の CPU が指す) */
    private fun seatToCpu(slot: Int) {
        val ses = session ?: return
        val b = room?.begin ?: return
        val seats = ses.seats.mapIndexed { i, st -> if (b.seatSlots.getOrNull(i) == slot) Seat(false, st.level, "CPU") else st }
        val rec = MatchRecord(ses.def.id, ses.options, seats, ses.seed, ses.moves.toList())
        @Suppress("UNCHECKED_CAST")
        val back = Session.restore(ses.def as GameDef<Any?>, rec) ?: return
        stopThinking()
        session = back
        onlineNotice = "${b.names.getOrElse(b.seatSlots.indexOf(slot)) { "参加者" }}が抜けたので、CPUが代わりに指します"
        tick++
        afterChange()
    }

    /** 部屋の状態に合わせて画面を合わせる(通信の通知のたびに呼ぶ) */
    private fun reconcileOnline() {
        invites?.refresh()
        val flow = joinFlow
        if (flow != null && room == null) {
            val id = flow.peerId
            when (flow.linkState()) {
                jp.yonekou.asobi26.core.net.LinkState.OPEN -> if (id != null) {
                    // ホストが返信コードを入れて、つながった
                    val r = jp.yonekou.asobi26.core.net.OnlineRoom.guest(rtc, playerName.ifBlank { "あなた" }, id)
                    setupRoom(r)
                    roomOnline = true
                    room = r
                    joinFlow = null
                    open(Screen.Lobby)
                    return
                }
                jp.yonekou.asobi26.core.net.LinkState.FAILED, jp.yonekou.asobi26.core.net.LinkState.GONE ->
                    if (id != null) flow.reset("つながりませんでした。招待コードの貼り付けからやり直してください")
                jp.yonekou.asobi26.core.net.LinkState.PENDING -> {}
            }
        }
        val r = room ?: return
        if (r.phase == jp.yonekou.asobi26.core.net.OnlineRoom.Phase.CLOSED) {
            onlineNotice = r.closedReason
            leaveRoom()
            backStack.clear(); backStack.add(Screen.Home)
            homeTab = 1
        }
    }

    /** 部屋を出る(ホストなら閉じる)。通信も閉じる */
    fun leaveRoom() {
        cancelTurnClock()
        chatLog.clear(); chatUnread = 0; chatOpen = false
        room?.leave()
        room = null
        stopScan()
        invites?.closeAll()
        invites = null
        joinFlow?.reset()
        joinFlow = null
        remoteQueue.clear()
        waitingEcho = false
        undoAsk = null
        if (onlineGame) {
            onlineGame = false
            stopThinking()
            resetAnimation()
            session = null
            info = null
        }
        closeTransports()
        onlineTick++
    }

    private fun closeTransports() {
        try { nearbyOrNull?.closeAll() } catch (_: Throwable) { }
        try { rtcOrNull?.closeAll() } catch (_: Throwable) { }
    }

    override fun onCleared() {
        concurrentScheduled=null
        cancelTurnClock()
        leaveRoom()
        sfx.release()
        stopThinking()
        cpuThread.shutdownNow()
    }

    companion object {
        /** CPU が考える時間の上限(初級・中級・上級)。AQUOS wish5 程度の端末でも待たされすぎない長さ */
        val THINK_MS = longArrayOf(300L, 800L, 1500L)
        const val MIN_THINK_MS = 450L
        /** 動きが終わってから CPU が次の手を打つまでの間 */
        const val SETTLE_MS = 280L
        /** 「待った」の返事を待つ長さ */
        const val UNDO_WAIT_MS = 20_000L
        /** CPU の手番の長さの倍率(短め・普通・長め) */
        val PACE = floatArrayOf(0.45f, 1f, 2f)
        /** 盤が応えない時に「描き終わり待ち」を外すまでの時間 */
        const val PENDING_LIMIT_MS = 2500L
    }
}
