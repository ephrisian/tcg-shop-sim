# TCG Shop Simulator

A trading-card shop and collection simulator built with React, TypeScript, Vite,
and Tailwind CSS. Begin with Live Sales in a bedroom, then explore districts,
buy property and storage, open sealed products, organize cards, run Singles
sales, and order products from online vendors.

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
| `npm.cmd test` | Run gameplay-rule, set-package, and developer-tool tests. |
| `npm.cmd run validate:set -- <package.json> [image-folder]` | Validate a set package. |
| `npm.cmd run export:set -- <package.json> <output-folder> [image-folder]` | Export a validated package and referenced images. |
| `npm.cmd run world:grid -- <command> <world.json> [options]` | Create, validate, and export district-grid data. |
| `npm.cmd run desktop:dev` | Build the web app and open it in Electron. |
| `npm.cmd run dist:win` | Build the web app and package portable/installer Windows apps. |

## Developer authoring tools

- Open [`tcg-shop-sim/developer-tools/index.html`](./tcg-shop-sim/developer-tools/index.html)
  in Chrome or Edge to import Lorcast sets with the **Data Importer**, download
  their card data/artwork, and save build-ready packages under
  `tcg-shop-sim/developer-tools/set-packages/`. Use **New Packaging Config** to
  adjust pack/box definitions and product artwork without modifying card data,
  values, or card artwork. The player-facing release does not expose set import
  or data-management controls. Development and production builds validate and
  compile source packages into the app. See the
  [set authoring guide](./tcg-shop-sim/developer-tools/README.md).
- Use `npm.cmd run world:grid -- init world.json` to create a world definition,
  then use the documented district/location commands to edit, validate, and
  export it. See the [world grid guide](./tcg-shop-sim/docs/world-grid-tool.md).

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
- Developer tuning is authored in `tcg-shop-sim/settings.ini` and compiled
  into the build. Players cannot rebalance a shipped game by editing that file.
- Developers add immutable set/card data to the source package folder before
  building. The build includes package JSON and referenced images; the app
  installs these catalogs locally at startup. Rebuild and redistribute the app
  to ship catalog changes. Existing card records remain immutable, while
  compiled updates may refresh product definitions and packaging artwork.
- Developer builds include a Dev Data screen for importing/testing catalogs;
  this screen is absent from production navigation.
- Browser data is local to that browser/profile. Clearing site data removes
  the local save and imported card database, so back up data before clearing
  browser storage.

## Implemented gameplay systems

- Versioned saves with legacy migration, game time, sleep, and exhaustion.
- Product-aware set-package import, validation/export tooling, local images,
  and compiled developer tuning from `settings.ini`.
- Inventory, desk, storage drawers, separate Collection and Binders screens,
  and set completion/copy counts across cards held in binders.
- Singles Live Sales with session-bound requests, drawer-search difficulty,
  product fulfillment, sale pricing, platform fees, and traffic effects.
- Developer-defined district travel, exploration, properties, online vendors,
  pending shipments, and sealed-product redemption prizes.

The approved MVP outline and acceptance criteria remain in [plans.txt](./plans.txt).
Display Walls are explicitly post-MVP.

`card_collector.js` is a separate card-data collection/editor prototype, not
part of the Vite game runtime.
