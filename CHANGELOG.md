# Changelog

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
