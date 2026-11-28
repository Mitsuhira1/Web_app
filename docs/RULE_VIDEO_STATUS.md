# ルール説明の動画 作り直しのチェックリスト

ルール画面の動画(`web/pc-firebase/assets/rule-steps/`)を、新しい作り方で作り直したかどうかの一覧。
作り方は [`docs/RULE_VIDEO_GUIDE_FOR_AI.md`](RULE_VIDEO_GUIDE_FOR_AI.md)、ほかの AI への依頼文は [`docs/RULE_VIDEO_PROMPT_FOR_AI.md`](RULE_VIDEO_PROMPT_FOR_AI.md)。

- **[x] 更新済み**: 新しい作り方(実際の対局画面を録画・1 本目は「何をするゲーム?」・注釈の決まりを守る)で作り直し、ユーザーの OK のあと公開した物。
- **[ ] 未更新**: まだ以前の作り方の動画(3 本ずつ)。手引きの 2 章「以前の動画の、だめだった所」がそのまま残っている。
- 作業を始める時: 下の行の末尾に「(作業中: AI の名前・日付)」と書いてコミットする(2 つの AI が同じゲームを作らないため)。
- 作り終えて公開したら: `[ ]` を `[x]` にし、本数・動画の名前・台本・公開日・作った AI を書く。手引き 10 章の表も直す。
- 並びはメニューの順(`js/app.js` の `ORDER`)。ID は `js/rules-steps.js` の名前。見本の HTML(`docs/mockups/rules-video/<名前>-rules.html`)が ID と違う物は「見本」に書いた。

最終更新: 2026-11-28(更新済み 3 / 全 61)

