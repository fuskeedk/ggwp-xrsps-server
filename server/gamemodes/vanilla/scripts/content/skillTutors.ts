import type { PlayerState } from "../../../../src/game/player";
import { SkillId } from "../../../../../src/rs/skill/skills";
import type { IScriptRegistry, NpcInteractionEvent, ScriptServices } from "../../../../src/game/scripts/types";
import { countCarriedItem } from "../../quests/QuestService";
import { registerQuestNpcTalk } from "../../quests/helpers";
import { skillCapeForSkill, type SkillCapeDefinition } from "../../skillCapes/skillCapes";
import {
    isSkillCapeMenuSelection,
    startSkillCapeExplanation,
    withSkillCapeMenuOption,
} from "../../skillCapes/skillCapePurchases";
import { TINDERBOX_ITEM_IDS } from "../../skills/firemaking/firemakingData";
import { PICKAXES } from "../../skills/mining/miningData";
import { HATCHETS } from "../../skills/woodcutting/woodcuttingData";

const FISHING_TUTOR_NPC_ID = 3221;
const MINING_TUTOR_NPC_ID = 3222;
const PRAYER_TUTOR_NPC_ID = 3223;
const COOKING_TUTOR_NPC_ID = 3219;
const CRAFTING_TUTOR_NPC_ID = 3220;
const MELEE_TUTOR_NPC_ID = 3216;
const RANGED_TUTOR_NPC_ID = 3217;
const MAGIC_TUTOR_NPC_ID = 3218;
const WOODSMAN_TUTOR_NPC_ID = 3226;
const BANKER_TUTOR_NPC_ID = 3227;
const SMITHING_APPRENTICE_NPC_ID = 3224;
const MASTER_SMITHING_TUTOR_NPC_ID = 3225;

const SMALL_FISHING_NET_ID = 303;
const BRONZE_PICKAXE_ID = 1265;
const BRONZE_AXE_ID = 1351;

const PICKAXE_ITEM_IDS = PICKAXES.map((pick) => pick.itemId);
const HATCHET_ITEM_IDS = HATCHETS.map((hatchet) => hatchet.itemId);

const TUTOR_SKILL_IDS: Partial<Record<number, SkillId>> = {
    [FISHING_TUTOR_NPC_ID]: SkillId.Fishing,
    [MINING_TUTOR_NPC_ID]: SkillId.Mining,
    [PRAYER_TUTOR_NPC_ID]: SkillId.Prayer,
    [COOKING_TUTOR_NPC_ID]: SkillId.Cooking,
    [CRAFTING_TUTOR_NPC_ID]: SkillId.Crafting,
    [MELEE_TUTOR_NPC_ID]: SkillId.Defence,
    [RANGED_TUTOR_NPC_ID]: SkillId.Ranged,
    [MAGIC_TUTOR_NPC_ID]: SkillId.Magic,
    [WOODSMAN_TUTOR_NPC_ID]: SkillId.Woodcutting,
    [SMITHING_APPRENTICE_NPC_ID]: SkillId.Smithing,
    [MASTER_SMITHING_TUTOR_NPC_ID]: SkillId.Smithing,
};

const SKILL_CAPE_EXPLANATIONS: Partial<Record<SkillId, string>> = {
    [SkillId.Fishing]:
        "This is a Skillcape of Fishing. Only someone who has achieved the highest possible level in a skill can wear one.",
    [SkillId.Mining]:
        "This is a Skillcape of Mining. Only someone who has achieved the highest possible level in a skill can wear one.",
    [SkillId.Woodcutting]:
        "This is a Skillcape of Woodcutting. Wearing one increases your chance of finding bird's nests. Only someone who has achieved the highest possible level in a skill can wear one.",
    [SkillId.Prayer]:
        "This is a Skillcape of Prayer. Only someone who has achieved the highest possible level in a skill can wear one.",
    [SkillId.Cooking]:
        "This is a Skillcape of Cooking. Only someone who has achieved the highest possible level in a skill can wear one.",
    [SkillId.Crafting]:
        "This is a Skillcape of Crafting. Only someone who has achieved the highest possible level in a skill can wear one.",
    [SkillId.Defence]:
        "This is a Skillcape of Defence. When worn, it can act as a ring of life. Only someone who has achieved the highest possible level in a skill can wear one.",
    [SkillId.Ranged]:
        "This is a Skillcape of Ranging. Only someone who has achieved the highest possible level in a skill can wear one.",
    [SkillId.Magic]:
        "This is a Skillcape of Magic. Only someone who has achieved the highest possible level in a skill can wear one.",
    [SkillId.Smithing]:
        "This is a Skillcape of Smithing. Only someone who has achieved the highest possible level in a skill can wear one.",
};

