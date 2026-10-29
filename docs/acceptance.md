# Acceptance gates

Status as of 2026-10-28 12:45 +08:00: **G1–G6 PASS**, **G4.1 PASS** (npm
`1.1.9` installed; `1.1.1`–`1.1.9` are client-only over `1.1.0`, so a browser
refresh or tab reopen is enough and no host restart is required), **G7
PARTIAL**, **G8 PARTIAL** (G8.1 items 1–3 confirmed by the user on the physical
iPhone; G8.2 model-selector zoom/keyboard remains pending; G8.3 one-tap +
auto-collapse was confirmed by the user's “成功了” after `1.1.4`; G8.4 swipe
open + content-tap close is new in `1.1.7` and pending; G8.5 session-switch
keyboard dismissal is new in `1.1.8` and pending; G8.6 dark-mode white-block
fix is new in `1.1.9` and pending physical confirmation), **G9 baseline PASS**
(interactive Mac checklist pending), **G10 PARTIAL** (macOS loopback gateway
passed against an isolated DSH; Windows 10/11 pending), **G-R PASS** (no agent
restart). G6 is confirmed by the user on the physical iPhone 16 Pro Max
(iOS 27) after the Host-pin + nonce fix; G7 rotate via the live owner cookie
and the full G8 functional checklist are still pending. `PENDING`/`PARTIAL`
means not fully executed.
Never replace either with `PASS` without a command and an observed result.

## G1 — Static and type safety

Commands:

```bash
cd /path/to/dsh-mobile-access
node scripts/build.mjs --check
node --check index.js
node --check client.js
node --check routes.js
```

Pass: both commands exit 0; no TypeScript diagnostics; no syntax errors.

## G2 — Build reproducibility

```bash
node scripts/build.mjs
```

Pass: `[build] OK (...)`; six root artifacts exist; no `__DICT_*` or
`__PANEL_CSS__` placeholders.

## G3 — Unit tests

```bash
node --test tests/*.test.mjs
```

Pass: 0 failures. Coverage targets: code shape/normalization, constant-time
compare, loopback detection, success, 5/IP lock, 20 global, rate precedence,
expiry, rotation, GET page, v1 redirect, v2 loop prevention, POST success,
wrong code, cross-site, origin, content type, oversized body, untrusted host,
mint failure, state/rotate, registration cleanup.

## G4 — Package integrity

```bash
npm pack --dry-run
```

Pass: tarball contains only the `files` allowlist; no `src/`, `tests/`, `build/`,
`node_modules/`, evidence or secrets. `README.md` and `LICENSE` present.

## G4.1 — Official CLI install (npm)

```bash
DSH_HOME=/tmp/dsh-plugin-install-test7 \
  dsh plugin --profile web add dsh-mobile-access@latest \
  --registry=https://registry.npmjs.org/
```

Pass: fresh profile adds `dsh-mobile-access` to `dependencies`, appends it to
`dsh.profile.bundles`, and installs version `1.0.1`. Observed on 2026-10-24:
`+ dsh-mobile-access 1.0.1`, installed manifest version `1.0.1`, bundles
`[@deepseek-ai/dsh-base, @deepseek-ai/dsh-web-app, dsh-mobile-access]`.

Live profile migration (same official command, existing profile):

```bash
DSH_HOME=~/.dsh \
  dsh plugin --profile web add dsh-mobile-access@1.0.1 \
  --registry=https://registry.npmjs.org/
```

Observed 2026-10-24 20:22 +08:00: `dsh-mobile-access` dependency changed from
`link:/path/to/dsh-mobile-access` to `1.0.1`;
`node_modules/dsh-mobile-access` is now a real package directory (not a
symlink), installed manifest version `1.0.1`, `private` absent, bundle list
unchanged; `dsh --profile web --dump-config` exits 0 with only the four
pre-existing missing-patch warnings; `/m` 200, `/api/mobile-access/state` 401,
`/` 401. pnpm reported `Packages: +1 -126` (extraneous packages pruned) and
`Agent skills awaiting approval: @liustack/modlens`; no build script was
approved and no agent restart was performed.

Observed 2026-10-24 20:48 +08:00: the same official CLI installed the local
`dsh-mobile-access-1.0.3.tgz` into the live profile:
`dependencies['dsh-mobile-access'] = file:/.../dsh-mobile-access-1.0.3.tgz`,
`node_modules/dsh-mobile-access/package.json` version `1.0.3`, bundle list
unchanged. This is the iPhone Return-newline build; no restart was requested.
npm `1.0.3` was published with `PUT 202` and was still propagating at 20:50;
until it is visible, use the exact tarball or wait for `@latest`.

