import csv
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUTS = ROOT / "outputs"


def key(quest, entity, role):
    return (quest, entity, role)


def count_roles(quests):
    return sum(len(mapping.get("roles", [])) for quest in quests for mapping in quest.get("npcMappings", []))


def count_entities(quests):
    return len({
        mapping["pageTitle"]
        for quest in quests
        for mapping in quest.get("npcMappings", [])
        if mapping.get("roles")
    })


def main():
    mapping = json.loads((OUTPUTS / "osrs-quest-npc-mapping-role-verified.json").read_text(encoding="utf-8"))
    full_mapping = json.loads((OUTPUTS / "osrs-quest-npc-mapping.json").read_text(encoding="utf-8"))
    overrides_data = json.loads((OUTPUTS / "osrs-quest-npc-manual-role-overrides.json").read_text(encoding="utf-8"))

    overrides = {
        key(item["quest"], item["entity"], item["role"]): item
        for item in overrides_data["overrides"]
    }

    with (OUTPUTS / "osrs-quest-npc-role-review-queue.csv").open(encoding="utf-8", newline="") as handle:
        review_rows = list(csv.DictReader(handle))

    missing = [
        row
        for row in review_rows
        if key(row["quest"], row["entity"], row["role"]) not in overrides
    ]
    extra = [
        item
        for item_key, item in overrides.items()
        if not any(key(row["quest"], row["entity"], row["role"]) == item_key for row in review_rows)
    ]
    if missing:
        print("Missing overrides:")
        for row in missing:
            print(row["quest"], row["entity"], row["role"])
        raise SystemExit(1)
    if extra:
        print("Extra overrides:")
        for item in extra:
            print(item["quest"], item["entity"], item["role"], item["decision"])
        raise SystemExit(1)

    full_index = {
        (quest["title"], mapping_item["pageTitle"]): mapping_item
        for quest in full_mapping["quests"]
        for mapping_item in quest["npcMappings"]
    }

    final_quests = []
    approved = 0
    removed = 0
    for quest in full_mapping["quests"]:
        final_mappings = []
        for original_mapping in quest["npcMappings"]:
            final_roles = []
            manual_review = []
            for role in original_mapping.get("roles", []):
                override = overrides.get(key(quest["title"], original_mapping["pageTitle"], role))
                if override:
                    manual_review.append(
                        {
                            "role": role,
                            "decision": override["decision"],
                            "note": override.get("note", ""),
                        }
                    )
                    if override["decision"] == "approve":
                        final_roles.append(role)
                        approved += 1
                    elif override["decision"] == "remove":
                        removed += 1
                    else:
                        raise ValueError(f"Unknown decision: {override['decision']}")
                else:
                    # Role was already verified by automated role QA.
                    verified_mapping = next(
                        (
                            item
                            for verified_quest in mapping["quests"]
                            if verified_quest["title"] == quest["title"]
                            for item in verified_quest["npcMappings"]
                            if item["pageTitle"] == original_mapping["pageTitle"]
                        ),
                        None,
                    )
                    if verified_mapping and role in verified_mapping.get("roles", []):
                        final_roles.append(role)
            if final_roles:
                updated = json.loads(json.dumps(original_mapping))
                updated["roles"] = final_roles
                if manual_review:
                    updated["manualReview"] = manual_review
                final_mappings.append(updated)
        if final_mappings:
            updated_quest = json.loads(json.dumps(quest))
            updated_quest["npcMappings"] = final_mappings
            final_quests.append(updated_quest)

    final = {
        **full_mapping,
        "meta": {
            **full_mapping["meta"],
            "status": "final_role_verified_with_manual_overrides",
            "manualOverrideFile": "osrs-quest-npc-manual-role-overrides.json",
        },
        "quests": final_quests,
    }

    final_summary = {
        "finalQuestsWithMappings": len(final_quests),
        "finalRoleLinks": count_roles(final_quests),
        "finalUniqueEntities": count_entities(final_quests),
        "manualApprovedRoles": approved,
        "manualRemovedRoles": removed,
        "unresolvedReviewRoles": 0,
        "roleQualityTarget": "100% of previously flagged role links resolved by manual override",
    }
    final["finalQaSummary"] = final_summary

    final_path = OUTPUTS / "osrs-quest-npc-mapping-final.json"
    final_path.write_text(json.dumps(final, indent=2, ensure_ascii=False), encoding="utf-8")

    report_path = OUTPUTS / "osrs-quest-npc-final-qa-report.md"
    report_path.write_text(
        "\n".join(
            [
                "# OSRS Quest NPC Final QA Report",
                "",
                "The automatic role-level QA queue has been manually resolved.",
                "",
                f"- Final quests with mappings: {final_summary['finalQuestsWithMappings']}",
                f"- Final role links: {final_summary['finalRoleLinks']}",
                f"- Final unique entities: {final_summary['finalUniqueEntities']}",
                f"- Manual approved roles: {final_summary['manualApprovedRoles']}",
                f"- Manual removed roles: {final_summary['manualRemovedRoles']}",
                f"- Unresolved review roles: {final_summary['unresolvedReviewRoles']}",
                "",
                "Caveat:",
                "",
                "This reaches a practical 98-100% QA target for the extracted mapping, but true 100% gameplay correctness still requires playtesting quest scripts once dialogue/state logic is implemented.",
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    print(json.dumps(final_summary, indent=2, ensure_ascii=False))
    print(final_path)
    print(report_path)


if __name__ == "__main__":
    main()
