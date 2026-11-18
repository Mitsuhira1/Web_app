/* 絵の部品(見本 docs/ui-sample-pc.html から): アイコン・スタンプ・プレイヤーのアイコン・札・牌・盤の素材・演出 */
const $ = (s, r=document) => r.querySelector(s);
document.documentElement.lang='ja';
const IC = {
  games:'<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
  room:'<circle cx="8" cy="9" r="3"/><circle cx="17" cy="10" r="2.4"/><path d="M2.5 19c.6-3.2 2.8-5 5.5-5s4.900 1.800 5.500 5M14.500 14.300c.8-.5 1.600-.7 2.500-.7 2.200 0 3.900 1.500 4.500 4"/>',
  rec:'<path d="M5 20V11M12 20V4M19 20v-6"/>',
  set:'<circle cx="12" cy="12" r="3"/><path d="M12 3v2.500M12 18.500V21M3 12h2.500M18.500 12H21M5.600 5.600l1.800 1.800M16.600 16.600l1.800 1.800M5.600 18.400l1.800-1.800M16.600 7.400l1.800-1.800"/>',
  play:'<path d="M8 5.500v13l10.500-6.500z" fill="currentColor"/>',
  back:'<path d="M14.500 5.500L8 12l6.500 6.500"/>',
  undo:'<path d="M8 5L4 9l4 4"/><path d="M4 9h10a5 5 0 010 10h-3"/>',
  book:'<path d="M5 5.500C5 4.700 5.700 4 6.500 4H19v14H6.500C5.700 18 5 18.700 5 19.500zM5 19.500c0 .8.7 1.500 1.500 1.500H19"/>',
  flag:'<path d="M6 21V4M6 5c4-2 6 2 11 0v8c-5 2-7-2-11 0"/>',
  list:'<path d="M9 7h11M9 12h11M9 17h11"/><circle cx="4.500" cy="7" r=".8"/><circle cx="4.500" cy="12" r=".8"/><circle cx="4.500" cy="17" r=".8"/>',
  turn:'<path d="M19 12a7 7 0 11-2.500-5.300"/><path d="M17 3v4h-4"/>',
  copy:'<rect x="8" y="8" width="11" height="12" rx="2.500"/><path d="M5 15V6.500C5 5.100 6.100 4 7.500 4H14"/>',
  pause:'<path d="M9 6.500v11M15 6.500v11" stroke-width="2.600"/>',
  prev:'<path d="M6.500 6.500v11"/><path d="M18 6.500v11L10 12z" fill="currentColor"/>',
  next:'<path d="M17.500 6.500v11"/><path d="M6 6.500v11L14 12z" fill="currentColor"/>',
  rep:'<path d="M16.500 3.500l3 3-3 3"/><path d="M19.500 6.500H8a4 4 0 00-4 4v1M7.500 20.500l-3-3 3-3"/><path d="M4.500 17.500H16a4 4 0 004-4v-1"/>',
  g_all:'<circle cx="7.500" cy="17" r="2.500"/><circle cx="17" cy="15" r="2.500"/><path d="M10 17V6.500l9.500-2V15"/>',
  g_mn:'<path d="M4.500 11.500L12 5l7.500 6.500M6.500 10.500V19h11v-8.500"/>',
  g_wa:'<path d="M4 7c5 1.500 11 1.500 16 0M6 11.500h12M8 7.800V20M16 7.800V20"/>',
  g_ch:'<path d="M12 2.500v2.500M9 5h6M12 19v2.500M9 19h6"/><ellipse cx="12" cy="12" rx="6.500" ry="7"/><path d="M12 5v14M8.800 6.500c-1.200 3.500-1.200 7.500 0 11M15.200 6.500c1.200 3.500 1.200 7.500 0 11"/>',
  g_yo:'<path d="M5 9l3.500 4L12 6.500l3.500 6.500L19 9l-1.500 9.500h-11z"/>',
  g_cd:'<path d="M12 4C9 8 5.500 10 5.500 13.500a3.200 3.200 0 006 1.500h1a3.200 3.200 0 006-1.500C18.500 10 15 8 12 4zM12 15v5M9.500 20h5"/>',
  smile:'<circle cx="12" cy="12" r="8.500"/><path d="M8.500 13.500c1 1.600 2.200 2.300 3.500 2.300s2.500-.7 3.500-2.300"/><circle cx="9.300" cy="10" r=".6" fill="currentColor"/><circle cx="14.700" cy="10" r=".6" fill="currentColor"/>',
  refresh:'<path d="M20.5 12a8.5 8.5 0 1 1-2.4-5.95"/><path d="M20.5 3.8v4.8h-4.8"/>',
  chat:'<path d="M20 11.2c0 4-3.6 7.3-8 7.3-1.3 0-2.6-.3-3.7-.8L4 19.3l1.1-3.6A6.8 6.8 0 0 1 4 11.2C4 7.2 7.6 4 12 4s8 3.2 8 7.2z"/><circle cx="8.8" cy="11.2" r=".9" fill="currentColor" stroke="none"/><circle cx="12" cy="11.2" r=".9" fill="currentColor" stroke="none"/><circle cx="15.2" cy="11.2" r=".9" fill="currentColor" stroke="none"/>',
};
const ic = n => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${IC[n]}</svg>`;

/* ---- タイルの絵(Android 版のデザイン資料の絵を使い回し。足りない分は同じ描き方) ---- */
const W='<linearGradient id="w1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7b5233"/><stop offset="1" stop-color="#5a3a22"/></linearGradient><linearGradient id="f1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c6b4d"/><stop offset="1" stop-color="#1f5139"/></linearGradient><linearGradient id="m1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8cf9f"/><stop offset="1" stop-color="#d7b77e"/></linearGradient><radialGradient id="k1" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#8a8a90"/><stop offset="1" stop-color="#101014"/></radialGradient><radialGradient id="k2" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#c9c4b6"/></radialGradient><radialGradient id="r1" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffb3a8"/><stop offset="1" stop-color="#a1261c"/></radialGradient><radialGradient id="b1" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#a9c8f5"/><stop offset="1" stop-color="#1f4fa3"/></radialGradient><linearGradient id="iv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffdf5"/><stop offset="1" stop-color="#ece4cf"/></linearGradient><linearGradient id="km" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3dca8"/><stop offset="1" stop-color="#deba74"/></linearGradient>';
const A=(bg,body)=>`<svg viewBox="0 0 100 100"><defs>${W}</defs><rect width="100" height="100" fill="${bg}"/>${body}</svg>`;
const st=(x,y,r,g)=>`<circle cx="${x}" cy="${y+1.5}" r="${r}" fill="#000" opacity=".3"/><circle cx="${x}" cy="${y}" r="${r}" fill="url(#${g})"/>`;
const pc=(x,y,r,s,red,w=26,rot=0)=>`<g transform="rotate(${rot} ${x+w/2} ${y+w*.7})"><rect x="${x}" y="${y+2}" width="${w}" height="${w*1.4}" rx="3" fill="#000" opacity=".3"/><rect x="${x}" y="${y}" width="${w}" height="${w*1.4}" rx="3" fill="#fffdf7"/><text x="${x+w*.15}" y="${y+w*.45}" font-size="${w*.42}" font-weight="900" fill="${red?'#c8362e':'#1d2433'}">${r}</text><text x="${x+w/2}" y="${y+w*1.15}" font-size="${w*.6}" text-anchor="middle" fill="${red?'#c8362e':'#1d2433'}">${s}</text></g>`;
const AR={
 reversi:A('url(#w1)',`<rect x="14" y="14" width="72" height="72" rx="4" fill="url(#f1)"/>`+[1,2,3].map(i=>`<path d="M${14+i*18} 14V86M14 ${14+i*18}H86" stroke="#12301f" stroke-width="1"/>`).join('')+st(41,41,7.5,'k2')+st(59,41,7.5,'k1')+st(41,59,7.5,'k1')+st(59,59,7.5,'k2')),
 chess:A('#739552',`<rect x="0" y="0" width="50" height="50" fill="#ebecd0"/><rect x="50" y="50" width="50" height="50" fill="#ebecd0"/><ellipse cx="50" cy="84" rx="20" ry="5" fill="#000" opacity=".3"/><path d="M34 82H66V77Q57 73 56 60Q63 55 59 46Q55 39 52 39V34H56V30H52V25H48V30H44V34H48V39Q45 39 41 46Q37 55 44 60Q43 73 34 77Z" fill="#f4ead2" stroke="#6b5a3c" stroke-width="1.5"/>`),
 shogi:A('#e9c98a',`<path d="M0 50H100M50 0V100" stroke="#4a3520"/><path d="M50 16L68 25L74 80H26L32 25Z" transform="translate(1,3)" fill="#000" opacity=".3"/><path d="M50 16L68 25L74 80H26L32 25Z" fill="url(#km)" stroke="#8a6a35"/><text x="50" y="50" font-size="24" font-family="Yuji Boku,serif" text-anchor="middle" fill="#1c140c">王</text><text x="50" y="74" font-size="24" font-family="Yuji Boku,serif" text-anchor="middle" fill="#1c140c">将</text>`),
 go:A('#e3c078',[1,2,3].map(i=>`<path d="M${i*25} 0V100M0 ${i*25}H100" stroke="#3a2a14" stroke-width="1"/>`).join('')+st(50,50,10,'k1')+st(75,50,10,'k2')+st(50,25,10,'k2')+st(25,75,10,'k1')),
 mancala:A('#cdbb98',`<rect x="6" y="28" width="88" height="44" rx="14" fill="url(#w1)"/>`+[0,1,2,3].map(i=>`<circle cx="${26+i*16}" cy="41" r="6" fill="#3a2414"/><circle cx="${26+i*16}" cy="59" r="6" fill="#3a2414"/>`).join('')+st(26,40,3,'r1')+st(43,58,3,'b1')+st(58,41,3,'k2')+st(74,59,3,'r1')),
 ludo:A('#f6efdd',`<rect x="8" y="8" width="36" height="36" rx="6" fill="#3e9b63"/><rect x="56" y="8" width="36" height="36" rx="6" fill="#e0ae36"/><rect x="8" y="56" width="36" height="36" rx="6" fill="#c8463c"/><rect x="56" y="56" width="36" height="36" rx="6" fill="#3f78c4"/><rect x="40" y="40" width="20" height="20" rx="5" fill="url(#iv)" stroke="#b9ac8c"/><circle cx="46" cy="46" r="2" fill="#222"/><circle cx="54" cy="54" r="2" fill="#222"/><circle cx="50" cy="50" r="2" fill="#222"/>`),
 backgammon:A('url(#w1)',`<rect x="10" y="12" width="80" height="76" rx="3" fill="url(#f1)"/>`+[0,1,2,3].map(i=>`<polygon points="${14+i*19},12 ${30+i*19},12 ${22+i*19},48" fill="${i%2?'#e6d3a8':'#8a3b2a'}"/><polygon points="${14+i*19},88 ${30+i*19},88 ${22+i*19},52" fill="${i%2?'#8a3b2a':'#e6d3a8'}"/>`).join('')+st(22,22,7,'k2')+st(22,78,7,'k1')+st(79,78,7,'k2')),
 life:A('#9ad67c',`<circle cx="50" cy="46" r="30" fill="#fff" stroke="#4a3520" stroke-width="2"/>`+['#e2574c','#f2a541','#f4d35e','#7cc576','#3fa7b5','#4a7fd0','#7a4cc2','#c24c9a'].map((c,i)=>{const a=i*Math.PI/4-Math.PI/2,b=a+Math.PI/4;return `<path d="M50 46L${50+26*Math.cos(a)} ${46+26*Math.sin(a)}A26 26 0 0 1 ${50+26*Math.cos(b)} ${46+26*Math.sin(b)}Z" fill="${c}"/>`}).join('')+`<circle cx="50" cy="46" r="8" fill="#fff" stroke="#4a3520" stroke-width="2"/><rect x="10" y="82" width="80" height="12" fill="#fff8dc" stroke="#4a3520"/>`),
 mahjong:A('url(#f1)',[0,1,2].map(i=>`<rect x="${14+i*25}" y="31" width="22" height="42" rx="3" fill="#e2a23a"/><rect x="${14+i*25}" y="27" width="22" height="42" rx="3" fill="url(#iv)"/><text x="${25+i*25}" y="56" font-size="19" font-family="Yuji Boku,serif" text-anchor="middle" fill="${['#1d2433','#1f7a45','#b3261c'][i]}">${'東發中'[i]}</text>`).join('')),
 hanafuda:A('url(#f1)',`<g transform="rotate(-8 38 50)"><rect x="20" y="20" width="36" height="58" rx="3" fill="#15151a"/><rect x="22" y="22" width="32" height="54" fill="#c8362e"/><circle cx="38" cy="40" r="11" fill="#fff"/><path d="M22 76V62Q38 50 54 62V76Z" fill="#1c1c22"/></g><g transform="rotate(8 64 52)"><rect x="46" y="24" width="36" height="58" rx="3" fill="#15151a"/><rect x="48" y="26" width="32" height="54" fill="#f4ead0"/><circle cx="58" cy="38" r="6" fill="#f29bb5"/><circle cx="70" cy="34" r="6" fill="#f29bb5"/><rect x="48" y="56" width="32" height="24" fill="#c8362e"/></g>`),
 poker:A('url(#f1)',pc(18,24,'A','♠',0,30,-10)+pc(50,26,'K','♥',1,30,8)),
 holdem:A('#22262f',`<ellipse cx="50" cy="52" rx="44" ry="34" fill="url(#w1)"/><ellipse cx="50" cy="52" rx="38" ry="28" fill="url(#f1)"/>`+pc(30,34,'A','♥',1,18)+pc(52,34,'A','♠',0,18)+`<ellipse cx="50" cy="74" rx="8" ry="3.4" fill="#c8362e" stroke="#fff" stroke-dasharray="2 2"/><ellipse cx="50" cy="71" rx="8" ry="3.4" fill="#c8362e" stroke="#fff" stroke-dasharray="2 2"/>`),
 daifugo:A('url(#f1)',pc(12,30,'2','♠',0,26,-12)+pc(37,26,'A','♦',1,26,0)+pc(62,30,'K','♣',0,26,12)),
 uno:A('url(#f1)',`<g transform="rotate(-10 36 50)"><rect x="18" y="22" width="36" height="54" rx="5" fill="#fff"/><rect x="21" y="25" width="30" height="48" rx="3" fill="#2f6fd0"/><path d="M36 37L46 49L36 61L26 49Z" fill="#fff"/><text x="36" y="55" font-size="15" font-weight="900" text-anchor="middle" fill="#2f6fd0">7</text></g><g transform="rotate(10 64 52)"><rect x="46" y="26" width="36" height="54" rx="5" fill="#fff"/><rect x="49" y="29" width="30" height="48" rx="3" fill="#e0453a"/><path d="M64 41L74 53L64 65L54 53Z" fill="#fff"/><text x="64" y="58" font-size="12" font-weight="900" text-anchor="middle" fill="#e0453a">+2</text></g>`),
 hex:A('#b98952',[[35,34],[57,34],[46,53],[68,53],[24,53],[35,72],[57,72]].map(([x,y])=>`<path d="M${x} ${y-12}L${x+10.4} ${y-6}V${y+6}L${x} ${y+12}L${x-10.4} ${y+6}V${y-6}Z" fill="url(#m1)" stroke="#7a5a34"/>`).join('')+st(46,52,7,'r1')+st(57,33,7,'b1')),
};
Object.assign(AR,{
 minishogi:A('#e9c98a',[1,2,3,4].map(i=>`<path d="M${i*20} 0V100M0 ${i*20}H100" stroke="#4a3520" stroke-width=".8"/>`).join('')+[[30,58,'飛',0],[70,42,'角',180]].map(([x,y,c,r])=>`<g transform="rotate(${r} ${x} ${y})"><path d="M${x} ${y-20}L${x+12} ${y-14}L${x+16} ${y+20}H${x-16}L${x-12} ${y-14}Z" transform="translate(1,2)" fill="#000" opacity=".3"/><path d="M${x} ${y-20}L${x+12} ${y-14}L${x+16} ${y+20}H${x-16}L${x-12} ${y-14}Z" fill="url(#km)" stroke="#8a6a35"/><text x="${x}" y="${y+10}" font-size="20" font-family="Yuji Boku,serif" text-anchor="middle" fill="#1c140c">${c}</text></g>`).join('')),
 connect4:A('#cdbb98',`<rect x="10" y="16" width="80" height="72" rx="8" fill="#2f5fae"/>`+[0,1,2,3].map(r=>[0,1,2,3].map(c=>{const v=['....','..y.','.ry.','ryrr'][r][c];return `<circle cx="${22+c*19}" cy="${27+r*17}" r="6.500" fill="${v==='r'?'#c8463c':v==='y'?'#e0ae36':'#1c3a66'}"/>`}).join('')).join('')),
 gomoku:A('#e3c078',[1,2,3,4,5].map(i=>`<path d="M${i*16.6} 0V100M0 ${i*16.6}H100" stroke="#3a2a14" stroke-width=".8"/>`).join('')+[1,2,3,4,5].map(i=>st(i*16.6,100-i*16.6,7,'k1')).join('')+st(33.2,33.2,7,'k2')+st(66.4,66.4,7,'k2')),
 morris:A('url(#m1)',[[12,76],[26,48],[40,20]].map(([o,s])=>`<rect x="${o}" y="${o}" width="${s}" height="${s}" fill="none" stroke="#4a3520" stroke-width="2"/>`).join('')+`<path d="M50 12V40M50 60V88M12 50H40M60 50H88" stroke="#4a3520" stroke-width="2"/>`+st(12,12,6,'k1')+st(50,12,6,'k1')+st(88,12,6,'k1')+st(26,50,6,'k2')+st(60,60,6,'k2')),
 checkers:A('#e8cf9f',[0,1,2,3].map(r=>[0,1,2,3].map(c=>(r+c)%2?`<rect x="${c*25}" y="${r*25}" width="25" height="25" fill="#5a3a22"/>`:'').join('')).join('')+st(37.5,12.5,9,'r1')+st(87.5,12.5,9,'r1')+st(12.5,87.5,9,'k1')+st(62.5,87.5,9,'k1')+st(62.5,37.5,9,'r1')),
 dots:A('#f6efdd',`<rect x="20" y="20" width="30" height="30" fill="#2f5fd0" opacity=".35"/><rect x="50" y="50" width="30" height="30" fill="#c8463c" opacity=".35"/><path d="M20 20H50V50H20ZM50 20H80" fill="none" stroke="#2f5fd0" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M50 50H80V80H50ZM20 80H50" fill="none" stroke="#c8463c" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`+[0,1,2].map(r=>[0,1,2].map(c=>`<circle cx="${20+c*30}" cy="${20+r*30}" r="4.500" fill="#f6efdd" stroke="#4a3520" stroke-width="2"/>`).join('')).join('')),
 hitblow:A('url(#w1)',[3,8,1,5].map((d,i)=>`<rect x="${9+i*21.5}" y="24" width="18" height="26" rx="3" fill="url(#iv)" stroke="#b9ac8c"/><text x="${18+i*21.5}" y="43" font-size="16" font-weight="900" text-anchor="middle" fill="#1d2433">${d}</text>`).join('')+st(34,70,6,'r1')+st(50,70,6,'r1')+st(66,70,6,'k2')),
 hare:A('url(#m1)',`<path d="M12 50L36 24H64L88 50L64 76H36ZM36 24V76M64 24V76M12 50H88M36 24L64 76M64 24L36 76" fill="none" stroke="#4a3520" stroke-width="1.500"/>`+st(12,50,7,'k1')+st(36,24,7,'k1')+st(36,76,7,'k1')+st(64,50,8,'k2')),
 chinese:A('#b98952',`<path d="M50 8L62 32H88L74 54L88 76H62L50 96L38 76H12L26 54L12 32H38Z" fill="url(#m1)" stroke="#7a5a34"/>`+st(50,22,5,'r1')+st(44,34,5,'r1')+st(56,34,5,'r1')+st(50,84,5,'b1')+st(44,72,5,'b1')+st(56,72,5,'b1')+st(50,53,5,'k2')),
 yacht:A('url(#f1)',[[18,30,[[9,9],[27,27],[18,18]]],[50,40,[[9,9],[27,9],[9,27],[27,27],[18,18]]]].map(([x,y,p])=>`<rect x="${x}" y="${y+2}" width="36" height="36" rx="8" fill="#000" opacity=".3"/><rect x="${x}" y="${y}" width="36" height="36" rx="8" fill="url(#iv)" stroke="#b9ac8c"/>`+p.map(([a,b])=>`<circle cx="${x+a}" cy="${y+b}" r="3.200" fill="#1d2433"/>`).join('')).join('')),
 sevens:A('url(#f1)',pc(8,32,'6','♦',1,26)+pc(37,32,'7','♦',1,26)+pc(66,32,'8','♦',1,26)),
 memory:A('url(#f1)',[[10,12],[40,12],[70,12]].map(([x,y])=>`<rect x="${x}" y="${y+2}" width="24" height="34" rx="3" fill="#000" opacity=".3"/><rect x="${x}" y="${y}" width="24" height="34" rx="3" fill="#b4332b" stroke="#f4ead0" stroke-width="2"/>`).join('')+pc(24,54,'5','♥',1,24)+pc(56,54,'5','♠',0,24)),
 speed:A('url(#f1)',pc(14,30,'7','♣',0,28,-6)+pc(56,30,'8','♥',1,28,6)+`<path d="M6 20H22M2 30H14M78 84H94M86 74H98" stroke="#ffc65c" stroke-width="3" stroke-linecap="round"/>`),
 blackjack:A('url(#f1)',pc(16,34,'A','♠',0,28,-8)+pc(48,34,'J','♥',1,28,8)+`<text x="50" y="26" font-size="20" font-weight="900" text-anchor="middle" fill="#ffc65c">21</text>`),
 solitaire:A('url(#f1)',[['K','♠',0],['Q','♥',1],['J','♣',0],['10','♦',1]].map(([r,s,red],i)=>pc(34,10+i*13,r,s,red,32)).join('')),
});
const art=id=>AR[id];
/* ---- スタンプ(27 種。駒の形のキャラクター+文字。内容ごとに地・表情・書体を変える) ---- */
const SK='#4A3220', SF={maru:"'Zen Maru Gothic',sans-serif",dela:"'Dela Gothic One','Zen Maru Gothic',sans-serif",wa:"'Kaisei Tokumin',serif",yo:"'Cinzel',serif",mono:"ui-monospace,Consolas,monospace"};
const sL=(d,w=3.6)=>`<path d="${d}" fill-rule="evenodd" fill="none" stroke="${SK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const sStar=(x,y,r,f='#F2B21F')=>{let d='';for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,q=i%2?r*.45:r;d+=(i?'L':'M')+(x+Math.cos(a)*q).toFixed(1)+' '+(y+Math.sin(a)*q).toFixed(1);}return `<path d="${d}Z" fill="${f}" stroke="${SK}" stroke-width="1.6" stroke-linejoin="round"/>`;};
const sSpark=(x,y,r,f='#F2B21F')=>`<path d="M${x} ${y-r}Q${x} ${y} ${x+r} ${y}Q${x} ${y} ${x} ${y+r}Q${x} ${y} ${x-r} ${y}Q${x} ${y} ${x} ${y-r}Z" fill="${f}"/>`;
const sEye={
 dot:`<circle cx="47" cy="58" r="3.8"/><circle cx="73" cy="58" r="3.8"/>`,
 happy:sL('M40 60q7-10 14 0M66 60q7-10 14 0'), closed:sL('M40 56q7 8 14 0M66 56q7 8 14 0'), sleepy:sL('M40 59q7 4 14 0M66 59q7 4 14 0'),
 wide:`<circle cx="47" cy="57" r="8.5" fill="#fff" stroke="${SK}" stroke-width="2.6"/><circle cx="73" cy="57" r="8.5" fill="#fff" stroke="${SK}" stroke-width="2.6"/><circle cx="47" cy="58" r="3"/><circle cx="73" cy="58" r="3"/>`,
 star:sStar(47,57,9)+sStar(73,57,9), x:sL('M42 53l10 10M52 53l-10 10M68 53l10 10M78 53l-10 10',3.4), gt:sL('M42 52l9 6-9 6M78 52l-9 6 9 6',3.4),
 side:`<ellipse cx="47" cy="58" rx="8" ry="6.5" fill="#fff" stroke="${SK}" stroke-width="2.4"/><ellipse cx="73" cy="58" rx="8" ry="6.5" fill="#fff" stroke="${SK}" stroke-width="2.4"/><circle cx="50.5" cy="59.5" r="3"/><circle cx="76.5" cy="59.5" r="3"/>`+sL('M38 53.5h18M64 53.5h18',3.4),
 fire:sL('M38 49l16 6M82 49l-16 6',3.8)+`<circle cx="47" cy="60" r="3.8"/><circle cx="73" cy="60" r="3.8"/>`,
 shades:`<path d="M33 52h54v4q0 10-10 10h-7q-8 0-9-8h-2q-1 8-9 8h-7q-10 0-10-10z" fill="#1c1410" stroke="${SK}" stroke-width="2"/><path d="M40 56h8M67 56h8" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".7"/>`,
 blank:`<circle cx="47" cy="58" r="7" fill="#fff" stroke="${SK}" stroke-width="2.4"/><circle cx="73" cy="58" r="7" fill="#fff" stroke="${SK}" stroke-width="2.4"/>`,
 teary:`<circle cx="47" cy="58" r="8"/><circle cx="73" cy="58" r="8"/><circle cx="44.5" cy="55" r="3" fill="#fff"/><circle cx="70.5" cy="55" r="3" fill="#fff"/><circle cx="50" cy="61.5" r="1.5" fill="#fff"/><circle cx="76" cy="61.5" r="1.5" fill="#fff"/>`,
};
const sMouth={
 smile:sL('M50 72q10 9 20 0'), flat:sL('M52 75h16'), frown:sL('M50 79q10-9 20 0'), smirk:sL('M51 74q9 7 19-4'), wavy:sL('M47 76q4.3-6 8.600 0t8.600 0 8.600 0',3.2),
 open:`<path d="M47 70h26q-1 15-13 15T47 70z" fill="#7A2E22" stroke="${SK}" stroke-width="2.6" stroke-linejoin="round"/><path d="M53 81q7-6 14 0q-7 5-14 0z" fill="#F29B8A"/>`,
 grit:`<rect x="46" y="69" width="28" height="11" rx="3" fill="#fff" stroke="${SK}" stroke-width="2.6"/>`+sL('M53 69v11M60 69v11M67 69v11',1.8),
 o:`<ellipse cx="60" cy="76" rx="5" ry="6.5" fill="#7A2E22" stroke="${SK}" stroke-width="2.4"/>`,
 tongue:sL('M50 72q10 9 20 0')+`<path d="M58 77q8-1 7 6q-5 4-9-1z" fill="#F29B8A" stroke="${SK}" stroke-width="2"/>`,
 shout:`<path d="M44 67h32l-5 19H49z" fill="#7A2E22" stroke="${SK}" stroke-width="2.6" stroke-linejoin="round"/><path d="M47 69h26l-1 4H48z" fill="#fff"/>`,
};
const sEx={
 cheek:()=>`<circle cx="36" cy="69" r="5.5" fill="#F29B8A" opacity=".65"/><circle cx="84" cy="69" r="5.5" fill="#F29B8A" opacity=".65"/>`,
 brow:()=>sL('M40 47l13 2M67 45l13-3',3),
 sweat:()=>`<path d="M96 30q-7 10-3 15a5.500 5.500 0 0 0 9-3q0-5-6-12z" fill="#8CC4F0" stroke="${SK}" stroke-width="2"/>`,
 anger:()=>`<path d="M90 22q4 3 2 7M100 22q-4 3-2 7M90 40q4-3 2-7M100 40q-4-3-2-7" fill="none" stroke="#C8322B" stroke-width="3.2" stroke-linecap="round"/>`,
 q:()=>`<text x="98" y="38" font-size="30" font-weight="900" text-anchor="middle" font-family="${SF.maru}" fill="#F2B21F" stroke="${SK}" stroke-width="1.6">?</text>`,
 zzz:()=>`<text x="92" y="36" font-size="20" font-weight="900" font-family="${SF.maru}" fill="#E6DEFF">Z</text><text x="104" y="22" font-size="14" font-weight="900" font-family="${SF.maru}" fill="#E6DEFF">z</text><path d="M20 20a12 12 0 1 0 12 14a9.500 9.500 0 0 1-12-14z" fill="#F6D77A"/>`,
 heart:()=>`<path d="M96 42C80 30 84 16 96 24 108 16 112 30 96 42z" fill="#E5574F" stroke="${SK}" stroke-width="2.2" stroke-linejoin="round"/><path d="M22 34C14 28 16 21 22 25 28 21 30 28 22 34z" fill="#F29BB5"/>`,
 spark:()=>sSpark(20,26,9)+sSpark(102,22,7)+sSpark(106,62,5)+sSpark(14,64,5),
 conf:()=>[[16,20,'#E5574F',20],[102,18,'#3F78C4',-30],[108,50,'#F2B21F',40],[12,52,'#3E9B63',-15],[30,10,'#F2B21F',60],[88,8,'#E5574F',10]].map(([x,y,c,r])=>`<rect x="${x-4}" y="${y-2.5}" width="8" height="5" rx="1" fill="${c}" transform="rotate(${r} ${x} ${y})"/>`).join(''),
 arms:()=>sL('M26 64L10 44M94 64L110 44',5)+`<circle cx="9" cy="42" r="5.5" fill="#F2C79A" stroke="${SK}" stroke-width="2.2"/><circle cx="111" cy="42" r="5.5" fill="#F2C79A" stroke="${SK}" stroke-width="2.2"/>`,
 thumb:()=>`<path d="M98 66l3-12q2-5 6-3 3 2 1 7l-1 5h6q4 1 3 5l-2 10q-1 4-5 4H98z" fill="#F2C79A" stroke="${SK}" stroke-width="2.2" stroke-linejoin="round"/><rect x="90" y="65" width="8" height="18" rx="2" fill="#2F6B4E" stroke="${SK}" stroke-width="2"/>`,
 stop:()=>`<path d="M92 82V56q0-4 3.500-4t3.500 4v-8q0-4 3.500-4t3.500 4v2q0-4 3.500-4t3.500 4v6q0-3 3-3t3 3v20q0 12-12 12h-4q-9 0-11-6z" transform="translate(-6,-4)" fill="#F2C79A" stroke="${SK}" stroke-width="2.2" stroke-linejoin="round"/>`,
 tears:()=>`<path d="M41 64q-3 12-1 22M79 64q3 12 1 22" fill="none" stroke="#8CC4F0" stroke-width="6" stroke-linecap="round"/>`,
 flag:()=>sL('M100 92V34',3.6)+`<path d="M100 36q8-5 14 0v16q-6 5-14 0z" transform="translate(-14,0) scale(1)" fill="#fff" stroke="${SK}" stroke-width="2.2" stroke-linejoin="round"/>`,
 hourglass:()=>`<path d="M94 40h18M94 76h18" stroke="${SK}" stroke-width="3.6" stroke-linecap="round"/><path d="M96 42q0 12 7 16-7 4-7 16h14q0-12-7-16 7-4 7-16z" fill="#fff" stroke="${SK}" stroke-width="2.2" stroke-linejoin="round"/><path d="M99 72q4-6 8 0z" fill="#F2B21F"/><path d="M100 45h6l-3 7z" fill="#F2B21F"/>`,
 hband:()=>`<path d="M29 40Q60 30 91 40l1.500 7Q60 38 27.500 47z" fill="#E5574F" stroke="${SK}" stroke-width="2.2" stroke-linejoin="round"/><path d="M91 42l12-6-2 8 9 2-14 3z" fill="#E5574F" stroke="${SK}" stroke-width="2" stroke-linejoin="round"/>`,
 cup:()=>`<path d="M88 70h22v8q0 9-11 9t-11-9z" fill="#fff" stroke="${SK}" stroke-width="2.2" stroke-linejoin="round"/><path d="M110 72h3q4 0 4 4t-4 4h-4" fill="none" stroke="${SK}" stroke-width="2.2"/><path d="M88 73h22" stroke="#2F6B4E" stroke-width="3.5"/><path d="M95 64q-3-4 0-7M103 64q-3-4 0-7" fill="none" stroke="#B8A992" stroke-width="2.2" stroke-linecap="round"/>`,
 pray:()=>`<path d="M52 96q0-12 8-16 8 4 8 16z" fill="#F2C79A" stroke="${SK}" stroke-width="2.2" stroke-linejoin="round"/><path d="M60 81v14" stroke="${SK}" stroke-width="1.8"/>`,
 point:()=>sL('M92 66L108 50',5)+`<circle cx="110" cy="48" r="6" fill="#F2C79A" stroke="${SK}" stroke-width="2.2"/><path d="M112 44l8-8" stroke="${SK}" stroke-width="4.4" stroke-linecap="round"/><path d="M112 44l8-8" stroke="#F2C79A" stroke-width="2" stroke-linecap="round"/>`,
 hmouth:()=>`<path d="M70 86q-4-10 4-14 8-2 12 4l2 8q-6 8-18 2z" fill="#F2C79A" stroke="${SK}" stroke-width="2.2" stroke-linejoin="round"/>`,
 ghost:()=>`<path d="M60 4q10 0 10 10 0 6-6 9l4 5q-10 1-12-6-6-2-6-9 0-9 10-9z" fill="#fff" stroke="${SK}" stroke-width="2" stroke-linejoin="round" opacity=".92"/><circle cx="57" cy="13" r="1.4"/><circle cx="64" cy="13" r="1.4"/>`,
 crown:()=>`<path d="M40 24l5-18 9 10 6-13 6 13 9-10 5 18z" fill="#F2B21F" stroke="${SK}" stroke-width="2.4" stroke-linejoin="round"/><circle cx="60" cy="18" r="2.4" fill="#E5574F"/>`,
 lines:()=>sL('M12 30l10 6M108 30l-10 6M60 4v10M30 10l6 9M90 10l-6 9',3.4).replace(SK,'#C8322B'),
 bolt:()=>`<path d="M20 14l-8 20h8l-5 16 16-22h-8l6-14z" fill="#FFD45C" stroke="#1F2440" stroke-width="1.5" stroke-linejoin="round"/><path d="M104 10l-8 18h7l-5 14 14-20h-7l5-12z" fill="#FFD45C" stroke="#1F2440" stroke-width="1.5" stroke-linejoin="round"/>`,
 glitch:()=>[[14,40,22,5,'#FF4D6D'],[84,58,26,4,'#4DD9FF'],[30,84,18,4,'#6DFF9C'],[70,28,30,3,'#FF4D6D'],[8,66,14,6,'#4DD9FF']].map(([x,y,w,h,c])=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}" opacity=".85"/>`).join(''),
};
const sBg={none:()=>'',circle:c=>`<circle cx="60" cy="58" r="54" fill="${c}"/>`,rrect:c=>`<rect x="4" y="4" width="112" height="112" rx="20" fill="${c}"/>`,
 burst:c=>{let d='';for(let i=0;i<28;i++){const a=i*Math.PI/14,q=i%2?47:58;d+=(i?'L':'M')+(60+Math.cos(a)*q).toFixed(1)+' '+(58+Math.sin(a)*q).toFixed(1);}return `<path d="${d}Z" fill="${c}"/>`;}};
