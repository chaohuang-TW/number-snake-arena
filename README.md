# NUMBER SNAKE ARENA 🐍

**Version:** `v0.3.3`
**Status:** Four playable levels, full progression system.

A web-based arcade game where you control a snake of numbers, growing by eating smaller numbers while avoiding larger ones.

## Gameplay

* **Grow**: Eat numbers strictly smaller than your current value to grow.
* **Survive**: Touching a larger number causes you to lose HP and shrink.
* **Role Reversal**: If you grow larger than a previously dangerous number, it will start fleeing from you!
* **Combo**: Eat numbers in quick succession to build a multiplier and grow faster.
* **Boost**: Hold Spacebar or the virtual Boost button to consume boost energy for a burst of speed.
* **Level Progression**: Complete levels by growing and defeating the Boss.

## Levels

| Level | Start | HP | Boss | Trigger | Enemy Value Max | Reward |
|---|---|---|---|---|---|---|
| 1 | 5 | 3 | 100 | 70 | 99 | +1 Heart / Unlock L2 |
| 2 | 5 | 4 | 200 | 150 | 199 | +1 Heart / Unlock L3 |
| 3 | 5 | 5 | 300 | 230 | 299 | +1 Heart / Unlock L4 |
| 4 | 5 | 6 | 400 | 310 | 399 | Final Clear |

* **LocalStorage Progression**: Your progression and per-level best scores are automatically saved to your browser.

## Controls

* **Keyboard**: W/A/S/D or Arrow Keys to move. Spacebar to Boost.
* **Touch/Mobile**: Drag anywhere on the left side of the screen for a virtual joystick. Tap the BOOST button on the right to speed up.

## Development

```bash
npm install
npm run dev
npm run test      # run unit tests
npm run test:e2e  # run E2E tests (requires running dev server on localhost:3000)
npm run build
```

## Number Snake Arena v0.3.3

Release procedure closeout only.

No gameplay changes.

No test logic changes.

No intended gameplay balance changes.

No Level 5.
