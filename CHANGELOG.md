## 1.1.9 — 2026-10-28

- Fix the iPhone/iPad dark-mode white blocks in the Mobile Access panel. The
  host's `--dsw-alias-brand-primary` is an inverting ink token (`#0f1115` in
  light, `#f9fafb` in dark), not a brand fill. The mark and primary copy button
  used it as a background while forcing `color:#fff`, producing white-on-white
  1.05:1 text. Both now use the paired
  `--dsw-alias-label-primary-foreground` token (18.08:1 in dark), and
  `color-scheme` follows the host's `body[data-ds-dark-theme]` attribute.
- Add static regression assertions that every brand-filled surface is paired
  with its foreground token and that no `color:#fff` remains in the panel.
  Light mode is unchanged (the light foreground token resolves to `#fff`).

## 1.1.8 — 2026-10-25

- Dismiss the iPhone/iPad keyboard when a sidebar session switch happens.
  Blur any still-focused composer and suppress a late programmatic composer
  focus for 800 ms, while a deliberate composer tap is still allowed.
  The guard is iOS-only and leaves Mac/Windows desktop behavior unchanged.

## 1.1.7 — 2026-10-25

- Change the iPhone sidebar closing gesture: a tap in the conversation content
  closes an expanded sidebar; left swipe no longer collapses it. Right swipe
  still opens a collapsed rail. Interactive controls, session rows, code blocks,
  menus and the right panel are ignored, and Mac is untouched.

## 1.1.6 — 2026-10-25

- Add iOS/iPadOS horizontal sidebar swipes: right opens the collapsed rail,
  left closes the expanded sidebar. The gesture is scoped to content, ignores
  vertical scroll/editable/menu/code targets, avoids Safari edge navigation in
  a normal tab, and never installs on Mac.
- Add a swipe regression test and update the static client contract.

## 1.1.5 — 2026-10-25

- Allow the public `/m` pairing page through Tailscale Serve when the request
  arrives from a loopback peer, carries a Tailscale identity header
  (`tailscale-user-login` or `tailscale-user-name`), and its Host ends in
  `.ts.net`. Direct loopback and DNS-rebinding protections remain unchanged.
- `trustedHosts` in the live profile must include the current tailnet hostname
  for the authenticated SPA/API; this is a profile config change, not a plugin
  code change.

# Changelog

## 1.1.4 — 2026-10-25

- Make iPhone/iPad session switching reliably one-tap: on `touchend` the
  plugin synthesizes the session row's click, suppresses the duplicate native
  click, and collapses the narrow sidebar after the switch. This replaces the
  `1.1.3` approach that only removed `tabindex` and still required two taps on
  some iOS Safari versions. The change is installed only on Apple mobile
  devices; Mac and keyboard users are untouched. 32/32 tests pass.

## 1.1.3 — 2026-10-25

- Make the first tap on an iPhone/iPad session row activate that session.
  Safari treats a click on the focusable `role="treeitem"` row (official
  `tabIndex={0}`) as a focus step before dispatching `click`; the plugin now
  removes that one attribute during the touch and restores it 400 ms later.
  Session rows also receive `touch-action: manipulation` so the legacy
  double-tap-zoom delay cannot consume the tap. The patch is installed only on
  Apple mobile devices; Mac and keyboard users are untouched. 32/32 tests pass.

## 1.1.2 — 2026-10-25

- Stop the iPhone software keyboard from opening automatically when the
  bottom-right model switcher is tapped. On iOS/iPadOS only, a programmatic
  focus of the model menu's `input[role="searchbox"]` is suppressed until the
  user deliberately taps that field; tapping a composer menu trigger also
  blurs the active composer field first. The model menu therefore opens without
  the keyboard and does not shift upward. Native taps, search typing, and Mac
  behavior are preserved. 32/32 tests pass.

## 1.1.1 — 2026-10-24

