#!/usr/bin/env python3
"""Generate TypeScript shop definitions from osrs-server TOML inventories."""

from __future__ import annotations

import csv
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

OSRS_SERVER = Path("/home/ggwp/osrs-server")
SHOPS_DIR = OSRS_SERVER / ".data/raw-cache/server/shops"
SHOP_MAPPINGS = OSRS_SERVER / "tools/wiki-dumping/src/main/resources/shopmappings.csv"
SPAWN_CATALOG = Path("/home/ggwp/xrsps-typescript/server/data/osrs-spawn-catalog.json")
NPC_SPAWNS = Path("/home/ggwp/xrsps-typescript/server/data/npc-spawns.json")
OUT_FILE = Path("/home/ggwp/xrsps-typescript/server/gamemodes/vanilla/shops/generatedAllShops.ts")

GENERAL_STORE_INVS = {
    "generalshop1",
    "generalshop2",
    "generalshop3",
    "generalshop4",
    "generalshop5",
    "generalshop6",
    "generalshop7",
    "generalshop8",
    "generalshopogre",
    "generalshopnardah",
    "generallegends",
    "generallegends2",
    "werewolfgeneralstore",
    "upassgeneralshop",
    "shilojunglestore",
    "pest_general_store",
    "port_roberts_general_store",
    "salvager_overlook_general_store",
    "sunset_coast_general_store",
    "kastori_general_store",
    "viking_general_store",
    "death_generalshop",
    "regicide_general_shop",
    "razmiregeneralstore",
    "pollnivneach_generalstore",
    "royal_generalstore",
    "lunar_general",
    "mm_general_shop",
    "lletyageneralshop1",
    "keldagrim_general_shop",
}

# inv slug -> npc type ids (hand-verified + existing xrsps definitions)
MANUAL_NPC_IDS: dict[str, list[int]] = {
    "generalshop5": [2813, 2814],
    "generalshop3": [2815, 2816],
    "generalshop7": [2819, 2820],
    "generalshop1": [2817, 2818],
    "axeshop": [10619],
    "runeshop": [2886, 11434],
    "archeryshop2": [3212],
    "staffshop": [2880],
    "armourshop": [2882],
    "archeryshop": [2883],
    "clotheshop": [534],
    "swordshop": [2884, 2885],
    "helmetshop": [2872],
    "gemshop": [2874],
    "maceshop": [5896],
    "chainmailshop": [5897],
    "shieldshop": [3214],
    "gemshop2": [6529],
    "topshop": [2875],
    "miningstore": [2876],
    "scimitarshop": [2878],
    "legsshop": [2879],
    "skirtshop": [2879],
    "craftingshop2": [2875],
    "arheinstore": [3200],
    "viking_weapons_shop": [3935],
    "viking_general_store": [3894],
    "furshop": [3948],
    "generalshop2": [2821, 2822],
    "generalshop6": [2823, 2824],
    "magicshop": [3009],
    "fishingshop": [3014],
    "goldshop": [3015],
    "boozeshop": [3016],
    "craftingshop": [3017],
    "runiteshop": [3018],
    "2handedshop": [3019],
    "herbloreshop": [3020],
    "fishingshop2": [3021],
    "candleshop": [3022],
    "wydinstore": [3030],
    "generalshop4": [3031],
}

# RSCM npc -> display name hints (from CityShops + export_city_spawns)
RSCM_NPC_HINTS: dict[str, str] = {
    "npc.generalshopkeeper1": "Shop keeper",
    "npc.generalassistant1": "Shop assistant",
    "npc.generalshopkeeper3": "Shop keeper",
    "npc.generalassistant3": "Shop assistant",
    "npc.generalshopkeeper5": "Shop keeper",
    "npc.generalassistant5": "Shop assistant",
    "npc.generalshopkeeper7": "Shop keeper",
    "npc.generalassistant7": "Shop assistant",
    "npc.aubury_3op": "Aubury",
    "npc.aubury_2op": "Aubury",
    "npc.horvik_the_armourer": "Horvik",
    "npc.lowe": "Lowe",
    "npc.zaff": "Zaff",
    "npc.thessalia_normal": "Thessalia",
    "npc.swordshop1": "Shop keeper",
    "npc.swordshop2": "Shop keeper",
    "npc.peksa": "Peksa",
    "npc.gem_trader": "Gem trader",
    "npc.flynn": "Flynn",
    "npc.wayne": "Wayne",
    "npc.cassie": "Cassie",
    "npc.herquin": "Herquin",
    "npc.zenesha": "Zenesha",
    "npc.drogo": "Drogo",
    "npc.zeke": "Zeke",
    "npc.louie_legs": "Louie Legs",
    "npc.ranael": "Ranael",
    "npc.dommik": "Dommik",
    "npc.hickton": "Hickton",
    "npc.arhein": "Arhein",
    "npc.fur_merchant": "Fur trader",
    "npc.viking_weapons_salesman": "Skulgrimen",
    "npc.viking_sigmund": "Sigmund The Merchant",
    "npc.viking_fur_monger": "Fur trader",
    "npc.bob": "Bob",
}


