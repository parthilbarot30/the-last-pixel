# The Last Pixel

> A daily community pixel art reveal game built on Reddit with Devvit Web + Phaser 3

## What is it?

A hidden procedurally generated pixel art image is buried under a 64×64 grid. Every Reddit user gets exactly **one cell reveal per day**. The community collectively uncovers the image together.

- Between **20–40% revealed** → a guessing window opens. Submit one locked-in guess of what the art is.
- At **midnight** → the full image reveals with a wave animation, then resets with brand new art.
- Every day is a fresh mystery. Every reveal matters.

## Play it

**[→ Play on Reddit](https://www.reddit.com/r/thelastpixel/comments/1ut9m10/the_last_pixel_uncover_todays_hidden_art/)**

**[→ App listing](https://developers.reddit.com/apps/parthil-pixel)**

**[→ Subreddit](https://www.reddit.com/r/thelastpixel)**

## Built with

| Technology | Role |
|------------|------|
| Devvit Web | Reddit platform integration, deployment |
| Phaser 3 | Interactive canvas, animations, zoom/pan |
| Redis | Pixel state, daily limits, guess storage |
| Hono | Server routes (reveal, guess, init) |
| TypeScript | End-to-end type safety |
| Procedural generation | Daily pixel art from date seed |

## Features

- **64×64 interactive grid** rendered with Phaser 3
- **9 pixel art themes** — landscapes, cityscapes, underwater scenes, forests, faces, abstract waves, space, geometric patterns, and animals — generated fresh every day from a date seed
- **One reveal per user per day** — enforced server-side via Redis
- **Guess mechanic** — locked-in single guess between 20–40% revealed
- **Midnight reset** — automatic board wipe and new art on every new day
- **Zoom + pan** — + / - buttons and drag to navigate zoomed canvas
- **Guesses ticker** — scrolling display of community guesses
- **Midnight countdown** — live timer when fully revealed
- **Mobile responsive** — works on Reddit mobile app and browser

## How it works

```
User opens post
       ↓
Phaser renders 64×64 grid (all cells covered)
       ↓
User taps a cell → POST /api/reveal
       ↓
Server checks: revealed today? cell taken? → saves to Redis
       ↓
Real image color returned → cell animates open
       ↓
At 20% revealed → guess button activates
At 40% revealed → guess window closes
At midnight → board resets, new art generated
```

## Project structure

```
src/
  client/
    scenes/
      Game.ts        ← Phaser scene (grid, animations, zoom/pan)
    game.ts          ← Phaser config + DOM button wiring
    game.html        ← Game shell with guess overlay + zoom controls
    game.css         ← Visual identity (Space Mono, dark theme)
    splash.ts        ← Splash screen with animated preview canvas
    splash.html      ← Splash screen markup
    splash.css       ← Splash screen styles
  server/
    routes/
      api.ts         ← /reveal, /guess, /init endpoints
      pixelart.ts    ← Procedural pixel art generator (9 themes)
      triggers.ts    ← App install trigger
    core/
      post.ts        ← Auto post creation
    index.ts         ← Hono server entry point
  shared/
    api.ts           ← Shared types
devvit.json          ← Devvit app config
```

## Running locally

```bash
# Install dependencies
npm install

# Login to Devvit
devvit login

# Deploy to your test subreddit
devvit upload

# Or run in playtest mode
devvit playtest your_subreddit
```

> **Note:** Requires Node 22. Use nvm to switch: `nvm use 22`

## Submission

Built for the **Reddit Devvit Game Jam 2025** (June 17 – July 15).

Targeting:
- Best App with a Hook
- Best Use of Phaser
- Best Use of Retention Mechanics
- Best Use of User Contributions

## Author

**Parthil Barot** — B.Tech CSE, Nirma University

---

*The Last Pixel — one reveal, one guess, one day at a time.*