- Stop iOS Safari from auto-zooming when the bottom-right model switcher or
  its 12px search field receives focus. On iPhone/iPad only, an injected
  `@media (hover: none) and (pointer: coarse)` rule forces editable controls
  (inputs, textarea, select, contenteditable, the composer, and the model
  searchbox) to 16px, and gives buttons/menu rows `touch-action: manipulation`.
  This keeps the fixed-position model menu inside the visual viewport and
  leaves Mac and non-Apple platforms untouched. 32/32 tests pass.

## 1.1.0 — 2026-10-24

- Add an automatic LAN gateway for a DSH instance bound only to `127.0.0.1`
  (macOS 27, Windows 10/11). The official listener and the Mac URL stay
  unchanged; the plugin opens a separate IPv4 listener on `3081` (10 fallback
  ports, then an ephemeral port), proxies HTTP, and proxies only the
  `/api/remote.mux` WebSocket upgrade. Host/Origin/Referer are rewritten to the
  loopback target so the existing Connection trust fence and cookie authority
  keep working; absolute redirects and cookie `Domain` attributes are rewritten
  for the LAN origin. The pairing page and panel use the public LAN URL, and the
  panel reports gateway state/errors. LAN-bound DSH opens no extra listener.
  Never starts or restarts DSH itself. 32/32 tests pass.

## 1.0.3 — 2026-10-24

- Harden the iPhone Return-newline hook: after redefining `shiftKey` to the
  Shift+Enter value, verify it actually took effect; if Safari ignores or
  rejects the redefinition, fall back to `execCommand('insertLineBreak')`
  (then `insertText('\n')`) with `preventDefault`/`stopImmediatePropagation`.
  This keeps Return as newline even on engines that do not allow shadowing the
  native keyboard-event getter. 29/29 tests pass.

## 1.0.2 — 2026-10-24

- On iPhone/iPad, plain Return in the official composer now inserts a line break
  instead of sending, so the iOS 27 built-in keyboard can compose multiline
  prompts. Sending remains available through the visible send button; an
  external keyboard can use Cmd+Enter. Mac and non-Apple platforms are not
  affected. Implemented with an iOS-only capture-phase listener that presents
  plain Return as Shift+Enter to Lexical (DSH's native line-break path) and is
  removed when the plugin is disposed. 29/29 tests pass.
- No change to pairing, authentication, routes, cookies, or the Mac UI.

## 1.0.1 — 2026-10-24

- Publish `dsh-mobile-access@1.0.1` to the public npm registry so the official
  one-command install works: `dsh plugin --profile web add dsh-mobile-access@latest`.
- Document the official CLI, local-directory, and tarball install paths in the
  package README. No runtime, authentication, or pairing behavior changed.

## 1.0.0 — 2026-10-24

- Fix iPhone 16 Pro Max / iOS 27 Safari pairing POST being rejected by the DSH
  Connection trust fence: `/m` now uses a listener-Host pin plus a one-time
  double-submit nonce cookie. The pair code, v1 cookie mint, rate limits, and
  token-never-in-URL behavior are unchanged. Live reinstall applied without a
  restart; 29 tests pass.
- Independent TypeScript DSH bundle `dsh-mobile-access`.
- Public `/m` pairing page: 8-digit CSPRNG code, 10-minute TTL, per-IP and
  global lockout, rate limit, Host/Origin/content-type/body-size checks.
- Server-side v1 cookie mint via `authorizeIndex`; launch token never appears in
  the browser URL, history, or Referer.
- Owner-only `GET /api/mobile-access/state` and `POST /api/mobile-access/rotate`.
- Left-sidebar phone entry and `mobile-access` main panel with LAN URL, code,
  countdown, copy fallback, rotate, diagnostics, and self-test.
- iOS/iPadOS-only insecure-context clipboard fallback, restored on dispose.
- Exact routes only; no core/config/auth edits; no global CSS, service worker,
  root replacement, or idle polling.
- Engineering gates: strict TypeScript, build script, service/route/static
  tests, `scripts/verify.sh`, README, architecture, security, runbook,
  acceptance matrix, risk register.
