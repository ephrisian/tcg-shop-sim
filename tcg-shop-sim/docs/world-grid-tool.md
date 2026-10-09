# World grid authoring tool (developer only)

Standalone utility in `developer-tools/`; it is not bundled into or imported by the game.
It edits an authoring JSON file and exports `locations` + `worldMap` data shaped like
`GAME_CONFIG.locations` / `GAME_CONFIG.worldMap` in `game/config.ts`.

Rules enforced on every edit and on export:
- Home District (`home`) exists, is unique, sits at the grid center (0,0), and cannot be moved/deleted.
- Districts live on a square grid; no overlaps. Connections are the 4 grid-adjacent districts
  (max four; a non-home district has at most three besides its parent). Each city must have a
  center district and every district must connect to it.
- Locations need a valid district, type (`lgs`, `bigbox`, `resort`), and non-negative `baseMarkup`.
- A district with locations cannot be deleted.

```
npm run world:grid -- init world.json
npm run world:grid -- add-district world.json --name Uptown --x 1 --y 0 --properties shop
npm run world:grid -- edit-district world.json --id uptown --properties shop,warehouse
npm run world:grid -- add-location world.json --name "Wolf Cards" --district home --markup 0.2 --cases 15
npm run world:grid -- populate world.json --district uptown --count 3
npm run world:grid -- validate world.json
npm run world:grid -- export world.json --out world-config.json
npm run world:grid -- delete-location world.json --id wolf-cards
```

Other commands: `edit-location`, `delete-district`. Copy exported values into `game/config.ts`.
Tests: `npm test`.