const KOMA='M60 20L86 33Q91 36 92 42L99 86Q100 96 91 96H29Q20 96 21 86L28 42Q29 36 34 33Z';
const sChar=(d,tint)=>`<path d="${KOMA}" transform="translate(0,3.500)" fill="#000" opacity=".2"/><path d="${KOMA}" fill="${tint||(d.body||['#F8E3B4'])[0]}" stroke="${tint||SK}" stroke-width="3.2" stroke-linejoin="round"/>${tint?'':`<path d="M26 85Q60 93 94 85l.6 3.500Q95 93 90 93H30Q25 93 25.400 88.500Z" fill="${(d.body||[0,'#E6C27E'])[1]}"/><g fill="${SK}">${sEye[d.ey]}${sMouth[d.mo]}</g>`}`;
function sText(t,y,size,font,fill,stroke='#fff'){ const est=[...t].reduce((n,c)=>n+(c.charCodeAt(0)<128?.6:1),0)*size;
  return `<text x="60" y="${y}" text-anchor="middle" font-family="${SF[font]}" font-size="${size}" font-weight="${font==='dela'||font==='mono'?400:900}" fill="${fill}" stroke="${stroke}" stroke-width="${size*(font==='dela'?.2:.28)}" paint-order="stroke" stroke-linejoin="round" ${est>108?'textLength="108" lengthAdjust="spacingAndGlyphs"':''}>${t}</text>`; }
