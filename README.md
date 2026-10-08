# TCG Shop Simulator

A browser-based trading-card shop simulator built with React, TypeScript, Vite,
and Tailwind CSS. Manage a shop, buy and open sealed products, sort cards, build
a collection, visit local stores, and run live rip shows.

## Run locally

Requirements: Node.js and npm.

From the repository root:

```powershell
cd .\tcg-shop-sim
npm.cmd install
npm.cmd run dev
```

Open the local URL printed by Vite (usually <http://localhost:5173>). In
PowerShell, `npm.cmd` avoids script execution-policy issues that can block the
`npm.ps1` wrapper.

## Desktop app (Windows)

The Windows desktop build is distributed as a portable `.exe` and a Windows
installer. Players do not need Node.js or npm to run either release.

To build the desktop app locally (requires Node.js and npm on the build
machine), run from `tcg-shop-sim`:

```powershell
npm.cmd install
npm.cmd run dist:win
```

The portable executable and installer are written to `tcg-shop-sim/release/`.
To publish release downloads through GitHub Actions, push a version tag such as
`v1.0.0`. The workflow builds both Windows artifacts and attaches the `.exe`
files to the GitHub Release. The portable build does not install the app; the
installer provides Start Menu and desktop shortcuts.

Download `TCG Shop Simulator-<version>-portable-x64.exe` to run without
installing, or `TCG Shop Simulator-<version>-setup-x64.exe` to install it.
For each release, update the app version in `tcg-shop-sim/package.json` and
push a matching tag (for example, `v1.0.1`).

## Available commands

Run these from `tcg-shop-sim`:

| Command | Description |
| --- | --- |
| `npm.cmd run dev` | Start the Vite development server. |
| `npm.cmd run typecheck` | Check TypeScript without producing output. |
| `npm.cmd run build` | Type-check and create a production build in `dist/`. |
| `npm.cmd run preview` | Serve the production build locally after building. |
| `npm.cmd run desktop:dev` | Build the web app and open it in Electron. |
| `npm.cmd run dist:win` | Build the web app and package portable/installer Windows apps. |

## Project structure

```text
tcg-shop-sim/
  App.tsx                 App state, shared game context, and screen routing
  main.tsx                Browser entry point
  components/             Shared UI components, including navigation
  features/               Home, City, Sealed, Desk, Storage, Collection, Settings
  game/
    config.ts             Game balance, locations, products, and set themes
    database.ts           IndexedDB persistence for sets and cards
    engine.ts             Pack generation, Lorcast imports, and card valuation
    state.ts              Initial game state and game context
    types.ts              Shared game and card data types
  index.html              Vite HTML entry point
  styles.css              Tailwind CSS and global styles
```

The root-level `tcg_shop_sim.js` is retained as a compatibility re-export of
the app.

## Data and saves

- Game progress is saved in browser `localStorage` under `tcg_sim_save`.
- Card and set records are stored in IndexedDB (`TCG_Sim_DB`).
- The Settings screen can fetch set information and import cards from the
  Lorcast API. Imported data is stored in the current browser.
- Browser data is local to that browser/profile. Clearing site data removes
  the local save and imported card database, so back up data before clearing
  browser storage.

## Current scope and roadmap

The game currently focuses on the shop-management and card-opening loop. The
planned feature outline—including multi-city travel, expanded inventory and
binders, live buyer requests, online ordering, broader game support, and set
redemptions—is in [plans.txt](./plans.txt).

`card_collector.js` is a separate card-data collection/editor prototype, not
part of the Vite game runtime.
