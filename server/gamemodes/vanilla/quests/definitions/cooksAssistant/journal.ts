import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { getQuestFlag } from "../../QuestFlags";
import { countCarriedItem } from "../../QuestService";
import { buildCompleteJournal, buildNotStartedJournal, strikeIf } from "../../helpers";
import type { QuestDefinition } from "../../types";
import {
    COOKS_ASSISTANT_KEY,
    EGG_ITEM_ID,
    FLAG_GIVEN_EGG,
    FLAG_GIVEN_FLOUR,
    FLAG_GIVEN_MILK,
    POT_OF_FLOUR_ITEM_ID,
    BUCKET_OF_MILK_ITEM_ID,
    STAGE_COMPLETE,
    STAGE_STARTED,
    VARP_COOKS_ASSISTANT,
} from "./constants";

function hasMilk(player: PlayerState, services: ScriptServices): boolean {
    return (
        getQuestFlag(player, COOKS_ASSISTANT_KEY, FLAG_GIVEN_MILK) ||
        countCarriedItem(player, services, BUCKET_OF_MILK_ITEM_ID) > 0
    );
}

function hasEgg(player: PlayerState, services: ScriptServices): boolean {
    return (
        getQuestFlag(player, COOKS_ASSISTANT_KEY, FLAG_GIVEN_EGG) ||
        countCarriedItem(player, services, EGG_ITEM_ID) > 0
    );
}

function hasFlour(player: PlayerState, services: ScriptServices): boolean {
    return (
        getQuestFlag(player, COOKS_ASSISTANT_KEY, FLAG_GIVEN_FLOUR) ||
        countCarriedItem(player, services, POT_OF_FLOUR_ITEM_ID) > 0
    );
}

export function buildCooksAssistantJournal(
    player: PlayerState,
    services: ScriptServices,
): string[] {
    const stage = player.varps.getVarpValue(VARP_COOKS_ASSISTANT);
    if (stage >= STAGE_COMPLETE) {
        return buildCompleteJournal([
            "It was the Duke of Lumbridge's birthday, but his cook had forgotten to buy the ingredients he needed to make him a cake.",
            "I brought the cook an egg, some flour and some milk and the cook made a delicious-looking cake with them.",
            "As a reward he now lets me use his high-quality range whenever I wish to cook there.",
        ]);
    }
    if (stage >= STAGE_STARTED) {
        return [
            "It's the <col=800000>Duke of Lumbridge's</col> birthday and I have to help his <col=800000>Cook</col> make him a <col=800000>birthday cake</col>. To do this I need to bring him the following ingredients:",
            "",
            strikeIf(
                getQuestFlag(player, COOKS_ASSISTANT_KEY, FLAG_GIVEN_MILK),
                "I have given the cook a bucket of milk.",
            ),
            strikeIf(
                !getQuestFlag(player, COOKS_ASSISTANT_KEY, FLAG_GIVEN_MILK) &&
                    countCarriedItem(player, services, BUCKET_OF_MILK_ITEM_ID) > 0,
                "I have found a bucket of milk to give to the cook.",
            ),
            !hasMilk(player, services)
                ? "I need to find a bucket of milk. There's a cattle field east of Lumbridge, I should make sure I take an empty bucket with me."
                : "",
            "",
            strikeIf(
                getQuestFlag(player, COOKS_ASSISTANT_KEY, FLAG_GIVEN_FLOUR),
                "I have given the cook a pot of flour.",
            ),
            strikeIf(
                !getQuestFlag(player, COOKS_ASSISTANT_KEY, FLAG_GIVEN_FLOUR) &&
                    countCarriedItem(player, services, POT_OF_FLOUR_ITEM_ID) > 0,
                "I have found a pot of flour to give to the cook.",
            ),
            !hasFlour(player, services)
                ? "I need to find a pot of flour. There's a mill found north-west of Lumbridge, I should take an empty pot with me."
                : "",
            "",
            strikeIf(
                getQuestFlag(player, COOKS_ASSISTANT_KEY, FLAG_GIVEN_EGG),
                "I have given the cook an egg.",
            ),
            strikeIf(
                !getQuestFlag(player, COOKS_ASSISTANT_KEY, FLAG_GIVEN_EGG) &&
                    countCarriedItem(player, services, EGG_ITEM_ID) > 0,
                "I have found an egg to give to the cook.",
            ),
            !hasEgg(player, services)
                ? "I need to find an egg. The cook normally gets from the Groats' farm, found just to the west of the cattle field."
                : "",
        ].filter((line) => line.length > 0);
    }
    return buildNotStartedJournal(
        { overviewStartText: "talking to the <col=800000>Cook</col> in <col=800000>Lumbridge Castle</col>." } as QuestDefinition,
        "",
    );
}