const STAMPS=[
 ['よろしく',{bg:['circle','#DDEFD9'],ey:'happy',mo:'smile',ex:['cheek','spark'],t:['よろしく!',20,'maru','#2F6B4E']}],
 ['いい手！',{bg:['burst','#FFE08A'],ey:'star',mo:'open',ex:['cheek','thumb'],t:['いい手!',23,'dela','#C8322B']}],
 ['ありがとう',{bg:['circle','#FBD9E0'],ey:'closed',mo:'smile',ex:['cheek','heart'],t:['ありがとう',19,'maru','#C8436A']}],
 ['うれしい',{bg:['circle','#FFF0B8'],ey:'happy',mo:'open',ex:['cheek','arms','conf'],t:['うれしい〜',19,'maru','#D9822B']}],
 ['ぐぬぬ',{bg:['rrect','#F6C9BD'],body:['#F4B19E','#DE8A74'],ey:'fire',mo:'grit',ex:['anger'],t:['ぐぬぬ…',23,'dela','#8E1710']}],
 ['うーん',{bg:['circle','#DCE6F2'],ey:'dot',mo:'flat',ex:['brow','q'],t:['うーん…',20,'maru','#3F5F8A']}],
 ['まいった',{bg:['circle','#E6E2DA'],ey:'x',mo:'wavy',ex:['flag'],t:['まいった',21,'wa','#5a5348']}],
 ['待って',{bg:['burst','#FFD3A0'],ey:'wide',mo:'o',ex:['sweat','stop'],t:['待って!',23,'dela','#D9622B']}],
 ['ごめん',{bg:['circle','#D6E4F5'],rot:9,ey:'closed',mo:'frown',ex:['tears'],t:['ごめん…',20,'maru','#3F78C4']}],
 ['GG',{bg:['rrect','#2A221A'],ey:'happy',mo:'smile',ex:['spark','thumb'],t:['GG',27,'yo','#E9BB5C','#2A221A']}],
 ['おどろき',{bg:['burst','#FFF3B0'],ey:'wide',mo:'o',ex:['lines'],t:['えっ!?',24,'dela','#C8322B']}],
 ['はやく',{bg:['circle','#E9E0F5'],ey:'side',mo:'flat',ex:['hourglass'],t:['はやく〜',20,'maru','#6A4FB0']}],
 ['がんばれ',{bg:['burst','#FFB35C'],ey:'fire',mo:'shout',ex:['hband'],t:['がんばれ!',20,'dela','#C8322B']}],
 ['おつかれ',{bg:['circle','#DDEFD9'],ey:'closed',mo:'smile',ex:['cheek','cup'],t:['おつかれ',20,'maru','#2F6B4E']}],
 ['ねむい',{bg:['rrect','#3B3560'],ey:'sleepy',mo:'o',ex:['zzz'],t:['ねむい…',20,'maru','#E6DEFF','#3B3560']}],
 ['やったー',{bg:['burst','#FFE08A'],rot:-6,ey:'happy',mo:'open',ex:['arms','conf'],t:['やったー!',21,'dela','#D9622B']}],
 ['ほんとにー？',{bg:['circle','#EBDDF7'],rot:-7,ey:'side',mo:'smirk',ex:['hmouth'],t:['ほんとに〜?',18,'maru','#7A4CC2']}],
 ['いいんですかー？',{bg:['circle','#FFE3EC'],rot:8,ey:'side',mo:'smirk',ex:['brow','q'],t:['いいんですか〜?',16,'maru','#C8436A']}],
 ['強すぎる',{bg:['rrect','#1F2440'],ey:'wide',mo:'wavy',ex:['sweat','bolt'],t:['強すぎる…!',19,'dela','#FFD45C','#1F2440']}],
 ['詰んだ',{bg:['circle','#D5D9DE'],body:['#EDEBE6','#CFCBC2'],ey:'blank',mo:'flat',ex:['ghost'],t:['詰んだ',21,'wa','#4B5560']}],
 ['ミスった',{bg:['circle','#FFE9C2'],rot:6,ey:'gt',mo:'tongue',ex:['sweat'],t:['ミスった!',20,'dela','#D9822B']}],
 ['助けて',{bg:['circle','#D6E4F5'],ey:'teary',mo:'wavy',ex:['tears','pray'],t:['助けて…!',20,'maru','#3F78C4']}],
 ['Checkmate',{bg:['rrect','#14110e'],ey:'fire',mo:'smirk',ex:['crown'],t:['Checkmate',17,'yo','#EBDDB5','#14110e']}],
 ['王手',{bg:['burst','#C8322B'],ey:'fire',mo:'shout',ex:['point'],t:['王手!',27,'wa','#fff','#8E1710']}],
 ['勝ったな',{bg:['rrect','#2A221A'],ey:'shades',mo:'smirk',ex:['spark'],t:['勝ったな',21,'dela','#E9BB5C','#2A221A']}],
 ['Oh, No!って言ってないー！',{bg:['burst','#FFE08A'],sc:.68,ey:'fire',mo:'shout',ex:['anger','point'],t2:['Oh, No! って',14,'dela','#C8322B'],t:['言ってないー!',16,'dela','#C8322B']}],
 ['バグってんな',{bg:['rrect','#0d1a12'],glitch:1,ey:'x',mo:'wavy',ex:['glitch'],t:['バグってんな',16,'mono','#6DFF9C','#0d1a12']}],
];
const stampCache={};
function stamp(i){ if(stampCache[i]) return stampCache[i]; const d=STAMPS[i][1], sc=d.sc||.8, tx=60-60*sc, ty=d.t2?-4:0, ex=(d.ex||[]).map(k=>sEx[k]()).join('');
  const ch=`<g transform="rotate(${d.rot||0} 60 60)">${d.glitch?`<g transform="translate(-4,1)" opacity=".8">${sChar(d,'#FF4D6D')}</g><g transform="translate(4,-1)" opacity=".8">${sChar(d,'#4DD9FF')}</g>`:''}${sChar(d)}<g fill="${SK}">${ex}</g></g>`;
  return stampCache[i]=`<svg class="stamp" viewBox="0 0 120 120" aria-hidden="true">${sBg[d.bg[0]](d.bg[1])}<g transform="translate(${tx},${ty}) scale(${sc})">${ch}</g>${d.t2?sText(d.t2[0],96,d.t2[1],d.t2[2],d.t2[3],d.t2[4]):''}${sText(d.t[0],d.t2?114:111,d.t[1],d.t[2],d.t[3],d.t[4])}</svg>`; }


/* ---- 盤面の見本(質感A) ---- */
document.body.insertAdjacentHTML('beforeend',`<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<radialGradient id="xB" cx=".34" cy=".26" r=".8"><stop offset="0" stop-color="#7d7d7d"/><stop offset=".4" stop-color="#262626"/><stop offset="1" stop-color="#060606"/></radialGradient>
<radialGradient id="xW" cx=".34" cy=".26" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#f3efe3"/><stop offset="1" stop-color="#bdb5a0"/></radialGradient>
${[['R','#ff9d8a','#C8463C','#7a1d16'],['U','#a9c8ff','#3F78C4','#1c3f73'],['G','#a8e6bd','#3E9B63','#1c5433'],['Y','#fff0b0','#E0AE36','#8a6412'],['P','#dcc6ff','#7A5AC0','#3d2a6e']].map(([k,a,b,c])=>`<radialGradient id="x${k}" cx=".34" cy=".26" r=".8"><stop offset="0" stop-color="${a}"/><stop offset=".5" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></radialGradient>`).join('')}
<linearGradient id="xWal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7B5233"/><stop offset="1" stop-color="#5A3A22"/></linearGradient>
<linearGradient id="xKaya" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#EFD39B"/><stop offset="1" stop-color="#DDB872"/></linearGradient>
<linearGradient id="xIv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFDF5"/><stop offset="1" stop-color="#ECE4CF"/></linearGradient>
<radialGradient id="xFelt" cx=".5" cy=".4" r=".8"><stop offset="0" stop-color="#34805b"/><stop offset="1" stop-color="#184530"/></radialGradient>
<radialGradient id="xPit" cx=".5" cy=".62" r=".6"><stop offset="0" stop-color="#5b3c24"/><stop offset="1" stop-color="#23140a"/></radialGradient>
<linearGradient id="xPw" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fffdf5"/><stop offset=".45" stop-color="#efe6cf"/><stop offset="1" stop-color="#a99a76"/></linearGradient>
<linearGradient id="xPb" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7a563a"/><stop offset=".4" stop-color="#3f2817"/><stop offset="1" stop-color="#150b05"/></linearGradient>
<linearGradient id="xPh" x1="0" y1="0" x2="1" y2="0"><stop offset=".08" stop-color="#fff" stop-opacity="0"/><stop offset=".24" stop-color="#fff" stop-opacity=".9"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="xKm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3dca8"/><stop offset="1" stop-color="#deba74"/></linearGradient>
<linearGradient id="xOak" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B98952"/><stop offset="1" stop-color="#98693A"/></linearGradient>
<radialGradient id="xVig" cx=".5" cy=".45" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></radialGradient>
<linearGradient id="xSlSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7ec0de"/><stop offset="1" stop-color="#fbe3b7"/></linearGradient>
<linearGradient id="xSlWat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#62bfd1"/><stop offset="1" stop-color="#177594"/></linearGradient>
<linearGradient id="xSlWel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#192927"/><stop offset="1" stop-color="#2c4542"/></linearGradient>
<clipPath id="xSlC"><rect x="0" y="0" width="22" height="22" rx="2.6"/></clipPath>
<linearGradient id="xBunBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#453a94"/><stop offset="1" stop-color="#1b1644"/></linearGradient>
<radialGradient id="xBunR" cx=".34" cy=".28" r=".78"><stop offset="0" stop-color="#ffa8b5"/><stop offset=".55" stop-color="#f44c65"/><stop offset="1" stop-color="#9e1930"/></radialGradient>
<radialGradient id="xBunB" cx=".34" cy=".28" r=".78"><stop offset="0" stop-color="#b0d8ff"/><stop offset=".55" stop-color="#4d98f6"/><stop offset="1" stop-color="#1a489e"/></radialGradient>
<radialGradient id="xBunG" cx=".34" cy=".28" r=".78"><stop offset="0" stop-color="#b4fbc2"/><stop offset=".55" stop-color="#52d66d"/><stop offset="1" stop-color="#1c7532"/></radialGradient>
<radialGradient id="xBunY" cx=".34" cy=".28" r=".78"><stop offset="0" stop-color="#fff4b8"/><stop offset=".55" stop-color="#fbd250"/><stop offset="1" stop-color="#b37c0a"/></radialGradient>
<radialGradient id="xPakBg" cx=".5" cy=".42" r=".8"><stop offset="0" stop-color="#483892"/><stop offset="1" stop-color="#140f36"/></radialGradient>
<linearGradient id="xMinBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d6684"/><stop offset="1" stop-color="#15374d"/></linearGradient>
<linearGradient id="xMinTl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6bb2cd"/><stop offset="1" stop-color="#2e7597"/></linearGradient>
<linearGradient id="xVsB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2e6eb8"/><stop offset="1" stop-color="#14325c"/></linearGradient>
<linearGradient id="xVsR" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c93e48"/><stop offset="1" stop-color="#69171e"/></linearGradient>
<linearGradient id="xWlfS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#242b54"/><stop offset=".7" stop-color="#151933"/><stop offset="1" stop-color="#0b0e1e"/></linearGradient>
<radialGradient id="xWlfM" cx=".38" cy=".34" r=".75"><stop offset="0" stop-color="#fffbe3"/><stop offset=".6" stop-color="#ffe08a"/><stop offset="1" stop-color="#dba942"/></radialGradient>
<clipPath id="xOhE"><ellipse cx="30" cy="43.500" rx="19" ry="30"/></clipPath>
<filter id="xSh" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="2.500" stdDeviation="1.800" flood-opacity=".5"/></filter>
<filter id="xShL" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="8" stdDeviation="8" flood-opacity=".35"/></filter>
<filter id="xGr" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".006 .28" numOctaves="3" seed="7"/><feColorMatrix values="0 0 0 0 .2 0 0 0 0 .1 0 0 0 0 .03 1.700 0 0 0 -.55"/></filter>
<filter id="xNo" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .55 0 0 0 -.16"/></filter>
</defs></svg>`);
const wood=(x,y,w,h,r,g,o=.4)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#${g})" filter="url(#xShL)"/><rect x="${x+r/3}" y="${y+r/3}" width="${w-r*2/3}" height="${h-r*2/3}" filter="url(#xGr)" opacity="${o}"/><rect x="${x+1}" y="${y+1}" width="${w-2}" height="${h-2}" rx="${r}" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="1.500"/>`;
const felt=(x,y,w,h,r)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#xFelt)"/><rect x="${x+2}" y="${y+2}" width="${w-4}" height="${h-4}" filter="url(#xNo)" opacity=".8"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="none" stroke="rgba(0,0,0,.4)" stroke-width="3"/>`;
const ball=(x,y,r,g)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="url(#x${g})" filter="url(#xSh)"/><ellipse cx="${x-r*.3}" cy="${y-r*.45}" rx="${r*.36}" ry="${r*.2}" fill="#fff" opacity=".55" transform="rotate(-28 ${x-r*.3} ${y-r*.45})"/>`;
const svg=(w,h,b)=>`<svg viewBox="0 0 ${w} ${h}" role="img">${b}</svg>`;
function gGo(){ const p=i=>50+i*37.5; let b=wood(8,8,384,384,6,'xKaya',.22);
  for(let i=0;i<9;i++) b+=`<path d="M${p(i)} 50V350M50 ${p(i)}H350" transform="translate(.7,.7)" stroke="#fff" stroke-opacity=".35" stroke-width="1"/><path d="M${p(i)} 50V350M50 ${p(i)}H350" stroke="#6b4a24" stroke-opacity=".9" stroke-width="1.100" stroke-linecap="round"/>`;
  [[2,2],[6,2],[4,4],[2,6],[6,6]].forEach(([x,y])=>b+=`<circle cx="${p(x)}" cy="${p(y)}" r="3" fill="#6b4a24"/>`);
  [[2,2,'B'],[6,2,'W'],[2,6,'W'],[6,6,'B'],[4,4,'B'],[3,5,'W'],[5,3,'B'],[4,5,'W'],[3,3,'W'],[5,5,'B'],[6,4,'W'],[2,4,'B'],[5,4,'W'],[4,3,'B']].forEach(([x,y,c])=>b+=ball(p(x),p(y),17,c));
  b+=`<circle cx="${p(4)}" cy="${p(3)}" r="6" fill="none" stroke="#FFC65C" stroke-width="2.500"/>`; return svg(400,400,b); }
const CH={P:'M-12 17H12V13.5H-12ZM-9.5 13.5H9.5Q9.5 10.5 7.5 8.5Q3.8 4.5 3.6 -3.6H6.6Q7 -6 3.9 -8.2A5.6 5.6 0 1 0 -3.9 -8.2Q-7 -6 -6.6 -3.6H-3.6Q-3.8 4.5 -7.5 8.5Q-9.5 10.5 -9.5 13.5Z',
  R:'M-12 17H12V13.5H-12ZM-9 13.5H9L7.6 1H-7.6ZM-9.6 1H9.6V-2.6H-9.6ZM-10 -2.6H10V-12.4H6.6V-8.8H2.8V-12.4H-2.8V-8.8H-6.6V-12.4H-10Z',
  N:'M-12 17H12V13.5H-12ZM-8.5 13.5H10Q10.8 4 8.4 -3.2Q6.2 -9.4 1.4 -12.4L0.6 -16.4L-2 -13.2Q-6.6 -12.2 -9.2 -7.6L-12 -2.4Q-12.6 -0.2 -10.6 0.8L-8.6 1.4Q-6.6 0 -3.8 -0.6Q-2.8 1.2 -4.6 3.6Q-8 8 -8.5 13.5ZM-3.80 -8.2a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0 -2.4 0Z',
  B:'M-12 17H12V13.5H-12ZM-7.6 13.5H7.6Q5 9 4.2 4.4H-4.2Q-5 9 -7.6 13.5ZM-6.2 4.4H6.2V1.8H-6.2ZM-4.6 1.8H4.6Q8.2 -2.6 7 -7.2Q5.4 -12.2 0 -15.4Q-5.4 -12.2 -7 -7.2Q-8.2 -2.6 -4.6 1.8ZM-2.40 -18.2a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0 -4.8 0Z',
  Q:'M-12 17H12V13.5H-12ZM-8 13.5H8Q5.6 8 5 3H-5Q-5.6 8 -8 13.5ZM-6.6 3H6.6V0.3H-6.6ZM-6.6 0.3H6.6L10.2 -10L5 -4.4L4.6 -13.2L1.6 -5L0 -15.2L-1.6 -5L-4.6 -13.2L-5 -4.4L-10.2 -10ZM-12.00 -12.1a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0 -3.6 0ZM-6.40 -15.3a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0 -3.6 0ZM-1.80 -17.3a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0 -3.6 0ZM2.80 -15.3a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0 -3.6 0ZM8.40 -12.1a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0 -3.6 0Z',
  K:'M-12 17H12V13.5H-12ZM-8 13.5H8Q5.6 8 5 3H-5Q-5.6 8 -8 13.5ZM-6.6 3H6.6V0.3H-6.6ZM-6.6 0.3H6.6Q11.2 -4 9.2 -8.6Q6.6 -12.6 1.6 -9.6L0 -8.2L-1.6 -9.6Q-6.6 -12.6 -9.2 -8.6Q-11.2 -4 -6.6 0.3ZM-1.3 -10.4V-13.8H-4.2V-16.4H-1.3V-20H1.3V-16.4H4.2V-13.8H1.3V-10.4Z'};
// ビショップの帽子の切れ目(線で描く)
const CH_SLIT = { B: 'M2.6 -10.6L-1.6 -5.6' }; window.CHESS_SLIT = CH_SLIT;
const slitOf = (k, col, w) => CH_SLIT[k] ? `<path d="${CH_SLIT[k]}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>` : '';
function gChess(){ let b=wood(6,6,388,388,10,'xWal')+`<rect x="36" y="36" width="328" height="328" rx="3" fill="#3D2616"/>`;
  for(let r=0;r<8;r++)for(let c=0;c<8;c++) b+=`<rect x="${40+c*40}" y="${40+r*40}" width="40" height="40" fill="${(r+c)%2?'#739552':'#EBECD0'}"/>`;
  b+=`<rect x="40" y="40" width="320" height="320" filter="url(#xNo)" opacity=".35"/>`;
  const rows=['rnbqkbnr','pppp.ppp','........','....p...','....P...','.....N..','PPPP.PPP','RNBQKB.R'];
  rows.forEach((row,r)=>[...row].forEach((ch,c)=>{ if(ch==='.')return; const w=ch<'a', x=60+c*40, y=59+r*40, d=CH[ch.toUpperCase()];
    b+=`<ellipse cx="${x+1.500}" cy="${y+16}" rx="13" ry="4" fill="#000" opacity=".3"/><g transform="translate(${x},${y}) scale(1.08)" filter="url(#xSh)"><path d="${d}" fill-rule="evenodd" fill="url(#${w?'xPw':'xPb'})" stroke="${w?'#8d7c58':'#0c0806'}" stroke-width=".8" stroke-linejoin="round"/><path d="M-11.5 13.5H11.5" stroke="${w?'#6b5a3c':'#000'}" stroke-opacity=".45"/><path d="${d}" fill-rule="evenodd" fill="url(#xPh)" opacity="${w?.55:.3}"/>${slitOf(ch.toUpperCase(), w?'#8d7c58':'#5a4a38', 1.3)}</g>`; }));
  return svg(400,400,b); }
