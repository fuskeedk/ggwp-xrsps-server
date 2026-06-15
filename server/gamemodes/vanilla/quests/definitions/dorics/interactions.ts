import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import { isQuestComplete } from "../../QuestService";
import type { QuestDefinition } from "../../types";
import {
    DORIC_ANVIL_AREA,
    DORIC_ANVIL_LOC_ID,
    DORIC_NPC_ID,
} from "./constants";
import { createDoricTalkHandler } from "./dialogue";

function registerDoricAnvilGate(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    services: ScriptServices,
): void {
    const genericSmith = registry.findLocInteraction(DORIC_ANVIL_LOC_ID, "smith");
    if (!genericSmith) {
        services.system.logger.warn?.(
            "[quest:dorics-quest] No generic smith handler found; anvil gate not installed",
        );
        return;
    }
    registry.registerLocScript({
        locId: DORIC_ANVIL_LOC_ID,
        action: "smith",
        handler: (event) => {
            const { tile, level } = event;
            const inDoricHouse =
                level === DORIC_ANVIL_AREA.level &&
                tile.x >= DORIC_ANVIL_AREA.minX &&
                tile.x <= DORIC_ANVIL_AREA.maxX &&
                tile.y >= DORIC_ANVIL_AREA.minY &&
                tile.y <= DORIC_ANVIL_AREA.maxY;
            if (inDoricHouse && !isQuestComplete(event.player, quest)) {
                services.messaging.sendGameMessage(
                    event.player,
                    "You need to complete Doric's Quest before you can use Doric's anvils.",
                );
                return;
            }
            return genericSmith(event);
        },
    });
}

export function registerDoricInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    services: ScriptServices,
): void {
    const handleDoricTalk = createDoricTalkHandler(quest);
    registry.registerNpcScript({
        npcId: DORIC_NPC_ID,
        option: "talk-to",
        handler: handleDoricTalk,
    });
    registry.registerNpcScript({
        npcId: DORIC_NPC_ID,
        option: undefined,
        handler: handleDoricTalk,
    });
    registerDoricAnvilGate(quest, registry, services);
}
