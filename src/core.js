// src/core.js — pure URL validation, caption cleanup, and export helpers.

// Accept only known YouTube hosts and video routes, never arbitrary fetch targets.
export function videoIdFromUrl(value) {
  try {
    const raw = value.trim();
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) return null;
    const parts = url.pathname.split('/').filter(Boolean);
    let id;
    if (url.hostname === 'youtu.be' && parts.length === 1) id = parts[0];
    else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(url.hostname)) {
      if (url.pathname === '/watch') id = url.searchParams.get('v');
      else if (['shorts', 'embed', 'live'].includes(parts[0]) && parts.length === 2) id = parts[1];
    }
    const allowed = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
    return id?.length === 11 && [...id].every(char => allowed.includes(char)) ? id : null;
  } catch { return null; }
}

// Recognize cue time values without altering spoken numbers or clock references.
function isTime(value) {
  const parts = value.split(':');
  return [2, 3].includes(parts.length) && parts.every(part => part.length > 0 && [...part].every(char => '0123456789.,'.includes(char)));
}

// Strip caption markup with a small scanner; decode safe entities without injecting HTML.
function cleanCue(value) {
  let output = '';
  let inTag = false;
  for (const char of value) {
    if (char === '<') inTag = true;
    else if (char === '>' && inTag) inTag = false;
    else if (!inTag) output += char;
  }
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  let decoded = '';
  for (let i = 0; i < output.length; i++) {
    if (output[i] === '&') {
      const end = output.indexOf(';', i + 1);
      if (end > i && end - i < 14) {
        const name = output.slice(i + 1, end);
        let replacement = entities[name];
        if (name.startsWith('#')) {
          const hex = name[1]?.toLowerCase() === 'x';
          const digits = name.slice(hex ? 2 : 1);
          const alphabet = hex ? '0123456789abcdef' : '0123456789';
          if (digits && [...digits.toLowerCase()].every(char => alphabet.includes(char))) {
            const code = Number.parseInt(digits, hex ? 16 : 10);
            if (code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)) replacement = String.fromCodePoint(code);
          }
        }
        if (replacement !== undefined) { decoded += replacement; i = end; continue; }
      }
    }
    decoded += output[i];
  }
  return decoded.trim();
}

// Read SRT/WebVTT cues only, excluding headers, timing lines, styles, and cue IDs.
export function captionsToText(source) {
  const lines = source.split('\r\n').join('\n').split('\r').join('\n').split('\n');
  const cues = [];
  let current = [];
  let active = false;
  let metadata = false;
  const flush = () => {
    const text = cleanCue(current.join(' '));
    if (text) cues.push(text);
    current = [];
  };
  for (const original of lines) {
    const line = original.trim();
    if (!line) { flush(); active = false; metadata = false; continue; }
    if (!active && (line === 'STYLE' || line === 'REGION' || line === 'NOTE' || line.startsWith('NOTE '))) { metadata = true; continue; }
    if (metadata) continue;
    const arrow = line.indexOf('-->');
    if (arrow > 0 && isTime(line.slice(0, arrow).trim()) && isTime(line.slice(arrow + 3).trim().split(' ')[0])) {
      flush(); active = true; continue;
    }
    if (active) current.push(line);
  }
  flush();
  return cues.join('\n');
}

// Keep Unicode text intact and include source attribution in every exported file.
export function exportText({ title, url, language, text }, labels) {
  return `${title}\n${labels.source}: ${url}\n${labels.language}: ${language}\n\n${text}\n`;
}

// Convert API failures to stable message keys, never displaying remote error payloads.
export function apiErrorKey(status, reason) {
  if (['quotaExceeded', 'dailyLimitExceeded'].includes(reason)) return 'quota';
  if (['accessNotConfigured', 'serviceDisabled'].includes(reason)) return 'apiDisabled';
  if (status === 401) return 'expired';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'notFound';
  if (status === 429) return 'rateLimit';
  if (status >= 500) return 'upstream';
  return 'requestFailed';
}
