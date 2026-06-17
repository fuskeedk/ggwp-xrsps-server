# Data attribution

This project imports reference data from the following sources.

## osrsbox-db

- **Source:** https://github.com/osrsbox/osrsbox-db
- **License:** GPL-3.0
- **Used for:** Items, equipment bonuses, weapons, NPC/monster stats, drop tables, prayers

Downloaded via GitHub raw JSON (`docs/items-complete.json`, `docs/monsters-complete.json`).

## OSRS Wiki (prices only)

- **Source:** https://prices.runescape.wiki/
- **License:** Data provided by Weird Gloop; see https://oldschool.runescape.wiki/w/RuneScape:Real-time_Prices
- **Used for:** Grand Exchange high/low prices

## OSRS Wiki (quests — planned)

Quest metadata will be imported separately via the MediaWiki Cargo API when implemented.
Wiki content is licensed under CC BY-NC-SA 3.0.

## Jagex

Old School RuneScape content and materials are trademarks and copyrights of Jagex Limited.
This project is not affiliated with Jagex.

## Regenerating data

```bash
npm run data:download   # fetch osrsbox + GE prices into data/raw/
npm run data:import     # build data/db/osrs.sqlite
npm run data:validate   # spot-check known items
```

Raw downloads and the SQLite database are gitignored (`data/raw/`, `data/db/`).
