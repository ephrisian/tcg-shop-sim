# Set package format

Set packages are immutable player data. Developers author a UTF-8 JSON file
using [`schemas/set-package.schema.json`](../schemas/set-package.schema.json)
and keep referenced images in a companion folder. The game stores imported card
data and images locally in IndexedDB.

## Validate a package

From `tcg-shop-sim`, run:

```sh
npm run validate:set -- path/to/set.json path/to/package-root
```

If the image root is omitted, image paths are resolved relative to the JSON
file. The optional image root is the directory against which paths such as
`images/card.png` are resolved. The validator checks schema version, unique card/product identities,
card references, pack composition, local image files, and redemption totals.
The in-game importer applies the same gameplay validations and requires
referenced image files to be selected with the JSON package.

Developers can use any JSON editor with the supplied schema for authoring, then
export a validated package and only its referenced images with:

```sh
npm run export:set -- path/to/set.json path/to/exported-package path/to/package-root
```

The output folder contains `set.json` plus the referenced image paths, ready to
share or import. Existing output files are overwritten only at the explicitly
named package/image destinations.

## Package shape

The root object has `schemaVersion: 1`, `game`, `set`, `card_data`, and optional
`value`, `image`, `products`, `redemptions`, and `credits` sections. Each card
has a stable source `id` and `name`; game-specific fields are preserved in
`card_data`. `value` and `image` records refer to those card IDs rather than
array positions. Set `game.providerId` when the source/provider is distinct
from the game itself; the game/provider/set identity scopes imported IDs and
prevents otherwise identical IDs from different catalogs from colliding.

Pack products define `slots`, with a positive `count` and rarity or rarities per
slot. `cardsPerPack`, when supplied, must equal the sum of slot counts. Box
products define `packsPerBox`. If redemptions are present, tier quantities must
sum to `caseCount`; if `set.runSize` is present, it must match that count.
Card redemption prizes refer to a card ID in `card_data`. `packsPerCase` can
override the developer-wide redemption frequency for a particular set.
Product entries may include an `image` relative path for pack or box artwork.
These product images are separate from the immutable card `image` associations.

For API-backed sets, use the developer tool's **Data Importer** to fetch the
set's card records and artwork directly into the build-time package folder. To
change only product definitions and their artwork, use **New Packaging Config**
or edit the imported package's **Products** tab.

To include a set in development and release builds, place its complete package
and referenced images under `developer-tools/set-packages/`. The pre-build
compiler validates the package, copies its JSON and referenced art into the
generated public catalog, and writes a manifest consumed by the game at
startup. Commit the source package; the generated output is recreated for each
build. For folder structure and update behavior, see the
[developer tools guide](../developer-tools/README.md).

Example:

```json
{
  "schemaVersion": 1,
  "game": { "id": "example-tcg", "name": "Example TCG", "providerId": "example-source" },
  "set": { "id": "first-set", "code": "EX1", "name": "First Set", "company": "Example", "runSize": 10 },
  "card_data": [
    { "id": "card-001", "name": "Example Hero", "rarity": "Common", "type": "Character", "customRule": "Preserved" }
  ],
  "value": [{ "cardId": "card-001", "marketPrice": 1.25 }],
  "image": [{ "cardId": "card-001", "path": "images/card-001.png" }],
  "products": [
    { "id": "booster", "name": "Booster Pack", "type": "pack", "cardsPerPack": 1, "slots": [{ "rarity": "Common", "count": 1 }] },
    { "id": "booster-box", "name": "Booster Box", "type": "box", "packsPerBox": 24 }
  ],
  "redemptions": {
    "caseCount": 10,
    "tiers": [{ "id": "tier-1", "quantity": 10, "prizeType": "card", "prizeId": "card-001" }]
  },
  "credits": { "companies": ["Example"] }
}
```
