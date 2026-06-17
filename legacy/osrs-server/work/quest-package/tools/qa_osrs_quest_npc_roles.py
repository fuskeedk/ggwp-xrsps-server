import csv
import json
from pathlib import Path

from qa_osrs_quest_npc_mapping import (
    OUTPUTS,
    fetch_pages,
    page_infobox_type_and_quests,
)


def role_score(role, sources, quest_title, page_info):
    categories = set(page_info.get("categories", []))
    entity_type, infobox_quest_links, infobox_quest_text = page_infobox_type_and_quests(page_info)
    category_match = f"Category:{quest_title}" in categories
    infobox_quest_match = quest_title in infobox_quest_links or quest_title in infobox_quest_text
    chathead_match = "walkthrough.chathead" in sources
    direct_interaction = "walkthrough.interaction" in sources
    reasons = []
    if category_match:
        reasons.append("quest category match")
    if infobox_quest_match:
        reasons.append("entity infobox quest field match")
    if chathead_match:
        reasons.append("walkthrough chathead match")
    if direct_interaction:
        reasons.append("walkthrough interaction match")

    if role == "start":
        score = 0.99 if "quest_details.start" in sources else 0.88
        if infobox_quest_match or category_match:
            score = min(1.0, score + 0.01)
        review = score < 0.95
    elif role == "enemy":
        score = 0.97 if "quest_details.kills" in sources else 0.82
        if infobox_quest_match or category_match:
            score = min(1.0, score + 0.02)
        review = score < 0.95
    elif role == "helper":
        score = 0.86 if direct_interaction else 0.72
        if infobox_quest_match:
            score += 0.10
        elif category_match:
            score += 0.06
        if chathead_match:
            score += 0.04
        score = min(score, 0.98)
        review = score < 0.90
    elif role == "turn_in":
        score = 0.84 if direct_interaction else 0.70
        if infobox_quest_match:
            score += 0.11
        elif category_match:
            score += 0.08
        if chathead_match:
            score += 0.04
        score = min(score, 0.97)
        review = score < 0.90
        if not (infobox_quest_match or category_match or chathead_match):
            review = True
            reasons.append("turn-in lacks independent quest association")
    elif role == "story":
        if infobox_quest_match:
            score = 0.95
        elif chathead_match:
            score = 0.91
        elif category_match:
            score = 0.93
        else:
            score = 0.62
        review = score < 0.90
    else:
        score = 0.0
        review = True
        reasons.append("unknown role")

    return {
        "role": role,
        "score": round(score, 3),
        "reviewNeeded": review,
        "reasons": reasons,
        "entityInfoboxType": entity_type,
    }


def write_csv(path, rows):
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "quest",
                "questType",
                "entity",
                "entityType",
                "role",
                "score",
                "reviewNeeded",
                "reasons",
                "sourceUrl",
                "evidence",
            ],
        )
        writer.writeheader()
        writer.writerows(rows)


