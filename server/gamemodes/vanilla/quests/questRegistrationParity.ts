import fs from "fs";
import path from "path";

import { getQuestDefinitionList } from "./index";
import type { QuestDefinition } from "./types";

export type QuestReferenceEntry = {
    id: string;
    title: string;
    name?: string;
    type?: string;
};

/** Registered quest keys that differ from the OSRS reference quest id. */
export const REGISTERED_KEY_ALIASES: Record<string, string> = {
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

export type QuestRegistrationParityReport = {
    registeredCount: number;
    referenceCount: number;
    miniquestCount: number;
    missingFromRegistered: QuestReferenceEntry[];
    extraRegistered: QuestDefinition[];
    duplicateKeys: string[];
};

function normalizeTitle(title: string): string {
    return title
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/['']/g, "'")
        .replace(/[^a-z0-9']+/g, " ")
        .trim();
}

export function toReferenceQuestId(key: string): string {
    return REGISTERED_KEY_ALIASES[key] ?? key;
}

export function loadQuestReferenceEntries(
    referencePath = path.join(__dirname, "../../../data/quest-reference/quests.json"),
): QuestReferenceEntry[] {
    const parsed = JSON.parse(fs.readFileSync(referencePath, "utf8")) as { quests: QuestReferenceEntry[] };
    return parsed.quests;
}

export function validateQuestRegistration(
    registered = getQuestDefinitionList(),
    reference = loadQuestReferenceEntries(),
): QuestRegistrationParityReport {
    const registeredIds = new Set(registered.map((quest) => toReferenceQuestId(quest.key)));
    const registeredTitles = new Set(registered.map((quest) => normalizeTitle(quest.name)));
    const referenceIds = new Set(reference.map((quest) => quest.id));

    const missingFromRegistered = reference.filter(
        (quest) =>
            !registeredIds.has(quest.id) &&
            !registeredTitles.has(normalizeTitle(quest.title || quest.name || "")),
    );
    const extraRegistered = registered.filter((quest) => !referenceIds.has(toReferenceQuestId(quest.key)));
    const duplicateKeys = registered
        .map((quest) => quest.key)
        .filter((key, index, keys) => keys.indexOf(key) !== index);

    return {
        registeredCount: registered.length,
        referenceCount: reference.length,
        miniquestCount: reference.filter((quest) => quest.type === "miniquest").length,
        missingFromRegistered,
        extraRegistered,
        duplicateKeys: [...new Set(duplicateKeys)],
    };
}