/* ---- プレイヤーのアイコン(アプリに入れておく 20 種。写真も選べる) ---- */
const avKoma=(ch,c)=>`<path d="M32 11L47 19L51 51H13L17 19Z" fill="#b98f4c"/><path d="M32 10L47 18L51 49H13L17 18Z" fill="#F3DCA8" stroke="#8A6A35" stroke-width="1.500"/><text x="32" y="42" font-family="Yuji Boku,serif" font-size="22" text-anchor="middle" fill="${c}">${ch}</text>`;
const avFace=(f,ears,extra)=>`${ears}<circle cx="32" cy="35" r="18" fill="${f}" stroke="#4A3220" stroke-width="2"/><circle cx="25" cy="33" r="2.400" fill="#2a2118"/><circle cx="39" cy="33" r="2.400" fill="#2a2118"/>${extra}`;
const AV=[
 ['王将','#2C6B4D',avKoma('王','#1c140c')],['と金','#7B5233',avKoma('と','#B3261C')],
 ['黒石','#E3C078',`<circle cx="32" cy="34" r="19" fill="#000" opacity=".25"/><circle cx="32" cy="32" r="19" fill="url(#xB)"/><ellipse cx="25" cy="23" rx="7" ry="4" fill="#fff" opacity=".5" transform="rotate(-28 25 23)"/>`],
 ['白石','#5A3A22',`<circle cx="32" cy="34" r="19" fill="#000" opacity=".3"/><circle cx="32" cy="32" r="19" fill="url(#xW)"/>`],
 ['キング','#739552',`<g transform="translate(32,36) scale(1.55)"><path d="${CH.K}" fill-rule="evenodd" fill="url(#xPw)" stroke="#6b5a3c" stroke-width=".9" stroke-linejoin="round"/></g>`],
 ['ナイト','#EBECD0',`<g transform="translate(32,35) scale(1.6)"><path d="${CH.N}" fill-rule="evenodd" fill="url(#xPb)" stroke="#0c0806" stroke-width=".9" stroke-linejoin="round"/></g>`],
 ['サイコロ','#2F5FAE',`<rect x="15" y="17" width="34" height="34" rx="8" fill="#000" opacity=".25"/><rect x="15" y="14" width="34" height="34" rx="8" fill="#FFFDF5" stroke="#B9AC8C"/><circle cx="32" cy="31" r="6" fill="#C8362E"/>`],
 ['スペード','#F4EAD0',`<path d="M32 10C24 21 13 27 13 37a8.500 8.500 0 0 0 16 4c0 5-2 9-5 12h16c-3-3-5-7-5-12a8.500 8.500 0 0 0 16-4c0-10-11-16-19-27z" fill="#1d2433"/>`],
 ['ハート','#FBD9E0',`<path d="M32 54C8 37 12 14 32 26 52 14 56 37 32 54z" fill="#E0453A" stroke="#9E241C" stroke-width="1.500" stroke-linejoin="round"/><path d="M19 25q4-5 9-2" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/>`],
 ['月','#C8362E',`<circle cx="32" cy="26" r="15" fill="#F4EAD0"/><path d="M0 64V46Q32 28 64 46V64Z" fill="#15151A"/>`],
 ['中','#1F5139',`<rect x="19" y="13" width="26" height="40" rx="4" fill="#E2A23A"/><rect x="19" y="10" width="26" height="38" rx="4" fill="#FFFDF5" stroke="#B9AC8C"/><text x="32" y="37" font-family="Yuji Boku,serif" font-size="22" text-anchor="middle" fill="#C8362E">中</text>`],
 ['だるま','#F6D77A',`<ellipse cx="32" cy="35" rx="20" ry="21" fill="#D8473C" stroke="#7a1d16" stroke-width="2"/><ellipse cx="32" cy="30" rx="13" ry="11" fill="#FBEBD0" stroke="#7a1d16" stroke-width="1.500"/><circle cx="27" cy="29" r="3" fill="#2a2118"/><circle cx="37" cy="29" r="3" fill="#2a2118"/><path d="M22 23q5-4 8 0M34 23q3-4 8 0" fill="none" stroke="#2a2118" stroke-width="2" stroke-linecap="round"/><path d="M28 36q4 3 8 0" fill="none" stroke="#2a2118" stroke-width="1.800" stroke-linecap="round"/><path d="M24 48q8 4 16 0" fill="none" stroke="#F2B21F" stroke-width="2.500" stroke-linecap="round"/>`],
 ['ねこ','#8CC4F0',avFace('#FBEBD0',`<path d="M15 26L16 9l14 10zM49 26L48 9 34 19z" fill="#FBEBD0" stroke="#4A3220" stroke-width="2" stroke-linejoin="round"/>`,`<path d="M30 38l2 2 2-2M32 40v2M28 43q4 3 8 0" fill="none" stroke="#4A3220" stroke-width="1.600" stroke-linecap="round"/><path d="M10 36h9M10 41l9-1M54 36h-9M54 41l-9-1" stroke="#4A3220" stroke-width="1.200" stroke-linecap="round"/>`)],
 ['きつね','#CFE6C8',`<path d="M14 31L17 8L30 20Z" fill="#F08A2E" stroke="#4A3220" stroke-width="2" stroke-linejoin="round"/><path d="M50 31L47 8L34 20Z" fill="#F08A2E" stroke="#4A3220" stroke-width="2" stroke-linejoin="round"/><path d="M18 25L19.500 14L26 20Z" fill="#FBE3C4"/><path d="M46 25L44.500 14L38 20Z" fill="#FBE3C4"/><path d="M32 17C41 17 47 21 49 28L56 38L46 41Q39 52 32 54Q25 52 18 41L8 38L15 28C17 21 23 17 32 17Z" fill="#F08A2E"/><path d="M8 38L18 41Q25 52 32 54Q39 52 46 41L56 38Q47 36.500 41 39.500Q36 41.500 32 44Q28 41.500 23 39.500Q17 36.500 8 38Z" fill="#FFFDF5"/><path d="M32 17C41 17 47 21 49 28L56 38L46 41Q39 52 32 54Q25 52 18 41L8 38L15 28C17 21 23 17 32 17Z" fill="none" stroke="#4A3220" stroke-width="2" stroke-linejoin="round"/><ellipse cx="24.500" cy="32.500" rx="2.300" ry="2.700" fill="#2a2118"/><ellipse cx="39.500" cy="32.500" rx="2.300" ry="2.700" fill="#2a2118"/><ellipse cx="32" cy="48.500" rx="3.200" ry="2.300" fill="#2a2118"/>`],
 ['うさぎ','#F29BB5',avFace('#FFFDF5',`<ellipse cx="24" cy="19" rx="4.500" ry="11" fill="#FFFDF5" stroke="#4A3220" stroke-width="2"/><ellipse cx="40" cy="19" rx="4.500" ry="11" fill="#FFFDF5" stroke="#4A3220" stroke-width="2"/><ellipse cx="24" cy="20" rx="1.800" ry="7" fill="#F29BB5"/><ellipse cx="40" cy="20" rx="1.800" ry="7" fill="#F29BB5"/>`,`<path d="M30 39h4l-2 2zM32 41v2M28 44q4 3 8 0" fill="#F29BB5" stroke="#4A3220" stroke-width="1.500" stroke-linecap="round" stroke-linejoin="round"/>`)],
 ['ふくろう','#3B3560',`<path d="M14 20q0-10 8-8l10 6 10-6q8-2 8 8v18q0 16-18 16T14 38z" fill="#9A6B3F" stroke="#4A3220" stroke-width="2" stroke-linejoin="round"/><circle cx="24" cy="29" r="8" fill="#FFFDF5" stroke="#4A3220" stroke-width="1.500"/><circle cx="40" cy="29" r="8" fill="#FFFDF5" stroke="#4A3220" stroke-width="1.500"/><circle cx="24" cy="29" r="3.500" fill="#2a2118"/><circle cx="40" cy="29" r="3.500" fill="#2a2118"/><path d="M29 36h6l-3 6z" fill="#F2B21F" stroke="#4A3220" stroke-linejoin="round"/>`],
 ['桜','#FFF0F3',[0,1,2,3,4].map(i=>`<path d="M32 32C24 22 26 12 32 8c6 4 8 14 0 24z" fill="#F29BB5" stroke="#D9668A" stroke-width="1" transform="rotate(${i*72} 32 32)"/>`).join('')+`<circle cx="32" cy="32" r="4" fill="#F2B21F"/>`],
 ['富士山','#DCE6F2',`<circle cx="48" cy="16" r="8" fill="#E0453A"/><path d="M2 58L24 22q8-6 16 0L62 58Z" fill="#3F78C4"/><path d="M24 22q8-6 16 0l5 9-5-3-4 4-4-4-4 4-4-4-5 3z" fill="#fff"/>`],
 ['扇','#4A3020',`<path d="M32 54L6 26A36 36 0 0 1 58 26Z" fill="#F4EAD0" stroke="#B98318" stroke-width="2" stroke-linejoin="round"/><path d="M32 54L19 16M32 54V12M32 54L45 16" stroke="#B98318" stroke-width="1.200"/><circle cx="32" cy="26" r="7" fill="#E0453A"/><circle cx="32" cy="54" r="3" fill="#B98318"/>`],
 ['星','#1F2440',`<path d="M32 8l7 15 16 2-12 11 3 17-14-8-14 8 3-17L9 25l16-2z" fill="#F2B21F" stroke="#B98318" stroke-width="1.500" stroke-linejoin="round"/>`],
];
const avSvg=i=>`<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" fill="${AV[i][1]}"/>${AV[i][2]}</svg>`;
const meAv=(cls='')=>S.set.av==='photo'&&S.set.photo?`<span class="avatar av ${cls}"><img src="${S.set.photo}" alt=""></span>`:(S.set.av==null||!AV[S.set.av])?`<span class="avatar ${cls}">${esc((S.set.name||'あ')[0])}</span>`:`<span class="avatar av ${cls}">${avSvg(S.set.av)}</span>`;
const avGrid=()=>`<div class="avgrid"><button data-av="-1" aria-pressed="${S.set.av==null}" title="頭文字" aria-label="頭文字"><span class="avatar">${esc((S.set.name||'あ')[0])}</span></button>${AV.map((a,i)=>`<button data-av="${i}" aria-pressed="${S.set.av===i}" title="${a[0]}" aria-label="${a[0]}"><span class="avatar av">${avSvg(i)}</span></button>`).join('')}${S.set.photo?`<button data-av="photo" aria-pressed="${S.set.av==='photo'}" title="写真" aria-label="写真"><span class="avatar av"><img src="${S.set.photo}" alt=""></span></button>`:''}</div>`;
function avatarModal(){ return `<div class="modal"><button class="mback" data-mback aria-label="閉じる"></button><div class="mbox" style="width:min(620px,100%)" role="dialog" aria-label="アイコン"><div class="mhd"><h3>アイコン</h3><button class="btn" style="height:38px" data-photo>写真を選ぶ</button><button class="btn gold" data-mclose style="height:38px;width:110px">完了</button></div><div class="mbody" style="padding-top:16px">${avGrid()}</div></div></div>`; }
/* ---- 初回起動(表示名とアイコン。どちらも飛ばせる) ---- */
function first(){ return `<div class="screen" style="align-items:center;justify-content:center;overflow:auto"><div class="frbox">
   <small>あそび箱30</small><h2>はじめまして</h2>
   <div class="frtop">${meAv('big')}<div style="flex:1;min-width:0"><label for="nameIn">表示名</label><input id="nameIn" value="${esc(S.set.name)}" maxlength="12" placeholder="あなた" autocomplete="off"></div></div>
   <div class="frlab"><span>アイコン</span><button class="btn" style="height:36px" data-photo>写真を選ぶ</button></div>${avGrid()}
   <div class="frops"><button class="btn" data-firstdone>スキップ</button><button class="btn primary" data-firstdone>はじめる</button></div></div></div>`; }

/* ---- Oh, No! の札(全種類。ワイルドは、色を選ぶと札そのものがその色になる) ---- */
const OC=['#E0453A','#F2B629','#2E9E5B','#2F6FD0'], OCN=['赤','黄','緑','青'], OBK='#23232D';
const pin=(x,y,r)=>[[0,-1,1,0],[1,0,0,1],[0,1,-1,0],[-1,0,0,-1]].map(([a,b,c,d],i)=>`<path d="M${x} ${y}L${x+a*r} ${y+b*r}A${r} ${r} 0 0 1 ${x+c*r} ${y+d*r}Z" fill="${OC[i]}"/>`).join('')+`<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#fff" stroke-width="${r*.14}"/>`;
// リバース: 丸く回る 2 本の矢印(重ならない)
function revSym(x,y,z,c){ const r=z*.3, w=z*.12, h=z*.2, P=(a)=>[x+r*Math.cos(a),y+r*Math.sin(a)], d=Math.PI/180;
  const arc=(a0,a1)=>{ const [sx,sy]=P(a0*d),[ex,ey]=P(a1*d), t=[-Math.sin(a1*d),Math.cos(a1*d)], n=[Math.cos(a1*d),Math.sin(a1*d)];
    return `<path d="M${sx.toFixed(2)} ${sy.toFixed(2)}A${r} ${r} 0 0 1 ${ex.toFixed(2)} ${ey.toFixed(2)}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/><path d="M${(ex+t[0]*h).toFixed(2)} ${(ey+t[1]*h).toFixed(2)}L${(ex+n[0]*h*.75).toFixed(2)} ${(ey+n[1]*h*.75).toFixed(2)}L${(ex-n[0]*h*.75).toFixed(2)} ${(ey-n[1]*h*.75).toFixed(2)}Z" fill="${c}"/>`; };
  return arc(205,320)+arc(25,140); }
function ohCard(kind,ci,chosen=-1){ const W=`<svg class="ohc" viewBox="0 0 60 87" role="img" aria-label="${kind}">`;
  if(kind==='back') return W+`<rect width="60" height="87" rx="8" fill="#fff"/><rect x="3" y="3" width="54" height="81" rx="6" fill="#1B1F2C"/><g transform="rotate(-24 30 43.500)"><text x="31" y="49" font-size="14" font-weight="900" text-anchor="middle" fill="#D6332B">Oh,No!</text><text x="30" y="48" font-size="14" font-weight="900" text-anchor="middle" fill="#FFD94F">Oh,No!</text></g></svg>`;
  const wild=kind==='wild'||kind==='+4', col=wild?(chosen>=0?OC[chosen]:OBK):OC[ci], ink=wild&&chosen<0?OBK:col;
  const sym=(k,x,y,z,c)=>k==='skip'?`<circle cx="${x}" cy="${y}" r="${z*.42}" fill="none" stroke="${c}" stroke-width="${z*.17}"/><path d="M${x-z*.3} ${y+z*.3}L${x+z*.3} ${y-z*.3}" stroke="${c}" stroke-width="${z*.17}" stroke-linecap="round"/>`
    :k==='rev'?revSym(x,y,z,c)
    :`<text x="${x}" y="${y+z*.36}" font-size="${z*(String(k).length>1?.78:1)}" font-weight="900" text-anchor="middle" fill="${c}">${k}</text>`;
  let mid;
  if(kind==='wild') mid=chosen<0?`<g transform="rotate(28 30 43.500)" clip-path="url(#xOhE)"><rect x="0" y="0" width="30" height="43.500" fill="${OC[0]}"/><rect x="30" y="0" width="30" height="43.500" fill="${OC[1]}"/><rect x="30" y="43.500" width="30" height="43.500" fill="${OC[2]}"/><rect x="0" y="43.500" width="30" height="43.500" fill="${OC[3]}"/></g>`
      :`<ellipse cx="30" cy="43.500" rx="19" ry="30" fill="#fff" transform="rotate(28 30 43.500)"/>${pin(30,43.5,13)}<circle cx="30" cy="43.500" r="7.500" fill="${col}" stroke="#fff" stroke-width="2"/>`;
  else if(kind==='+4') mid=(chosen<0?`<g transform="rotate(28 30 43.500)" clip-path="url(#xOhE)"><rect x="0" y="0" width="30" height="43.500" fill="${OC[0]}"/><rect x="30" y="0" width="30" height="43.500" fill="${OC[1]}"/><rect x="30" y="43.500" width="30" height="43.500" fill="${OC[2]}"/><rect x="0" y="43.500" width="30" height="43.500" fill="${OC[3]}"/></g><text x="30" y="52" font-size="23" font-weight="900" text-anchor="middle" fill="#fff" stroke="${OBK}" stroke-width="5" paint-order="stroke" stroke-linejoin="round">+4</text>`
      :`<ellipse cx="30" cy="43.500" rx="19" ry="30" fill="#fff" transform="rotate(28 30 43.500)"/><text x="31.2" y="52.4" font-size="23" font-weight="900" text-anchor="middle" fill="${OBK}" opacity=".85">+4</text><text x="30" y="52" font-size="23" font-weight="900" text-anchor="middle" fill="${col}">+4</text>`);
  else if(kind==='+2') mid=`<ellipse cx="30" cy="43.500" rx="19" ry="30" fill="#fff" transform="rotate(28 30 43.500)"/><g transform="rotate(12 30 43.500)"><rect x="20.2" y="36.8" width="13" height="19" rx="2.500" fill="${OBK}" opacity=".85"/><rect x="29.2" y="29.8" width="13" height="19" rx="2.500" fill="${OBK}" opacity=".85"/><rect x="19" y="36" width="13" height="19" rx="2.500" fill="${col}" stroke="#fff" stroke-width="1.500"/><rect x="28" y="29" width="13" height="19" rx="2.500" fill="${col}" stroke="#fff" stroke-width="1.500"/></g>`;
  else mid=`<ellipse cx="30" cy="43.500" rx="19" ry="30" fill="#fff" transform="rotate(28 30 43.500)"/>`+(typeof kind==='number'?`<text x="31.200" y="55.700" font-size="34" font-weight="900" text-anchor="middle" fill="${OBK}" opacity=".85">${kind}</text>`:`<g opacity=".85">${sym(kind,31.2,44.3,30,OBK)}</g>`)+sym(kind,30,43.5,typeof kind==='number'?34:30,col);
  const corner=wild&&kind==='wild'?pin(11,13,5.5):sym(kind==='+4'?'+4':kind,11,13,11,'#fff'), mark=wild&&chosen>=0&&kind==='+4'?pin(49,13,4.5)+pin(11,74,4.5):'';
  return W+`<rect width="60" height="87" rx="8" fill="#fff"/><rect x="3" y="3" width="54" height="81" rx="6" fill="${col}"/>${mid}${corner}<g transform="rotate(180 30 43.500)">${corner}</g>${mark}</svg>`; }
function ohno(){ const row=(t,cards)=>`<h3 class="shelfhead">${t}</h3><div class="ohrow">${cards}</div>`, cap=(c,n)=>`<figure>${c}<figcaption>${n}</figcaption></figure>`;
  return `<div class="screen"><div class="main"><h2 class="pagehead">Oh, No! の札</h2>
   ${row('数字の札',OC.map((_,ci)=>`<div class="ohline">${[0,1,2,3,4,5,6,7,8,9].map(n=>ohCard(n,ci)).join('')}</div>`).join(''))}
   ${row('記号の札',`<div class="ohline big">${[['skip','スキップ'],['rev','リバース'],['+2','+2']].map(([k,n])=>OC.map((_,ci)=>cap(ohCard(k,ci),ci?'':n)).join('')).join('<span class="gap"></span>')}</div>`)}
   ${row('ワイルド(出す前)',`<div class="ohline big">${cap(ohCard('wild'),'ワイルド')+cap(ohCard('+4'),'+4')+cap(ohCard('back'),'裏')}</div>`)}
   ${row('ワイルド(色を選んだ後)',`<div class="ohline big">${OC.map((_,i)=>cap(ohCard('wild',-1,i),OCN[i])).join('')}<span class="gap"></span>${OC.map((_,i)=>cap(ohCard('+4',-1,i),OCN[i])).join('')}</div>`)}
  </div></div>`; }

