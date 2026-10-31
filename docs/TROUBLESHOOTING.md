# Troubleshooting

| Symptom | Resolution |
| --- | --- |
| Google sign-in is not configured | Set the public `VITE_GOOGLE_CLIENT_ID`, restart the dev server or rebuild Pages. Local caption import still works. |
| `origin_mismatch` in Google's popup | Register the exact browser origin, including local port, in the Web application OAuth client. Do not include a Pages repository path. Google configuration updates may take time. |
| Google popup will not open | Allow popups for this site; retry from the Connect button. Check that privacy extensions permit `accounts.google.com`. |
| Sign-in library could not load | Check connectivity/extensions and reload the page before reconnecting. Local import requires no Google connection. |
| Google app is unverified / access denied | Add the account as a test user during testing, or complete the necessary verification for production. Use the correct project's client ID. |
| Broad permissions prompt | Google's caption download endpoint requires `youtube.force-ssl`; the app explains this and makes only GET requests. Decline and use authorized local files if you do not want to grant it. |
| Public video's captions cannot be retrieved | Public viewing permission is insufficient. Use an account with edit permission, or import a caption file you are authorized to use. A backend or API key alone cannot remove this restriction. |
| Channel manager still receives 403 | Try the owning channel account; Studio delegation may not give the same API rights. Check scope consent and selected Brand Account. |
| No available caption tracks | Captions may not exist, may be drafts/processing, or may not be exposed by the API. Try a known published creator-uploaded track. The app does not generate captions. |
| API is not enabled | Enable YouTube Data API v3 in the same Google Cloud project as the OAuth client. |
| Quota exhausted | Review project quota in Google Cloud. Listing costs 50 units; downloading costs 200, plus the metadata request. Avoid repeated requests; wait for the quota reset or request additional quota through Google. |
| Session expired | Reconnect from the button. The app intentionally stores no refresh token and does not silently reauthorize. |
| Request timed out / offline | Restore connectivity and retry. Requests time out after 20 seconds; Cancel stops in-flight requests without a retry loop. |
| Caption file rejected | Use UTF-8 `.srt` or `.vtt` with actual timing/cue blocks, no larger than 2 MB. Arbitrary text, JSON, TTML, and audio are unsupported. |
| Repeated words in automatic captions | Some source tracks contain overlapping rolling captions. The app preserves their wording instead of guessing which repetitions to delete. |
| Clock references remain | Spoken references like “at 10:30” are content. Only subtitle timing metadata is removed. |
| Copy failed | Permit clipboard access on the HTTPS site or manually copy the automatically selected transcript; download remains available. |
| Burmese letters look incorrect | Use a modern browser with Unicode Burmese support. Allow Google Fonts or install Noto Sans Myanmar locally. Legacy Zawgyi encoding is not converted. |
| Switching languages leaves video title unchanged | Video titles, creator-provided track names, filenames, and transcript words are source content, not interface strings; they are intentionally preserved. |
| Pages assets return 404 | Deploy `dist/` through the included workflow, retain `base: './'`, and verify the actual Pages URL. Do not serve the source `index.html` directly. |
| CI browser fails to launch | Keep the Playwright browser installation step; locally install Chromium and set `PLAYWRIGHT_CHANNEL=chromium`, or use installed Edge. |
| Port 4174 is occupied | Stop the other process or change both `baseURL` and the test server port in `playwright.config.js`. |

## Credentialed acceptance checklist

1. Configure a real OAuth Web application client and register the deployment's exact origin.
2. Publish or select a video you own with at least one serving caption track, preferably two languages.
3. Grant the requested scope, retrieve each language, compare text with the source captions, and verify the downloaded Unicode file and source attribution.
4. Try a video you cannot edit; confirm the app reports the permission limitation rather than inventing a transcript.
5. Revoke access through Google's permissions page and verify that reconnection is required.
6. Repeat on the published Pages URL and on a mobile browser.

For support, report the visible error category, browser, and whether local or deployed. Never share access tokens, cookies, OAuth secrets, or private caption contents.
