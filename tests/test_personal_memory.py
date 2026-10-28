"""Scripted checks for personal memory (actions/personal.js). Run: python3 tests/test_personal_memory.py   (needs the site on http://localhost:8123 or BOSS_URL)
Prints one line per scenario and exits non-zero if an expectation fails."""
import os, sys
from playwright.sync_api import sync_playwright
FAILS=[]
def expect(name,ok):
    print(('PASS ' if ok else 'FAIL ')+name)
    if not ok: FAILS.append(name)
def run(pg,x,wait=1500):
    pg.evaluate("document.getElementById('console').innerHTML=''")
    pg.fill('#pulse-input',x); pg.keyboard.press('Enter'); pg.wait_for_timeout(wait)
    return ' | '.join(l[9:] for l in pg.evaluate("document.getElementById('console').innerText").split('\n') if l.strip() and not l[9:].startswith(('⚡','📡','🔗')))[:260]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium',args=['--no-sandbox']); pg=b.new_page()
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script("try{ if(!localStorage.getItem('_seen')){localStorage.setItem('BOSS_BOOT','off');localStorage.setItem('_seen','1')} }catch(e){}")
    pg.goto(os.environ.get('BOSS_URL','http://localhost:8123/core/index.html')); pg.wait_for_timeout(2500)
    expect('teach confirms', 'Got it' in run(pg,'when I say brew time, I mean set a timer for 4 minutes'))
    o=run(pg,'Brew time!',2500); expect('shortcut rewrites and sets a 4-minute timer', 'your shortcut' in o and 'Timer set: 4 minutes' in o)
    expect('secret refused', "don't store" in run(pg,'when I say my code, I mean remember my pin is 1234'))
    expect('teach-in-teach refused', "can't be another" in run(pg,'when I say foo, I mean when I say bar, I mean play music'))
    expect('normal timer unaffected', 'Timer set: 5 minutes' in run(pg,'set a timer for 5 minutes',2500))
    expect('one trusted shortcut', pg.evaluate('BOSS_personal.summary().trusted')==1)

    # node lesson: 3 consistent answers
    for k in range(3): pg.evaluate("BOSS_personal.learnNode('gobbledy gook','MEDIA')")
    expect('3 answers make a node lesson trusted', pg.evaluate("BOSS_personal.lookupNode('Gobbledy gook!')")=='MEDIA')
    pg.evaluate("BOSS_personal.learnNode('gobbledy gook','CORE')")
    expect('one contradiction demotes', pg.evaluate("BOSS_personal.list().find(i=>i.type=='node').state")=='tentative')
    expect('elevated-risk node never learned', pg.evaluate("BOSS_personal.learnNode('zzz yyy','COMMS',n=>n==='COMMS')") is None)
    # persistence + backup key
    pg.reload(); pg.wait_for_timeout(2500)
    expect('survives reload', 'Timer set: 4 minutes' in run(pg,'brew time',2500))
    expect('stored under the backed-up key', pg.evaluate("!!localStorage.getItem('BOSS_PERSONAL_MEMORY')"))
    # off
    pg.evaluate("BOSS_personal.setEnabled(false)"); expect('off = shortcut not applied', 'your shortcut' not in run(pg,'brew time',1800))
    pg.evaluate("BOSS_personal.setEnabled(true)")
    # forget
    pg.evaluate("BOSS_personal.forgetAll()"); expect('forget everything', pg.evaluate('BOSS_personal.summary().count')==0)
    # aging
    pg.evaluate("BOSS_personal.teach('old one','play music')"); pg.evaluate("(()=>{const s=JSON.parse(localStorage.BOSS_PERSONAL_MEMORY); s.items[0].lastUsed=Date.now()-200*86400000; localStorage.BOSS_PERSONAL_MEMORY=JSON.stringify(s)})()")
    expect('no auto-removal by default', pg.evaluate('BOSS_personal.prune()')==0 and pg.evaluate('BOSS_personal.summary().count')==1)
    expect('auto-removal drops a 200-day-old lesson when on', pg.evaluate('(BOSS_personal.setAutoAge(true), BOSS_personal.summary().count)')==0)
    expect('no page errors', not errs); b.close(); sys.exit(1 if FAILS else 0)