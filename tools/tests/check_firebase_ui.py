from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];BASE='http://127.0.0.1:8040/web/pc-firebase/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'])
 ctx=b.new_context(viewport={'width':1440,'height':900},service_workers='block');ctx.route('**/js/net.js',lambda route:route.fulfill(path=str(ROOT/'tools/tests/firebase-memory-net.js'),content_type='text/javascript'))
 ctx.add_init_script('''localStorage.setItem('asobi30pc',JSON.stringify({firstDone:true}));window.soundCalls=[];window.hiddenTest=false;Object.defineProperty(document,'hidden',{get:()=>window.hiddenTest});''')
 ctx.set_default_timeout(30000);host=ctx.new_page();guest=ctx.new_page();errors=[]
 for page in [host,guest]:
  page.on('pageerror',lambda e:(errors.append(str(e)),print('PAGE ERROR',e,flush=True)));page.goto(BASE);page.wait_for_function('CAT.length===30 && netReady',polling=100,timeout=60000);page.evaluate("S.set.hover=false;S.set.cutin=false;S.set.cursor='全員'; const original=sfx.play;sfx.play=(name,opt)=>{soundCalls.push(name);original(name,opt)};playMoveSound=(m)=>soundCalls.push('MOVE:'+m);go('room')")
 host.evaluate('createFirebaseRoom()');host.wait_for_function('fbState.roomId',polling=100)
 assert host.evaluate("S.screen==='menu'");assert host.locator('[data-next]').is_disabled();guest.evaluate("joinFirebaseRoom('4829')");guest.wait_for_function('ost && ost.mySlot===1',polling=100);host.bring_to_front();host.wait_for_function('ost.members.length===2',polling=100)
 # Lobby/menu must not display remote cursors, but keep the how-to panel.
 guest.mouse.move(300,300);host.wait_for_timeout(200)
 assert host.locator('.rcur.live').count()==0
 assert '4桁のルームコード' in host.locator('.room-howto').inner_text()
 guest.locator('[data-tile=chess]').click();host.wait_for_selector('[data-tile=chess] .wish-player');assert guest.evaluate("S.screen==='menu'");assert guest.locator('[data-next]').is_disabled();assert host.locator('[data-tile=chess] .wish-player').count()==1
 host.locator('[data-tile=chess]').click();host.wait_for_function("document.querySelectorAll('[data-tile=chess] .wish-player').length===2",polling=100);assert host.locator('[data-tile=chess] .wish-frame').count()==2;assert guest.evaluate("S.screen==='menu'")
 host.screenshot(path='/workspace/artifacts/firebase-shared-menu.png')
 host.locator('[data-tile=reversi]').click();host.locator('[data-next]').click();assert host.evaluate("S.screen==='setup' && S.setup.online");host.evaluate('onlineChooseAndStart()')
 host.wait_for_function("S.screen==='play' && view && view.legal.length>0",timeout=15000,polling=100);guest.bring_to_front();guest.wait_for_function("S.screen==='play' && view",timeout=15000,polling=100)
 host.wait_for_timeout(1600)
 # From the first game frame, colour is consistent and movement is interpolated.
 guest.mouse.move(300,300);host.wait_for_selector('.rcur.live');host.wait_for_timeout(150)
 assert host.locator('.rcur.live svg path').evaluate('e=>getComputedStyle(e).fill')=='rgb(63, 120, 196)'
 host.bring_to_front()
 positions=host.evaluate("""async()=>{const uid=[...remoteCursors.keys()][0], c=remoteCursors.get(uid);updateRemoteTargets({[uid]:{x:.75,y:.5,slot:1,active:true}});const result=[];for(let i=0;i<8;i++){await new Promise(requestAnimationFrame);result.push(document.getElementById('rc_'+uid).style.transform)}return result}""")
 assert len(set(positions))>=3,positions
 # Host then guest move: each confirmed move produces one sound on each client.
 for turn in range(2):
  actor=host if host.evaluate('view.human') else guest
  before=host.evaluate('view.moves')
  for page in [host,guest]:page.evaluate('soundCalls=[]')
  actor.bring_to_front();actor.evaluate('humanMove(view.legal[0])')

  for page in [host,guest]:
   page.bring_to_front();page.wait_for_function(f'view.moves>{before}',polling=100);page.wait_for_timeout(900)
  for page in [host,guest]:assert len(page.evaluate("soundCalls.filter(x=>x.startsWith('MOVE:'))"))==1,page.evaluate('soundCalls')
 # Settings overlay preserves match handle, board and room; controls stay open after rerender.
 handle=host.evaluate('h');host.locator('[data-playsettings]').click();host.wait_for_selector('#playsettings');host.locator('[data-scat=sound]').click();host.locator('[data-sw=hover]').click();assert host.locator('#playsettings').count()==1;assert host.evaluate('h')==handle
 host.wait_for_timeout(250);assert host.locator('#sheet').evaluate('e=>e.getBoundingClientRect().width')>700;host.screenshot(path='/workspace/artifacts/firebase-game-settings.png');host.locator('[data-playsettingsclose]').click();assert host.locator('#playsettings').count()==0;assert host.evaluate('h')==handle
 # Repaint without further network events must recreate the cursor, retaining colour.
 guest.mouse.move(400,300);host.wait_for_timeout(200);host.evaluate('render()');host.wait_for_selector('.rcur.live');assert host.locator('.rcur.live svg path').evaluate('e=>getComputedStyle(e).fill')=='rgb(63, 120, 196)'
 host.evaluate("S.screen='menu';render()");host.wait_for_timeout(100);assert host.locator('.rcur.live').count()==0;host.evaluate("S.screen='play';render()");host.wait_for_selector('.rcur.live')
 # Hidden sound and a delayed effect must be discarded, rather than replaying on return.
 host.evaluate("soundCalls=[];transientAudio.later(()=>sfx.play('TAP'),300);hiddenTest=true;document.dispatchEvent(new Event('visibilitychange'))")
 host.wait_for_timeout(400);host.evaluate("hiddenTest=false;document.dispatchEvent(new Event('visibilitychange'))");host.wait_for_timeout(500);assert host.evaluate('soundCalls')==[]
 assert not errors,errors
 print('PASS: 2 real-core clients, room menu and guest wishes, host-only start, play-only cursor and colour, interpolation, both players move once, settings overlay, rerender cursor, hidden delayed sound discarded')
 b.close()
