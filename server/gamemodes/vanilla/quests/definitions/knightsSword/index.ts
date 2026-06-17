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
import {
    buildCompleteJournal,
    buildItemProgressJournal,
    buildNotStartedJournal,
    registerQuestNpcTalk,
    strikeIf,
} from "../../helpers";
import type { QuestDefinition, QuestItemRequirement } from "../../types";

export const KNIGHTS_SWORD_KEY = "knights_sword";

const VARP_KNIGHTS_SWORD = 122;
const STAGE_STARTED = 1;
const STAGE_COMPLETE = 7;

const NPC_SQUIRE = 1770;
const NPC_THURGO = 4733;

const ITEM_REDBERRY_PIE = 2325;
const ITEM_PORTRAIT = 666;
const ITEM_BLURITE_ORE = 668;
const ITEM_IRON_BAR = 2351;
const ITEM_BLURITE_SWORD = 667;

const THURGO_MATERIALS: QuestItemRequirement[] = [
    { itemId: ITEM_PORTRAIT, quantity: 1, journalLabel: "Portrait of Sir Vyvin" },
    { itemId: ITEM_IRON_BAR, quantity: 1, journalLabel: "Iron bar" },
    { itemId: ITEM_BLURITE_ORE, quantity: 1, journalLabel: "Blurite ore" },
];

function hasItem(
    player: Parameters<typeof countCarriedItem>[0],
    services: ScriptServices,
    itemId: number,
    quantity = 1,
): boolean {
    return countCarriedItem(player, services, itemId) >= quantity;
}

export const knightsSwordQuest: QuestDefinition = {
    key: KNIGHTS_SWORD_KEY,
    name: "The Knight's Sword",
    varpId: VARP_KNIGHTS_SWORD,
    startedValue: STAGE_STARTED,
    completionValue: STAGE_COMPLETE,
    rewards: {
        questPoints: 1,
        xp: [{ skillId: SkillId.Smithing, amount: 12725, label: "Smithing" }],
    },
    rewardItemId: ITEM_BLURITE_SWORD,
    overviewStartText:
        "helping <col=800000>Sir Vyvin's squire</col> replace a lost sword.",
    buildJournal(player, services): string[] {
        const stage = getQuestStage(player, knightsSwordQuest);
        if (stage < STAGE_STARTED) {
            return buildNotStartedJournal(
                knightsSwordQuest,
                "I can start this quest by talking to the Squire in Falador Castle.",
            );
        }
        if (stage >= STAGE_COMPLETE) {
            return buildCompleteJournal([
                "The squire lost Sir Vyvin's sword.",
                "I had Thurgo smith a blurite sword and returned it to the squire.",
            ]);
        }
        if (getQuestFlag(player, KNIGHTS_SWORD_KEY, "has_sword") || hasItem(player, services, ITEM_BLURITE_SWORD)) {
            return [
                "Thurgo forged a blurite sword for me.",
                "",
                "I should return the sword to the squire in Falador Castle.",
            ];
        }
        if (getQuestFlag(player, KNIGHTS_SWORD_KEY, "has_portrait") || hasItem(player, services, ITEM_PORTRAIT)) {
            return buildItemProgressJournal(
                player,
                services,
                [
                    "Thurgo gave me a portrait of the sword I need to replace.",
                    "I must bring him blurite ore and an iron bar so he can smith the sword.",
                ],
                THURGO_MATERIALS.filter((req) => req.itemId !== ITEM_PORTRAIT),
            );
        }
        return [
            "The squire needs a replacement sword for Sir Vyvin.",
            "",
            strikeIf(
                getQuestFlag(player, KNIGHTS_SWORD_KEY, "met_thurgo"),
                "I should speak with Thurgo, the dwarf smith south of Falador.",
            ),
            strikeIf(
                getQuestFlag(player, KNIGHTS_SWORD_KEY, "has_portrait"),
                "I need to bring Thurgo a redberry pie.",
            ),
        ];
    },
    register(registry: IScriptRegistry, _services: ScriptServices): void {
        registerQuestNpcTalk(registry, NPC_SQUIRE, (event) => handleSquire(event));
        registerQuestNpcTalk(registry, NPC_THURGO, (event) => handleThurgo(event));
    },
};

