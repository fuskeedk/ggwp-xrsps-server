import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path


API = "https://oldschool.runescape.wiki/api.php"
USER_AGENT = "CodexOSRSPrototype/0.1 local-development"
ROOT = Path(__file__).resolve().parents[1]
SYSTEM_DIR = ROOT / "outputs" / "osrs-quest-system"
DATA_DIR = SYSTEM_DIR / "data"
RAW_DIR = ROOT / "work" / "raw" / "quest-pages"

SKILLS = {
    "Agility",
    "Attack",
    "Construction",
    "Cooking",
    "Crafting",
    "Defence",
    "Farming",
    "Firemaking",
    "Fishing",
    "Fletching",
    "Herblore",
    "Hitpoints",
    "Hunter",
    "Magic",
    "Mining",
    "Prayer",
    "Ranged",
    "Runecraft",
    "Slayer",
    "Smithing",
    "Strength",
    "Thieving",
    "Woodcutting",
    "Combat",
    "Sailing",
}


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
            revisions = page.get("revisions") or []
            content = ""
            if revisions:
                content = (
                    revisions[0]
                    .get("slots", {})
                    .get("main", {})
                    .get("content", "")
                )
            pages[page["title"]] = {"title": page["title"], "content": content}
            pages[page["title"]]["categories"] = [
                category.get("title", "") for category in page.get("categories", [])
            ]
        time.sleep(0.08)
    return pages


def extract_template(text, template_name):
    match = re.search(r"\{\{\s*" + re.escape(template_name) + r"\b", text, flags=re.I)
    if not match:
        return ""
    start = match.start()
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
    text = (template_text or "").strip()
    if not text.startswith("{{"):
        return {}
    if text.endswith("}}"):
        text = text[2:-2]
    else:
        text = text[2:]

    parts = []
    current = []
    brace_depth = 0
    link_depth = 0
    index = 0
    while index < len(text):
        pair = text[index : index + 2]
        if pair == "{{":
            brace_depth += 1
            current.append(pair)
            index += 2
            continue
        if pair == "}}" and brace_depth > 0:
            brace_depth -= 1
            current.append(pair)
            index += 2
            continue
        if pair == "[[":
            link_depth += 1
            current.append(pair)
            index += 2
            continue
        if pair == "]]" and link_depth > 0:
            link_depth -= 1
            current.append(pair)
            index += 2
            continue
        char = text[index]
        if char == "|" and brace_depth == 0 and link_depth == 0:
            parts.append("".join(current))
            current = []
        else:
            current.append(char)
        index += 1
    parts.append("".join(current))

    params = {}
    positional = 1
    for part in parts[1:]:
        if not part.strip():
            continue
        if "=" in part:
            key, value = part.split("=", 1)
            params[key.strip().lower()] = value.strip()
        else:
            params[str(positional)] = part.strip()
            positional += 1
    return params


def extract_section(text, heading_names):
    names = "|".join(re.escape(name) for name in heading_names)
    match = re.search(rf"^==\s*(?:{names})\s*==\s*$", text, flags=re.I | re.M)
    if not match:
        return ""
    start = match.end()
    end_match = re.search(r"^==[^=].*==\s*$", text[start:], flags=re.M)
    end = start + end_match.start() if end_match else len(text)
    return text[start:end].strip()


def extract_walkthrough_headings(text):
    walkthrough = extract_section(text, ["Walkthrough", "Guide"])
    if not walkthrough:
        return []
    headings = []
    for match in re.finditer(r"^(={3,5})\s*(.*?)\s*\1\s*$", walkthrough, flags=re.M):
        title = clean_text(match.group(2))
        if not title:
            continue
        headings.append(
            {
                "level": len(match.group(1)),
                "title": title,
            }
        )
    return headings


def extract_links(text):
    links = []
    for match in re.finditer(r"\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]", text or ""):
        target = match.group(1).replace("_", " ").strip()
        label = match.group(2) or match.group(1)
        if ":" in target:
            namespace = target.split(":", 1)[0].lower()
            if namespace in {"file", "image", "category", "template", "map", "module", "special"}:
                continue
        if target:
            links.append({"title": target[0].upper() + target[1:], "label": clean_text(label)})
    return links