type TutorContext = {
    event: NpcInteractionEvent;
    services: ScriptServices;
    player: PlayerState;
    npcId: number;
    npcName: string;
    base: string;
};

function openNpcDialog(
    ctx: TutorContext,
    dialogId: string,
    lines: string[],
    onContinue?: () => void,
): void {
    ctx.services.dialog.openDialog(ctx.player, {
        kind: "npc",
        id: dialogId,
        npcId: ctx.event.npc.typeId,
        npcName: ctx.npcName,
        lines,
        clickToContinue: true,
        closeOnContinue: !onContinue,
        onContinue,
        onClose: () => ctx.services.dialog.closeDialog(ctx.player, dialogId),
    });
}

function openPlayerDialog(
    ctx: TutorContext,
    dialogId: string,
    lines: string[],
    onContinue?: () => void,
): void {
    ctx.services.dialog.openDialog(ctx.player, {
        kind: "player",
        id: dialogId,
        playerName: ctx.player.name ?? "You",
        lines,
        clickToContinue: true,
        closeOnContinue: !onContinue,
        onContinue,
        onClose: () => ctx.services.dialog.closeDialog(ctx.player, dialogId),
    });
}

function openOptions(
    ctx: TutorContext,
    dialogId: string,
    options: string[],
    onSelect: (choice: number) => void,
): void {
    ctx.services.dialog.openDialogOptions(ctx.player, {
        id: dialogId,
        title: "Select an Option",
        options,
        onSelect,
    });
}

function skillLevel(ctx: TutorContext, skill: SkillId): number {
    return ctx.services.skills.getSkill(ctx.player, skill)?.baseLevel ?? 1;
}

function hasAnyCarriedItem(ctx: TutorContext, itemIds: number[]): boolean {
    return itemIds.some((itemId) => countCarriedItem(ctx.player, ctx.services, itemId) > 0);
}

function giveItemIfMissing(
    ctx: TutorContext,
    itemId: number,
    alreadyHasLines: string[],
    successLines: string[],
    noSpaceLines: string[],
    onDone?: () => void,
): void {
    if (countCarriedItem(ctx.player, ctx.services, itemId) > 0) {
        openNpcDialog(ctx, `${ctx.base}_has_item`, alreadyHasLines, onDone);
        return;
    }
    const result = ctx.services.inventory.addItemToInventory(ctx.player, itemId, 1);
    if (result.added > 0) {
        openNpcDialog(ctx, `${ctx.base}_gave_item`, successLines, onDone);
        return;
    }
    openNpcDialog(ctx, `${ctx.base}_no_space`, noSpaceLines, onDone);
}

function makeTutorContext(
    event: NpcInteractionEvent,
    services: ScriptServices,
    npcId: number,
    npcName: string,
): TutorContext {
    return {
        event,
        services,
        player: event.player,
        npcId,
        npcName,
        base: `tutor_${npcId}_${event.player.id}`,
    };
}

function startTutorConversation(
    ctx: TutorContext,
    greeting: string[],
    options: string[],
    onSelect: (choice: number) => void,
): void {
    openNpcDialog(ctx, `${ctx.base}_greeting`, greeting, () => {
        ctx.services.dialog.closeDialog(ctx.player, `${ctx.base}_greeting`);
        openOptions(ctx, `${ctx.base}_menu`, options, onSelect);
    });
}

