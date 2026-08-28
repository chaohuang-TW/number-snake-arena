# Number Snake Arena v0.2.0

A modern HTML5 arcade game where you play as a number snake. Eat smaller numbers to grow, avoid larger numbers to survive. Features dynamic role reversal where hunters become prey as you grow!

## Live Demo

Play the game now: [https://chaohuang-TW.github.io/number-snake-arena/](https://chaohuang-TW.github.io/number-snake-arena/)

## Gameplay

- **Grow to Survive**: Start as the number 5. Eat enemies with a value strictly less than yours to increase your body segments and value by the amount eaten.
- **Dynamic Role Reversal**: Enemies larger than you will hunt you (red color). Enemies smaller than you will flee (green color). When you grow larger than a hunter, they will immediately turn green and run away!
- **Boss Fight**: Reach a value of 70 to summon the legendary Boss 100. Reach 101 to make it vulnerable, eat it, and claim victory!
- **Boost**: Hold the Boost button to increase your speed, consuming energy. Release to recharge.

## Controls

### Desktop
- **Move**: `W` `A` `S` `D` or Arrow Keys
- **Boost**: Spacebar

### Mobile / Touch
- **Move**: On-screen Virtual Joystick (multi-touch supported)
- **Boost**: On-screen BOOST button

*Note on Mobile testing: Responsive behavior and virtual controls are heavily verified via automated browser emulation (Playwright). True physical hardware device testing (e.g. real iPhone Safari, Android Chrome, iPad Safari) has not been exhaustively performed.*

## Development

Built with:
- [Phaser 4.2.1](https://phaser.io/)
- [Vite](https://vitejs.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- Web Audio API (Synthesized SFX)

## Tests

The project includes a robust test suite for game logic and end-to-end browser regression.

```bash
# Install dependencies
npm install

# Run unit tests (Core game logic, damage rules, physics helpers)
npm run test

# Run local end-to-end browser tests (Requires a local dev server running, simulates gameplay locally)
npm run test:e2e

# Run production end-to-end browser tests (Tests the live GitHub Pages URL with the exact same E2E suite)
npm run test:prod
```

## Build

To build the game for production:

```bash
npm run build
```

The output will be generated in the `dist` folder.

## Deployment

This project uses GitHub Actions for continuous deployment.
Every push to the `main` branch automatically runs tests and deploys the production build to GitHub Pages.

---
*Developed autonomously via Google Antigravity.*
