// src/main.js — localized interface, official retrieval flow, and local text export.
import './style.css';
import { videoIdFromUrl, captionsToText, exportText } from './core.js';
import { messages } from './i18n.js';
import { loadIdentity, connect, disconnect, isConnected, googleGet } from './google.js';

// Retain only the language preference; captions and credentials are memory-only.
let locale = 'en';
try { locale = localStorage.getItem('pigeon-language') === 'my' ? 'my' : 'en'; } catch { /* Private browsing can deny storage. */ }
const state = { mode: 'youtube', busy: false, status: 'idle', error: false, tracks: [], result: null, video: null };
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const pigeon = `${import.meta.env.BASE_URL}pigeon.svg`;
let controller = null;
const t = key => messages[locale][key] || messages[locale].requestFailed;
const el = id => document.getElementById(id);

// Build a stable DOM so language changes preserve focus, inputs, and ongoing work.
el('app').innerHTML = `
  <a class="skip" href="#tool" data-i18n="skip"></a>
  <header class="header wrap">
    <a class="brand" href="#" aria-label="YT Transcript Pigeon"><img src="${pigeon}" alt="" width="40" height="40"><span>YT Transcript <strong>Pigeon</strong><span class="brand-dot">.</span></span></a>
    <nav><a href="#how" data-i18n="navHow"></a><div class="locale" role="group" data-aria="toggle"><button id="en" lang="en">EN</button><button id="my" lang="my">မြန်မာ</button></div></nav>
  </header>
  <main class="wrap">
    <section class="hero">
      <div class="hero-copy"><p class="eyebrow"><span class="line"></span><span data-i18n="eyebrow"></span></p><h1><span data-i18n="hero"></span><em data-i18n="heroAccent"></em></h1><p class="intro" data-i18n="intro"></p></div>
      <div class="hero-art" aria-hidden="true"><div class="orbit"></div><div class="paper paper-back"><span></span><span></span><span></span></div><div class="paper paper-front"><span></span><span></span><span></span><b>.txt</b></div><img src="${pigeon}" alt="" class="hero-pigeon"><span class="flight-line">⌁</span><span class="art-caption" data-i18n="badge"></span></div>
    </section>
    <section id="tool" class="workspace" aria-labelledby="tool-title">
      <div class="tool-panel">
        <div class="section-mark">01 / <span data-i18n="source"></span></div>
        <h2 id="tool-title" data-i18n="toolTitle"></h2><p class="muted" data-i18n="toolIntro"></p>
        <div class="tabs" role="group"><button id="youtube-tab" data-i18n="youtubeTab" aria-pressed="true"></button><button id="import-tab" data-i18n="importTab" aria-pressed="false"></button></div>
        <form id="form" novalidate>
          <label for="url" data-i18n="urlLabel"></label><input id="url" name="url" type="url" inputmode="url" autocomplete="off" spellcheck="false" data-placeholder="urlPlaceholder" aria-describedby="access-note status">
          <div id="youtube-fields">
            <p id="access-note" class="note" data-i18n="accessNote"></p><p id="config-note" class="config-note" data-i18n="config" hidden></p>
            <label class="consent"><input id="consent" type="checkbox"><span><span data-i18n="consent"></span> <a href="#privacy" data-i18n="navPrivacy"></a></span></label>
            <button type="button" id="connect" class="secondary full" data-i18n="connect"></button>
            <div id="account" class="account" hidden><span data-i18n="connected"></span><button type="button" id="disconnect" class="text-button" data-i18n="disconnect"></button></div>
          </div>
          <div id="import-fields" hidden>
            <p class="note" data-i18n="importNote"></p><label for="video-title" data-i18n="titleLabel"></label><input id="video-title" maxlength="200" data-placeholder="titlePlaceholder">
            <label for="file" data-i18n="fileLabel"></label><div class="file-picker"><div class="file-control"><span class="file-button" data-i18n="chooseFile" aria-hidden="true"></span><span id="file-name" aria-hidden="true"></span><input id="file" type="file" accept=".srt,.vtt" aria-describedby="file-hint" data-aria="chooseFile"></div><p id="file-hint" data-i18n="fileHint"></p></div>
          </div>
          <button id="submit" class="primary full" type="submit"><span id="submit-label"></span><span aria-hidden="true">↗</span></button>
        </form>
        <div id="tracks" class="track-picker" hidden><label for="track" data-i18n="language"></label><select id="track"></select><button id="retrieve" class="secondary full" data-i18n="getTranscript"></button></div>
        <div class="status-area"><span id="status-dot" aria-hidden="true"></span><p id="status" role="status" aria-live="polite" aria-atomic="true"></p><button id="cancel" class="text-button" data-i18n="cancel" hidden></button></div>
      </div>
      <div class="result-panel" id="result-panel" aria-busy="false">
        <div class="section-mark">02 / <span data-i18n="transcriptLabel"></span></div>
        <div id="empty" class="empty"><div class="empty-paper" aria-hidden="true"><span></span><span></span><span></span><span></span></div><h2 data-i18n="emptyTitle"></h2><p data-i18n="emptyBody"></p><span class="empty-stamp" aria-hidden="true">PIGEON POST</span></div>
        <div id="result" hidden><h2 data-i18n="resultTitle"></h2><a id="source" target="_blank" rel="noopener noreferrer" data-aria="sourceOpen"></a><div class="result-meta"><span id="result-language"></span><span id="count"></span></div><textarea id="transcript" readonly data-aria="transcriptLabel" spellcheck="false"></textarea><div class="export-actions"><button id="download" class="primary" data-i18n="download"></button><button id="copy" class="secondary" data-i18n="copy"></button></div></div>
        <div class="result-foot"><span><span aria-hidden="true">✓</span> <span data-i18n="noTimestamps"></span></span><span data-i18n="utf8"></span></div>
      </div>
    </section>
    <section id="how" class="how"><h2 data-i18n="howTitle"></h2><div class="steps">${[1, 2, 3].map(n => `<article><span class="step-number">0${n}</span><div><h3 data-i18n="step${n}Title"></h3><p data-i18n="step${n}"></p></div></article>`).join('')}</div></section>
    <aside class="limits"><span aria-hidden="true">i</span><div><h3 data-i18n="limitsTitle"></h3><p data-i18n="limits"></p></div></aside>
    <details id="privacy"><summary data-i18n="navPrivacy"></summary><h3 data-i18n="privacyTitle"></h3><p data-i18n="privacy"></p><p data-i18n="permission"></p><p data-i18n="terms"></p><div class="legal-links"><a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer" data-i18n="youtubeTerms"></a><a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" data-i18n="googlePrivacy"></a><a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" data-i18n="revoke"></a></div></details>
  </main>
  <footer class="wrap"><span class="footer-signature" data-i18n="footer"></span><span data-i18n="independent"></span></footer>`;

