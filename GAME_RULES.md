# TCG Shop Simulator — Game Rules

How to play. For setup and developer tools see the [README](./README.md).
Numbers below are the shipped defaults from `tcg-shop-sim/settings.ini`; the
developer can rebalance them in a new release, so in-game values win if they
differ.

## Goal

You start in your bedroom with $500 and no shop. Open sealed products, keep the
cards you love, sell the rest, and grow into bigger storage, properties, and
more card games. Complete sets in your collection, run profitable Live Sales,
and expand across the city.

## The screens

| Screen | Purpose |
| --- | --- |
| **Home** | Bedroom operations: money, card totals, items sold, upgrades, Live Sales. |
| **Inventory** | Sealed products plus the Shop, Sealed, and Storage views. |
| **City** | Travel to districts, shop in stores, explore, buy properties, order online. |
| **Desk** | Sort newly opened cards one at a time. |
| **Storage** | Containers and drawers that hold your cards. |
| **Collection** | Set checklists and completion. |
| **Binders** | Your purchased binders and the cards inside them. |

## Time and energy

- Every action spends **energy** and advances **game time** (15 minutes by
  default; travel and exploring take longer). Time only advances when you act
  and never while the game is closed.
- You start with up to **100 energy**. Energy only refills by **sleeping**, or
  partially with an **Energy Drink** ($10, restores 50).
- Staying awake has a cost: each hour awake adds **+1** to the energy cost of
  every action.
- Sleep lasts a **minimum of 7 hours**.
- After **36 hours awake** you are forced to sleep and recover only **half**
  your energy, and you are **exhausted** until you reset it: sleep for at least
  seven hours starting between **10 PM and midnight** on the day you wake.
- Low on energy or money? The game blocks the action and tells you why.

## Opening sealed products

1. Buy packs or boxes from a store or an online vendor.
2. Open them from **Inventory**. A pack costs energy to rip (5 by default; 1
   during a Live Rip). Opening a box costs 2.
3. Each pack follows the set's recipe, for example "6 Commons, 3 Uncommons,
   2 Rare or better, 1 foil of any rarity". Rarer cards are scarcer, tied to
   each set's print run.
4. Pulled cards go to your **Desk**. Opening is blocked if the desk and your
   storage have no room. Cards are never thrown away automatically.

### Case redemptions

Only **ripping sealed product** can hit a redemption. Each set defines its own
case size, prize tiers, and odds. Prizes are **cards or binders**, and you can
keep, trade, or sell them like anything else. Selling singles never triggers
redemptions.

## The Desk

The Desk holds up to 50 cards. Tap the draw pile to see the next card, then
choose:

- **Sort** it into a pile that is tied to a drawer in one of your storage
  containers, then **Store Sorted** to file the piles.
- **Sell** it at market value.
- **Move to Binder** to keep it in your collection.
- **Grade** it (CGC, PSA, or BGS) for a fee.
- **Donate** it to a local store.
- **Throw away** the card.

Cards left on the desk may lose value over time, so sort them promptly.

## Storage

- Buy **storage containers**. Each has **six drawers**; sizes range from
  300 cards (50 per drawer) to 5,400 cards (900 per drawer).
- Each location (bedroom, garage, warehouse, shop) has a total card limit and a
  container limit. Buying a container never raises the location limit.
- A card exists in exactly one place: desk, a drawer, a binder slot, or
  sellable inventory. Moving a card changes its location; it is never copied.

## Binders and your collection

- You can't create binders. **Buy** them in shops: Classic (25 pages, $50),
  Portfolio (35 pages, $90), Showcase (45 pages, $150).
- Pages use 1×1, 2×2, or 3×3 slots. Drag cards into slots. You can name a
  binder, rearrange it, empty it, or sell it. Used binders resell for less than
  you paid (40–50% by default).
- Emptying a binder sends cards to a storage destination with enough space.
- **Collection** shows each set's checklist. Cards you don't own appear as
  mysteries. Completion counts **distinct cards**; duplicates show as copy
  counts but don't add to completion.
- A card in a binder is not for sale. Move it to storage to make it sellable.

## Live Sales

Run Live Sales from your bedroom. Pick a show type; each costs energy to start.

| Show | Start cost | Audience |
| --- | --- | --- |
| **Standard Rip** | 10 | Balanced viewers. |
| **Singles Show** | 5 | Deal-hunters. |
| **Rip Till You Hit** | 15 | High-rollers. |

Only the **Singles Show** uses buyer requests.

### Singles requests

- Before you go live, choose which **sealed products** and which **binders**
  are sellable. An included binder is fully sellable. Cards in storage are
  sellable too.
- Buyers only ask for things you can actually sell: by name, character,
  rarity, set, or a combination. There are never more than **3** requests
  waiting, and there are **no timers**.
- Requests last only for that show. Ending the show clears them with no
  penalty. Close the queue whenever you like.
- You can **fulfill** or **decline** a request. Declining hurts foot traffic:
  a vague request a little, a specific one more, and declining something you
  actually had for sale the most. Running out of energy with requests still
  waiting also hurts traffic.

### Finding the card (drawer search)

For a card request you search a drawer. The drawer shows how full it is and an
arrow sweeps across it. Time your stop on the green zone. Red is a miss.

| Choice | Energy | You pick the area? | Hit zone | Arrow |
| --- | --- | --- | --- | --- |
| **High effort** | 12 | No — search the whole stack | Wide | Slow |
| **Low effort** | 2 | Yes — aim at a range | Narrow | Fast |

You can retry as often as you like, but **every attempt costs its energy**.
Requests for sealed products skip the search and use your sealed inventory.

### Pricing and fees

- Cards sell at market value; you can set a higher price. If you push too far
  above market (about 25% by default), buyers lose interest and traffic drops.
- Live sales pay a **15% platform fee**.

## The city

- The world is a square grid of districts with your **Home District** at the
  center. Each district has shops and may offer properties for sale.
- Travel costs energy, money, and time based on **grid hops**. A local store is
  about 5 energy and free. An adjacent district is about 10 energy and $5. More
  than two hops away takes a full in-game day for the round trip.
- Some districts start locked. Travel there and choose **Explore** (15 energy,
  2 hours) to unlock them.

### Properties

Buy a **Garage**, **Shop**, or **Warehouse** to gain storage for containers.
Each charges a daily upkeep (Garage $10, Shop $100, Warehouse $300 by default).

### Online vendors

Order from **Panazon**, **NotWhat**, and **BayBay**. Stock follows each set's
run size. Shipping fees depend on the distance from the vendor's warehouse to
your delivery location. **Normal** shipping takes 3 days and **Expedited** takes
1 day for double the fee. Choose a destination when you own several locations.
Shipments in transit are saved and arrive as game time passes. If the destination
is full on arrival, the shipment waits until you make room or pick another
location.

## Saving

Progress saves automatically in the browser (or the desktop app). Old saves are
migrated and a backup is kept if migration fails. Clearing browser data erases
your save.

## Tips

- Sleep at a sensible hour; late-night actions cost more energy.
- Keep a few empty drawers before opening boxes.
- Move cards you want to sell out of binders first.
