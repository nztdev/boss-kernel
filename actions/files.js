/**
 * B.O.S.S. FILES Action Module — actions/files.js
 * =================================================
 * github.com/nztdev/boss-kernel
 *
 * File access, viewing, and document management.
 * Abstracts over three access paths — whichever is available fires:
 *
 *   Path A — Python Cortex (desktop): filesystem traversal, open in OS app
 *   Path B — File System Access API (browser): user-initiated file picker
 *   Path C — Native (Phase 9, Capacitor): full device filesystem access
 *
 * The viewer panel (in index.html) handles rendering:
 *   image/* → <img>
 *   video/* → <video>
 *   audio/* → MEDIA player modal
 *   application/pdf → <iframe> embed
 *   text/* → <pre> with monospace display
 *   other  → "open in default app" via Cortex
 */

const FILES_HISTORY_KEY = 'BOSS_FILES_HISTORY';
const MAX_HISTORY = 20;

// ── File history ──────────────────────────────────────────────────────────────
function _getHistory() {
  try { return JSON.parse(localStorage.getItem(FILES_HISTORY_KEY) || '[]'); }
  catch(_) { return []; }
}

function _addToHistory(entry) {
  const hist = _getHistory();
  const existing = hist.findIndex(h => h.url === entry.url || h.name === entry.name);
  if (existing >= 0) hist.splice(existing, 1);
  hist.unshift({ ...entry, openedAt: Date.now() });
  if (hist.length > MAX_HISTORY) hist.pop();
  try { localStorage.setItem(FILES_HISTORY_KEY, JSON.stringify(hist)); } catch(_) {}
}

// ── MIME type detection ───────────────────────────────────────────────────────
function _mimeFromName(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const map = {
    // Images
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif',  webp: 'image/webp', svg: 'image/svg+xml',
    bmp: 'image/bmp',  ico: 'image/x-icon',
    // Video
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
    mkv: 'video/x-matroska', avi: 'video/x-msvideo',
    // Audio
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
    m4a: 'audio/mp4',  flac: 'audio/flac', aac: 'audio/aac',
    // Documents
    pdf:  'application/pdf',
    txt:  'text/plain', md: 'text/markdown', csv: 'text/csv',
    json: 'application/json', xml: 'application/xml',
    html: 'text/html', htm: 'text/html',
    js:   'text/javascript', css: 'text/css',
    // Office (stub — open via Cortex)
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    doc:  'application/msword', xls: 'application/vnd.ms-excel',
  };
  return map[ext] || 'application/octet-stream';
}

function _viewerTypeFromMime(mime) {
  if (mime.startsWith('image/'))          return 'image';
  if (mime.startsWith('video/'))          return 'video';
  if (mime.startsWith('audio/'))          return 'audio';
  if (mime === 'application/pdf')         return 'pdf';
  if (mime.startsWith('text/') ||
      mime === 'application/json' ||
      mime === 'application/xml')         return 'text';
  return 'external';  // open via Cortex or OS
}

// ── Intent classification ─────────────────────────────────────────────────────
function _classify(intent) {
  const s = intent.toLowerCase().trim();

  if (/\b(recent|history|last|opened)\b/.test(s))
    return { type: 'recent' };

  if (/\b(pick|choose|select|browse|upload)\b/.test(s))
    return { type: 'pick' };

  if (/\b(open|view|show|display)\b.*\b(file|document|doc|pdf|image|video)\b/.test(s)) {
    const urlMatch = intent.match(/https?:\/\/[^\s]+/i);
    if (urlMatch) return { type: 'url', url: urlMatch[0] };
    return { type: 'pick' };
  }

  const urlMatch = intent.match(/https?:\/\/[^\s]+/i);
  if (urlMatch) return { type: 'url', url: urlMatch[0] };

  if (/\b(download|recent file)\b/.test(s))
    return { type: 'cortex_recent' };

  return null;
}

// ── Screen flash ──────────────────────────────────────────────────────────────
function _flash() {
  const f = document.createElement('div');
  f.className = 'action-flash';
  f.style.background = 'rgba(255,204,0,0.07)';
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 600);
}

