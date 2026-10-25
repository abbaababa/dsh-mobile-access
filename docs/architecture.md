# Architecture

## Components

```text
┌──────────────────────────── Mac (DSH Web process) ────────────────────────────┐
│                                                                              │
│  Host half (index.js)                                                        │
│    PairingService (service.js)  ── in-memory code, TTL, failures, locks      │
│    /m handler (routes.js)       ── pairing page + v1 cookie mint             │
│    /api/mobile-access/*         ── owner-only Fetch routes                   │
│    LanGateway (gateway.js)      ── optional 0.0.0.0:3081 for loopback DSH    │
│                                                                              │
│  Existing DSH core                                                           │
│    webServer exact-route table ── /m is matched before the SPA fallback      │
│    connection                  ── Host/Origin trust, authorizeIndex, Fetch   │
│                                                                              │
│  Client half (client.js)                                                     │
│    sidebar.panellist entry ── opens main panel                               │
│    main panel (key mobile-access) ── state, code, copy, rotate, self-test    │
└──────────────────────────────────────────────────────────────────────────────┘
                                │ same LAN, HTTP(S)
                                ▼
┌──────────────────────────── iPhone Safari ───────────────────────────────────┐
│  GET /m  → pairing page (public, CSP, no-store)                              │
│  POST /m → code check → 303 + Set-Cookie (HttpOnly) → /                      │
│  /       → existing DSH SPA, authenticated by the v1 cookie                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

The bundle has no runtime dependency on any other plugin. It consumes only
core services (`webServer`, `connection`, client `slots`, `locale`) and React
provided by the browser module table.

## Authentication sequence

1. `GET /m` applies `pairingHostAllowed`: the Host hostname must equal the
   listener's bind hostname (or be loopback); missing, unparsable, or foreign
   Host is `403`. This replaces the core Connection trust fence for this public
   page, because iOS 27 Safari's form POST was rejected by that fence while a
   same-origin curl POST succeeded.
2. The handler calls `connection.authorizeIndex(request, capture)` without a
   token:
   - `true` → a valid **v1 page cookie** exists → `303 ./`.
   - `false` and a captured `303 + Set-Cookie` → replay the cookie (defensive;
     this is the token path).
   - otherwise → render the pairing page with `200`. A `401` is never forwarded
     to Safari, so no HTTP auth dialog appears.
3. `POST /m` accepts only `application/x-www-form-urlencoded` and at most 2048
   bytes. It checks the hidden `nonce` against the `dsh-ma-pair` cookie with a
   constant-time compare before calling `PairingService.attempt`; a missing or
   mismatched nonce is `403`. Expiry, per-IP/global lockout, and rate limits are
   decided by the service. No `Sec-Fetch-Site` or `Origin` header is trusted for
   this public page.
4. On success the handler calls `connection.authenticatedUrl(origin + '/')`
   **server-side**, parses the token out of the returned URL, and calls
   `connection.authorizeIndex` with a synthetic `GET /?token=...`.
5. The captured `303` must contain `Set-Cookie`. Only that cookie is replayed on
   the real response, with `Location: /`. The launch token never reaches the
   browser address bar, history, or Referer.

A v2 API-only cookie is intentionally **not** treated as page authentication.
`authorizeIndex` is the sole v1 probe; `admit()` would accept v2 and was the
source of a redirect-loop bug in an earlier draft.

## Pairing state machine

```text
            rotate()
   ┌────────────────────────────┐
   ▼                            │
[READY] ── wrong code ──▶ [FAILING] ── 5/IP or 20 global ──▶ [LOCKED]
   │                            │                              │
   │ correct code               │ TTL elapsed                  │ rotate()
   ▼                            ▼                              ▼