def extract_scp_templates(text):
    results = []
    pattern = re.compile(r"\{\{\s*SCP\s*\|([^}|]+)(?:\|([^}|]+))?(?:\|([^}|]+))?[^}]*\}\}", flags=re.I)
    for match in pattern.finditer(text or ""):
        skill = clean_text(match.group(1))
        amount_raw = clean_text(match.group(2) or "")
        amount = parse_number(amount_raw)
        if skill in SKILLS:
            results.append(
                {
                    "skill": skill.lower(),
                    "value": amount,
                    "rawValue": amount_raw,
                }
            )
    return results


def extract_scp_template_matches(text):
    results = []
    pattern = re.compile(r"\{\{\s*SCP\s*\|([^}|]+)(?:\|([^}|]+))?(?:\|([^}|]+))?[^}]*\}\}", flags=re.I)
    for match in pattern.finditer(text or ""):
        skill = clean_text(match.group(1))
        amount_raw = clean_text(match.group(2) or "")
        results.append(
            {
                "skill": skill,
                "value": parse_number(amount_raw),
                "rawValue": amount_raw,
                "start": match.start(),
                "end": match.end(),
            }
        )
    return results


def parse_number(value):
    if value is None:
        return None
    value = str(value).replace(",", "")
    match = re.search(r"\d+", value)
    return int(match.group(0)) if match else None


def clean_text(value):
    value = value or ""
    value = re.sub(r"<!--[\s\S]*?-->", " ", value)
    value = re.sub(r"<ref[\s\S]*?</ref>", " ", value)
    value = re.sub(r"<[^>]+>", " ", value)
    value = re.sub(r"\{\{\s*SCP\s*\|([^}|]+)\|([^}|]+)[^}]*\}\}", r"\1 \2", value, flags=re.I)
    value = re.sub(r"\{\{\s*SCP\s*\|([^}|]+)[^}]*\}\}", r"\1", value, flags=re.I)
    value = re.sub(r"\{\{\s*FloorNumber\s*\|[^}]*\}\}", "floor", value, flags=re.I)
    value = re.sub(r"\{\{[^{}]*\}\}", " ", value)
    value = re.sub(r"\[\[([^\]|#]+)(?:#[^\]|]+)?\|([^\]]+)\]\]", r"\2", value)
    value = re.sub(r"\[\[([^\]|#]+)(?:#[^\]|]+)?\]\]", r"\1", value)
    value = value.replace("'''", "").replace("''", "")
    value = value.replace("&nbsp;", " ")
    return re.sub(r"\s+", " ", value).strip()


def bullets_from_text(text):
    bullets = []
    for line in (text or "").splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("*") or stripped.startswith("#"):
            bullets.append(clean_text(stripped.lstrip("*#").strip()))
    return [bullet for bullet in bullets if bullet]


def parse_quest_details(content):
    details = parse_template_params(extract_template(content, "Quest details"))
    return {
        "start": clean_text(details.get("start", "")),
        "startMap": clean_text(details.get("startmap", "")),
        "difficulty": clean_text(details.get("difficulty", "")),
        "length": clean_text(details.get("length", "")),
        "description": clean_text(details.get("description", "")),
        "requirementsText": clean_text(details.get("requirements", "")),
        "itemsText": clean_text(details.get("items", "")),
        "recommendedText": clean_text(details.get("recommended", "")),
        "killsText": clean_text(details.get("kills", "")),
        "raw": {
            "requirements": details.get("requirements", ""),
            "items": details.get("items", ""),
            "recommended": details.get("recommended", ""),
            "kills": details.get("kills", ""),
        },
    }


def parse_infobox(content):
    params = parse_template_params(extract_template(content, "Infobox Quest"))
    return {
        "number": parse_number(params.get("number")),
        "members": clean_text(params.get("members", "")),
        "series": clean_text(params.get("series", "")),
        "release": clean_text(params.get("release", "")),
        "developer": clean_text(params.get("developer", "")),
    }