// Resolve BCP-47 language names in the active interface language, preserving track names.
function trackLabel(track) {
  if (!track) return t('unknownLanguage');
  let name = track.snippet.language;
  try { name = new Intl.DisplayNames([locale], { type: 'language' }).of(name) || name; } catch { /* Preserve unrecognized language codes. */ }
  return `${name}${track.snippet.name ? ` · ${track.snippet.name}` : ''} · ${t(track.snippet.trackKind === 'ASR' ? 'generated' : 'manual')}`;
}

// Apply every translated label and dynamic state without translating the source content.
function render() {
  document.documentElement.lang = locale;
  document.title = t('pageTitle');
  document.querySelector('meta[name="description"]').content = t('intro');
  document.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = t(node.dataset.i18n); });
  document.querySelectorAll('[data-aria]').forEach(node => { node.setAttribute('aria-label', t(node.dataset.aria)); });
  document.querySelectorAll('[data-placeholder]').forEach(node => { node.placeholder = t(node.dataset.placeholder); });
  for (const lang of ['en', 'my']) el(lang).setAttribute('aria-pressed', String(locale === lang));
  const imported = state.mode === 'import';
  el('youtube-fields').hidden = imported;
  el('import-fields').hidden = !imported;
  el('youtube-tab').setAttribute('aria-pressed', String(!imported));
  el('import-tab').setAttribute('aria-pressed', String(imported));
  el('submit-label').textContent = t(imported ? 'importAction' : 'fetch');
  el('file-name').textContent = el('file').files[0]?.name || t('fileEmpty');
  el('config-note').hidden = Boolean(clientId);
  el('account').hidden = !isConnected();
  el('connect').hidden = isConnected();
  el('status').textContent = t(state.status);
  el('status').classList.toggle('error', state.error);
  el('status-dot').className = state.busy ? 'pulse' : state.error ? 'error-dot' : '';
  el('cancel').hidden = !state.busy || state.status === 'authorizing';
  el('result-panel').setAttribute('aria-busy', String(state.busy));
  for (const id of ['url', 'file', 'video-title', 'consent', 'submit', 'connect', 'track', 'retrieve', 'youtube-tab', 'import-tab', 'disconnect']) el(id).disabled = state.busy;
  el('tracks').hidden = !state.tracks.length || imported;
  const selected = el('track').value;
  el('track').replaceChildren(...state.tracks.map(track => new Option(trackLabel(track), track.id)));
  if (state.tracks.some(track => track.id === selected)) el('track').value = selected;
  el('empty').hidden = Boolean(state.result);
  el('result').hidden = !state.result;
  if (state.result) {
    const result = state.result;
    el('source').textContent = result.title || `${t('videoFallback')} · ${state.video.id}`;
    el('source').href = result.url;
    el('result-language').textContent = trackLabel(result.track);
    el('count').textContent = `${new Intl.NumberFormat(locale).format([...result.text].length)} ${t('characters')}`;
    el('transcript').value = result.text;
    el('transcript').lang = result.track?.snippet.language || '';
  } else { el('transcript').value = ''; el('source').removeAttribute('href'); el('source').textContent = ''; }
}

