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

## Layout

```
data/
  raw/osrsbox/     items-complete.json, monsters-complete.json
  raw/prices/      latest.json, mapping.json
  db/osrs.sqlite   queryable reference DB
scripts/data-import/
  download.ts
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