def parse_requirements(details, quest_titles):
    raw = details["raw"]["requirements"]
    links = extract_links(raw)
    quest_requirements = []
    other_links = []
    for link in links:
        if link["title"] in quest_titles:
            quest_requirements.append(link["title"])
        else:
            other_links.append(link)
    skills = []
    for entry in extract_scp_templates(raw):
        if entry["value"] is not None:
            skills.append({"skill": entry["skill"], "level": entry["value"]})
    quest_point_requirement = None
    for entry in extract_scp_template_matches(raw):
        if entry["skill"].lower() == "quest" and entry["value"] is not None:
            quest_point_requirement = entry["value"]
    return {
        "text": details["requirementsText"],
        "skillRequirements": unique_dicts(skills, ("skill", "level")),
        "questPointRequirement": quest_point_requirement,
        "questRequirements": sorted(set(quest_requirements)),
        "otherLinkedRequirements": unique_links(other_links),
    }


def parse_items(details):
    raw = details["raw"]["items"]
    links = extract_links(raw)
    return {
        "text": details["itemsText"],
        "itemCandidates": unique_links(links),
        "itemRequirements": [],
        "nonItemLinks": [],
        "bullets": bullets_from_text(raw),
    }


def parse_recommended(details):
    raw = details["raw"]["recommended"]
    return {
        "text": details["recommendedText"],
        "skillRecommendations": [
            {"skill": entry["skill"], "level": entry["value"]}
            for entry in extract_scp_templates(raw)
            if entry["value"] is not None
        ],
        "linkedRecommendations": unique_links(extract_links(raw)),
        "bullets": bullets_from_text(raw),
    }


def parse_kills(details):
    raw = details["raw"]["kills"]
    return {
        "text": details["killsText"],
        "enemyCandidates": unique_links(extract_links(raw)),
        "bullets": bullets_from_text(raw),
    }


def parse_rewards(content):
    rewards_section = extract_section(content, ["Rewards", "Reward"])
    rewards_template = extract_template(rewards_section, "Quest rewards")
    params = parse_template_params(rewards_template)
    rewards_raw = params.get("rewards", rewards_section)
    qp = parse_number(params.get("qp"))
    xp_rewards = []
    for entry in extract_scp_template_matches(rewards_raw):
        context = clean_text(rewards_raw[entry["end"] : entry["end"] + 120]).lower()
        if (
            entry["skill"] in SKILLS
            and entry["skill"] not in {"Combat", "Quest"}
            and entry["value"] is not None
            and ("experience" in context or " xp" in context)
        ):
            xp_rewards.append(
                {
                    "skill": entry["skill"].lower(),
                    "amount": entry["value"],
                    "rawValue": entry["rawValue"],
                }
            )
    return {
        "questPoints": qp,
        "text": clean_text(rewards_raw),
        "bullets": bullets_from_text(rewards_raw),
        "xpRewards": unique_dicts(xp_rewards, ("skill", "amount", "rawValue")),
        "rewardCandidates": unique_links(extract_links(rewards_raw)),
        "hasRewardsSection": bool(rewards_section),
    }


def build_steps(quest, walkthrough_headings):
    steps = [{"id": 10, "title": "Start", "type": "start", "npcIds": quest.get("startNpcIds", [])}]
    next_id = 20
    for heading in walkthrough_headings[:30]:
        steps.append({"id": next_id, "title": heading["title"], "type": "walkthrough_heading"})
        next_id += 10
    if quest.get("enemyNpcIds"):
        steps.append({"id": 70, "title": "Quest enemy encounter", "type": "enemy", "npcIds": quest["enemyNpcIds"]})
    if quest.get("turnInNpcIds"):
        steps.append({"id": 90, "title": "Turn in", "type": "turn_in", "npcIds": quest["turnInNpcIds"]})
    steps.append({"id": 100, "title": "Complete", "type": "complete"})
    # Keep stable order and remove duplicate ids caused by long walkthroughs.
    used = set()
    normalized = []
    for step in sorted(steps, key=lambda item: item["id"]):
        step = dict(step)
        while step["id"] in used:
            step["id"] += 1
        used.add(step["id"])
        normalized.append(step)
    return normalized