Note: the profile's default pnpm registry on this Mac is
`https://registry.npmmirror.com/`. On 2026-10-24 20:29 +08:00 a fresh
`@latest` install through that default still resolved `1.0.0`, while
`dsh-mobile-access@1.0.1` resolved `1.0.1`; the explicit npmjs registry above
also resolved `1.0.1`. Prefer the exact version for reproducibility until the
default cache refreshes. `1.0.0` contains the Safari nonce fix; `1.0.1` only
adds documentation and publish metadata.

## G5 — Route registration (live DSH)

After install:

```bash
curl -sS -D - -o /dev/null http://192.0.2.10:3080/m
curl -sS -D - -o /dev/null http://192.0.2.10:3080/api/mobile-access/state
```

Pass: `/m` returns `200` (pairing page) or `303` with a valid page cookie;
state returns `401` without owner cookie; neither returns `404`. No launch token
is printed.

## G6 — Pairing (live, iPhone or WebKit emulation)

1. Read the panel code.
2. GET `/m`; read the hidden `nonce` and the `dsh-ma-pair` cookie.
3. POST a form to `/m` with that code, the matching nonce, and
   `Content-Type: application/x-www-form-urlencoded`.
4. Pass: `303`, `Location: /`, one v1 `Set-Cookie`; no token in `Location` or
   body; a second GET `/` returns the SPA, not 401.
5. Wrong code: `200` HTML error page with a refreshed nonce; missing/non-matching
   nonce: `403`; after 5 failures: locked; after 10 requests/min: `429`.

## G7 — Owner-only state

With an authenticated page cookie:

- `GET /api/mobile-access/state` returns JSON `ok: true`, `pairUrl`, `bindHost`,
  `loopback`, `displayCode`, `expiresAt`.
- `POST /api/mobile-access/rotate` changes the code and resets failures.
- Without owner auth: `401`; with an untrusted Host: `403`.

## G8 — iPhone Safari functional checklist

Manual, on the physical iPhone 16 Pro Max (iOS 27):

- [ ] `/m` loads over the LAN address; no certificate warning on HTTP.
- [ ] 8-digit input has no zoom on focus; keyboard is numeric.
- [ ] Pairing redirects into the full DSH SPA.
- [ ] Left sidebar opens; the phone entry is visible and opens the panel.
- [ ] Panel shows bind host, port, code, countdown, pairing count.
- [ ] Copy link/code works or the fallback is reported honestly.
- [ ] Rotate code works; old code is rejected.
- [ ] Self-test reports clipboard/crypto/storage/websocket/viewport/network.
- [ ] Add to Home Screen; standalone launch reaches the app.
- [ ] New session, send a message, receive streaming output.
- [ ] Switch sidebar panels, open the right panel (auto-fullscreen), close it.
- [ ] Settings, model selection, history, file attachment/photo where available.
- [ ] **G8.3** Expand the sidebar so session titles are visible, then tap a
      different session title once; the conversation must switch on that first
      tap and the narrow sidebar must auto-collapse afterward. Mac must still
      switch on one mouse click and keep its sidebar state.
- [ ] **G8.4** On iPhone, with the sidebar collapsed, swipe right in the content
      area: the sidebar must open. Then tap the conversation content once: it
      must close. Tapping the sidebar column, a button/input/link/code block,
      a session row, or a model menu must not close it. Mac must be unaffected.
- [ ] **G8.5** With the input keyboard open, tap a different sidebar session
      once. The conversation must switch, the keyboard must close, and no
      keyboard may pop back up until you deliberately tap the composer.
      Mac must still keep its normal focus behavior.
- [ ] **G8.6** On iPhone/iPad in dark mode, open the Mobile Access panel. The
      `D` mark and the primary copy button must show readable dark text on the
      host's light primary surface; no blank white-on-white block may remain.
      Switch DSH to light mode: the same controls must still be readable and
      the panel must keep its normal light appearance. Mac must be unchanged.
- [ ] **G8.2** Tap the bottom-right model switcher: the page must not zoom;
      the model menu must stay fully visible; focusing its search field must not
      zoom either; model selection must complete. Mac must remain unchanged.
