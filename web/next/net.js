// ブラウザの通信部品。WebRTC(招待コード/返信コードの手動交換)と、中継サーバー(ntfy)への HTTP。
// 部屋・招待コードの形式・手の受け渡しは Kotlin 側(core)。ここは「つなぐ」「送る」「受ける」だけ。
const ICE = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun.cloudflare.com:3478" }];
const GATHER_MS = 4000, CONNECT_MS = 60000, WAIT_HOST_MS = 30 * 60000, PULSE_MS = 7000;

export function createNet(core, hooks) {
  let seq = 1;
  const peers = new Map();
  window.__asobiPeers = peers; // 動作確認用(つながり具合を見る)

  const notify = () => { try { core.netInviteEvent(); } catch (e) { console.error(e); } };
  const gathered = (pc, ms) => new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") return resolve();
    const t = setTimeout(done, ms);
    function done() { clearTimeout(t); pc.removeEventListener("icegatheringstatechange", on); resolve(); }
    function on() { if (pc.iceGatheringState === "complete") done(); }
    pc.addEventListener("icegatheringstatechange", on);
  });

  function newPeer() {
    const id = "w" + seq++;
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const ch = pc.createDataChannel("game", { ordered: true, negotiated: true, id: 0 });
    const p = { id, pc, ch, state: "PENDING", wasOpen: false, template: "", timer: null, pulse: null };
    ch.onopen = () => { if (p.state === "PENDING") { p.state = "OPEN"; p.wasOpen = true; clearTimers(p); core.netLinked(id); notify(); } };
    ch.onclose = () => lost(p);
    ch.onmessage = (e) => { if (p.state === "OPEN" && typeof e.data === "string") core.netText(id, e.data); };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") lost(p);
    };
    peers.set(id, p);
    return p;
  }
  function clearTimers(p) { clearTimeout(p.timer); clearInterval(p.pulse); p.timer = null; p.pulse = null; }
  function lost(p) {
    if (p.state === "GONE" || p.state === "FAILED") return;
    const was = p.wasOpen;
    clearTimers(p);
    p.state = was ? "GONE" : "FAILED";
    try { p.ch.close(); p.pc.close(); } catch {}
    if (was) core.netUnlinked(p.id); else core.netLinkFailed(p.id);
    notify();
  }
  function startTimeout(p, ms) {
    clearTimeout(p.timer);
    p.timer = setTimeout(() => lost(p), ms);
  }
  function startPulses(p, sdp) {
    const lines = sdp.replace(/\r/g, "").split("\n").filter((l) => l.startsWith("a=candidate:")).map((l) => l.slice(2));
    const mid = (sdp.match(/a=mid:(\S+)/) || [, "0"])[1];
    clearInterval(p.pulse);
    p.pulse = setInterval(() => {
      if (p.state !== "PENDING") return clearInterval(p.pulse);
      for (const c of lines) p.pc.addIceCandidate({ candidate: c, sdpMid: mid, sdpMLineIndex: 0 }).catch(() => {});
    }, PULSE_MS);
  }

  const backend = {
    async createInvite(cb) {
      try {
        const p = newPeer();
        const offer = await p.pc.createOffer();
        await p.pc.setLocalDescription(offer);
        await gathered(p.pc, GATHER_MS);
        p.template = p.pc.localDescription.sdp;
        startTimeout(p, WAIT_HOST_MS);
        cb(p.id, core.rtcEncode(true, p.template), null);
      } catch (e) { cb(null, null, "招待コードを作れませんでした(" + (e && e.name || "エラー") + ")"); }
    },
    async acceptReply(id, code, cb) {
      const p = peers.get(id);
      if (!p) return cb("この招待はもう使えません");
      try {
        const r = core.rtcDecode(code, false, p.template);
        if (r.startsWith("ERR:")) return cb(r.slice(4));
        await p.pc.setRemoteDescription({ type: "answer", sdp: r.slice(3) });
        startTimeout(p, CONNECT_MS);
        cb(null);
      } catch (e) { cb("返信コードを受け付けられませんでした(" + (e && e.name || "エラー") + ")"); }
    },
    async acceptInvite(code, cb) {
      let p;
      try {
        p = newPeer();
        const tmpl = await p.pc.createOffer(); // 自分の SDP の雛形
        const r = core.rtcDecode(code, true, tmpl.sdp);
        if (r.startsWith("ERR:")) { lost0(p); return cb(null, null, r.slice(4)); }
        const remote = r.slice(3);
        await p.pc.setRemoteDescription({ type: "offer", sdp: remote });
        const ans = await p.pc.createAnswer();
        await p.pc.setLocalDescription(ans);
        await gathered(p.pc, GATHER_MS);
        startTimeout(p, WAIT_HOST_MS);
        startPulses(p, remote);
        cb(p.id, core.rtcEncode(false, p.pc.localDescription.sdp), null);
      } catch (e) { if (p) lost0(p); cb(null, null, "返信コードを作れませんでした(" + (e && e.name || "エラー") + ")"); }
    },
    sendTo(id, text) { const p = peers.get(id); if (p && p.state === "OPEN") { try { p.ch.send(text); } catch {} } },
    disconnect(id) { const p = peers.get(id); if (p) { peers.delete(id); clearTimers(p); p.state = "GONE"; try { p.ch.close(); p.pc.close(); } catch {} } },
    closeAll() { for (const id of [...peers.keys()]) backend.disconnect(id); },
    linkState(id) { const p = peers.get(id); return p ? p.state : "GONE"; },
  };
  function lost0(p) { peers.delete(p.id); clearTimers(p); try { p.pc.close(); } catch {} }

  // ---------------------------------------------------------------- 中継(ntfy)
  const BASE = "https://ntfy.sh";
  const relay = {
    async publish(topic, message, cb) {
      const waits = [2000, 5000, 10000];
      for (let i = 0; ; i++) {
        try {
          const r = await fetch(`${BASE}/${topic}`, { method: "POST", body: message, headers: { "Content-Type": "text/plain; charset=utf-8" } });
          if (r.ok) return cb(null);
          if (r.status !== 429 && r.status < 500) return cb("中継サーバーに置けませんでした(" + r.status + ")");
        } catch { /* つながらない → やり直す */ }
        if (i >= waits.length) return cb("中継サーバーにつながりません");
        await new Promise((res) => setTimeout(res, waits[i]));
      }
    },
    subscribe(topic, onStatus, onMessage) {
      let es = null, closed = false, last = null;
      const seen = new Set();
      const open = () => {
        if (closed) return;
        es = new EventSource(`${BASE}/${topic}/sse` + (last ? `?since=${encodeURIComponent(last)}` : "?since=all"));
        es.onopen = () => onStatus(true);
        es.onerror = () => { onStatus(false); };
        es.onmessage = (e) => {
          try {
            const m = JSON.parse(e.data);
            if (m.event !== "message" || seen.has(m.id)) return;
            seen.add(m.id); last = m.id;
            onMessage(m.message);
          } catch {}
        };
      };
      open();
      return { close() { closed = true; try { es && es.close(); } catch {} } };
    },
  };

  core.netInit(backend, relay, hooks);
  return { backend, relay };
}
