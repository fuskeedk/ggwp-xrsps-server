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
            with urllib.request.urlopen(req, timeout=40) as response:
                return json.load(response)
        except Exception as exc:
            last_error = exc
            time.sleep(0.6 * (attempt + 1))
    raise last_error


def clean_html(value):
    value = re.sub(r"<script[\s\S]*?</script>", " ", value)
    value = re.sub(r"<style[\s\S]*?</style>", " ", value)
    value = re.sub(r"<.*?>", " ", value)
    value = html.unescape(value)
    return re.sub(r"\s+", " ", value).strip()


def parse_tables_from_quest_list():
    data = request_json(
        {
            "action": "parse",
            "page": "Quests/List",
            "prop": "text",
            "format": "json",
        }
    )
    page_html = data["parse"]["text"]["*"]
    tables = re.findall(
        r'<table[^>]*class="[^"]*wikitable[\s\S]*?</table>', page_html
    )
    result = []
    for table_index, block in enumerate(tables):
        rows = re.findall(r"<tr[\s\S]*?</tr>", block)
        if not rows:
            continue
        header = clean_html(rows[0])
        is_normal_quest_table = (
            "Name Difficulty Length Series Release date" in header
            and "Quest Classifications" not in header
        )
        is_miniquest_table = (
            table_index == 4
            or (
                header.startswith("Name Difficulty Length Series Release date")
                and "Leagues region" in header
            )
        )
        if not is_normal_quest_table and not is_miniquest_table:
            continue

        quest_type = "miniquest" if is_miniquest_table else "quest"
        for row in rows[1:]:
            if "<td" not in row:
                continue
            cells = re.findall(r"<t[dh][^>]*>([\s\S]*?)</t[dh]>", row)
            if not cells:
                continue
            name_cell = cells[0] if quest_type == "miniquest" else cells[1]
            link = re.search(r'<a[^>]+href="/w/([^"#?]+)"[^>]*>([\s\S]*?)</a>', name_cell)
            if not link:
                continue
            title = urllib.parse.unquote(link.group(1)).replace("_", " ")
            display = clean_html(link.group(2))
            result.append(
                {
                    "title": title,
                    "name": display or title,
                    "type": quest_type,
                    "source": "Quests/List",
                }
            )
    return result


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
            content = ""
            revisions = page.get("revisions") or []
            if revisions:
                content = (
                    revisions[0]
                    .get("slots", {})
                    .get("main", {})
                    .get("content", "")
                )
            categories = [item.get("title", "") for item in page.get("categories", [])]
            pages[title] = {
                "title": title,
                "exists": not page.get("missing"),
                "content": content,
                "categories": categories,
            }
        time.sleep(0.1)
    return pages


def fetch_category_members(category_title):
    members = []
    cmcontinue = None
    while True:
        params = {
            "action": "query",
            "list": "categorymembers",
            "cmtitle": category_title,
            "cmnamespace": "0",
            "cmlimit": "500",
            "format": "json",
        }
        if cmcontinue:
            params["cmcontinue"] = cmcontinue
        data = request_json(params)
        members.extend(
            item["title"] for item in data.get("query", {}).get("categorymembers", [])
        )
        cont = data.get("continue")
        if not cont:
            break
        cmcontinue = cont.get("cmcontinue")
        if not cmcontinue:
            break
    time.sleep(0.05)
    return members


def extract_template(text, template_name):
    start = text.find("{{" + template_name)
    if start == -1:
        return ""
    depth = 0
    index = start
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
                return text[start:index]
            continue
        index += 1
    return text[start:]


def parse_template_params(template_text):
    params = {}
    current_key = None
    current_value = []
    for line in template_text.splitlines()[1:]:
        match = re.match(r"^\|([^=]+?)\s*=\s*(.*)$", line)
        if match:
            if current_key is not None:
                params[current_key] = "\n".join(current_value).strip()
            current_key = match.group(1).strip()
            current_value = [match.group(2)]
        elif current_key is not None:
            current_value.append(line)
    if current_key is not None:
        params[current_key] = "\n".join(current_value).strip()
    return params


