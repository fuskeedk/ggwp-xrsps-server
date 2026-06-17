import { SkillId } from "../../../../../../src/rs/skill/skills";
import type { IScriptRegistry, NpcInteractionEvent, ScriptServices } from "../../../../../src/game/scripts/types";
import { getQuestFlag, setQuestFlag } from "../../QuestFlags";
import {
    VARP_QUEST_POINTS,
    completeQuest,
    countCarriedItem,
    getQuestStage,
    setQuestStage,
    takeQuestItems,
} from "../../QuestService";
import { type DialogueContext, startConversation } from "../../dialogue";
import { buildCompleteJournal, buildNotStartedJournal, registerQuestNpcTalk, strikeIf } from "../../helpers";
import type { QuestDefinition } from "../../types";

export const DRAGON_SLAYER_I_KEY = "dragon_slayer_i";

const VARP_DRAGON_SLAYER = 176;
const STAGE_STARTED = 1;
const STAGE_COMPLETE = 10;

const MIN_QUEST_POINTS = 10;

const NPC_GUILDMASTER = 814;
const NPC_OZIACH = 822;
const NPC_KLARENSE = 819;
const NPC_ELVARG = 816;

const ITEM_COINS = 995;
const ITEM_ANTI_DRAGON_SHIELD = 1540;
const PASSAGE_COST = 2000;

function hasItem(
    player: Parameters<typeof countCarriedItem>[0],
    services: ScriptServices,
    itemId: number,
    quantity = 1,
): boolean {
    return countCarriedItem(player, services, itemId) >= quantity;
}

function getQuestPoints(player: Parameters<typeof countCarriedItem>[0]): number {
    return player.varps.getVarpValue(VARP_QUEST_POINTS) | 0;
}

export const dragonSlayerIQuest: QuestDefinition = {
    key: DRAGON_SLAYER_I_KEY,
    name: "Dragon Slayer I",
    varpId: VARP_DRAGON_SLAYER,
    startedValue: STAGE_STARTED,
    completionValue: STAGE_COMPLETE,
    rewards: {
        questPoints: 2,
        xp: [
            { skillId: SkillId.Strength, amount: 18650, label: "Strength" },
            { skillId: SkillId.Defence, amount: 18650, label: "Defence" },
        ],
        other: ["Ability to wear rune platebodies", "Ability to wear dragon platebodies"],
    },
    rewardItemId: ITEM_ANTI_DRAGON_SHIELD,
    overviewStartText:
        "proving yourself worthy to wield <col=800000>dragon equipment</col>.",
    buildJournal(player, services): string[] {
        const stage = getQuestStage(player, dragonSlayerIQuest);
        if (stage < STAGE_STARTED) {
            const qp = getQuestPoints(player);
            const reqLine =
                qp < MIN_QUEST_POINTS
                    ? `I need at least ${MIN_QUEST_POINTS} Quest Points before the Guildmaster will send me on this quest. (I have ${qp}.)`
                    : "There aren't any skill requirements, but I should be prepared to face a dragon.";
            return buildNotStartedJournal(
                dragonSlayerIQuest,
                "I can start this quest by talking to the Guildmaster in the Champions' Guild.",
                reqLine,
            );
        }
        if (stage >= STAGE_COMPLETE) {
            return buildCompleteJournal([
                "The Guildmaster sent me to slay the dragon Elvarg on Crandor.",
                "I sailed to the island, defeated Elvarg, and proved myself a hero.",
            ]);
        }
        return [
            "I must slay the dragon Elvarg on Crandor.",
            "",
            strikeIf(
                getQuestFlag(player, DRAGON_SLAYER_I_KEY, "has_shield") ||
                    hasItem(player, services, ITEM_ANTI_DRAGON_SHIELD),
                "I should speak with Oziach in Edgeville for protection against dragons.",
            ),
            strikeIf(
                getQuestFlag(player, DRAGON_SLAYER_I_KEY, "paid_passage"),
                `I need to pay Klarense ${PASSAGE_COST} coins for passage to Crandor.`,
            ),
            strikeIf(
                getQuestFlag(player, DRAGON_SLAYER_I_KEY, "slain_elvarg"),
                "I must defeat Elvarg on Crandor while wielding an anti-dragon shield.",
            ),
        ];
    },
    register(registry: IScriptRegistry, _services: ScriptServices): void {
        registerQuestNpcTalk(registry, NPC_GUILDMASTER, (event) => handleGuildmaster(event));
        registerQuestNpcTalk(registry, NPC_OZIACH, (event) => handleOziach(event));
        registerQuestNpcTalk(registry, NPC_KLARENSE, (event) => handleKlarense(event));
        registerQuestNpcTalk(registry, NPC_ELVARG, (event) => handleElvarg(event));
    },
};

