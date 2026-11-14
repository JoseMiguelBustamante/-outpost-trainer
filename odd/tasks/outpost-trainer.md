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
- [ ] T6 — UI: game over + tutorial + storm visual feedback + tooltips + polish + Web Audio sounds (scope locked with user 2026-11-14)
- [ ] T7 — Science-behind-it page + build/deploy prep + presentation notes

## Evidence / commits

- T1: `1739cc7` chore: scaffold Vite + TypeScript + Three.js project — verified: `tsc --noEmit` OK, `vite build` OK
- T2: `14a5295` feat: 3D lunar scene — verified: `tsc --noEmit` OK, `vite build` OK, dev server serves page. NOTE: gentle-ai-worker bootstrap failed outside its safe root; implemented inline by parent (fallback declared). Visual check by user pending (run `npm run dev`).
- T3: `0262974` feat: core simulation loop — verified: vitest 16/16 (test-first: RED observed), tsc, vite build, server 200. Test-first applied: pure deterministic sim engine made RED→GREEN possible.
- T4: `abc85fe` feat: DONKI integration — verified: vitest 31/31 (test-first on mappers+scheduler), tsc, vite build, server 200. Live findings: DEMO_KEY rate-limited (50/day) and gateway returns 200 with error object -> hardened non-list detection; CORS confirmed open (*). Embedded real fallback (CME 336km/s 2026-10-25, Gannon GST Kp 9.0 2024-05-10). For demo day: register a free NASA API key to show live data.