def unique_links(links):
    seen = set()
    output = []
    for link in links:
        key = (link["title"], link.get("label", ""))
        if key in seen:
            continue
        seen.add(key)
        output.append(link)
    return output


def unique_dicts(items, keys):
    seen = set()
    output = []
    for item in items:
        key = tuple(item.get(name) for name in keys)
        if key in seen:
            continue
        seen.add(key)
        output.append(item)
    return output


def quality_for_script(requirements, rewards, steps):
    score = 0
    if requirements["text"] or requirements["skillRequirements"] or requirements["questRequirements"]:
        score += 1
    if rewards["hasRewardsSection"]:
        score += 1
    if steps:
        score += 1
    if rewards["questPoints"] is not None:
        score += 1
    if score >= 4:
        return "high"
    if score >= 2:
        return "medium"
    return "low"


def classify_link_page(page):
    content = page.get("content", "")
    categories = set(page.get("categories", []))
    if re.search(r"\{\{\s*Infobox\s+Item\b", content, flags=re.I):
        return "item"
    if "Category:Items" in categories or "Category:Grand Exchange items" in categories:
        return "item"
    if re.search(r"\{\{\s*Infobox\s+NPC\b", content, flags=re.I):
        return "npc"
    if re.search(r"\{\{\s*Infobox\s+Monster\b", content, flags=re.I):
        return "monster"
    if re.search(r"\{\{\s*Infobox\s+Location\b", content, flags=re.I):
        return "location"
    if "Category:Skills" in categories:
        return "skill"
    return "other"


def infer_item_quantity(link, bullets):
    title = link["title"].lower()
    label = (link.get("label") or link["title"]).lower()
    names = sorted({title, label, singularize(label), singularize(title)}, key=len, reverse=True)
    for bullet in bullets:
        lower = bullet.lower()
        for name in names:
            position = lower.find(name)
            if position == -1:
                continue
            before = lower[:position]
            numbers = re.findall(r"(?<!level\s)(?<!level )\b\d[\d,]*\b", before)
            if numbers:
                return parse_number(numbers[-1]) or 1
            return 1
    return 1


def singularize(value):
    if value.endswith("ies"):
        return value[:-3] + "y"
    if value.endswith("s") and not value.endswith("ss"):
        return value[:-1]
    return value


def enrich_item_requirements(scripts):
    titles = sorted(
        {
            link["title"]
            for script in scripts
            for link in script["items"]["itemCandidates"]
        }
    )
    pages = fetch_pages(titles)
    for script in scripts:
        item_requirements_by_title = {}
        non_item_links = []
        for link in script["items"]["itemCandidates"]:
            page = pages.get(link["title"], {})
            page_type = classify_link_page(page)
            enriched = {**link, "pageType": page_type}
            if page_type == "item":
                occurrences = infer_item_occurrences(link, script["items"]["bullets"])
                current = item_requirements_by_title.setdefault(
                    link["title"],
                    {
                        "title": link["title"],
                        "label": link.get("label", link["title"]),
                        "quantity": 1,
                        "requirementType": "contextual",
                        "occurrences": [],
                    },
                )
                current["occurrences"].extend(occurrences)
                direct_quantities = [
                    item["quantity"] for item in current["occurrences"] if item["direct"]
                ]
                all_quantities = [item["quantity"] for item in current["occurrences"]]
                current["quantity"] = max(direct_quantities or all_quantities or [1])
                current["requirementType"] = "direct" if direct_quantities else "contextual"
            else:
                non_item_links.append(enriched)
        script["items"]["itemRequirements"] = list(item_requirements_by_title.values())
        script["items"]["nonItemLinks"] = non_item_links
    return scripts


