from pathlib import Path
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);ctx=b.new_context(viewport={'width':1440,'height':900},service_workers='block');ctx.route('**/js/net.js',lambda r:r.fulfill(path=str(R/'tools/tests/firebase-memory-net.js'),content_type='text/javascript'));page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:8040/web/pc-firebase/');page.wait_for_function('ORDER.filter(id=>gInfo(id)).length===50');page.evaluate("store.set('stats',{});go('records')")
 assert page.locator('[data-record-game]').count()==50
 assert page.locator('.unplayed-games [data-record-game]').count()==50
 assert page.locator('.record-art svg').count()==50
 assert page.locator('[data-record-game=mine]').count()==1
 assert page.locator('[data-record-game=mineVersus]').count()==0
 assert page.locator('.record-art svg').first.evaluate('e=>getComputedStyle(e).borderRadius')=='10px'
 page.evaluate("store.set('stats',{vs_reversi:[3,1,1],solo_solitaire:[2],vs_chess:[0,0,0]});render()")
 assert page.locator('.unplayed-games [data-record-game]').count()==47
 assert '60%' in page.locator('[data-record-game=reversi]').inner_text()
 assert 'ひとりで 2回' in page.locator('[data-record-game=solitaire]').inner_text()
 assert page.locator('.unplayed-games [data-record-game=chess]').count()==1
 assert page.locator('[data-record-game]').count()==50
 page.screenshot(path='/workspace/artifacts/firebase-records.png')
 assert not errors,errors
 print('PASS: all 50 games and icons on initial records view; unplayed grouped; wins/losses/draws/rate/solo counts retained')
 b.close()
