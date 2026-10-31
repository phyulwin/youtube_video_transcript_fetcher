// tests/core.test.js — security boundaries, real subtitle formats, and localization parity.
import test from 'node:test';
import assert from 'node:assert/strict';
import { videoIdFromUrl, captionsToText, exportText, apiErrorKey } from '../src/core.js';
import { messages } from '../src/i18n.js';

// Accept supported routes while excluding spoofed hosts, unsafe schemes, and bad IDs.
test('YouTube URL validation', () => {
  for (const url of ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=2', 'youtu.be/dQw4w9WgXcQ?si=x', 'https://m.youtube.com/shorts/dQw4w9WgXcQ', 'https://youtube.com/live/dQw4w9WgXcQ', 'https://youtube.com/embed/dQw4w9WgXcQ']) assert.equal(videoIdFromUrl(url), 'dQw4w9WgXcQ');
  for (const url of ['', 'https://youtube.com.evil.org/watch?v=dQw4w9WgXcQ', 'https://youtube.com@evil.org/watch?v=dQw4w9WgXcQ', 'javascript:alert(1)', 'https://youtu.be/bad', 'https://youtube.com/playlist?list=dQw4w9WgXcQ', 'https://youtube.com:123/watch?v=dQw4w9WgXcQ', 'https://youtu.be/dQw4w9WgXcQ/extra']) assert.equal(videoIdFromUrl(url), null);
});

// Preserve spoken numbers, Burmese Unicode, and deliberate repeated captions.
test('SRT cleanup preserves words and repetition', () => {
  const srt = '1\r\n00:00:01,000 --> 00:00:02,000\r\n<b>Hello</b> &amp; welcome\r\n\r\n2\r\n00:00:02,000 --> 00:00:03,000\r\n2026\r\nမင်္ဂလာပါ\r\n\r\n3\r\n00:00:03,000 --> 00:00:04,000\r\nMeet at 10:30.\r\n\r\n4\r\n00:00:04,000 --> 00:00:05,000\r\nMeet at 10:30.';
  assert.equal(captionsToText(srt), 'Hello & welcome\n2026 မင်္ဂလာပါ\nMeet at 10:30.\nMeet at 10:30.');
});

// Skip WebVTT metadata and inline cue times without leaking markup into output.
test('WebVTT cleanup handles metadata, identifiers, and entities', () => {
  const vtt = '\uFEFFWEBVTT\nKind: captions\nLanguage: en\n\nNOTE hidden\n00:00.000 --> 00:01.000\nignore\n\nSTYLE\n::cue { color: red }\n\ncue-id\n00:01.000 --> 00:02.000 align:start position:0%\n<v Speaker>Hello <00:01.200><c>world</c> &#x41; &lt;3\n\n';
  assert.equal(captionsToText(vtt), 'Hello world A <3');
  assert.equal(captionsToText('plain text without caption timings'), '');
  assert.equal(captionsToText('WEBVTT\n\n'), '');
});

// Verify UTF-8 source attribution and the complete translated interface contract.
test('exports retain attribution and both dictionaries have every message', () => {
  const exported = exportText({ title: 'ခေါင်းစဉ်', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', language: 'မြန်မာ', text: 'မင်္ဂလာပါ' }, { source: 'မူရင်း', language: 'ဘာသာစကား' });
  assert.ok(exported.includes('မင်္ဂလာပါ'));
  assert.ok(exported.includes('https://www.youtube.com/watch?v=dQw4w9WgXcQ'));
  assert.deepEqual(Object.keys(messages.en).sort(), Object.keys(messages.my).sort());
  assert.ok(Object.values(messages.my).every(value => value.length > 0));
});

// Distinguish operational failures from missing permission and expired credentials.
test('API errors map to actionable localized categories', () => {
  assert.equal(apiErrorKey(403, 'quotaExceeded'), 'quota');
  assert.equal(apiErrorKey(403, 'accessNotConfigured'), 'apiDisabled');
  assert.equal(apiErrorKey(403, 'forbidden'), 'forbidden');
  assert.equal(apiErrorKey(401), 'expired');
  assert.equal(apiErrorKey(404), 'notFound');
  assert.equal(apiErrorKey(429), 'rateLimit');
  assert.equal(apiErrorKey(503), 'upstream');
});
