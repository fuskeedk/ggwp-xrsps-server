import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUTS = ROOT / "outputs"


def count_relations(quests):
    return sum(len(quest.get("npcMappings", [])) for quest in quests)


def unique_entities(quests):
    return {
        mapping["pageTitle"]
        for quest in quests
        for mapping in quest.get("npcMappings", [])
    }


def main():
    qa_path = OUTPUTS / "osrs-quest-npc-mapping-qa.json"
    data = json.loads(qa_path.read_text(encoding="utf-8"))

    verified = json.loads(json.dumps(data))
    review_only = json.loads(json.dumps(data))

    verified_quests = []
    review_quests = []

    for quest in data["quests"]:
        approved_mappings = [
            mapping
            for mapping in quest["npcMappings"]
            if not mapping.get("qa", {}).get("reviewNeeded")
        ]
        review_mappings = [
            mapping
            for mapping in quest["npcMappings"]
            if mapping.get("qa", {}).get("reviewNeeded")
        ]
        if approved_mappings:
            q = {**quest, "npcMappings": approved_mappings}
            verified_quests.append(q)
        if review_mappings:
            q = {**quest, "npcMappings": review_mappings}
            review_quests.append(q)

    verified["quests"] = verified_quests
    verified["verifiedSummary"] = {
        "verifiedRelations": count_relations(verified_quests),
        "verifiedUniqueEntities": len(unique_entities(verified_quests)),
        "questsWithVerifiedRelations": len(verified_quests),
        "minimumScore": min(
            mapping["qa"]["score"]
            for quest in verified_quests
            for mapping in quest["npcMappings"]
        )
        if verified_quests
        else None,
    }
    verified["meta"]["status"] = "verified_subset"
    verified["meta"]["note"] = (
        "Contains only relations that the QA pass did not flag for manual review. "
        "Use osrs-quest-npc-review-queue.csv to approve or remove the remaining candidates."
    )

    review_only["quests"] = review_quests
    review_only["reviewSummary"] = {
        "reviewRelations": count_relations(review_quests),
        "reviewUniqueEntities": len(unique_entities(review_quests)),
        "questsWithReviewRelations": len(review_quests),
        "maximumScore": max(
            mapping["qa"]["score"]
            for quest in review_quests
            for mapping in quest["npcMappings"]
        )
        if review_quests
        else None,
    }
    review_only["meta"]["status"] = "manual_review_subset"

    verified_path = OUTPUTS / "osrs-quest-npc-mapping-verified.json"
    review_path = OUTPUTS / "osrs-quest-npc-mapping-review-only.json"
    verified_path.write_text(json.dumps(verified, indent=2, ensure_ascii=False), encoding="utf-8")
    review_path.write_text(json.dumps(review_only, indent=2, ensure_ascii=False), encoding="utf-8")

    print(json.dumps({
        "verified": verified["verifiedSummary"],
        "review": review_only["reviewSummary"],
    }, indent=2, ensure_ascii=False))
    print(verified_path)
    print(review_path)


if __name__ == "__main__":
    main()