def normalize_name(value: str) -> str:
    value = value.lower()
    value = re.sub(r"\[\[|\]\]", "", value)
    value = value.replace("'", "'")
    value = re.sub(r"[^\w\s]", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def possessive_owner(name: str) -> str | None:
    match = re.match(r"^(\w+)(?:'s|s')\b", name, re.IGNORECASE)
    return match.group(1).lower() if match else None


def load_item_map() -> dict[str, int]:
    data = json.loads(SPAWN_CATALOG.read_text(encoding="utf-8"))
    mapping: dict[str, int] = {}
    for entry in data["items"]:
        mapping[entry["spawn"]] = entry["id"]
    return mapping


def load_npc_name_index() -> dict[str, set[int]]:
    spawns = json.loads(NPC_SPAWNS.read_text(encoding="utf-8"))
    index: dict[str, set[int]] = defaultdict(set)
    for spawn in spawns:
        name = normalize_name(spawn.get("name", ""))
        if name:
            index[name].add(int(spawn["id"]))
    return index


def load_shop_mappings() -> dict[str, str]:
    mappings: dict[str, str] = {}
    with SHOP_MAPPINGS.open(encoding="utf-8") as fh:
        reader = csv.reader(fh)
        for row in reader:
            if not row or row[0] in ("inv", "id") or row[0].startswith("#"):
                continue
            inv = row[0].strip()
            wiki = row[2].strip() if len(row) > 2 else ""
            if inv and inv != "-":
                mappings[inv] = wiki
    return mappings


def load_kotlin_shop_bindings() -> dict[str, list[str]]:
    inv_to_npcs: dict[str, list[str]] = defaultdict(list)
    kotlin_roots = [
        OSRS_SERVER / "content/areas/city/shops/src/main/kotlin",
        OSRS_SERVER / "content/areas/city/lumbridge/src/main/kotlin",
    ]
    shop_re = re.compile(r'shop\("([^"]+)",\s*"[^"]*",\s*"(inv\.[^"]+)"\)')
    open_re = re.compile(r'shops\.open\([^,]+,\s*[^,]+,\s*"[^"]+",\s*"(inv\.[^"]+)"\)')
    onop_re = re.compile(r'onOpNpc3\("([^"]+)"\)')

    for root in kotlin_roots:
        if not root.exists():
            continue
        for path in root.rglob("*.kt"):
            text = path.read_text(encoding="utf-8")
            for npc, inv in shop_re.findall(text):
                inv_slug = inv.removeprefix("inv.")
                if npc not in inv_to_npcs[inv_slug]:
                    inv_to_npcs[inv_slug].append(npc)
            for inv in open_re.findall(text):
                inv_slug = inv.removeprefix("inv.")
                for npc in onop_re.findall(text):
                    if npc not in inv_to_npcs[inv_slug]:
                        inv_to_npcs[inv_slug].append(npc)
    return inv_to_npcs


def parse_toml_shop(path: Path) -> dict | None:
    text = path.read_text(encoding="utf-8")
    inv_match = re.search(r'^id\s*=\s*"(inv\.[^"]+)"', text, re.MULTILINE)
    if not inv_match:
        return None
    inv = inv_match.group(1).removeprefix("inv.")
    name_match = re.search(r'^name\s*=\s*"([^"]*)"', text, re.MULTILINE)
    name = name_match.group(1) if name_match else inv.replace("_", " ").title()

    sell_m = re.search(r"^sellMultiplier\s*=\s*(\d+)", text, re.MULTILINE)
    buy_m = re.search(r"^buyMultiplier\s*=\s*(\d+)", text, re.MULTILINE)
    size_m = re.search(r"^size\s*=\s*(\d+)", text, re.MULTILINE)
    delta_m = re.search(r"^delta\s*=\s*(\d+)", text, re.MULTILINE)

    stock: list[dict] = []
    stock_blocks = re.split(r"\[\[inventory\.stock\]\]", text)[1:]
    for block in stock_blocks:
        obj_m = re.search(r'obj\s*=\s*"(obj\.([^"]+))"', block)
        count_m = re.search(r"count\s*=\s*(\d+)", block)
        restock_m = re.search(r"restockCycles\s*=\s*(\d+)", block)
        if not obj_m or not count_m:
            continue
        stock.append(
            {
                "obj": obj_m.group(2),
                "count": int(count_m.group(1)),
                "restock": int(restock_m.group(1)) if restock_m else 100,
            }
        )

    return {
        "inv": inv,
        "name": name,
        "sell_multiplier": int(sell_m.group(1)) if sell_m else 1000,
        "buy_multiplier": int(buy_m.group(1)) if buy_m else 600,
        "size": int(size_m.group(1)) if size_m else max(len(stock), 40),
        "delta": int(delta_m.group(1)) if delta_m else 20,
        "stock": stock,
        "file": path.name,
    }


def find_npc_ids(
    inv: str,
    shop_name: str,
    wiki_name: str,
    kotlin_npcs: list[str],
    npc_index: dict[str, set[int]],
) -> list[int]:
    if inv in MANUAL_NPC_IDS:
        return MANUAL_NPC_IDS[inv]

    candidates: set[int] = set()
    search_names: list[str] = []

    for npc in kotlin_npcs:
        hint = RSCM_NPC_HINTS.get(npc)
        if hint:
            search_names.append(hint)

    search_names.extend(
        [
            shop_name,
            wiki_name,
            shop_name.split(" - ")[0],
            shop_name.split(",")[0],
        ]
    )
    owner = possessive_owner(shop_name)
    if owner:
        search_names.append(owner)

    slug_words = inv.replace("_", " ").split()
    if slug_words:
        search_names.append(slug_words[0])

    for raw in search_names:
        norm = normalize_name(raw)
        if not norm:
            continue
        if norm in npc_index:
            candidates.update(npc_index[norm])
        for spawn_name, ids in npc_index.items():
            if norm in spawn_name or spawn_name in norm:
                candidates.update(ids)

    # Prefer unique owner NPC over assistants/duplicates
    if len(candidates) > 6:
        owner = possessive_owner(shop_name)
        if owner:
            filtered = {nid for nid in candidates if any(owner in normalize_name(n) for n in [owner])}
            if filtered:
                candidates = filtered

    return sorted(candidates)[:8]


def ts_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=True)


