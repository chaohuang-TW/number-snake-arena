# NUMBER SNAKE ARENA 🐍

**Version:** `v0.5.0`
**Status:** Arena & Progression Release: 4 playable levels, live Arena ranking, gold crown leader indicator, pre-battle start value boost, score & best presentation, magnet ability, skin customization, dynamic themes.

A web-based arcade game where you control a snake of numbers, growing by eating smaller numbers while avoiding larger ones.

## Gameplay & Features

* **Grow**: Eat numbers strictly smaller than your current value to grow.
* **Survive**: Touching a larger number causes you to lose HP and shrink.
* **Role Reversal**: If you grow larger than a previously dangerous number, it will start fleeing from you!
* **Combo**: Eat numbers in quick succession to build a multiplier and grow faster.
* **Boost**: Hold Spacebar or the virtual Boost button to consume boost energy for a burst of speed.
* **Arena Ranking & Top 5 Leaderboard**:
  * Real-time in-game leaderboard panel displaying the Top 5 snakes by numeric value.
  * If the player falls outside the Top 5, an additional 6th row dynamically displays the player's current rank and value.
  * AI snakes are assigned persistent arena callsigns (`NOVA`, `BYTE`, `VOLT`, `TITAN`, `CYBER`, etc.).
  * Bosses dynamically join arena rankings (e.g. `BOSS 100`, `BOSS 200`, `BOSS 300`, `BOSS 400`).
* **Gold Crown (`crown_gold`)**:
  * Procedurally rendered gold crown indicator displayed beside the #1 snake in the leaderboard.
  * Gold crown floats dynamically above the #1 arena leader's head in the game world, smoothly transferring whenever the leader changes.
  * Automatically hidden on victory/game over end screens and scene shutdowns.
* **Pre-Battle Start Value Boost (`PrepScene`)**:
  * Preparation screen between Level Select and battle start.
  * Start value options: **STANDARD (5)**, **BOOST (7)**, **POWER (10)**.
  * Defaults safely to 5.
  * Run-only boost: does not alter permanent progression or baseline level definitions.
  * Death/respawn (`hardReset()`) restores player to the selected `runStartValue`.
* **Score & Best Record Presentation**:
  * Live HUD displays current run Score alongside personal Level Best (`BEST: X`).
  * Victory and Game Over end screens display final Score and Level Best.
  * Highlighting gold `NEW BEST!` banner on setting a new personal record.
  * Idempotent score persistence preventing duplicate submissions per run.
* **Magnet Ability**:
  * **Pull Radius**: 260px radius
  * **Duration**: 8s active duration
  * **Cooldown**: 20s cooldown
  * Draws strictly smaller edible prey (380 px/s) and collectible body orbs (480 px/s) toward the player's head.
  * Equal or larger snakes, out-of-range snakes, and Bosses are immune.
  * Desktop trigger via 'M' key; mobile trigger via HUD virtual button.
* **Head-to-Head Consumption & Collectible Body Orbs**:
  * Consuming an edible enemy snake spawns collectible body orbs from defeated segments.
  * **Score**: +10 score
  * **Boost**: +2 boost
  * **Value**: 0 Value gain (preserves player value)
  * Lifetime: 11000 ms, maximum 80 active orbs.
* **Head Skin Customization**:
  * **6 Head Styles**: `classic`, `bolt`, `mecha`, `dragon`, `flame`, `alien`.
  * Dedicated Customize UI with persistent selection in `localStorage`.
  * AI snakes spawn dynamically with all 6 styles while preserving threat aura rings (green edible, red dangerous).
* **Tapered Tail**: Anatomical tapered tail rendering for player and AI snakes using scaling curves (down to 0.50x).
* **Four Level Background Themes**:
  * Level 1: `neon-grid`
  * Level 2: `cyber-city`
  * Level 3: `lava-core`
  * Level 4: `deep-space`
* **Level Progression**: Complete levels by growing and defeating the Boss.

## Levels & Progression

| Level | Theme | Start | HP | Boss | Trigger | Enemy Value Max | Reward |
|---|---|---|---|---|---|---|---|
| 1 | neon-grid | 5 | 3 | 100 | 70 | 99 | +1 Heart / Unlock L2 |
| 2 | cyber-city | 5 | 4 | 200 | 150 | 199 | +1 Heart / Unlock L3 |
| 3 | lava-core | 5 | 5 | 300 | 230 | 299 | +1 Heart / Unlock L4 |
| 4 | deep-space | 5 | 6 | 400 | 310 | 399 | Final Clear |

* **LocalStorage Progression**: Your unlocked levels, cosmetics, and per-level high scores are saved automatically to your browser.

## Deferred Features (NOT in v0.5.0)

* **Lucky Wheel**: Deferred to future release.
* **Ultimate Final Boss**: Deferred to future release.
* **Level 5**: Deferred to future release.

## Controls

* **Keyboard**: W/A/S/D or Arrow Keys to move. Spacebar to Boost. 'M' to activate Magnet.
* **Touch/Mobile**: Drag anywhere on the left side of the screen for a virtual joystick. Tap BOOST or MAGNET on the right to trigger abilities.

## Development

```bash
npm install
npm run dev
npm run test      # run unit tests
npm run test:e2e  # run E2E tests (requires running dev server on localhost:3000)
npm run build
```