function tutorCape(ctx: TutorContext): SkillCapeDefinition | undefined {
    const skillId = TUTOR_SKILL_IDS[ctx.npcId];
    return skillId !== undefined ? skillCapeForSkill(skillId) : undefined;
}

function handleTutorCapeChoice(ctx: TutorContext, onDone?: () => void): boolean {
    const cape = tutorCape(ctx);
    if (!cape) return false;
    const explanation =
        SKILL_CAPE_EXPLANATIONS[cape.skillId] ??
        `This is a Skillcape of ${cape.displayName}. Only someone who has achieved the highest possible level in a skill can wear one.`;
    startSkillCapeExplanation(
        {
            player: ctx.player,
            services: ctx.services,
            base: ctx.base,
            npcName: ctx.npcName,
        },
        cape,
        explanation,
        onDone,
    );
    return true;
}

function handleMenuChoice(
    ctx: TutorContext,
    options: string[],
    choice: number,
    handlers: Record<string, () => void>,
    onDone?: () => void,
): void {
    if (isSkillCapeMenuSelection(options, choice)) {
        handleTutorCapeChoice(ctx, onDone);
        return;
    }
    const selected = options[choice];
    handlers[selected]?.();
}

function replyToPlayer(
    ctx: TutorContext,
    playerLine: string,
    npcLines: string[],
    suffix: string,
    onDone?: () => void,
): void {
    openPlayerDialog(ctx, `${ctx.base}_${suffix}_player`, [playerLine], () => {
        openNpcDialog(ctx, `${ctx.base}_${suffix}_npc`, npcLines, onDone);
    });
}

function handleFishingTutor(event: NpcInteractionEvent, services: ScriptServices): void {
    const ctx = makeTutorContext(event, services, FISHING_TUTOR_NPC_ID, "Fishing tutor");
    const level = skillLevel(ctx, SkillId.Fishing);
    const openMainMenu = () => {
        if (level >= 29) {
            const options = withSkillCapeMenuOption([
                "Any advice for an experienced fisher?",
                "Tell me about different fish and equipment.",
                "Goodbye.",
            ]);
            startTutorConversation(
                ctx,
                ["Hello there. Need any help with fishing?"],
                options,
                (choice) => {
                    handleMenuChoice(
                        ctx,
                        options,
                        choice,
                        {
                            "Any advice for an experienced fisher?": () =>
                                replyToPlayer(
                                    ctx,
                                    "Any advice for an experienced fisher?",
                                    [
                                        "As you improve, you can catch better fish for more profit.",
                                        "Try fly fishing south of Barbarian Village once you can use a fly rod.",
                                    ],
                                    "adv",
                                    openMainMenu,
                                ),
                            "Tell me about different fish and equipment.": () =>
                                replyToPlayer(
                                    ctx,
                                    "Tell me about different fish and equipment.",
                                    [
                                        "Shrimp and anchovies are caught with a small net near the river.",
                                        "Trout and salmon need a fly fishing rod and feathers.",
                                        "Lobsters and swordfish require a harpoon or big net at sea.",
                                    ],
                                    "gear",
                                    openMainMenu,
                                ),
                        },
                        openMainMenu,
                    );
                },
            );
            return;
        }
        const options = withSkillCapeMenuOption([
            "Can you teach me the basics of fishing, please?",
            "Goodbye.",
        ]);
        startTutorConversation(
            ctx,
            ["Hello there. Need any help with fishing?"],
            options,
            (choice) => {
                handleMenuChoice(
                    ctx,
                    options,
                    choice,
                    {
                        "Can you teach me the basics of fishing, please?": () =>
                            replyToPlayer(
                                ctx,
                                "Can you teach me the basics of fishing, please?",
                                [
                                    "Look for fishing spots along rivers and coastlines on your minimap.",
                                    "Click a spot with the right tool equipped to start fishing.",
                                ],
                                "basics",
                                () => {
                                    if (hasAnyCarriedItem(ctx, [SMALL_FISHING_NET_ID])) {
                                        openNpcDialog(ctx, `${ctx.base}_net_ok`, [
                                            "You already have a net — try the spots by the Lumbridge river.",
                                        ]);
                                        return;
                                    }
                                    giveItemIfMissing(
                                        ctx,
                                        SMALL_FISHING_NET_ID,
                                        ["You already have a net."],
                                        ["Here, take this small fishing net and try the spots by the river."],
                                        ["I'd give you a net, but you don't have room in your inventory."],
                                    );
                                },
                            ),
                    },
                );
            },
        );
    };
    openMainMenu();
}

