# Verification record

Verified locally on October 30, 2026, using Windows, Node.js 20.19.0, Vite 8.3.5, Playwright 1.64.1, and installed Microsoft Edge.

| Check | Result |
| --- | --- |
| Production build | Passed; static HTML, CSS, JavaScript, and SVG emitted to `dist/` |
| Unit tests | 5 passed |
| Browser integration tests | 12 passed |
| Full npm dependency audit | 0 vulnerabilities reported |
| Whitespace check | `git diff --check` passed; only a Windows line-ending advisory |
| Local preview | HTTP 200 at `http://127.0.0.1:5173/` |
| Desktop visual review | Reviewed full-page English rendering at 1440 px; illustration and Zeyada heading loaded |
| Mobile visual review | Reviewed Burmese rendering at 375 px; no horizontal overflow; reduced motion honored |

The production JavaScript bundle is about 41 kB (11.8 kB gzipped), and CSS is about 11 kB (3.3 kB gzipped), excluding remotely delivered fonts and Google Identity Services. There are no runtime npm dependencies.

## Verified behavior

- Strict URL validation accepts supported YouTube routes and rejects spoofed hosts, non-video routes, unsafe schemes, credentials in URLs, and invalid IDs.
- SRT and WebVTT parsing removes cue timings, cue IDs, styling, inline time tags, and metadata while preserving spoken words, meaningful numbers, repeated captions, and Burmese Unicode.
- Real local file import produces readable text and a downloadable UTF-8 file with source attribution.
- Every dictionary key has an English and Burmese entry; browser tests verify static copy and dynamic errors switch immediately, including during an active request.
- Official request construction, Bearer authorization, track selection, VTT download conversion, optional video title lookup, and disconnect cleanup pass deterministic browser tests.
- Permission denial, missing videos, expired sessions, exhausted quota, upstream failures, empty tracks, popup cancellation, request cancellation, clipboard denial, invalid URLs, and malformed files have verified recovery paths.
- Keyboard access and reduced-motion preferences work; the tested mobile viewport does not overflow in either interface language.

## Verification boundaries

**Live Google retrieval was not credential-tested.** No OAuth client or authorized Google session was supplied. API/OAuth responses in browser integration tests are controlled fixtures installed by Playwright network interception; the production application contains no mock retrieval path. A real Google client, registered origin, requested-scope consent, and a captioned video the account can edit are required for the live acceptance checklist in [troubleshooting](TROUBLESHOOTING.md).

**GitHub Pages has not been published from this session.** The repository contains a deployment workflow and exact setup instructions; the Pages setting and public OAuth client variable still need configuration. No backend is required for the selected official browser OAuth architecture.

**Arbitrary public-video retrieval is intentionally unsupported.** The official API's edit-permission restriction remains in force; this application does not bypass it. Track availability and caption-download authorization remain controlled by Google.

Burmese interface copy is implemented throughout and visually inspected, but has not received an independent native-speaker editorial review. Third-party Google authorization dialogs follow Google's own language settings. Source video titles, creator-provided track names, filenames, and transcript content are preserved rather than translated.

Generated visual evidence is available after running browser tests at `test-results/desktop-english.png` and `test-results/mobile-burmese.png`; these generated files are intentionally ignored by Git.
