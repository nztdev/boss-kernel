// B.O.S.S. — Understanding Layer ("thalamus"), genesis version.   v0.15.0 · phase A: SHADOW MODE
// ---------------------------------------------------------------------------------------------------------
// What it is: a small on-device sentence-embedding model (all-MiniLM-L6-v2, int8, Apache-2.0) that compares a
// request with the capability manifest (manifest.json: what BOSS can do, what only the native app can do, what it
// cannot do). It answers one question: "which capability does this request most resemble?"
//
// Phase A (this build): it only WATCHES. Every request is still routed by today's resonant field; the layer
// computes its own proposals in the background and the result is written next to the request in the feedback
// report ("shadow"). Nothing it says reaches the user or changes any action. 0.15.1 will promote it to a
// fallback / abstention tier using thresholds set from that real data.
//
// Properties: off by default (opt-in in Settings — it is a ~35 MB one-time download, cached for offline use);
// lazy (nothing loads until enabled); BOSS works exactly the same without it; no request text ever leaves the
// device; the model runs on the CPU via WebAssembly (no GPU, no network after the first download).
//
// Contract:   understand(request, context) → { proposals: [{ id, kind, node, label, sim }], top, margin, ms }
//             context = { routed?: { node, via } }  (today's routing outcome, for the shadow comparison)
// Locales:    manifest.<locale>.json would be loaded the same way (docs/UNDERSTANDING-LAYER.md §16). English first.

const BASE = new URL('./', import.meta.url);
const KEY = 'BOSS_UNDERSTAND';            // 'on' | 'off'
const MODEL_FILE = 'model/model_int8.onnx';
const CACHE = 'boss-understand-1';          // persistent across app updates (the service worker keeps this one)
const IDB = 'boss-understand', IDB_STORE = 'kv';

const S = { state: 'off', error: null, ort: null, session: null, vocab: null, tok: null, manifest: null,
            refs: null, refVecs: null, stats: { loads: 0 } };
let _loading = null;

// ── settings ──────────────────────────────────────────────────────────────────
function enabled() { try { return localStorage.getItem(KEY) === 'on'; } catch (_) { return false; } }
function setEnabled(on) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (_) {}
  if (on) load().catch(() => {}); else S.state = S.session ? 'ready-paused' : 'off';
}

