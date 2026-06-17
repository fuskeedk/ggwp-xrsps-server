import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import { registerQuestNpcTalk } from "../../helpers";
import type { QuestDefinition } from "../../types";
import { COOK_NPC_ID } from "./constants";
import { createCookTalkHandler } from "./dialogue";

export function registerCooksAssistantInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    _services: ScriptServices,
): void {
    registerQuestNpcTalk(registry, COOK_NPC_ID, createCookTalkHandler(quest));
}
