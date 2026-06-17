# Guide: OSRS Data Import For Quests, NPCs, Armor, Weapons And Items

This guide explains a practical way to fetch OSRS data from OSRS Wiki and other stable sources, store it locally, and use it in a game, calculator, or RuneScape-inspired project.

## 1. What We Are Building

Build the system in three layers:

1. **Importer**  
   Fetches data from OSRS Wiki/APIs and stores it in local files or a database.

2. **Database**  
   Stores quests, NPCs, items, equipment stats, drops, prices and technical IDs.

3. **Game logic**  
   Uses the data for combat, damage, DPS, requirements, rewards, inventory and quests.

This matters because OSRS data changes. If the importer can be run again, the project can be updated without manually editing hundreds of items.

## 2. Good Data Sources

### OSRS Wiki

Use OSRS Wiki as the main source for:

- Quests
- NPCs
- Items
- Armor and weapon stats
- Requirements
- Rewards
- Drops
- Locations
- Examine text

Start here:

- https://oldschool.runescape.wiki/
- https://oldschool.runescape.wiki/api.php

The wiki runs on MediaWiki, so you can use the MediaWiki Action API:

- https://www.mediawiki.org/wiki/API:Main_page

Many OSRS Wiki data fields are structured through Cargo tables. Cargo can be queried with `action=cargoquery`:

- https://www.mediawiki.org/wiki/Extension:Cargo/Querying_data

### OSRS Wiki Prices API

For Grand Exchange/prices, use the OSRS Wiki Prices API:

- https://prices.runescape.wiki/
- https://prices.runescape.wiki/api/v1/osrs/latest
- https://prices.runescape.wiki/api/v1/osrs/mapping

Use the prices API for market prices, not for equipment stats.

### RuneLite/cache Data

RuneLite and OSRS cache data are useful for technical details:

- Item IDs
- NPC IDs
- Animations
- Cache names
- Model/variant relations

For human-readable data like quest requirements, rewards and wiki descriptions, OSRS Wiki is usually better.

## 3. License And Fair Use

Use APIs instead of aggressive scraping.

Do this:

- Set a clear `User-Agent`, for example `MyOSRSProject/0.1 contact@example.com`.
- Cache data locally.
- Add rate limiting, for example 1 request per second.
- Store a source URL on every record.
- Show attribution in the app/game.
- Avoid copying full quest guides or long dialogue text directly.

Wiki content has license requirements, and many assets belong to Jagex. Private/non-commercial use is usually much simpler than a commercial product.

## 4. Database Design

Start simple with SQLite. It is lightweight, fast and works well for a local game database.

Suggested tables:

```sql
quests(
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE,
  members BOOLEAN,
  difficulty TEXT,
  length TEXT,
  quest_points INTEGER,
  start_npc TEXT,
  start_location TEXT,
  requirements_json TEXT,
  rewards_json TEXT,
  source_url TEXT,
  updated_at TEXT
);

npcs(
  id INTEGER PRIMARY KEY,
  name TEXT,
  combat_level INTEGER,
  hitpoints INTEGER,
  attack_level INTEGER,
  strength_level INTEGER,
  defence_level INTEGER,
  magic_level INTEGER,
  ranged_level INTEGER,
  aggressive BOOLEAN,
  attack_style TEXT,
  max_hit INTEGER,
  examine TEXT,
  locations_json TEXT,
  drops_json TEXT,
  source_url TEXT,
  updated_at TEXT
);

items(
  id INTEGER PRIMARY KEY,
  name TEXT,
  examine TEXT,
  members BOOLEAN,
  tradeable BOOLEAN,
  stackable BOOLEAN,
  noted BOOLEAN,
  value INTEGER,
  high_alch INTEGER,
  low_alch INTEGER,
  weight REAL,
  source_url TEXT,
  updated_at TEXT
);

equipment_stats(
  item_id INTEGER PRIMARY KEY,
  slot TEXT,
  attack_stab INTEGER,
  attack_slash INTEGER,
  attack_crush INTEGER,
  attack_magic INTEGER,
  attack_ranged INTEGER,
  defence_stab INTEGER,
  defence_slash INTEGER,
  defence_crush INTEGER,
  defence_magic INTEGER,
  defence_ranged INTEGER,
  melee_strength INTEGER,
  ranged_strength INTEGER,
  magic_damage REAL,
  prayer INTEGER,
  attack_speed INTEGER,
  requirements_json TEXT,
  weapon_styles_json TEXT
);

prices(
  item_id INTEGER PRIMARY KEY,
  high INTEGER,
  low INTEGER,
  high_time INTEGER,
  low_time INTEGER,
  updated_at TEXT
);
```

