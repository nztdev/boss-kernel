/**
 * B.O.S.S. Dialogue — actions/dialogue.js
 * ========================================
 * The conversational layer. It runs BEFORE field routing (like the front-door
 * and native-only checks) and is NOT a node: it holds no warmth, bonds or
 * resonance, so chatting can never bias where the next request is routed.
 *
 * What it does, in this order, for every request:
 *   1. SAFETY      a few unmistakable distress phrases get a fixed, kind reply
 *                  that points to real support (same in every tone, works offline).
 *   2. PENDING     if BOSS just asked "for how long?", the answer fills the slot
 *                  and the request is rewritten into a full phrase.
 *   3. PLEASANTRIES  "thanks, set a timer for 5" / "hey, play music" — the
 *                  pleasantry is peeled off, the request routes normally, and
 *                  BOSS acknowledges it afterwards ("You're welcome").
 *   4. FOLLOW-UPS  "and in Tokyo?", "make it 10", "again", "cancel that",
 *                  "another one" — rewritten using the last thing BOSS did, then
 *                  routed normally (so every normal safeguard still applies).
 *   5. SMALL TALK  greetings, thanks, goodbyes, how-are-you, compliments, a few
 *                  moods, jokes — answered locally in the chosen personality.
 *   6. otherwise   'pass' — field routing carries on exactly as before.
 *
 * Personalities (Settings → Personality): warm · concise · playful · formal · dry.
 * Offline they are hand-written reply banks with slots (name, time of day) and a
 * shuffle-bag so lines don't repeat back to back. When an engine is connected the
 * same tone is sent to it as a style instruction (promptContext()), together with
 * the last few turns, so open conversation sounds the same.
 *
 * Honesty: offline small talk is a finite script. Anything it can't match is NOT
 * faked — it falls through to the normal path, which says plainly that open
 * conversation needs an engine.
 *
 * Privacy: distress/mood messages are recorded in the tester log as "[private]".
 * State is in memory only (a short "last action" and the recent engine turns).
 */

const KEY_TONE = 'BOSS_TONE';
export const TONES = [
  { id: 'warm',    label: 'Warm',    style: 'Be warm, friendly and brief.' },
  { id: 'concise', label: 'Concise', style: 'Be extremely brief and direct.' },
  { id: 'playful', label: 'Playful', style: 'Be light, playful and a little witty, but still brief.' },
  { id: 'formal',  label: 'Formal',  style: 'Be polite, formal and professional.' },
  { id: 'dry',     label: 'Dry',     style: 'Use dry, understated humour; stay brief and kind.' },
];
const FRESH_MS = 10 * 60 * 1000;     // a "last action" stays usable this long
const PENDING_MS = 60 * 1000;        // a "for how long?" stays open this long
const JOKE_MS = 3 * 60 * 1000;

let _cfg = { getName: () => '', hasEngine: () => false, run: () => {} };
let _last = null;                    // { type:'action'|'chat', kind, intent, family, place, at }
let _pending = null;                 // { kind:'timer'|'alarm', at }
let _history = [];                   // recent engine turns [{u, b}]
const _bags = new Map();

// ── tone ─────────────────────────────────────────────────────────────────────
export function getTone() { try { const t = localStorage.getItem(KEY_TONE); return TONES.some(x => x.id === t) ? t : 'warm'; } catch (_) { return 'warm'; } }
export function setTone(id) { if (TONES.some(x => x.id === id)) { try { localStorage.setItem(KEY_TONE, id); } catch (_) {} } }