function handleGuildmaster(event: NpcInteractionEvent): void {
    const { player, services } = event;
    const ctx: DialogueContext = { player, services, npcId: NPC_GUILDMASTER, npcName: "Guildmaster" };
    const stage = getQuestStage(player, dragonSlayerIQuest);

    if (stage >= STAGE_COMPLETE) {
        startConversation(ctx, [
            { npc: ["You have proven yourself a true champion."] },
            { player: ["Thank you."] },
        ]);
        return;
    }

    if (stage >= STAGE_STARTED) {
        startConversation(ctx, [
            { npc: ["Seek Oziach for a shield, then sail to Crandor and slay Elvarg!"] },
            { player: ["I'm on it."] },
        ]);
        return;
    }

    const qp = getQuestPoints(player);
    if (qp < MIN_QUEST_POINTS) {
        startConversation(ctx, [
            {
                npc: [
                    `You need more quest experience before I can trust you with this task.`,
                    `Return when you have at least ${MIN_QUEST_POINTS} Quest Points.`,
                ],
            },
            { player: [`I only have ${qp} Quest Points. I'll complete more quests first.`] },
        ]);
        return;
    }

    startConversation(ctx, [
        { npc: ["Only a champion may wear rune plate. Slay the dragon Elvarg on Crandor to prove yourself!"] },
        {
            options: [
                {
                    text: "I'll slay Elvarg!",
                    next: [
                        { player: ["I'll slay Elvarg!"] },
                        { npc: ["Speak with Oziach in Edgeville. He knows how to protect against dragons."] },
                        {
                            exec: (dctx) =>
                                setQuestStage(
                                    dctx.player,
                                    dragonSlayerIQuest,
                                    dctx.services,
                                    STAGE_STARTED,
                                ),
                        },
                    ],
                },
                { text: "That sounds terrifying.", next: [{ player: ["That sounds terrifying."] }] },
            ],
        },
    ]);
}

function handleOziach(event: NpcInteractionEvent): void {
    const { player, services } = event;
    const ctx: DialogueContext = { player, services, npcId: NPC_OZIACH, npcName: "Oziach" };
    const stage = getQuestStage(player, dragonSlayerIQuest);

    if (stage < STAGE_STARTED) {
        startConversation(ctx, [{ npc: ["I sell rune platebodies. Come back if you need one."] }]);
        return;
    }

    if (stage >= STAGE_COMPLETE) {
        startConversation(ctx, [{ npc: ["You've earned my respect, dragon slayer."] }]);
        return;
    }

    if (getQuestFlag(player, DRAGON_SLAYER_I_KEY, "has_shield") || hasItem(player, services, ITEM_ANTI_DRAGON_SHIELD)) {
        startConversation(ctx, [
            { npc: ["You have the shield. Pay Klarense in Port Sarim for passage to Crandor."] },
            { player: ["I'll find him."] },
        ]);
        return;
    }

    startConversation(ctx, [
        { npc: ["So the Guildmaster sent you? Take this anti-dragon shield — you'll need it against Elvarg."] },
        {
            exec: (dctx) => {
                if (!hasItem(dctx.player, dctx.services, ITEM_ANTI_DRAGON_SHIELD)) {
                    dctx.services.inventory.addItemToInventory(
                        dctx.player,
                        ITEM_ANTI_DRAGON_SHIELD,
                        1,
                    );
                    dctx.services.inventory.snapshotInventory(dctx.player);
                }
                setQuestFlag(dctx.player, DRAGON_SLAYER_I_KEY, "has_shield", true);
            },
        },
        { player: ["Thank you. I'll need passage to Crandor next."] },
    ]);
}