function handleMiningTutor(event: NpcInteractionEvent, services: ScriptServices): void {
    const ctx = makeTutorContext(event, services, MINING_TUTOR_NPC_ID, "Mining tutor");
    const openMainMenu = () => {
        const options = withSkillCapeMenuOption([
            "Can you teach me the basics of mining?",
            "Where can I mine?",
            "Goodbye.",
        ]);
        startTutorConversation(
            ctx,
            ["Greetings. Can I help you with mining?"],
            options,
            (choice) => {
                handleMenuChoice(
                    ctx,
                    options,
                    choice,
                    {
                        "Can you teach me the basics of mining?": () =>
                            replyToPlayer(
                                ctx,
                                "Can you teach me the basics of mining?",
                                [
                                    "Click on rocks to mine them. You need a pickaxe you can use.",
                                    "The mine south-east of Lumbridge is perfect for beginners.",
                                ],
                                "basics",
                                () => {
                                    if (hasAnyCarriedItem(ctx, PICKAXE_ITEM_IDS)) return;
                                    giveItemIfMissing(
                                        ctx,
                                        BRONZE_PICKAXE_ID,
                                        ["You already have a pickaxe."],
                                        ["Take this bronze pickaxe and try the rocks in the swamp mine."],
                                        ["I'd give you a pickaxe, but your inventory is full."],
                                    );
                                },
                            ),
                        "Where can I mine?": () =>
                            replyToPlayer(
                                ctx,
                                "Where can I mine?",
                                [
                                    "Copper and tin are in the mine south-east of here.",
                                    "Iron and coal become available as your Mining level rises.",
                                ],
                                "where",
                                openMainMenu,
                            ),
                    },
                    openMainMenu,
                );
            },
        );
    };
    openMainMenu();
}

function handleWoodsmanTutor(event: NpcInteractionEvent, services: ScriptServices): void {
    const ctx = makeTutorContext(event, services, WOODSMAN_TUTOR_NPC_ID, "Woodsman tutor");
    const openMainMenu = () => {
        const options = withSkillCapeMenuOption([
            "Can you teach me the basics of Woodcutting and Firemaking?",
            "Tell me about different trees and axes.",
            "Goodbye.",
        ]);
        startTutorConversation(
            ctx,
            ["Hello. Can I help you with woodcutting?"],
            options,
            (choice) => {
                handleMenuChoice(
                    ctx,
                    options,
                    choice,
                    {
                        "Can you teach me the basics of Woodcutting and Firemaking?": () =>
                            replyToPlayer(
                                ctx,
                                "Can you teach me the basics of Woodcutting and Firemaking, please?",
                                [
                                    "Click on a tree to chop it down when you have an axe.",
                                    "Burn logs with a tinderbox to train Firemaking and cook food.",
                                ],
                                "basics",
                                () => {
                                    if (!hasAnyCarriedItem(ctx, HATCHET_ITEM_IDS)) {
                                        giveItemIfMissing(
                                            ctx,
                                            BRONZE_AXE_ID,
                                            ["You already have an axe."],
                                            ["Have an axe so you can chop the trees around here."],
                                            ["I'd give you an axe, but your inventory is full."],
                                            () => {
                                                if (!hasAnyCarriedItem(ctx, TINDERBOX_ITEM_IDS)) {
                                                    giveItemIfMissing(
                                                        ctx,
                                                        TINDERBOX_ITEM_IDS[0],
                                                        ["You already have a tinderbox."],
                                                        ["Here is a tinderbox — use it on logs to make a fire."],
                                                        ["You don't have space for a tinderbox right now."],
                                                    );
                                                }
                                            },
                                        );
                                    } else if (!hasAnyCarriedItem(ctx, TINDERBOX_ITEM_IDS)) {
                                        giveItemIfMissing(
                                            ctx,
                                            TINDERBOX_ITEM_IDS[0],
                                            ["You already have a tinderbox."],
                                            ["Here is a tinderbox — use it on logs to make a fire."],
                                            ["You don't have space for a tinderbox right now."],
                                        );
                                    }
                                },
                            ),
                        "Tell me about different trees and axes.": () =>
                            replyToPlayer(
                                ctx,
                                "Tell me about different trees and axes.",
                                [
                                    "Normal trees give logs; oak and willow need higher Woodcutting levels.",
                                    "Better axes chop faster — Bob's shop in Lumbridge sells bronze axes.",
                                ],
                                "trees",
                                openMainMenu,
                            ),
                    },
                    openMainMenu,
                );
            },
        );
    };
    openMainMenu();
}