// Keep errors as translation keys so an already-visible error switches languages too.
function status(key, error = false) { state.status = key; state.error = error; render(); }
function resetResult() { state.result = null; state.tracks = []; state.video = null; }

// Serialize requests, expose cancellation, and always release the loading state.
async function perform(key, work) {
  if (state.busy) return;
  state.busy = true;
  controller = new AbortController();
  status(key);
  try { await work(controller.signal); }
  catch (error) { status(messages.en[error.message] ? error.message : 'requestFailed', error.message !== 'cancelledRequest'); }
  finally { state.busy = false; controller = null; render(); }
}

// Localize immediately; language selection remains available during requests.
for (const lang of ['en', 'my']) el(lang).addEventListener('click', () => {
  locale = lang;
  try { localStorage.setItem('pigeon-language', locale); } catch { /* The application remains usable without storage. */ }
  render();
});
for (const mode of ['youtube', 'import']) el(`${mode}-tab`).addEventListener('click', () => { state.mode = mode; resetResult(); status('idle'); });
el('url').addEventListener('input', () => { resetResult(); el('url').removeAttribute('aria-invalid'); status('cleared'); });
el('file').addEventListener('change', () => { resetResult(); status('idle'); });
el('video-title').addEventListener('input', () => { if (state.result) { state.result.title = el('video-title').value.trim(); render(); } });
el('cancel').addEventListener('click', () => controller?.abort());

// Consent is explicit, and the popup is opened synchronously from the click handler.
el('connect').addEventListener('click', () => {
  if (!el('consent').checked) { status('consentRequired', true); el('consent').focus(); return; }
  perform('authorizing', async () => { await connect(clientId); status('connected'); });
});
el('disconnect').addEventListener('click', () => { disconnect(); resetResult(); el('file').value = ''; el('video-title').value = ''; el('url').value = ''; el('consent').checked = false; status('signedOut'); });

