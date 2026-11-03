// Builds understand/manifest.json — the capability manifest (docs/UNDERSTANDING-LAYER.md §7).
// One data file listing what BOSS CAN do (kind "supported"), what only the native app can do ("native"),
// and what it deliberately cannot do in the free version ("unsupported"), each with example phrases per locale.
// Run:  node understand/build_manifest.mjs     (re-run whenever Registry presets or onboarding examples change)
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const grab = (file, marker, end, rename) => {
  const s = fs.readFileSync(path.join(root, file), 'utf8'); const a = s.indexOf(marker);
  const b = s.indexOf(end, a) + end.length; return s.slice(a, b).replace(marker, rename);
};
eval(grab('actions/onboarding.js', 'export const CAPABILITIES', '\n];', 'globalThis.CAP'));
eval(grab('registry/registry.js', 'const DEFAULT_PRESETS', '\n];', 'globalThis.P'));

const GROUP_NODE = { 'Time & weather':'CHRONOS', 'Memory':'MEMORY', 'Media':'MEDIA', 'Files':'FILES', 'Phone':'COMMS',
  'Open apps':'CORTEX', 'Look & text tools':'CORTEX', 'Ask anything':'CORTEX', 'Device & settings':'CORE' };

const entries = [];
for (const p of P) {
  if (p.nodes.length > 1) continue;                       // compound presets are sequences of single capabilities
  const ex = [p.label, p.intent, ...(p.tags || []).filter(t => t.length > 3 && t !== 'native')];
  if (p.nativeOnly) {
    (p._triggers || []).forEach(t => ex.push(t));
    entries.push({ id: p.id, kind: 'native', node: p.nodes[0], label: p.label, reason: p._nativeReason, risk: p._risk, examples: [...new Set(ex)] });
  } else {
    entries.push({ id: p.id, kind: 'supported', node: p.nodes[0], label: p.label, examples: [...new Set(ex)] });
  }
}
for (const c of CAP) entries.push({ id: 'group_' + c.name.toLowerCase().replace(/\W+/g, '_'), kind: 'supported', node: GROUP_NODE[c.name] || null, label: c.name, examples: c.ex });

// Things the free, offline-first web version deliberately cannot do (no accounts, no calendar/inbox access, no payments).
const UNSUPPORTED = [
  ['calendar',  'Your calendar',            'I can\'t see your calendar from here — it lives in your phone\'s own app.', ['what is on my calendar today','am I free on Friday afternoon','schedule a meeting with Anna next week','reply based on my calendar availability']],
  ['inbox',     'Your inbox',               'I can\'t read your email or messages.', ['read my latest emails','summarise my inbox','do I have any new messages from my boss']],
  ['booking',   'Bookings & purchases',     'I can\'t book or buy things for you.', ['book me a table for two tonight','order a pizza','buy tickets for the concert','book a flight to Madrid']],
  ['payments',  'Payments & banking',       'I can\'t move money or see your accounts.', ['send 20 euros to Sam','what is my bank balance','pay my electricity bill']],
  ['social',    'Social media',             'I can\'t post to or read your social accounts.', ['post this on instagram','tweet that I am home','check my facebook notifications']],
];
for (const [id, label, reason, ex] of UNSUPPORTED) entries.push({ id: 'x_' + id, kind: 'unsupported', node: null, label, reason, examples: ex });

// Hand-written extra phrasings (understand/examples.en.json): more ways of saying the same thing per capability.
const extra = JSON.parse(fs.readFileSync(path.join(root, 'understand', 'examples.en.json'), 'utf8'));
for (const ne of extra.new || []) entries.push({ ...ne, examples: [ne.label] });
const drop = new Set(extra.drop || []);
for (let i = entries.length - 1; i >= 0; i--) if (drop.has(entries[i].id)) entries.splice(i, 1);   // broad "group" cards duplicated the specific ones and mixed nodes
for (const [id, list] of Object.entries(extra.add || {})) {
  const e = entries.find(x => x.id === id);
  if (!e) { console.warn('examples.en.json: unknown capability', id); continue; }
  e.examples = [...new Set([...e.examples, ...list])];
}

const out = { schema: 'boss-capabilities/1', generated: new Date().toISOString().slice(0, 10), locale: 'en', entries };
fs.writeFileSync(path.join(root, 'understand', 'manifest.json'), JSON.stringify(out, null, 1));
const n = (k) => entries.filter(e => e.kind === k).length;
console.log(`manifest.json: ${entries.length} capabilities (${n('supported')} supported, ${n('native')} native-only, ${n('unsupported')} unsupported), ${entries.reduce((a, e) => a + e.examples.length, 0)} example phrases`);