def render_shop(shop: dict, item_map: dict[str, int]) -> str | None:
    inv = shop["inv"]
    stock_lines: list[str] = []
    for entry in shop["stock"]:
        item_id = item_map.get(entry["obj"])
        if item_id is None:
            continue
        stock_lines.append(
            f"        {{ itemId: {item_id}, quantity: {entry['count']}, restockTicks: {entry['restock']} }},"
        )
    if not stock_lines:
        return None

    is_general = inv in GENERAL_STORE_INVS or "general store" in shop["name"].lower()
    buy_mult = 1 if is_general else round(shop["buy_multiplier"] / 1000, 3)
    sell_mult = 0.4 if is_general else round(shop["sell_multiplier"] / 1000, 3)

    npc_ids = shop["npc_ids"]
    npc_literal = ", ".join(str(n) for n in npc_ids) if npc_ids else ""

    lines = [
        f"const SHOP_{inv.upper()}: ShopDefinition = {{",
        f'    id: {ts_string(inv)},',
        f'    name: {ts_string(shop["name"])},',
        f"    npcIds: [{npc_literal}],",
        "    currencyItemId: 995,",
        f"    capacity: {shop['size']},",
        f"    generalStore: {'true' if is_general else 'false'},",
        f"    restockTicks: {shop['delta']},",
        f"    buyPriceMultiplier: {buy_mult},",
        f"    sellPriceMultiplier: {sell_mult},",
        "    stock: [",
        *stock_lines,
        "    ],",
        "};",
    ]
    return "\n".join(lines)


def main() -> int:
    item_map = load_item_map()
    npc_index = load_npc_name_index()
    wiki_mappings = load_shop_mappings()
    kotlin_bindings = load_kotlin_shop_bindings()

    shops: list[dict] = []
    skipped = 0
    seen_inv: set[str] = set()
    for path in sorted(SHOPS_DIR.glob("*.toml")):
        parsed = parse_toml_shop(path)
        if not parsed:
            skipped += 1
            continue
        inv = parsed["inv"]
        if inv in seen_inv:
            skipped += 1
            continue
        seen_inv.add(inv)
        wiki = wiki_mappings.get(inv, "")
        parsed["npc_ids"] = find_npc_ids(
            inv,
            parsed["name"],
            wiki,
            kotlin_bindings.get(inv, []),
            npc_index,
        )
        shops.append(parsed)

    const_blocks: list[str] = []
    export_names: list[str] = []
    with_npc = 0
    for shop in shops:
        block = render_shop(shop, item_map)
        if not block:
            skipped += 1
            continue
        if shop["npc_ids"]:
            with_npc += 1
        const_name = f"SHOP_{shop['inv'].upper()}"
        const_blocks.append(block)
        export_names.append(const_name)

    header = """// AUTO-GENERATED by scripts/generate-shops-from-osrs-server.py — do not edit manually.
import { type ShopDefinition } from "./types";

"""
    footer = (
        "\nexport const GENERATED_ALL_SHOPS: ShopDefinition[] = [\n"
        + "".join(f"    {name},\n" for name in export_names)
        + "];\n"
    )
    OUT_FILE.write_text(header + "\n\n".join(const_blocks) + footer, encoding="utf-8")

    print(f"Wrote {len(export_names)} shops to {OUT_FILE}")
    print(f"  with NPC ids: {with_npc}")
    print(f"  skipped (no stock items): {skipped}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