// Validate before any network work; import files locally or list authorized tracks.
el('form').addEventListener('submit', event => {
  event.preventDefault();
  const id = videoIdFromUrl(el('url').value);
  if (!id) { status('invalidUrl', true); el('url').setAttribute('aria-invalid', 'true'); el('url').focus(); return; }
  resetResult();
  const url = `https://www.youtube.com/watch?v=${id}`;
  if (state.mode === 'import') {
    perform('downloading', async () => {
      const file = el('file').files[0];
      if (!file) throw new Error('noFile');
      if (!['srt', 'vtt'].includes(file.name.split('.').pop().toLowerCase())) throw new Error('invalidFile');
      if (file.size > 2 * 1024 * 1024) throw new Error('largeFile');
      let source;
      try { source = await file.text(); } catch { throw new Error('fileFailed'); }
      if (controller.signal.aborted) throw new Error('cancelledRequest');
      const text = captionsToText(source);
      if (!text) throw new Error('emptyFile');
      state.video = { id, url };
      state.result = { text, url, title: el('video-title').value.trim(), track: null };
      status('imported');
    });
  } else {
    if (!clientId) { status('config', true); return; }
    if (!isConnected()) { status('expired', true); el('connect').focus(); return; }
    perform('loading', async signal => {
      const data = await googleGet('captions', { part: 'snippet', videoId: id }, signal);
      const tracks = (data.items || []).filter(track => track.snippet.status === 'serving' && !track.snippet.isDraft);
      if (!tracks.length) throw new Error('noCaptions');
      state.video = { id, url, title: '' };
      state.tracks = tracks;
      status('tracksReady');
    });
  }
});

// Retrieve one chosen track; optional metadata failure must not discard usable captions.
el('retrieve').addEventListener('click', () => {
  const track = state.tracks.find(item => item.id === el('track').value);
  if (!track || !state.video) return;
  state.result = null;
  perform('downloading', async signal => {
    const raw = await googleGet(`captions/${encodeURIComponent(track.id)}`, { tfmt: 'vtt' }, signal, true);
    const text = captionsToText(raw);
    if (!text) throw new Error('emptyFile');
    if (!state.video.title) {
      try {
        const details = await googleGet('videos', { part: 'snippet', id: state.video.id }, signal);
        state.video.title = details.items?.[0]?.snippet?.title || '';
      } catch (error) { if (signal.aborted) throw error; /* Canonical video URL remains sufficient attribution. */ }
    }
    state.result = { ...state.video, text, track };
    status('ready');
  });
});
el('track').addEventListener('change', () => { state.result = null; status('tracksReady'); });

// Share the same attribution-preserving UTF-8 payload between copy and download.
function payload() {
  return exportText({ ...state.result, title: state.result.title || `${t('videoFallback')} · ${state.video.id}`, language: trackLabel(state.result.track) }, { source: t('source'), language: t('language') });
}
el('download').addEventListener('click', () => {
  if (!state.result) return;
  const blob = new Blob([payload()], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const language = state.result.track?.snippet.language || 'captions';
  const safeLanguage = [...language].filter(char => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'.includes(char)).join('');
  link.download = `youtube-${state.video.id}-${safeLanguage}.txt`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  status('downloaded');
});
el('copy').addEventListener('click', async () => {
  if (!state.result) return;
  try { await navigator.clipboard.writeText(payload()); status('copied'); }
  catch { status('copyFailed', true); el('transcript').focus(); el('transcript').select(); }
});

// Expand the legal notice when navigating to it, including consent links.
document.querySelectorAll('a[href="#privacy"]').forEach(link => link.addEventListener('click', () => { el('privacy').open = true; }));
loadIdentity(clientId);
render();