def main():
    mapping = json.loads((OUTPUTS / "osrs-quest-npc-mapping.json").read_text(encoding="utf-8"))
    entity_titles = {
        item["pageTitle"]
        for quest in mapping["quests"]
        for item in quest["npcMappings"]
    }
    pages = fetch_pages(entity_titles)

    role_rows = []
    verified = json.loads(json.dumps(mapping))
    role_counts = {
        "totalRoleLinks": 0,
        "verifiedRoleLinks": 0,
        "reviewRoleLinks": 0,
        "scoreAtLeast0_95": 0,
        "scoreAtLeast0_90": 0,
    }
    review_by_role = {}

    for quest in verified["quests"]:
        filtered_mappings = []
        for mapping_item in quest["npcMappings"]:
            sources = {e.get("source") for e in mapping_item.get("evidence", [])}
            page_info = pages.get(mapping_item["pageTitle"], {})
            role_qa = []
            verified_roles = []
            review_roles = []
            for role in mapping_item.get("roles", []):
                qa = role_score(role, sources, quest["title"], page_info)
                role_qa.append(qa)
                role_counts["totalRoleLinks"] += 1
                if qa["score"] >= 0.95:
                    role_counts["scoreAtLeast0_95"] += 1
                if qa["score"] >= 0.90:
                    role_counts["scoreAtLeast0_90"] += 1
                if qa["reviewNeeded"]:
                    review_roles.append(role)
                    role_counts["reviewRoleLinks"] += 1
                    review_by_role[role] = review_by_role.get(role, 0) + 1
                else:
                    verified_roles.append(role)
                    role_counts["verifiedRoleLinks"] += 1
                role_rows.append(
                    {
                        "quest": quest["title"],
                        "questType": quest["type"],
                        "entity": mapping_item["pageTitle"],
                        "entityType": mapping_item.get("entityType"),
                        "role": role,
                        "score": qa["score"],
                        "reviewNeeded": qa["reviewNeeded"],
                        "reasons": "; ".join(qa["reasons"]),
                        "sourceUrl": quest["sourceUrl"],
                        "evidence": " / ".join(
                            evidence.get("text", "")
                            for evidence in mapping_item.get("evidence", [])[:3]
                        ),
                    }
                )
            mapping_item["roleQa"] = role_qa
            mapping_item["verifiedRoles"] = verified_roles
            mapping_item["reviewRoles"] = review_roles
            if verified_roles:
                mapping_item["roles"] = verified_roles
                filtered_mappings.append(mapping_item)
        quest["npcMappings"] = filtered_mappings

    verified["quests"] = [quest for quest in verified["quests"] if quest["npcMappings"]]
    role_counts["reviewNeededPercent"] = round(
        (role_counts["reviewRoleLinks"] / role_counts["totalRoleLinks"]) * 100, 2
    )
    role_counts["verifiedPercent"] = round(
        (role_counts["verifiedRoleLinks"] / role_counts["totalRoleLinks"]) * 100, 2
    )
    role_counts["scoreAtLeast0_90Percent"] = round(
        (role_counts["scoreAtLeast0_90"] / role_counts["totalRoleLinks"]) * 100, 2
    )
    role_counts["reviewByRole"] = dict(sorted(review_by_role.items()))

    all_roles_path = OUTPUTS / "osrs-quest-npc-role-qa.csv"
    review_roles_path = OUTPUTS / "osrs-quest-npc-role-review-queue.csv"
    verified_path = OUTPUTS / "osrs-quest-npc-mapping-role-verified.json"
    report_path = OUTPUTS / "osrs-quest-npc-role-qa-report.md"

    write_csv(all_roles_path, sorted(role_rows, key=lambda row: (row["quest"], row["entity"], row["role"])))
    write_csv(
        review_roles_path,
        sorted(
            [row for row in role_rows if str(row["reviewNeeded"]).lower() == "true"],
            key=lambda row: (float(row["score"]), row["quest"], row["entity"], row["role"]),
        ),
    )
    verified["meta"]["status"] = "role_verified_subset"
    verified["roleQaSummary"] = role_counts
    verified_path.write_text(json.dumps(verified, indent=2, ensure_ascii=False), encoding="utf-8")
    report_path.write_text(
        "\n".join(
            [
                "# OSRS Quest NPC Role QA Report",
                "",
                "This report checks individual roles, so a valid `enemy` role can be kept even if a noisy `turn_in` role needs review.",
                "",
                f"- Total role links checked: {role_counts['totalRoleLinks']}",
                f"- Verified role links: {role_counts['verifiedRoleLinks']} ({role_counts['verifiedPercent']}%)",
                f"- Review role links: {role_counts['reviewRoleLinks']} ({role_counts['reviewNeededPercent']}%)",
                f"- Score >= 0.95: {role_counts['scoreAtLeast0_95']}",
                f"- Score >= 0.90: {role_counts['scoreAtLeast0_90']} ({role_counts['scoreAtLeast0_90Percent']}%)",
                "",
                "Review needed by role:",
                "",
                *[f"- {role}: {count}" for role, count in role_counts["reviewByRole"].items()],
                "",
                "Files:",
                "",
                "- `osrs-quest-npc-role-qa.csv`: all scored role links",
                "- `osrs-quest-npc-role-review-queue.csv`: role links that need manual approval",
                "- `osrs-quest-npc-mapping-role-verified.json`: safe role-level verified mapping",
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    print(json.dumps(role_counts, indent=2, ensure_ascii=False))
    print(all_roles_path)
    print(review_roles_path)
    print(verified_path)
    print(report_path)


if __name__ == "__main__":
    main()