def normalize_title(title):
    title = title.strip()
    title = re.sub(r"\s+", " ", title)
    return title[0].upper() + title[1:] if title else title


def extract_wikilinks(text):
    links = []
    pattern = re.compile(r"\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]")
    for match in pattern.finditer(text):
        target = normalize_title(match.group(1).replace("_", " "))
        label = match.group(2) or match.group(1)
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
        links.append(
            {
                "target": target,
                "label": clean_wiki(label),
                "start": match.start(),
                "end": match.end(),
                "raw": match.group(0),
            }
        )
    return links


def clean_wiki(value):
    value = re.sub(r"<ref[\s\S]*?</ref>", " ", value)
    value = re.sub(r"<[^>]+>", " ", value)
    value = re.sub(r"\{\{[^{}]*\}\}", " ", value)
    value = re.sub(r"\[\[([^\]|#]+)(?:#[^\]|]+)?\|([^\]]+)\]\]", r"\2", value)
    value = re.sub(r"\[\[([^\]|#]+)(?:#[^\]|]+)?\]\]", r"\1", value)
    value = value.replace("'''", "").replace("''", "")
    return re.sub(r"\s+", " ", html.unescape(value)).strip()


def get_walkthrough_text(text):
    match = re.search(r"^==\s*Walkthrough\s*==\s*$", text, flags=re.M)
    if not match:
        match = re.search(r"^==\s*Guide\s*==\s*$", text, flags=re.M)
    if not match:
        return text
    start = match.end()
    end_match = re.search(
        r"^==\s*(Rewards?|Transcript|Changes|Required for completing|Trivia|References|Music unlocked|Completion|Notes)\s*==\s*$",
        text[start:],
        flags=re.M,
    )
    end = start + end_match.start() if end_match else len(text)
    return text[start:end]


def classify_page(page):
    content = page.get("content", "")
    categories = set(page.get("categories", []))
    has_npc_infobox = re.search(r"\{\{\s*Infobox\s+NPC\b", content, flags=re.I)
    has_monster_infobox = re.search(r"\{\{\s*Infobox\s+Monster\b", content, flags=re.I)
    if has_npc_infobox:
        return "npc"
    if has_monster_infobox:
        return "monster"
    if any(
        cat in categories
        for cat in [
            "Category:Non-player characters",
            "Category:Quest NPCs",
            "Category:Free-to-play NPCs",
            "Category:Members' NPCs",
        ]
    ):
        return "npc"
    if any(
        cat in categories
        for cat in ["Category:Monsters", "Category:Quest monsters"]
    ):
        return "monster"
    return None


def role_from_context(context_before, context_line):
    before = context_before.lower()
    if re.search(
        r"\b(return|go back|bring|give|show|take|deliver|hand)\b.{0,100}\b(to|over to|back to)\b",
        before,
    ):
        return "turn_in"
    if re.search(r"\b(talk to|speak to|speak with|ask|tell|meet|find|visit|question)\b", before):
        return "helper"
    return None


def role_from_near_link_context(raw_line, link_start):
    delimiter_positions = [
        raw_line.rfind(delimiter, 0, link_start)
        for delimiter in [".", ",", ";", ":", "\n", "#"]
    ]
    segment_start = max(delimiter_positions)
    before = raw_line[segment_start + 1 : link_start].lower()
    before = re.sub(r"\[\[[^\]]*$", "", before)
    if len(before) > 130:
        before = before[-130:]
    if re.search(
        r"\b(return|go back|bring|give|show|take|deliver|hand)\b.{0,100}\b(to|over to|back to)\s*$",
        before,
    ):
        return "turn_in"
    if re.search(
        r"\b(talk to|speak to|speak with|ask|tell|meet|find|visit|question)\b(?:\s+(?:the|a|an|nearby|local|near|with|to|about|another|one|this|that|him|her|them|some|several|two|three|four|five|any|either|and|or))*\s*$",
        before,
    ):
        return "helper"
    if re.search(
        r"\b(talk to|speak to|speak with|meet|visit)\b.{0,80}\b(or|and)\s*$",
        before,
    ):
        return "helper"
    return None