- [ ] Existing DSH features that rely on copy/login show no uncaught error.
- [ ] Backgrounding and returning keeps the session usable; reconnect if needed.
- [ ] No horizontal overflow at 390–430 CSS px; safe areas respected.
- [ ] **G8.1** In the official composer, type `第一行`, tap the iOS Return key,
      type `第二行`; the message must remain unsent with a visible line break.
      Tap the send button; the delivered prompt must contain both lines.
      Mac must still send on plain Enter and newline on Shift+Enter.

## G8.1 — iPhone built-in keyboard newline

Pass requires all of the following on the physical iPhone 16 Pro Max (iOS 27):

Status 2026-10-24 20:56 +08:00: the user confirmed the core behavior on the
physical iPhone after the `1.0.3` refresh — the built-in Return key inserts a
line break and does not send. Items 1–3 are therefore confirmed; items 4–8 have
not been individually evidenced and the gate remains **PARTIAL**.

1. Type a first line in the composer.
2. Tap the **built-in software keyboard Return key** once.
3. The cursor moves to a new line; no request is sent.
4. Type a second line; tap the visible send button.
5. The sent prompt preserves the line break.
6. With the command/reference menu open, Return still selects the menu item
   rather than inserting a newline.
7. With an IME composing text, Return commits the composition, not a newline.
8. On the Mac, plain Enter still sends and Shift+Enter still inserts a newline.

## G8.2 — iPhone model-selection zoom and keyboard

Status 2026-10-25 09:28 +08:00: **PENDING** physical-device confirmation for
`1.1.2`. The fix is client-only:

- on iPhone/iPad, a `@media (hover: none) and (pointer: coarse)` style forces
  editable controls (the 12px model searchbox and the 14px composer) to 16px and
  gives buttons/menu rows `touch-action: manipulation`, preventing iOS
  auto-zoom and keeping the fixed model menu inside the visual viewport;
- a programmatic focus of the model menu's `input[role="searchbox"]` is
  suppressed until the user deliberately taps that field, and tapping a composer
  menu trigger blurs the active field first, so the keyboard does not pop up
  automatically and the menu does not shift upward;
- Mac and non-Apple platforms are untouched.

Pass requires, after a page refresh on the physical iPhone 16 Pro Max (iOS 27):

1. Opening the bottom-right model switcher does **not** open the software
   keyboard and does not visibly shift the page;
2. The full model list is visible and a model can be selected with one hand;
3. Tapping the model search field deliberately **does** open the keyboard and
   allows typing;
4. Mac Enter still sends, Shift+Enter still inserts a newline, and the Mac model
   switcher behaves exactly as before.

Code-level tests: 32/32 pass. `1.1.2` is installed in the live profile; the live
host process PID 83750 is unchanged, so only a browser refresh is needed.

Platform limits (not failures): desktop drag-and-drop, unrestricted filesystem
downloads, background execution, secure-context-only APIs.

## G8.6 — iPhone dark-mode panel contrast

Status 2026-10-28 12:45 +08:00: **PENDING** physical-device confirmation for
`1.1.9`. The fix is client-only and changes styles only:

- the host's `--dsw-alias-brand-primary` is an inverting ink token
  (`#0f1115` in light, `#f9fafb` in dark), not a brand fill;
- the panel's `D` mark and `.dsh-ma-button.primary` now use the paired
  `--dsw-alias-label-primary-foreground` token instead of `color:#fff`;
  in dark mode the expected pair is background `rgb(249, 250, 251)` and text
  `rgb(15, 17, 21)`, a measured 18.08:1 contrast;
- `color-scheme` follows the host attribute `body[data-ds-dark-theme]`, not the
  operating-system setting; light mode resolves to the same `#fff` foreground
  and is visually unchanged.

Pass requires, after a full tab close/reopen on the physical iPhone 16 Pro Max
(iOS 27) in dark mode:

1. The `D` mark is a readable dark letter on the light tile, not a blank white
   square;
2. The primary copy button shows readable dark text, not a blank white pill;
3. Switching DSH to light mode keeps both controls readable and does not alter
   the light panel;
4. Mac dark/light appearance is unchanged.

Automated evidence: 35/35 tests pass; `npm run verify` PASS; the built
`client.js` contains two `--dsw-alias-label-primary-foreground` uses and zero
`color:#fff`. Expected in dark mode: computed `color: rgb(15, 17, 21)` on
`background-color: rgb(249, 250, 251)`.

