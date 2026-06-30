import type { PlayerState } from "../../../src/game/player";
import { isQuestInProgress } from "./questSharedNpcYield";

/**
 * Hand-maintained start-handler yields for generated auto quests on shared NPCs.
 * Survives `generate-auto-quests.ts` regeneration — do not put these inline in generatedAutoQuests.ts.
 */
export const AUTO_QUEST_START_YIELD_WHEN: Record<string, (player: PlayerState) => boolean> = {
    forgettable_tale: (player) => isQuestInProgress(player, "the_giant_dwarf"),
    making_history: (player) => isQuestInProgress(player, "the_slug_menace"),
    mourning_s_end_part_ii: (player) => isQuestInProgress(player, "song_of_the_elves"),
    rag_and_bone_man_i: (player) => isQuestInProgress(player, "rag_and_bone_man_ii"),
    recipe_for_disaster_freeing_sir_amik_varze: (player) =>
        isQuestInProgress(player, "recruitment_drive") || isQuestInProgress(player, "wanted"),
    the_slug_menace: (player) => isQuestInProgress(player, "wanted"),
};