function mjTile(x,y,w,face,back){ const h=w*1.38; let s=`<g filter="url(#xSh)"><rect x="${x}" y="${y+w*.16}" width="${w}" height="${h}" rx="${w*.12}" fill="#E2A23A" stroke="#A8721C" stroke-width=".6"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w*.12}" fill="${back?'#E2A23A':'url(#xIv)'}" stroke="${back?'#A8721C':'#B9AC8C'}" stroke-width=".6"/></g>`;
  if(back||!face) return s; const cx=x+w/2, t=(ch,yy,sz,col)=>`<text x="${cx}" y="${y+h*yy}" text-anchor="middle" font-family="Yuji Boku,serif" font-size="${w*sz}" fill="${col}">${ch}</text>`;
  if(face[1]==='m') s+=t('一二三四五六七八九'[face[0]-1],.45,.6,'#15151A')+t('萬',.9,.6,'#C8362E');
  else if(face[1]==='p'){ const n=+face[0], cols=n>3?2:1, rws=Math.ceil(n/cols); for(let i=0;i<n;i++){ const cxx=cols===1?cx:x+w*(.3+.4*(i%2)), cy=y+h*((Math.floor(i/cols)+.5)/rws*.8+.1); s+=`<circle cx="${cxx}" cy="${cy}" r="${w*.13}" fill="none" stroke="${['#2F5FD0','#C8362E','#1F7A45'][i%3]}" stroke-width="${w*.07}"/>`; } }
  else if(face==='白') s+='';
  else s+=t(face,.68,.78,face==='發'?'#1F7A45':face==='中'?'#C8362E':'#15151A'); return s; }
function gMahjong(){ let b=wood(4,4,392,292,14,'xWal')+felt(16,16,368,268,8);
  b+=`<rect x="150" y="92" width="100" height="62" rx="8" fill="#12301f" stroke="#0c2217"/><text x="200" y="118" text-anchor="middle" font-size="15" font-weight="900" fill="#F6EEDC">東一局</text><text x="200" y="140" text-anchor="middle" font-size="12" fill="#CFE0D3">残り 54</text>`;
  ['1m','9p','北','白','2p','發'].forEach((f,i)=>b+=mjTile(150+i*17,166,15.5,f));
  for(let i=0;i<13;i++) b+=mjTile(88+i*17.5,26,16,null,true);
  ['1m','2m','3m','5p','6p','7p','東','東','東','白','白','發','中'].forEach((f,i)=>b+=mjTile(22+i*25.2,232,24,f)); b+=mjTile(22+13*25.2+8,232,24,'中');
  return svg(400,300,b); }
function hana(x,y,w,k){ const h=w*1.6, ix=x+2, iy=y+2, iw=w-4, ih=h-4, cx=x+w/2; let m='';
  const bg=c=>`<rect x="${ix}" y="${iy}" width="${iw}" height="${ih}" fill="${c}"/>`;
  switch(k){
   case 'back': m=bg('#3a1a14'); break;
   case 'sun': m=bg('#C8362E')+`<circle cx="${cx}" cy="${y+h*.32}" r="${w*.27}" fill="#fff"/><path d="M${ix} ${iy+ih}v${-ih*.3}q${iw/2} ${-ih*.2} ${iw} 0v${ih*.3}z" fill="#1F5D3A"/>`; break;
   case 'moon': m=bg('#C8362E')+`<circle cx="${cx}" cy="${y+h*.3}" r="${w*.27}" fill="#F4EAD0"/><path d="M${ix} ${iy+ih}v${-ih*.38}q${iw/2} ${-ih*.25} ${iw} 0v${ih*.38}z" fill="#15151A"/>`; break;
   case 'tanr': case 'tanb': m=bg('#F4EAD0')+`<circle cx="${x+w*.3}" cy="${y+h*.2}" r="${w*.16}" fill="#F29BB5"/><circle cx="${x+w*.68}" cy="${y+h*.8}" r="${w*.16}" fill="#F29BB5"/><rect x="${cx-w*.14}" y="${y+h*.22}" width="${w*.28}" height="${h*.56}" fill="${k==='tanr'?'#C8362E':'#2F5FD0'}" transform="rotate(12 ${cx} ${y+h/2})"/>`; break;
   case 'pine': m=bg('#F4EAD0')+[0,1,2].map(i=>`<path d="M${x+w*(.25+i*.25)} ${y+h*.9}l${-w*.12} ${-h*.5} ${w*.12} ${-h*.1} ${w*.12} ${h*.1}z" fill="#1F5D3A"/>`).join(''); break;
   case 'sakura': m=bg('#F4EAD0')+[[.3,.25],[.65,.35],[.4,.55],[.7,.7],[.3,.8]].map(([a,c])=>`<circle cx="${x+w*a}" cy="${y+h*c}" r="${w*.15}" fill="#F29BB5"/><circle cx="${x+w*a}" cy="${y+h*c}" r="${w*.04}" fill="#C8362E"/>`).join(''); break;
   case 'momiji': m=bg('#F4EAD0')+[[.3,.3,'#C8362E'],[.65,.42,'#E6B21F'],[.38,.66,'#C8362E'],[.7,.8,'#C8362E']].map(([a,c,f])=>{const px=x+w*a,py=y+h*c,r=w*.2;let d='';for(let i=0;i<10;i++){const an=i*Math.PI/5-Math.PI/2,rr=i%2?r*.45:r;d+=(i?'L':'M')+(px+Math.cos(an)*rr).toFixed(1)+' '+(py+Math.sin(an)*rr).toFixed(1);}return `<path d="${d}Z" fill="${f}"/>`}).join(''); break;
   default: m=bg('#F4EAD0')+`<path d="M${cx} ${y+h*.55}v${h*.36}" stroke="#1F5D3A" stroke-width="${w*.08}"/><circle cx="${cx}" cy="${y+h*.4}" r="${w*.26}" fill="#E6B21F"/><circle cx="${cx}" cy="${y+h*.4}" r="${w*.1}" fill="#C8362E"/>`;
  }
  return `<g filter="url(#xSh)"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="#15151A"/>${m}</g>`; }
function gHana(){ let b=wood(4,4,392,292,14,'xWal')+felt(16,16,368,268,8);
  for(let i=0;i<8;i++) b+=hana(112+i*22,24,20,'back');
  ['sun','tanr','pine','sakura','moon','momiji','kiku','tanb'].forEach((k,i)=>b+=hana(110+(i%4)*50,66+(i/4|0)*76,42,k));
  b+=hana(40,108,42,'back')+hana(43,105,42,'back');
  ['sakura','tanb','kiku','pine','momiji','sun','tanr','moon'].forEach((k,i)=>b+=hana(58+i*36,224,32,k)); return svg(400,300,b); }
function gMancala(){ let s=11; const rnd=()=>(s=(s*16807)%2147483647)/2147483647; let b=wood(6,50,388,160,36,'xWal');
  const pit=(x,y,rx,ry)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="url(#xPit)" stroke="#2a180c" stroke-width="2"/><ellipse cx="${x}" cy="${y+1.500}" rx="${rx}" ry="${ry}" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="1.500"/>`;
  const tag=(x,y,n)=>`<g filter="url(#xSh)"><rect x="${x-13}" y="${y-10}" width="26" height="20" rx="5" fill="url(#xIv)" stroke="#B9AC8C"/></g><text x="${x}" y="${y+5}" text-anchor="middle" font-size="13" font-weight="900" fill="#15151A">${n}</text>`;
  const beads=(x,y,n,sp)=>{let o='';for(let i=0;i<n;i++){const a=rnd()*6.28,d=rnd()*sp;o+=ball(x+Math.cos(a)*d,y+Math.sin(a)*d*.9,6,'RUGYP'[rnd()*5|0]);}return o;};
  b+=pit(40,130,20,58)+pit(360,130,20,58)+beads(40,130,5,12)+beads(360,130,3,12);
  const top=[4,4,0,5,5,4], bot=[4,0,5,5,4,4];
  for(let i=0;i<6;i++){ const x=87+i*45.2; b+=pit(x,98,19,19)+beads(x,98,top[i],10)+tag(x,30,top[i])+pit(x,162,19,19)+beads(x,162,bot[i],10)+tag(x,230,bot[i]); }
  b+=`<circle cx="${87+3*45.2}" cy="162" r="22" fill="none" stroke="#FFC65C" stroke-width="2.500"/>`; return svg(400,260,b); }
function gBack(){ let b=wood(4,4,392,292,12,'xWal')+felt(20,20,170,260,4)+felt(210,20,170,260,4);
  const X=i=>(i<6?20:210)+(i%6)*28.33;
  for(let i=0;i<12;i++){ const x=X(i), c=i%2?'#E6D3A8':'#8A3B2A', d=i%2?'#8A3B2A':'#E6D3A8';
    b+=`<polygon points="${x+2},21 ${x+26.3},21 ${x+14.2},128" fill="${c}"/><polygon points="${x+2},279 ${x+26.3},279 ${x+14.2},172" fill="${d}"/>`; }
  const ch=(i,top,n,g)=>{ let o=''; const x=X(i)+14.2, k2=g==='W'?'rgba(0,0,0,.18)':'rgba(255,255,255,.22)'; for(let k=0;k<n;k++){ const y=top?34+k*24:266-k*24; o+=ball(x,y,12.500,g)+`<circle cx="${x}" cy="${y}" r="8" fill="none" stroke="${k2}" stroke-width="1.500"/><circle cx="${x}" cy="${y}" r="4.500" fill="none" stroke="${k2}" stroke-width="1.200"/>`; } return o; };
  b+=ch(0,true,5,'W')+ch(4,true,3,'B')+ch(6,true,5,'B')+ch(11,true,2,'W')+ch(0,false,5,'B')+ch(4,false,3,'W')+ch(6,false,5,'W')+ch(11,false,2,'B');
  const die=(x,y,p)=>`<g filter="url(#xSh)"><rect x="${x}" y="${y}" width="30" height="30" rx="6" fill="url(#xIv)" stroke="#B9AC8C"/></g>`+p.map(([a,c])=>`<circle cx="${x+a}" cy="${y+c}" r="2.800" fill="#15151A"/>`).join('');
  b+=die(250,135,[[8,8],[22,22],[15,15]])+die(294,135,[[8,8],[22,8],[8,22],[22,22],[15,15]]); return svg(400,300,b); }
function boards(){ const f=(n,s)=>`<figure class="fig">${s}<figcaption>${n}</figcaption></figure>`;
  return `<div class="screen"><div class="main"><h2 class="pagehead">盤面の見本</h2><div class="gal">${f('碁',gGo())+f('チェス',gChess())+f('麻雀',gMahjong())+f('花札',gHana())+f('マンカラ',gMancala())+f('バックギャモン',gBack())}</div></div></div>`; }


/* ---- 演出の見本(カットインと細かい動きの原型。時間と動き方は docs/animation-spec.md) ---- */
const me=()=>S.set.name||'あなた';
const FX={cut:[
  ['対局開始',()=>({text:'対局開始',tone:'gold',ms:1500})],
  ['勝利(自分)',()=>({who:me(),text:me()+' の勝利',tone:'gold',ms:2400,nowho:1})],
  ['勝利(相手)',()=>({text:'たけし の勝利',tone:'dark',ms:2400})],
  ['引き分け',()=>({text:'引き分け',tone:'dark',ms:2000})],
  ['王手',()=>({text:'王手',tone:'red',font:'wa',ms:1300})],
  ['Check',()=>({text:'Check',tone:'noir',font:'yo',ms:1300})],
  ['Checkmate',()=>({text:'Checkmate',tone:'noir',font:'yo',ms:2000})],
  ['リーチ',()=>({who:'たけし',text:'リーチ',tone:'china',font:'china',ms:1400})],
  ['立直(漢字の案)',()=>({who:'たけし',text:'立直',sub:'リーチ',tone:'china',font:'china',ms:1400})],
  ['ロン',()=>({who:'たけし',text:'ロン',tone:'china',font:'china',ms:1600})],
  ['ツモ',()=>({who:'たけし',text:'ツモ',tone:'china',font:'china',ms:1600})],
  ['革命',()=>({text:'革命',tone:'red',font:'dela',ms:1800})],
  ['Oh, No!',()=>({who:'たけし',text:'Oh, No! って言ってない',sub:'2枚引く',tone:'red',font:'mo',ms:3000})],
  ['こいこい',()=>({who:'たけし',text:'こいこい',tone:'felt',font:'wa',ms:1500})],
  ['待った',()=>({text:'待った',tone:'felt',ms:1200})]],
  small:[['カーソル音','hover'],['待ったの依頼','ask'],['あなたの番','turn'],['カウントダウン','count'],['サイコロを振る','dice'],['札をめくる','flip'],['札を配る','deal'],['チャットの通知','toast']]};
function fx(){ return `<div class="screen"><div class="stage"><div class="stagehead"><h2>演出の見本</h2></div>
   <div class="fxstage"><div class="feltin" style="position:absolute;inset:0;border-radius:0"></div><div id="fxo"></div></div><div style="height:16px"></div></div>
  <aside class="side" style="overflow:auto"><h4>ゲームの雰囲気</h4>${seg('mood',['和風','洋風','モダン'],{wa:'和風',yo:'洋風',mo:'モダン'}[S.mood])}
   <h4>カットイン</h4><div class="ops">${FX.cut.map((c,i)=>`<button class="btn" data-cut="${i}">${c[0]}</button>`).join('')}</div>
   <h4>こまかい動き</h4><div class="ops">${FX.small.map(c=>`<button class="btn" data-fx="${c[1]}">${c[0]}</button>`).join('')}</div></aside></div>`; }
let fxT=[];
function fxClear(){ fxT.forEach(t=>{clearTimeout(t);clearInterval(t)}); fxT=[]; const o=$('#fxo'); if(o)o.innerHTML=''; return o; }
function cutin(i){ const o=fxClear(), c=FX.cut[i][1](), font=c.font||S.mood, len=[...c.text].reduce((n,ch)=>n+(ch.charCodeAt(0)<128?.58:1),0), who=c.who&&!c.nowho;
  o.innerHTML=`<button class="cutin ${c.tone} f-${font} ${who&&c.sub?'tall':''}" aria-label="閉じる"><span class="veil"></span><span class="band"></span><span class="txt">${who?`<span class="who"><span class="avatar">${c.who[0]}</span>${c.who}</span>`:''}<span class="mainl" style="font-size:min(${who||c.sub?12:17}cqh,${(82/len).toFixed(1)}cqw)">${c.text}</span>${c.sub?`<small>${c.sub}</small>`:''}</span></button>`;
  const el=o.firstChild, end=()=>{ el.classList.add('out'); fxT.push(setTimeout(()=>el.remove(),280)); }; el.onclick=end; fxT.push(setTimeout(end,c.ms)); }
function askVote(yes){ const c=$('#av0'); if(!c)return; c.classList.add(yes?'ok':'ng'); c.lastChild.textContent=yes?'了承':'了承しない'; document.querySelectorAll('.askops button').forEach(b=>b.disabled=true);
  if(!yes) fxT.push(setTimeout(()=>{ const o=fxClear(); o.innerHTML='<div class="turnpill" style="background:var(--surface);color:var(--ink)">「待った」は了承されませんでした</div>'; },500)); else askDone(); }
function askDone(){ if(document.querySelectorAll('.askv .chip.ok').length<2) return; fxT.push(setTimeout(()=>cutin(FX.cut.findIndex(c=>c[0]==='待った')),450)); }
function fxRun(k){ if(k==='hover'){ [0,160,320].forEach(t=>setTimeout(()=>{ hvT=0; sfxHover(); },t)); return; } if(k==='toast') return toast({w:'たけし',s:1}); const o=fxClear();
  if(k==='ask'){ o.innerHTML=`<div class="askcard"><div class="askhd"><span class="avatar">た</span><b>たけし が「待った」を押しました</b></div>
      <div class="askv"><span class="chip" id="av0"><i class="avatar">${me()[0]}</i>${me()}<em>未回答</em></span><span class="chip" id="av1"><i class="avatar">み</i>みさき<em>未回答</em></span></div>
      <div class="askbar"><i></i></div><div class="askops"><button class="btn" data-ask="0">了承しない</button><button class="btn gold" data-ask="1">了承する</button></div></div>`;
    fxT.push(setTimeout(()=>{ const c=$('#av1'); if(c){ c.classList.add('ok'); c.lastChild.textContent='了承'; askDone(); } },1400)); }
  if(k==='turn') o.innerHTML=`<div class="turnpill">あなたの番</div>`;
  if(k==='count'){ let n=5; o.innerHTML=`<div class="cdnum" id="cdn">5</div><div class="cdband"><i id="cdb"></i></div>`; setTimeout(()=>{const b=$('#cdb'); if(b)b.style.width='0%'},30);
    fxT.push(setInterval(()=>{ n--; const e=$('#cdn'); if(!e)return; if(n<=0)return fxClear(); e.textContent=n; e.style.animation='none'; void e.offsetWidth; e.style.animation=''; },1000)); }
  if(k==='dice') dice(o);
  if(k==='flip') o.innerHTML=`<div class="fxrow">${['♠A','♥K','♦7'].map((c,i)=>`<div class="flipc" style="animation-delay:${i*.16}s"><div class="ff">${cardH(c)}</div><div class="bk"></div></div>`).join('')}</div>`;
  if(k==='deal') o.innerHTML=`<div class="fxrow">${['♠3','♥4','♣9','♦Q','♠A'].map((c,i)=>`<div class="dealc" style="animation-delay:${i*.09}s">${cardH(c)}</div>`).join('')}</div>`;
}
const DP={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]}, DR={1:[0,0],6:[0,180],3:[0,-90],4:[0,90],5:[-90,0],2:[90,0]};
const dface=n=>Array.from({length:9},(_,i)=>`<i class="${DP[n].includes(i)?'on':''}${n===1?' one':''}"></i>`).join('');
const dcube=()=>`<div class="cube">${[[1,'f'],[6,'b'],[3,'r'],[4,'l'],[5,'t'],[2,'u']].map(([n,c])=>`<div class="df ${c}">${dface(n)}</div>`).join('')}</div>`;
/* サイコロ(決定: その場で震えて目が変わり、ぽんと決まる。最後は真上から見た形) */
function dice(o){ const res=[1+(Math.random()*6|0),1+(Math.random()*6|0)];
  o.innerHTML=`<div class="fxrow">${res.map(()=>`<div class="dwrap"><div class="dsh"></div><div class="dmove"><div class="d2">${dface(1)}</div></div></div>`).join('')}</div>`;
  o.querySelectorAll('.dwrap').forEach((w,i)=>{ const d2=w.querySelector('.d2'), dl=i*90;
    w.querySelector('.dmove').animate([{transform:'rotate(-14deg)'},{transform:'rotate(14deg)'},{transform:'rotate(-12deg)'},{transform:'rotate(12deg)'},{transform:'rotate(-8deg)'},{transform:'rotate(6deg)'},{transform:'scale(1.22)'},{transform:'none'}],{duration:760,delay:dl,fill:'both'});
    const iv=setInterval(()=>d2.innerHTML=dface(1+(Math.random()*6|0)),70); fxT.push(iv); fxT.push(setTimeout(()=>{ clearInterval(iv); d2.innerHTML=dface(res[i]); },560+dl)); }); }

/* ---- ゲームのアイコン 30 種(PC 用に描き込む。木目・フェルトの粒・やわらかい影) ---- */
const I=(bg,body)=>`<svg viewBox="0 0 100 100" aria-hidden="true">${bg}${body}<rect width="100" height="100" fill="url(#xVig)"/></svg>`;
const bWood=(g,o=.32)=>`<rect width="100" height="100" fill="url(#${g})"/><rect width="100" height="100" filter="url(#xGr)" opacity="${o}"/>`;
const bFelt=()=>`<rect width="100" height="100" fill="url(#xFelt)"/><rect width="100" height="100" filter="url(#xNo)" opacity=".7"/>`;
const bFlat=c=>`<rect width="100" height="100" fill="${c}"/><rect width="100" height="100" filter="url(#xNo)" opacity=".25"/>`;
const eng=(d,w=1)=>`<path d="${d}" transform="translate(.5,.5)" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="${w}"/><path d="${d}" fill-rule="evenodd" fill="none" stroke="#6b4a24" stroke-opacity=".85" stroke-width="${w}" stroke-linecap="round"/>`;
const KP2='M0 -21L12 -15L16 19H-16L-12 -15Z';
const iKoma=(x,y,s,ch,rot=0)=>`<g transform="translate(${x},${y}) rotate(${rot}) scale(${s})" filter="url(#xSh)"><path d="${KP2}" fill="#b98f4c"/><path d="${KP2}" transform="translate(0,-1.6)" fill="url(#xKm)" stroke="#8a6a35" stroke-width=".8"/><text x="0" y="-3" font-family="Yuji Boku,serif" font-size="14" text-anchor="middle" fill="#1c140c">${ch[0]}</text><text x="0" y="12" font-family="Yuji Boku,serif" font-size="14" text-anchor="middle" fill="#1c140c">${ch[1]}</text></g>`;
const iCard=(x,y,w,rk,su,rot=0,o={})=>{ const h=w*1.4, c=/[♥♦]/.test(su)?'#C8362E':'#1d2433';
  return `<g transform="rotate(${rot} ${x+w/2} ${y+h/2})" filter="url(#xSh)"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w*.12}" fill="${o.back?'#B4332B':'url(#xIv)'}" stroke="${o.gold?'#E0A33A':o.back?'#F4EAD0':'#A89B7C'}" stroke-width="${o.gold?2.4:o.back?1.8:.9}"/>${o.back?`<rect x="${x+w*.17}" y="${y+w*.17}" width="${w*.66}" height="${h-w*.34}" rx="${w*.06}" fill="none" stroke="#F4EAD0" stroke-opacity=".55"/>`:`<text x="${x+w*.22}" y="${y+w*.42}" font-size="${w*.4}" font-weight="900" text-anchor="middle" fill="${c}">${rk}</text><text x="${x+w*.22}" y="${y+w*.76}" font-size="${w*.32}" text-anchor="middle" fill="${c}">${su}</text><text x="${x+w*.58}" y="${y+h*.82}" font-size="${w*.62}" text-anchor="middle" fill="${c}">${su}</text>`}</g>`; };
