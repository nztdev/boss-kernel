/**
 * B.O.S.S. Clipboard helper — actions/clipboard.js
 * ==================================================
 * Small, shared copy/paste helpers (CORTEX Text Tools, Look, typed
 * "summarise my clipboard"). Everything is best-effort and returns a
 * friendly result instead of throwing.
 *
 * Browser rules worth knowing:
 *   • Writing needs a user gesture on most browsers (button taps are fine).
 *   • Reading text/images prompts for permission (Chrome) or shows a
 *     "Paste" bubble that needs a tap (iOS Safari) — so typed intents may be
 *     refused; the paste *buttons* in the panels are the reliable path.
 */

export const Clipboard = {
  async copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return { ok: true };
      }
    } catch (_) { /* fall through to legacy path */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok ? { ok: true } : { ok: false, error: 'Copy was blocked by the browser' };
    } catch (e) { return { ok: false, error: 'Copy was blocked by the browser' }; }
  },

  async readText() {
    if (!navigator.clipboard || !navigator.clipboard.readText)
      return { ok: false, error: 'This browser cannot read the clipboard from here — paste into the box instead' };
    try {
      const text = await navigator.clipboard.readText();
      return text ? { ok: true, text } : { ok: false, error: 'The clipboard is empty' };
    } catch (_) {
      return { ok: false, error: 'Clipboard access was refused — use the Paste button or paste into the box' };
    }
  },

  /** Returns { ok, file } for an image on the clipboard. */
  async readImage() {
    if (!navigator.clipboard || !navigator.clipboard.read)
      return { ok: false, error: 'This browser cannot read images from the clipboard' };
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find(t => t.startsWith('image/'));
        if (type) {
          const blob = await item.getType(type);
          return { ok: true, file: new File([blob], 'clipboard-image', { type }) };
        }
      }
      return { ok: false, error: 'There is no image on the clipboard' };
    } catch (_) {
      return { ok: false, error: 'Clipboard access was refused' };
    }
  },
};
