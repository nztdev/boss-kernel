"""Bond-strength ("synaptic") stress measurement for the current build (README §XVI-b, build 0.14.5).
Gives every node sparse bonds of strength 0 / 0.2 / 0.4 (two partners each, several layouts) and every possible
"last node used", then re-routes all four corpora via BOSS_bonds()/BOSS_route(). Reports wrong routings and needless
"which did you mean?" questions. Compare before/after any change to scoring.
Run:  python3 tests/measure_bonds.py        (site on :8123, or set BOSS_URL)
"""
import os
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
rows = []
for f in ['phrases', 'phrases_more', 'phrases_chat', 'phrases_reports']:
    for ln in open(os.path.join(HERE, f + '.tsv'), encoding='utf8'):
        ln = ln.rstrip('\n')
        if ln.strip() and not ln.startswith('#'):
            e, p = ln.split('\t', 1); rows.append((e, p))
JS = """([rows,b,prev,seed])=>{BOSS_bonds(prev,b,seed);return rows.map(([e,p])=>{const r=BOSS_route(p);
 const ex=e.split('|').map(x=>x.trim());const got=r.outcome==='native'?'NATIVE':r.outcome==='help'?'HELP':r.node;
 return {o:r.outcome,ok:r.outcome!=='conflict'&&ex.includes(got)}})}"""
PREV = ['CORTEX', 'CHRONOS', 'MEMORY', 'MEDIA', 'CORE', 'SOMA', 'COMMS']
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
    pg = b.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script("try{localStorage.setItem('BOSS_BOOT','off')}catch(e){}")
    pg.goto(os.environ.get('BOSS_URL', 'http://localhost:8123/core/index.html')); pg.wait_for_timeout(2500)
    print(len(rows), 'phrases')
    for bond in (0, 0.2, 0.4):
        wrong = asks = t = 0
        for prev in PREV:
            for seed in (0, 1, 2):
                for r in pg.evaluate(JS, [rows, bond, prev, seed]):
                    t += 1; asks += r['o'] == 'conflict'; wrong += (r['o'] != 'conflict' and not r['ok'])
        print(f'bonds {bond}: wrong {wrong}/{t} | needless "which did you mean?" {asks}/{t}')
    pg.evaluate("BOSS_bonds('NONE',0,0)"); b.close(); print('ERR', errs)
