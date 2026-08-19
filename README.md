# Make It Pop 🎯

A browser game (plain HTML/CSS/JS, no dependencies) where you dodge design feedback clichés — *"make it pop"*, *"can we make it red?"*, *"i don't like it, not sure why"* — while collecting design tokens (color, typography, grid) to score points. Difficulty ramps over time: more comment bubbles, faster enemies.

## How to play

- **Move:** arrow keys / WASD, or drag with mouse / finger on screen
- **Collect tokens** (color circle, "Aa", grid) to score points
- **Dodge comment bubbles** — each hit costs a life (you have 3)
- **"But why?"** is a power-up that gives you a temporary shield
- Score increases with level, and combos boost the multiplier

## Project structure

```
make-it-pop-game/
├── index.html   → page structure and UI (toolbar, screens)
├── style.css    → design tokens and styles (Figma canvas aesthetic)
├── game.js      → game engine (loop, physics, spawning, canvas rendering)
└── README.md
```

## Run locally

Open `index.html` in a browser, or serve the folder with any static server:

```bash
npx serve .
```

## Deploy to GitHub Pages

1. Create a new GitHub repo and push this folder
2. Go to **Settings → Pages**
3. Set source to **main** branch, root folder
4. Your game will be live at `https://<username>.github.io/make-it-pop-game/`

## Customize

| What | Where |
|------|-------|
| Enemy phrases | `PHRASES` array at the top of `game.js` |
| Colors / theme | CSS variables in `:root` in `style.css` |
| Difficulty | In `update()`, adjust `spawnTokenTimer`, `spawnEnemyTimer`, and `maxEnemies` |
