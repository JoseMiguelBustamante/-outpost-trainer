# Feature: Outpost Trainer (NASA Space Apps 2026)

Challenge: "Build a Junior Astronaut Mission Trainer"
https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/

## Pitch

A 3D browser game where kids 7-12 manage a lunar south-pole outpost: every solar
storm that hits the base is a real event from NASA's DONKI space weather database,
and every decision splits one shared power budget between shield, oxygen, and comms.

## Locked design decisions

- Mechanics (Core 4): hazard shield fed by real DONKI storms (CME/GST), solar
  panels with day/night battery drain, oxygen drain, 3D scanner for resource
  deposits. All consumers share ONE power source — no choice is free.
- Rejected for scope: inventory slots, crafting chains.
- Setting: lunar south pole (Artemis connection), accelerated 14-earth-day
  lunar night, no atmosphere so DONKI storms hit the shield directly.
- Stack: Vite + TypeScript + Three.js (low-poly cartoon), browser game,
  no download/account. DONKI cached to JSON with embedded fallback.
- DONKI API notes: real events have startTime, speed (CME), kpIndex (GST),
  linkedEvents cause-effect chains. Free key: 1000 req/h. FLR endpoint
  returned 404 via gateway (2026-11-14) — use notifications?type=FLR or
  linkedEvents as fallback.
- Judges criteria (per brief): real NASA data grounding, replayability,
  browser-playable, short dataset-explanation page.

## Tasks

- [x] T1 — Scaffold: Vite + TS + Three.js project, git repo, ODD docs (commit: 1739cc7)
- [x] T2 — 3D scene: lunar terrain, outpost base, lighting, orbit camera (commit: 14a5295)
- [x] T3 — Core sim: power budget, shield/oxygen/comms meters, day/night cycle (commit: 0262974)
- [x] T4 — DONKI integration: fetch + cache + event-to-gameplay mapping (commit: abc85fe)
- [ ] T5 — Scanner mechanic + resource deposits in 3D scene
- [~] T6 — UI: game over + tutorial + storm feedback + tooltips + sounds — CORE SHIPPED; visual direction + polish pending user artboard pick
- [x] T7 — Science page (/science.html, real DONKI mapping + fallback table), science links in tutorial/game-over, favicon + OG meta, presentation notes (docs/presentation.md) (commit: fecc143 + 0b29f51)

## Evidence / commits

- T1: `1739cc7` chore: scaffold Vite + TypeScript + Three.js project — verified: `tsc --noEmit` OK, `vite build` OK
- T2: `14a5295` feat: 3D lunar scene — verified: `tsc --noEmit` OK, `vite build` OK, dev server serves page. NOTE: gentle-ai-worker bootstrap failed outside its safe root; implemented inline by parent (fallback declared). Visual check by user pending (run `npm run dev`).
- T3: `0262974` feat: core simulation loop — verified: vitest 16/16 (test-first: RED observed), tsc, vite build, server 200. Test-first applied: pure deterministic sim engine made RED→GREEN possible.
- T4: `abc85fe` feat: DONKI integration — verified: vitest 31/31 (test-first on mappers+scheduler), tsc, vite build, server 200. Live findings: DEMO_KEY rate-limited (50/day) and gateway returns 200 with error object -> hardened non-list detection; CORS confirmed open (*). Embedded real fallback (CME 336km/s 2026-10-25, Gannon GST Kp 9.0 2024-05-10). For demo day: register a free NASA API key to show live data.
- L5 (2026-11-14): User requested T6 UI improvement, showing an AI-generated reference (mission banner, resource chips incl. AGUA/ALIMENTOS, bottom action bar). Decision: adopt visual language only (mission banner, compact meters, bottom action bar, storm feedback); reject water/food/crop mechanics — outside locked Core 4 scope. Design directions in design/outpost-hud-t6/ (01-mission-console, 02-kid-arcade, 03-focus-telemetry).
- L6 (2026-11-14): T6 implemented inline (artboard 01 Mission Console as working direction). Tutorial overlay at boot (sim paused), game over/victory overlay (oxygen|shield|survived) with storms survived + day summary, Web Audio synth sounds (storm alarm per DONKI event, harvest pop, defeat sting, victory arpeggio) unlocked on first gesture, mission banner, meter tooltips. Tests: 54 passing (9 new overlay helpers). Commit: 5a2c84b (T6 UI). Deployed, bundle verified live. Remaining T6: apply user's chosen artboard direction fully (01/02/03 pending their pick from /design-preview/) + polish.
- L7 (2026-11-14): T7 shipped. public/science.html (self-contained, dark tokens, real fallback storms 2026-10-25 CME 336 km/s / 2024-05-10 GST Kp 9.0 / 2024-05-11 GST Kp 7.7, mapping table, south-pole + power-budget sections, NASA DONKI credit). Science links added to tutorial + game-over overlays. index.html favicon + OG. docs/presentation.md (pitch, demo script, real-vs-simplified). Fix: Dockerfile now COPY public/ (science.html was falling back to SPA). All verified live: HTTP 200 own title, bundle has "View science". 54 tests passing throughout. Detail passes for base visuals: 68e41ca (pass 1), 149250f (pass 2, +102 meshes).