## 一覧
- [x] **将棋**(`shogi`) — 7 本 `sh-v2-step1` `sh-v2-step2` `sh-v2-step3` `sh-v2-step4` `sh-v2-step5` `sh-v2-step6` `sh-v2-step7` ・台本 `tools/rule_video/shogi.cjs` ・2026-11-28 公開(Claude)
- [ ] **5五将棋**(`gogo`) — 旧版 3 本 `gg-step1` `gg-step2` `gg-step3`
- [ ] **リバーシ**(`reversi`) — 旧版 3 本 `rv-step1` `rv-step2` `rv-step3`
- [ ] **コネクトフォー**(`connect4`) — 旧版 3 本 `c4-step1` `c4-step2` `c4-step3`
- [ ] **五目ならべ**(`gomoku`) — 旧版 3 本 `gm-step1` `gm-step2` `gm-step3`
- [ ] **ヘックス**(`hex`) — 旧版 3 本 `hx-step1` `hx-step2` `hx-step3`
- [x] **マンカラ**(`mancala`) — 6 本 `mc-v3-step1` `mc-v2-step2` `mc-v2-step3` `mc-v2-step4` `mc-v2-step5` `mc-v2-step6` ・台本 `tools/rule_video/mancala.cjs` ・2026-11-28 公開(Claude)
- [ ] **ナインメンズモリス**(`morris`) — 旧版 3 本 `mr-step1` `mr-step2` `mr-step3`
- [ ] **チェッカー**(`checkers`) — 旧版 3 本 `ck-step1` `ck-step2` `ck-step3`
- [ ] **チェス**(`chess`) — 旧版 3 本 `ch-step1` `ch-step2` `ch-step3`
- [ ] **ドット＆ボックス**(`dots`) — 旧版 3 本 `dt-step1` `dt-step2` `dt-step3`
- [ ] **ヒット＆ブロー**(`hitblow`) — 旧版 3 本 `hb-step1` `hb-step2` `hb-step3`
- [ ] **ウサギと猟犬**(`hare`) — 旧版 3 本 `hr-step1` `hr-step2` `hr-step3`
- [ ] **チャイニーズチェッカー**(`chinese`) — 旧版 3 本 `chx-step1` `chx-step2` `chx-step3`
- [ ] **ルドー**(`ludo`) — 旧版 3 本 `lu-step1` `lu-step2` `lu-step3`
- [ ] **バックギャモン**(`backgammon`) — 旧版 3 本 `bg-step1` `bg-step2` `bg-step3`
- [ ] **碁**(`go`) — 旧版 3 本 `go-step1` `go-step2` `go-step3`
- [ ] **ヨット**(`yacht`) — 旧版 3 本 `ya-step1` `ya-step2` `ya-step3`
- [ ] **麻雀**(`mahjong`) — 旧版 3 本 `mj-step1` `mj-step2` `mj-step3`・見本 `mj-rules.html`
- [ ] **人生すごろく**(`life`) — 旧版 3 本 `lf-step1` `lf-step2` `lf-step3`
- [ ] **花札**(`hanafuda`) — 旧版 3 本 `hn-step1` `hn-step2` `hn-step3`
- [ ] **7ならべ**(`sevens`) — 旧版 3 本 `sv-step1` `sv-step2` `sv-step3`
- [ ] **神経衰弱**(`memory`) — 旧版 3 本 `mm-step1` `mm-step2` `mm-step3`
- [ ] **スピード**(`speed`) — 旧版 3 本 `sd-step1` `sd-step2` `sd-step3`
- [ ] **ポーカー**(`poker`) — 旧版 3 本 `po-step1` `po-step2` `po-step3`
- [ ] **テキサスポーカー**(`holdem`) — 旧版 3 本 `tp-step1` `tp-step2` `tp-step3`・見本 `texas-rules.html`
- [ ] **ブラックジャック**(`blackjack`) — 旧版 3 本 `bj-step1` `bj-step2` `bj-step3`
- [x] **大富豪**(`daifugo`) — 8 本 `df-v2-step1` `df-v2-step2` `df-v2-step3` `df-v2-step4` `df-v2-step5` `df-v3-step6` `df-v2-step7` `df-v2-step8` ・台本 `tools/rule_video/daifugo.cjs` ・2026-11-28 公開(Claude)
- [ ] **Oh, No!**(`uno`) — 旧版 3 本 `ohno-step1` `ohno-step2-v2` `ohno-step3`・見本 `ohno-rules.html`
- [ ] **ソリティア**(`solitaire`) — 旧版 3 本 `so-step1` `so-step2` `so-step3`
- [ ] **スパイダー(ソリティアの種類)**(`spider`) — 旧版 3 本 `sp-step1` `sp-step2` `sp-step3`
- [ ] **スライドパズル**(`slide`) — 旧版 3 本 `sl-step1` `sl-step2` `sl-step3`
- [ ] **ぶにょぶにょ**(`bunyo`) — 旧版 3 本 `bu-step1` `bu-step2` `bu-step3`
- [ ] **パクリス**(`pakuris`) — 旧版 3 本 `pk-step1` `pk-step2` `pk-step3`
- [ ] **マインスイーパー**(`mine`) — 旧版 3 本 `mn-step1` `mn-step2` `mn-step3`
- [ ] **マインスイーパー対戦(マインスイーパーの種類)**(`mineVersus`) — 旧版 3 本 `mb-step1-v2` `mb-step2-v2` `mb-step3-v2`・見本 `mine-versus-rules.html`
- [ ] **坊主めくり**(`bozu`) — 旧版 3 本 `bz-step1` `bz-step2` `bz-step3`
- [ ] **人狼**(`wolf`) — 旧版 3 本 `wf-step1` `wf-step2` `wf-step3`
- [ ] **ルーレット**(`roulette`) — 旧版 3 本 `rl-step1` `rl-step2-v2` `rl-step3-v4`
- [ ] **戦争**(`war`) — 旧版 3 本 `war-step1-v3` `war-step2` `war-step3-v2`
- [ ] **たこやき**(`takoyaki`) — 旧版 3 本 `tk-step1-v2` `tk-step2` `tk-step3`
- [ ] **ぶたのしっぽ**(`butanoshippo`) — 旧版 3 本 `bn-step1` `bn-step2` `bn-step3`
- [ ] **ババ抜き**(`oldmaid`) — 旧版 3 本 `om-step1-v2` `om-step2` `om-step3`
- [ ] **ハーツ**(`hearts`) — 旧版 3 本 `ht-step1-v3` `ht-step2` `ht-step3`
- [ ] **ジンラミー**(`ginrummy`) — 旧版 3 本 `gn-step1-v2` `gn-step2` `gn-step3`
- [ ] **ハゲタカのえじき**(`vulture`) — 旧版 3 本 `vt-step1-v3` `vt-step2` `vt-step3-v2`
- [ ] **ごいた**(`goita`) — 旧版 3 本 `gi-step1-v3` `gi-step2` `gi-step3-v2`
- [ ] **クアルト**(`quarto`) — 旧版 3 本 `qt-step1-v3` `qt-step2` `qt-step3`
- [ ] **ガイスター**(`geister`) — 旧版 3 本 `gs-step1-v3` `gs-step2` `gs-step3-v2`
- [ ] **ラミィキューブ**(`rummikub`) — 旧版 3 本 `rm-step1` `rm-step2-v2` `rm-step3`
- [ ] **ペグ・ソリティア**(`pegsolitaire`) — 旧版 3 本 `pg-step1` `pg-step2` `pg-step3`
- [ ] **胸毛絶体絶命**(`munage`) — 旧版 3 本 `mg-step1` `mg-step2` `mg-step3`
- [ ] **コヨーテ**(`coyote`) — 旧版 3 本 `cy-step1-v2` `cy-step2-v3` `cy-step3-v2`
- [ ] **スカル**(`skull`) — 旧版 3 本 `sk-step1-v3` `sk-step2-v2` `sk-step3-v2`
- [ ] **ライアーズダイス**(`liarsdice`) — 旧版 3 本 `ld-step1-v2` `ld-step2` `ld-step3`
- [ ] **インカの黄金**(`incangold`) — 旧版 3 本 `ig-step1-v3` `ig-step2-v4` `ig-step3`
- [ ] **6ニムト**(`take6`) — 旧版 3 本 `t6-step1-v3` `t6-step2` `t6-step3-v2`
- [ ] **ブロックス**(`blokus`) — 旧版 3 本 `bk-step1-v3` `bk-step2-v2` `bk-step3-v2`
- [ ] **コリドール**(`quoridor`) — 旧版 3 本 `qd-step1-v2` `qd-step2-v3` `qd-step3-v2`
- [ ] **バトルシップ**(`battleship`) — 旧版 3 本 `bs-step1-v2` `bs-step2` `bs-step3-v2`
- [ ] **チンチロリン**(`chinchiro`) — 旧版 3 本 `cc-step1-v6` `cc-step2-v5` `cc-step3-v5`

