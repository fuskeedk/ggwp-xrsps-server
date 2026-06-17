import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUTS = ROOT / "outputs"
SYSTEM_DIR = OUTPUTS / "osrs-quest-system"
DATA_DIR = SYSTEM_DIR / "data"


ROLE_ORDER = {"start": 0, "helper": 1, "turn_in": 2, "enemy": 3, "story": 4}


def slugify(value):
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    ascii_value = ascii_value.lower()
    ascii_value = re.sub(r"[^a-z0-9]+", "_", ascii_value).strip("_")
    return ascii_value or "entry"


def unique_slug(value, seen):
    base = slugify(value)
    candidate = base
    index = 2
    while candidate in seen:
        candidate = f"{base}_{index}"
        index += 1
    seen.add(candidate)
    return candidate


def sorted_roles(roles):
    return sorted(set(roles), key=lambda role: ROLE_ORDER.get(role, 99))


def make_start_node(dialogue, quest, npc, start_npcs):
    return {
        "id": f"{dialogue['id']}.start.not_started",
        "when": {"questState": "not_started"},
        "speaker": npc["name"],
        "text": (
            f"I have something connected to {quest['name']}. "
            "If you want to take it on, I can add it to your quest journal."
        ),
        "choices": [
            {
                "id": "accept",
                "text": f"Start {quest['name']}.",
                "response": f"Good. {quest['name']} has been added to your quest journal.",
                "actions": [
                    {"type": "startQuest", "questId": quest["id"], "stage": 10, "checkRequirements": True},
                    {
                        "type": "recordNpcInteraction",
                        "questId": quest["id"],
                        "npcId": npc["id"],
                        "role": "start",
                    },
                ],
            },
            {
                "id": "decline",
                "text": "Not right now.",
                "response": "Very well. Come back when you are ready.",
                "actions": [],
            },
        ],
    }


def make_not_started_hint_node(dialogue, quest, npc, start_npcs):
    start_names = ", ".join(start_npcs) if start_npcs else "the quest starter"
    return {
        "id": f"{dialogue['id']}.hint.not_started",
        "when": {"questState": "not_started"},
        "speaker": npc["name"],
        "text": (
            f"{quest['name']} has not been started yet. "
            f"You should begin with {start_names} before this part matters."
        ),
        "choices": [
            {
                "id": "close",
                "text": "Thanks.",
                "response": "Keep your journal close. It will help you keep track.",
                "actions": [],
            }
        ],
    }


def make_progress_node(dialogue, quest, npc, role):
    role_text = {
        "start": "You already have this quest in your journal. Keep following the leads you have been given.",
        "helper": "This is one of the people or places connected to your current step. Ask what you need, then continue the trail.",
        "turn_in": "This is a hand-in or progress point for the quest. If you have reached this step, continue here.",
        "story": "This character is part of the story around the quest. Their presence helps anchor the scene.",
        "enemy": "This opponent is tied to the quest. Fight it only when your journal or current step calls for it.",
    }[role]
    action_type = "recordEnemyEncounter" if role == "enemy" else "recordNpcInteraction"
    return {
        "id": f"{dialogue['id']}.{role}.in_progress",
        "when": {"questState": "in_progress"},
        "speaker": npc["name"],
        "text": f"For {quest['name']}: {role_text}",
        "choices": [
            {
                "id": f"continue_{role}",
                "text": "Continue.",
                "response": "Your quest journal has been updated.",
                "actions": [
                    {
                        "type": action_type,
                        "questId": quest["id"],
                        "npcId": npc["id"],
                        "role": role,
                    },
                    {
                        "type": "advanceQuestStage",
                        "questId": quest["id"],
                        "stage": {"start": 10, "helper": 30, "turn_in": 80, "enemy": 50, "story": 20}[role],
                    },
                ],
            }
        ],
    }


def make_ready_turn_in_node(dialogue, quest, npc):
    return {
        "id": f"{dialogue['id']}.turn_in.ready",
        "when": {"questState": "in_progress", "questReady": True},
        "speaker": npc["name"],
        "text": (
            f"If you are ready to finish {quest['name']}, I can close this part of the quest for you."
        ),
        "choices": [
            {
                "id": "complete",
                "text": f"Complete {quest['name']}.",
                "response": f"{quest['name']} is complete.",
                "actions": [
                    {
                        "type": "recordNpcInteraction",
                        "questId": quest["id"],
                        "npcId": npc["id"],
                        "role": "turn_in",
                    },
                    {"type": "completeQuest", "questId": quest["id"]},
                ],
            }
        ],
    }


def make_completed_node(dialogue, quest, npc):
    return {
        "id": f"{dialogue['id']}.completed",
        "when": {"questState": "completed"},
        "speaker": npc["name"],
        "text": f"{quest['name']} is already complete. Whatever happened there, your part in it is done.",
        "choices": [{"id": "close", "text": "Goodbye.", "response": "Safe travels.", "actions": []}],
    }


