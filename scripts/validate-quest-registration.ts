import fs from "fs";
import path from "path";
import { getQuestDefinitionList } from "../server/gamemodes/vanilla/quests/index";

type QuestReferenceEntry = {
    id: string;
    title: string;
    name?: string;
    type?: string;
};

/** Registered quest keys that differ from the OSRS reference quest id. */
const REGISTERED_KEY_ALIASES: Record<string, string> = {
    cooks_assistant: "cook_s_assistant",
    dorics_quest: "doric_s_quest",
    restless_ghost: "the_restless_ghost",
    pirates_treasure: "pirate_s_treasure",
    witchs_potion: "witch_s_potion",
    romeo_and_juliet: "romeo_juliet",
    gertrudes_cat: "gertrude_s_cat",
    merlins_crystal: "merlin_s_crystal",
    witchs_house: "witch_s_house",
    monks_friend: "monk_s_friend",
    eadgars_ruse: "eadgar_s_ruse",
    knights_sword: "the_knight_s_sword",
    garden_of_death: "the_garden_of_death",
};

function normalizeTitle(title: string): string {
    return title
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/['']/g, "'")
        .replace(/[^a-z0-9']+/g, " ")
        .trim();
}

function toReferenceId(key: string): string {
    return REGISTERED_KEY_ALIASES[key] ?? key;
}

function loadReferenceQuests(): QuestReferenceEntry[] {
    const referencePath = path.join(__dirname, "../server/data/quest-reference/quests.json");
    const parsed = JSON.parse(fs.readFileSync(referencePath, "utf8")) as { quests: QuestReferenceEntry[] };
    return parsed.quests;
}

function main(): void {
    const registered = getQuestDefinitionList();
    const reference = loadReferenceQuests();

    const registeredIds = new Set(registered.map((quest) => toReferenceId(quest.key)));
    const registeredTitles = new Set(registered.map((quest) => normalizeTitle(quest.name)));
    const referenceIds = new Set(reference.map((quest) => quest.id));

    const missingFromRegistered = reference.filter(
        (quest) => !registeredIds.has(quest.id) && !registeredTitles.has(normalizeTitle(quest.title || quest.name)),
    );
    const extraRegistered = registered.filter((quest) => !referenceIds.has(toReferenceId(quest.key)));

    const duplicateKeys = registered
        .map((quest) => quest.key)
        .filter((key, index, keys) => keys.indexOf(key) !== index);

    const miniquests = reference.filter((quest) => quest.type === "miniquest");

    console.log("Quest registration parity");
    console.log("=".repeat(40));
    console.log(`Registered definitions: ${registered.length}`);
    console.log(`Reference definitions:  ${reference.length}`);
    console.log(`Reference miniquests:   ${miniquests.length}`);
    console.log(`Missing from registered: ${missingFromRegistered.length}`);
    console.log(`Extra registered:        ${extraRegistered.length}`);
    console.log(`Duplicate keys:          ${duplicateKeys.length}`);

    let failed = false;

    if (missingFromRegistered.length > 0) {
        failed = true;
        console.log("\nMissing quests:");
        for (const quest of missingFromRegistered) {
            console.log(`  - ${quest.id} (${quest.title})`);
        }
    }

    if (extraRegistered.length > 0) {
        failed = true;
        console.log("\nExtra registered quests:");
        for (const quest of extraRegistered) {
            console.log(`  + ${quest.key} (${quest.name})`);
        }
    }

    if (duplicateKeys.length > 0) {
        failed = true;
        console.log("\nDuplicate keys:");
        for (const key of [...new Set(duplicateKeys)]) {
            console.log(`  ! ${key}`);
        }
    }

    if (failed) {
        process.exit(1);
    }

    console.log("\nOK: registered quests match the 209-entry quest reference.");
}

main();
