'use strict';
// メニューのアイコンを、前もって作った画像に置き換える(tools/build_game_icons.cjs が作る。手で直さない)。
// その場で SVG の図形とフィルターを計算しないので、メニューの描画とスクロールが軽くなる。
// 元の SVG は window.__AR_SVG に残す(画像を作り直す時に使う)。
(() => {
  const ids = ["mancala","dots","yacht","connect4","hitblow","morris","hex","checkers","hare","gomoku","chinese","ludo","backgammon","reversi","chess","shogi","minishogi","go","mahjong","life","hanafuda","daifugo","sevens","speed","memory","blackjack","holdem","poker","uno","solitaire","war","takoyaki","butanoshippo","oldmaid","hearts","ginrummy","vulture","goita","geister","rummikub","roulette","slide","bunyo","pakuris","mine","mineVersus"];
  window.__AR_SVG = window.__AR_SVG || {};
  for (const id of ids) { if (!(id in window.__AR_SVG)) window.__AR_SVG[id] = AR[id]; AR[id] = photoIcon(id); }
})();
