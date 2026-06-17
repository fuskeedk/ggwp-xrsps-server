#!/usr/bin/env python3
"""Export city NPC spawn TOML from OSRS Wiki map coordinates."""

from __future__ import annotations

import json
import re
import sys
import urllib.parse
import urllib.request
from dataclasses import dataclass

WIKI_API = "https://oldschool.runescape.wiki/api.php"


@dataclass(frozen=True)
class Spawn:
    npc: str
    x: int
    z: int
    level: int = 0

    def to_coord(self) -> str:
        mx, mz = self.x // 64, self.z // 64
        lx, lz = self.x % 64, self.z % 64
        return f"{self.level}_{mx}_{mz}_{lx}_{lz}"


def fetch_wikitext(title: str) -> str:
    params = {
        "action": "parse",
        "page": title,
        "prop": "wikitext",
        "format": "json",
    }
    url = f"{WIKI_API}?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(url, timeout=30) as resp:
        data = json.load(resp)
    return data["parse"]["wikitext"]["*"]


def parse_map_coords(text: str) -> list[tuple[int, int]]:
    coords: list[tuple[int, int]] = []
    for block in re.findall(r"\{\{Map\b[^}]*\}\}", text, flags=re.IGNORECASE | re.DOTALL):
        for match in re.finditer(r"(\d{3,5}),(\d{3,5})", block):
            coords.append((int(match.group(1)), int(match.group(2))))
    return coords


def centroid(coords: list[tuple[int, int]]) -> tuple[int, int] | None:
    if not coords:
        return None
    xs = [c[0] for c in coords]
    zs = [c[1] for c in coords]
    return round(sum(xs) / len(xs)), round(sum(zs) / len(zs))


def wiki_spawn(npc: str, title: str, *, level: int = 0, offset: tuple[int, int] = (0, 0)) -> Spawn | None:
    try:
        text = fetch_wikitext(title)
    except Exception as exc:  # noqa: BLE001
        print(f"WARN: failed to fetch {title}: {exc}", file=sys.stderr)
        return None
    center = centroid(parse_map_coords(text))
    if center is None:
        print(f"WARN: no map coords for {title} ({npc})", file=sys.stderr)
        return None
    x, z = center[0] + offset[0], center[1] + offset[1]
    return Spawn(npc=npc, x=x, z=z, level=level)


def manual_spawn(npc: str, x: int, z: int, level: int = 0) -> Spawn:
    return Spawn(npc=npc, x=x, z=z, level=level)


def write_toml(path: str, spawns: list[Spawn]) -> None:
    lines = [f"# {path.split('/')[-1]} — auto-generated city NPC spawns\n"]
    for spawn in spawns:
        lines.append("[[spawn]]")
        lines.append(f'npc = "{spawn.npc}"')
        lines.append(f'coords = "{spawn.to_coord()}"')
        lines.append("")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))


def collect_varrock() -> list[Spawn]:
    spawns: list[Spawn] = []
    wiki = [
        ("npc.aubury_3op", "Aubury"),
        ("npc.horvik_the_armourer", "Horvik"),
        ("npc.lowe", "Lowe"),
        ("npc.zaff", "Zaff"),
        ("npc.thessalia_normal", "Thessalia"),
        ("npc.swordshop1", "Varrock Swordshop"),
        ("npc.swordshop2", "Varrock Swordshop"),
        ("npc.peksa", "Peksa"),
        ("npc.generalshopkeeper3", "Varrock General Store"),
        ("npc.generalassistant3", "Varrock General Store"),
        ("npc.romeo", "Romeo"),
        ("npc.juliet", "Juliet"),
        ("npc.apothecary", "Apothecary"),
        ("npc.baraek", "Baraek"),
        ("npc.gem_trader", "Gem trader"),
        ("npc.silk_trader", "Silk trader"),
        ("npc.reldo_normal", "Reldo"),
        ("npc.king_roald", "King Roald"),
        ("npc.curator", "Curator Haig Halen"),
        ("npc.aris", "Aris"),
        ("npc.straven", "Straven"),
        ("npc.katrine", "Katrine"),
        ("npc.weaponsmaster", "Weaponsmaster"),
        ("npc.jonny_the_beard", "Jonny the beard"),
    ]
    for npc, title in wiki:
        s = wiki_spawn(npc, title)
        if s:
            spawns.append(s)
    spawns.extend(
        [
            manual_spawn("npc.banker1", 3183, 3436),
            manual_spawn("npc.banker2", 3183, 3438),
            manual_spawn("npc.banker1", 3185, 3436),
            manual_spawn("npc.banker2", 3185, 3438),
            manual_spawn("npc.banker1_west", 3252, 3419),
            manual_spawn("npc.banker2_east", 3253, 3419),
            manual_spawn("npc.banker1", 3254, 3419),
            manual_spawn("npc.banker2", 3254, 3420),
        ]
    )
    return spawns


