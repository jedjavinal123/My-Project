# PoE2 Build Tracker

A small, dependency-free web app for tracking Path of Exile 2 builds.

## Features

- **Multiple builds**: class, ascendancy, level, league, status (Planning → Endgame → Retired), main skill
- **Links**: passive tree URL, guide URL, and a Path of Building code you can copy with one click
- **Skills**: skill gems with level and quality, up to 5 support gems each, reorderable
- **Gear**: every equipment, flask and charm slot, with rarity, mods and the upgrade you're looking for
- **Goals**: an upgrade/progression checklist with costs and a progress bar
- **Progress**: dated stat snapshots (life, ES, mana, DPS, resistances) with deltas, a chart and history
- **Import / export** builds as JSON for backups or sharing

## Running it

Either open `index.html` directly in a browser, or serve it with Node (18 or newer):

```bash
npm start
```

Then go to http://localhost:3000. Use `PORT=8080 npm start` to pick another port.
There are no dependencies, so there's nothing to `npm install`.

Data is saved in your browser's `localStorage`, so it stays on that browser and device.
Use **Export all** to make a backup, or to move your builds to another browser.

## Files

- `index.html`: page shell
- `styles.css`: styling
- `data.js`: game data (classes, ascendancies, gear slots). Edit this when a patch adds content.
- `app.js`: app logic
- `server.js`: optional zero-dependency Node server (`npm start`)
