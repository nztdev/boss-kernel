/**
 * B.O.S.S. MEDIA Action Module — actions/media.js
 * =================================================
 * github.com/nztdev/boss-kernel
 *
 * Full sensory output layer for the MEDIA node.
 * Handles audio, images, and video — all routed through a single
 * intent parser that dispatches to the appropriate sub-handler.
 *
 * Sub-handlers:
 *   Audio   — stream URL playback, Web Audio fallback, volume control
 *   Visual  — image display panel, URL-based image loading
 *   Video   — YouTube/video URL embed in BOSS panel
 *   Cortex  — delegates to /media endpoint when Cortex is online
 *
 * Build status:
 *   Audio   — Phase 7a: stream URL + Web Audio tone fallback [BUILT]
 *   Cortex  — Phase 7b: local OS media control via /media    [STUB]
 *   Visual  — Phase 7c: image display panel                  [STUB]
 *   Video   — Phase 7d: video embed panel                    [STUB]
 *
 * Interface:
 *   MediaAction.handle(intent, clog, Nervous, EVENT, cortexUrl?)
 *   MediaAction.getState()   — current playback/display state
 *   MediaAction.setStreamUrl(url) — configure audio stream
 *
 * localStorage key: BOSS_MEDIA_CONFIG
 *   { streamUrl, volume, lastImage, lastVideo }
 */

// ── State ─────────────────────────────────────────────────────────────────────
const MEDIA_CONFIG_KEY = 'BOSS_MEDIA_CONFIG';

const _state = {
  // Audio
  audioContext:   null,
  audioElement:   null,   // HTMLAudioElement for stream playback
  oscillator:     null,   // Web Audio fallback tone
  gainNode:       null,
  volume:         0.7,
  isPlaying:      false,
  streamUrl:      null,
  currentTrack:   null,

  // Visual (panel managed by Soma)
  currentImage:   null,
  currentVideo:   null,
  panelVisible:   false,

  // Config
  cortexUrl:      null,
};

// Load persisted config
function _loadConfig() {
  try {
    const raw = localStorage.getItem(MEDIA_CONFIG_KEY);
    if (!raw) return;
    const cfg = JSON.parse(raw);
    _state.streamUrl   = cfg.streamUrl   || null;
    _state.volume      = cfg.volume      ?? 0.7;
    _state.currentImage = cfg.lastImage  || null;
    _state.currentVideo = cfg.lastVideo  || null;
  } catch(_) {}
}

function _saveConfig() {
  try {
    localStorage.setItem(MEDIA_CONFIG_KEY, JSON.stringify({
      streamUrl:  _state.streamUrl,
      volume:     _state.volume,
      lastImage:  _state.currentImage,
      lastVideo:  _state.currentVideo,
    }));
  } catch(_) {}
}

_loadConfig();

// ── Intent classification ─────────────────────────────────────────────────────
/**
 * Classify intent into a sub-handler and extract relevant data.
 * Returns { type, subtype, query, url, value } or null.
 */
