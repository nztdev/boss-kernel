"""Which embedding model should the Understanding Layer use?   (run on a machine that can reach Hugging Face)

    pip install sentence-transformers numpy
    python tests/experiments/embeddings/compare_models.py                 # all candidates
    python tests/experiments/embeddings/compare_models.py bge-small gte-small    # a subset
    python tests/experiments/embeddings/compare_models.py local-minilm-int8      # the model BOSS ships today (no download)

What it measures — the same job the layer does: match a request to the capability manifest (understand/manifest.json) and
read off the node. Test requests = tests/experiments/embeddings/fresh_paraphrases.tsv (held out: never used to write the
manifest) + every single-node row of the four routing corpora. For each model:
  top1        share of requests whose best-matching capability belongs to the right node
  sel@50%     accuracy on the 50% of requests the model is MOST sure about (margin between best and runner-up) — this is
              what matters for "act only when confident / otherwise abstain"
  sel@25%     the same on the 25% it is surest about
  ms/query    CPU time for one request
Nothing here changes BOSS. A model is only worth switching to if it clearly beats the baseline on top1 AND sel@50%,
and fits the size budget (int8 file: <= ~100 MB is acceptable for a one-time cached download).
"""
import sys, os, json, time, glob
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))

CANDIDATES = {  # name: (hf id, query prefix, document prefix, ~params)
  'minilm-l6':      ('sentence-transformers/all-MiniLM-L6-v2', '', '', '22M'),
  'minilm-l12':     ('sentence-transformers/all-MiniLM-L12-v2', '', '', '33M'),
  'bge-small':      ('BAAI/bge-small-en-v1.5', '', '', '33M'),
  'gte-small':      ('thenlper/gte-small', '', '', '33M'),
  'e5-small':       ('intfloat/e5-small-v2', 'query: ', 'query: ', '33M'),
  'bge-base':       ('BAAI/bge-base-en-v1.5', '', '', '110M'),
  'mpnet-base':     ('sentence-transformers/all-mpnet-base-v2', '', '', '110M'),
  'e5-multi-small': ('intfloat/multilingual-e5-small', 'query: ', 'query: ', '118M (multilingual)'),
  'para-multi':     ('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2', '', '', '118M (multilingual)'),
}

def load_data():
    man = json.load(open(os.path.join(ROOT, 'understand', 'manifest.json')))
    refs = [(e['node'], x) for e in man['entries'] if e['node'] for x in e['examples']]
    tests = []
    held = os.environ.get('HELDOUT')   # e.g. HELDOUT=fresh2_paraphrases.tsv -> score ONLY that file (the honest held-out number)
    files = [os.path.join(HERE, held)] if held else [os.path.join(HERE, 'fresh_paraphrases.tsv')] + sorted(glob.glob(os.path.join(ROOT, 'tests', 'phrases*.tsv')))
    for fn in files:
        for ln in open(fn, encoding='utf8'):
            ln = ln.rstrip('\n')
            if not ln.strip() or ln.startswith('#') or '\t' not in ln: continue
            exp, ph = ln.split('\t', 1)
            if exp in ('CHAT', 'NATIVE', 'HELP') or '|' in exp: continue
            tests.append((exp.strip(), ph.strip()))
    return refs, tests

class Local:                                   # the int8 MiniLM BOSS ships (validates this script offline)
    def __init__(self):
        import onnxruntime as o; from tokenizers import Tokenizer
        d = os.path.join(ROOT, 'understand', 'model')
        self.tk = Tokenizer.from_file(os.path.join(d, 'tokenizer.json')); self.tk.no_padding(); self.tk.no_truncation()
        self.s = o.InferenceSession(os.path.join(d, 'model_int8.onnx'))
    def encode(self, texts, **_):
        out = []
        for t in texts:
            e = self.tk.encode(t); ids = np.array([e.ids])
            v = self.s.run(None, {'input_ids': ids, 'attention_mask': np.ones_like(ids), 'token_type_ids': np.zeros_like(ids)})[0][0].mean(0)
            out.append(v / np.linalg.norm(v))
        return np.array(out)

def evaluate(name, model, qp, dp, refs, tests):
    R = np.asarray(model.encode([dp + t for _, t in refs], normalize_embeddings=True) if name != 'local-minilm-int8' else model.encode([t for _, t in refs]))
    t0 = time.time()
    Q = np.asarray(model.encode([qp + p for _, p in tests], normalize_embeddings=True) if name != 'local-minilm-int8' else model.encode([p for _, p in tests]))
    ms = (time.time() - t0) / len(tests) * 1000
    nodes = [n for n, _ in refs]; res = []
    for q, (exp, _) in zip(Q, tests):
        sims = R @ q; order = np.argsort(-sims); best = order[0]
        # runner-up = best-scoring reference that belongs to a DIFFERENT node
        other = next((i for i in order if nodes[i] != nodes[best]), best)
        res.append((nodes[best] == exp, float(sims[best] - sims[other])))
    ok = np.array([r[0] for r in res]); mg = np.array([r[1] for r in res]); idx = np.argsort(-mg)
    def sel(frac): k = max(1, int(len(idx) * frac)); return ok[idx[:k]].mean()
    return ok.mean(), sel(.5), sel(.25), ms

if __name__ == '__main__':
    refs, tests = load_data()
    want = sys.argv[1:] or list(CANDIDATES) + ['local-minilm-int8']
    print(f'{len(refs)} reference phrases, {len(tests)} test requests\n')
    print(f'{"model":16} {"params":18} {"top1":>6} {"sel@50%":>8} {"sel@25%":>8} {"ms/query":>9}')
    for name in want:
        try:
            if name == 'local-minilm-int8': m, qp, dp, par = Local(), '', '', '22M int8 (shipped)'
            else:
                from sentence_transformers import SentenceTransformer
                hf, qp, dp, par = CANDIDATES[name]; m = SentenceTransformer(hf)
            a, b, c, ms = evaluate(name, m, qp, dp, refs, tests)
            print(f'{name:16} {par:18} {a:6.1%} {b:8.1%} {c:8.1%} {ms:9.1f}')
        except Exception as e:
            print(f'{name:16} FAILED: {str(e)[:90]}')
