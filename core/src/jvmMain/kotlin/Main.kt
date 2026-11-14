import jp.yonekou.asobi26.core.CrossCheck
import jp.yonekou.asobi26.core.net.NetCheck
fun main(args: Array<String>) {
    when (args.firstOrNull()) {
        "crypto" -> print(cryptoCheck())
        "net" -> print(NetCheck.report())
        "yacht" -> print(yachtCheck())
        else -> print(CrossCheck.report(seeds = 3, cpuMoves = args.firstOrNull()?.toIntOrNull() ?: 0))
    }
}