def infer_item_occurrences(link, bullets):
    title = link["title"].lower()
    label = (link.get("label") or link["title"]).lower()
    names = sorted({title, label, singularize(label), singularize(title)}, key=len, reverse=True)
    occurrences = []
    seen = set()
    for bullet in bullets:
        lower = bullet.lower()
        for name in names:
            start = 0
            while True:
                position = lower.find(name, start)
                if position == -1:
                    break
                start = position + max(len(name), 1)
                key = (bullet, name, position)
                if key in seen:
                    continue
                seen.add(key)
                before = lower[:position]
                numbers = re.findall(r"(?<!level\s)(?<!level )\b\d[\d,]*\b", before)
                quantity = parse_number(numbers[-1]) if numbers else 1
                prefix = before.strip()
                direct = bool(
                    prefix == ""
                    or re.fullmatch(r"\d[\d,]*", prefix)
                    or re.fullmatch(r"(?:one|two|three|four|five|six|seven|eight|nine|ten)", prefix)
                )
                occurrences.append(
                    {
                        "quantity": quantity or 1,
                        "direct": direct,
                        "bullet": bullet,
                    }
                )
    return occurrences or [{"quantity": 1, "direct": False, "bullet": ""}]


def main():
    quest_data = json.loads((DATA_DIR / "quests.json").read_text(encoding="utf-8"))
    quests = quest_data["quests"]
    quest_titles = {quest["title"] for quest in quests}
    pages = fetch_pages([quest["title"] for quest in quests])
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    scripts = []
    for quest in quests:
        page = pages.get(quest["title"], {"content": ""})
        content = page["content"]
        (RAW_DIR / f"{quest['id']}.wiki").write_text(content, encoding="utf-8")
        details = parse_quest_details(content)
        infobox = parse_infobox(content)
        requirements = parse_requirements(details, quest_titles)
        items = parse_items(details)
        recommended = parse_recommended(details)
        kills = parse_kills(details)
        rewards = parse_rewards(content)
        headings = extract_walkthrough_headings(content)
        steps = build_steps(quest, headings)

        scripts.append(
            {
                "questId": quest["id"],
                "questTitle": quest["title"],
                "questName": quest["name"],
                "questType": quest["type"],
                "sourceUrl": quest["sourceUrl"],
                "infobox": infobox,
                "details": {
                    "start": details["start"],
                    "startMap": details["startMap"],
                    "difficulty": details["difficulty"],
                    "length": details["length"],
                    "description": details["description"],
                },
                "requirements": requirements,
                "items": items,
                "recommended": recommended,
                "kills": kills,
                "rewards": rewards,
                "steps": steps,
                "quality": quality_for_script(requirements, rewards, steps),
            }
        )

    scripts = enrich_item_requirements(scripts)

    meta = {
        "language": "en",
        "source": "OSRS Wiki API",
        "questListSource": "https://oldschool.runescape.wiki/w/Quests/List",
        "wikiApiSource": API,
        "notes": [
            "Quest facts are imported from Quest details and Rewards sections.",
            "Walkthrough step text is reduced to headings only.",
            "This data is suitable for game scripting, but edge cases still need playtesting.",
        ],
        "counts": {
            "scripts": len(scripts),
            "highQuality": sum(1 for script in scripts if script["quality"] == "high"),
            "mediumQuality": sum(1 for script in scripts if script["quality"] == "medium"),
            "lowQuality": sum(1 for script in scripts if script["quality"] == "low"),
            "withQuestPoints": sum(1 for script in scripts if script["rewards"]["questPoints"] is not None),
            "withSkillRequirements": sum(1 for script in scripts if script["requirements"]["skillRequirements"]),
            "withQuestRequirements": sum(1 for script in scripts if script["requirements"]["questRequirements"]),
            "withXpRewards": sum(1 for script in scripts if script["rewards"]["xpRewards"]),
            "withItemRequirements": sum(1 for script in scripts if script["items"]["itemRequirements"]),
            "itemRequirementLinks": sum(len(script["items"]["itemRequirements"]) for script in scripts),
        },
    }

    (DATA_DIR / "quest-scripts.json").write_text(
        json.dumps({"meta": meta, "scripts": scripts}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(json.dumps(meta["counts"], indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
