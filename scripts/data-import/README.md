# OSRS data import

Three-layer reference data pipeline for items, equipment, NPCs and GE prices.

## Sources

| Data | Source |
|------|--------|
| Items, equipment, monsters | [osrsbox-db](https://github.com/osrsbox/osrsbox-db) (GitHub raw JSON) |
| GE prices | [OSRS Wiki Prices API](https://prices.runescape.wiki/) |
| Quests | [OSRS Wiki](https://oldschool.runescape.wiki/) via `kan-du-kode-runescape.zip` reference pack |

Game cache data (`server/data/items.json`) remains the runtime source for animations and technical IDs. This database adds wiki-quality metadata, equipment bonuses and drop tables.

Quest reference data lives in `server/data/quest-reference/` (wiki scripts, NPC roles, resolved game IDs). Run `npm run data:import:quests` after updating those files.

## Quick start

```bash
npm run data:download   # ~55 MB download, cached 24h
npm run data:import     # builds data/db/osrs.sqlite
npm run data:import:quests  # resolves wiki quest NPC/item IDs → resolved-quests.json
npm run data:build-quest-varps  # maps wiki quest titles → OSRS varp IDs
npm run data:build-quest-varbits  # maps quest titles → progress varbit IDs (Quest Helper)
npm run data:generate-quests  # codegen simple quests → generatedAutoQuests.ts
npm run data:quests         # all four steps above
npm run data:validate   # spot-check whip, scimitar, etc.
```

`data:download` also copies `monsters-complete.json` to `references/` for existing drop-table code.

## NPC combat stats (`npc-combat-stats.json`)

The server loads combat profiles from `server/data/npc-combat-stats.json` at runtime. That file is **checked into the repo**, so you do **not** need to regenerate it for normal server start or gameplay.

Regenerate it only when you want to refresh or rebuild NPC combat data from osrsbox:

```bash
npm run data:download
npm run data:build-npc-combat-stats
```

| When to run | Command |
|-------------|---------|
| Normal server start / testing | Neither |
| First setup, or missing `data/raw/osrsbox/` files | `npm run data:download` |
| Update NPC combat stats from latest osrsbox monsters | `data:download` then `data:build-npc-combat-stats` |
| Import items/NPCs/prices into SQLite | `data:download` then `data:import` |

**Notes:**

- `data:build-npc-combat-stats` **overwrites** `server/data/npc-combat-stats.json`.
- Manual overrides in that file are kept only when the NPC **name matches** osrsbox for the same id; mismatched legacy entries are skipped.
- Commit the updated JSON if you intend the new stats to ship with the project.

## Layout

```
data/
  raw/osrsbox/     items-complete.json, monsters-complete.json
  raw/prices/      latest.json, mapping.json
  db/osrs.sqlite   queryable reference DB
scripts/data-import/
  download.ts
  build-npc-combat-stats.ts
  import-all.ts
  validate.ts
server/src/data/osrs-db.ts   read-only query helpers
```

## Query from server code

```ts
import { getOsrsDbEquipment, getOsrsDbPrice } from "../data/osrs-db";

const whip = getOsrsDbEquipment(4151);
const price = getOsrsDbPrice(4151);
```

See [docs/attribution.md](../docs/attribution.md) for licenses.