def add_mapping(bucket, title, role, source, evidence, confidence="medium"):
    if not title:
        return
    title = normalize_title(title)
    entry = bucket.setdefault(
        title,
        {
            "pageTitle": title,
            "name": title,
            "entityType": None,
            "roles": [],
            "evidence": [],
        },
    )
    if role not in entry["roles"]:
        entry["roles"].append(role)
    if len(entry["evidence"]) < 8:
        entry["evidence"].append(
            {
                "role": role,
                "source": source,
                "confidence": confidence,
                "text": clean_wiki(evidence)[:240],
            }
        )


def analyse_quest(quest, page_content, category_members, page_index):
    mappings = {}
    details = parse_template_params(extract_template(page_content, "Quest details"))
    start_field = details.get("start", "")
    kills_field = details.get("kills", "")

    for link in extract_wikilinks(start_field):
        add_mapping(mappings, link["target"], "start", "quest_details.start", start_field, "high")

    for link in extract_wikilinks(kills_field):
        add_mapping(mappings, link["target"], "enemy", "quest_details.kills", kills_field, "medium")

    walkthrough = get_walkthrough_text(page_content)
    for image in re.findall(r"\[\[File:([^|\]]+?) chathead\.png", walkthrough, flags=re.I):
        add_mapping(mappings, image.strip(), "story", "walkthrough.chathead", image, "medium")

    for raw_line in re.split(r"\n+", walkthrough):
        if "[[" not in raw_line:
            continue
        plain_line = clean_wiki(raw_line)
        if not plain_line:
            continue
        for link in extract_wikilinks(raw_line):
            role = role_from_near_link_context(raw_line, link["start"])
            if role:
                add_mapping(mappings, link["target"], role, "walkthrough.interaction", plain_line, "medium")

    for member in category_members:
        add_mapping(mappings, member, "story", "quest_category", f"Category:{quest['title']}", "low")

    verified = {}
    for title, entry in mappings.items():
        page = page_index.get(title)
        if not page or not page.get("exists"):
            continue
        entity_type = classify_page(page)
        if not entity_type:
            continue
        entry["entityType"] = entity_type
        # Do not let a generic category story role hide more useful roles.
        role_order = {"start": 0, "helper": 1, "turn_in": 2, "enemy": 3, "story": 4}
        entry["roles"] = sorted(set(entry["roles"]), key=lambda role: role_order.get(role, 99))
        verified[title] = entry

    return {
        "title": quest["title"],
        "name": quest["name"],
        "type": quest["type"],
        "sourceUrl": "https://oldschool.runescape.wiki/w/" + urllib.parse.quote(quest["title"].replace(" ", "_")),
        "npcMappings": sorted(verified.values(), key=lambda item: item["pageTitle"]),
    }


