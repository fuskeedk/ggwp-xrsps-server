import type { GamemodeQuestListGroup } from "../../../src/game/gamemodes/GamemodeDefinition";
import { getRegisteredQuests } from "../quests";
import { F2P_QUEST_NAMES } from "../quests/questCatalog";
import { getAllCacheQuestDisplayNames } from "./questListData";

export function buildVanillaQuestListGroups(): readonly GamemodeQuestListGroup[] {
    const cacheNames = getAllCacheQuestDisplayNames();
    if (cacheNames && cacheNames.length > 0) {
        const f2pLower = new Set(F2P_QUEST_NAMES.map((name) => name.toLowerCase()));
        const freeQuests: string[] = [];
        const memberQuests: string[] = [];
        for (const name of cacheNames) {
            if (f2pLower.has(name.toLowerCase())) {
                freeQuests.push(name);
            } else {
                memberQuests.push(name);
            }
        }
        const groups: GamemodeQuestListGroup[] = [];
        if (freeQuests.length > 0) groups.push({ title: "Free Quests", quests: freeQuests });
        if (memberQuests.length > 0) groups.push({ title: "Members' Quests", quests: memberQuests });
        return groups;
    }

    const registered = getRegisteredQuests();
    if (registered.length === 0) return [];
    return [{ title: "Free Quests", quests: registered.map((quest) => quest.key) }];
}