function handlePrayerTutor(event: NpcInteractionEvent, services: ScriptServices): void {
    const ctx = makeTutorContext(event, services, PRAYER_TUTOR_NPC_ID, "Prayer tutor");
    const openMainMenu = () => {
        const options = withSkillCapeMenuOption([
            "How can I train my prayer?",
            "What is prayer useful for?",
            "No, thank you.",
        ]);
        startTutorConversation(
            ctx,
            [`Greetings, ${ctx.player.name ?? "adventurer"}. Can I help you today?`],
            options,
            (choice) => {
                handleMenuChoice(
                    ctx,
                    options,
                    choice,
                    {
                        "How can I train my prayer?": () =>
                            replyToPlayer(
                                ctx,
                                "How can I train my prayer?",
                                [
                                    "Bury bones or use them on altars to gain Prayer experience.",
                                    "Bigger bones from tougher monsters give more experience.",
                                ],
                                "train",
                                openMainMenu,
                            ),
                        "What is prayer useful for?": () =>
                            replyToPlayer(
                                ctx,
                                "What is prayer useful for?",
                                [
                                    "Prayers can help you in combat, protect items, and boost your stats.",
                                    "Open your prayer book to see what you can use at your level.",
                                ],
                                "use",
                                openMainMenu,
                            ),
                        "No, thank you.": () =>
                            replyToPlayer(ctx, "No, thank you.", ["Very well. Saradomin be with you!"], "bye"),
                    },
                    openMainMenu,
                );
            },
        );
    };
    openMainMenu();
}

function handleCookingTutor(event: NpcInteractionEvent, services: ScriptServices): void {
    const ctx = makeTutorContext(event, services, COOKING_TUTOR_NPC_ID, "Cooking tutor");
    const options = withSkillCapeMenuOption([
        "How do I cook food?",
        "Where can I get raw food?",
        "Goodbye.",
    ]);
    startTutorConversation(
        ctx,
        ["Hello. Want to learn about cooking?"],
        options,
        (choice) => {
            handleMenuChoice(ctx, options, choice, {
                "How do I cook food?": () =>
                    replyToPlayer(
                        ctx,
                        "How do I cook food?",
                        [
                            "Use raw food on a fire or range to cook it.",
                            "Higher Cooking levels let you cook better food without burning it.",
                        ],
                        "cook",
                    ),
                "Where can I get raw food?": () =>
                    replyToPlayer(
                        ctx,
                        "Where can I get raw food?",
                        [
                            "Fish from the river, meat from cows and chickens, or buy ingredients from shops.",
                            "The range in the Lumbridge kitchen is a good place to start.",
                        ],
                        "food",
                    ),
            });
        },
    );
}