// ── reply banks: [warm, concise, playful, formal, dry] ───────────────────────
// {n} → ", Name" (only sometimes, and only if a name is set)   {tod} → morning/afternoon/evening
const IDX = { warm: 0, concise: 1, playful: 2, formal: 3, dry: 4 };
const B = {
  greet: [
    ['Hey{n}! What can I do for you?', 'Hi{n} — good to see you. What do you need?', 'Hello{n}! I\'m here. What\'s up?'],
    ['Hi{n}.', 'Hello. Ready.', 'Hey. What\'s next?'],
    ['Well, hello{n}! The field is warm and the nodes are caffeinated. What\'s the plan?', 'Hey{n}! Ready when you are.', 'Hiya{n}! Hit me with a request.'],
    ['Good day{n}. How may I assist?', 'Hello{n}. How can I help you?', 'Greetings{n}. What would you like me to do?'],
    ['Hello{n}. Still here.', 'Hi{n}. I was just standing by. Riveting work.', 'Hey{n}. Go ahead.'],
  ],
  greet_tod: [
    ['Good {tod}{n}! What can I do for you?', 'Good {tod}{n}! Want the weather, or a look at your notes?'],
    ['Good {tod}{n}.', 'Good {tod}. What\'s first?'],
    ['Good {tod}{n}! Let\'s make it a productive one.', 'A fine {tod} to you{n}! What are we up to?'],
    ['Good {tod}{n}. How may I help?', 'Good {tod}{n}. What would you like to start with?'],
    ['Good {tod}{n}. I\'ll hold my enthusiasm, but I\'m ready.', 'Good {tod}{n}. Carry on.'],
  ],
  howareyou: [
    ['Doing well, thanks for asking{n}! How about you?', 'Good, thanks{n}. What\'s on your mind?', 'All systems cozy and running. How are you doing?'],
    ['Good. You?', 'Running fine. You?'],
    ['Nodes humming, field calm — can\'t complain! You?', 'Fantastic, if slightly electric. And you?'],
    ['I\'m functioning well, thank you{n}. How are you?', 'Quite well, thank you. And yourself?'],
    ['Functioning. For me, that\'s a good day. You?', 'Fine. Nothing\'s on fire. You?'],
  ],
  thanks: [
    ['You\'re welcome{n}!', 'Anytime{n} 😊', 'Happy to help!', 'My pleasure!'],
    ['Sure.', 'Anytime.', 'Welcome.'],
    ['Any time{n}!', 'Always a pleasure!', 'You got it!'],
    ['You\'re most welcome{n}.', 'It\'s my pleasure.', 'Glad to be of assistance.'],
    ['Don\'t mention it. Really.', 'It\'s what I do.', 'Noted. You\'re welcome.'],
  ],
  bye: [
    ['Bye{n}! Take care 👋', 'See you soon{n}!', 'Talk later — take care!'],
    ['Bye.', 'See you.', 'Later.'],
    ['Catch you later{n}! I\'ll keep the field warm.', 'Until next pulse{n}!'],
    ['Goodbye{n}. Have a pleasant day.', 'Farewell{n}. I\'m here whenever you need me.'],
    ['Goodbye{n}. I\'ll be right here. Not like I can leave.', 'See you. Try not to miss me.'],
  ],
  bye_night: [
    ['Good night{n}! Sleep well 🌙', 'Sweet dreams{n}!', 'Night night — rest up.'],
    ['Night.', 'Good night.'],
    ['Sleep tight{n}! I\'ll watch the field.', 'Nighty night! Dream big{n}.'],
    ['Good night{n}. Rest well.', 'Good night. Until tomorrow.'],
    ['Good night{n}. I\'ll be up. Obviously.', 'Night. I\'ll keep the lights on.'],
  ],
  compliment: [
    ['Thank you{n}, that\'s kind!', 'Aw, thanks — that made my day.', 'Thanks! Glad I could help.'],
    ['Thanks.', 'Glad to help.'],
    ['Stop it, you\'ll make my nodes blush!', 'I know, right? (Thank you!)'],
    ['Thank you{n}, I appreciate that.', 'That\'s kind of you to say.'],
    ['Obviously. But thanks.', 'I\'ll add that to my very short list of compliments.'],
  ],
  frustrated: [
    ['Sorry about that{n}. Try rephrasing — or tap ✋ Not what I meant above the input so the team can fix it.', 'I\'m sorry I missed it. Tell me again in other words, or tap ✋ Not what I meant.'],
    ['Sorry. Rephrase, or tap ✋ Not what I meant.'],
    ['Oops — my bad{n}. Rephrase it for me, or tap ✋ Not what I meant and the team will sort it out.'],
    ['My apologies{n}. Please rephrase, or tap ✋ Not what I meant to report it.'],
    ['Fair. I missed. Rephrase it, or tap ✋ Not what I meant.'],
  ],
  ack: [
    ['👍', 'Great!', 'Sounds good.'],
    ['👍', 'Ok.'],
    ['Smooth.', 'Cool cool cool.', '👌'],
    ['Understood.', 'Very well.'],
    ['Riveting.', 'Okay.', 'Good talk.'],
  ],
  yesno: [
    ['Okay! What would you like to do?'],
    ['Ok. What next?'],
    ['Right-o. What\'s next?'],
    ['Understood. How may I help?'],
    ['Okay. Now what?'],
  ],
  sorry: [
    ['No worries{n}!', 'All good.'],
    ['Fine.', 'No problem.'],
    ['Water under the bridge!', 'No harm done!'],
    ['No need to apologise.', 'That\'s quite alright.'],
    ['Forgiven. Barely.', 'It\'s fine.'],
  ],
  nevermind: [
    ['Okay, dropped it.', 'No problem — forgotten.'],
    ['Dropped.', 'Ok.'],
    ['Consider it forgotten!', 'Poof — gone.'],
    ['Very well. Disregarded.', 'Understood. Disregarded.'],
    ['Already forgotten.', 'Fine. Dropped.'],
  ],
  bored: [
    ['Let\'s fix that{n}! I can play some music, tell you a joke, or show you what I can do.'],
    ['Options: music, a joke, or a tour of what I do.'],
    ['Bored? Dangerous territory. Music, a joke, or a tour of my talents?'],
    ['I can offer some music, a joke, or an overview of my abilities. Which would you prefer?'],
    ['Tragic. I can offer music, a joke, or a tour of my modest talents.'],
  ],
  tired: [
    ['Sounds like you could use a break{n}. Want something calming on, or a nap timer?'],
    ['Rest, then. Music or a nap timer?'],
    ['Time to recharge{n}! Calm music, or a nap timer?'],
    ['You may need some rest{n}. Would calm music or a timer help?'],
    ['Sleep is available, I hear. Music or a nap timer?'],
  ],
  low: [
    ['I\'m sorry it\'s been rough{n}. I\'m not a substitute for someone who can really listen, but I\'m here. Want something calming on, or a short timer for a breather? If it feels like more than a rough patch, talking to someone you trust can help.'],
    ['That sounds hard. Want something calming, or a short break timer? Talking to someone you trust can help too.'],
    ['I\'m sorry you\'re having a hard time{n}. Want something calming on, or a short breather timer? Talking to someone you trust can help.'],
    ['I\'m sorry to hear that{n}. Would calm music or a short break timer help? Speaking with someone you trust may also help.'],
    ['I\'m sorry — that sounds heavy{n}. Calm music or a short break timer? And it\'s worth talking to someone you trust.'],
  ],
  letschat: [
    ['Sure{n}! I\'m happiest getting things done — timers, notes, music, weather, calls — but I\'m glad to chat. What\'s on your mind?'],
    ['Sure. What\'s up?'],
    ['Pull up a chair{n}! I\'m best at getting things done, but I do chat. What\'s on your mind?'],
    ['Certainly{n}. I\'m best at tasks, but I\'m glad to talk. What would you like to discuss?'],
    ['Alright. I\'m better at tasks than small talk, but go on.'],
  ],
  goodnews: [
    ['That\'s wonderful{n}! Congratulations — I\'m really glad for you. Want some music to celebrate?'],
    ['Great news. Congratulations.'],
    ['Yes! Cue the confetti{n}! Want a celebration soundtrack?'],
    ['Congratulations{n}. That is excellent news. Shall I play some music?'],
    ['Well, that\'s nice. Congratulations. Music?'],
  ],
  goodday: [
    ['I\'m glad to hear that{n}! Days like that are worth savouring.', 'That\'s lovely to hear{n}. Hold on to that feeling!'],
    ['Good to hear.', 'Glad to hear it.'],
    ['Love that for you{n}! The field is pleased.', 'Excellent! Bank that one for a rainy day.'],
    ['I\'m pleased to hear it{n}.', 'That is good to hear.'],
    ['Good. Noted for the record.', 'Nice. Don\'t let it go to your head.'],
  ],
  badnews: [
    ['I\'m so sorry{n}. That\'s a lot to take in. I\'m not a substitute for someone who can really listen, but I\'m here — want something calming on, or a short breather timer? Talking to someone you trust can help.'],
    ['I\'m so sorry. Want something calming, or a short breather timer? Talking to someone you trust can help.'],
    ['Oh no — I\'m really sorry{n}. Calm music, or a short breather timer? And please lean on someone you trust.'],
    ['I am very sorry to hear that{n}. Would calm music or a short break timer help? Speaking with someone you trust may also help.'],
    ['I\'m sorry. That\'s genuinely hard. Calm music or a breather timer? And do talk to someone you trust.'],
  ],
  hope: [
    ['Me too{n}. Fingers crossed — and I\'m here if you want a hand with anything.', 'I hope so too. One step at a time.'],
    ['Me too.', 'Fingers crossed.'],
    ['Fingers, toes and nodes all crossed{n}!', 'Here\'s hoping! I\'ll keep the field warm.'],
    ['I share that hope{n}.', 'Let us hope so.'],
    ['Optimism. Bold. I\'ll allow it.', 'Fingers crossed. Metaphorically.'],
  ],
  opinion: [
    ['That\'s a fun one{n}. Open-ended chat needs an AI engine, and none is connected (Settings → Engine keys). Offline I\'m best at timers, notes, music, weather and calls.'],
    ['Needs an AI engine (Settings → Engine keys). Offline I do tasks.'],
    ['Ooh, big questions! My deep-thinking brain is an optional extra and it isn\'t plugged in (Settings → Engine keys). Tasks, though? Hit me.'],
    ['Open-ended discussion requires an AI engine, which is not configured. You may add one under Settings → Engine keys. I remain at your service for tasks.'],
    ['Deep thoughts need an engine, and mine isn\'t plugged in. Settings → Engine keys. Meanwhile: timers, notes, music.'],
  ],
  cant_msgs: [
    ['I can\'t see your messages or email from here — BOSS runs in the browser, and those live in your phone\'s own apps. I can start a text or an email for you, though.'],
    ['Can\'t read messages or email from the browser. I can start a text or email.'],
    ['Peeking in your inbox is above my pay grade — the browser keeps me out. I can start a text or an email though!'],
    ['I am unable to access your messages or email from the browser. I can, however, start a text or an email for you.'],
    ['Your inbox is off-limits to a browser app. Starting a text or email, I can do.'],
  ],
  cant_cal: [
    ['I can\'t see your calendar from here — it lives in your phone\'s own app. I can set timers, alarms and reminders for you while BOSS is open, though.'],
    ['Can\'t read your calendar from the browser. Timers, alarms and reminders I can do.'],
    ['Your calendar is behind a locked door I don\'t have the key to! Timers, alarms and reminders, though — those I can do.'],
    ['I am unable to access your calendar from the browser. I can set timers, alarms and reminders while BOSS is open.'],
    ['Your calendar is out of my reach. Timers and alarms are not.'],
  ],
  cant_calls: [
    ['I can\'t see your call history or voicemail from here — that stays in your phone\'s own apps. I can start a call for you, though.'],
    ['Can\'t see call history or voicemail from the browser. I can start a call.'],
    ['Call history is beyond my reach in the browser! I can start a call though.'],
    ['I am unable to access your call history or voicemail from the browser. I can start a call for you.'],
    ['Call history: not my department, not in a browser. Placing a call: yes.'],
  ],
  joke_intro: [['Here\'s one:'], [''], ['Brace yourself:'], ['If I may:'], ['Fine. You asked for it:']],
  ask_timer: [
    ['Sure — for how long?'], ['How long?'], ['Timer it is! How long are we timing?'], ['Certainly. For what duration?'], ['For how long?'],
  ],
  ask_alarm: [
    ['Sure — what time?'], ['What time?'], ['Alarm incoming! What time?'], ['Certainly. For what time?'], ['What time?'],
  ],
};
const ENGINE_NOTE = ' (Open-ended chat needs an AI engine — Settings → Engine keys.)';
const JOKES = [
  'Why do programmers prefer dark mode? Because light attracts bugs.',
  'Why did the scarecrow win an award? He was outstanding in his field.',
  'I\'d tell you a UDP joke, but you might not get it.',
  'What do you call a fake noodle? An impasta.',
  'Why don\'t skeletons fight each other? They don\'t have the guts.',
  'There are 10 kinds of people: those who understand binary and those who don\'t.',
  'I\'m reading a book about anti-gravity. It\'s impossible to put down.',
  'What\'s a computer\'s favourite snack? Microchips.',
  'I would tell you a construction joke, but I\'m still working on it.',
  'Why was the math book sad? It had too many problems.',
  'Why did the developer go broke? He used up all his cache.',
  'What do you call a sleeping bull? A bulldozer.',
];
const CRISIS_TEXT = 'I\'m really sorry you\'re feeling this way. You deserve support from a real person right now. ' +
  'If you might act on these thoughts or you\'re in danger, please call your local emergency number. ' +
  'In the US you can call or text 988; elsewhere, findahelpline.com lists crisis lines by country. ' +
  'If you can, tell someone you trust how you\'re feeling.';

