import { SkillId } from "../../../../../../src/rs/skill/skills";
import type { IScriptRegistry, LocInteractionEvent, ScriptServices } from "../../../../../src/game/scripts/types";
import { getQuestFlag, setQuestFlag } from "../../QuestFlags";
import {
    completeQuest,
    getQuestStage,
    setQuestStage,
} from "../../QuestService";
import { buildCompleteJournal, buildNotStartedJournal, strikeIf } from "../../helpers";
import type { QuestDefinition } from "../../types";
import { addItemIfMissing, hasItem } from "../questUtils";

export const GARDEN_OF_DEATH_KEY = "garden_of_death";

/** TGOD_PRIMARY — see VarPlayerID.java */
const VARP_TGOD_PRIMARY = 3713;
const STAGE_STARTED = 1;
const STAGE_COMPLETE = 100;

/** OSRS object ids (wiki infobox). */
const TENT_LOC_ID = 46324;
const CAMPING_EQUIPMENT_LOC_ID = 46325;

const JOURNAL_ITEM_ID = 27511;
const SECATEURS_ITEM_ID = 5329;
const MAGIC_SECATEURS_ITEM_ID = 7409;

const MIN_FARMING_LEVEL = 20;

const FLAG_FOUND_GEAR = "found_gear";

function hasSecateurs(
    player: LocInteractionEvent["player"],
    services: ScriptServices,
): boolean {
    return (
        hasItem(player, services, SECATEURS_ITEM_ID) ||
        hasItem(player, services, MAGIC_SECATEURS_ITEM_ID)
    );
}

function farmingLevel(player: LocInteractionEvent["player"]): number {
    return player.skillSystem.getSkill(SkillId.Farming).baseLevel;
}

function send(player: LocInteractionEvent["player"], services: ScriptServices, text: string): void {
    services.messaging.sendGameMessage(player, text);
}

function handleTentSearch(event: LocInteractionEvent, quest: QuestDefinition): void {
    const { player, services } = event;
    const stage = getQuestStage(player, quest);

    if (stage >= STAGE_COMPLETE) {
        send(player, services, "You've already unravelled this campsite's mystery.");
        return;
    }

    if (stage < STAGE_STARTED) {
        if (farmingLevel(player) < MIN_FARMING_LEVEL) {
            send(
                player,
                services,
                `You need Farming level ${MIN_FARMING_LEVEL} to follow this trail.`,
            );
            return;
        }
        setQuestStage(player, quest, services, STAGE_STARTED);
        addItemIfMissing(player, services, JOURNAL_ITEM_ID);
        send(player, services, "You search the tent and find a journal. You take it.");
        return;
    }

    if (getQuestFlag(player, quest.key, FLAG_FOUND_GEAR) && hasSecateurs(player, services)) {
        send(
            player,
            services,
            "The journal's clues and Kasonde's gear are enough to press on into the ruins.",
        );
        completeQuest(player, services, quest);
        return;
    }

    send(
        player,
        services,
        "You should search the camping equipment nearby before heading into the Stranglewood.",
    );
}

function handleCampingEquipmentSearch(event: LocInteractionEvent, quest: QuestDefinition): void {
    const { player, services } = event;
    const stage = getQuestStage(player, quest);

    if (stage < STAGE_STARTED) {
        send(player, services, "There's an assortment of camping equipment here.");
        return;
    }

    if (stage >= STAGE_COMPLETE) {
        send(player, services, "You search through the camping equipment, but find nothing of interest.");
        return;
    }

    if (hasSecateurs(player, services)) {
        send(player, services, "You search through the camping equipment, but find nothing of interest.");
        setQuestFlag(player, quest.key, FLAG_FOUND_GEAR, true);
        return;
    }

    const added = services.inventory.addItemToInventory(player, SECATEURS_ITEM_ID, 1);
    if (added.added < 1) {
        send(
            player,
            services,
            "You search through the camping equipment and find some secateurs. However, you don't have enough room to take them.",
        );
        return;
    }

    services.inventory.snapshotInventory(player);
    setQuestFlag(player, quest.key, FLAG_FOUND_GEAR, true);
    send(player, services, "You search through the camping equipment and find some secateurs. You take them.");
}

function registerLocSearch(
    registry: IScriptRegistry,
    locId: number,
    handler: (event: LocInteractionEvent) => void,
): void {
    registry.registerLocInteraction(locId, handler, "search");
    registry.registerLocInteraction(locId, handler, "Search");
}

export const gardenOfDeathQuest: QuestDefinition = {
    key: GARDEN_OF_DEATH_KEY,
    name: "The Garden of Death",
    varpId: VARP_TGOD_PRIMARY,
    startedValue: STAGE_STARTED,
    completionValue: STAGE_COMPLETE,
    rewards: {
        questPoints: 1,
        xp: [{ skillId: SkillId.Farming, amount: 10_000, label: "Farming" }],
    },
    rewardItemId: JOURNAL_ITEM_ID,
    overviewStartText:
        "searching the <col=800000>tent</col> at the campsite east of the chasm in the southern Kebos Lowlands.",
    buildJournal(player, services) {
        const stage = getQuestStage(player, gardenOfDeathQuest);
        if (stage < STAGE_STARTED) {
            return buildNotStartedJournal(
                gardenOfDeathQuest,
                "I can start this quest by searching the tent at Kasonde's campsite in the Kebos Lowlands.",
                `I need Farming level ${MIN_FARMING_LEVEL}.`,
            );
        }
        if (stage >= STAGE_COMPLETE) {
            return buildCompleteJournal([
                "I searched Kasonde's tent and found his journal.",
                "I gathered secateurs from the campsite and followed the trail into the Stranglewood.",
            ]);
        }
        return [
            "Kasonde's journal speaks of ancient ruins and the Old Ones.",
            "",
            strikeIf(
                hasItem(player, services, JOURNAL_ITEM_ID),
                "Search the tent for Kasonde's journal.",
            ),
            strikeIf(
                getQuestFlag(player, gardenOfDeathQuest.key, FLAG_FOUND_GEAR) ||
                    hasSecateurs(player, services),
                "Search the camping equipment for secateurs.",
            ),
            "Return to the tent when I'm ready to continue.",
        ];
    },
    register(registry: IScriptRegistry): void {
        registerLocSearch(registry, TENT_LOC_ID, (event) =>
            handleTentSearch(event, gardenOfDeathQuest),
        );
        registerLocSearch(registry, CAMPING_EQUIPMENT_LOC_ID, (event) =>
            handleCampingEquipmentSearch(event, gardenOfDeathQuest),
        );
    },
};
