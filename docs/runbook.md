# Operations runbook

## Scope

This runbook covers installation, pairing, diagnostics, rollback, and the
manual-restart protocol for `dsh-mobile-access`. It does not authorize any agent
to restart DSH, Node, macOS, SSH, the network, or a terminal.

## Preconditions

- DSH Web is running. It may be bound to a LAN address or to `127.0.0.1`.
- For a loopback-only DSH, the plugin's LAN gateway must be able to bind
  `0.0.0.0:3081` (10 fallback ports, then an ephemeral port). Allow Node.js on
  the private network in Windows Firewall on Windows 10/11.
- The Mac and iPhone are on the same LAN and can reach each other.
- The profile has `webServer` and `connection` services (official DSH Web).
- Node >= 22; this project builds with TypeScript 6.0.3 from the DSH checkout.

Check the listeners:

```bash
lsof -nP -iTCP:3080 -sTCP:LISTEN
lsof -nP -iTCP:3081 -sTCP:LISTEN
```

A LAN-bound DSH shows `3080` on the LAN address and no `3081`.
A loopback DSH shows `127.0.0.1:3080` and the plugin gateway on `*:3081`.

## Build and gate

```bash
cd /path/to/dsh-mobile-access
node scripts/build.mjs --check
node scripts/build.mjs
node --test tests/*.test.mjs
```

The full gate is `npm run verify`; it must print `[verify] PASS`.

## Install

Install the **absolute directory** through the DSH plugin manager
(`install_bundle`). Do not copy files into the profile by hand.

After installation:

1. Check the plugin manager result. If it says `restart-required`, stop and
   notify the user immediately.
2. Wait for the user to restart manually and confirm “已重启”.
3. Do not run `dsh web`, `kill`, `pkill`, `killall`, `launchctl`, `reboot`, or
   `shutdown` yourself.

## First pairing

1. Open the DSH Web on the Mac; click the phone icon in the left sidebar.
2. Confirm the panel shows a LAN URL and an 8-digit code.
3. On iPhone Safari, open the `/m` URL.
4. Enter the code. Success: redirect to `/` and the normal DSH SPA.
5. Optionally add to Home Screen.

## Diagnostics

| Symptom | Check | Action |
|---|---|---|
| iPhone cannot connect | `lsof -nP -iTCP:3080 -sTCP:LISTEN` | If only `127.0.0.1`, fix `webserver.host`; user restarts manually |
| `/m` shows DSH 401 text, not pairing page | Route not registered / wrong path | Check plugin install result and exact route `/m` |
| `/m` loads but code always invalid | Code expired or panel stale | Click 「刷新配对码」 and retry |
| Locked | 5 failures/IP or 20 global | Rotate code in panel; do not wait for auto-unlock |
| Redirects back to `/m` after pairing | Cookie blocked or authority changed | Allow cookies; use the exact same host:port shown in panel |
| Panel state fetch 401/403 | Page not authenticated or API route not owner | Re-pair; check `connection` service; inspect plugin logs |
| State shows loopback | DSH binds `127.0.0.1` | Change bind host; user restarts manually |
| Copy does nothing on iPhone | Clipboard fallback unavailable | Long-press to copy; run panel self-test |

Useful non-destructive checks:

```bash
curl -sS -D - -o /dev/null http://192.0.2.10:3080/m
curl -sS -D - -o /dev/null http://192.0.2.10:3080/api/mobile-access/state
```

Expected: `/m` returns `200` (or `303` with a valid page cookie); the state route
returns `401` without an owner cookie. Both prove the routes exist without
printing secrets.

## Logs

The host logs only event labels, never codes/tokens/cookies:

```bash
# Adjust the log location to the current DSH launch method.
# Look for [mobile-access] lines.
```

Do not search profile credential stores, browser cookies, or personal data for
tokens. If a cookie-mint failure appears, capture the generic error and inspect
the DSH `connection` service, not the token.

## Rollback

1. Remove `dsh-mobile-access` in the plugin manager.
2. If removal requires a restart, notify the user and wait for “已重启”.
3. Verify:
   - sidebar entry is gone;
   - `/m` is handled by the SPA fallback again;
   - `/api/mobile-access/state` is no longer registered;
   - Mac DSH still opens, chats, and switches panels normally.

No profile backup restore is required for a normal removal. If the profile
itself was modified outside this runbook, restore the timestamped backup only
with user approval.

## Manual restart protocol (binding)

Any restart is user-owned:

1. Agent immediately notifies the user that a restart is needed and why.
2. Agent stops and waits.
3. User restarts manually.
4. User says “已重启”.
5. Agent resumes verification.

Agents must never self-restart or treat a prior approval as restart permission.

## Evidence

Record each live gate in `docs/acceptance.md` with:

- date/time and operator;
- exact command;
- observed output (redact secrets);
- pass/fail;
- if fail, the remediation and a second observation.
