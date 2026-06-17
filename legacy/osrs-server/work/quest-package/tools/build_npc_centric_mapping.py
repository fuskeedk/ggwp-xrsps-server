import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUTS = ROOT / "outputs"


def main():
    quest_mapping_path = OUTPUTS / "osrs-quest-npc-mapping.json"
    data = json.loads(quest_mapping_path.read_text(encoding="utf-8"))

    by_npc = {}
    for quest in data["quests"]:
        for mapping in quest["npcMappings"]:
            title = mapping["pageTitle"]
            entry = by_npc.setdefault(
                title,
                {
                    "pageTitle": title,
                    "name": mapping.get("name", title),
                    "entityType": mapping.get("entityType"),
                    "quests": [],
                    "allRoles": [],
                },
            )
            for role in mapping.get("roles", []):
                if role not in entry["allRoles"]:
                    entry["allRoles"].append(role)
            entry["quests"].append(
                {
                    "questTitle": quest["title"],
                    "questName": quest["name"],
                    "questType": quest["type"],
                    "roles": mapping.get("roles", []),
                    "sourceUrl": quest["sourceUrl"],
                    "evidence": mapping.get("evidence", []),
                }
            )

    role_order = {"start": 0, "helper": 1, "turn_in": 2, "enemy": 3, "story": 4}
    for entry in by_npc.values():
        entry["allRoles"] = sorted(
            entry["allRoles"], key=lambda role: role_order.get(role, 99)
        )
        entry["quests"] = sorted(
            entry["quests"], key=lambda item: (item["questType"], item["questTitle"])
        )

    output = {
        "meta": {
            **data["meta"],
            "sourceMapping": "osrs-quest-npc-mapping.json",
            "method": "NPC-centric transform of the quest-to-NPC mapping.",
        },
        "counts": {
            **data["counts"],
            "npcCentricEntries": len(by_npc),
        },
        "npcs": sorted(by_npc.values(), key=lambda item: item["pageTitle"]),
    }

    path = OUTPUTS / "osrs-npc-to-quest-mapping.json"
    path.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")
    print(path)
    print(len(by_npc))


if __name__ == "__main__":
    main()