function handleCraftingTutor(event: NpcInteractionEvent, services: ScriptServices): void {
    const ctx = makeTutorContext(event, services, CRAFTING_TUTOR_NPC_ID, "Crafting tutor");
    const options = withSkillCapeMenuOption([
        "How do I start crafting?",
        "What can I make?",
        "Goodbye.",
    ]);
    startTutorConversation(
        ctx,
        ["Hello. Interested in crafting?"],
        options,
        (choice) => {
            handleMenuChoice(ctx, options, choice, {
                "How do I start crafting?": () =>
                    replyToPlayer(
                        ctx,
                        "How do I start crafting?",
                        [
                            "Pottery needs clay and a wheel, leather needs hides and a needle.",
                            "Look for crafting icons on your minimap for workshops.",
                        ],
                        "start",
                    ),
                "What can I make?": () =>
                    replyToPlayer(
                        ctx,
                        "What can I make?",
                        [
                            "Jewellery from gold, armour from leather, and pottery from clay.",
                            "Your Crafting level unlocks more advanced items over time.",
                        ],
                        "make",
                    ),
            });
        },
    );
}

function handleCombatTutor(
    event: NpcInteractionEvent,
    services: ScriptServices,
    npcId: number,
    npcName: string,
    style: "melee" | "ranged" | "magic",
): void {
    const ctx = makeTutorContext(event, services, npcId, npcName);
    const trainingLines: Record<typeof style, string[]> = {
        melee: [
            "Train Attack, Strength and Defence on low-level monsters near Lumbridge.",
            "Chickens and cows east of the castle are good for beginners.",
        ],
        ranged: [
            "Equip a bow and arrows, then attack from a distance.",
            "Buy a shortbow and bronze arrows from the general store to start.",
        ],
        magic: [
            "Spells cost runes. Start with Wind Strike from the standard spellbook.",
            "The Wizards' Tower south of here is full of magical knowledge.",
        ],
    };
    const equipmentLines: Record<typeof style, string[]> = {
        melee: ["A sword and some armour from Bob's shop will help you survive."],
        ranged: ["Shortbows and arrows are sold in Lumbridge's general store."],
        magic: ["You'll need mind and air runes for basic combat spells."],
    };
    const options = withSkillCapeMenuOption(["How do I train?", "What equipment do I need?", "Goodbye."]);
    startTutorConversation(
        ctx,
        [`Hello. I can teach you about ${style} combat.`],
        options,
        (choice) => {
            handleMenuChoice(ctx, options, choice, {
                "How do I train?": () => replyToPlayer(ctx, "How do I train?", trainingLines[style], "train"),
                "What equipment do I need?": () =>
                    replyToPlayer(ctx, "What equipment do I need?", equipmentLines[style], "gear"),
            });
        },
    );
}

function handleBankerTutor(event: NpcInteractionEvent, services: ScriptServices): void {
    const ctx = makeTutorContext(event, services, BANKER_TUTOR_NPC_ID, "Banker tutor");
    startTutorConversation(
        ctx,
        ["Welcome. Need help with banking?"],
        ["How does banking work?", "Where is the nearest bank?", "Goodbye."],
        (choice) => {
            if (choice === 0) {
                replyToPlayer(
                    ctx,
                    "How does banking work?",
                    [
                        "Banks store items safely. Click a booth or banker to open your bank.",
                        "You can deposit, withdraw, and organise items into tabs.",
                    ],
                    "how",
                );
            } else if (choice === 1) {
                replyToPlayer(
                    ctx,
                    "Where is the nearest bank?",
                    [
                        "Lumbridge Castle has a bank on the top floor — climb the stairs inside.",
                        "Look for the bank booth icon on your minimap.",
                    ],
                    "where",
                );
            }
        },
    );
}

