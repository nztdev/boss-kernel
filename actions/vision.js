/**
 * B.O.S.S. Vision — actions/vision.js
 * =====================================
 * github.com/nztdev/boss-kernel
 *
 * "Look at this": an image (camera or file) → a vision-capable engine →
 * describe / read text (OCR) / translate text / answer a question.
 * Owned by CORTEX (it is reasoning over an image).
 *
 * PRIVACY
 *   • The image is downscaled and re-encoded in the browser before sending.
 *     Re-encoding through a canvas strips EXIF data — including GPS
 *     location — so only pixels leave the device.
 *   • It is sent to Gemini (the only vision-capable engine configured today)
 *     and nowhere else. Nothing is stored.
 *
 * Needs a Gemini key (cortex pill → Engine Keys). Groq's current model is
 * text-only.
 */

const MAX_DIM = 1280;      // longest side after downscale
const JPEG_Q  = 0.82;

/** File → { base64, mime, dataUrl, width, height, bytes } (EXIF stripped). */
export async function prepareImage(file) {
  if (!file || !file.type.startsWith('image/')) throw new Error('That is not an image file');

  const bitmap = await _decode(file);
  const scale  = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width  * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);      // flatten transparency
  ctx.drawImage(bitmap, 0, 0, w, h);
  if (bitmap.close) bitmap.close();

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_Q);
  const base64  = dataUrl.split(',')[1];
  return { base64, mime: 'image/jpeg', dataUrl, width: w, height: h,
           bytes: Math.round(base64.length * 0.75) };
}

async function _decode(file) {
  // createImageBitmap applies EXIF orientation where supported
  if (window.createImageBitmap) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (_) { /* fall back below */ }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload  = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image')); };
    img.src = url;
  });
}

// ── Intent recognition (shared by CORTEX and the kernel hand-offs) ────────────
// Words like "photo"/"image" belong to MEDIA's viewer vocabulary, so routing
// alone can't tell "show photo" (view) from "describe this photo" (look).
// This recogniser is deliberately narrow: camera / read / describe / identify
// verbs aimed at an image, never plain "show/view/play".
const VISION_RX = new RegExp([
  String.raw`\btake (a |an )?(photo|picture|pic|snap|snapshot)\b`,
  String.raw`\blook at (this|that|my)( (photo|image|picture|pic|screenshot|sign|menu|scene|label))?\s*$`,
  String.raw`\bdescribe (this|that|the|my)? ?(photo|image|picture|pic|screenshot|sign|menu|scene|label)\b`,
  String.raw`\bdescribe (this|that)\s*$`,
  String.raw`\b(read|extract|scan)\b.*\b(text|writing)\b.*\b(image|photo|picture|screenshot|sign|menu|document|page)\b`,
  String.raw`\bocr\b`,
  String.raw`\bscan (this|that|the|my) (document|page|receipt|sign|menu|paper|label|text|image|photo|picture)\b`,
  String.raw`\btranslate (this|that|the|my) (photo|image|picture|sign|menu|screenshot|label)\b`,
  String.raw`\bwhat('s| is| are) (in|on) (this|that|the|my) (photo|image|picture|pic|screenshot)\b`,
  String.raw`\b(identify|recognise|recognize) (this|that)( (photo|image|picture|plant|bird|animal|object|sign|logo))?\s*$`,
  String.raw`^(?:open|start|launch|use) (?:the |my )?camera\s*$`,
  String.raw`^what(?:'s| is) (?:this|that)\s*\??$`,
].join('|'), 'i');

export function isVisionIntent(intent) { return VISION_RX.test(String(intent)); }

/** Which Look mode a spoken/typed intent implies. */
export function visionMode(intent) {
  const s = String(intent).toLowerCase();
  if (/\btranslate\b/.test(s)) return 'translate';
  if (/\b(ocr|read|extract|scan)\b/.test(s)) return 'ocr';
  if (/\b(what('s| is| are)|identify|recogni[sz]e)\b/.test(s)) return 'ask';
  return 'describe';
}

export const VISION_MODES = {
  describe:  { label: '👁 Describe',  prompt: () => 'Describe this image clearly and concisely: what it shows, notable details, and any text visible.' },
  ocr:       { label: '🔤 Read text', prompt: () => 'Extract all legible text from this image exactly as written, preserving line breaks. Output only the text. If there is no text, say "No text found."' },
  translate: { label: '🌐 Translate', prompt: ({ lang }) => `Read any text in this image and translate it into ${lang}. Output the translation only; if it is not already in another language, say so briefly.` },
  ask:       { label: '❓ Ask',       prompt: ({ question }) => `${question}\n\nAnswer based only on what is visible in the image. Be concise.` },
};

/**
 * Run a vision request. `callVision` is engine.callVision (injected so this
 * module stays free of engine imports).
 * Returns { text, model } or throws Error with a user-readable message.
 */
export async function runVision({ image, mode, lang = 'English', question = '', pool, callVision }) {
  const def = VISION_MODES[mode];
  if (!def) throw new Error('Unknown vision mode');
  if (mode === 'ask' && !question.trim()) throw new Error('Type a question first');

  const hasGemini = pool && pool.some(n => n.provider === 'gemini' && n.apiKey);
  if (!hasGemini) throw new Error('Vision needs a Gemini key — tap the cortex pill → Engine Keys');

  const res = await callVision(def.prompt({ lang, question }), image.base64, image.mime, pool);
  if (!res || res.error) throw new Error(res && res.error ? res.error : 'No response from the vision engine');
  return res;
}
