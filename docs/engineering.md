# Engineering plan and operating model

## Quality attributes

| Attribute | Target | Evidence |
|---|---|---|
| Correctness | Pairing succeeds with the current code; wrong/expired/locked codes fail closed | service + route tests |
| Security | No token in browser-visible URL/history/logs; owner-only API; bounded attempts | route tests, review checklist, live `/m` |
| Mac isolation | Only exact routes/slots added; no idle timers; no global mutation outside iOS clipboard fallback | static checks, code review, G9 |
| iPhone usability | 390–430 px layout, numeric keyboard, no focus zoom, countdown, copy fallback | manual iPhone checklist G8 |
| Reliability | Registration failure cleans up; no unhandled rejection | route tests, client guards |
| Maintainability | Strict TS, no `any`, modules < 500 lines, ADR/architecture/runbook | `tsc`, static tests, line counts |
| Portability | Node >= 22; only Web/Node globals, no new dependencies | `package.json`, build in clean shell |
| Operability | Deterministic logs, documented rollback, manual restart protocol | runbook, G-R |

## Work breakdown

| Phase | Deliverable | Exit criterion |
|---|---|---|
| P0 | Contract discovery | Services, slots, auth, route APIs verified from code/inspect |
| P1 | Domain | `PairingService`, constants, tests for lock/expiry/rate |
| P2 | HTTP | `/m`, state, rotate; auth + cookie mint; tests |
| P3 | Client | Sidebar + panel + self-test; no imports; build |
| P4 | Engineering | Build script, verify gate, docs, ADR, changelog |
| P5 | Install | plugin_manager install; no self-restart |
| P6 | Live verification | G5–G9 evidence, manual iPhone |
| P7 | Release | version/tag/changelog; rollback drill |

## Definition of done

- All G1–G4 gates pass locally.
- G5–G9 are executed with evidence; any `PENDING` is explicitly reported.
- No agent-run restart; G-R signed by the user’s “已重启”.
- `npm run verify` prints `[verify] PASS`.
- `npm pack --dry-run` contains only the allowlist.
- No known high-severity security issue; residual risks documented.
- README install/use/troubleshooting/uninstall is complete and matches behavior.

## SLOs

- Pairing page response: p95 < 50 ms on the LAN (single small HTML).
- State/rotate response: p95 < 20 ms.
- Pairing success path: one `authorizeIndex` call, no token in response URL.
- Idle work: zero timers/requests when the panel is closed.
- Error budget: 0 known functional failures in G1–G7 for release.

## Versioning

SemVer. The bundle is private (`1.0.0`). Breaking route or payload changes bump
major; additive UI/diagnostic changes bump minor; fixes bump patch. The protocol
version in the state payload is `version: 1`.

## Release checklist

1. `npm run verify` passes.
2. `docs/acceptance.md` updated with G1–G4 evidence.
3. Install via plugin manager; no self-restart.
4. G5–G9 executed; evidence recorded.
5. User confirms the Mac and iPhone checks.
6. Tag/version and changelog updated.
7. Rollback steps re-read and confirmed.

## Rollback drill

1. Remove the bundle in plugin manager.
2. Verify `/m` is SPA fallback, sidebar entry gone, Mac unchanged.
3. If a restart is required, notify and wait; never self-restart.
4. Reinstall from the same built directory to confirm repeatability.

## Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Core auth API changes | Medium | Pairing stops | Contract tests + compile against current DSH; document version |
| Safari cookie policy change | Low | Pairing loop | v1 probe + live iPhone test; no token in URL |
| LAN AP isolation | Medium | Phone cannot connect | Panel diagnostics; user network fix |
| Port/host change | Medium | Cookie authority mismatch | Panel shows bind host; re-pair at the new authority |
| Plugin manager requires restart | Medium | Feature not live | Stop, notify, wait for manual restart |
| Global clipboard patch regression | Low | Other copy controls break | iOS-only, descriptor restore, try/catch |
