import { SkillId } from "../../../../../../src/rs/skill/skills";
import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import {
    CAKE_ITEM_ID,
    COOKS_ASSISTANT_KEY,
    STAGE_COMPLETE,
    STAGE_STARTED,
    VARP_COOKS_ASSISTANT,
} from "./constants";
import { registerCooksAssistantInteractions } from "./interactions";
import { buildCooksAssistantJournal } from "./journal";

export { COOKS_ASSISTANT_KEY } from "./constants";

export const cooksAssistantQuest: QuestDefinition = {
    key: COOKS_ASSISTANT_KEY,
    name: "Cook's Assistant",
    varpId: VARP_COOKS_ASSISTANT,
    startedValue: STAGE_STARTED,
    completionValue: STAGE_COMPLETE,
    rewards: {
        questPoints: 1,
        xp: [{ skillId: SkillId.Cooking, amount: 300, label: "Cooking" }],
        other: ["Use of the Cook-o-matic 100 range"],
    },
    rewardItemId: CAKE_ITEM_ID,
    overviewStartText:
        "talking to the <col=800000>Cook</col> in <col=800000>Lumbridge Castle</col>.",
    buildJournal: buildCooksAssistantJournal,
    register(registry: IScriptRegistry, services: ScriptServices): void {
        registerCooksAssistantInteractions(cooksAssistantQuest, registry, services);
    },
};