// ── Public interface ──────────────────────────────────────────────────────────
export const FilesAction = {
  async handle(intent, clog, Nervous, EVENT, cortexUrl, openFileViewer) {
    _flash();

    const classified = _classify(intent);
    if (!classified) {
      clog(`📂 FILES: no recognised action in "${intent}"`, 'log-action');
      clog('   Say: "open file" · "recent files" · "open [url]" · "pick file"', 'log-action');
      return false;
    }

    switch (classified.type) {
      case 'recent':
        return this._handleRecent(clog, openFileViewer);

      case 'pick':
        return this._handlePick(clog, openFileViewer);

      case 'url':
        return this._handleUrl(classified.url, clog, openFileViewer);

      case 'cortex_recent':
        return this._handleCortexRecent(cortexUrl, clog, openFileViewer);
    }
    return true;
  },

  // ── Recent files from history ───────────────────────────────────────────────
  _handleRecent(clog, openFileViewer) {
    const hist = _getHistory();
    if (!hist.length) {
      clog('📂 FILES: no recent files — open a file first', 'log-action');
      return false;
    }
    clog(`📂 FILES: ${hist.length} recent file${hist.length !== 1 ? 's' : ''}`, 'log-action');
    hist.slice(0, 5).forEach((h, i) => {
      const age = Math.round((Date.now() - h.openedAt) / 60000);
      const ageStr = age < 60 ? `${age}m ago` : `${Math.round(age/60)}h ago`;
      clog(`   ${i+1}. ${h.name} (${ageStr})`, 'log-action');
    });
    return true;
  },

  // ── File System Access API picker (Path B) ──────────────────────────────────
  async _handlePick(clog, openFileViewer) {
    if (!window.showOpenFilePicker) {
      clog('📂 FILES: file picker not available in this browser', 'log-action');
      clog('   Try Chrome or Edge, or use "open [url]" to load a file by URL', 'log-action');
      return false;
    }
    try {
      const [fileHandle] = await window.showOpenFilePicker({
        types: [
          { description: 'All files', accept: { '*/*': [] } },
        ],
        multiple: false,
      });
      const file = await fileHandle.getFile();
      const mime = file.type || _mimeFromName(file.name);
      const viewerType = _viewerTypeFromMime(mime);
      const url = URL.createObjectURL(file);

      clog(`📂 FILES: opened ${file.name} (${(file.size/1024).toFixed(1)} KB)`, 'log-action');
      _addToHistory({ name: file.name, url, mime, source: 'picker' });

      if (openFileViewer) openFileViewer({ url, name: file.name, mime, viewerType });
      return true;
    } catch(e) {
      if (e.name !== 'AbortError') {
        clog(`📂 FILES: picker error — ${e.message}`, 'log-err');
      }
      return false;
    }
  },

  // ── URL-based file viewer ───────────────────────────────────────────────────
  _handleUrl(url, clog, openFileViewer) {
    const name = url.split('/').pop().split('?')[0] || 'file';
    const mime = _mimeFromName(name);
    const viewerType = _viewerTypeFromMime(mime);

    clog(`📂 FILES: opening ${name}`, 'log-action');
    _addToHistory({ name, url, mime, source: 'url' });

    if (openFileViewer) openFileViewer({ url, name, mime, viewerType });
    return true;
  },

  // ── Cortex recent downloads (Path A) ───────────────────────────────────────
  async _handleCortexRecent(cortexUrl, clog, openFileViewer) {
    if (!cortexUrl) {
      clog('📂 FILES: recent downloads require Cortex server', 'log-action');
      clog('   Connect Cortex via cortex pill to access local files', 'log-action');
      return false;
    }
    try {
      const r = await fetch(`${cortexUrl}/pulse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent: 'what did I download recently', node: 'FILES' }),
        signal: AbortSignal.timeout(4000),
      });
      if (!r.ok) throw new Error(`${r.status}`);
      const d = await r.json();
      if (d.response) clog(`📂 [cortex→FILES] ${d.response}`, 'log-action');
    } catch(e) {
      clog(`📂 FILES: Cortex unreachable — ${e.message}`, 'log-err');
    }
    return true;
  },

  getHistory: _getHistory,
  addToHistory: _addToHistory,
  mimeFromName: _mimeFromName,
  viewerTypeFromMime: _viewerTypeFromMime,
};