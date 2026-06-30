import type { PlayerState } from "../../../src/game/player";
import { getQuestDefinitionByKey } from "./QuestRegistry";
import { isQuestComplete, isQuestStarted } from "./QuestService";

/** True when the quest has been started but not yet completed. */
export function isQuestInProgress(player: PlayerState, questKey: string): boolean {
    const quest = getQuestDefinitionByKey(questKey);
    if (!quest) return false;
    return isQuestStarted(player, quest) && !isQuestComplete(player, quest);
}