Later, requirements, drops and locations can be moved into dedicated tables. JSON fields are fine at the beginning.

## 5. Import Flow

Run the import in this order:

1. **Basic item data**  
   Fetch name, item ID, examine text, members flag, tradeable flag, value and similar fields.

2. **Equipment stats**  
   Fetch armor/weapon bonuses and equipment slot.

3. **Prices**  
   Fetch `latest` and `mapping` from the prices API.

4. **NPCs**  
   Fetch combat stats, locations and drops.

5. **Quests**  
   Fetch quest metadata, requirements and rewards.

6. **Relations**  
   Link quests to NPCs and items, such as quest rewards, required items and start NPCs.

## 6. Cargo Query Example

Cargo queries look a bit like SQL, but they are sent through the wiki API.

Example shape:

```text
https://oldschool.runescape.wiki/api.php
  ?action=cargoquery
  &tables=...
  &fields=...
  &limit=500
  &format=json
```

In practice, you need to find the correct Cargo tables and fields on the OSRS Wiki. Good places to look:

- `Special:CargoTables`
- A specific wiki page and its infobox template
- API responses from small test queries

Always make the importer defensive: some pages are missing fields, some items have multiple IDs, and some NPCs have multiple variants.

## 7. Node/TypeScript Importer Example

Minimal structure:

```ts
const WIKI_API = "https://oldschool.runescape.wiki/api.php";

async function wikiCargoQuery(params: Record<string, string>) {
  const url = new URL(WIKI_API);
  url.searchParams.set("action", "cargoquery");
  url.searchParams.set("format", "json");

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: {
      "User-Agent": "MyOSRSProject/0.1 contact@example.com"
    }
  });

  if (!response.ok) {
    throw new Error(`Wiki request failed: ${response.status}`);
  }

  return response.json();
}

async function importEquipment() {
  const data = await wikiCargoQuery({
    tables: "Items",
    fields: "_pageName,All_Item_IDs",
    limit: "500"
  });

  console.log(data.cargoquery);
}
```

This is only a skeleton. The exact tables and fields must be adjusted to match the OSRS Wiki Cargo structure.

## 8. Damage And Stats

OSRS items do not simply have a fixed "damage" number.

Damage is calculated from:

- Player combat stats
- Equipment bonuses
- Weapon speed
- Combat style
- Prayer
- Potions/boosts
- Target defence
- Special effects
- Slayer/task bonuses
- Void, salve, obsidian, crystal and similar modifiers

That means you import equipment stats first, then build combat formulas on top.

Minimum for a good combat calculator:

- Max hit
- Accuracy roll
- Defence roll
- Hit chance
- Attack speed
- DPS

Start with normal melee, then add ranged, magic and special effects.

## 9. Practical Project Structure

```text
osrs-project/
  data/
    raw/
      wiki/
      prices/
    db/
      osrs.sqlite
  scripts/
    import-items.ts
    import-equipment.ts
    import-npcs.ts
    import-quests.ts
    import-prices.ts
  src/
    combat/
      max-hit.ts
      accuracy.ts
      dps.ts
    data/
      osrs-db.ts
  docs/
    attribution.md
```

`data/raw` is important. Store the original API responses so you can debug the importer without hitting the API again.

## 10. Test The Data

Add automatic checks:

- Every equipment item has an `item_id`.
- No duplicate item IDs.
- Armor has an equipment slot.
- Weapons have attack speed where possible.
- Quests have a name and source URL.
- NPCs with combat level have combat stats where they exist.
- Prices match known item IDs.

Also do manual spot checks with known items:

- Abyssal whip
- Rune scimitar
- Dragon scimitar
- Armadyl chestplate
- Bandos chestplate
- Toxic blowpipe
- Twisted bow
- Trident of the seas

If these look correct, the importer is usually on the right track.

## 11. Recommended Start

Start with a small proof of concept:

1. Import 50 equipment items.
2. Show them in a simple table.
3. Add item stats.
4. Add prices.
5. Build max-hit/DPS for melee.
6. Expand to all items.
7. Add NPCs.
8. Add quests.

This keeps the project manageable and makes it easier to find problems early.

## 12. In Short

Yes, armor, weapons, NPCs, quests and item stats can be imported with real data. The robust approach is:

- OSRS Wiki/Cargo for structured game data
- Prices API for Grand Exchange prices
- RuneLite/cache data for technical IDs
- Local SQLite database
- Import scripts with cache, rate limiting and attribution
- Custom combat logic for damage, accuracy and DPS