const iDie=(x,y,s,n,rot=0)=>`<g transform="rotate(${rot} ${x+s/2} ${y+s/2})" filter="url(#xSh)"><rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${s*.2}" fill="url(#xIv)" stroke="#B9AC8C" stroke-width=".8"/>${DP[n].map(i=>`<circle cx="${x+s*(.25+.25*(i%3))}" cy="${y+s*(.25+.25*(i/3|0))}" r="${s*(n===1?.13:.085)}" fill="${n===1?'#C8362E':'#15151A'}"/>`).join('')}</g>`;
const iPiece=(x,y,s,k,w)=>`<ellipse cx="${x+1}" cy="${y+15*s}" rx="${12*s}" ry="${3.6*s}" fill="#000" opacity=".3"/><g transform="translate(${x},${y}) scale(${s})" filter="url(#xSh)"><path d="${CH[k]}" fill-rule="evenodd" fill="url(#${w?'xPw':'xPb'})" stroke="${w?'#8d7c58':'#0c0806'}" stroke-width=".8" stroke-linejoin="round"/><path d="M-11.5 13.5H11.5" stroke="${w?'#6b5a3c':'#000'}" stroke-opacity=".45"/><path d="${CH[k]}" fill-rule="evenodd" fill="url(#xPh)" opacity="${w?.55:.3}"/>${slitOf(k, w?'#8d7c58':'#5a4a38', 1.3)}</g>`;
// 王冠(チェッカーのキング)。x,y が中心、w が幅
const crown=(x,y,w)=>{const P=(a,b)=>`${(x+a*w).toFixed(2)} ${(y+b*w).toFixed(2)}`;return `<path d="M${P(-.5,.28)}L${P(-.56,-.18)}L${P(-.24,.06)}L${P(0,-.34)}L${P(.24,.06)}L${P(.56,-.18)}L${P(.5,.28)}Z" fill="#F5C342" stroke="#7A4E08" stroke-width="${w*.05}" stroke-linejoin="round"/><path d="M${P(-.4,.12)}L${P(-.4,.2)}M${P(0,-.1)}L${P(0,.18)}M${P(.4,.12)}L${P(.4,.2)}" stroke="#FFE9A0" stroke-width="${w*.05}" stroke-linecap="round" opacity=".8"/><rect x="${x-.52*w}" y="${y+.24*w}" width="${1.04*w}" height="${.2*w}" rx="${.05*w}" fill="#E0A425" stroke="#7A4E08" stroke-width="${w*.05}"/><circle cx="${x}" cy="${y+.34*w}" r="${.06*w}" fill="#D23B2E"/><circle cx="${x-.3*w}" cy="${y+.34*w}" r="${.045*w}" fill="#2F6FD0"/><circle cx="${x+.3*w}" cy="${y+.34*w}" r="${.045*w}" fill="#2F6FD0"/>`+[[-.56,-.2],[0,-.37],[.56,-.2]].map(([a,b])=>`<circle cx="${x+a*w}" cy="${y+b*w}" r="${.075*w}" fill="#FFE07A" stroke="#7A4E08" stroke-width="${w*.04}"/>`).join('');};
const iChk=(x,y,r,g,king)=>ball(x,y,r,g)+`<circle cx="${x}" cy="${y}" r="${r*.62}" fill="none" stroke="${g==='B'?'rgba(255,255,255,.25)':'rgba(0,0,0,.22)'}" stroke-width="${r*.14}"/>`+(king?crown(x,y+r*.05,r*1.05):'');
const iUno=(x,y,w,col,t,rot)=>{ const h=w*1.45; return `<g transform="rotate(${rot} ${x+w/2} ${y+h/2})" filter="url(#xSh)"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w*.16}" fill="#fff"/><rect x="${x+w*.08}" y="${y+w*.08}" width="${w*.84}" height="${h-w*.16}" rx="${w*.11}" fill="${col}"/><ellipse cx="${x+w/2}" cy="${y+h/2}" rx="${w*.36}" ry="${h*.34}" fill="#fff" transform="rotate(28 ${x+w/2} ${y+h/2})"/><text x="${x+w/2}" y="${y+h/2+w*.2}" font-size="${w*.56}" font-weight="900" text-anchor="middle" fill="${col}">${t}</text></g>`; };
const iChip=(x,y,c)=>[0,1,2].map(i=>`<ellipse cx="${x}" cy="${y-i*3.4}" rx="8" ry="3.4" fill="${c}" stroke="#fff" stroke-width="1" stroke-dasharray="2.600 2.200"/>`).join('');
const gin=(t,inner)=>`<g transform="${t}">${inner}</g>`;
Object.assign(AR,{
 shogi:I(bWood('xKaya',.2),eng('M0 30H100M0 76H100M26 0V100M74 0V100')+iKoma(30,36,.9,'歩兵',-10)+iKoma(56,56,1.62,'王将',5)),
 minishogi:I(bWood('xKaya',.2),eng([0,1,2,3,4,5].map(i=>`M${10+i*16} 10V90M10 ${10+i*16}H90`).join(''))+iKoma(66,34,.98,'角行',180)+iKoma(34,66,.98,'飛車')),
 reversi:I(bWood('xWal'),`<rect x="11" y="11" width="78" height="78" rx="4" fill="url(#xFelt)" stroke="#12301f" stroke-width="1.500"/><rect x="12" y="12" width="76" height="76" filter="url(#xNo)" opacity=".6"/>`+[1,2,3].map(i=>`<path d="M${11+i*19.5} 11V89M11 ${11+i*19.5}H89" stroke="#12301f"/>`).join('')+ball(40.2,40.2,7.6,'W')+ball(59.8,40.2,7.6,'B')+ball(40.2,59.8,7.6,'B')+ball(59.8,59.8,7.6,'W')+ball(59.8,20.8,7.6,'B')+ball(20.8,59.8,7.6,'W')),
 connect4:I(bFlat('#EDE4D0'),`<ellipse cx="50" cy="90" rx="44" ry="4" fill="#000" opacity=".25"/><rect x="14" y="16" width="72" height="66" rx="6" fill="#2A1D10"/>`+[0,1,2,3].map(r=>[0,1,2,3].map(c=>{const v=['....','..u.','.ru.','rurr'][r][c],x=25.5+c*16.4,y=27+r*14.8;return v==='.'?'':`<circle cx="${x}" cy="${y}" r="6.200" fill="${v==='r'?'#C8362E':'#2F5FAE'}"/><circle cx="${x}" cy="${y}" r="4" fill="none" stroke="${v==='r'?'#9E241C':'#1F4585'}" stroke-width="1"/>`}).join('')).join('')+`<path fill-rule="evenodd" d="M20 16h60a6 6 0 0 1 6 6v54a6 6 0 0 1-6 6H20a6 6 0 0 1-6-6V22a6 6 0 0 1 6-6z${[0,1,2,3].map(r=>[0,1,2,3].map(c=>{const x=25.5+c*16.4,y=27+r*14.8;return `M${x-5.6} ${y}a5.600 5.600 0 1 0 11.200 0a5.600 5.600 0 1 0-11.200 0z`}).join('')).join('')}" fill="#E9CC94"/><rect x="16" y="18" width="68" height="62" filter="url(#xGr)" opacity=".2"/><rect x="16" y="78" width="68" height="4" fill="#CDAE72"/><rect x="8" y="81" width="84" height="8" rx="3" fill="#B8955A"/><rect x="8" y="81" width="84" height="2" rx="1" fill="#fff" opacity=".25"/>`),
 gomoku:I(bWood('xKaya',.2),eng([0,1,2,3,4,5,6].map(i=>`M${2+i*16} 0V100M0 ${2+i*16}H100`).join(''),.9)+`<path d="M18 82L82 18" stroke="#FFC65C" stroke-width="5" stroke-linecap="round" opacity=".75"/>`+[0,1,2,3,4].map(i=>ball(18+i*16,82-i*16,6.6,'B')).join('')+ball(34,34,6.6,'W')+ball(66,66,6.6,'W')+ball(50,82,6.6,'W')+ball(18,50,6.6,'W')),
 hex:I(bWood('xOak'),[[35,30],[57,30],[24,49],[46,49],[68,49],[35,68],[57,68]].map(([x,y])=>`<path d="M${x} ${y-12}L${x+10.4} ${y-6}V${y+6}L${x} ${y+12}L${x-10.4} ${y+6}V${y-6}Z" transform="translate(0,1.500)" fill="#7a5a34"/><path d="M${x} ${y-12}L${x+10.4} ${y-6}V${y+6}L${x} ${y+12}L${x-10.4} ${y+6}V${y-6}Z" fill="#E8CF9F" stroke="#98693A" stroke-width=".8"/>`).join('')+ball(46,48,6.8,'R')+ball(57,29,6.8,'U')+ball(35,67,6.8,'U')),
 mancala:I(bFlat('#E7DCC4'),`<ellipse cx="50" cy="80" rx="42" ry="4" fill="#000" opacity=".22"/><rect x="5" y="24" width="90" height="52" rx="22" fill="url(#xWal)" filter="url(#xSh)"/><rect x="12" y="28" width="76" height="44" filter="url(#xGr)" opacity=".35"/>`+[[15,50,6,15],[85,50,6,15]].concat([0,1,2,3].flatMap(i=>[[32+i*12,39,5.4,5.4],[32+i*12,61,5.4,5.4]])).map(([x,y,rx,ry])=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="url(#xPit)" stroke="#2a180c"/>`).join('')+[[30,38,'R'],[34,40,'Y'],[44,38,'U'],[45,41.500,'G'],[42,40.500,'R'],[57,39,'P'],[68,38,'Y'],[70,41,'U'],[31,61,'G'],[45,60,'R'],[43,62.500,'Y'],[56,60,'U'],[58,62.500,'P'],[55,63,'R'],[68,61,'G'],[15,44,'R'],[14,50,'U'],[16.500,55,'Y'],[85,47,'G'],[84.500,54,'P']].map(([x,y,g])=>ball(x,y,2.5,g)).join('')),
 morris:I(bWood('xKaya',.25),eng('M12 12H88V88H12ZM26 26H74V74H26ZM40 40H60V60H40ZM50 12V40M50 60V88M12 50H40M60 50H88',1.3)+[[12,12],[50,12],[88,12],[26,26],[74,26],[12,50],[88,50],[26,74],[74,74],[12,88],[50,88],[88,88],[40,50],[60,50]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="2" fill="#6b4a24"/>`).join('')+`<path d="M12 12H88" stroke="#FFC65C" stroke-width="4" stroke-linecap="round" opacity=".7"/>`+ball(12,12,6.4,'B')+ball(50,12,6.4,'B')+ball(88,12,6.4,'B')+ball(26,50,6.4,'W')+ball(74,74,6.4,'W')+ball(50,74,6.4,'W')),
 checkers:I(`<rect width="100" height="100" fill="#E8CF9F"/>`+[0,1,2,3].map(r=>[0,1,2,3].map(c=>(r+c)%2?`<rect x="${c*25}" y="${r*25}" width="25" height="25" fill="#6f4a2c"/>`:'').join('')).join('')+`<rect width="100" height="100" filter="url(#xGr)" opacity=".28"/>`,iChk(37.5,12.5,9.4,'R')+iChk(87.5,12.5,9.4,'R')+iChk(62.5,37.5,9.4,'R',1)+iChk(12.5,87.5,9.4,'B')+iChk(62.5,87.5,9.4,'B')+iChk(37.5,62.5,9.4,'B')),
 chess:I(`<rect width="100" height="100" fill="#739552"/><rect width="50" height="50" fill="#EBECD0"/><rect x="50" y="50" width="50" height="50" fill="#EBECD0"/><rect width="100" height="100" filter="url(#xNo)" opacity=".35"/>`,iPiece(33,50,1.9,'N',0)+iPiece(64,52,2.35,'K',1)),
 dots:I(bFlat('#F6EFDD'),`<rect x="20" y="20" width="30" height="30" fill="#2f5fd0" opacity=".3"/><rect x="50" y="50" width="30" height="30" fill="#c8463c" opacity=".3"/><text x="35" y="41" font-size="15" font-weight="900" text-anchor="middle" fill="#2f5fd0">A</text><text x="65" y="71" font-size="15" font-weight="900" text-anchor="middle" fill="#c8463c">B</text><path d="M20 20H50V50H20ZM50 20H80" fill="none" stroke="#2f5fd0" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M50 50H80V80H50ZM20 80H50" fill="none" stroke="#c8463c" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`+[0,1,2].map(r=>[0,1,2].map(c=>`<circle cx="${20+c*30}" cy="${20+r*30}" r="4.600" fill="#F6EFDD" stroke="#4a3520" stroke-width="2.200"/>`).join('')).join('')),
 hitblow:I(bWood('xWal'),[3,8,1,5].map((d,i)=>`<g filter="url(#xSh)"><rect x="${8+i*21.5}" y="20" width="19" height="28" rx="3.500" fill="url(#xIv)" stroke="#B9AC8C" stroke-width=".8"/></g><text x="${17.5+i*21.5}" y="41" font-size="18" font-weight="900" text-anchor="middle" fill="#1d2433">${d}</text>`).join('')+[0,1,2,3].map(i=>`<circle cx="${26+i*16}" cy="72" r="6.200" fill="url(#xPit)" stroke="#2a180c"/>`).join('')+ball(26,71,5,'R')+ball(42,71,5,'R')+ball(58,71,5,'W')),
 hare:I(bWood('xKaya',.25),eng('M12 50L36 24H64L88 50L64 76H36ZM36 24V76M64 24V76M12 50H88M36 24L64 76M64 24L36 76M50 24V76',1.2)+ball(12,50,7,'B')+ball(36,24,7,'B')+ball(36,76,7,'B')+`<g filter="url(#xSh)"><ellipse cx="60" cy="38" rx="3" ry="8" fill="#f3efe3" stroke="#bdb5a0" stroke-width=".8" transform="rotate(-14 60 38)"/><ellipse cx="68" cy="38" rx="3" ry="8" fill="#f3efe3" stroke="#bdb5a0" stroke-width=".8" transform="rotate(14 68 38)"/></g>`+ball(64,50,8.4,'W')+`<circle cx="61" cy="49" r="1.100" fill="#15151A"/><circle cx="67" cy="49" r="1.100" fill="#15151A"/>`),
 chinese:I(bWood('xOak'),`<circle cx="50" cy="51" r="45" fill="#7a5a34"/><circle cx="50" cy="50" r="45" fill="#D7B77E"/><path d="M50 9L61 32H86L73 50 86 68H61L50 91 39 68H14L27 50 14 32H39Z" fill="#E8CF9F" stroke="#98693A" stroke-width=".8"/>`+[[50,50],[42,50],[58,50],[46,43],[54,43],[46,57],[54,57],[50,36],[50,64],[38,43],[62,43],[38,57],[62,57],[30,50],[70,50]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="2.200" fill="#8a6a3a"/>`).join('')+[[50,17],[46,25],[54,25],[42,32.500],[50,32.500],[58,32.500]].map(([x,y])=>ball(x,y,3.4,'R')).join('')+[[50,83],[46,75],[54,75],[42,67.500],[50,67.500],[58,67.500]].map(([x,y])=>ball(x,y,3.4,'U')).join('')+ball(50,50,3.4,'G')),
 ludo:I(bFlat('#F6EFDD'),[[6,6,'#3E9B63'],[58,6,'#E0AE36'],[6,58,'#C8463C'],[58,58,'#3F78C4']].map(([x,y,c])=>`<rect x="${x}" y="${y}" width="36" height="36" rx="7" fill="${c}"/><rect x="${x+8}" y="${y+8}" width="20" height="20" rx="5" fill="#F6EFDD"/>`).join('')+`<path d="M44 6h12v88H44zM6 44h88v12H6z" fill="#fff" stroke="#d8ccb0" stroke-width=".8"/>`+[[24,24,'#3E9B63'],[76,76,'#3F78C4'],[24,76,'#C8463C']].map(([x,y,c])=>`<g filter="url(#xSh)"><path d="M${x-6} ${y+8}q6-12 6-12t6 12z" fill="${c}" stroke="#2a2118" stroke-width=".8" stroke-linejoin="round"/><circle cx="${x}" cy="${y-6}" r="4.200" fill="${c}" stroke="#2a2118" stroke-width=".8"/></g>`).join('')+iDie(39,39,22,5,12)),
 backgammon:I(bWood('xWal'),`<rect x="9" y="10" width="82" height="80" rx="3" fill="url(#xFelt)"/><rect x="9" y="10" width="82" height="80" filter="url(#xNo)" opacity=".6"/>`+[0,1,2,3].map(i=>`<polygon points="${12+i*20},10 ${28+i*20},10 ${20+i*20},46" fill="${i%2?'#E6D3A8':'#8A3B2A'}"/><polygon points="${12+i*20},90 ${28+i*20},90 ${20+i*20},54" fill="${i%2?'#8A3B2A':'#E6D3A8'}"/>`).join('')+iChk(20,19,7,'W')+iChk(20,32,7,'W')+iChk(80,19,7,'B')+iChk(20,81,7,'B')+iChk(80,81,7,'W')+iChk(80,68,7,'W')+iDie(32,41,17,6,-10)+iDie(51,44,17,3,14)),
 go:I(bWood('xKaya',.2),eng([0,1,2,3,4].map(i=>`M${12+i*22} 0V100M0 ${12+i*22}H100`).join(''))+`<circle cx="56" cy="56" r="2.400" fill="#6b4a24"/>`+ball(34,34,9.6,'B')+ball(56,34,9.6,'W')+ball(34,56,9.6,'W')+ball(78,56,9.6,'B')+ball(56,78,9.6,'B')+ball(78,78,9.6,'W')),
 yacht:I(bFelt(),iDie(12,16,24,2,-14)+iDie(60,12,24,2,10)+iDie(6,54,26,4,8)+iDie(37,58,26,4,-6)+iDie(68,52,26,4,12)),
 mahjong:I(bFelt(),mjTile(10,30,24,'東')+mjTile(38,26,24,'發')+mjTile(66,30,24,'中')),
 life:I(bFlat('#BFE3A1'),`<path d="M-4 86Q30 66 50 82T104 70" fill="none" stroke="#F4EAD0" stroke-width="13" stroke-linecap="round"/><path d="M-4 86Q30 66 50 82T104 70" fill="none" stroke="#d8ccb0" stroke-width="1" stroke-dasharray="5 5"/><g filter="url(#xSh)"><circle cx="50" cy="40" r="31" fill="#fff" stroke="#4a3520" stroke-width="2"/>`+['#e2574c','#f2a541','#f4d35e','#7cc576','#3fa7b5','#4a7fd0','#7a4cc2','#c24c9a'].map((c,i)=>{const a=i*Math.PI/4-Math.PI/2,b=a+Math.PI/4;return `<path d="M50 40L${50+27*Math.cos(a)} ${40+27*Math.sin(a)}A27 27 0 0 1 ${50+27*Math.cos(b)} ${40+27*Math.sin(b)}Z" fill="${c}"/>`}).join('')+`<circle cx="50" cy="40" r="8" fill="#fff" stroke="#4a3520" stroke-width="2"/></g><path d="M44 4H56L50 17Z" fill="#C8362E" stroke="#4a3520" stroke-linejoin="round"/><g filter="url(#xSh)"><rect x="66" y="74" width="20" height="10" rx="4" fill="#C8463C" stroke="#4a3520"/><circle cx="72" cy="76.500" r="2" fill="#F6D77A"/><circle cx="80" cy="76.500" r="2" fill="#8CC4F0"/></g>`),
 hanafuda:I(bFelt(),gin('rotate(-14 30 50)',hana(12,24,32,'sun'))+gin('rotate(12 70 52)',hana(56,24,32,'sakura'))+gin('translate(0,4)',hana(34,28,32,'moon'))),
 sevens:I(bFelt(),iCard(4,34,22,'5','♦')+iCard(21,34,22,'6','♦')+iCard(55,34,22,'8','♦')+iCard(72,34,22,'9','♦')+iCard(37,26,25,'7','♦',0,{gold:1})),
 memory:I(bFelt(),[[8,8],[39,8],[70,8],[8,54]].map(([x,y])=>iCard(x,y,22,'','',0,{back:1})).join('')+iCard(39,54,22,'Q','♥')+iCard(70,54,22,'Q','♠')+`<path d="M66 46l1.500 4 4 1.500-4 1.500-1.500 4-1.500-4-4-1.500 4-1.500z" fill="#FFC65C"/>`),
 speed:I(bFelt(),`<path d="M4 22H26M0 32H16M74 80H96M84 70H100M6 12H18" stroke="#FFC65C" stroke-width="3" stroke-linecap="round" opacity=".9"/>`+iCard(14,36,26,'7','♣',-6)+iCard(60,36,26,'9','♥',6)+iCard(40,14,24,'8','♠',-28)),
 poker:I(bFelt(),[['10',-28],['J',-14],['Q',0],['K',14],['A',28]].map(([r,a],i)=>gin(`rotate(${a} 50 110)`,iCard(39,20,22,r,'♠'))).join('')+iChip(18,90,'#C8463C')+iChip(82,90,'#3F78C4')),
 holdem:I(bFlat('#22262f'),`<ellipse cx="50" cy="52" rx="47" ry="38" fill="url(#xWal)"/><ellipse cx="50" cy="52" rx="42" ry="33" fill="url(#xFelt)"/><ellipse cx="50" cy="52" rx="42" ry="33" fill="none" stroke="#0c2217" stroke-width="1.500"/>`+['A♥','K♥','7♣','2♠','9♦'].map((c,i)=>iCard(17+i*13.5,34,12,c[0],c[1])).join('')+iCard(33,60,16,'A','♠',-8)+iCard(51,60,16,'A','♦',8)+iChip(20,62,'#C8463C')+`<circle cx="80" cy="60" r="6" fill="#fff" stroke="#4a3520"/><text x="80" y="63.500" font-size="9" font-weight="900" text-anchor="middle" fill="#2a2118">D</text>`),
 blackjack:I(bFelt(),`<path d="M8 30Q50 10 92 30" fill="none" stroke="#E0AD4A" stroke-width="1.500" opacity=".8"/>`+iCard(18,36,28,'A','♠',-9)+iCard(52,36,28,'K','♥',9)+`<g filter="url(#xSh)"><circle cx="50" cy="24" r="12" fill="#E0AD4A" stroke="#7a5a12"/><circle cx="50" cy="24" r="9" fill="none" stroke="#fff" stroke-opacity=".6" stroke-dasharray="3 2.500"/></g><text x="50" y="29" font-size="13" font-weight="900" text-anchor="middle" fill="#2A1A08">21</text>`),
 daifugo:I(bFelt(),gin('rotate(-20 50 120)',iCard(37,34,26,'K','♣'))+gin('rotate(20 50 120)',iCard(37,34,26,'A','♦'))+iCard(37,32,26,'2','♠')+`<g filter="url(#xSh)"><path d="M32 26l3-18 8 9 7-13 7 13 8-9 3 18z" fill="#F2B21F" stroke="#7a5a12" stroke-width="1.200" stroke-linejoin="round"/><circle cx="50" cy="19" r="2.200" fill="#C8362E"/></g>`),
 uno:I(bFelt(),iUno(8,30,26,'#E0453A','7',-22)+iUno(28,24,26,'#E6B21F','2',-8)+iUno(48,24,26,'#3E9B63','5',8)+iUno(66,30,26,'#2F6FD0','0',22)),
 solitaire:I(bFelt(),iCard(72,6,20,'A','♥')+iCard(8,10,20,'','',0,{back:1})+iCard(8,18,20,'','',0,{back:1})+iCard(8,26,20,'9','♠')+iCard(38,30,22,'K','♥')+iCard(38,42,22,'Q','♠')+iCard(38,54,22,'J','♦')+iCard(38,66,22,'10','♣')+iCard(70,44,20,'','',0,{back:1})+iCard(70,52,20,'5','♣')),
});
/* ---- 追加 8 ゲームのアイコン(上と同じ質感・手触りで描き込む) ---- */
const iSlideTile=(dx,dy,sc,sr,num)=>{
  const ox=-sc*24, oy=-sr*24;
  return `<g transform="translate(${dx},${dy})" filter="url(#xSh)"><g clip-path="url(#xSlC)"><g transform="translate(${ox},${oy})"><rect width="70" height="70" fill="url(#xSlSky)"/><circle cx="57" cy="14" r="7.5" fill="#fff0bf"/><path d="M0 37L14 17L28 38L42 19L60 39L70 26V70H0Z" fill="#709294"/><path d="M6 34L14 17L20 26L14 23ZM37 26L42 19L48 26L42 23Z" fill="#f1f7f1"/><path d="M0 44Q15 35 28 42T52 40Q61 36 70 43V70H0Z" fill="#529169"/><path d="M0 48Q18 42 35 49T70 46V70H0Z" fill="url(#xSlWat)"/><rect x="7" y="40" width="13" height="9" fill="#f2d9ab"/><path d="M5.5 41L13.5 34L21.5 41Z" fill="#c3654f"/><rect x="11.5" y="43" width="4" height="6" fill="#3b7380"/><circle cx="34" cy="43" r="4" fill="#ed83a0"/><circle cx="38" cy="45" r="3.4" fill="#f49bb4"/><path d="M51 54h10l-3 4h-5z" fill="#f1e9cc"/><path d="M55 54V45l5 5z" fill="#fff8dc"/><path d="M4 58q14-4 28 1M38 62q14 3 26-2" fill="none" stroke="#dbf2e6" stroke-width="1.3" opacity=".65"/></g><rect x=".6" y=".6" width="20.8" height="20.8" rx="2.2" fill="none" stroke="#fff9e8" stroke-opacity=".65" stroke-width="1.2"/><path d="M21.2.8V21.2H.8" fill="none" stroke="#132220" stroke-opacity=".42" stroke-width="1.3"/></g><rect x="1.8" y="1.8" width="7.4" height="7.4" rx="1.6" fill="#142424" opacity=".78"/><text x="5.5" y="7.6" font-size="6.2" font-weight="900" text-anchor="middle" fill="#fff">${num}</text></g>`;
};
const iBunBlob=(x,y,r,g,look=0)=>`<g filter="url(#xSh)"><ellipse cx="${x}" cy="${y}" rx="${(r*1.04).toFixed(1)}" ry="${(r*.95).toFixed(1)}" fill="url(#${g})"/><ellipse cx="${(x-r*.3).toFixed(1)}" cy="${(y-r*.36).toFixed(1)}" rx="${(r*.32).toFixed(1)}" ry="${(r*.18).toFixed(1)}" fill="#fff" opacity=".62" transform="rotate(-24 ${x-r*.3} ${y-r*.36})"/><ellipse cx="${(x-r*.27).toFixed(1)}" cy="${(y-r*.04).toFixed(1)}" rx="${(r*.22).toFixed(1)}" ry="${(r*.28).toFixed(1)}" fill="#fff"/><ellipse cx="${(x+r*.27).toFixed(1)}" cy="${(y-r*.04).toFixed(1)}" rx="${(r*.22).toFixed(1)}" ry="${(r*.28).toFixed(1)}" fill="#fff"/><circle cx="${(x-r*.27+look).toFixed(1)}" cy="${(y+r*.03).toFixed(1)}" r="${(r*.12).toFixed(1)}" fill="#232d54"/><circle cx="${(x+r*.27+look).toFixed(1)}" cy="${(y+r*.03).toFixed(1)}" r="${(r*.12).toFixed(1)}" fill="#232d54"/><circle cx="${(x-r*.31+look).toFixed(1)}" cy="${(y-r*.03).toFixed(1)}" r="${(r*.045).toFixed(1)}" fill="#fff"/><circle cx="${(x+r*.23+look).toFixed(1)}" cy="${(y-r*.03).toFixed(1)}" r="${(r*.045).toFixed(1)}" fill="#fff"/></g>`;
const iTet=(c,r,f,hi,sh)=>{
  const x=17.5+c*13, y=11+r*13, s=12.4;
  return `<g filter="url(#xSh)"><rect x="${x}" y="${y}" width="${s}" height="${s}" rx="1.4" fill="${f}"/><polygon points="${x},${y} ${x+s},${y} ${x+s-2.4},${y+2.4} ${x+2.4},${y+2.4} ${x+2.4},${y+s-2.4} ${x},${y+s}" fill="${hi}" opacity=".78"/><polygon points="${x+s},${y} ${x+s},${y+s} ${x},${y+s} ${x+2.4},${y+s-2.4} ${x+s-2.4},${y+s-2.4} ${x+s-2.4},${y+2.4}" fill="${sh}" opacity=".62"/><rect x="${x+3}" y="${y+3}" width="${s-6}" height="${s-6}" rx=".7" fill="#fff" opacity=".16"/></g>`;
};
const iMinCov=(x,y)=>`<g><rect x="${x}" y="${y}" width="22" height="22" rx="2.5" fill="url(#xMinTl)"/><path d="M${x+1.3} ${y+20}V${y+1.3}H${x+20}" fill="none" stroke="#bce8f6" stroke-width="2" stroke-linecap="round"/><path d="M${x+20.7} ${y+2.3}V${y+20.7}H${x+2.3}" fill="none" stroke="#164660" stroke-width="2" stroke-linecap="round"/></g>`;
const iMinOpn=(x,y,ch,col)=>`<g><rect x="${x}" y="${y}" width="22" height="22" rx="2.2" fill="#dcecf0" stroke="#76a0b5" stroke-width=".9"/>${ch?`<text x="${x+11}" y="${y+16.5}" font-size="15" font-weight="900" text-anchor="middle" fill="${col}">${ch}</text>`:''}</g>`;
const iNavalMine=(cx,cy,r)=>`<g filter="url(#xSh)">`+[0,1,2,3,4,5,6,7].map(i=>{const a=i*Math.PI/4;return `<line x1="${(cx+Math.cos(a)*(r*.65)).toFixed(1)}" y1="${(cy+Math.sin(a)*(r*.65)).toFixed(1)}" x2="${(cx+Math.cos(a)*(r*1.48)).toFixed(1)}" y2="${(cy+Math.sin(a)*(r*1.48)).toFixed(1)}" stroke="#1b2638" stroke-width="${(r*.24).toFixed(1)}" stroke-linecap="round"/><circle cx="${(cx+Math.cos(a)*(r*1.48)).toFixed(1)}" cy="${(cy+Math.sin(a)*(r*1.48)).toFixed(1)}" r="${(r*.14).toFixed(1)}" fill="#c5d6e4"/>`;}).join('')+`<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#xB)" stroke="#0d131d" stroke-width="1"/><ellipse cx="${(cx-r*.32).toFixed(1)}" cy="${(cy-r*.34).toFixed(1)}" rx="${(r*.3).toFixed(1)}" ry="${(r*.18).toFixed(1)}" fill="#fff" opacity=".58" transform="rotate(-28 ${cx-r*.32} ${cy-r*.34})"/><circle cx="${(cx+r*.22).toFixed(1)}" cy="${(cy+r*.2).toFixed(1)}" r="${(r*.16).toFixed(1)}" fill="#ff5263"/></g>`;
const iMineFlag=(x,y,col,rim)=>`<g filter="url(#xSh)"><path d="M${x} ${y}v14M${x-4} ${y+14}h8" stroke="#15283d" stroke-width="2" stroke-linecap="round"/><path d="M${x} ${y}l11 4.4-11 4.4z" fill="${col}" stroke="${rim}" stroke-width=".8" stroke-linejoin="round"/></g>`;
const iPoetFigure=(robe,sleeve,hat)=>`<g><path d="M-12 24q4-15 12-17 8 2 12 17Z" fill="${robe}" stroke="#4e3d2e" stroke-width=".9"/><path d="M-10 24q4-8 8-14l5 5-5 9Z" fill="${sleeve}" stroke="#4e3d2e" stroke-width=".7"/><path d="M-4 8l4 4 4-4-4 7Z" fill="#fff3d5"/><circle cx="0" cy="-1" r="7.5" fill="#f5d8aa" stroke="#4e3d2e" stroke-width=".9"/>${hat}<path d="M-4 -1q1.5 1.2 3 0M1 -1q1.5 1.2 3 0" fill="none" stroke="#4e3d2e" stroke-width="1" stroke-linecap="round"/></g>`;
Object.assign(AR,{
 slide:I(bFlat('#E7DCC4'),`<rect x="6" y="6" width="88" height="88" rx="8" fill="url(#xWal)" filter="url(#xSh)"/><rect x="8" y="8" width="84" height="84" rx="6" filter="url(#xGr)" opacity=".32"/><rect x="7" y="7" width="86" height="86" rx="7" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="1"/><rect x="13" y="13" width="74" height="74" rx="4" fill="url(#xSlWel)" stroke="#0d1817" stroke-width="1.2"/><path d="M14.5 14.5H85.5M14.5 14.5V85.5" stroke="#08100f" stroke-width="1.8" opacity=".45"/><path d="M74 68v8m-3.2-3.2L74 76.2l3.2-3.4" fill="none" stroke="#ffd46b" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity=".82"/>`
   +iSlideTile(15,15,0,0,1)+iSlideTile(39,15,1,0,2)+iSlideTile(63,15,2,0,3)
   +iSlideTile(15,39,0,1,4)+iSlideTile(39,39,1,2,8)+iSlideTile(63,46,2,1,6)
   +iSlideTile(15,63,0,2,7)+iSlideTile(39,63,1,1,5)),
 bunyo:I(`<rect width="100" height="100" fill="url(#xBunBg)"/><rect width="100" height="100" filter="url(#xNo)" opacity=".35"/>`,
   `<rect x="8" y="6" width="84" height="88" rx="9" fill="#1b1645" fill-opacity=".6" stroke="#8e82c7" stroke-width="2.2"/>`
   +[1,2,3].map(i=>`<path d="M${8+i*21} 8V92" stroke="#fff" stroke-opacity=".06"/><path d="M10 ${6+i*22}H90" stroke="#fff" stroke-opacity=".06"/>`).join('')
   +`<rect x="27" y="62" width="22" height="20" rx="5" fill="url(#xBunG)"/><rect x="17" y="51" width="20" height="22" rx="5" fill="url(#xBunG)"/>`
   +iBunBlob(27,72,12,'xBunG',1)+iBunBlob(49,72,12,'xBunG',-1)+iBunBlob(27,51,11.5,'xBunG',1)
   +iBunBlob(73,72,12,'xBunB',-1)+iBunBlob(73,50,11.5,'xBunY',-1)
   +iBunBlob(46,27,12.5,'xBunR',1)+iBunBlob(68,23,11,'xBunB',-1)
   +`<path d="M40 43l1.6 4.4 4.4 1.6-4.4 1.6-1.6 4.4-1.6-4.4-4.4-1.6 4.4-1.6zM18 22l1.2 3.2 3.2 1.2-3.2 1.2-1.2 3.2-1.2-3.2-3.2-1.2 3.2-1.2z" fill="#ffe878"/>`),
 pakuris:I(`<rect width="100" height="100" fill="url(#xPakBg)"/><rect width="100" height="100" filter="url(#xNo)" opacity=".35"/>`,
   `<rect x="14" y="8" width="72" height="84" rx="5" fill="#130f33" stroke="#847fc1" stroke-width="2.4"/>`
   +[1,2,3,4].map(i=>`<path d="M${17.5+i*13} 11V89" stroke="#fff" stroke-opacity=".07"/>`).join('')
   +[1,2,3,4,5].map(i=>`<path d="M17.5 ${11+i*13}H82.5" stroke="#fff" stroke-opacity=".07"/>`).join('')
   +`<path d="M24 11V17M37 11V21M50 11V17" stroke="#5ee8ff" stroke-width="1.8" stroke-linecap="round" opacity=".55"/>`
   +`<rect x="18" y="38" width="38" height="11.5" rx="1.5" fill="none" stroke="#b873e3" stroke-width="1.1" stroke-dasharray="2.5 2" opacity=".48"/>`
   +[[0,4],[1,4],[0,5],[1,5]].map(([c,r])=>iTet(c,r,'#f8d34c','#fff4ad','#a67e12')).join('')
   +[[2,5],[3,5],[4,5],[4,4]].map(([c,r])=>iTet(c,r,'#f4a155','#ffd4a8','#9f5616')).join('')
   +[[2,4],[3,4],[3,3],[4,3]].map(([c,r])=>iTet(c,r,'#67df75','#bcffc4','#228232')).join('')
   +[[0,2],[0,3],[1,3],[2,3]].map(([c,r])=>iTet(c,r,'#4b8fec','#a8ceff','#1d4c99')).join('')
   +[[1,0],[0,1],[1,1],[2,1]].map(([c,r])=>iTet(c,r,'#b873e3','#ecc2ff','#6c2a9b')).join('')),
 mine:I(`<rect width="100" height="100" fill="url(#xMinBg)"/><rect width="100" height="100" filter="url(#xNo)" opacity=".4"/>`,
   `<rect x="9" y="9" width="82" height="82" rx="7" fill="#1e4963" stroke="#7fc2da" stroke-opacity=".55" stroke-width="1.5" filter="url(#xSh)"/>`
   +iMinOpn(14,14,'1','#2268bb')+iMinOpn(39,14,'2','#188c50')+iMinCov(64,14)
   +iMinOpn(14,39,'1','#2268bb')+iMinCov(39,39)+iMinOpn(64,39,'3','#d9513d')
   +iMinCov(14,64)+iMinCov(39,64)
   +`<rect x="64" y="64" width="22" height="22" rx="2.5" fill="#ea6371" stroke="#a62a38" stroke-width="1"/>`
   +iMineFlag(47,43,'#e62340','#941226')
   +iNavalMine(75,75,5.3)
   +`<g filter="url(#xSh)"><path d="M74 17l1.8 11 3-3.3 3.2 4.3 2-1.4-3.1-4.3 4.3-.9z" fill="#52d66d" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/><path d="M21 68l1.8 11 3-3.3 3.2 4.3 2-1.4-3.1-4.3 4.3-.9z" fill="#4d98f6" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/></g>`),
 mineVersus:I(`<polygon points="0,0 100,0 0,100" fill="url(#xVsB)"/><polygon points="100,0 100,100 0,100" fill="url(#xVsR)"/><rect width="100" height="100" filter="url(#xNo)" opacity=".38"/>`,
   `<path d="M0 98L42 53L34 45L66 47L58 55L100 2" fill="none" stroke="#331d04" stroke-width="6" stroke-linejoin="round"/><path d="M0 98L42 53L34 45L66 47L58 55L100 2" fill="none" stroke="#ffd45c" stroke-width="2.8" stroke-linejoin="round"/>`
   +`<g filter="url(#xSh)"><rect x="8" y="9" width="22" height="22" rx="3" fill="#dcecf0" stroke="#1b467a" stroke-width="1.2"/><text x="19" y="25.5" font-size="15" font-weight="900" text-anchor="middle" fill="#2268bb">1</text><rect x="33" y="9" width="22" height="22" rx="3" fill="#498fe0" stroke="#183f6e" stroke-width="1.2"/><path d="M34.5 29V10.5H53" fill="none" stroke="#b6dbff" stroke-width="1.6"/></g>`
   +iMineFlag(41,13,'#ffd45c','#996b10')
   +`<g filter="url(#xSh)"><rect x="45" y="69" width="22" height="22" rx="3" fill="#d9525e" stroke="#691820" stroke-width="1.2"/><path d="M46.5 89V70.5H65" fill="none" stroke="#ffa8b0" stroke-width="1.6"/><rect x="70" y="69" width="22" height="22" rx="3" fill="#f9dce0" stroke="#7d1f28" stroke-width="1.2"/><text x="81" y="85.5" font-size="15" font-weight="900" text-anchor="middle" fill="#c22332">3</text></g>`
   +iMineFlag(53,73,'#fff','#8a1d28')
   +`<g filter="url(#xSh)"><path d="M79 11l9 3v7c0 6-4 10-9 12-5-2-9-6-9-12v-7z" fill="#f5c342" stroke="#7a4e08" stroke-width="1.4" stroke-linejoin="round"/><path d="M79 14.5v14.5M74 20h10" stroke="#fff4bd" stroke-width="1.6" stroke-linecap="round"/></g>`
   +`<g filter="url(#xSh)" stroke="#9ef2ff" stroke-width="2.1" stroke-linecap="round"><path d="M21 71v16M14 75l14 8M28 75l-14 8"/><circle cx="21" cy="79" r="2.2" fill="#fff" stroke="none"/></g>`
   +iNavalMine(50,50,12.5)),
 bozu:I(bFelt(),
   `<g transform="rotate(-14 28 54)" filter="url(#xSh)"><rect x="11" y="23" width="34" height="52" rx="3.5" fill="#263c32"/><rect x="13.5" y="25.5" width="29" height="47" rx="1.8" fill="#8b3e38"/><rect x="16" y="28" width="24" height="42" rx="1" fill="none" stroke="#edce9c" stroke-width="1.2"/><path d="M17 33l22 22M17 46l18 18M22 28l17 17M39 33L17 55M39 46L21 64M34 28L17 45" stroke="#d5b375" stroke-width=".8" opacity=".65"/></g>`
   +`<g transform="rotate(15 74 55)" filter="url(#xSh)"><rect x="57" y="23" width="34" height="52" rx="3.5" fill="#263c32"/><rect x="59.5" y="25.5" width="29" height="47" rx="1.8" fill="url(#xIv)"/><path d="M60 68q14-5 28 0v4H60Z" fill="#c8aa79"/><g transform="translate(76,51) scale(.84)">${iPoetFigure('#c55147','#e0a65d',`<path d="M-9 8q-3-16 9-17 12-1 10 17l-4-2q-2-6-6-7-4 2-9 9z" fill="#292725"/>`)}<path d="M2 10l-7-10q9-5 16 1z" fill="#ead7aa" stroke="#755c34" stroke-width=".8"/></g></g>`
   +`<g filter="url(#xSh)"><rect x="27" y="14" width="46" height="70" rx="4" fill="#263c32"/><rect x="30" y="17" width="40" height="64" rx="2" fill="url(#xIv)"/><path d="M30 75q20-6 40 0v6H30Z" fill="#c8aa79"/><path d="M34 78q5-17 16-19 11 2 16 19Z" fill="#99805f" stroke="#554334" stroke-width="1"/><path d="M37 78q5-9 11-16l6 5-7 11Z" fill="#aa754e" stroke="#554334" stroke-width=".8"/><path d="M46 59l4 4 4-4-4 8Z" fill="#fff3d5"/><path d="M41 70q9 5 18 0" fill="none" stroke="#f3dc9d" stroke-width="2.5" stroke-dasharray="1.4 2.2" stroke-linecap="round"/><circle cx="50" cy="44.5" r="11.2" fill="#f5d8aa" stroke="#554334" stroke-width="1.2"/><ellipse cx="46.2" cy="39" rx="3.4" ry="1.8" fill="#fff" opacity=".62" transform="rotate(-24 46.2 39)"/><path d="M44 45.5q2 2 4 0M52 45.5q2 2 4 0" fill="none" stroke="#554334" stroke-width="1.3" stroke-linecap="round"/><path d="M47.3 50q2.7 2 5.4 0" fill="none" stroke="#554334" stroke-width="1.1" stroke-linecap="round"/><path d="M35 22v8M39 21v10M65 22v7" stroke="#3b2f24" stroke-width="1.3" stroke-linecap="round" opacity=".68"/></g>`),
 karuta:I(bFelt(),
   `<g transform="rotate(-11 33 48)" filter="url(#xSh)"><rect x="12" y="15" width="42" height="62" rx="3.8" fill="#263c32"/><rect x="14.8" y="17.8" width="36.4" height="56.4" rx="2" fill="url(#xIv)"/><path d="M15 70q18-6 36 0v4H15Z" fill="#c8aa79"/><g transform="translate(33,50)">${iPoetFigure('#618880','#8da388',`<path d="M-7 -4q-3-7 3-11 6-3 10 3l2 6-6-2z" fill="#2b2622"/>`)}</g><path d="M19 22v9M23 21v11M46 22v8" stroke="#3b2f24" stroke-width="1.2" stroke-linecap="round" opacity=".65"/></g>`
   +`<path d="M22 86q28 8 64-10" fill="none" stroke="#ffc65c" stroke-width="2.5" stroke-linecap="round" opacity=".7"/>`
   +`<g transform="rotate(8 64 56)" filter="url(#xSh)"><rect x="42" y="23" width="44" height="64" rx="3.8" fill="#263c32"/><rect x="44.8" y="25.8" width="38.4" height="58.4" rx="2" fill="url(#xIv)"/><path d="M45 34q11 4 19-2t19 1v-7H45Z" fill="#e5c16c" opacity=".32"/><path d="M45 76q11-4 19 2t19-1v7H45Z" fill="#e5c16c" opacity=".32"/><text x="72" y="42" font-family="Yuji Boku,serif" font-size="13.5" text-anchor="middle" fill="#1c140c">は</text><text x="72" y="57.5" font-family="Yuji Boku,serif" font-size="13.5" text-anchor="middle" fill="#1c140c">る</text><text x="72" y="73" font-family="Yuji Boku,serif" font-size="13.5" text-anchor="middle" fill="#1c140c">す</text><text x="55" y="48" font-family="Yuji Boku,serif" font-size="14" text-anchor="middle" fill="#1c140c">ぎ</text><text x="55" y="65" font-family="Yuji Boku,serif" font-size="14" text-anchor="middle" fill="#1c140c">て</text><rect x="48.5" y="74" width="5" height="5" rx=".8" fill="#c8362e" opacity=".82"/></g>`
   +`<g transform="translate(83,18) rotate(22)" filter="url(#xSh)"><path d="M0 -6C4 -4 5 2 0 6C-5 2 -4 -4 0 -6Z" fill="#f5a4bd" stroke="#d46888" stroke-width=".6"/></g><g transform="translate(20,82) rotate(-32) scale(.85)"><path d="M0 -6C4 -4 5 2 0 6C-5 2 -4 -4 0 -6Z" fill="#f5a4bd" stroke="#d46888" stroke-width=".6"/></g>`),
 wolf:I(`<rect width="100" height="100" fill="url(#xWlfS)"/><rect width="100" height="100" filter="url(#xNo)" opacity=".36"/>`,
   `<circle cx="15" cy="17" r="1.4" fill="#fff2bd"/><circle cx="31" cy="11" r="1" fill="#fff2bd"/><circle cx="88" cy="15" r="1.2" fill="#fff2bd"/><circle cx="91" cy="48" r=".9" fill="#fff2bd"/><circle cx="10" cy="44" r=".9" fill="#fff2bd"/>`
   +`<circle cx="62" cy="32" r="29" fill="#ffe49e" opacity=".13"/><circle cx="62" cy="32" r="24" fill="#ffe49e" opacity=".2"/><circle cx="62" cy="32" r="20" fill="url(#xWlfM)" filter="url(#xSh)"/><circle cx="56" cy="26" r="4" fill="#d9a53a" opacity=".24"/><circle cx="70" cy="36" r="2.8" fill="#d9a53a" opacity=".24"/><circle cx="64" cy="22" r="2" fill="#d9a53a" opacity=".22"/>`
   +`<path d="M0 90L12 72L21 90ZM8 90L24 68L36 90ZM66 90L77 70L88 90ZM77 90L90 66L100 90Z" fill="#090c18"/><path d="M0 87H100V100H0Z" fill="#090c18"/><path d="M68 89V78L78 71L88 78V89Z" fill="#0d1122"/><rect x="74" y="81" width="3.2" height="3.8" fill="#ffc65c"/><rect x="79" y="81" width="3.2" height="3.8" fill="#ffc65c"/>`
   +`<g filter="url(#xSh)"><path d="M0 100C4 82 10 68 17 57L14 53L21 46L21 39L26 24L33 33L38 21L43 32Q48 30 53 26L65 19Q68 20 66 24L56 30L61 30Q61 33 56 35L48 37Q54 45 48 53L54 59L48 67L55 78L62 100Z" fill="#12172a"/><path d="M17 57L21 46L21 39L26 24L33 33L38 21L43 32Q48 30 53 26L65 19" fill="none" stroke="#9eb8ed" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="44.5" cy="33.5" rx="2.5" ry="1.4" fill="#ffbe3b" transform="rotate(-24 44.5 33.5)"/><circle cx="44.2" cy="33.3" r=".7" fill="#fff"/></g>`),
});
window.CHESS_PATHS = CH;

// 承認済みの対局盤から、一覧・準備画面用に特徴のある札と駒を描く。
const iExtraTile = (x,y,n,col,w=23,h=31) => `<g filter="url(#xSh)"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="url(#xIv)" stroke="#aa9473"/><text x="${x+w/2}" y="${y+h*.69}" font-family="Georgia,serif" font-weight="700" font-size="${w*.74}" text-anchor="middle" fill="${col}">${n}</text><path d="M${x+w*.35} ${y+h*.84}h${w*.3}" stroke="${col}" stroke-width="1.4"/></g>`;
const iExtraGhost = (x,y,col) => `<g transform="translate(${x} ${y})" filter="url(#xSh)"><path d="M-14 13Q-10 8-11 0Q-11-13 0-14Q12-14 11 0Q10 8 14 13L8 16 4 13 0 17-5 13-10 16Z" fill="url(#xIv)" stroke="#766b5a"/>${col?`<circle cy="4" r="5" fill="${col}" stroke="#53453a"/><circle cx="-1.3" cy="2.1" r="1.7" fill="#fff8"/>`:'<path d="M-4-2v3m8-3v3" stroke="#584c3a" stroke-width="2" stroke-linecap="round"/>'}</g>`;
Object.assign(AR,{
  war:I(bFelt(),iCard(11,25,35,'4','♦',-10,{gold:true})+iCard(54,25,35,'3','♦',10)),
  takoyaki:I(bFelt(),iCard(19,14,24,'A','♣')+iCard(57,14,24,'2','♦')+iCard(19,52,24,'','',0,{back:true})+iCard(57,52,24,'','',0,{back:true,gold:true})),
  butanoshippo:I(bFelt(),Array.from({length:8},(_,i)=>{const a=i*Math.PI/4;return iCard(43+31*Math.sin(a),39+29*Math.cos(a),14,'','',-i*45,{back:true});}).join('')+iCard(38,33,24,'5','♦',8)),
  oldmaid:I(bFelt(),iCard(12,17,28,'','',-21,{back:true})+iCard(36,11,28,'','',0,{back:true})+iCard(60,17,28,'','',21,{back:true})+iCard(34,43,32,'J','★',0,{gold:true})),
  hearts:I(bFelt(),iCard(13,29,34,'Q','♠',-16)+iCard(46,20,39,'A','♥',15)),
  ginrummy:I(bFelt(),iCard(12,24,30,'5','♠',-10)+iCard(35,19,30,'6','♠',0)+iCard(59,26,30,'7','♠',10)),
  vulture:I(bFelt(),`<rect x="27" y="8" width="46" height="65" rx="4" fill="#4b3544" stroke="#f1cd8c" stroke-width="2"/><path d="M32 23l15 6 3 3 5-5 14-10-4 10-11 11-5 8-4-9z" fill="#f0c37d"/><text x="50" y="62" fill="#f7d185" text-anchor="middle" font-size="20" font-family="Georgia,serif">+6</text>`+iExtraTile(18,70,'8','#8b5630',20,24)+iExtraTile(62,70,'12','#8b5630',20,24)),
  goita:I(bWood('xKaya',.2),iKoma(33,47,1.2,' 香',-11)+iKoma(66,52,1.35,' 王',12)),
  quarto:I(bWood('xOak'),`<path d="M6 62l44-23 44 23v7L50 95 6 70z" fill="#71472b"/><path d="M6 62l44-25 44 25-44 25z" fill="#d3a474" stroke="#f5d6ae"/><path d="M20 54a9 5 0 0 0 18 0V28H20z" fill="#e1ad65"/><ellipse cx="29" cy="28" rx="9" ry="5" fill="#ffe1a6"/><ellipse cx="29" cy="28" rx="3.5" ry="2" fill="#61482e"/><path d="M54 54l12-7 12 7v13l-12 7-12-7z" fill="#78492f"/><path d="M54 54l12-7 12 7-12 7z" fill="#aa714a"/>`),
  geister:I(bFlat('#cdb79b'),'<path d="M0 0H50V50H0ZM50 50H100V100H50Z" fill="#aa9d82"/>'+iExtraGhost(30,31,null)+iExtraGhost(67,49,'#368ab6')+iExtraGhost(34,70,'#c55c48')),
  rummikub:I(bFelt(),iExtraTile(12,16,'13','#aa3930')+iExtraTile(38,16,'13','#2a5e9d')+iExtraTile(64,16,'13','#302d28')+iExtraTile(12,52,'5','#a36712')+iExtraTile(38,52,'6','#a36712')+iExtraTile(64,52,'7','#a36712')),
  pegsolitaire:I(bFlat('#dfd2ba'),`<circle cx="50" cy="50" r="43" fill="url(#xOak)" stroke="#916241" stroke-width="3"/><circle cx="50" cy="50" r="38" fill="none" stroke="#e1b485"/>`
    +[[35,35],[50,35],[65,35],[20,50],[35,50],[50,50],[65,50],[80,50],[35,65],[50,65],[65,65]].map(([x,y],i)=>i===5||i===8?`<circle cx="${x}" cy="${y}" r="5.3" fill="#624028"/>`:ball(x,y,5.3,'G')).join('')),
});
