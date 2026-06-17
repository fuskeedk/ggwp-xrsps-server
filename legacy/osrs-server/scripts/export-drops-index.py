#!/usr/bin/env python3
"""Export monster drop tables to JSON for ggwp.dk."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "content/drops/build/resources/main/drops/tables/monsters"
OUT = Path("/home/ggwp/public_html/data/osrs/drops-index.json")


def parse_toml_light(text: str) -> dict:
    data: dict = {"npcs": [], "tables": []}
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("npcs"):
            m = re.search(r"\[(.*?)\]", line)
            if m:
                data["npcs"] = re.findall(r'"([^"]+)"', m.group(1))
        if line.startswith("id"):
            data["id"] = line.split("=", 1)[1].strip().strip('"')
    current: dict | None = None
    for line in text.splitlines():
        s = line.strip()
        if s.startswith("[") and s.endswith("]") and "entries" not in s:
            current = {"name": s.strip("[]"), "entries": []}
            data["tables"].append(current)
            continue
        if s.startswith("[[") and "entries" in s:
            if current is not None:
                current["entries"].append({})
            continue
        if current is not None and current["entries"] and "=" in s:
            key, val = s.split("=", 1)
            key = key.strip()
            val = val.strip().strip('"')
            if val.isdigit():
                val = int(val)
            current["entries"][-1][key] = val
    return data


def main() -> int:
    if not SRC.is_dir():
        print(f"Missing drop tables dir: {SRC}", file=sys.stderr)
        return 1

    monsters: list[dict] = []
    for path in sorted(SRC.glob("*.toml")):
        parsed = parse_toml_light(path.read_text(encoding="utf-8", errors="replace"))
        drops: list[dict] = []
        for table in parsed.get("tables", []):
            for entry in table.get("entries", []):
                obj = str(entry.get("obj", "")).replace("obj.", "")
                if not obj:
                    continue
                count = entry.get("count", 1)
                drops.append(
                    {
                        "spawn": obj,
                        "min": count,
                        "max": count,
                        "weight": entry.get("weight", 1),
                    }
                )
        if not drops:
            continue
        monsters.append(
            {
                "slug": path.stem,
                "name": parsed.get("id") or path.stem.replace("_", " ").title(),
                "npcs": parsed.get("npcs", []),
                "drops": drops,
            }
        )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "generated_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "count": len(monsters),
        "monsters": monsters,
    }
    OUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {len(monsters)} tables -> {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
