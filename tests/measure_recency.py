"""Recency ("warm node") measurement for the current build.
Re-routes every phrase in every corpus with each node artificially warm (BOSS_heat) and reports:
  - phrases that land on a wrong node, and phrases that trigger a needless "which did you mean?"
  - for the open-ended questions (expected CORTEX/CHAT): how many go straight through.
Run:  python3 tests/measure_recency.py          (serves nothing; set BOSS_URL if the site is not on :8123)
Compare numbers before/after any change to scoring (README §XVI-b).
"""
import os, sys
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
rows = []
for f in ['phrases', 'phrases_more', 'phrases_chat', 'phrases_reports']:
    for ln in open(os.path.join(HERE, f + '.tsv'), encoding='utf8'):
        ln = ln.rstrip('\n')
        if ln.strip() and not ln.startswith('#'):
            e, p = ln.split('\t', 1); rows.append((e, p))
NODES = ['CORTEX', 'CHRONOS', 'MEMORY', 'MEDIA', 'CORE', 'SOMA', 'COMMS']
JS = """([rows,h,node])=>rows.map(([e,p])=>{BOSS_heat(node,h);const r=BOSS_route(p);
 const ex=e.split('|').map(x=>x.trim());const got=r.outcome==='native'?'NATIVE':r.outcome==='help'?'HELP':r.node;
 return {e,p,got,o:r.outcome,ok:r.outcome!=='conflict'&&ex.includes(got)}})"""
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
    pg = b.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script("try{localStorage.setItem('BOSS_BOOT','off')}catch(e){}")
    pg.goto(os.environ.get('BOSS_URL', 'http://localhost:8123/core/index.html')); pg.wait_for_timeout(2500)
    print(f"{len(rows)} phrases\n")
    for h in (3, 6):
        wrong = asks = trials = 0; op_d = op_t = 0
        for n in NODES:
            for r in pg.evaluate(JS, [rows, h, n]):
                trials += 1
                if r['o'] == 'conflict': asks += 1
                elif not r['ok']: wrong += 1
                if r['e'].split('|')[0].strip() in ('CORTEX', 'CHAT') and not r['p'].lower().startswith(('hi', 'hello')):
                    op_t += 1; op_d += (r['ok'])
        print(f"warmth {h}: wrong {wrong}/{trials} | needless 'which did you mean?' {asks}/{trials} | CORTEX/CHAT phrases handled directly {op_d}/{op_t}")
    pg.evaluate("BOSS_heat('NONE',0.1)"); b.close()
    print('ERR', errs)
