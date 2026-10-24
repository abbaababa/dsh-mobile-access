# Acceptance gates

Status as of 2026-10-24 20:56 +08:00: **G1–G6 PASS**, **G4.1 PASS** (npm
`1.0.3`), **G7 PARTIAL**, **G8 PARTIAL** (G8.1 items 1–3 confirmed by the user
on the physical iPhone; items 4–8 pending), **G9 baseline PASS** (interactive
Mac checklist pending), **G-R PASS** (no agent restart). G6 is confirmed by the
user on the physical iPhone 16 Pro Max (iOS 27) after the Host-pin + nonce fix;
G7 rotate via the live owner cookie and the full G8 functional checklist are
still pending. The live profile was migrated from the local link install to the
npm package `dsh-mobile-access@1.0.1` on 2026-10-24 20:22 +08:00, then to the
final npm `dsh-mobile-access@1.0.3` at 20:53 +08:00. `PENDING`/`PARTIAL` means
not fully executed.
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

Platform limits (not failures): desktop drag-and-drop, unrestricted filesystem
downloads, background execution, secure-context-only APIs.

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
| G3 | 2026-10-24 18:48 +08:00 | lead | `node --test tests/*.test.mjs` | 29 tests, 29 pass, 0 fail | PASS |
| G4 | 2026-10-24 18:48 +08:00 | lead | `npm pack --dry-run` | 13 files, 27.3 kB tarball, allowlist only | PASS |
| G4.1 | 2026-10-24 20:53 +08:00 | lead | official `dsh plugin` on live profile | dependency `1.0.3` (npm, not `link:`); installed manifest `1.0.3`; `dsh.profile.bundles` still ends with `dsh-mobile-access`; no existing dependency version changed | PASS |
| G5 | 2026-10-24 20:23 +08:00 | lead | `curl` live routes | `/m` 200 with `dsh-ma-pair` cookie + hidden nonce; state 401; `/` 401; POST with nonce + wrong code 200 “配对码不正确”; forged Host 403 | PASS |
| G6 | 2026-10-24 19:30 +08:00 | lead + user | live `/m` nonce probes + physical iPhone | GET 200 with `dsh-ma-pair` cookie + 36-hex hidden nonce; POST without nonce 403; foreign Host 403; user confirmed the 8-digit code was accepted on the physical iPhone 16 Pro Max (iOS 27) and pairing succeeded, with no launch token in the URL. | PASS |
| G7 | PARTIAL | lead + user | live owner state | The Mac panel displayed the live code, URL, and countdown, which exercises the owner-only `GET /api/mobile-access/state` through the browser session; a separate live `POST /rotate` observation is still pending | PARTIAL |
| G8 | PARTIAL | user | physical iPhone checklist | Pairing PASS; full SPA entry and remaining functional items in the G8 checklist not yet evidenced | PARTIAL |
| G8.1 | PARTIAL | user | iPhone Return-newline checklist | Client bundle npm `1.0.3` installed live; 29/29 tests pass; user confirmed on the physical iPhone that the built-in Return key inserts a line break and does not send. Items 4–8 (send-button preservation, menu, IME, Mac regression) not individually evidenced. | PARTIAL |
| G9 | 2026-10-24 20:24 +08:00 | lead | baseline + diff | `/` 401, `/api/health` 401, only listener `192.0.2.10:3080` (PID 76930 after user restart); profile patch unchanged; existing sidebar/main occupants unchanged; live npm install did not remove any registered slot; interactive Mac checklist pending | PASS (baseline) |
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
