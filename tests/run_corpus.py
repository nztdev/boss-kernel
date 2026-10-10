import os
import sys, json
from playwright.sync_api import sync_playwright
corpus = sys.argv[1] if len(sys.argv)>1 else os.path.join(os.path.dirname(os.path.abspath(__file__)),'phrases.tsv')
rows=[]
for ln in open(corpus, encoding='utf8'):
    ln=ln.rstrip('\n')
    if not ln.strip() or ln.startswith('#'): continue
    exp, ph = ln.split('\t',1)
    if '|' in ph and not ph.startswith('http'): print('FORMAT? alternatives belong in the first column:', ln)
    rows.append((exp,ph))
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
    pg=b.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(os.environ.get('BOSS_URL','http://localhost:8123/core/index.html')); pg.wait_for_timeout(2500)
    res=pg.evaluate("rows => rows.map(([e,p]) => ({e,p,r:window.BOSS_route(p)}))", rows)
    b.close()
ok=0; bad=[]; arb=[]
for x in res:
    r=x['r']; exp=[e.strip() for e in x['e'].split('|')]
    got = 'NATIVE' if r['outcome']=='native' else ('HELP' if r['outcome']=='help' else r['node'])
    # arbiter outcomes: acceptable only if the user would get the right node; report as ARB
    if r['outcome']=='conflict':
        got='CONFLICT:'+'/'.join(r['between'])
    good = got in exp
    if good: ok+=1
    elif r['outcome']=='conflict' and r['node'] in exp:
        arb.append((x['e'],x['p'],got,r.get('top3')))
    else: bad.append((x['e'],x['p'],got,r.get('via'),r.get('top3')))
print(f"{ok}/{len(res)} correct without blocking | {len(arb)} right node but blocked by Arbiter clarification | {len(bad)} wrong/unrouted")
print('--- right node, but Arbiter would ask the user (count %d) ---'%len(arb))
for e,p,g,t in arb: print(f"  {e:8} {g:22} {t} <- {p}")
print('--- WRONG / UNROUTED ---')
for e,p,g,v,t in bad: print(f"  want {e:8} got {g:18} [{v}] {t}  <- {p}")
print('ERR',errs)
