# NUMBER SNAKE ARENA 🐍

**Version:** `v0.6.0`
**Status:** Lucky Wheel + Ultimate Boss + i18n Localization. Traditional Chinese (`zh-TW`) is the default language with clean storage fallback and seamless `繁中 | EN` toggle. Level 4 culminates in the procedural 6-reward Lucky Wheel and the Ultimate Boss 500 finale battle.

A web-based arcade game where you control a snake of numbers, growing by eating smaller numbers while avoiding larger ones.

## Gameplay & Features

* **Traditional Chinese Localization (`zh-TW`)**:
  * Clean launches default unconditionally to Traditional Chinese (`zh-TW`).
  * Instant, in-scene toggle between `繁中` and `EN` on the main menu without reloading the browser.
  * Centralized key dictionary ensures 100% key parity and seamless parameter substitution across all scenes and overlays.
  * Preserved `number_snake_language_v1` in `localStorage`.
* **Lucky Wheel Finale (`LuckyWheelOverlay`)**:
  * Unlocks immediately upon defeating Level 4 Boss 400.
  * Procedural 6-segment canvas wheel with deceleration physics and pointer alignment.
  * Six unique temporary rewards:
    * **A**: `+100` numeric value
    * **B**: `+150` numeric value
    * **C**: `+75` numeric value & Full HP recovery
    * **D**: `+75` numeric value & Boost 100 energy
    * **E**: `+75` numeric value & Magnet cooldown reset
    * **F**: `+200` numeric value & Full HP & Boost 100 energy (Jackpot!)
  * Strict single-spin guard; rewards do not increase body segments and do not pollute persistent progression.
* **Ultimate Boss 500 Finale Phase (`UltimateBoss`)**:
  * Follows the Lucky Wheel as the true climax of Level 4.
  * Distinctive dark purple core with rotating outer cosmic rings and dynamic threat aura.
  * Value: `500`. Diameter: `110px`.
  * Multi-state combat pattern:
    * **CHASE**: Normal cruising at 145 px/s toward the player.
    * **DASH**: 700ms telegraph warning line, then 280 px/s burst for 900ms.
    * **ORBIT**: 600ms telegraph expanding ring, then 190 px/s circling around the player for 1.5s.
    * **FLEE**: Immediate cancellation of attack states when player value exceeds 500.
  * Arena boundary containment: soft inward steering, Arcade world collision, and 100px hard margin clamp failsafe.
  * Joins live Arena Ranking, proudly holding the #1 gold crown until overtaken.
  * Defeating the Ultimate Boss awards +3000 points and triggers final clear victory.
* **Boss Boundary Protection & Containment**:
  * Soft inward steering and hard clamp failsafe keep all Bosses inside the playable 2400×1600 arena (`[-1100, 1100] × [-700, 700]`).
  * Dynamic off-screen locator (`▶ BOSS <value>` / `▶ 終極首領 500`) points toward off-screen bosses while safely avoiding HUD elements.
* **Arena Ranking & Top 5 Leaderboard**:
  * Real-time in-game leaderboard panel displaying the Top 5 snakes with gold crown indicator for #1.
* **Pre-Battle Start Value Boost (`PrepScene`)**:
  * Start value options: **STANDARD (5)**, **BOOST (7)**, **POWER (10)**.
* **Magnet Ability**:
  * 260px radius, 8s active duration, 20s cooldown.
  * Pulls strictly smaller edible prey and collectible body orbs.
* **Head Skin Customization**:
  * 6 Head Styles: `classic`, `bolt`, `mecha`, `dragon`, `flame`, `alien`.
* **Four Level Background Themes**:
  * Level 1: `neon-grid`
  * Level 2: `cyber-city`
  * Level 3: `lava-core`
  * Level 4: `deep-space`

## Progression Flow

```
Level 1 (Boss 100)
  ↓
Level 2 (Boss 200)
  ↓
Level 3 (Boss 300)
  ↓
Level 4 (Boss 400) → Lucky Wheel (6 Rewards) → Ultimate Boss 500 → FINAL CLEAR
```

* NO Level 5. Level 4 is the final stage.

| Level | Theme | Start | HP | Boss | Trigger | Enemy Value Max | Reward |
|---|---|---|---|---|---|---|---|
| 1 | neon-grid | 5 | 3 | 100 | 70 | 99 | +1 Heart / Unlock L2 |
| 2 | cyber-city | 5 | 4 | 200 | 150 | 199 | +1 Heart / Unlock L3 |
| 3 | lava-core | 5 | 5 | 300 | 230 | 299 | +1 Heart / Unlock L4 |
| 4 | deep-space | 5 | 6 | 400 | 310 | 399 | Lucky Wheel + Ultimate Boss 500 |

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