def build_dialogue(quest, npc, roles, start_npcs):
    dialogue = {
        "id": f"{quest['id']}__{npc['id']}",
        "questId": quest["id"],
        "questName": quest["name"],
        "npcId": npc["id"],
        "npcName": npc["name"],
        "entityType": npc["entityType"],
        "roles": roles,
        "nodes": [],
    }

    if "start" in roles:
        dialogue["nodes"].append(make_start_node(dialogue, quest, npc, start_npcs))
    else:
        dialogue["nodes"].append(make_not_started_hint_node(dialogue, quest, npc, start_npcs))

    for role in roles:
        dialogue["nodes"].append(make_progress_node(dialogue, quest, npc, role))
        if role == "turn_in":
            dialogue["nodes"].append(make_ready_turn_in_node(dialogue, quest, npc))

    dialogue["nodes"].append(make_completed_node(dialogue, quest, npc))
    return dialogue


def main():
    source_path = OUTPUTS / "osrs-quest-npc-mapping-final.json"
    source = json.loads(source_path.read_text(encoding="utf-8"))

    quest_seen = set()
    npc_seen = set()
    quest_title_to_id = {}
    npc_title_to_id = {}

    for quest in source["quests"]:
        quest_title_to_id[quest["title"]] = unique_slug(quest["title"], quest_seen)
        for mapping in quest["npcMappings"]:
            if mapping["pageTitle"] not in npc_title_to_id:
                npc_title_to_id[mapping["pageTitle"]] = unique_slug(mapping["pageTitle"], npc_seen)

    quests = []
    npc_records = {}
    npc_quest_links = defaultdict(list)
    dialogues = []

    for order, quest in enumerate(source["quests"], start=1):
        quest_id = quest_title_to_id[quest["title"]]
        participants = []
        role_to_npcs = defaultdict(list)

        for mapping in quest["npcMappings"]:
            npc_id = npc_title_to_id[mapping["pageTitle"]]
            roles = sorted_roles(mapping["roles"])
            participant = {
                "npcId": npc_id,
                "name": mapping["name"],
                "pageTitle": mapping["pageTitle"],
                "entityType": mapping["entityType"],
                "roles": roles,
            }
            participants.append(participant)
            for role in roles:
                role_to_npcs[role].append(npc_id)
            npc_records[npc_id] = {
                "id": npc_id,
                "name": mapping["name"],
                "pageTitle": mapping["pageTitle"],
                "entityType": mapping["entityType"],
                "sourceUrl": "https://oldschool.runescape.wiki/w/" + mapping["pageTitle"].replace(" ", "_"),
            }
            npc_quest_links[npc_id].append(
                {
                    "questId": quest_id,
                    "questName": quest["name"],
                    "questType": quest["type"],
                    "roles": roles,
                }
            )

        quest_record = {
            "id": quest_id,
            "order": order,
            "title": quest["title"],
            "name": quest["name"],
            "type": quest["type"],
            "sourceUrl": quest["sourceUrl"],
            "status": "generated_from_quest_list_mapping",
            "startNpcIds": sorted(role_to_npcs.get("start", [])),
            "helperNpcIds": sorted(role_to_npcs.get("helper", [])),
            "turnInNpcIds": sorted(role_to_npcs.get("turn_in", [])),
            "enemyNpcIds": sorted(role_to_npcs.get("enemy", [])),
            "storyNpcIds": sorted(role_to_npcs.get("story", [])),
            "participants": sorted(participants, key=lambda item: (item["entityType"], item["name"])),
            "stages": [
                {"id": 0, "name": "Not started"},
                {"id": 10, "name": "Started"},
                {"id": 20, "name": "Story context"},
                {"id": 30, "name": "Helper interaction"},
                {"id": 50, "name": "Enemy encounter"},
                {"id": 80, "name": "Turn-in point"},
                {"id": 100, "name": "Completed"},
            ],
        }
        quests.append(quest_record)

    for npc_id, npc in npc_records.items():
        npc["quests"] = sorted(npc_quest_links[npc_id], key=lambda item: item["questId"])

    npc_list = sorted(npc_records.values(), key=lambda item: item["name"])
    quest_lookup = {quest["id"]: quest for quest in quests}
    npc_lookup = {npc["id"]: npc for npc in npc_list}

    for quest in quests:
        start_npcs = [npc_lookup[npc_id]["name"] for npc_id in quest["startNpcIds"]]
        for participant in quest["participants"]:
            npc = npc_lookup[participant["npcId"]]
            dialogues.append(build_dialogue(quest, npc, participant["roles"], start_npcs))

    meta = {
        "language": "en",
        "source": "osrs-quest-npc-mapping-final.json",
        "questListSource": "https://oldschool.runescape.wiki/w/Quests/List",
        "wikiApiSource": "https://oldschool.runescape.wiki/api.php",
        "dialoguePolicy": "Original generated dialogue. Does not copy OSRS quest dialogue.",
        "counts": {
            "quests": len(quests),
            "npcs": len(npc_list),
            "dialogues": len(dialogues),
        },
    }

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    (DATA_DIR / "quests.json").write_text(
        json.dumps({"meta": meta, "quests": quests}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    (DATA_DIR / "npcs.json").write_text(
        json.dumps({"meta": meta, "npcs": npc_list}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    (DATA_DIR / "dialogues.json").write_text(
        json.dumps({"meta": meta, "dialogues": dialogues}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    print(json.dumps(meta["counts"], indent=2))


if __name__ == "__main__":
    main()
