#!/usr/bin/env python3
"""Add OSRS numeric NPC IDs to the generated quest/dialogue data.

The preferred source is osrsbox/osrsbox-db docs/npcs-summary.json. It contains
client NPC ids and names, including attackable NPCs/monsters. This script keeps
the generated internal npc ids stable and adds server-facing ids beside them.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "outputs" / "osrs-quest-system" / "data"
NPCS_PATH = DATA_DIR / "npcs.json"
QUESTS_PATH = DATA_DIR / "quests.json"
DIALOGUES_PATH = DATA_DIR / "dialogues.json"
NPC_ID_INDEX_PATH = DATA_DIR / "npc-id-index.json"
REPORT_PATH = ROOT / "outputs" / "osrs-quest-system" / "NPC_ID_IMPORT_REPORT.md"
DEFAULT_SOURCE_PATH = ROOT / "work" / "npcs-summary.json"
OSRSBOX_RAW_URL = (
    "https://raw.githubusercontent.com/osrsbox/osrsbox-db/"
    "refs/heads/master/docs/npcs-summary.json"
)


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def normalize_name(value: str) -> str:
    value = html.unescape(str(value)).casefold()
    value = value.replace("’", "'").replace("`", "'")
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def base_name(value: str) -> str:
    return normalize_name(re.sub(r"\s*\([^)]*\)\s*$", "", value))


def download_source(path: Path) -> None:
    request = urllib.request.Request(
        OSRSBOX_RAW_URL,
        headers={"User-Agent": "Codex OSRS quest NPC id importer"},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        text = response.read().decode("utf-8")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def iter_summary_entries(summary: Any) -> list[dict[str, Any]]:
    if isinstance(summary, list):
        values = summary
    elif isinstance(summary, dict):
        values = summary.values()
    else:
        raise TypeError("npcs-summary.json must be a JSON object or array")

    entries: list[dict[str, Any]] = []
    for entry in values:
        if not isinstance(entry, dict):
            continue
        npc_id = entry.get("id")
        name = entry.get("name")
        if isinstance(npc_id, str) and npc_id.isdigit():
            npc_id = int(npc_id)
        if isinstance(npc_id, int) and isinstance(name, str) and name.strip():
            entries.append({"id": npc_id, "name": name})
    return entries


def add_unique(target: list[int], values: list[int]) -> None:
    seen = set(target)
    for value in values:
        if value not in seen:
            target.append(value)
            seen.add(value)


def build_name_indexes(entries: list[dict[str, Any]]) -> tuple[dict[str, list[int]], dict[str, list[int]]]:
    exact: dict[str, list[int]] = defaultdict(list)
    base: dict[str, list[int]] = defaultdict(list)
    for entry in entries:
        npc_id = int(entry["id"])
        name = str(entry["name"])
        add_unique(exact[normalize_name(name)], [npc_id])
        add_unique(base[base_name(name)], [npc_id])
    return exact, base


def enrich_npcs(npcs_doc: dict[str, Any], entries: list[dict[str, Any]]) -> dict[str, Any]:
    exact_index, base_index = build_name_indexes(entries)
    matched = 0
    exact_matches = 0
    base_matches = 0
    missing: list[dict[str, str]] = []
    broad_matches: list[dict[str, Any]] = []

    for npc in npcs_doc["npcs"]:
        ids: list[int] = []
        match_method = "missing"
        exact_key = normalize_name(npc["name"])
        exact_ids = exact_index.get(exact_key, [])
        if exact_ids:
            ids = sorted(exact_ids)
            match_method = "osrsbox_exact_name"
            exact_matches += 1
        else:
            fallback_key = base_name(npc["name"])
            fallback_ids = base_index.get(fallback_key, [])
            if fallback_ids:
                ids = sorted(fallback_ids)
                match_method = "osrsbox_base_name"
                base_matches += 1

        npc["gameNpcIds"] = ids
        npc["primaryGameNpcId"] = ids[0] if ids else None
        npc["gameNpcIdSource"] = "osrsbox/osrsbox-db:npcs-summary.json" if ids else None
        npc["gameNpcIdMatch"] = match_method
        npc["serverLookupKey"] = str(ids[0]) if ids else npc["id"]

        if ids:
            matched += 1
            if len(ids) > 1:
                broad_matches.append(
                    {
                        "npcId": npc["id"],
                        "name": npc["name"],
                        "match": match_method,
                        "gameNpcIds": ids[:25],
                        "totalGameNpcIds": len(ids),
                    }
                )
        else:
            missing.append({"npcId": npc["id"], "name": npc["name"], "pageTitle": npc["pageTitle"]})

    meta = npcs_doc.setdefault("meta", {})
    meta["numericNpcIds"] = {
        "source": "osrsbox/osrsbox-db docs/npcs-summary.json",
        "sourceUrl": OSRSBOX_RAW_URL,
        "importedAt": datetime.now(timezone.utc).isoformat(),
        "totalSourceEntries": len(entries),
        "matchedNpcs": matched,
        "missingNpcs": len(missing),
        "exactNameMatches": exact_matches,
        "baseNameMatches": base_matches,
        "broadNameMatches": len(broad_matches),
        "note": (
            "gameNpcIds can contain multiple OSRS cache IDs when a name has variants. "
            "Use primaryGameNpcId only when your server expects one default id; use "
            "npc-id-index.json for exact server-id lookups."
        ),
    }
    return {"missing": missing, "broad": broad_matches, "matched": matched}


def enrich_dialogues(dialogues_doc: dict[str, Any], npc_by_id: dict[str, dict[str, Any]]) -> None:
    for dialogue in dialogues_doc["dialogues"]:
        npc = npc_by_id[dialogue["npcId"]]
        dialogue["gameNpcIds"] = npc.get("gameNpcIds", [])
        dialogue["primaryGameNpcId"] = npc.get("primaryGameNpcId")
        for node in dialogue.get("nodes", []):
            for choice in node.get("choices", []):
                for action in choice.get("actions", []):
                    if action.get("npcId") == dialogue["npcId"]:
                        action["gameNpcIds"] = dialogue["gameNpcIds"]
                        action["primaryGameNpcId"] = dialogue["primaryGameNpcId"]

    meta = dialogues_doc.setdefault("meta", {})
    meta["numericNpcIds"] = {
        "source": "npcs.json gameNpcIds",
        "dialoguesWithGameNpcIds": sum(1 for item in dialogues_doc["dialogues"] if item.get("gameNpcIds")),
    }


def enrich_quests(quests_doc: dict[str, Any], npc_by_id: dict[str, dict[str, Any]]) -> None:
    for quest in quests_doc["quests"]:
        for participant in quest.get("participants", []):
            npc = npc_by_id[participant["npcId"]]
            participant["gameNpcIds"] = npc.get("gameNpcIds", [])
            participant["primaryGameNpcId"] = npc.get("primaryGameNpcId")

    meta = quests_doc.setdefault("meta", {})
    meta["numericNpcIds"] = {
        "source": "npcs.json gameNpcIds",
        "questsWithNumericParticipants": sum(
            1
            for quest in quests_doc["quests"]
            if any(participant.get("gameNpcIds") for participant in quest.get("participants", []))
        ),
    }


def build_id_index(npcs_doc: dict[str, Any]) -> dict[str, Any]:
    by_game_id: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for npc in npcs_doc["npcs"]:
        for game_id in npc.get("gameNpcIds", []):
            by_game_id[str(game_id)].append(
                {
                    "npcId": npc["id"],
                    "name": npc["name"],
                    "pageTitle": npc["pageTitle"],
                    "entityType": npc["entityType"],
                    "quests": npc.get("quests", []),
                }
            )

    return {
        "meta": {
            "language": "en",
            "source": "npcs.json gameNpcIds",
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "gameNpcIdCount": len(by_game_id),
            "linkedNpcRecords": sum(1 for npc in npcs_doc["npcs"] if npc.get("gameNpcIds")),
        },
        "gameNpcIds": dict(sorted(by_game_id.items(), key=lambda item: int(item[0]))),
    }


def write_report(result: dict[str, Any], index_doc: dict[str, Any]) -> None:
    missing = result["missing"]
    broad = result["broad"]
    lines = [
        "# NPC ID Import Report",
        "",
        "## Source",
        "",
        "- Source: osrsbox/osrsbox-db `docs/npcs-summary.json`",
        f"- URL: {OSRSBOX_RAW_URL}",
        "",
        "## Counts",
        "",
        f"- NPC records with numeric IDs: {result['matched']}",
        f"- NPC records still missing numeric IDs: {len(missing)}",
        f"- Unique numeric server NPC IDs indexed: {index_doc['meta']['gameNpcIdCount']}",
        f"- Broad name matches with multiple numeric IDs: {len(broad)}",
        "",
        "## Server usage",
        "",
        "- Use `primaryGameNpcId` when your server only accepts one id.",
        "- Use `gameNpcIds` when an NPC has multiple cache variants.",
        "- Use `data/npc-id-index.json` or `getBestDialogueNodeByGameNpcId(...)` when the server gives you a numeric NPC id.",
        "",
        "## Missing sample",
        "",
    ]
    if missing:
        for item in missing[:50]:
            lines.append(f"- `{item['npcId']}`: {item['name']} ({item['pageTitle']})")
    else:
        lines.append("- None.")

    lines.extend(["", "## Broad match sample", ""])
    if broad:
        for item in broad[:50]:
            sample_ids = ", ".join(str(value) for value in item["gameNpcIds"][:12])
            suffix = "..." if item["totalGameNpcIds"] > 12 else ""
            lines.append(
                f"- `{item['npcId']}`: {item['name']} via {item['match']} -> "
                f"{sample_ids}{suffix} ({item['totalGameNpcIds']} ids)"
            )
    else:
        lines.append("- None.")

    REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source",
        type=Path,
        default=DEFAULT_SOURCE_PATH,
        help="Path to osrsbox npcs-summary.json",
    )
    parser.add_argument(
        "--download",
        action="store_true",
        help="Download osrsbox npcs-summary.json before importing",
    )
    args = parser.parse_args()

    source = args.source
    if args.download:
        download_source(source)

    if not source.exists():
        print(
            f"Missing {source}. Download {OSRSBOX_RAW_URL} to that path, "
            "or rerun with --download in an environment with internet access.",
            file=sys.stderr,
        )
        return 2

    summary = load_json(source)
    entries = iter_summary_entries(summary)
    if not entries:
        raise RuntimeError("No NPC entries found in source file.")

    npcs_doc = load_json(NPCS_PATH)
    quests_doc = load_json(QUESTS_PATH)
    dialogues_doc = load_json(DIALOGUES_PATH)

    result = enrich_npcs(npcs_doc, entries)
    npc_by_id = {npc["id"]: npc for npc in npcs_doc["npcs"]}
    enrich_quests(quests_doc, npc_by_id)
    enrich_dialogues(dialogues_doc, npc_by_id)
    index_doc = build_id_index(npcs_doc)

    write_json(NPCS_PATH, npcs_doc)
    write_json(QUESTS_PATH, quests_doc)
    write_json(DIALOGUES_PATH, dialogues_doc)
    write_json(NPC_ID_INDEX_PATH, index_doc)
    write_report(result, index_doc)

    print(
        json.dumps(
            {
                "matchedNpcs": result["matched"],
                "missingNpcs": len(result["missing"]),
                "uniqueGameNpcIds": index_doc["meta"]["gameNpcIdCount"],
                "broadNameMatches": len(result["broad"]),
                "report": str(REPORT_PATH),
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
