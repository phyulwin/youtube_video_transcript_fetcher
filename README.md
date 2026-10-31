# YT Transcript Pigeon

A responsive black-and-white application that retrieves **available captions from YouTube videos the signed-in user can edit**, removes subtitle timing and markup, and exports attributed UTF-8 `.txt` files. English and Burmese are supported throughout the interface, including errors, accessibility names, status messages, and export labels.

**This is not an arbitrary-public-video transcript downloader.** A public YouTube link alone does not authorize caption downloading. The application clearly states this limitation before sign-in and provides local SRT/WebVTT import for material the user is permitted to use. Retrieval uses real Google endpoints; there is no production mock or demo transcript.

## Architecture and access decision

Research performed October 30, 2026:

| Option | Access and operational constraints | Decision |
| --- | --- | --- |
| Official YouTube Data API | OAuth required; caption download requires permission to edit the video; caption listing costs 50 quota units and download costs 200 | Implemented |
| Google Identity browser token model | Supports direct REST/CORS calls with short-lived tokens; no backend refresh token required | Implemented |
| Unofficial `youtube-transcript-api` | Undocumented retrieval; upstream changes and cloud-IP blocks; YouTube policies restrict scraping | Not integrated |
| Paid third-party transcript services | Provider credentials, cost, access guarantees, and content authorization must be evaluated individually; payment alone does not establish permission | Not assumed compliant or integrated |
| Local caption import | User supplies an authorized SRT/VTT file; no network or credentials needed for processing | Implemented |

The frontend runs on GitHub Pages. Google Identity Services issues a short-lived access token; the browser calls `captions.list`, `captions.download?tfmt=vtt`, and optionally `videos.list` directly. The app performs **GET requests only**. There is no server, database, transcription model, proxy, or backend hosting bill. GitHub Pages-only arbitrary-video scraping is neither implemented nor promised.

Sources:

