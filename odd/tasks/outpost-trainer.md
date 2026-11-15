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

## Tasks (T8 — playability, added 2026-11-14)
- [ ] T8a — Playable astronaut: joystick (mobile) + WASD (desktop), walk on terrain, camera follows, collect deposits by proximity
- [ ] T8b — Honest power UI: sliders adjust to sum 100, effective allocation shown
- [ ] T8c — Management juice: deposits glow/beacon stronger, collect feedback burst, mini-objectives

## Log
- L8 (2026-11-14): User (verbatim): "No veo la jugabilidad o como tiene que ser lit no se puede hacer más que darle click y nada más. Astronauta no puede moverse. Estadísticas de power yo las puedo mover no sé si está correcto". Decision (ask_user_choice): "Ambos" — playable astronaut walking to collect deposits + reinforced management loop with feedback. Sliders confirmed mechanically correct (sim renormalizes) but UI dishonest about effective allocation.
- L9 (2026-11-14): User playtest bugs (verbatim): "Cosas que corregir: no hay Colision con las casas. No puedo avanzar sobre el mapa, no se va la ola lit nada" + screenshots showing fractional slider labels (60.52083333333333%) and persistent "Storm in progress" banner. T8a fixes required: structure collision, touch movement reliability, storm banner duration audit, slider integer rounding (sum stays exactly 100).
- L10 (2026-11-14): L9 fixes shipped (commit f0aab7f): outpost exports 8 collider circles (main dome, greenhouse, habitat x2, solar x2, antenna, rover) with slide-out collision + movement substeps; joystick hardened (pointer capture, stopPropagation, dead-zone, multi-touch pointerId); storm "in progress" banner gated by sim state (stormRemaining) + 90s display cap (audit: real CME/GST durations are 8-28s, mapping correct — the banner bug was schedule-based display, not duration); integer power allocation via largest-remainder (labels always sum 100). 75 tests passing (4 new regressions). Deployed, bundle index-BAyg2gBZ verified.
- L11 (2026-11-14): User feedback (verbatim): "No sé ve la tormenta solo el mensaje. Además ese power me regenera no debería de ser así debería de ser con los recuersos que uno encuentra y construcciones que las regeneran. Y también continua con la etapa 1". Approved: T9 Ola 1 starts NOW + two new requirements: (a) visual storm in 3D scene, (b) meters regen consumes collected materials (buildings-based passive regen arrives with Ola 2 modules). Battery stays solar-driven (that IS the power-budget lesson).
- L12 (2026-11-14): T9 Ola 1 shipped (commits 948fe10, fbeb4a2, cf1d324): (a) 3D storm visuals — 500-particle dust field, sky/fog tint lerp 1.5s, wind drift scaled by intensity (CME 1420 km/s → 0.87), reduced-motion halves particles; (b) materials economy — regen consumes 1 material per 2 meter points, stops at 0, 9 deposits yield 33.75 materials, fallback-storm run costs ~66.7% (22.5), materials chip 🧪 in HUD with crit <15; (c) staged missions — 3 stages (Establish 3 deposits → Sustain crew oxygen≥60 + survive storm → Survive emergency 3 storms/victory) with once-only material rewards +15/+15/+20, objectives banner with progress + 4s celebrations; (d) science logbook 📖 — deterministic named discoveries (Cyan Knoll...), storm/stage entries, day timestamps, 50-entry modal, Escape closes, pauses game; (e) Guided/Challenge difficulty — drains ×0.6 vs ×1.4, repair cost ×0.7 guided, chosen in tutorial. 96 tests passing (7 new difficulty + economy + chips + missions). Deployed, bundle index-D6XDQfGK verified live.

## Tasks (T9 Ola 2 — progression, approved 2026-11-14)
- [x] T9-D — Placeable modules shipped (Battery Bank 20🧪 cap 140, Recycler 25🧪 +0.8 O2/s, Pylon 20🧪 +0.5 shield/s no decay)
- [x] T9-E — Rover repair shipped (10🧪, SCAN radius ×2, smoke removed, cyan headlight)
- L13 (2026-11-14): T9 Ola 2 shipped (commit 2954b08): 3 holographic build slots on the pad — Battery Bank (-7,0,0), Recycler (3.7,0,-2.6), Shield Pylon (2.2,0,4.3), clear of colliders/chevrons; costs 20/25/20 🧪; passives stack independent of material-funded regen; battery capacity 140 after bank; proximity BUILD/REPAIR prompts with disabled state; rover smoke removed + headlight + SCAN radius 55→110 on repair; built modules add 0.65-radius colliders; retry fully resets wave-2 state; 9 new sim tests (105 total). Deployed, bundle index-C6QqDosA verified live (Battery Bank + Repair rover strings present).
- L14 (2026-11-14): User: "Avanza con la 3 y los textos en español". Approved: T9 Ola 3 (badges, suit cosmetics, victory showcase) + full Spanish localization of game UI (explicit user language override for artifacts) and science page.
