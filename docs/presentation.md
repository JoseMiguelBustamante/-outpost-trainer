# Lunar Outpost Trainer — judge presentation

## 25-second elevator pitch

“What if your first Moon mission ran on real NASA storms? Lunar Outpost Trainer is a browser game for junior astronauts aged seven to twelve. Balance one battery between oxygen, shields, and communications, scan for resources, and survive the night. NASA DONKI events power the challenges, an embedded real dataset keeps them available offline, and every replay lets you test a new engineering tradeoff.”

## Three-step demo

1. **Start mission.** Open the game in a browser, point out the tutorial's science link, then press **Start mission**. Show the shared power budget: giving one system more means another gets less. No account or download is needed.
2. **Storm hits.** When the storm banner appears, point to its NASA event ID. Increase shield power while keeping oxygen supplied. Explain that a real event provides the input, while damage and timing are designed for a short game.
3. **Scan and survive.** Press **SCAN**, then tap a revealed deposit to collect resources. Manage power through the night. At the mission result, show **View science** for the source records and **Retry mission** for another strategy; a fresh seed can change storm order. If time is short, describe the survival goal rather than promising an instant win.

## What is real

- NASA DONKI (Space Weather Database Of Notifications, Knowledge, Information) provides CME and geomagnetic storm records: <https://kauai.ccmc.gsfc.nasa.gov/DONKI/>.
- The live mapper uses CME speed in km/s and peak GST Kp index to set severity. The banner retains the source event ID. CME speeds of 400–2,000 km/s map to 0.35–3.5 shield damage/s (clamped); GST peak Kp 5–9 maps to the same range. We skip GSTs below Kp 5.
- The embedded fallback contains CME `2026-10-25T03:12:00-CME-001` at **336 km/s**, GST `2024-05-10T15:00:00-GST-001` at **Kp 9.0**, and GST `2024-05-11T00:00:00-GST-001` at **Kp 7.67**, displayed as 7.7. Fallback damage and durations are curated game values, not live-mapper outputs.
- A shared energy budget teaches a real engineering principle: limited energy forces competing life-support, protection, and communications priorities.

## What is simplified

- This is a learning game, not a lunar hazard model or operational forecast. A fictional shield loses game points; those values are not radiation doses.
- GST Kp measures Earth's geomagnetic disturbance, not conditions at the Moon. We reuse it as a difficulty proxy. A CME is not a solid wave striking a force field.
- Real event dates identify the source; the scheduler does not replay calendar intervals. A seeded shuffle places up to four events after a safe opening period. Travel, storm durations, and day/night timing are compressed.
- Roughly 14 Earth days of night is a teaching approximation; south-pole illumination varies with terrain and season. Artemis is the exploration connection, not a claim of NASA endorsement.
- Oxygen recycling, solar charging, scanning, and resource collection are deliberately simplified. There are no detailed habitat, communications, geology, or spacecraft models.
- The fallback is an embedded historical dataset, not fresh weather. It makes storms available if DONKI fails, but it does not make an unvisited game load offline: serving or previously loading the app is still required.

## Delivery notes

- Keep `/science.html` alongside the built game; it is a self-contained page with no external scripts or assets. Links from the tutorial and mission result open it in a new tab, leaving the mission available.
- Before presenting, load the deployed game and check the tutorial, storm banner, scanner, mission result, and science-page link. If the live API is unreachable or rate-limited, explain the embedded data openly.
- Data credit: **Space weather data: NASA DONKI (CCMC)**. Game built with TypeScript, Three.js, and Vite for NASA Space Apps 2026.
- **Team / credits:** [Add team name, member names, roles, and any additional acknowledgments before presenting.]
