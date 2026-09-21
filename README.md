# NUMBER SNAKE ARENA 🐍

**Version:** `v0.4.0`
**Status:** Snake Evolution: 4 playable levels, full progression, magnet ability, skin customization, dynamic themes.

A web-based arcade game where you control a snake of numbers, growing by eating smaller numbers while avoiding larger ones.

## Gameplay

* **Grow**: Eat numbers strictly smaller than your current value to grow.
* **Survive**: Touching a larger number causes you to lose HP and shrink.
* **Role Reversal**: If you grow larger than a previously dangerous number, it will start fleeing from you!
* **Combo**: Eat numbers in quick succession to build a multiplier and grow faster.
* **Boost**: Hold Spacebar or the virtual Boost button to consume boost energy for a burst of speed.
* **Magnet Ability**: Press 'M' (or the mobile HUD Magnet button) to draw smaller edible prey and collectible orbs toward your head.
* **Collectible Body Orbs**: Eaten snakes drop energy orbs that restore boost and score without altering numeric value.
* **Level Progression**: Complete levels by growing and defeating the Boss.

## Levels & Themes

| Level | Theme | Start | HP | Boss | Trigger | Enemy Value Max | Reward |
|---|---|---|---|---|---|---|---|
| 1 | Neon Grid | 5 | 3 | 100 | 70 | 99 | +1 Heart / Unlock L2 |
| 2 | Cyber City | 5 | 4 | 200 | 150 | 199 | +1 Heart / Unlock L3 |
| 3 | Lava Core | 5 | 5 | 300 | 230 | 299 | +1 Heart / Unlock L4 |
| 4 | Deep Space | 5 | 6 | 400 | 310 | 399 | Final Clear |

* **LocalStorage Progression**: Your progression, skin cosmetics, and per-level best scores are automatically saved to your browser.

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

## Number Snake Arena v0.4.0

### Snake Evolution Release
* **Magnet Ability**: Active ability with 260px pull radius, 8s duration, 20s cooldown, animated electric aura, attracting edible enemies and orbs. Triggerable via 'M' key or mobile HUD virtual button.
* **Tapered Tail**: Anatomical tapered tail rendering for player and AI snakes using scaling curves and distinct tail sprites.
* **Head Skin Customization**: 6 distinct procedural head styles (`classic`, `bolt`, `mecha`, `dragon`, `flame`, `alien`) with dedicated `CustomizeScene` and persistent selection.
* **AI Snake Variety**: AI snakes spawn with varied head skins, 5-segment visual bodies, tapered tails, and dynamic threat aura rings (green/orange/red).
* **Head-to-Head Consumption & Body Orbs**: Consuming an edible enemy snake spawns collectible body orbs yielding +10 score and +2 boost.
* **Four Level Background Themes**: Procedural themed visual backgrounds across Levels 1–4 (`neon-grid`, `cyber-city`, `lava-core`, `deep-space`).
