import csv
import datetime as dt
import html
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path


API = "https://oldschool.runescape.wiki/api.php"
USER_AGENT = "CodexOSRSPrototype/0.1 local-development"
ROOT = Path(__file__).resolve().parents[1]
OUTPUTS = ROOT / "outputs"


def request_json(params, retries=3):
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    last_error = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=45) as response:
                return json.load(response)
        except Exception as exc:
            last_error = exc
            time.sleep(0.7 * (attempt + 1))
    raise last_error


def chunks(values, size):
    for index in range(0, len(values), size):
        yield values[index : index + size]


def fetch_pages(titles):
    pages = {}
    titles = sorted({title for title in titles if title})
    for group in chunks(titles, 35):
        data = request_json(
            {
                "action": "query",
                "prop": "revisions|categories",
                "titles": "|".join(group),
                "rvslots": "main",
                "rvprop": "content",
                "cllimit": "max",
                "formatversion": "2",
                "format": "json",
            }
        )
        for page in data.get("query", {}).get("pages", []):
            title = page.get("title")
            revisions = page.get("revisions") or []
            content = ""
            if revisions:
                content = (
                    revisions[0]
                    .get("slots", {})
                    .get("main", {})
                    .get("content", "")
                )
            pages[title] = {
                "title": title,
                "exists": not page.get("missing"),
                "content": content,
                "categories": [item.get("title", "") for item in page.get("categories", [])],
            }
        time.sleep(0.08)
    return pages


def clean_wiki(value):
    value = re.sub(r"<ref[\s\S]*?</ref>", " ", value)
    value = re.sub(r"<[^>]+>", " ", value)
    value = re.sub(r"\{\{[^{}]*\}\}", " ", value)
    value = re.sub(r"\[\[([^\]|#]+)(?:#[^\]|]+)?\|([^\]]+)\]\]", r"\2", value)
    value = re.sub(r"\[\[([^\]|#]+)(?:#[^\]|]+)?\]\]", r"\1", value)
    value = value.replace("'''", "").replace("''", "")
    return re.sub(r"\s+", " ", html.unescape(value)).strip()


def extract_template(text, template_name):
    start = re.search(r"\{\{\s*" + re.escape(template_name) + r"\b", text, flags=re.I)
    if not start:
        return ""
    start_index = start.start()
    depth = 0
    index = start_index
    while index < len(text) - 1:
        pair = text[index : index + 2]
        if pair == "{{":
            depth += 1
            index += 2
            continue
        if pair == "}}":
            depth -= 1
            index += 2
            if depth == 0:
                return text[start_index:index]
            continue
        index += 1
    return text[start_index:]


def parse_template_params(template_text):
    params = {}
    current_key = None
    current_value = []
    for line in template_text.splitlines()[1:]:
        match = re.match(r"^\|([^=]+?)\s*=\s*(.*)$", line)
        if match:
            if current_key is not None:
                params[current_key] = "\n".join(current_value).strip()
            current_key = match.group(1).strip().lower()
            current_value = [match.group(2)]
        elif current_key is not None:
            current_value.append(line)
    if current_key is not None:
        params[current_key] = "\n".join(current_value).strip()
    return params


def extract_wikilinks(text):
    links = []
    pattern = re.compile(r"\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]")
    for match in pattern.finditer(text or ""):
        target = match.group(1).replace("_", " ").strip()
        if ":" in target:
            namespace = target.split(":", 1)[0].lower()
            if namespace in {
                "file",
                "image",
                "category",
                "template",
                "map",
                "module",
                "mediawiki",
                "help",
                "special",
            }:
                continue
        links.append(target[0].upper() + target[1:] if target else target)
    return links


def page_infobox_type_and_quests(page):
    content = page.get("content", "")
    npc_box = extract_template(content, "Infobox NPC")
    monster_box = extract_template(content, "Infobox Monster")
    entity_type = None
    params = {}
    if npc_box:
        entity_type = "npc"
        params = parse_template_params(npc_box)
    elif monster_box:
        entity_type = "monster"
        params = parse_template_params(monster_box)
    quest_field = params.get("quest", "")
    quest_links = set(extract_wikilinks(quest_field))
    quest_text = clean_wiki(quest_field)
    return entity_type, quest_links, quest_text