## G9 — Mac zero-regression

Before install, capture:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' http://192.0.2.10:3080/
curl -sS -o /dev/null -w '%{http_code}\n' http://192.0.2.10:3080/api/health
```

Expected baseline: `401` and `401` without a session.

After install, on the Mac's existing authenticated browser:

- [ ] Existing DSH page loads; no new console errors.
- [ ] New session, send message, streaming, stop, model switch.
- [ ] Sidebar entries before/after: only `mobile-access` is added.
- [ ] Existing panels and right panel behave unchanged.
- [ ] Settings and plugin manager open; no layout shift or global CSS change.
- [ ] Copy controls elsewhere still work; clipboard descriptor unaffected
      (macOS is not iOS, so the fallback must not install).
- [ ] `/` and `/api/health` still return `401` for unauthenticated requests.
- [ ] No new idle CPU/timer activity when the panel is closed.
- [ ] Removing the bundle restores the exact pre-install behavior.

## G10 — Loopback-only DSH (LAN gateway)

Use an isolated `DSH_HOME` and a profile copy whose webserver binds
`127.0.0.1:3090`; never start a second copy against the live profile.

1. Start `dsh --profile web --no-open`; the official listener must be
   `127.0.0.1:3090`, and the plugin gateway must additionally listen on
   `*:3081`.
2. Open the printed token URL directly against `127.0.0.1:3090`; fetch
   `/api/mobile-access/state`; require `loopback: true`,
   `gateway.running: true`, `gateway.publicOrigin` = LAN IP:3081.
3. Load `/m` through the public gateway origin; require 200, a 36-character
   hidden `nonce`, and the `dsh-ma-pair` cookie.
4. POST the code + nonce through the gateway; require 303 `Location: /` with a
   v1 cookie and no launch token.
5. Load `/` and `/api/mobile-access/state` through the gateway with that cookie;
   require 200 for both.
6. Open the `/api/remote.mux` WebSocket through the gateway with the cookie;
   require the upgrade to open.
7. Repeat the HTTP checks on Windows 10 and Windows 11 with the firewall rule
   for the gateway port.

macOS 27 evidence (2026-10-24 21:52 +08:00, isolated profile
`/tmp/dsh-loopback-test`): steps 1–6 all passed; Windows 10/11 step 7 pending.

## G-R — Restart protocol

- [ ] Any restart was performed manually by the user.
- [ ] Agent notified immediately before waiting.
- [ ] Agent waited for an explicit “已重启”.
- [ ] No kill/pkill/killall/launchctl/reboot/shutdown/systemctl/dsh web command
      was run by the agent.

## Evidence log

| Gate | Date/time | Operator | Command | Observed | Result |
|---|---|---|---|---|---|
| G1 | 2026-10-24 18:48 +08:00 | lead | `npm run verify` | `[verify] typecheck` / `[build] typecheck PASS`; `node --check` all root artifacts exit 0 | PASS |
| G2 | 2026-10-24 18:48 +08:00 | lead | `npm run verify` | `[build] OK (index.js, service.js, routes.js, html.js, types.js, client.js)` | PASS |
| G3 | 2026-10-28 12:43 +08:00 | lead | `npm run verify` | 35 tests, 35 pass, 0 fail | PASS |
| G4 | 2026-10-28 12:43 +08:00 | lead | `npm pack --dry-run` | 15 files, 51.0 kB tarball, allowlist only | PASS |
| G4.1 | 2026-10-28 12:42 +08:00 | lead | official `dsh plugin` on live profile | dependency `1.1.9` (npm, not `link:`); installed manifest `1.1.9`; `dsh.profile.bundles` still ends with `dsh-mobile-access`; no existing dependency version changed; `1.1.9` is client-only over `1.1.0`, full tab close/reopen required, host process PID 2511 unchanged; installed `client.js` has two foreground-token uses and zero `color:#fff` | PASS (installed) |
| G5 | 2026-10-24 20:23 +08:00 | lead | `curl` live routes | `/m` 200 with `dsh-ma-pair` cookie + hidden nonce; state 401; `/` 401; POST with nonce + wrong code 200 “配对码不正确”; forged Host 403 | PASS |
| G6 | 2026-10-24 19:30 +08:00 | lead + user | live `/m` nonce probes + physical iPhone | GET 200 with `dsh-ma-pair` cookie + 36-hex hidden nonce; POST without nonce 403; foreign Host 403; user confirmed the 8-digit code was accepted on the physical iPhone 16 Pro Max (iOS 27) and pairing succeeded, with no launch token in the URL. | PASS |
| G7 | PARTIAL | lead + user | live owner state | The Mac panel displayed the live code, URL, and countdown, which exercises the owner-only `GET /api/mobile-access/state` through the browser session; a separate live `POST /rotate` observation is still pending | PARTIAL |
| G8 | PARTIAL | user | physical iPhone checklist | Pairing PASS; full SPA entry and remaining functional items in the G8 checklist not yet evidenced | PARTIAL |
| G8.1 | PARTIAL | user | iPhone Return-newline checklist | Client bundle npm `1.0.3` was installed when the user confirmed on the physical iPhone that the built-in Return key inserts a line break and does not send; npm `1.1.4` is now installed, client-only after a refresh. Items 4–8 (send-button preservation, menu, IME, Mac regression) not individually evidenced. | PARTIAL |
| G8.2 | PENDING | user | iPhone model-switcher zoom/keyboard checklist | `1.1.2` client-only guard installed; 32/32 tests pass; physical iPhone test after refresh pending: no auto keyboard, no upward shift, deliberate search tap opens keyboard, full model list usable. | PENDING |
| G8.3 | PASS | user | iPhone one-tap + auto-collapse sidebar switch | `1.1.4` synthesizes the session-row click on `touchend`, suppresses the duplicate native click, and collapses the sidebar after activation; `1.1.3`'s `tabIndex`-only approach failed the user's retest. 32/32 tests pass; user confirmed success after `1.1.4` on the physical iPhone. | PASS |
| G8.4 | PENDING | lead + user | iPhone swipe open + content-tap close | `1.1.10` fixes the swipe dying on card content: `button`/`a`/`[role="button"]` were on the block list and plan cards are wrapped in a `<button>`, covering ~89% of the circled area, so `touchstart` returned before a pending touch existed. Buttons now stay swipeable and the synthetic click on release is cancelled; leftward drags no longer open, `touchcancel` drops the pending touch, and `display-mode: standalone` counts as installed. 35/35 tests pass, including new card-button/left/vertical/slow/edge/multi-touch/cancel/PWA/click-suppression assertions; physical iPhone confirmation pending after a full tab close/reopen. | PENDING |
| G8.5 | PENDING | user | iPhone session-switch keyboard dismissal | `1.1.8` blurs a still-focused composer on session switch and suppresses a late programmatic composer focus for 800 ms; a deliberate composer tap still opens the keyboard. 33/33 tests pass; physical iPhone confirmation pending after a full tab close/reopen. Mac is untouched. | PENDING |
| G8.6 | PENDING | user | iPhone dark-mode panel contrast | `1.1.9` pairs the inverting brand fill with `--dsw-alias-label-primary-foreground`; dark expected `rgb(249,250,251)` background and `rgb(15,17,21)` text (18.08:1), no blank white-on-white mark/button. 35/35 tests pass; physical iPhone dark-mode confirmation pending after a full tab close/reopen. | PENDING |
| G9 | 2026-10-28 12:42 +08:00 | lead | baseline + diff after 1.1.9 install | `/` 401; `/m` 200 (nonce cookie + hidden nonce); only listener `127.0.0.1:3080` (PID 2511), no 3081 for the loopback core; installed manifest 1.1.9; profile bundle list unchanged; existing sidebar/main occupants unchanged; interactive Mac checklist pending | PASS (baseline) |
| G10 | 2026-10-24 21:52 +08:00 | lead | isolated loopback DSH | `127.0.0.1:3090` + gateway `*:3081`; state `loopback=true`, gateway running on `192.0.2.10:3081`; `/m` 200 nonce; code+nonce POST 303; gateway `/` and state 200; `/api/remote.mux` WebSocket opened; Windows 10/11 pending | PARTIAL (macOS PASS) |
| G-R | 2026-10-24 18:43 +08:00 | lead | install result | `application: applied`, no restart requested or performed; no restart command run | PASS |

### G5 live headers (abridged)

```text
GET /m
HTTP/1.1 200 OK
content-type: text/html; charset=utf-8
cache-control: no-store
referrer-policy: no-referrer
x-frame-options: DENY
content-security-policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'

GET /api/mobile-access/state
401

POST /m (cross-site)
403

GET /m (Host: evil.example)
403
```