[PAIRED] ◀──────────────── [EXPIRED] ── rotate() ────────── [READY]
```

- `PairingService` has no timers; time is injected (`now`) and evaluated on
  demand. This keeps tests deterministic and avoids idle work on the Mac.
- Code generation uses `crypto.getRandomValues` with rejection sampling to avoid
  modulo bias.
- Comparison is constant-time over equal-length UTF-8 buffers.

## Loopback LAN gateway

`dsh web` binds one concrete address; its default is `127.0.0.1`. When the
plugin sees a loopback `webServer.getOrigin()`, it starts `LanGateway` inside
the same host process. When the core is already LAN-bound, the gateway reports
`available: false` and opens no listener.

- Bind: `0.0.0.0`, preferred `3081`, then the next 10 ports, then port `0`.
- Target: the unchanged loopback DSH origin.
- HTTP: `http.request` with `Host`, `Origin`, and `Referer` rewritten to the
  target; hop-by-hop and client `x-forwarded-*` headers are removed; absolute
  `Location` is rewritten to the public origin; cookie `Domain` is stripped.
- WebSocket: only `/api/remote.mux`; a raw `GET` upgrade is forwarded to the
  loopback listener with the same header rewrite.
- Public origin: `http://<best LAN IPv4>:<actual port>`, preferring Wi-Fi then
  Ethernet and deprioritizing `utun`/Tailscale.
- Lifecycle: start/stop in the same `ctx.effect` as the routes; no DSH restart,
  no config write, and no change to the Mac's `127.0.0.1` URL.
- Failure: the listener rejects an unavailable gateway; the panel shows the
  error. Windows Firewall may need to allow Node.js on the private network.

## Route ownership

| Route | Owner | Matching | Auth |
|---|---|---|---|
| `/m` | this bundle | exact | public, Host/Origin fence, pairing code |
| `/api/mobile-access/state` | this bundle | exact | Connection owner-only |
| `/api/mobile-access/rotate` | this bundle | exact | Connection owner-only |
| `/` and SPA assets | DSH core | fallback | DSH core |
| `/api/...` others | DSH core | prefix/exact | DSH core |

No prefix route and no fallback route are registered. `webServer.register`
throws on a duplicate exact path; registration is ordered and cleaned up in
reverse.

## Client integration

- `sidebar.panellist` entry: id `mobile-access`, order `15`, phone icon.
- `main` panel: key `mobile-access`.
- The panel fetches state on mount, window focus, and visibility change only.
  There is no `setInterval` polling of the server; a local 1-second countdown
  updates the remaining time and stops at expiry.
- Locale dictionaries are registered under `dsh-mobile-access`; visible text is
  resolved through `ctx.locale.bind`, with a Chinese fallback.
- The only global mutation is an iOS/iPadOS, insecure-context clipboard
  fallback. It is installed in the plugin effect and restored on dispose.

## Failure isolation

- The host `apply` creates the service and registers all routes inside one
  `ctx.effect`; a registration failure disposes earlier registrations and
  rethrows so Cordis can report it without leaving half a route table.
- The client wraps locale/slot/clipboard registration in local guards. A failed
  optional feature logs and leaves the host UI running.
- Every timer, event listener, slot, and route has a cleanup path.

## Zero-Mac-impact invariants

1. No core source, profile config, auth secret, or existing route is modified.
2. No theme override, root replacement, or second app mount. The only injected
   CSS is the iOS/iPadOS-only 16px zoom guard, scoped to
   `(hover: none) and (pointer: coarse)`; no rule applies to Mac.
3. No service worker, cache rewrite, fetch monkey-patch, or WebSocket hook.
4. The LAN gateway starts only for a loopback-bound DSH; a LAN-bound DSH opens
   no extra listener. The Mac keeps its original URL and no idle timer runs.
5. All global mutations are iOS/iPadOS-only: the clipboard fallback, the
   programmatic-search focus guard, and the 16px zoom style. Each is restored or
   removed on dispose.
6. Uninstall disposes the three exact routes, the gateway listener, and the
   client slots; the DSH SPA fallback remains untouched.