function handleSmithingApprentice(event: NpcInteractionEvent, services: ScriptServices): void {
    const ctx = makeTutorContext(event, services, SMITHING_APPRENTICE_NPC_ID, "Smithing apprentice");
    const options = withSkillCapeMenuOption([
        "How do I smelt ore?",
        "How do I smith items?",
        "Goodbye.",
    ]);
    startTutorConversation(
        ctx,
        ["Hello. Learning smithing?"],
        options,
        (choice) => {
            handleMenuChoice(ctx, options, choice, {
                "How do I smelt ore?": () =>
                    replyToPlayer(
                        ctx,
                        "How do I smelt ore?",
                        [
                            "Use ore on a furnace with the required Smithing level.",
                            "The furnace north of Lumbridge swamp is nearby.",
                        ],
                        "smelt",
                    ),
                "How do I smith items?": () =>
                    replyToPlayer(
                        ctx,
                        "How do I smith items?",
                        [
                            "Use bars on an anvil and choose what to make from the menu.",
                            "You'll need a hammer in your inventory.",
                        ],
                        "smith",
                    ),
            });
        },
    );
}

function handleMasterSmithingTutor(event: NpcInteractionEvent, services: ScriptServices): void {
    const ctx = makeTutorContext(event, services, MASTER_SMITHING_TUTOR_NPC_ID, "Master smithing tutor");
    const options = withSkillCapeMenuOption([
        "How do I improve my smithing?",
        "What can I make at high levels?",
        "Goodbye.",
    ]);
    startTutorConversation(
        ctx,
        ["Greetings. I teach advanced smithing."],
        options,
        (choice) => {
            handleMenuChoice(ctx, options, choice, {
                "How do I improve my smithing?": () =>
                    replyToPlayer(
                        ctx,
                        "How do I improve my smithing?",
                        [
                            "Smelt bars and smith items for experience. Higher levels unlock better metal.",
                            "Quests and the mining tutor can help you gather materials.",
                        ],
                        "improve",
                    ),
                "What can I make at high levels?": () =>
                    replyToPlayer(
                        ctx,
                        "What can I make at high levels?",
                        [
                            "Mithril, adamant and rune armour and weapons require high Smithing levels.",
                            "Some items need multiple bars — check the anvil menu carefully.",
                        ],
                        "high",
                    ),
            });
        },
    );
}

export function registerSkillTutorHandlers(
    registry: IScriptRegistry,
    services: ScriptServices,
): void {
    registerQuestNpcTalk(registry, FISHING_TUTOR_NPC_ID, (event) =>
        handleFishingTutor(event, services),
    );
    registerQuestNpcTalk(registry, MINING_TUTOR_NPC_ID, (event) => handleMiningTutor(event, services));
    registerQuestNpcTalk(registry, PRAYER_TUTOR_NPC_ID, (event) => handlePrayerTutor(event, services));
    registerQuestNpcTalk(registry, COOKING_TUTOR_NPC_ID, (event) => handleCookingTutor(event, services));
    registerQuestNpcTalk(registry, CRAFTING_TUTOR_NPC_ID, (event) =>
        handleCraftingTutor(event, services),
    );
    registerQuestNpcTalk(registry, WOODSMAN_TUTOR_NPC_ID, (event) =>
        handleWoodsmanTutor(event, services),
    );
    registerQuestNpcTalk(registry, MELEE_TUTOR_NPC_ID, (event) =>
        handleCombatTutor(event, services, MELEE_TUTOR_NPC_ID, "Melee combat tutor", "melee"),
    );
    registerQuestNpcTalk(registry, RANGED_TUTOR_NPC_ID, (event) =>
        handleCombatTutor(event, services, RANGED_TUTOR_NPC_ID, "Ranged combat tutor", "ranged"),
    );
    registerQuestNpcTalk(registry, MAGIC_TUTOR_NPC_ID, (event) =>
        handleCombatTutor(event, services, MAGIC_TUTOR_NPC_ID, "Magic combat tutor", "magic"),
    );
    registerQuestNpcTalk(registry, BANKER_TUTOR_NPC_ID, (event) => handleBankerTutor(event, services));
    registerQuestNpcTalk(registry, SMITHING_APPRENTICE_NPC_ID, (event) =>
        handleSmithingApprentice(event, services),
    );
    registerQuestNpcTalk(registry, MASTER_SMITHING_TUTOR_NPC_ID, (event) =>
        handleMasterSmithingTutor(event, services),
    );
}
