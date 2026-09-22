# NUMBER SNAKE ARENA 🐍

**Version:** `v0.4.1`
**Status:** Snake Evolution Release Closeout: 4 playable levels, full progression, magnet ability, skin customization, dynamic themes.

A web-based arcade game where you control a snake of numbers, growing by eating smaller numbers while avoiding larger ones.

## Gameplay & Features

* **Grow**: Eat numbers strictly smaller than your current value to grow.
* **Survive**: Touching a larger number causes you to lose HP and shrink.
* **Role Reversal**: If you grow larger than a previously dangerous number, it will start fleeing from you!
* **Combo**: Eat numbers in quick succession to build a multiplier and grow faster.
* **Boost**: Hold Spacebar or the virtual Boost button to consume boost energy for a burst of speed.
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

* **LocalStorage Progression**: Your progression, skin cosmetics, and per-level best scores are automatically saved to your browser.

## Deferred / Not Implemented Yet

* No leaderboard yet
* No gold crown yet
* No pre-battle upgrade yet
* No Lucky Wheel yet
* No Ultimate Boss yet
* No Level 5

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