function _classify(intent) {
  const s = intent.toLowerCase().trim();

  // ── Status / what's playing ──────────────────────────────────────────────
  if (/\b(what('s| is)\s+(playing|on|showing)|status|now playing|current(ly)?)\b/.test(s)) {
    return { type: 'status' };
  }

  // ── Stop / cancel all media ──────────────────────────────────────────────
  if (/\b(stop|cancel|close|quit|exit)\b.*\b(media|music|audio|video|image|photo|playing)\b/.test(s) ||
      /\b(stop|cancel)\s+(playing|all)\b/.test(s)) {
    return { type: 'stop' };
  }

  // ── Volume ───────────────────────────────────────────────────────────────
  const volUp   = /\b(volume\s+up|louder|turn\s+up|increase\s+volume)\b/.test(s);
  const volDown = /\b(volume\s+down|quieter|softer|turn\s+down|decrease\s+volume|lower\s+volume)\b/.test(s);
  const volMute = /\b(mute|silence|quiet)\b/.test(s);
  const volSet  = s.match(/\bvolume\s+(?:to\s+)?(\d{1,3})\s*%?/);
  if (volUp)   return { type: 'volume', action: 'up' };
  if (volDown) return { type: 'volume', action: 'down' };
  if (volMute) return { type: 'volume', action: 'mute' };
  if (volSet)  return { type: 'volume', action: 'set', value: parseInt(volSet[1]) / 100 };

  // ── Image / photo ─────────────────────────────────────────────────────────
  const isImageIntent = /\b(show|display|open|view|look\s+at)\b.*\b(image|photo|picture|pic)\b/.test(s) ||
                        /\b(image|photo|picture)\b.*\b(of|from|at)\b/.test(s);
  // URL extraction — catches http/https links
  const urlMatch = intent.match(/https?:\/\/[^\s]+/i);

  if (isImageIntent || (urlMatch && /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(urlMatch[0]))) {
    return {
      type:    'image',
      url:     urlMatch ? urlMatch[0] : null,
      query:   s.replace(/https?:\/\/[^\s]+/gi, '').trim(),
    };
  }

  // ── Video ─────────────────────────────────────────────────────────────────
  const isVideoIntent = /\b(play|watch|show|open)\b.*\b(video|film|movie|clip)\b/.test(s) ||
                        /\byoutube\b/.test(s);
  const isYouTubeUrl  = urlMatch && /youtube\.com|youtu\.be/i.test(urlMatch[0]);

  if (isVideoIntent || isYouTubeUrl) {
    return {
      type:  'video',
      url:   urlMatch ? urlMatch[0] : null,
      query: s.replace(/https?:\/\/[^\s]+/gi, '').trim(),
    };
  }

  // ── Stream URL configuration ──────────────────────────────────────────────
  if (/\b(set|configure|use|stream)\b.*\b(url|stream|radio|source)\b/.test(s) && urlMatch) {
    return { type: 'config_stream', url: urlMatch[0] };
  }

  // ── Audio play ────────────────────────────────────────────────────────────
  // General play intent — audio is the default for MEDIA
  if (/\b(play|start|resume|begin)\b/.test(s) || /\bmusic\b/.test(s)) {
    return {
      type:  'audio',
      action: 'play',
      url:   urlMatch ? urlMatch[0] : null,
      query: s,
    };
  }

  // ── Pause ─────────────────────────────────────────────────────────────────
  if (/\b(pause|hold|wait)\b/.test(s)) {
    return { type: 'audio', action: 'pause' };
  }

  // Unrecognised — return null so handle() can log help
  return null;
}

// ── Audio sub-handler ─────────────────────────────────────────────────────────
function _ensureAudioContext() {
  if (!_state.audioContext) {
    _state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    _state.gainNode = _state.audioContext.createGain();
    _state.gainNode.gain.value = _state.volume;
    _state.gainNode.connect(_state.audioContext.destination);
  }
  // Resume if suspended (browsers suspend AudioContext until user gesture)
  if (_state.audioContext.state === 'suspended') {
    _state.audioContext.resume();
  }
}

function _stopTone() {
  if (_state.oscillator) {
    try { _state.oscillator.stop(); } catch(_) {}
    _state.oscillator = null;
  }
}

function _playTone(clog) {
  _ensureAudioContext();
  _stopTone();

  // Ambient generative tone — layered oscillators for a pleasant sound
  const freqs = [220, 275, 330];  // A3, approx D4, approx E4
  freqs.forEach((freq, i) => {
    const osc  = _state.audioContext.createOscillator();
    const gain = _state.audioContext.createGain();
    osc.type = i === 0 ? 'sine' : 'triangle';
    osc.frequency.value = freq;
    gain.gain.value = i === 0 ? 0.15 : 0.05;
    osc.connect(gain);
    gain.connect(_state.gainNode);
    osc.start();
    if (i === 0) _state.oscillator = osc;  // keep reference to stop later
  });

  _state.isPlaying  = true;
  _state.currentTrack = 'ambient tone';
  clog('📀 MEDIA: playing ambient tone (no stream configured)', 'log-action');
  clog('   Set a stream: "use stream url https://…" or "set media url https://…"', 'log-action');
}

function _playStream(url, clog) {
  _stopTone();
  if (_state.audioElement) {
    _state.audioElement.pause();
    _state.audioElement = null;
  }

  const audio = new Audio(url);
  audio.volume = _state.volume;
  audio.crossOrigin = 'anonymous';

  audio.addEventListener('playing', () => {
    _state.isPlaying  = true;
    _state.currentTrack = url;
    clog(`📀 MEDIA: streaming ${url.length > 50 ? url.slice(0, 50) + '…' : url}`, 'log-action');
  });
  audio.addEventListener('error', (e) => {
    clog(`📀 MEDIA: stream error — ${e.message || 'could not load URL'}`, 'log-err');
    clog('   Try: "use stream url https://…" to set a working stream', 'log-action');
    _playTone(clog);
  });
  audio.addEventListener('ended', () => { _state.isPlaying = false; });

  audio.play().catch(err => {
    clog(`📀 MEDIA: autoplay blocked — ${err.message}`, 'log-err');
  });

  _state.audioElement = audio;
}

function _handleAudio(parsed, clog) {
  switch (parsed.action) {
    case 'play':
      const url = parsed.url || _state.streamUrl;
      if (url) {
        _playStream(url, clog);
        if (parsed.url) {
          _state.streamUrl = parsed.url;
          _saveConfig();
        }
      } else {
        _playTone(clog);
      }
      break;

    case 'pause':
      if (_state.audioElement) {
        _state.audioElement.pause();
        _state.isPlaying = false;
        clog('📀 MEDIA: paused', 'log-action');
      } else {
        _stopTone();
        _state.isPlaying = false;
        clog('📀 MEDIA: stopped', 'log-action');
      }
      break;
  }
}

function _handleVolume(parsed, clog) {
  const step = 0.1;
  switch (parsed.action) {
    case 'up':
      _state.volume = Math.min(1.0, _state.volume + step);
      clog(`📀 MEDIA: volume → ${Math.round(_state.volume * 100)}%`, 'log-action');
      break;
    case 'down':
      _state.volume = Math.max(0.0, _state.volume - step);
      clog(`📀 MEDIA: volume → ${Math.round(_state.volume * 100)}%`, 'log-action');
      break;
    case 'mute':
      _state.volume = 0;
      clog('📀 MEDIA: muted', 'log-action');
      break;
    case 'set':
      _state.volume = Math.max(0, Math.min(1, parsed.value));
      clog(`📀 MEDIA: volume set to ${Math.round(_state.volume * 100)}%`, 'log-action');
      break;
  }
  if (_state.gainNode) _state.gainNode.gain.value = _state.volume;
  if (_state.audioElement) _state.audioElement.volume = _state.volume;
  _saveConfig();
}

function _handleStop(clog) {
  _stopTone();
  if (_state.audioElement) {
    _state.audioElement.pause();
    _state.audioElement = null;
  }
  _state.isPlaying   = false;
  _state.currentTrack = null;
  // Visual panel close dispatched via Nervous System — Soma listens and closes panel
  clog('📀 MEDIA: all media stopped', 'log-action');
}

function _handleStatus(clog) {
  if (_state.isPlaying) {
    clog(`📀 MEDIA: playing — ${_state.currentTrack || 'unknown'}`, 'log-action');
    clog(`   volume: ${Math.round(_state.volume * 100)}%`, 'log-action');
  } else {
    clog('📀 MEDIA: idle', 'log-action');
  }
  if (_state.currentImage) {
    clog(`🖼 MEDIA: image loaded — ${_state.currentImage.slice(0, 60)}`, 'log-action');
  }
  if (_state.currentVideo) {
    clog(`🎬 MEDIA: video loaded — ${_state.currentVideo.slice(0, 60)}`, 'log-action');
  }
  if (_state.streamUrl) {
    clog(`   stream: ${_state.streamUrl.slice(0, 60)}`, 'log-action');
  }
}

// ── Visual sub-handler (Phase 7c stub) ───────────────────────────────────────
function _handleImage(parsed, clog, Nervous, EVENT) {
  if (parsed.url) {
    _state.currentImage = parsed.url;
    _saveConfig();
    // Emit event — Soma listens to open image panel
    if (Nervous && EVENT) {
      Nervous.emit('MEDIA_IMAGE_REQUESTED', {
        source:  'MEDIA',
        payload: { url: parsed.url },
      });
    }
    clog(`🖼 MEDIA: image → ${parsed.url.slice(0, 60)}`, 'log-action');
    clog('   Image panel coming in Phase 7c — URL captured for when panel is built', 'log-action');
  } else {
    clog('🖼 MEDIA: image display — provide a URL', 'log-action');
    clog('   Example: "show image https://example.com/photo.jpg"', 'log-action');
  }
}

// ── Video sub-handler (Phase 7d stub) ─────────────────────────────────────────
function _handleVideo(parsed, clog, Nervous, EVENT) {
  if (parsed.url) {
    _state.currentVideo = parsed.url;
    _saveConfig();
    if (Nervous && EVENT) {
      Nervous.emit('MEDIA_VIDEO_REQUESTED', {
        source:  'MEDIA',
        payload: { url: parsed.url },
      });
    }
    clog(`🎬 MEDIA: video → ${parsed.url.slice(0, 60)}`, 'log-action');
    clog('   Video panel coming in Phase 7d — URL captured for when panel is built', 'log-action');
  } else {
    clog('🎬 MEDIA: video playback — provide a URL', 'log-action');
    clog('   Example: "play video https://youtube.com/watch?v=…"', 'log-action');
  }
}

// ── Cortex media delegation (Phase 7b stub) ───────────────────────────────────
async function _delegateToCortex(intent, cortexUrl, clog) {
  // Phase 7b: POST to cortexUrl/media with intent
  // Cortex controls local OS media session (Spotify, VLC, system audio)
  clog('📀 MEDIA: Cortex media control coming in Phase 7b', 'log-action');
  clog(`   Cortex at ${cortexUrl} — /media endpoint not yet implemented`, 'log-action');
}

// ── Screen flash (preserved) ──────────────────────────────────────────────────
function _flash() {
  const f = document.createElement('div');
  f.className = 'action-flash';
  f.style.background = 'rgba(0,240,255,0.08)';
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 600);
}

// ── Public interface ──────────────────────────────────────────────────────────
export const MediaAction = {
  async handle(intent, clog, Nervous, EVENT, cortexUrl = null) {
    _flash();

    const parsed = _classify(intent);

    if (!parsed) {
      clog(`📀 MEDIA: no recognised action in "${intent}"`, 'log-action');
      clog('   Audio: "play music" · "pause" · "volume up" · "stop"', 'log-action');
      clog('   Image: "show image [url]"', 'log-action');
      clog('   Video: "play video [url]" · "watch [youtube url]"', 'log-action');
      return;
    }

    // Emit event for Nervous System
    if (Nervous && EVENT) {
      Nervous.emit('MEDIA_ACTION', {
        source:  'MEDIA',
        payload: { type: parsed.type, intent },
      });
    }

    switch (parsed.type) {
      case 'audio':         _handleAudio(parsed, clog);                         break;
      case 'volume':        _handleVolume(parsed, clog);                        break;
      case 'stop':          _handleStop(clog);                                   break;
      case 'status':        _handleStatus(clog);                                 break;
      case 'image':         _handleImage(parsed, clog, Nervous, EVENT);          break;
      case 'video':         _handleVideo(parsed, clog, Nervous, EVENT);          break;
      case 'config_stream':
        _state.streamUrl = parsed.url;
        _saveConfig();
        clog(`📀 MEDIA: stream URL set → ${parsed.url.slice(0, 60)}`, 'log-action');
        clog('   Say "play music" to start streaming', 'log-action');
        break;
    }
  },

  setStreamUrl(url) {
    _state.streamUrl = url;
    _saveConfig();
  },

  getState() {
    return {
      isPlaying:    _state.isPlaying,
      currentTrack: _state.currentTrack,
      volume:       _state.volume,
      streamUrl:    _state.streamUrl,
      currentImage: _state.currentImage,
      currentVideo: _state.currentVideo,
    };
  },
};
