# 3. Non-functional requirements

Quality attributes the system must meet. Each has a measurable target and the
way it is verified. Categories follow ISO/IEC 25010.

- [Performance](#performance)
- [Reliability and availability](#reliability-and-availability)
- [Security and privacy](#security-and-privacy)
- [Usability](#usability)
- [Accessibility](#accessibility)
- [Compatibility and portability](#compatibility-and-portability)
- [Scalability](#scalability)
- [Maintainability](#maintainability)
- [Localisation](#localisation)
- [Operational limits](#operational-limits)

---

## Performance

| ID | Requirement | Target | Verified by |
|----|-------------|--------|-------------|
| NFR-P1 | Local feedback of a stroke or edit | Drawn in the same frame as the input (optimistic, no network wait) | Manual test, profiler |
| NFR-P2 | Propagation of a change to other participants | < 300 ms on a normal connection, server processing < 10 ms per op | `analitics/` load lab |
| NFR-P3 | Canvas frame rate while drawing, panning and zooming | 60 fps on a mid-range Android phone and desktop browser with 1,000 elements | Perf HUD, performance kit |
| NFR-P4 | Time to first stroke on launch | < 2 s on the offline board (no network) | Manual test |
| NFR-P5 | Joining a live board | Full board state in one `joined` message; < 1 s for typical boards | Smoke test |
| NFR-P6 | Persistence latency | Changes written to the database within 1 s (write-behind) | `check:persistence` |
| NFR-P7 | Idle memory | Boards with no connection evicted from memory after ~5 min and reloaded on demand | `check:persistence` |

## Reliability and availability

| ID | Requirement |
|----|-------------|
| NFR-R1 | No user work shall be lost on a connection drop: a live board turns read-only while offline and reconnects automatically. |
| NFR-R2 | Operations are idempotent; applying an op twice (echo, reconnect) shall not duplicate elements. |
| NFR-R3 | The server is the single source of truth; a diverged client shall be resynced with the full board. |
| NFR-R4 | Liveness: clients ping every 20 s; silent sockets are dropped; the server exposes `/health` for the host's health check. |
| NFR-R5 | The offline board shall work with no server at all. |
| NFR-R6 | A slow start of the hosted server (cold start) shall be explained to the user (*Taking longer than usual…*) with a retry. |
| NFR-R7 | AI provider failures shall not affect the board; the request fails with a message and nothing is added. |

## Security and privacy

| ID | Requirement |
|----|-------------|
| NFR-S1 | Passwords and PINs are stored only as salted **scrypt** hashes; neither is ever returned to a client. Board metadata exposes only `hasPin`. |
| NFR-S2 | Board tokens are HMAC-SHA256 signed, bound to one board, expire after 12 h, and are compared in constant time. |
| NFR-S3 | Permissions are enforced on the **server** (defence in depth); hiding tools on the client is only a convenience. |
| NFR-S4 | Every incoming field is validated and bounded; unknown fields are dropped. |
| NFR-S5 | Rate limits: 10 board creations/hour/IP; 5 PIN attempts/minute/IP/board; 60 op messages/second/user; 10 AI requests/minute; sign-in, registration and code requests limited per IP. |
| NFR-S6 | WebSocket messages are capped at 256 KB. |
| NFR-S7 | CORS restricted to the deployed web origin in production; all traffic over HTTPS/WSS. |
| NFR-S8 | Privacy by default: no account required to draw; the offline board never leaves the device unless the user shares it; the camera position is never transmitted. |
| NFR-S9 | Secrets (token secret, database URL, AI key) live only in server environment variables, never in clients or the repository. |

## Usability

| ID | Requirement |
|----|-------------|
| NFR-U1 | A first-time user shall be able to draw without reading anything (zero-step start). |
| NFR-U2 | A first-time user shall be able to share a board without help (success criterion of the product). |
| NFR-U3 | An account is requested only at the moment it unlocks something, with the reason stated. |
| NFR-U4 | The options strip shows only what applies to the current tool; rarely used actions live in the menu. |
| NFR-U5 | Every menu and sheet is reachable, dismissable (close button, back, drag down, Esc) and predictable. |
| NFR-U6 | Web and Android share one mental model: the same controls in the same places, the same names. |
| NFR-U7 | Destructive actions (clear, delete) require confirmation and say what will happen. |
| NFR-U8 | Wording uses no jargon: the audience goes from children to older teachers. |

## Accessibility

| ID | Requirement |
|----|-------------|
| NFR-A1 | Touch targets ≥ 44 × 44 px on touch devices. |
| NFR-A2 | Text in UI chrome meets WCAG 2.1 AA contrast (4.5:1) in light and dark themes; panels are opaque so contrast never depends on the drawing beneath. |
| NFR-A3 | [W] Every control is keyboard operable, with a visible 2 px focus ring; icon buttons expose a name (tooltip and accessible label). |
| NFR-A4 | Colour is never the only carrier of meaning: status dots are paired with text (*1 online*, *Offline*). |
| NFR-A5 | Motion is short and functional; no essential information is conveyed only by animation. |

## Compatibility and portability

| ID | Requirement |
|----|-------------|
| NFR-C1 | Web: last two versions of Chrome, Edge, Firefox and Safari, desktop and mobile; iPhone/iPad users are served by the web app. |
| NFR-C2 | Android: phones and tablets, portrait and landscape. |
| NFR-C3 | Boards created on one client open identically on the other (shared data model and protocol). |
| NFR-C4 | Exported PNG/JPG remain normal images for any viewer while carrying the editable board. |
| NFR-C5 | The server runs on any Node 22 host; MongoDB is optional for local runs (`MEMORY_ONLY`). |

## Scalability

| ID | Requirement |
|----|-------------|
| NFR-SC1 | One server instance shall support ~100 concurrent users across live boards. |
| NFR-SC2 | A board holds up to 5,000 elements. |
| NFR-SC3 | Scaling out is planned through a Redis broadcast channel, Redis rate limits and sticky routing by board id; MongoDB stays the source of truth. |

## Maintainability

| ID | Requirement |
|----|-------------|
| NFR-M1 | The three projects share only the wire contract; each keeps its own copy of the types, changed together. |
| NFR-M2 | Store, geometry, export and canvas logic mirrored between web and Android shall receive every fix on both. |
| NFR-M3 | Design tokens are defined once per client (`mobile/src/constants/theme.ts`, `web/src/index.css`, `web/src/lib/theme.ts`) and kept in sync. |
| NFR-M4 | Components follow atomic design: atoms, molecules, organisms, templates. |
| NFR-M5 | Type checking and smoke tests pass before every release; all three projects share one version number. |
| NFR-M6 | Every change is recorded in each project's `CHANGELOG.md`; every feature has a design note in `docs/plans/`. |

## Localisation

| ID | Requirement |
|----|-------------|
| NFR-L1 | All UI text is translated into Spanish (default) and English; the language can be changed at any time without reload. |
| NFR-L2 | No string is hard-coded in components; all come from the string table. |

## Operational limits

| Limit | Value |
|-------|-------|
| Elements per board | 5,000 |
| Text length | 2,000 characters |
| Nickname | 40 characters |
| Board name | 80 characters |
| Username | 3–24 characters |
| Password | ≥ 8 characters |
| New boards | 10 per hour per address |
| Wrong PIN attempts | 5 per minute |
| AI drawings | 10 per minute, ≤ 200 elements, 60 s timeout |
| Pasted image | ~256 KB after shrinking |
| Undo history | 100 steps |
| Zoom | 10 %–2,000 % |
| Timer | up to 3 hours |