def collect_falador() -> list[Spawn]:
    spawns: list[Spawn] = []
    wiki = [
        ("npc.flynn", "Flynn"),
        ("npc.wayne", "Wayne"),
        ("npc.cassie", "Cassie"),
        ("npc.generalshopkeeper7", "Falador General Store"),
        ("npc.generalassistant7", "Falador General Store"),
        ("npc.herquin", "Herquin"),
        ("npc.zenesha", "Zenesha's Plate Mail Body Shop"),
        ("npc.cassie", "Cassie's Shield Shop"),
        ("npc.sir_amik_varze", "Sir Amik Varze"),
        ("npc.hetty", "Hetty"),
        ("npc.general_bentnoze", "General Bentnoze"),
        ("npc.general_wartface", "General Wartface"),
        ("npc.drogo", "Drogo"),
    ]
    for npc, title in wiki:
        s = wiki_spawn(npc, title)
        if s and not any(existing.npc == s.npc and existing.to_coord() == s.to_coord() for existing in spawns):
            spawns.append(s)
    spawns.extend(
        [
            manual_spawn("npc.banker1", 2947, 3368),
            manual_spawn("npc.banker2", 2948, 3368),
            manual_spawn("npc.banker1", 2947, 3370),
            manual_spawn("npc.banker2", 2948, 3370),
            manual_spawn("npc.banker1_west", 2945, 3369),
            manual_spawn("npc.banker2_east", 2949, 3369),
        ]
    )
    return spawns


def collect_alkharid() -> list[Spawn]:
    spawns: list[Spawn] = []
    wiki = [
        ("npc.generalshopkeeper1", "Al Kharid General Store"),
        ("npc.generalassistant1", "Al Kharid General Store"),
        ("npc.zeke", "Zeke"),
        ("npc.louie_legs", "Louie Legs"),
        ("npc.ranael", "Ranael"),
        ("npc.dommik", "Dommik"),
        ("npc.gem_trader", "Gem trader"),
        ("npc.silk_trader", "Silk trader"),
        ("npc.hassan", "Hassan"),
        ("npc.osman", "Osman"),
        ("npc.lady_keli_vis", "Lady Keli"),
        ("npc.joe_vis", "Joe"),
        ("npc.leela", "Leela"),
        ("npc.prince_ali_vis_blackeye", "Prince Ali"),
    ]
    for npc, title in wiki:
        s = wiki_spawn(npc, title)
        if s:
            spawns.append(s)
    spawns.extend(
        [
            manual_spawn("npc.banker1", 3269, 3167),
            manual_spawn("npc.banker2", 3269, 3164),
            manual_spawn("npc.banker1", 3269, 3166),
            manual_spawn("npc.banker2", 3269, 3165),
        ]
    )
    return spawns


def collect_seers() -> list[Spawn]:
    spawns: list[Spawn] = []
    wiki = [
        ("npc.hickton", "Hickton"),
        ("npc.arhein", "Arhein"),
        ("npc.fur_merchant", "Fur trader"),
        ("npc.pmod_town_crier_seers", "Town Crier"),
    ]
    for npc, title in wiki:
        s = wiki_spawn(npc, title)
        if s:
            spawns.append(s)
    spawns.extend(
        [
            manual_spawn("npc.banker1", 2722, 3493),
            manual_spawn("npc.banker2", 2723, 3493),
            manual_spawn("npc.banker1", 2724, 3493),
            manual_spawn("npc.banker2", 2725, 3493),
        ]
    )
    return spawns


def collect_rellekka() -> list[Spawn]:
    spawns: list[Spawn] = []
    wiki = [
        ("npc.viking_weapons_salesman", "Skulgrimen"),
        ("npc.viking_sigmund", "Sigmund The Merchant"),
        ("npc.viking_clothing_shopkeeper", "Yrsa"),
        ("npc.viking_fur_monger", "Fur trader"),
        ("npc.fris_r_ferryman_rellekka", "Mord Gunnars"),
    ]
    for npc, title in wiki:
        s = wiki_spawn(npc, title)
        if s:
            spawns.append(s)
    spawns.extend(
        [
            manual_spawn("npc.banker1", 2622, 3687),
            manual_spawn("npc.banker2", 2623, 3687),
            manual_spawn("npc.banker1", 2624, 3687),
            manual_spawn("npc.banker2", 2625, 3687),
        ]
    )
    return spawns


def main() -> None:
    out_dir = sys.argv[1] if len(sys.argv) > 1 else ".data/raw-cache/map/npcs"
    cities = {
        "varrock.toml": collect_varrock(),
        "falador.toml": collect_falador(),
        "alkharid.toml": collect_alkharid(),
        "seers.toml": collect_seers(),
        "rellekka.toml": collect_rellekka(),
    }
    for filename, spawns in cities.items():
        path = f"{out_dir}/{filename}"
        write_toml(path, spawns)
        print(f"Wrote {len(spawns)} spawns to {path}")


if __name__ == "__main__":
    main()
