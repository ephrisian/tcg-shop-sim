# Set package authoring tool (developer only)

A standalone, dependency-free page for creating and editing version-1 set
packages (see `../docs/set-packages.md` and `../schemas/set-package.schema.json`).
It is not part of the player runtime.

## Use

From `tcg-shop-sim` run `npm run author` and open <http://localhost:5179/>. The
local server lets the tool read and write `developer-tools/set-packages/`
directly (no browser folder permissions, no ZIPs) and proxies card-art
downloads. Opening `index.html` as a file only shows a reminder to start it.

- The landing page is the **Set Package Library**, listing every full package
  in `developer-tools/set-packages/`. Select **Edit Set** to work on one;
  **Save to set-packages** writes the JSON back in place for the next build.
- **Data Importer** fetches the Lorcast set catalog and writes the selected
  set's `set.json`, prices, and (optionally) card art to
  `developer-tools/set-packages/lorcana/<set code>/`. Re-importing overwrites.
  `npm run fetch:art -- <package folder>` can fetch missing art later.
- **New** starts a new full set package. **Load JSON…** opens a saved
  packaging-only config, or converts a full set package into a packaging-only
  copy. Existing card records, values, and card artwork are never editable in
  loaded packages.
- **Game & Set** – `game.id/name/providerId`, `set.id/code/name/company/runSize`.
- **Cards** – `card_data` with id/name/rarity/type plus a JSON column for any
  provider-specific fields.
- **Value** and **Images** – separate per-card associations (`value`, `image`).
  Helper buttons create a record for each card lacking one (images default to
  `images/<id>.png`).
- **Products** – pack/box products; pack composition is `slots`, one per line:
  `Common x6`, `Rare|Mythic x1 foil`. Boxes use `packsPerBox` / `packProductId`.
  Product artwork is an `image` path such as `images/products/booster-box.png`.
- **Redemptions** – `caseCount`, `packsPerCase`, and tiers (card or binder prizes).
- **Credits** – free-form JSON object/array.
- **Validate & Export** – shows structural issues; **Export set.json** downloads
  the package.

After importing, the set opens in the editor. Edit product definitions and
artwork paths in **Products** (place product art in the set's folder), then
**Save to set-packages**.

The in-page check mirrors the structural rules in
`scripts/validate-set-package.mjs` but cannot see image files; the CLI is the
authority.

## Validate and export art

Place the exported JSON next to your art, then from `tcg-shop-sim`:

```sh
npm run validate:set -- path/to/set.json path/to/package-root
npm run export:set -- path/to/set.json path/to/exported-package path/to/package-root
```

`package-root` is the folder that image paths such as `images/card-001.png`
resolve against (defaults to the JSON's folder for validation). Export copies
`set.json` and only the referenced images.

Use only original or properly licensed card content.

## Change packaging for an existing API set

Use **New Packaging Config** rather than loading/editing the full set. This
restricted mode contains only game/set identity and product definitions; it
does not include card records, values, or card artwork. For Lorcana, set the
set `id` and `code` to the API set code (for example `1st`) and use the
pre-filled default pack/box products unless you need to change their
composition. Set each product's `image` to a relative path and place those
files under the package image folder.

Edit the full package produced by the Data Importer in the **Products** tab,
then use **Save to set-packages**. The package-only config can also be
applied to an API set in the development app's **Dev Data** screen for local
testing; that IndexedDB change does not transfer to other devices or become
part of a release build.
The manifest format is described in
[`../schemas/product-packaging.schema.json`](../schemas/product-packaging.schema.json).

## Include developer-owned sets in builds

Put each complete, validated set package in its own folder under
`developer-tools/set-packages/`. Keep the package JSON and every referenced
image in that folder, preserving relative paths. For example:

```text
developer-tools/set-packages/
  lorcana/first-chapter/
    set.json
    booster-box.png
    booster-pack.png
    0001-card-001.png
```

Run `npm run validate:set -- developer-tools/set-packages/lorcana/first-chapter/set.json`
to validate the package. `npm run dev` and `npm run build` automatically run
the package compiler: it validates every JSON package under the source folder,
copies each package and referenced image to the generated public catalog, and
writes a catalog manifest. The runtime imports new sets at startup. If a set is
already present in the local database, the build's product definitions and
product images are refreshed without changing its existing card records.
Commit the source package files; generated `public/compiled-set-packages/`
output is recreated during builds and should not be edited directly.

## Self-test

```sh
node developer-tools/validation-selftest.cjs
```