def relation_score(mapping, quest_title, page_info):
    categories = set(page_info.get("categories", []))
    entity_type, infobox_quest_links, infobox_quest_text = page_infobox_type_and_quests(page_info)
    sources = {e.get("source") for e in mapping.get("evidence", [])}
    roles = set(mapping.get("roles", []))
    category_match = f"Category:{quest_title}" in categories
    infobox_quest_match = quest_title in infobox_quest_links or quest_title in infobox_quest_text
    chathead_match = "walkthrough.chathead" in sources
    direct_interaction = "walkthrough.interaction" in sources

    role_scores = []
    reasons = []

    if not page_info.get("exists"):
        return 0.0, ["entity page missing"], True

    if entity_type != mapping.get("entityType"):
        reasons.append(f"entity type mismatch: mapping={mapping.get('entityType')} infobox={entity_type}")

    if category_match:
        reasons.append("quest category match")
    if infobox_quest_match:
        reasons.append("entity infobox quest field match")
    if chathead_match:
        reasons.append("walkthrough chathead match")
    if direct_interaction:
        reasons.append("walkthrough interaction match")

    if "start" in roles:
        score = 0.99 if "quest_details.start" in sources else 0.88
        if infobox_quest_match or category_match:
            score = min(1.0, score + 0.01)
        role_scores.append(score)

    if "enemy" in roles:
        score = 0.97 if "quest_details.kills" in sources else 0.82
        if infobox_quest_match or category_match:
            score = min(1.0, score + 0.02)
        role_scores.append(score)

    if "helper" in roles:
        score = 0.86 if direct_interaction else 0.72
        if infobox_quest_match:
            score += 0.10
        elif category_match:
            score += 0.06
        if chathead_match:
            score += 0.04
        role_scores.append(min(score, 0.98))

    if "turn_in" in roles:
        score = 0.84 if direct_interaction else 0.70
        if infobox_quest_match:
            score += 0.11
        elif category_match:
            score += 0.08
        if chathead_match:
            score += 0.04
        role_scores.append(min(score, 0.97))

    if "story" in roles:
        if infobox_quest_match:
            score = 0.95
        elif chathead_match:
            score = 0.91
        elif category_match:
            score = 0.93
        else:
            score = 0.62
        role_scores.append(score)

    score = max(role_scores) if role_scores else 0.0
    review_needed = score < 0.90
    if "turn_in" in roles and not (infobox_quest_match or category_match or chathead_match):
        review_needed = True
        reasons.append("turn-in relation lacks independent quest association")
    return round(score, 3), reasons, review_needed


