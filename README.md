# Number Snake Arena v0.2.3

No gameplay change. Release reproducibility / E2E deterministic closeout.

A web-based arcade game where you control a snake of numbers, growing by eating smaller numbers while avoiding larger ones.

## Gameplay

* **Grow**: Eat numbers strictly smaller than your current value to grow.
* **Survive**: Touching a larger number causes you to lose HP and shrink.
* **Role Reversal**: If you grow larger than a previously dangerous number, it will start fleeing from you!
* **Combo**: Eat numbers in quick succession to build a multiplier and grow faster.
* **Boost**: Hold Spacebar or the virtual Boost button to consume boost energy for a burst of speed.
* **Level Progression**: Complete levels by growing and defeating the Boss.

## Levels

* **Level Select**: Unlock levels as you play.
* **Level 1**: Start at value 5, 3 Hearts. Grow to 70+ to summon Boss 100. Grow beyond 100 to eat the Boss!
* **First Clear Reward**: Defeating Boss 100 for the first time grants +1 permanent Max Heart.
* **Level 2**: Unlocks after Level 1. Start at value 5 with 4 Hearts. Grow to 150+ to summon Boss 200. Grow beyond 200 to eat the Boss!
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