def main():
    quests = parse_tables_from_quest_list()
    normal_quests = [quest for quest in quests if quest["type"] == "quest"]
    miniquests = [quest for quest in quests if quest["type"] == "miniquest"]

    quest_pages = fetch_pages([quest["title"] for quest in quests])

    category_by_quest = {}
    category_candidates = set()
    for quest in quests:
        members = fetch_category_members("Category:" + quest["title"])
        category_by_quest[quest["title"]] = members
        category_candidates.update(members)

    link_candidates = set(category_candidates)
    for quest in quests:
        content = quest_pages.get(quest["title"], {}).get("content", "")
        details = parse_template_params(extract_template(content, "Quest details"))
        for field in [details.get("start", ""), details.get("kills", ""), get_walkthrough_text(content)]:
            for link in extract_wikilinks(field):
                link_candidates.add(link["target"])
        for image in re.findall(r"\[\[File:([^|\]]+?) chathead\.png", get_walkthrough_text(content), flags=re.I):
            link_candidates.add(image.strip())

    linked_pages = fetch_pages(link_candidates)
    page_index = {**quest_pages, **linked_pages}

    quest_mappings = [
        analyse_quest(
            quest,
            quest_pages.get(quest["title"], {}).get("content", ""),
            category_by_quest.get(quest["title"], []),
            page_index,
        )
        for quest in quests
    ]

    normal_mappings = [quest for quest in quest_mappings if quest["type"] == "quest"]
    mini_mappings = [quest for quest in quest_mappings if quest["type"] == "miniquest"]

    def unique_titles(items, entity_type=None):
        titles = set()
        for quest in items:
            for mapping in quest["npcMappings"]:
                if entity_type is None or mapping["entityType"] == entity_type:
                    titles.add(mapping["pageTitle"])
        return titles

    def total_links(items):
        return sum(len(quest["npcMappings"]) for quest in items)

    def has_interaction_role(mapping):
        return any(role in mapping["roles"] for role in ["start", "helper", "turn_in", "enemy"])

    def unique_interaction_titles(items):
        titles = set()
        for quest in items:
            for mapping in quest["npcMappings"]:
                if has_interaction_role(mapping):
                    titles.add(mapping["pageTitle"])
        return titles

    def unique_story_only_titles(items):
        titles = set()
        for quest in items:
            for mapping in quest["npcMappings"]:
                if mapping["roles"] == ["story"]:
                    titles.add(mapping["pageTitle"])
        return titles

    counts = {
        "normalQuests": len(normal_quests),
        "miniquests": len(miniquests),
        "questLikeTotal": len(quests),
        "normalQuestNpcLinks": total_links(normal_mappings),
        "miniquestNpcLinks": total_links(mini_mappings),
        "questLikeNpcLinks": total_links(quest_mappings),
        "uniqueNormalQuestNpcs": len(unique_titles(normal_mappings, "npc")),
        "uniqueNormalQuestMonsters": len(unique_titles(normal_mappings, "monster")),
        "uniqueNormalQuestCharacters": len(unique_titles(normal_mappings)),
        "uniqueMiniquestNpcs": len(unique_titles(mini_mappings, "npc")),
        "uniqueMiniquestMonsters": len(unique_titles(mini_mappings, "monster")),
        "uniqueMiniquestCharacters": len(unique_titles(mini_mappings)),
        "uniqueQuestLikeNpcs": len(unique_titles(quest_mappings, "npc")),
        "uniqueQuestLikeMonsters": len(unique_titles(quest_mappings, "monster")),
        "uniqueQuestLikeCharacters": len(unique_titles(quest_mappings)),
        "uniqueNormalQuestInteractionCharacters": len(unique_interaction_titles(normal_mappings)),
        "uniqueMiniquestInteractionCharacters": len(unique_interaction_titles(mini_mappings)),
        "uniqueQuestLikeInteractionCharacters": len(unique_interaction_titles(quest_mappings)),
        "uniqueNormalQuestStoryOnlyCharacters": len(unique_story_only_titles(normal_mappings)),
        "uniqueMiniquestStoryOnlyCharacters": len(unique_story_only_titles(mini_mappings)),
        "uniqueQuestLikeStoryOnlyCharacters": len(unique_story_only_titles(quest_mappings)),
        "questsWithNoMappedCharacters": sum(1 for quest in normal_mappings if not quest["npcMappings"]),
        "miniquestsWithNoMappedCharacters": sum(1 for quest in mini_mappings if not quest["npcMappings"]),
    }

    role_counts = {}
    for quest in quest_mappings:
        for mapping in quest["npcMappings"]:
            for role in mapping["roles"]:
                role_counts[role] = role_counts.get(role, 0) + 1
    counts["roleLinks"] = dict(sorted(role_counts.items()))

    output = {
        "meta": {
            "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
            "language": "en",
            "sources": [
                "https://oldschool.runescape.wiki/w/Quests/List",
                "https://oldschool.runescape.wiki/api.php",
            ],
            "method": "Quest list from Quests/List; start/enemy roles from Quest details template; helper/turn-in roles from walkthrough interaction text; story roles from quest categories and chathead images. This is an automatic draft and should be manually reviewed before being treated as final game script data.",
        },
        "counts": counts,
        "quests": quest_mappings,
    }

    OUTPUTS.mkdir(exist_ok=True)
    mapping_path = OUTPUTS / "osrs-quest-npc-mapping.json"
    mapping_path.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")

    summary_path = OUTPUTS / "osrs-quest-npc-mapping-summary.md"
    summary_path.write_text(
        "\n".join(
            [
                "# OSRS Quest NPC Mapping Summary",
                "",
                "This is an automatic draft generated from OSRS Wiki data.",
                "",
                f"- Normal quests: {counts['normalQuests']}",
                f"- Miniquests: {counts['miniquests']}",
                f"- Quest-like total: {counts['questLikeTotal']}",
                f"- Normal quest NPC/monster links: {counts['normalQuestNpcLinks']}",
                f"- Miniquest NPC/monster links: {counts['miniquestNpcLinks']}",
                f"- Total quest-like NPC/monster links: {counts['questLikeNpcLinks']}",
                f"- Unique normal quest NPCs: {counts['uniqueNormalQuestNpcs']}",
                f"- Unique normal quest monsters: {counts['uniqueNormalQuestMonsters']}",
                f"- Unique normal quest NPCs + monsters: {counts['uniqueNormalQuestCharacters']}",
                f"- Unique miniquest NPCs: {counts['uniqueMiniquestNpcs']}",
                f"- Unique miniquest monsters: {counts['uniqueMiniquestMonsters']}",
                f"- Unique all quest-like NPCs: {counts['uniqueQuestLikeNpcs']}",
                f"- Unique all quest-like monsters: {counts['uniqueQuestLikeMonsters']}",
                f"- Unique all quest-like NPCs + monsters: {counts['uniqueQuestLikeCharacters']}",
                f"- Unique normal quest interaction NPCs/monsters: {counts['uniqueNormalQuestInteractionCharacters']}",
                f"- Unique miniquest interaction NPCs/monsters: {counts['uniqueMiniquestInteractionCharacters']}",
                f"- Unique all quest-like interaction NPCs/monsters: {counts['uniqueQuestLikeInteractionCharacters']}",
                f"- Unique normal quest story-only NPCs/monsters: {counts['uniqueNormalQuestStoryOnlyCharacters']}",
                f"- Unique miniquest story-only NPCs/monsters: {counts['uniqueMiniquestStoryOnlyCharacters']}",
                f"- Unique all quest-like story-only NPCs/monsters: {counts['uniqueQuestLikeStoryOnlyCharacters']}",
                f"- Normal quests with no mapped NPC/monster: {counts['questsWithNoMappedCharacters']}",
                f"- Miniquests with no mapped NPC/monster: {counts['miniquestsWithNoMappedCharacters']}",
                "",
                "Role link counts:",
                "",
                *[f"- {role}: {amount}" for role, amount in counts["roleLinks"].items()],
                "",
                "Notes:",
                "",
                "- `start` and `enemy` roles are the most reliable because they come from structured quest detail fields.",
                "- `helper`, `turn_in` and `story` roles are generated from walkthrough text, chathead images and quest categories.",
                "- This mapping should be treated as a strong first pass, not as final verified quest scripting.",
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    print(json.dumps(counts, indent=2, ensure_ascii=False))
    print(mapping_path)
    print(summary_path)


if __name__ == "__main__":
    main()
