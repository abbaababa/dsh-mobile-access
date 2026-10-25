# Security model and threat notes

## Assets

- DSH launch token: per-process, server-side only. Never placed in a phone URL.
- DSH v1 page cookie: HttpOnly, SameSite=Strict, authority-bound, HMAC-signed.
- Pairing code: 8 digits, in memory, short-lived.
- Owner-only state: code, expiry, bind address, pairing counts.

## Trust boundaries

1. **Network**: the LAN is not trusted. Any host can reach `/m` and attempt
   codes; the API routes are behind Connection's Host/Origin fence and owner
   authentication.
2. **Browser**: the pairing page is public but cannot read the code from the
   server; the code is displayed only in the authenticated Mac panel.
3. **Process**: the host half runs in the DSH process and uses core services; it
   does not import private modules or write credentials.

## Threats and mitigations

| Threat | Mitigation |
|---|---|
| Brute-force the 8-digit code | 5 failures/IP, 20 global, 10 attempts/min/IP, 10-min TTL; constant-time compare |
| Cross-site form POST | One-time nonce cookie (`dsh-ma-pair`, `Path=/m`, `SameSite=Strict`, 10 min) must match the hidden form field; `Content-Type` must be form-urlencoded |
| Token leak via URL/history/Referer | Token used only server-side; 303 Location is `/`; `Referrer-Policy: no-referrer` |
| Token leak via logs | Pairing success logs only `pair.success`; cookie-mint errors are logged without token/URL; tests assert token absence |
| Clickjacking / framing | `X-Frame-Options: DENY`, CSP `frame-ancestors 'none'`, `default-src 'none'` |
| MIME sniffing | `X-Content-Type-Options: nosniff` |
| Oversized body / memory abuse | 2048-byte body cap; 413 response |
| Method abuse | Exact method checks; 405 with `Allow` |
| Untrusted Host / DNS rebinding | `pairingHostAllowed` requires the Host hostname to equal the listener bind hostname or be loopback; mismatches get 403 |
| v2-only cookie redirect loop | `/m` probes `authorizeIndex` (v1) and never uses `admit()` for page auth |
| Clipboard compatibility regression | iOS/iPadOS + insecure context only; restore original descriptor on dispose; never throws |
| Mac regression | Exact routes only, no global CSS/root/fetch/service-worker changes; no idle timers |

## Pairing page trust model

The public `/m` page is intentionally outside Connection's `/api` fence. On
iOS 27 Safari its form POST was rejected by `connection.requestRejection` with
the generic 403 page even though a same-origin `curl` POST succeeded, so the
page uses two narrower controls instead:

- **Host pin**: the `Host` hostname must equal the listener's bind hostname or
  be a loopback spelling. This blocks DNS-rebinding pages from using the route.
- **Double-submit nonce**: GET `/m` mints a 36-hex nonce, stores it in an
  `HttpOnly`, `SameSite=Strict`, `Path=/m` cookie, and embeds it in the form.
  POST requires the body nonce to match the cookie in constant time before the
  pair code is checked. A cross-site form cannot read the page or the cookie.
- The 8-digit pair code remains the authorization secret; it is never sent to
  the phone by the page, and the existing per-IP/global limits still apply.

## Rate limiting details

- Window: 60 seconds per source IP.
- Limit: 10 requests per window, checked before lockout.
- Failures: 5 per IP; 20 globally per code.
- On rate: `429` plus `Retry-After` (seconds, minimum 1).
- On invalid/locked/expired: `200` HTML error page (not `401`), avoiding Safari's
  native authentication dialog.

## Cookie handling

- The bundle never constructs the cookie by hand. It uses
  `connection.authenticatedUrl` + `connection.authorizeIndex` and replays the
  `Set-Cookie` emitted by the core.
- The v1 cookie is authority-bound by DSH. Pairing from
  `http://192.0.2.10:3080/m` does not authorize
  `http://openmacbook-pro.tailcc0cfb.ts.net:3080/` or a different port.
- No cookie is written to disk by this plugin.

## Loopback LAN gateway

For a loopback-only DSH, `gateway.js` listens on `0.0.0.0` and forwards to the
fixed loopback origin. It is an exposure amplifier by design: every device on
the reachable LAN can reach the same DSH authentication surface.

- The gateway does not implement its own auth. Pairing, cookies, and the DSH
  Connection trust fence still decide access; the gateway only rewrites
  `Host`/`Origin`/`Referer` to the loopback target.
- It forwards only HTTP and the `/api/remote.mux` WebSocket path; other upgrade
  paths get `404`.
- It strips hop-by-hop and client-supplied `x-forwarded-*` headers, rewrites
  absolute redirects to the public origin, and removes cookie `Domain`
  attributes so the browser keeps a host-only cookie.
- It never proxies to a user-supplied target; the target is fixed at plugin
  startup from `webServer.getOrigin()`.
- Plain HTTP is visible on the LAN. Do not use the gateway on a hostile network;
  use a trusted TLS setup instead.
- On Windows, allow Node.js only on the private network in Windows Firewall.
- The listener is disposed with the plugin effect.

## Residual risks

- A user who shares the 8-digit code with an attacker on the same LAN grants
  access for the lifetime of the cookie. The code is a bearer secret; rotate it
  when in doubt.
- LAN traffic over plain HTTP is visible to an on-path attacker. Use a trusted
  HTTPS certificate if the LAN is hostile. This plugin does not weaken or
  replace DSH's TLS options.
- iOS treats the app as a browser tab/PWA; anyone with the unlocked phone can
  use the authenticated session.
- A compromised Mac process can read the in-memory code. This is outside the
  plugin's threat model.

## Audit events

Emitted only through the DSH logger when present:

- `[mobile-access] pair.success`
- `[mobile-access] pair.cookie_mint_failed: <generic error>`
- client registration failures with a component label

No code, token, cookie, IP, or body is logged by this bundle.