- [Official caption download permissions, formats, and quota](https://developers.google.com/youtube/v3/docs/captions/download)
- [Official caption listing and quota](https://developers.google.com/youtube/v3/docs/captions/list)
- [Google browser OAuth token model and direct REST/CORS](https://developers.google.com/identity/oauth2/web/guides/use-token-model)
- [YouTube API developer policies, including scraping restrictions](https://developers.google.com/youtube/terms/developer-policies)
- [Unofficial library and its documented IP-blocking limitations](https://github.com/jdepoix/youtube-transcript-api)

## Local setup

Requirements: Node.js 20.19+ (Node 22 LTS recommended), npm, and a modern browser supporting `AbortSignal.any`, `Intl.DisplayNames`, and the File API. Development dependencies are pinned in `package-lock.json`; there are no runtime npm dependencies.

```powershell
# Install locked dependencies and create local configuration.
npm ci
Copy-Item .env.example .env.local
# Start the local application.
npm run dev
```

Open `http://127.0.0.1:5173`. The caption import workflow works immediately without an OAuth client: choose **Import captions**, paste the source YouTube URL, choose a valid `.srt` or `.vtt` file, and select **Clean up captions**. The source link is mandatory to preserve attribution; the optional video title is user-supplied for imported material.

For macOS/Linux, use `cp .env.example .env.local` instead of `Copy-Item`.

## Enable real YouTube retrieval

1. Create or select a project in [Google Cloud Console](https://console.cloud.google.com/), then enable **YouTube Data API v3**.
2. Configure Google Auth Platform branding, audience, and data access. During testing, add your Google account as a test user. Use the account/channel with caption-edit permission on your test video.
3. Add the scope `https://www.googleapis.com/auth/youtube.force-ssl`. Caption download requires this broad scope; the narrower read-only scope is insufficient. The app discloses the broader permission but only makes read requests.
4. Create an OAuth client with application type **Web application**. Add authorized JavaScript origins `http://127.0.0.1:5173` and, if used, `http://localhost:5173`. Add `http://127.0.0.1:4173` for a production preview. Origins contain scheme, host, and optional port, but **no path or trailing slash**. The popup token flow does not use an application redirect URI.
5. Set `VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com` in `.env.local`, then restart Vite. This identifier is public and is not a password.
6. In the app, accept the linked privacy notice and terms, select **Connect Google account**, grant the requested scope, and paste a video URL you can edit. Select **Find available captions**, choose an available language, then **Retrieve transcript**.
7. Review the text and source link, then download or copy it. Switching the interface language does not translate the source transcript.

Some YouTube Studio delegated roles or Brand Account configurations may not provide equivalent API permissions; test with the owning channel account if Google denies access. Existing public viewing access alone is insufficient. Auto-generated tracks appear only when Google's API exposes them as available; the app cannot force unavailable tracks to appear.

For public production use, complete any Google OAuth verification required for the requested sensitive scope, publish an accurate privacy notice and terms, and satisfy Google's application/domain requirements. Test mode is not a substitute for verification. Use a verified custom domain if required by Google; add its exact origin to the OAuth client and configure it for Pages. Public launch remains the deployment owner's responsibility.

## GitHub Pages deployment

1. Push the project to the repository's `main` branch, or adjust `.github/workflows/pages.yml` to your default branch.
2. In repository **Settings → Pages**, choose **GitHub Actions** as the build source.
3. Under **Settings → Secrets and variables → Actions → Variables**, add repository variable `VITE_GOOGLE_CLIENT_ID` containing your public OAuth client ID. Do not enter a client secret.
4. In Google Cloud, add `https://phyulwin.github.io` as an authorized JavaScript origin for this repository, or use your actual account/custom-domain origin. Do not append `/youtube_video_transcript_fetcher` to the origin.
5. Push to `main` or manually run **Deploy GitHub Pages**. The workflow installs dependencies, runs unit and browser tests, builds, and publishes `dist/`.
6. The expected project URL is `https://phyulwin.github.io/youtube_video_transcript_fetcher/` after a successful deployment. Verify the URL reported by Actions; this README is not evidence that publication has occurred.
7. Open that URL, test Google authorization with your permitted account, retrieve a known caption track, and verify its `.txt` export. If the client variable changes, rebuild and redeploy.

Relative asset URLs (`base: './'`) support repository Pages paths without rewrites. The app uses same-page anchors instead of history routing, so no SPA 404 workaround is needed. No backend deployment is required. Without the OAuth variable, the published app intentionally supports local import and displays a configuration notice for YouTube retrieval.

## Configuration and security

| Setting | Where | Secret? |
| --- | --- | --- |
| `VITE_GOOGLE_CLIENT_ID` | Local `.env.local`; GitHub Actions repository variable | No, embedded in public frontend |
| OAuth access token | Browser memory only; sent in Authorization headers to Google | Yes, ephemeral; never logged or persisted |
| OAuth client secret / refresh token | Not used | Never add these to frontend configuration |
| `PLAYWRIGHT_CHANNEL` | Test environment only | No; defaults to locally installed Microsoft Edge |

All `VITE_` variables are public build inputs. Environment files are ignored except `.env.example`. The app stores only the interface language in local storage. Caption contents, file data, and tokens stay in memory; disconnect clears the transcript, file input, and token. Reloading also clears memory. Downloaded files remain on the user's device. Disconnect does not revoke Google's underlying grant; the privacy panel links to Google account permission management for revocation.

No arbitrary URLs are fetched. Accepted hosts/routes are explicitly validated, and API calls use a fixed Google origin. Video titles and caption text are rendered with `textContent`/`value`, not interpreted as HTML. Caption imports are limited to 2 MB. Requests have a 20-second timeout and cancellation. There are no background refreshes, automatic retry loops, polling, analytics, or server caches. Fonts and Google sign-in depend on their providers; local file processing remains usable without loading those providers.

## Transcript behavior

- Watch, `youtu.be`, Shorts, live, and embed video links are accepted; playlists, spoofed hosts, credentials in URLs, unsupported schemes, and malformed IDs are rejected.
- A chosen track is downloaded once per explicit retrieval; optional video metadata supplies its title. If metadata fails, the canonical video link and ID preserve attribution.
- SRT/WebVTT cue IDs, cue timing, markup, inline timing, and VTT metadata are removed. HTML entities are decoded. Each caption cue becomes one line of plain text.
- Spoken numbers and times such as “meet at 10:30” are preserved, because they are transcript content. Intentional repetition is also preserved; overlapping automatic captions may consequently contain repeated words.
- There is no rewriting, summarization, translation, or audio transcription. UTF-8 preserves Burmese and other source languages.
- Downloads contain the title, canonical source video URL, selected caption language, and clean transcript. The transcript editor is read-only; copying exports the same attributed text.

## Verification

```powershell
# Verify parser, URL validation, API error mapping, and translation parity.
npm test
# Build static assets for production.
npm run build
# Run browser integration tests with installed Microsoft Edge.
npm run test:e2e
# Preview the production build locally.
npm run preview
```

If Edge is unavailable, install Playwright Chromium and set its channel:

```powershell
# Use Playwright's browser instead of system Edge.
npx playwright install chromium
$env:PLAYWRIGHT_CHANNEL = 'chromium'
npm run test:e2e
```

On macOS/Linux use `PLAYWRIGHT_CHANNEL=chromium npm run test:e2e`. CI installs Chromium automatically. Browser tests run a separate Vite process on port 4174 with a test-only client ID; Google requests are intercepted **only inside tests**, never in production code. Tests cover import, attribution, UTF-8 download, locale changes, validation, API request shape, language selection, access errors, token expiry, quota errors, cleanup, mobile layout, and reduced motion. Passing these tests does not establish live Google account permission or replace a credentialed acceptance test.

See [verification results](docs/VERIFICATION.md) and [troubleshooting](docs/TROUBLESHOOTING.md).

## Project layout

- `src/main.js`: UI and retrieval/import workflows.
- `src/google.js`: short-lived OAuth and official API requests.
- `src/core.js`: pure URL, subtitle, export, and error helpers.
- `src/i18n.js`: complete English/Burmese dictionaries.
- `src/style.css`: responsive layout, typography, and reduced-motion handling.
- `public/pigeon.svg`: original pigeon illustration.
- `tests/`: unit and browser integration tests.
- `.github/workflows/pages.yml`: automated GitHub Pages deployment.

The repository's existing Apache-2.0 license is preserved. Zeyada, DM Sans, and Noto Sans Myanmar are delivered by Google Fonts; fallback fonts keep the app usable if font delivery is blocked. YouTube and Google names belong to their respective owners; this application is independent.
