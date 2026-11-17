from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];BASE='http://127.0.0.1:8040/web/pc-firebase/'
ART=Path('/tmp/artifacts');ART.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'])
 ctx=b.new_context(viewport={'width':1440,'height':900},service_workers='block');ctx.route('**/js/net.js',lambda route:route.fulfill(path=str(ROOT/'tools/tests/firebase-memory-net.js'),content_type='text/javascript'))
 ctx.add_init_script('''localStorage.setItem('asobi30pc',JSON.stringify({firstDone:true}));window.soundCalls=[];window.hiddenTest=false;Object.defineProperty(document,'hidden',{get:()=>window.hiddenTest});''')
 ctx.set_default_timeout(30000);host=ctx.new_page();guest=ctx.new_page();errors=[]
 for page in [host,guest]:
  page.on('pageerror',lambda e:(errors.append(str(e)),print('PAGE ERROR',e,flush=True)));page.goto(BASE);page.wait_for_function('CAT.length===30 && netReady',polling=100,timeout=60000);page.evaluate("S.set.hover=false;S.set.cutin=false;S.set.cursor='全員'; const original=sfx.play;sfx.play=(name,opt)=>{soundCalls.push(name);original(name,opt)};playMoveSound=(m)=>soundCalls.push('MOVE:'+m)")
 # Verify filter position on menu before room creation, and filter switch animation class
 filter_box_before=host.locator('.rail .rail-filter').bounding_box()
 host.locator('.rail .rail-filter [data-v="2人"]').click()
 assert host.locator('.main.filter-enter').count()==1
 host.locator('.rail .rail-filter [data-v="すべて"]').click()
 host.evaluate("go('room')")
 host.evaluate('createFirebaseRoom()');host.wait_for_function('fbState.roomId',polling=100)
 assert host.evaluate("S.screen==='room'");assert host.get_by_role('button',name='ゲームを選ぶ',exact=True).count()==0;assert host.locator('.howto').count()==1;assert host.locator('.rail .room-summary').count()==1
 assert host.locator('.rail .rail-filter').evaluate('e=>getComputedStyle(e).visibility')=='hidden'
 box_room=host.locator('.rail .room-summary').bounding_box()
 for tab in ['records','settings','menu']:
  host.locator(f'.rail [data-go={tab}]').click();assert host.locator('.rail .room-summary').count()==1;assert host.locator('.rail .room-summary').bounding_box()==box_room
 assert host.locator('.rail .rail-filter').evaluate('e=>getComputedStyle(e).visibility')=='visible'
 assert host.locator('.rail .rail-filter').bounding_box()==filter_box_before
 assert host.locator('.rail .rail-filter').bounding_box()['y']<box_room['y']
 assert host.locator('[data-next]').is_disabled();guest.evaluate("go('room');joinFirebaseRoom('4829')");guest.wait_for_function('ost && ost.mySlot===1',polling=100);host.bring_to_front();host.wait_for_function('ost.members.length===2',polling=100)
 # Lobby/menu must not display remote cursors, but keep the how-to panel.
 guest.mouse.move(300,300);host.wait_for_timeout(200)
 assert host.locator('.rcur.live').count()==0
 assert '4桁のルームコード' in host.locator('.room-howto').inner_text()
 guest.locator('[data-tile=chess]').click();host.wait_for_selector('[data-tile=chess] .wish-player');assert guest.evaluate("S.screen==='menu'");assert guest.locator('[data-next]').is_disabled();assert host.locator('[data-tile=chess] .wish-player').count()==1
 host.locator('[data-tile=chess]').click();host.wait_for_function("document.querySelectorAll('[data-tile=chess] .wish-player').length===2",polling=100);assert host.locator('[data-tile=chess] .wish-frame').count()==1;assert guest.locator('[data-tile=chess] .wish-frame').count()==1;assert host.locator('[data-tile=chess] .wish-frame').evaluate('e=>getComputedStyle(e).borderRadius')=='14px';assert host.locator('[data-tile=chess] .wish-frame').evaluate('e=>getComputedStyle(e).outlineOffset')=='1px';assert guest.evaluate("S.screen==='menu'")
 host.screenshot(path=str(ART/'firebase-shared-menu.png'))
 host.locator('[data-tile=reversi]').click();host.locator('[data-next]').click();assert host.evaluate("S.screen==='setup' && S.setup.online");host.evaluate('onlineChooseAndStart()')
 host.wait_for_function("S.screen==='play' && view && view.legal.length>0",timeout=15000,polling=100);guest.bring_to_front();guest.wait_for_function("S.screen==='play' && view",timeout=15000,polling=100)
 host.wait_for_timeout(1600)
 # Mid-match spectator join: 3rd client joins while match is PLAYING and views the match screen
 spec=ctx.new_page()
 spec.on('pageerror',lambda e:(errors.append(str(e)),print('PAGE ERROR',e,flush=True)))
 spec.goto(BASE);spec.wait_for_function('CAT.length===30 && netReady',polling=100,timeout=60000)
 spec.evaluate("S.set.hover=false;S.set.cutin=false;S.set.name='観戦者';go('room');joinFirebaseRoom('4829')")
 spec.wait_for_function("S.screen==='play' && view && view.mine===-1",timeout=15000,polling=100)
 assert '観戦中' in spec.locator('.stagehead span').inner_text()
 assert spec.evaluate("seatName(0)!=='観戦者'")
 # Spectator can return to room without resigning and re-enter spectating
 spec.evaluate('goBack()');assert spec.evaluate("S.screen==='room'")
 assert spec.locator('[data-oreturn]').count()==1
 spec.locator('[data-oreturn]').click();spec.wait_for_function("S.screen==='play' && view && view.mine===-1",polling=100)
 # From the first game frame, colour is consistent and movement is interpolated.
 guest.mouse.move(300,300);host.wait_for_selector('.rcur.live');host.wait_for_timeout(150)
 assert host.locator('.rcur.live svg path').first.evaluate('e=>getComputedStyle(e).fill')=='rgb(63, 120, 196)'
 host.bring_to_front()
 positions=host.evaluate("""async()=>{const uid=[...remoteCursors.keys()][0], c=remoteCursors.get(uid);updateRemoteTargets({[uid]:{x:.75,y:.5,slot:1,active:true}});const result=[];for(let i=0;i<8;i++){await new Promise(requestAnimationFrame);result.push(document.getElementById('rc_'+uid).style.transform)}return result}""")
 assert len(set(positions))>=3,positions
 # Host then guest move: each confirmed move produces one sound on each client.
 for turn in range(2):
  actor=host if host.evaluate('view.human') else guest
  before=host.evaluate('view.moves')
  for page in [host,guest]:page.evaluate('soundCalls=[]')
  actor.bring_to_front();actor.evaluate('humanMove(view.legal[0])')

  for page in [host,guest,spec]:
   page.bring_to_front();page.wait_for_function(f'view.moves>{before}',polling=100);page.wait_for_timeout(900)
  for page in [host,guest]:assert len(page.evaluate("soundCalls.filter(x=>x.startsWith('MOVE:'))"))==1,page.evaluate('soundCalls')
 # Settings overlay preserves match handle, board and room; controls stay open after rerender.
 handle=host.evaluate('h');host.locator('[data-playsettings]').click();host.wait_for_selector('#playsettings');host.locator('[data-scat=sound]').click();host.locator('[data-sw=hover]').click();assert host.locator('#playsettings').count()==1;assert host.evaluate('h')==handle
 host.wait_for_timeout(250);assert host.locator('#sheet').evaluate('e=>e.getBoundingClientRect().width')>700;host.screenshot(path=str(ART/'firebase-game-settings.png'));host.locator('[data-playsettingsclose]').click();assert host.locator('#playsettings').count()==0;assert host.evaluate('h')==handle
 # Repaint without further network events must recreate the cursor, retaining colour.
 guest.mouse.move(400,300);host.wait_for_timeout(200);host.evaluate('render()');host.wait_for_selector('.rcur.live');assert host.locator('.rcur.live svg path').first.evaluate('e=>getComputedStyle(e).fill')=='rgb(63, 120, 196)'
 host.evaluate("S.screen='menu';render()");host.wait_for_timeout(100);assert host.locator('.rcur.live').count()==0;host.evaluate("S.screen='play';render()");host.wait_for_selector('.rcur.live')
 # Hidden sound and a delayed effect must be discarded, rather than replaying on return.
 host.evaluate("soundCalls=[];transientAudio.later(()=>sfx.play('TAP'),300);hiddenTest=true;document.dispatchEvent(new Event('visibilitychange'))")
 host.wait_for_timeout(400);host.evaluate("hiddenTest=false;document.dispatchEvent(new Event('visibilitychange'))");host.wait_for_timeout(500);assert host.evaluate('soundCalls')==[]
 assert not errors,errors
 print('PASS: 3 real-core clients (host, guest, spectator), rail filter/room-summary layout & animation, room menu and guest wishes, mid-match spectating, play-only cursor and colour, interpolation, both players move once, settings overlay, rerender cursor, hidden delayed sound discarded')
 b.close()
