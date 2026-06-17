import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUTS = ROOT / "outputs"


def main():
    data = json.loads((OUTPUTS / "osrs-quest-npc-mapping-final.json").read_text(encoding="utf-8"))
    by_npc = {}
    for quest in data["quests"]:
        for mapping in quest["npcMappings"]:
            entry = by_npc.setdefault(
                mapping["pageTitle"],
                {
                    "pageTitle": mapping["pageTitle"],
                    "name": mapping.get("name", mapping["pageTitle"]),
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
                    "manualReview": mapping.get("manualReview", []),
                }
            )

    role_order = {"start": 0, "helper": 1, "turn_in": 2, "enemy": 3, "story": 4}
    for entry in by_npc.values():
        entry["allRoles"] = sorted(entry["allRoles"], key=lambda role: role_order.get(role, 99))
        entry["quests"] = sorted(entry["quests"], key=lambda item: (item["questType"], item["questTitle"]))

    output = {
        "meta": {
            **data["meta"],
            "sourceMapping": "osrs-quest-npc-mapping-final.json",
            "status": "final_npc_centric_mapping",
        },
        "finalQaSummary": {
            **data["finalQaSummary"],
            "npcCentricEntries": len(by_npc),
        },
        "npcs": sorted(by_npc.values(), key=lambda item: item["pageTitle"]),
    }
    path = OUTPUTS / "osrs-npc-to-quest-mapping-final.json"
    path.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")
    print(path)
    print(len(by_npc))


if __name__ == "__main__":
    main()