const CHIPS = {
  morning: [['What\'s the weather', 'what\'s the weather'], ['Show my notes', 'show my notes']],
  bored: [['Play music', 'play music'], ['Tell me a joke', 'tell me a joke'], ['What can you do?', 'what can you do']],
  tired: [['Nap timer · 20 min', 'set a timer for 20 minutes'], ['Play music', 'play music']],
  low: [['Calm music', 'play music'], ['Break · 10 min', 'set a timer for 10 minutes']],
  timer: [['1 min', 'set a timer for 1 minute'], ['5 min', 'set a timer for 5 minutes'], ['10 min', 'set a timer for 10 minutes'], ['30 min', 'set a timer for 30 minutes']],
  joke: [['Another one', 'another one']],
  celebrate: [['Play music', 'play music']],
  opinion: [['What can you do?', 'what can you do'], ['Tell me a joke', 'tell me a joke']],
};
const chips = k => (CHIPS[k] || []).map(([label, phrase]) => ({ label, phrase }));

// ── helpers ──────────────────────────────────────────────────────────────────
function _firstName() { const n = String((_cfg.getName && _cfg.getName()) || '').trim(); return n ? n.split(/\s+/)[0] : ''; }
function _tod(d = new Date()) { const h = d.getHours(); return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'; }
function _pick(key, tone, dry) {
  const bank = (B[key] || [])[IDX[tone]] || (B[key] || [])[0] || [''];
  const id = key + '|' + tone;
  let bag = _bags.get(id);
  if (dry) return bank[0];
  if (!bag || !bag.length) { bag = bank.slice().sort(() => Math.random() - 0.5); if (_bags.has(id) && bag[0] === _bags.get(id).last && bag.length > 1) bag.push(bag.shift()); }
  const v = bag.shift(); bag.last = v; _bags.set(id, bag);
  return v;
}
function _fill(t, extra = {}, dry) {
  const name = _firstName();
  const useName = name && (dry || Math.random() < 0.5);
  return t.replace(/\{n\}/g, useName ? ', ' + name : '').replace(/\{tod\}/g, extra.tod || _tod());
}
function _say(key, dry, extra) { return _fill(_pick(key, getTone(), dry), extra, dry); }

/** Lower-case, tidy apostrophes/punctuation/emoji — for classification only. */
export function norm(s) {
  return String(s || '').toLowerCase().replace(/[’‘`]/g, '\'').replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, ' ')
    .replace(/[!?.…,;:]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// ── numbers / durations / clock times ────────────────────────────────────────
const NUMW = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60 };
function _numWord(w) {
  w = w.replace(/-/g, ' ');
  if (/^\d+(?:\.\d+)?$/.test(w)) return parseFloat(w);
  const p = w.split(' ');
  if (p.length === 2 && NUMW[p[0]] >= 20 && NUMW[p[1]] < 10) return NUMW[p[0]] + NUMW[p[1]];
  return NUMW[w] != null ? NUMW[w] : null;
}
const _unit = u => /^s/.test(u) ? 'second' : /^h/.test(u) ? 'hour' : 'minute';
/** "10 minutes" / "half an hour" / "an hour" / "ten" → { n, unit } or null. bare number = minutes. */
export function parseDuration(text) {
  const s = norm(text).replace(/-/g, ' ');
  if (/^half (?:an |a )?hour$/.test(s)) return { n: 30, unit: 'minute' };
  if (/^(?:a )?quarter (?:of )?(?:an |a )?hour$/.test(s)) return { n: 15, unit: 'minute' };
  const m = s.match(/^(?:for |in )?(\d+(?:\.\d+)?|(?:twenty|thirty|forty|fifty) ?(?:one|two|three|four|five|six|seven|eight|nine)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|sixty)(?: ?(seconds?|secs?|minutes?|mins?|hours?|hrs?|h|m|s))?$/);
  if (!m) return null;
  const n = _numWord(m[1].trim());
  if (!n || n <= 0) return null;
  if (!m[2] && (m[1] === 'a' || m[1] === 'an')) return null;
  return { n, unit: m[2] ? _unit(m[2]) : 'minute' };
}
const fmtDur = d => `${d.n} ${d.unit}${d.n === 1 ? '' : 's'}`;
/** "7" / "7:30" / "7am" / "at 7:30 pm" → "07:30" / "7am" style string accepted by CHRONOS, or null. */
export function parseClock(text) {
  const s = norm(text).replace(/\./g, '');
  const m = s.match(/^(?:at |for |around )?(\d{1,2})(?: ?(?:h|:)? ?(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  const h = parseInt(m[1], 10), mi = m[2] ? parseInt(m[2], 10) : 0;
  if (mi > 59) return null;
  if (m[3]) { if (h < 1 || h > 12) return null; return `${h}${mi ? ':' + String(mi).padStart(2, '0') : ''}${m[3]}`; }
  if (h > 23) return null;
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
}

// ── classification ───────────────────────────────────────────────────────────
const RX = {
  crisis: /\b(kill myself|killing myself|end my life|end it all|want to die|wanna die|dont want to (?:live|be here|exist)|don'?t want to (?:live|be here|exist)|suicid\w*|hurt myself|harm myself|self ?harm|no reason to live|better off dead|take my own life)\b/,
  greet: /^(?:hey|hi|hello|hiya|howdy|yo|heya|hola|ciao|greetings|sup|wassup|hey there|hi there|hello there|yo there)(?: (?:there|boss|everyone|again))*$|^(?:hey|hi|hello|yo) (?:b ?o ?s ?s|boss)$/,
  tod: /^(?:good )?(morning|afternoon|evening)(?: boss| there| everyone)?$/,
  night: /^(?:good ?night|night night|nighty night|nite|sweet dreams)(?: boss| everyone)?$/,
  howareyou: /^(?:how are you|how are you doing|how are you today|how are you feeling|how r u|how do you do|hows it going|how's it going|how is it going|how have you been|hows life|how's life|you good|you ok|you okay|are you ok|are you okay|are you good|what's up with you|how's your day|hows your day|how is your day|whats up|what's up)(?: boss| today| there)*$/,
  thanks: /^(?:thanks|thank you|thank u|thx|thnx|ty|ta|cheers|many thanks|much appreciated|i appreciate it|appreciate it|that helps|that was helpful|that's helpful|thats helpful)(?: (?:a lot|so much|very much|a bunch|again|boss|man|mate|buddy|mucho|heaps))*$/,
  bye: /^(?:bye|goodbye|good bye|bye bye|see you|see ya|see you later|see you soon|later|talk later|talk to you later|ttyl|cya|catch you later|i'?m off|im off|gotta go|i have to go|i got to go|i'?ll be back|farewell)(?: boss| everyone| for now| then| now)*$/,
  compliment: /^(?:you(?:'re| are| r) (?:so |really |very )?(?:awesome|great|amazing|smart|the best|brilliant|funny|cool|helpful|nice|wonderful|good|fantastic)|good (?:job|work|boy)|great (?:job|work)|nice (?:job|work|one)|well done|love you|i love you|love it|i love this|that was great|that's great|thats great|that was awesome|you rock|you rule|you(?:'re| are) a star)(?: boss| so much)*$/,
  frustrated: /^(?:you(?:'re| are| r) (?:so |really |very )?(?:useless|stupid|dumb|terrible|bad|rubbish|awful|annoying|broken|wrong)|this is (?:stupid|useless|broken|rubbish|annoying|dumb)|you (?:don'?t|dont|do not) understand|(?:that'?s|thats|that is|it'?s|its) (?:not what i (?:asked|meant|said|wanted)|wrong|not right|incorrect)|no that'?s wrong|that was wrong|wrong|not what i asked|not what i meant|you got it wrong|you misunderstood|that didn'?t work|that did not work|that doesn'?t work|why can'?t you|that sucks)(?: boss)*$/,
  ack: /^(?:ok|okay|k|kk|cool|alright|all right|got it|gotcha|nice|great|sure|fine|sounds good|perfect|awesome|right|i see|understood|noted|good|lol|haha|hahaha|hehe|hmm|hm|wow|oh|ah|ooh|interesting|makes sense|neat|sweet)(?: then| boss| thanks)*$|^ok(?:ay)? cool$|^ok great$/,
  yesno: /^(?:yes|yeah|yep|yup|yea|no|nope|nah|nay|maybe|probably|i guess|not really|of course|sure thing)(?: please| thanks| boss)*$/,
  sorry: /^(?:sorry|my bad|oops|oopsie|apologies|i'?m sorry|im sorry|my mistake|whoops|excuse me)(?: boss| about that)*$/,
  nevermind: /^(?:never ?mind|nvm|forget it|forget that|scratch that|ignore that|ignore me|doesn'?t matter|it doesn'?t matter|no worries|disregard that|cancel that|cancel it|undo that|undo)(?: boss)*$/,
  letschat: /^(?:let'?s (?:chat|talk)|lets (?:chat|talk)|can we (?:chat|talk)|i want to (?:chat|talk)|i wanna (?:chat|talk)|chat with me|talk with me|keep me company|are you there|you there|can you chat|do you want to chat|wanna chat|want to chat|i need someone to talk to|i just want to talk)(?: boss| for a (?:bit|while|minute))*$/,
  bored: /^(?:i'?m|im|i am|i feel|feeling)? ?(?:so |really |very |kinda |a bit )?bored(?: today| right now)?$|^(?:entertain me|i have nothing to do|nothing to do|there'?s nothing to do|i'?m (?:so )?bored out of my mind)$/,
  tired: /^(?:i'?m|im|i am|i feel|feeling)?\s*(?:so |really |very |a bit |kind of |kinda |sooo+ )?(?:tired|sleepy|exhausted|drained|worn out|knackered|beat|shattered)(?: today| right now| tonight)?$|^i need (?:a |some )?(?:nap|sleep|rest|break|breather)$|^i (?:could|need to) (?:use|take) a (?:nap|break)$/,
  low: /\b(?:i(?:'?m| am| feel| feel so|'?m feeling| am feeling)\s+(?:so |really |very |a bit |kind of |kinda )?(?:stressed|stressed out|anxious|overwhelmed|sad|depressed|lonely|down|upset|miserable|burnt out|burned out|low|hopeless|worthless)|feeling (?:so |really |very |a bit )?(?:down|low|sad|anxious|stressed|overwhelmed|lonely)|(?:rough|bad|terrible|awful|horrible|hard|tough|long) day|my day (?:was|has been) (?:rough|bad|terrible|awful|horrible|hard|tough|long)|i had a (?:rough|bad|terrible|awful|horrible|hard|tough) day|nobody (?:likes|cares about|loves) me)\b/,
  joke: /^(?:tell me|give me|got|do you (?:know|have)|know) (?:a |any |another |one more |some )?(?:funny )?jokes?$|^(?:make me laugh|say something funny|tell me something funny|another joke|one more joke|joke|jokes|joke please|tell a joke|crack a joke)$/,
  goodnews: /^(?:i (?:just )?(?:got|received|landed|won|passed|aced|finished|graduated|got into)\b(?: a| an| the| my| into)? ?(?:promotion|raise|new job|job|offer|place|scholarship|degree|licen[cs]e|visa|puppy|kitten|house|flat|apartment|exam|test|interview|award|prize|accepted|engaged|married|promoted)|i(?:'m| am) (?:getting |now )?(?:engaged|married|promoted|pregnant)|(?:great|good|amazing|wonderful|big|exciting|fantastic) news|we won|i won|i passed|i did it|i got the job|i got promoted|i got engaged|i got married)\b/,
  goodday: /^(?:i(?:'m| am) (?:so |really |very |super )?(?:happy|excited|thrilled|proud|pumped|delighted|stoked|over the moon|feeling (?:great|good|happy|amazing|fantastic))|i feel (?:so |really |very )?(?:great|good|happy|amazing|fantastic|wonderful)|i had (?:a|an) (?:really |very |truly )?(?:great|good|wonderful|amazing|fantastic|lovely|nice|brilliant|perfect) (?:day|time|week|weekend|morning|evening)|(?:today|my day|it|the day|this week) (?:was|has been|is) (?:great|good|amazing|wonderful|fantastic|lovely|brilliant))$/,
  badnews: /^(?:i (?:just )?lost my (?:job|home|house)|i(?:'ve| have)? (?:just )?(?:been |got )?(?:fired|laid off|dumped|let go|made redundant|evicted)|i (?:just )?got (?:fired|laid off|dumped|let go|evicted|bad news)|i (?:just )?(?:failed|flunked|bombed) (?:my|the|an?) \w+(?: \w+)?|i didn'?t (?:get|pass) (?:the|that|my) (?:job|promotion|exam|test|interview|visa)|(?:my|our) (?:\w+ ){0,2}(?:died|passed away|is dying|has died|is in hospital|is in the hospital|got sick|is ill|is sick)|someone (?:close to me )?(?:died|passed away)|(?:bad|terrible|sad|awful) news|i broke up with .+|we broke up|my (?:partner|boyfriend|girlfriend|wife|husband) (?:left|dumped|broke up with) me|i(?:'m| am) (?:getting )?divorc\w+|i got divorced)$/,
  hope: /^i (?:really |do |just )?(?:hope|wish) (?:that )?(?:tomorrow|today|things|it|the (?:day|week|weekend)|this|everything|next (?:week|time)|i|we|they|he|she)\b.*$/,
  jokemore: /^(?:another(?: one)?|one more|more|again|another please|one more please|next|next one|tell me another|give me another|haha another|do another)$/,
};
const TASKY = /\b(timer|alarm|remind|reminder|play|set|open|call|text|note|notes|music|video)\b/;
const WEATHERY = /\b(sunny|sun|rain|raining|rainy|snow|snowing|weather|warm|hot|cold|windy|storm|cloudy|forecast)\b/;
const SOCIAL_ORDER = ['greet', 'tod', 'night', 'howareyou', 'thanks', 'bye', 'compliment', 'frustrated', 'sorry', 'nevermind', 'letschat', 'joke', 'bored', 'tired', 'ack', 'yesno'];

/** Which small-talk class (if any) a request is. Pure. */
export function classify(raw) {
  const s = norm(raw);
  if (!s) return null;
  if (RX.crisis.test(s)) return { kind: 'crisis' };
  if (s.split(' ').length <= 12 && RX.low.test(s) && !/\b(timer|alarm|remind|play|set|open|call|text|weather|note)\b/.test(s)) return { kind: 'low' };
  if (s.split(' ').length <= 14 && !TASKY.test(s)) {
    for (const k of ['badnews', 'goodnews', 'goodday', 'hope']) {
      if (RX[k].test(s) && !(k === 'hope' && WEATHERY.test(s))) return { kind: k };
    }
  }
  for (const k of SOCIAL_ORDER) if (RX[k].test(s)) { const m = k === 'tod' ? s.match(RX.tod) : null; return { kind: k, tod: m ? m[1] : null }; }
  return null;
}

// ── pleasantries: "thanks, set a timer" → request + acknowledgement ──────────
const LEAD = /^(?:(?:hey|hi|hello|yo|ok|okay|alright|so|boss|now|well|um|uh|please)(?:\s+(?:boss|there))?\s*[,!.;:-]*\s+|(?:thanks|thank you|thx|cheers)(?:\s+(?:a lot|so much|boss))?\s*(?:[,!.;:-]+\s*|\s+(?:and|now|then)\s+)|good (?:morning|afternoon|evening)(?:\s+boss)?\s*[,!.;:-]+\s*)(?=\S)/i;
const TRAIL = /\s*[,;-]?\s*(?:please|pls|thanks|thx)\s*[.!]*$/i;
function _strip(raw) {
  let s = String(raw || '').trim(), ack = null, greet = null, changed = false;
  for (let i = 0; i < 3; i++) {
    const m = s.match(LEAD);
    if (!m) break;
    if (/^(?:thanks|thank you|thx|cheers)/i.test(m[0])) ack = 'thanks';
    else if (/^good (?:morning|afternoon|evening)/i.test(m[0])) greet = (m[0].match(/morning|afternoon|evening/i) || [])[0].toLowerCase();
    else if (/^(?:hey|hi|hello|yo)/i.test(m[0]) && !greet) greet = 'hi';
    s = s.slice(m[0].length).trim(); changed = true;
  }
  const t = s.match(TRAIL);
  if (t && s.length > t[0].length + 3) { if (/thank|thx/i.test(t[0])) ack = ack || 'thanks'; s = s.slice(0, s.length - t[0].length).trim(); changed = true; }
  return { text: s, ack, greet, changed };
}


// ── things BOSS can't see from a browser (messages, calendar, call history) ──
const _ASK = /^(?:what|what's|whats|do i|did i|have i|am i|is there|are there|any|how many|who|when|which|can you (?:read|check|tell)|could you (?:read|check|tell)|read|tell me)\b/;
const _TOPIC_MSGS = /\b(?:messages?|texts|e-?mails?|emails|inbox|whatsapps?|dms|notifications?|unread)\b/;
const _TOPIC_CAL = /\b(?:calendar|schedule|agenda|appointments?|meetings?|events?)\b/;
const _TOPIC_CALLS = /\b(?:missed calls?|voicemails?|call (?:history|log)|recent calls|who (?:called|rang)(?: me)?)\b/;
const _NOT_READ = /\b(?:send|write|compose|draft|set|play|open|call|make|create|add|new message to)\b/;
/** 'msgs' | 'cal' | 'calls' | null — questions about data that lives in the phone's own apps. */
export function cantRead(raw) {
  const s = norm(raw);
  if (!s || s.split(' ').length > 14 || !_ASK.test(s)) return null;
  if (_TOPIC_CALLS.test(s)) return 'calls';
  if (/\bwho (?:texted|messaged|emailed)\b/.test(s)) return 'msgs';
  if (_NOT_READ.test(s.replace(/^(?:can|could) you (?:read|check|tell)/, ''))) return null;
  if (_TOPIC_MSGS.test(s)) return 'msgs';
  if (_TOPIC_CAL.test(s) && /\b(?:my|i have|do i|am i|i've|i am)\b/.test(s)) return 'cal';
  return null;
}

// ── open-ended opinion / feeling questions (an engine's job) ─────────────────
export function isOpinion(raw) {
  const s = norm(raw);
  return /^(?:what do you (?:think|feel|reckon)(?: about| of)?|what(?:'s| is) your (?:opinion|view|take|favou?rite)|do you (?:like|love|hate|think|believe|enjoy|prefer|dream|get|ever)\b|how do you feel|are you (?:happy|sad|alive|real|conscious|sentient|human|lonely|afraid|scared|a robot|an ai)\b|would you rather|what would you do|which do you prefer|do you have (?:feelings|emotions|a (?:soul|body|family|name))|who is your (?:favou?rite|best)|what do you (?:like|love|hate|want|dream))/.test(s);
}

// ── offline unit conversion ──────────────────────────────────────────────────
// [dimension, factor to the dimension's base unit, id, singular, plural, aliases]
const _UD = [
  ['len', 0.001, 'mm', 'millimetre', 'millimetres', ['mm', 'millimeter', 'millimeters', 'millimetre', 'millimetres']],
  ['len', 0.01, 'cm', 'centimetre', 'centimetres', ['cm', 'centimeter', 'centimeters', 'centimetre', 'centimetres']],
  ['len', 1, 'm', 'metre', 'metres', ['m', 'meter', 'meters', 'metre', 'metres']],
  ['len', 1000, 'km', 'kilometre', 'kilometres', ['km', 'kms', 'kilometer', 'kilometers', 'kilometre', 'kilometres']],
  ['len', 0.0254, 'inch', 'inch', 'inches', ['inch', 'inches']],
  ['len', 0.3048, 'ft', 'foot', 'feet', ['ft', 'foot', 'feet']],
  ['len', 0.9144, 'yd', 'yard', 'yards', ['yd', 'yds', 'yard', 'yards']],
  ['len', 1609.344, 'mi', 'mile', 'miles', ['mi', 'mile', 'miles']],
  ['mass', 0.001, 'mg', 'milligram', 'milligrams', ['mg', 'milligram', 'milligrams']],
  ['mass', 1, 'g', 'gram', 'grams', ['g', 'gram', 'grams']],
  ['mass', 1000, 'kg', 'kilogram', 'kilograms', ['kg', 'kgs', 'kilo', 'kilos', 'kilogram', 'kilograms']],
  ['mass', 28.349523, 'oz', 'ounce', 'ounces', []],
  ['mass', 453.59237, 'lb', 'pound', 'pounds', ['lb', 'lbs', 'pound', 'pounds']],
  ['mass', 6350.29318, 'st', 'stone', 'stone', ['st', 'stone', 'stones']],
  ['vol', 1, 'ml', 'millilitre', 'millilitres', ['ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres']],
  ['vol', 1000, 'l', 'litre', 'litres', ['l', 'liter', 'liters', 'litre', 'litres']],
  ['vol', 4.92892, 'tsp', 'teaspoon', 'teaspoons', ['tsp', 'teaspoon', 'teaspoons']],
  ['vol', 14.78676, 'tbsp', 'tablespoon', 'tablespoons', ['tbsp', 'tablespoon', 'tablespoons']],
  ['vol', 29.57353, 'floz', 'US fluid ounce', 'US fluid ounces', ['floz', 'fl oz', 'fluid ounce', 'fluid ounces']],
  ['vol', 236.58824, 'cup', 'US cup', 'US cups', ['cup', 'cups']],
  ['vol', 473.17647, 'pint', 'US pint', 'US pints', ['pint', 'pints', 'pt']],
  ['vol', 946.35295, 'quart', 'US quart', 'US quarts', ['quart', 'quarts', 'qt']],
  ['vol', 3785.41178, 'gal', 'US gallon', 'US gallons', ['gal', 'gallon', 'gallons']],
  ['time', 1, 'sec', 'second', 'seconds', ['s', 'sec', 'secs', 'second', 'seconds']],
  ['time', 60, 'min', 'minute', 'minutes', ['min', 'mins', 'minute', 'minutes']],
  ['time', 3600, 'hr', 'hour', 'hours', ['h', 'hr', 'hrs', 'hour', 'hours']],
  ['time', 86400, 'day', 'day', 'days', ['day', 'days']],
  ['time', 604800, 'week', 'week', 'weeks', ['week', 'weeks']],
  ['temp', 1, 'c', 'degree Celsius', 'degrees Celsius', ['c', 'celsius', 'centigrade']],
  ['temp', 1, 'f', 'degree Fahrenheit', 'degrees Fahrenheit', ['f', 'fahrenheit']],
  ['temp', 1, 'k', 'kelvin', 'kelvin', ['k', 'kelvin']],
];
const _UMAP = new Map();
for (const d of _UD) for (const a of d[5]) _UMAP.set(a, { dim: d[0], f: d[1], id: d[2], one: d[3], many: d[4] });
const _OZ = new Set(['ounce', 'ounces', 'oz']);
function _unitOf(name) {
  const n = String(name || '').trim().replace(/^(?:an? |one |the |of )/, '').trim();
  return _UMAP.get(n) || null;
}
const _fmtNum = n => { const v = Number(Number(n).toPrecision(4)); return String(v); };
function _ct(v, a, b) {
  if (a.dim === 'temp') {
    const c = a.id === 'c' ? v : a.id === 'f' ? (v - 32) * 5 / 9 : v - 273.15;
    return b.id === 'c' ? c : b.id === 'f' ? c * 9 / 5 + 32 : c + 273.15;
  }
  return v * a.f / b.f;
}
/** "how many ounces in a cup" / "convert 5 km to miles" → "1 US cup = 8 US fluid ounces." or null. */
export function convert(raw) {
  const s = String(raw || '').toLowerCase().replace(/[’‘`]/g, '\'').replace(/°/g, ' ').replace(/\bdegrees?\b/g, ' ')
    .replace(/[?!,;:]+/g, ' ').replace(/\.(?!\d)/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s || s.split(' ').length > 9) return null;
  let m, val, from, to;
  if ((m = s.match(/^(?:how many|how much) (.+?) (?:are |is )?(?:there )?(?:in|per) (?:an? |one |the )?(\d+(?:\.\d+)?)? ?(.+)$/))) {
    val = m[2] ? parseFloat(m[2]) : 1; from = m[3]; to = m[1];
  } else if ((m = s.match(/^(?:convert |what is |what's |whats |how much is |how many is )?(\d+(?:\.\d+)?|an?|one) ?([a-z]+(?: [a-z]+)?) (?:to|in|into|as) ([a-z]+(?: [a-z]+)?)$/))) {
    val = /^\d/.test(m[1]) ? parseFloat(m[1]) : 1; from = m[2]; to = m[3];
  } else return null;
  let a = _unitOf(from), b = _unitOf(to);
  // "ounce" means fluid ounces next to a volume unit and weight ounces next to a weight unit
  const OZ = { dim: 'mass', f: 28.349523, id: 'oz', one: 'ounce', many: 'ounces' };
  const isOz = n => _OZ.has(String(n).trim().replace(/^(?:an? |one |the )/, ''));
  if (isOz(from) && b) a = b.dim === 'vol' ? _UMAP.get('floz') : OZ;
  if (isOz(to) && a) b = a.dim === 'vol' ? _UMAP.get('floz') : OZ;
  if (!a || !b || a.dim !== b.dim || !isFinite(val)) return null;
  if (a.dim === 'time' && a.id === b.id) return null;
  const r = _ct(val, a, b);
  const lab = (u, n) => (n === 1 ? u.one : u.many);
  let out = `${_fmtNum(val)} ${lab(a, val)} = ${_fmtNum(r)} ${lab(b, Number(_fmtNum(r)))}.`;
  return out;
}

const _MEDIA_LINK = /^https?:\/\/(?:[\w-]+\.)*(?:youtube\.com|youtu\.be|vimeo\.com|soundcloud\.com|twitch\.tv|dailymotion\.com)\/\S*$|^https?:\/\/\S+\.(?:mp4|webm|mp3|m4a|ogg|wav|mov)(?:\?\S*)?$/i;

/** Does the dialogue layer answer this itself (so a stripped "thanks, …" should be answered, not routed)? */
function _owned(t) {
  return !!(classify(t) || cantRead(t) || convert(t) || (isOpinion(t) && !_cfg.hasEngine()));
}

// ── what BOSS last did (for follow-ups) ──────────────────────────────────────
function _family(raw) {
  const s = norm(raw);
  let m = s.match(/\b(?:time|clock)\b(?: is it)? in (.+)$/);
  if (m) return { family: 'clock', place: m[1].trim() };
  if (/\bweather\b/.test(s)) { m = s.match(/\bweather\b(?: like)? in (.+)$/); return { family: 'weather', place: m ? m[1].trim() : null }; }
  if (/\b(?:timer|countdown)\b/.test(s) && !/\bcancel|stop|clear|status|active|list\b/.test(s)) return { family: 'timer' };
  return { family: null };
}
/** Tell the dialogue layer what just ran (call after a request is routed and handled). */
export function noteAction(intent, node, handled) {
  if (!node || handled === false) return;
  const f = _family(intent);
  _last = { type: 'action', kind: 'action', intent, family: f.family, place: f.place || null, node, at: Date.now() };
}
const _fresh = (ms = FRESH_MS) => _last && Date.now() - _last.at < ms;

// ── main entry ───────────────────────────────────────────────────────────────
/**
 * process(raw, { dry }) → one of
 *   { kind:'reply',  text, chips, tag, private }   answered locally
 *   { kind:'ask',    text, chips, tag }            BOSS asks for a missing detail
 *   { kind:'rewrite', intent }                     a follow-up resolved to a full request
 *   { kind:'strip',  intent, pre, after }          pleasantry peeled off; route `intent` normally
 *   { kind:'pass' }                                not a dialogue matter
 * dry:true is the side-effect-free preview (no state read or written).
 */
export function process(raw, { dry = false } = {}) {
  const orig = String(raw || '').trim();
  const s = norm(orig);
  if (!s) return { kind: 'pass' };

  // 1) safety
  if (RX.crisis.test(s)) { _remember(dry, 'crisis'); return { kind: 'reply', text: CRISIS_TEXT, chips: [], tag: 'crisis', private: true }; }

  // 2) a question BOSS just asked
  if (!dry && _pending && Date.now() - _pending.at < PENDING_MS) {
    const p = _pending; _pending = null;
    if (RX.nevermind.test(s) || /^(?:no|nope|cancel|stop|nothing)$/.test(s)) { return _reply('nevermind', dry, 'nevermind'); }
    if (p.kind === 'timer') { const d = parseDuration(orig); if (d) return { kind: 'rewrite', intent: `set a timer for ${fmtDur(d)}` }; }
    if (p.kind === 'alarm') { const c = parseClock(orig); if (c) return { kind: 'rewrite', intent: `set an alarm at ${c}` }; }
    // not an answer → treat as a fresh request
  } else if (!dry) _pending = null;

  // 3) pleasantries glued to a request
  const st = _strip(orig);
  let body = orig;
  if (st.changed && st.text) {
    if (_owned(st.text)) body = st.text;
    else if (norm(st.text).split(' ').length >= 2) {
      const out = { kind: 'strip', intent: st.text, pre: null, after: null };
      if (st.ack && !dry) out.after = _say('thanks', dry);
      return out;
    }
  }
  const sb = norm(body);

  // 4) follow-ups that lean on the last thing BOSS did
  if (!dry && _fresh()) {
    const L = _last;
    if (L.kind === 'joke' && RX.jokemore.test(sb) && Date.now() - L.at < JOKE_MS) return _joke(dry);
    if (L.type === 'action') {
      let m = sb.match(/^(?:and |what about |how about |and what about |same for |and for )(?:in |for )?([a-z][a-z .'-]{1,30})$/);
      if (m && L.family && ['clock', 'weather'].includes(L.family) && m[1].split(' ').length <= 3 &&
          !/\b(music|timer|alarm|notes?|weather|time|the|tomorrow|today|tonight|later|now|then|this|that|it)\b/.test(m[1])) {
        const place = m[1].trim();
        return { kind: 'rewrite', intent: L.family === 'clock' ? `what time is it in ${place}` : `weather in ${place}` };
      }
      m = sb.match(/^(?:make it|change it to|set it to|no make it|actually make it|actually|make that|change that to|make the timer|no)\s+(.+)$/);
      if (m && L.family === 'timer') { const d = parseDuration(m[1].replace(/^to /, '')); if (d) return { kind: 'rewrite', intent: `set a timer for ${fmtDur(d)}` }; }
      if (/^(?:again|do (?:it|that) again|one more time|repeat(?: that| it)?|same again|do the same|do the same again)$/.test(sb)) return { kind: 'rewrite', intent: L.intent };
      if (/^(?:cancel (?:it|that)|undo(?: that)?|stop it|stop that|never ?mind(?: that)?|scratch that|forget (?:it|that))$/.test(sb) && L.family === 'timer') return { kind: 'rewrite', intent: 'cancel timer' };
    }
  }

  // 5) small talk
  const c = classify(body);
  if (c) {
    if (c.kind === 'tod') return _reply('greet_tod', dry, 'greet', { tod: c.tod }, c.tod === 'morning' ? chips('morning') : []);
    if (c.kind === 'greet') return _reply('greet', dry, 'greet', {}, []);
    if (c.kind === 'night') return _reply('bye_night', dry, 'bye');
    if (c.kind === 'joke') return _joke(dry);
    if (c.kind === 'letschat') { const r = _reply('letschat', dry, 'letschat'); if (!_cfg.hasEngine()) r.text += ENGINE_NOTE; return r; }
    if (c.kind === 'bored') return _reply('bored', dry, 'bored', {}, chips('bored'));
    if (c.kind === 'tired') return _reply('tired', dry, 'tired', {}, chips('tired'));
    if (c.kind === 'low') { const r = _reply('low', dry, 'low', {}, chips('low')); r.private = true; return r; }
    if (c.kind === 'nevermind') { if (!dry) _pending = null; return _reply('nevermind', dry, 'nevermind'); }
    if (c.kind === 'badnews') { const r = _reply('badnews', dry, 'badnews', {}, chips('low')); r.private = true; return r; }
    if (c.kind === 'goodnews') return _reply('goodnews', dry, 'goodnews', {}, chips('celebrate'));
    if (c.kind === 'goodday') return _reply('goodday', dry, 'goodday');
    if (c.kind === 'hope') return _reply('hope', dry, 'hope');
    return _reply(c.kind, dry, c.kind);
  }

  // 5b) things BOSS can't see from a browser, offline conversions, open-ended opinions with no engine, a bare media link
  {
    const cr = cantRead(body);
    if (cr) { const r = _reply('cant_' + cr, dry, 'cant-' + cr); r.gap = true; return r; }
    const cv = convert(body);
    if (cv) { _remember(dry, 'convert'); return { kind: 'reply', text: cv, chips: [], tag: 'convert' }; }
    if (isOpinion(body) && !_cfg.hasEngine()) { const r = _reply('opinion', dry, 'opinion', {}, chips('opinion')); r.gap = true; return r; }
    if (_MEDIA_LINK.test(orig)) {
      return { kind: 'ask', text: 'That looks like a media link — want me to play it?', chips: [{ label: '▶ Play it', phrase: 'play ' + orig }], tag: 'ask-link' };
    }
  }

  // 6) a request that is missing its one detail
  if (/^(?:set|start|create|make|add)(?: me)?(?: a| an)?(?: new)? (?:timer|countdown)$|^(?:a )?(?:timer|countdown)$/.test(sb)) {
    if (!dry) _pending = { kind: 'timer', at: Date.now() };
    return { kind: 'ask', text: _say('ask_timer', dry), chips: chips('timer'), tag: 'ask-timer' };
  }
  if (/^(?:set|create|make|add)(?: me)?(?: a| an)?(?: new)? alarm$|^(?:an )?alarm$|^wake me up$/.test(sb)) {
    if (!dry) _pending = { kind: 'alarm', at: Date.now() };
    return { kind: 'ask', text: _say('ask_alarm', dry), chips: [], tag: 'ask-alarm' };
  }
  return { kind: 'pass' };
}
/** Side-effect-free preview for the routing test harness. */
export function peek(raw) { return process(raw, { dry: true }); }

function _remember(dry, kind) { if (!dry) _last = { type: 'chat', kind, at: Date.now() }; }
function _reply(key, dry, tag, extra, ch) {
  _remember(dry, tag);
  return { kind: 'reply', text: _say(key, dry, extra), chips: ch || [], tag };
}
function _joke(dry) {
  let bag = _bags.get('jokes');
  if (!bag || !bag.length) bag = JOKES.slice().sort(() => Math.random() - 0.5);
  const j = dry ? JOKES[0] : bag.shift(); if (!dry) _bags.set('jokes', bag);
  _remember(dry, 'joke');
  const intro = _say('joke_intro', dry);
  return { kind: 'reply', text: (intro ? intro + ' ' : '') + j, chips: chips('joke'), tag: 'joke' };
}

// ── engine conversation (CORTEX) ─────────────────────────────────────────────
/** Style + recent turns for the engine's system prompt, so open chat sounds like the chosen tone. */
export function promptContext() {
  const t = TONES.find(x => x.id === getTone()) || TONES[0];
  let s = 'You are BOSS, a personal assistant that helps with timers, notes, music, weather, calls and similar everyday tasks. ' +
          t.style + ' Keep replies to one or two short sentences unless asked for more — they may be read aloud. ' +
          'Do not claim to have feelings or a body. When it helps, suggest something BOSS can do for the user.';
  if (_history.length) s += '\nRecent conversation:\n' + _history.map(h => `User: ${h.u}\nBOSS: ${h.b}`).join('\n');
  return s;
}
export function noteEngine(userText, reply) {
  _history.push({ u: String(userText || '').slice(0, 300), b: String(reply || '').slice(0, 400) });
  if (_history.length > 6) _history.shift();
  _last = { type: 'chat', kind: 'engine', at: Date.now() };
}

// ── suggestion chips (tap = run that phrase) ─────────────────────────────────
let _chipBox = null, _chipTimer = 0;
function _ensureBox() {
  if (_chipBox || typeof document === 'undefined') return _chipBox;
  if (!document.getElementById('dlg-style')) {
    const st = document.createElement('style'); st.id = 'dlg-style';
    st.textContent = '#dlg-chips{display:none;position:relative;z-index:8;pointer-events:auto;flex-wrap:wrap;gap:6px;width:100%;max-width:440px;margin:0 0 6px;justify-content:flex-start}' +
      '#dlg-chips.on{display:flex}' +
      '.dlg-chip{font:12px "Share Tech Mono",monospace;color:var(--glow,#00ffcc);background:rgba(0,20,10,.85);border:1px solid var(--glow,#00ffcc);' +
      'border-radius:14px;padding:6px 12px;cursor:pointer;min-height:30px}.dlg-chip:active{opacity:.6}';
    document.head.appendChild(st);
  }
  const box = document.createElement('div'); box.id = 'dlg-chips';
  const anchor = document.getElementById('wave-strip') || document.getElementById('fb-miss-chip') || document.getElementById('input-bar');
  if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(box, anchor); else document.body.appendChild(box);
  _chipBox = box; return box;
}
export function showChips(list) {
  const box = _ensureBox(); if (!box) return;
  clearTimeout(_chipTimer); box.innerHTML = '';
  if (!list || !list.length) { box.classList.remove('on'); return; }
  list.forEach(c => {
    const b = document.createElement('button'); b.className = 'dlg-chip'; b.textContent = c.label;
    b.onclick = () => { hideChips(); _cfg.run && _cfg.run(c.phrase); };
    box.appendChild(b);
  });
  box.classList.add('on');
  _chipTimer = setTimeout(hideChips, 30000);
}
export function hideChips() { clearTimeout(_chipTimer); if (_chipBox) { _chipBox.classList.remove('on'); _chipBox.innerHTML = ''; } }

export function init(cfg) { _cfg = { ..._cfg, ...(cfg || {}) }; }
export function reset() { _last = null; _pending = null; _history = []; _bags.clear(); }
/** A sample line for the Settings preview (does not touch state). */
export function sample(toneId) { const i = IDX[toneId] ?? 0; return B.greet[i][0].replace(/\{n\}/g, ''); }

export const Dialogue = { TONES, getTone, setTone, process, peek, classify, noteAction, noteEngine, promptContext,
  showChips, hideChips, init, reset, sample, parseDuration, parseClock, norm, isOpinion, cantRead, convert };
if (typeof window !== 'undefined') window.BOSS_DIALOGUE = Dialogue;