function handleSquire(event: NpcInteractionEvent): void {
    const { player, services } = event;
    const ctx: DialogueContext = { player, services, npcId: NPC_SQUIRE, npcName: "Squire" };
    const stage = getQuestStage(player, knightsSwordQuest);

    if (stage >= STAGE_COMPLETE) {
        startConversation(ctx, [
            { npc: ["Sir Vyvin's sword is safe thanks to you."] },
            { player: ["Happy to help."] },
        ]);
        return;
    }

    if (stage >= STAGE_STARTED) {
        if (hasItem(player, services, ITEM_BLURITE_SWORD)) {
            startConversation(ctx, [
                { player: ["I have the blurite sword Thurgo made."] },
                { npc: ["Wonderful! Sir Vyvin will be pleased."] },
                {
                    exec: (dctx) => {
                        takeQuestItems(dctx.player, dctx.services, [
                            { itemId: ITEM_BLURITE_SWORD, quantity: 1, journalLabel: "" },
                        ]);
                        completeQuest(dctx.player, dctx.services, knightsSwordQuest);
                    },
                },
            ]);
            return;
        }
        startConversation(ctx, [
            { npc: ["Please hurry — Thurgo can smith a blurite sword if you bring the right materials."] },
            { player: ["I'm working on it."] },
        ]);
        return;
    }

    startConversation(ctx, [
        { npc: ["Sir Vyvin's sword is missing! I need a blurite sword made in its likeness."] },
        {
            options: [
                {
                    text: "I'll help you.",
                    next: [
                        { player: ["I'll help you."] },
                        {
                            npc: [
                                "Speak with Thurgo, the dwarf smith south of Falador.",
                                "Bring him a redberry pie — he loves those.",
                            ],
                        },
                        {
                            exec: (dctx) =>
                                setQuestStage(
                                    dctx.player,
                                    knightsSwordQuest,
                                    dctx.services,
                                    STAGE_STARTED,
                                ),
                        },
                    ],
                },
                { text: "Not right now.", next: [{ player: ["Not right now."] }] },
            ],
        },
    ]);
}

function handleThurgo(event: NpcInteractionEvent): void {
    const { player, services } = event;
    const ctx: DialogueContext = { player, services, npcId: NPC_THURGO, npcName: "Thurgo" };
    const stage = getQuestStage(player, knightsSwordQuest);

    if (stage < STAGE_STARTED) {
        startConversation(ctx, [{ npc: ["I'm busy smithing. Unless you've a pie for me?"] }]);
        return;
    }

    if (stage >= STAGE_COMPLETE) {
        startConversation(ctx, [{ npc: ["That blurite sword turned out nicely."] }]);
        return;
    }

    const hasPortrait =
        getQuestFlag(player, KNIGHTS_SWORD_KEY, "has_portrait") || hasItem(player, services, ITEM_PORTRAIT);
    const hasMaterials =
        hasPortrait &&
        hasItem(player, services, ITEM_IRON_BAR) &&
        hasItem(player, services, ITEM_BLURITE_ORE);

    if (hasMaterials) {
        startConversation(ctx, [
            { npc: ["Aye, I have everything I need. Let me forge that sword..."] },
            {
                exec: (dctx) => {
                    takeQuestItems(dctx.player, dctx.services, [
                        { itemId: ITEM_PORTRAIT, quantity: 1, journalLabel: "" },
                        { itemId: ITEM_IRON_BAR, quantity: 1, journalLabel: "" },
                        { itemId: ITEM_BLURITE_ORE, quantity: 1, journalLabel: "" },
                    ]);
                    dctx.services.inventory.addItemToInventory(dctx.player, ITEM_BLURITE_SWORD, 1);
                    dctx.services.inventory.snapshotInventory(dctx.player);
                    setQuestFlag(dctx.player, KNIGHTS_SWORD_KEY, "has_sword", true);
                },
            },
            { npc: ["There — a fine blurite sword. Take it to the squire."] },
            { player: ["Thank you, Thurgo."] },
        ]);
        return;
    }

    if (hasPortrait) {
        startConversation(ctx, [
            { npc: ["I still need blurite ore and an iron bar to smith the sword."] },
            { player: ["I'll find them."] },
        ]);
        return;
    }

    if (hasItem(player, services, ITEM_REDBERRY_PIE)) {
        startConversation(ctx, [
            { npc: ["A redberry pie! My favourite. Here — a portrait of the sword you need."] },
            {
                exec: (dctx) => {
                    takeQuestItems(dctx.player, dctx.services, [
                        { itemId: ITEM_REDBERRY_PIE, quantity: 1, journalLabel: "" },
                    ]);
                    if (!hasItem(dctx.player, dctx.services, ITEM_PORTRAIT)) {
                        dctx.services.inventory.addItemToInventory(dctx.player, ITEM_PORTRAIT, 1);
                        dctx.services.inventory.snapshotInventory(dctx.player);
                    }
                    setQuestFlag(dctx.player, KNIGHTS_SWORD_KEY, "met_thurgo", true);
                    setQuestFlag(dctx.player, KNIGHTS_SWORD_KEY, "has_portrait", true);
                },
            },
            { player: ["Now I need blurite ore and an iron bar."] },
        ]);
        return;
    }

    startConversation(ctx, [
        { npc: ["I'm not doing any favours unless you bring me a redberry pie first."] },
        { player: ["I'll see what I can do."] },
        { exec: (dctx) => setQuestFlag(dctx.player, KNIGHTS_SWORD_KEY, "met_thurgo", true) },
    ]);
}