// ── tiny key/value store (IndexedDB) for the manifest vectors ──────────────────────
function _idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(IDB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(IDB_STORE);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function _get(k) { try { const d = await _idb(); return await new Promise(r => { const q = d.transaction(IDB_STORE).objectStore(IDB_STORE).get(k); q.onsuccess = () => r(q.result); q.onerror = () => r(undefined); }); } catch (_) { return undefined; } }
async function _put(k, v) { try { const d = await _idb(); await new Promise(r => { const t = d.transaction(IDB_STORE, 'readwrite'); t.objectStore(IDB_STORE).put(v, k); t.oncomplete = r; t.onerror = r; }); } catch (_) {} }

// ── WordPiece tokenizer (BERT uncased), driven by the model's own tokenizer.json ───────
function _buildTokenizer(tj) {
  const vocab = tj.model.vocab, unk = vocab['[UNK]'], cls = vocab['[CLS]'], sep = vocab['[SEP]'];
  const maxChars = tj.model.max_input_chars_per_word || 100;
  const strip = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const isPunct = c => /[!-/:-@[-`{-~]/.test(c) || /\p{P}/u.test(c);
  const isCJK = c => { const x = c.codePointAt(0); return (x >= 0x4e00 && x <= 0x9fff) || (x >= 0x3400 && x <= 0x4dbf) || (x >= 0x20000 && x <= 0x2a6df) || (x >= 0xf900 && x <= 0xfaff) || (x >= 0x2f800 && x <= 0x2fa1f); };
  function words(text) {
    let t = strip(String(text).toLowerCase()).replace(/[\u0000�]/g, '').replace(/[\t\n\r]/g, ' ');
    let out = '';
    for (const ch of t) out += isCJK(ch) ? ` ${ch} ` : ch;
    const ws = [];
    for (const w of out.split(/\s+/)) {
      if (!w) continue;
      let cur = '';
      for (const ch of w) { if (isPunct(ch)) { if (cur) ws.push(cur); ws.push(ch); cur = ''; } else cur += ch; }
      if (cur) ws.push(cur);
    }
    return ws;
  }
  function piece(w) {
    if ([...w].length > maxChars) return [unk];
    const chars = [...w], ids = []; let start = 0;
    while (start < chars.length) {
      let end = chars.length, found = null;
      while (start < end) {
        let sub = chars.slice(start, end).join(''); if (start > 0) sub = '##' + sub;
        if (sub in vocab) { found = vocab[sub]; break; } end--;
      }
      if (found === null) return [unk];
      ids.push(found); start = end;
    }
    return ids;
  }
  return { encode(text, max = 128) {
    let ids = []; for (const w of words(text)) ids.push(...piece(w));
    ids = ids.slice(0, max - 2); return [cls, ...ids, sep];
  } };
}

// ── model loading (lazy, cached) ──────────────────────────────────────────────────
async function _fetchCached(rel) {
  const url = new URL(rel, BASE).href;
  try {
    const c = await caches.open(CACHE); const hit = await c.match(url);
    if (hit) { S.stats.fromCache = true; return hit.arrayBuffer(); }
    const res = await fetch(url); if (!res.ok) throw new Error(rel + ' → HTTP ' + res.status);
    await c.put(url, res.clone()); return res.arrayBuffer();
  } catch (e) { if (e && /HTTP/.test(e.message)) throw e; const res = await fetch(url); if (!res.ok) throw new Error(rel + ' → HTTP ' + res.status); return res.arrayBuffer(); }
}

function load() {
  if (_loading) return _loading;
  _loading = (async () => {
    const t0 = performance.now(); S.state = 'loading'; S.error = null;
    try {
      const [modelBuf, tokBuf] = await Promise.all([_fetchCached(MODEL_FILE), _fetchCached('model/tokenizer.json')]);
      S.stats.modelMB = +(modelBuf.byteLength / 1048576).toFixed(1);
      S.tok = _buildTokenizer(JSON.parse(new TextDecoder().decode(tokBuf)));
      const t1 = performance.now();
      // The WebAssembly runtime is loaded from our own folder (works offline once the service worker has it).
      const ort = await import(new URL('model/ort.wasm.min.mjs', BASE).href);
      ort.env.wasm.wasmPaths = new URL('model/', BASE).href; ort.env.wasm.numThreads = 1; ort.env.wasm.proxy = false;
      S.ort = ort;
      S.session = await ort.InferenceSession.create(new Uint8Array(modelBuf), { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
      const t2 = performance.now();
      S.stats.loadMs = Math.round(t2 - t0); S.stats.fetchMs = Math.round(t1 - t0); S.stats.sessionMs = Math.round(t2 - t1);
      await _prepareManifest();
      S.stats.readyMs = Math.round(performance.now() - t0); S.stats.loads++;
      S.state = 'ready';
    } catch (e) { S.state = 'error'; S.error = String(e && e.message || e).slice(0, 200); _loading = null; throw e; }
  })();
  return _loading;
}

async function _embedBatch(texts) {
  const enc = texts.map(t => S.tok.encode(t)), L = Math.max(...enc.map(e => e.length)), B = enc.length;
  const ids = new BigInt64Array(B * L), mask = new BigInt64Array(B * L), types = new BigInt64Array(B * L);
  enc.forEach((e, i) => e.forEach((id, j) => { ids[i * L + j] = BigInt(id); mask[i * L + j] = 1n; }));
  const T = a => new S.ort.Tensor('int64', a, [B, L]);
  const out = await S.session.run({ input_ids: T(ids), attention_mask: T(mask), token_type_ids: T(types) });
  const h = out.last_hidden_state.data, D = 384, vecs = [];
  for (let i = 0; i < B; i++) {
    const v = new Float32Array(D); let n = 0;
    for (let j = 0; j < enc[i].length; j++) { n++; for (let d = 0; d < D; d++) v[d] += h[(i * L + j) * D + d]; }
    let norm = 0; for (let d = 0; d < D; d++) { v[d] /= n; norm += v[d] * v[d] } norm = Math.sqrt(norm) || 1;
    for (let d = 0; d < D; d++) v[d] /= norm; vecs.push(v);
  }
  return vecs;
}

async function _prepareManifest() {
  const m = await (await fetch(new URL('manifest.json', BASE).href, { cache: 'no-cache' })).json();
  S.manifest = m; S.refs = [];
  m.entries.forEach(e => e.examples.forEach(x => S.refs.push({ e, text: x })));
  const sig = m.generated + ':' + S.refs.length + ':' + m.entries.length;
  const cached = await _get('refvecs');
  if (cached && cached.sig === sig && cached.buf && cached.buf.byteLength === S.refs.length * 384 * 4) {
    S.refVecs = new Float32Array(cached.buf); S.stats.refsFromCache = true; return;
  }
  const t = performance.now(), all = new Float32Array(S.refs.length * 384);
  for (let i = 0; i < S.refs.length; i += 16) {
    const vs = await _embedBatch(S.refs.slice(i, i + 16).map(r => r.text));
    vs.forEach((v, k) => all.set(v, (i + k) * 384));
  }
  S.refVecs = all; S.stats.refEmbedMs = Math.round(performance.now() - t);
  await _put('refvecs', { sig, buf: all.buffer });
}

// ── the contract ──────────────────────────────────────────────────────────────────
async function understand(request, context = {}) {
  if (S.state !== 'ready') await load();
  const t0 = performance.now();
  const [q] = await _embedBatch([String(request).slice(0, 300)]);
  const best = new Map();                                    // capability id → best similarity over its examples
  for (let i = 0; i < S.refs.length; i++) {
    let s = 0; const o = i * 384; for (let d = 0; d < 384; d++) s += q[d] * S.refVecs[o + d];
    const e = S.refs[i].e, cur = best.get(e.id);
    if (!cur || s > cur.sim) best.set(e.id, { id: e.id, kind: e.kind, node: e.node, label: e.label, sim: s });
  }
  const proposals = [...best.values()].sort((a, b) => b.sim - a.sim).slice(0, 5).map(p => ({ ...p, sim: +p.sim.toFixed(3) }));
  const ms = Math.round(performance.now() - t0);
  S.stats.queries = (S.stats.queries || 0) + 1; S.stats.lastQueryMs = ms; S.stats.totalQueryMs = (S.stats.totalQueryMs || 0) + ms;
  return { proposals, top: proposals[0] || null, margin: proposals.length > 1 ? +(proposals[0].sim - proposals[1].sim).toFixed(3) : null, ms, routed: context.routed || null };
}

/** Shadow hook for the feedback log: compact, text-free summary of what the layer would have said. */
async function shadow(request, routed) {
  if (!enabled() || S.state !== 'ready') return null;      // never triggers a download by itself
  const r = await understand(request, { routed });
  return { top3: r.proposals.slice(0, 3).map(p => `${p.id}(${p.kind[0]})=${p.sim.toFixed(2)}`), margin: r.margin, ms: r.ms };
}

function stats() {
  const st = { state: S.state, enabled: enabled(), error: S.error, ...S.stats };
  if (st.queries) st.avgQueryMs = Math.round(st.totalQueryMs / st.queries);
  delete st.totalQueryMs;
  try { if (performance.memory) st.heapMB = Math.round(performance.memory.usedJSHeapSize / 1048576); } catch (_) {}
  try { const c = navigator.connection; if (c) st.net = c.effectiveType + (c.saveData ? '+saveData' : ''); } catch (_) {}
  return st;
}
async function clearCache() { try { await caches.delete(CACHE); const d = await _idb(); d.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE).clear(); } catch (_) {} }

export const Understand = { enabled, setEnabled, load, understand, shadow, stats, clearCache, status: () => S.state };
if (typeof window !== 'undefined') window.BOSS_understand = Understand;