function handleKlarense(event: NpcInteractionEvent): void {
    const { player, services } = event;
    const ctx: DialogueContext = { player, services, npcId: NPC_KLARENSE, npcName: "Klarense" };
    const stage = getQuestStage(player, dragonSlayerIQuest);

    if (stage < STAGE_STARTED) {
        startConversation(ctx, [{ npc: ["The Lady Lumbridge is not taking passengers right now."] }]);
        return;
    }

    if (stage >= STAGE_COMPLETE) {
        startConversation(ctx, [{ npc: ["You've already been to Crandor and back."] }]);
        return;
    }

    if (getQuestFlag(player, DRAGON_SLAYER_I_KEY, "paid_passage")) {
        startConversation(ctx, [
            { npc: ["The ship is ready. Elvarg lurks in the caves on Crandor."] },
            { player: ["I'm going to face her."] },
        ]);
        return;
    }

    if (!hasItem(player, services, ITEM_COINS, PASSAGE_COST)) {
        startConversation(ctx, [
            { npc: [`I can sail you to Crandor for ${PASSAGE_COST} coins.`] },
            { player: ["I don't have enough coins yet."] },
        ]);
        return;
    }

    startConversation(ctx, [
        { npc: [`${PASSAGE_COST} coins it is. The ship is yours — Crandor awaits.`] },
        {
            exec: (dctx) => {
                takeQuestItems(dctx.player, dctx.services, [
                    { itemId: ITEM_COINS, quantity: PASSAGE_COST, journalLabel: "" },
                ]);
                setQuestFlag(dctx.player, DRAGON_SLAYER_I_KEY, "paid_passage", true);
            },
        },
        { player: ["Time to face Elvarg."] },
    ]);
}

function handleElvarg(event: NpcInteractionEvent): void {
    const { player, services } = event;
    const ctx: DialogueContext = { player, services, npcId: NPC_ELVARG, npcName: "Elvarg" };
    const stage = getQuestStage(player, dragonSlayerIQuest);

    if (stage < STAGE_STARTED) {
        startConversation(ctx, [{ npc: ["*The dragon ignores you.*"] }]);
        return;
    }

    if (stage >= STAGE_COMPLETE) {
        startConversation(ctx, [{ npc: ["*Elvarg is gone.*"] }]);
        return;
    }

    if (!getQuestFlag(player, DRAGON_SLAYER_I_KEY, "paid_passage")) {
        startConversation(ctx, [{ npc: ["You shouldn't be here without arranging passage first."] }]);
        return;
    }

    if (!hasItem(player, services, ITEM_ANTI_DRAGON_SHIELD)) {
        startConversation(ctx, [
            { npc: ["*Elvarg breathes fire at you! You need an anti-dragon shield to survive.*"] },
            { player: ["I need Oziach's shield!"] },
        ]);
        return;
    }

    startConversation(ctx, [
        { player: ["Your reign ends here, Elvarg!"] },
        { npc: ["*The dragon roars and attacks!*"] },
        { exec: (dctx) => setQuestFlag(dctx.player, DRAGON_SLAYER_I_KEY, "slain_elvarg", true) },
        { npc: ["*Elvarg falls! Crandor is free of her terror.*"] },
        { exec: (dctx) => completeQuest(dctx.player, dctx.services, dragonSlayerIQuest) },
    ]);
}