def main():
    mapping_path = OUTPUTS / "osrs-quest-npc-mapping.json"
    data = json.loads(mapping_path.read_text(encoding="utf-8"))

    entity_titles = {
        mapping["pageTitle"]
        for quest in data["quests"]
        for mapping in quest["npcMappings"]
    }
    pages = fetch_pages(entity_titles)

    review_rows = []
    scored = json.loads(json.dumps(data))
    score_buckets = {
        "totalRelations": 0,
        "scoreAtLeast0_98": 0,
        "scoreAtLeast0_95": 0,
        "scoreAtLeast0_90": 0,
        "scoreBelow0_90": 0,
        "reviewNeeded": 0,
        "storyOnlyReviewNeeded": 0,
        "entityTypeMismatches": 0,
    }

    role_review_counts = {}
    source_review_counts = {}

    for quest in scored["quests"]:
        for mapping in quest["npcMappings"]:
            score_buckets["totalRelations"] += 1
            page_info = pages.get(mapping["pageTitle"], {})
            score, reasons, review_needed = relation_score(mapping, quest["title"], page_info)
            mapping["qa"] = {
                "score": score,
                "reviewNeeded": review_needed,
                "reasons": reasons,
            }
            if score >= 0.98:
                score_buckets["scoreAtLeast0_98"] += 1
            if score >= 0.95:
                score_buckets["scoreAtLeast0_95"] += 1
            if score >= 0.90:
                score_buckets["scoreAtLeast0_90"] += 1
            else:
                score_buckets["scoreBelow0_90"] += 1
            if review_needed:
                score_buckets["reviewNeeded"] += 1
                if mapping.get("roles") == ["story"]:
                    score_buckets["storyOnlyReviewNeeded"] += 1
                for role in mapping.get("roles", []):
                    role_review_counts[role] = role_review_counts.get(role, 0) + 1
                for evidence in mapping.get("evidence", []):
                    source = evidence.get("source", "unknown")
                    source_review_counts[source] = source_review_counts.get(source, 0) + 1
                review_rows.append(
                    {
                        "quest": quest["title"],
                        "questType": quest["type"],
                        "entity": mapping["pageTitle"],
                        "entityType": mapping.get("entityType"),
                        "roles": "|".join(mapping.get("roles", [])),
                        "score": score,
                        "reasons": "; ".join(reasons),
                        "sourceUrl": quest["sourceUrl"],
                        "evidence": " / ".join(
                            e.get("text", "") for e in mapping.get("evidence", [])[:3]
                        ),
                    }
                )
            entity_type, _, _ = page_infobox_type_and_quests(page_info)
            if entity_type and entity_type != mapping.get("entityType"):
                score_buckets["entityTypeMismatches"] += 1

    scored["meta"]["qaGeneratedAt"] = dt.datetime.now(dt.timezone.utc).isoformat()
    scored["meta"]["qaMethod"] = (
        "Scores each quest-to-entity relation using structured quest detail evidence, "
        "walkthrough interaction evidence, chathead evidence, quest category membership, "
        "and whether the entity infobox quest field links back to the quest."
    )
    scored["qaSummary"] = {
        **score_buckets,
        "reviewNeededPercent": round(
            (score_buckets["reviewNeeded"] / score_buckets["totalRelations"]) * 100, 2
        ),
        "scoreAtLeast0_90Percent": round(
            (score_buckets["scoreAtLeast0_90"] / score_buckets["totalRelations"]) * 100, 2
        ),
        "roleReviewCounts": dict(sorted(role_review_counts.items())),
        "sourceReviewCounts": dict(sorted(source_review_counts.items())),
    }

    qa_mapping_path = OUTPUTS / "osrs-quest-npc-mapping-qa.json"
    qa_mapping_path.write_text(json.dumps(scored, indent=2, ensure_ascii=False), encoding="utf-8")

    review_csv_path = OUTPUTS / "osrs-quest-npc-review-queue.csv"
    with review_csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "quest",
                "questType",
                "entity",
                "entityType",
                "roles",
                "score",
                "reasons",
                "sourceUrl",
                "evidence",
            ],
        )
        writer.writeheader()
        writer.writerows(sorted(review_rows, key=lambda row: (row["score"], row["quest"], row["entity"])))

    summary = scored["qaSummary"]
    report_path = OUTPUTS / "osrs-quest-npc-qa-report.md"
    report_path.write_text(
        "\n".join(
            [
                "# OSRS Quest NPC Mapping QA Report",
                "",
                "This report scores the automatic quest-to-NPC/monster mapping against OSRS Wiki evidence.",
                "",
                f"- Total relations checked: {summary['totalRelations']}",
                f"- Score >= 0.98: {summary['scoreAtLeast0_98']}",
                f"- Score >= 0.95: {summary['scoreAtLeast0_95']}",
                f"- Score >= 0.90: {summary['scoreAtLeast0_90']} ({summary['scoreAtLeast0_90Percent']}%)",
                f"- Score < 0.90: {summary['scoreBelow0_90']}",
                f"- Review needed: {summary['reviewNeeded']} ({summary['reviewNeededPercent']}%)",
                f"- Story-only review needed: {summary['storyOnlyReviewNeeded']}",
                f"- Entity type mismatches: {summary['entityTypeMismatches']}",
                "",
                "Review needed by role:",
                "",
                *[f"- {role}: {count}" for role, count in summary["roleReviewCounts"].items()],
                "",
                "Review needed by evidence source:",
                "",
                *[f"- {source}: {count}" for source, count in summary["sourceReviewCounts"].items()],
                "",
                "Interpretation:",
                "",
                "- Relations scoring 0.98+ are backed by the strongest structured evidence.",
                "- Relations scoring 0.90-0.97 are likely correct but may still need spot review for final game scripting.",
                "- Relations below 0.90, especially story-only category links, should be manually approved or removed.",
                "- A realistic 98-100% target means resolving the review queue, then rerunning this report.",
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    print(json.dumps(scored["qaSummary"], indent=2, ensure_ascii=False))
    print(qa_mapping_path)
    print(review_csv_path)
    print(report_path)


if __name__ == "__main__":
    main()
