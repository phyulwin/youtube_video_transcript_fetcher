// src/google.js — official Google OAuth and YouTube API access; no persistent tokens.
import { apiErrorKey } from './core.js';
const scope = 'https://www.googleapis.com/auth/youtube.force-ssl';
let token = '';
let expiresAt = 0;
let identityReady = false;

// Load Google's identity library only when an OAuth client is configured.
export function loadIdentity(clientId) {
  if (!clientId) return;
  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.onload = () => { identityReady = true; };
  script.onerror = () => { identityReady = false; };
  document.head.append(script);
}

// Open consent directly from a user gesture and reject missing caption scope.
export function connect(clientId) {
  return new Promise((resolve, reject) => {
    if (!clientId) return reject(new Error('config'));
    if (!identityReady || !window.google?.accounts?.oauth2) return reject(new Error('authUnavailable'));
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope,
        include_granted_scopes: false,
        callback: response => {
          if (response.error || !window.google.accounts.oauth2.hasGrantedAllScopes(response, scope)) return reject(new Error('authDenied'));
          token = response.access_token;
          expiresAt = Date.now() + Number(response.expires_in) * 1000 - 30000;
          resolve();
        },
        error_callback: () => reject(new Error('cancelled')),
      });
      client.requestAccessToken({ prompt: 'select_account' });
    } catch { reject(new Error('authUnavailable')); }
  });
}

// Forget local credentials immediately; provider-level revocation has a separate settings link.
export function disconnect() { token = ''; expiresAt = 0; }
export function isConnected() { return Boolean(token) && Date.now() < expiresAt; }

// Make bounded GET requests exclusively to Google's API, with safe localized error keys.
export async function googleGet(path, parameters, signal, plainText = false) {
  if (!isConnected()) { disconnect(); throw new Error('expired'); }
  const timeout = AbortSignal.timeout(20000);
  try {
    const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
    url.search = new URLSearchParams(parameters).toString();
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.any([signal, timeout]),
      cache: 'no-store',
      credentials: 'omit',
    });
    if (!response.ok) {
      let reason = '';
      try { reason = (await response.json()).error?.errors?.[0]?.reason || ''; } catch { /* Non-JSON error responses use their HTTP status. */ }
      if (response.status === 401) disconnect();
      throw new Error(apiErrorKey(response.status, reason));
    }
    return plainText ? await response.text() : await response.json();
  } catch (error) {
    if (signal.aborted) throw new Error('cancelledRequest');
    if (timeout.aborted) throw new Error('timeout');
    if (error instanceof TypeError) throw new Error('network');
    throw error;
  }
}
