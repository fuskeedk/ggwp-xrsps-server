import { SkillId } from "../../../../../src/rs/skill/skills";
import type { IScriptRegistry, NpcInteractionEvent, ScriptServices } from "../../../../../src/game/scripts/types";
import { getQuestFlag, getQuestStringFlag, setQuestFlag, setQuestStringFlag } from "../QuestFlags";
import { completeQuest, countCarriedItem, getQuestStage, setQuestStage, takeQuestItems } from "../QuestService";
import { type DialogueContext, type DialogueStep, startConversation } from "../dialogue";
import { buildCompleteJournal, buildNotStartedJournal, registerQuestNpcTalk, strikeIf } from "../helpers";
import type { QuestDefinition } from "../types";

const COINS_ITEM_ID = 995;

function hasItem(player: Parameters<typeof countCarriedItem>[0], services: ScriptServices, itemId: number, quantity = 1): boolean {
    return countCarriedItem(player, services, itemId) >= quantity;
}

function addItemIfMissing(
    player: Parameters<typeof countCarriedItem>[0],
    services: ScriptServices,
    itemId: number,
    quantity = 1,
): void {
    if (countCarriedItem(player, services, itemId) > 0) return;
    const added = services.inventory.addItemToInventory(player, itemId, quantity);
    if (added.added > 0) services.inventory.snapshotInventory(player);
}

// -----------------------------------------------------------------------------
// 1) The Restless Ghost
// -----------------------------------------------------------------------------
const restlessGhostQuest: QuestDefinition = {
    key: "restless_ghost",
    name: "The Restless Ghost",
    varpId: 107,
    startedValue: 1,
    completionValue: 5,
    rewards: {
        questPoints: 1,
        xp: [{ skillId: SkillId.Prayer, amount: 1125, label: "Prayer" }],
    },
    rewardItemId: 552,
    overviewStartText:
        "helping <col=800000>Father Aereck</col> with a ghost in the Lumbridge graveyard.",
    buildJournal(player, services): string[] {
        const stage = getQuestStage(player, restlessGhostQuest);
        if (stage < restlessGhostQuest.startedValue) {
            return buildNotStartedJournal(restlessGhostQuest, "I can start this quest by talking to Father Aereck in Lumbridge.");
        }
        if (stage >= restlessGhostQuest.completionValue) {
            return buildCompleteJournal([
                "Father Aereck asked me to help a restless ghost in the graveyard.",
                "Father Urhney gave me an Amulet of Ghostspeak. I found the skull and laid the ghost to rest.",
            ]);
        }
        return [
            "A ghost is haunting the Lumbridge graveyard.",
            "",
            strikeIf(
                getQuestFlag(player, restlessGhostQuest.key, "met_urhney"),
                "I should speak with Father Urhney in the Lumbridge Swamp.",
            ),
            strikeIf(
                getQuestFlag(player, restlessGhostQuest.key, "has_skull") || hasItem(player, services, 553),
                "I need to find the ghost's skull and lay it to rest.",
            ),
        ];
    },
    register(registry, _services): void {
        registerQuestNpcTalk(registry, 2812, (event) => {
            const { player, services } = event;
            const ctx: DialogueContext = { player, services, npcId: 2812, npcName: "Father Aereck" };
            const stage = getQuestStage(player, restlessGhostQuest);

            if (stage >= restlessGhostQuest.completionValue) {
                startConversation(ctx, [
                    { npc: ["Thank you for putting that ghost to rest."] },
                    { player: ["Glad I could help."] },
                ]);
                return;
            }

            if (stage >= restlessGhostQuest.startedValue) {
                if (getQuestFlag(player, restlessGhostQuest.key, "has_skull") && hasItem(player, services, 553)) {
                    startConversation(ctx, [
                        {
                            exec: (dctx) => {
                                takeQuestItems(dctx.player, dctx.services, [{ itemId: 553, quantity: 1, journalLabel: "" }]);
                            },
                        },
                        { player: ["I've laid the ghost to rest with its skull."] },
                        { npc: ["Wonderful! The graveyard is peaceful again."] },
                        { exec: (dctx) => completeQuest(dctx.player, dctx.services, restlessGhostQuest) },
                    ]);
                    return;
                }
                startConversation(ctx, [
                    { npc: ["Any luck with the ghost?"] },
                    { player: ["I'm still working on it."] },
                ]);
                return;
            }

            startConversation(ctx, [
                { npc: ["A ghost has been haunting our graveyard. Could you help?"] },
                {
                    options: [
                        {
                            text: "Yes, I'll help.",
                            next: [
                                { player: ["Yes, I'll help."] },
                                { npc: ["Speak with Father Urhney in the swamp. He knows about such things."] },
                                { exec: (dctx) => setQuestStage(dctx.player, restlessGhostQuest, dctx.services, restlessGhostQuest.startedValue) },
                            ],
                        },
                        {
                            text: "Not right now.",
                            next: [{ player: ["Not right now."] }],
                        },
                    ],
                },
            ]);
        });

        registerQuestNpcTalk(registry, 923, (event) => {
            const { player, services } = event;
            const ctx: DialogueContext = { player, services, npcId: 923, npcName: "Father Urhney" };
            const stage = getQuestStage(player, restlessGhostQuest);
            if (stage < restlessGhostQuest.startedValue) {
                startConversation(ctx, [{ npc: ["Leave me in peace."] }]);
                return;
            }
            if (getQuestFlag(player, restlessGhostQuest.key, "met_urhney")) {
                startConversation(ctx, [{ npc: ["Find the ghost's skull, then return to Father Aereck."] }]);
                return;
            }
            startConversation(ctx, [
                { npc: ["Take this Amulet of Ghostspeak. You'll need it to help the ghost find its skull."] },
                {
                    exec: (dctx) => {
                        setQuestFlag(dctx.player, restlessGhostQuest.key, "met_urhney", true);
                        addItemIfMissing(dctx.player, dctx.services, 552, 1);
                        if (!hasItem(dctx.player, dctx.services, 553)) {
                            addItemIfMissing(dctx.player, dctx.services, 553, 1);
                            setQuestFlag(dctx.player, restlessGhostQuest.key, "has_skull", true);
                        }
                    },
                },
                { player: ["Thank you, Father."] },
            ]);
        });
    },
};

// -----------------------------------------------------------------------------
// 2) Imp Catcher
// -----------------------------------------------------------------------------
const impCatcherQuest: QuestDefinition = {
    key: "imp_catcher",
    name: "Imp Catcher",
    varpId: 160,
    startedValue: 1,
    completionValue: 2,
    rewards: {
        questPoints: 1,
        xp: [{ skillId: SkillId.Magic, amount: 875, label: "Magic" }],
        items: [{ itemId: 1478, quantity: 1, label: "Amulet of accuracy" }],
    },
    rewardItemId: 1478,
    overviewStartText:
        "collecting beads for <col=800000>Wizard Mizgog</col> in the Wizards' Tower.",
    buildJournal(player, services): string[] {
        const stage = getQuestStage(player, impCatcherQuest);
        if (stage < impCatcherQuest.startedValue) {
            return buildNotStartedJournal(impCatcherQuest, "I can start this quest by talking to Wizard Mizgog.");
        }
        if (stage >= impCatcherQuest.completionValue) {
            return buildCompleteJournal([
                "Imps stole Wizard Mizgog's beads.",
                "I collected all four beads and returned them. He gave me an Amulet of Accuracy.",
            ]);
        }
        return [
            "Wizard Mizgog needs his beads returned from imps.",
            "",
            strikeIf(hasItem(player, services, 1470), "I need a red bead."),
            strikeIf(hasItem(player, services, 1472), "I need a yellow bead."),
            strikeIf(hasItem(player, services, 1474), "I need a black bead."),
            strikeIf(hasItem(player, services, 1476), "I need a white bead."),
        ];
    },
    register(registry, _services): void {
        const hasAllBeads = (event: NpcInteractionEvent): boolean =>
            hasItem(event.player, event.services, 1470) &&
            hasItem(event.player, event.services, 1472) &&
            hasItem(event.player, event.services, 1474) &&
            hasItem(event.player, event.services, 1476);

        registerQuestNpcTalk(registry, 5005, (event) => {
            const { player, services } = event;
            const ctx: DialogueContext = { player, services, npcId: 5005, npcName: "Wizard Mizgog" };
            const stage = getQuestStage(player, impCatcherQuest);
            const deliverSteps: DialogueStep[] = [
                {
                    exec: (dctx) => {
                        takeQuestItems(dctx.player, dctx.services, [
                            { itemId: 1470, quantity: 1, journalLabel: "" },
                            { itemId: 1472, quantity: 1, journalLabel: "" },
                            { itemId: 1474, quantity: 1, journalLabel: "" },
                            { itemId: 1476, quantity: 1, journalLabel: "" },
                        ]);
                    },
                },
                { player: ["Here are your beads."] },
                { npc: ["Excellent! Take this amulet as a reward."] },
                { exec: (dctx) => completeQuest(dctx.player, dctx.services, impCatcherQuest) },
            ];

            if (stage >= impCatcherQuest.completionValue) {
                startConversation(ctx, [
                    { npc: ["Thanks to you my beads are safe!"] },
                    { player: ["Any time."] },
                ]);
                return;
            }

            if (stage >= impCatcherQuest.startedValue) {
                startConversation(
                    ctx,
                    hasAllBeads(event)
                        ? deliverSteps
                        : [
                              { npc: ["Do you have all four beads yet?"] },
                              { player: ["Not yet."] },
                          ],
                );
                return;
            }

            startConversation(ctx, [
                { npc: ["Imps stole my beads! Can you get them back?"] },
                {
                    options: [
                        {
                            text: "Yes, I'll find them.",
                            next: [
                                { player: ["Yes, I'll find them."] },
                                { npc: ["Bring me a red, yellow, black and white bead."] },
                                { exec: (dctx) => setQuestStage(dctx.player, impCatcherQuest, dctx.services, impCatcherQuest.startedValue) },
                                ...(hasAllBeads(event) ? deliverSteps : []),
                            ],
                        },
                        { text: "No thanks.", next: [{ player: ["No thanks."] }] },
                    ],
                },
            ]);
        });
    },
};

// -----------------------------------------------------------------------------
// 3) Rune Mysteries
// -----------------------------------------------------------------------------
const runeMysteriesQuest: QuestDefinition = {
    key: "rune_mysteries",
    name: "Rune Mysteries",
    varpId: 63,
    startedValue: 1,
    completionValue: 6,
    rewards: {
        questPoints: 1,
        items: [{ itemId: 1438, quantity: 1, label: "Air talisman" }],
    },
    rewardItemId: 1438,
    overviewStartText:
        "helping the <col=800000>Duke of Lumbridge</col> with a matter at the Wizards' Tower.",
    buildJournal(player, services): string[] {
        const stage = getQuestStage(player, runeMysteriesQuest);
        if (stage < runeMysteriesQuest.startedValue) {
            return buildNotStartedJournal(runeMysteriesQuest, "I can start this quest by talking to the Duke of Lumbridge.");
        }
        if (stage >= runeMysteriesQuest.completionValue) {
            return buildCompleteJournal([
                "The Duke of Lumbridge asked me to investigate strange rune stones.",
                "I spoke with Sedridor at the Wizards' Tower and obtained a research package.",
                "I returned the package to the Duke and was rewarded with an air talisman.",
            ]);
        }
        return [
            "The Duke of Lumbridge has asked me to speak with the head wizard at the Wizards' Tower.",
            "",
            strikeIf(
                getQuestFlag(player, runeMysteriesQuest.key, "talked_to_sedridor"),
                "I need to speak with Sedridor at the Wizards' Tower.",
            ),
            strikeIf(hasItem(player, services, 290), "I need to return the research package to the Duke of Lumbridge."),
        ];
    },
    register(registry, _services): void {
        registerQuestNpcTalk(registry, 815, (event) => {
            const { player, services } = event;
            const ctx: DialogueContext = { player, services, npcId: 815, npcName: "Duke Horacio" };
            const stage = getQuestStage(player, runeMysteriesQuest);
            if (stage >= runeMysteriesQuest.completionValue) {
                startConversation(ctx, [
                    { npc: ["Thank you again for your help with the rune mysteries."] },
                    { player: ["You're welcome, your grace."] },
                ]);
                return;
            }
            if (stage >= runeMysteriesQuest.startedValue) {
                if (hasItem(player, services, 290)) {
                    startConversation(ctx, [
                        {
                            exec: (dctx) =>
                                takeQuestItems(dctx.player, dctx.services, [{ itemId: 290, quantity: 1, journalLabel: "" }]),
                        },
                        { player: ["I have the research package from Sedridor."] },
                        { npc: ["Splendid! Please take this air talisman as a reward."] },
                        { exec: (dctx) => completeQuest(dctx.player, dctx.services, runeMysteriesQuest) },
                    ]);
                } else {
                    startConversation(ctx, [
                        { npc: ["Have you spoken with Sedridor yet?"] },
                        { player: ["Not yet, I'm on my way."] },
                    ]);
                }
                return;
            }
            startConversation(ctx, [
                { npc: ["Adventurer, I have a task for you if you are willing."] },
                {
                    options: [
                        {
                            text: "What do you need?",
                            next: [
                                { player: ["What do you need?"] },
                                {
                                    npc: [
                                        "Strange rune stones have appeared.",
                                        "Please speak with Sedridor at the Wizards' Tower, and bring me his research package.",
                                    ],
                                },
                                { player: ["I'll go and see him."] },
                                { exec: (dctx) => setQuestStage(dctx.player, runeMysteriesQuest, dctx.services, runeMysteriesQuest.startedValue) },
                            ],
                        },
                        { text: "Not right now.", next: [{ player: ["Not right now."] }] },
                    ],
                },
            ]);
        });

        registerQuestNpcTalk(registry, 5034, (event) => {
            const { player, services } = event;
            const ctx: DialogueContext = { player, services, npcId: 5034, npcName: "Sedridor" };
            const stage = getQuestStage(player, runeMysteriesQuest);
            if (stage >= runeMysteriesQuest.completionValue) {
                startConversation(ctx, [{ npc: ["Thank you for delivering my research to the Duke."] }]);
                return;
            }
            if (stage < runeMysteriesQuest.startedValue) {
                startConversation(ctx, [{ npc: ["Welcome to the Wizards' Tower."] }]);
                return;
            }
            if (getQuestFlag(player, runeMysteriesQuest.key, "talked_to_sedridor") && hasItem(player, services, 290)) {
                startConversation(ctx, [{ npc: ["Take that package to the Duke of Lumbridge."] }]);
                return;
            }
            startConversation(ctx, [
                { npc: ["Ah, the Duke sent you! I have prepared a research package for him."] },
                {
                    exec: (dctx) => {
                        setQuestFlag(dctx.player, runeMysteriesQuest.key, "talked_to_sedridor", true);
                        addItemIfMissing(dctx.player, dctx.services, 290, 1);
                    },
                },
                { player: ["I'll take it to the Duke right away."] },
            ]);
        });
    },
};

// -----------------------------------------------------------------------------
// 4) Ernest the Chicken
// -----------------------------------------------------------------------------
const ernestTheChickenQuest: QuestDefinition = {
    key: "ernest_the_chicken",
    name: "Ernest the Chicken",
    varpId: 32,
    startedValue: 1,
    completionValue: 3,
    rewards: {
        questPoints: 1,
        items: [{ itemId: COINS_ITEM_ID, quantity: 300, label: "300 Coins" }],
    },
    rewardItemId: COINS_ITEM_ID,
    overviewStartText: "rescuing <col=800000>Ernest</col> from Draynor Manor.",
    buildJournal(player, _services): string[] {
        const stage = getQuestStage(player, ernestTheChickenQuest);
        if (stage < ernestTheChickenQuest.startedValue) {
            return buildNotStartedJournal(ernestTheChickenQuest, "I can start this quest by talking to Veronica near Draynor Manor.");
        }
        if (stage >= ernestTheChickenQuest.completionValue) {
            return buildCompleteJournal([
                "Veronica asked me to find Ernest in Draynor Manor.",
                "Professor Oddenstein had turned him into a chicken. I helped restore him and reunited the couple.",
            ]);
        }
        return [
            "Veronica's fiance Ernest is missing in Draynor Manor.",
            "",
            strikeIf(getQuestFlag(player, ernestTheChickenQuest.key, "spoke_ernest"), "I need to find Ernest inside the manor."),
            strikeIf(
                getQuestFlag(player, ernestTheChickenQuest.key, "fixed_ernest"),
                "I need to help Professor Oddenstein restore Ernest.",
            ),
            strikeIf(
                getQuestFlag(player, ernestTheChickenQuest.key, "fixed_ernest"),
                "I should tell Veronica that Ernest is safe.",
            ),
        ];
    },
    register(registry, _services): void {
        registerQuestNpcTalk(registry, 3561, (event) => {
            const { player, services } = event;
            const ctx: DialogueContext = { player, services, npcId: 3561, npcName: "Veronica" };
            const stage = getQuestStage(player, ernestTheChickenQuest);

            if (stage >= ernestTheChickenQuest.completionValue) {
                startConversation(ctx, [
                    { npc: ["Ernest and I are so grateful!"] },
                    { player: ["Happy to help."] },
                ]);
                return;
            }
            if (stage >= ernestTheChickenQuest.startedValue) {
                if (getQuestFlag(player, ernestTheChickenQuest.key, "fixed_ernest")) {
                    startConversation(ctx, [
                        { player: ["Ernest is human again!"] },
                        { npc: ["Oh thank you! Here's a little reward."] },
                        { exec: (dctx) => completeQuest(dctx.player, dctx.services, ernestTheChickenQuest) },
                    ]);
                } else {
                    startConversation(ctx, [
                        { npc: ["Please find Ernest in the manor!"] },
                        { player: ["I'm on it."] },
                    ]);
                }
                return;
            }
            startConversation(ctx, [
                { npc: ["My Ernest went into the manor and never came out!"] },
                {
                    options: [
                        {
                            text: "I'll find him.",
                            next: [
                                { player: ["I'll find him."] },
                                { exec: (dctx) => setQuestStage(dctx.player, ernestTheChickenQuest, dctx.services, ernestTheChickenQuest.startedValue) },
                            ],
                        },
                        { text: "Sorry, can't help.", next: [{ player: ["Sorry, can't help."] }] },
                    ],
                },
            ]);
        });

        registerQuestNpcTalk(registry, 3337, (event) => {
            const { player, services } = event;
            if (getQuestStage(player, ernestTheChickenQuest) < ernestTheChickenQuest.startedValue) return;
            startConversation(
                { player, services, npcId: 3337, npcName: "Ernest" },
                [
                    { exec: (dctx) => setQuestFlag(dctx.player, ernestTheChickenQuest.key, "spoke_ernest", true) },
                    { npc: ["Bawk! I'm a chicken! Find Professor Oddenstein upstairs!"] },
                    { player: ["Don't worry Ernest, I'll sort this out."] },
                ],
            );
        });

        registerQuestNpcTalk(registry, 3562, (event) => {
            const { player, services } = event;
            const ctx: DialogueContext = { player, services, npcId: 3562, npcName: "Professor Oddenstein" };
            const stage = getQuestStage(player, ernestTheChickenQuest);
            if (stage < ernestTheChickenQuest.startedValue || !getQuestFlag(player, ernestTheChickenQuest.key, "spoke_ernest")) {
                startConversation(ctx, [{ npc: ["Science is fascinating, isn't it?"] }]);
                return;
            }
            startConversation(ctx, [
                { exec: (dctx) => setQuestFlag(dctx.player, ernestTheChickenQuest.key, "fixed_ernest", true) },
                { npc: ["Ah yes, Ernest! A slight miscalculation. He's human again now."] },
                { player: ["I'll tell Veronica."] },
            ]);
        });
    },
};

// -----------------------------------------------------------------------------
// 5) Vampyre Slayer
// -----------------------------------------------------------------------------
const vampyreSlayerQuest: QuestDefinition = {
    key: "vampyre_slayer",
    name: "Vampyre Slayer",
    varpId: 178,
    startedValue: 1,
    completionValue: 3,
    rewards: {
        questPoints: 1,
        xp: [{ skillId: SkillId.Attack, amount: 4825, label: "Attack" }],
    },
    rewardItemId: 1549,
    overviewStartText:
        "slaying <col=800000>Count Draynor</col> for the people of Draynor Village.",
    buildJournal(player, services): string[] {
        const stage = getQuestStage(player, vampyreSlayerQuest);
        if (stage < vampyreSlayerQuest.startedValue) {
            return buildNotStartedJournal(vampyreSlayerQuest, "I can start this quest by talking to Morgan in Draynor Village.");
        }
        if (stage >= vampyreSlayerQuest.completionValue) {
            return buildCompleteJournal([
                "Morgan asked me to slay Count Draynor.",
                "Dr Harlow told me how to kill a vampyre. I drove a stake through the Count with a hammer.",
            ]);
        }
        return [
            "Count Draynor is terrorising Draynor Village.",
            "",
            strikeIf(
                getQuestFlag(player, vampyreSlayerQuest.key, "spoke_harlow"),
                "I should speak with Dr Harlow at the Blue Moon Inn in Varrock.",
            ),
            strikeIf(hasItem(player, services, 1549), "I need a stake and a hammer to slay the Count."),
            strikeIf(hasItem(player, services, 2347), "I need a stake and a hammer to slay the Count."),
            strikeIf(getQuestFlag(player, vampyreSlayerQuest.key, "slain_count"), "I must defeat Count Draynor in his manor."),
        ];
    },
    register(registry, _services): void {
        registerQuestNpcTalk(registry, 3479, (event) => {
            const { player, services } = event;
            const ctx: DialogueContext = { player, services, npcId: 3479, npcName: "Morgan" };
            const stage = getQuestStage(player, vampyreSlayerQuest);
            if (stage < vampyreSlayerQuest.startedValue) {
                return;
            }
            if (stage >= vampyreSlayerQuest.completionValue) {
                return;
            }
            if (stage >= vampyreSlayerQuest.startedValue) {
                startConversation(ctx, [
                    { npc: ["Have you dealt with the Count yet?"] },
                    { player: ["I'm still working on it."] },
                ]);
                return;
            }
            startConversation(ctx, [
                { npc: ["Count Draynor is a vampyre! We need someone brave to stop him."] },
                {
                    options: [
                        {
                            text: "I'll stop him.",
                            next: [
                                { player: ["I'll stop him."] },
                                { npc: ["Speak with Dr Harlow in Varrock. He knows how to kill vampyres."] },
                                { exec: (dctx) => setQuestStage(dctx.player, vampyreSlayerQuest, dctx.services, vampyreSlayerQuest.startedValue) },
                            ],
                        },
                        { text: "Not me.", next: [{ player: ["Not me."] }] },
                    ],
                },
            ]);
        });

        registerQuestNpcTalk(registry, 3480, (event) => {
            const { player, services } = event;
            const ctx: DialogueContext = { player, services, npcId: 3480, npcName: "Dr Harlow" };
            if (getQuestStage(player, vampyreSlayerQuest) < vampyreSlayerQuest.startedValue) {
                startConversation(ctx, [{ npc: ["Buy me a beer sometime."] }]);
                return;
            }
            startConversation(ctx, [
                {
                    exec: (dctx) => {
                        setQuestFlag(dctx.player, vampyreSlayerQuest.key, "spoke_harlow", true);
                        addItemIfMissing(dctx.player, dctx.services, 1549, 1);
                        addItemIfMissing(dctx.player, dctx.services, 2347, 1);
                    },
                },
                { npc: ["Take this stake and a hammer. Drive it through Draynor's heart!"] },
                { player: ["I'll finish him off."] },
            ]);
        });

        registerQuestNpcTalk(registry, 1672, (event) => {
            const { player, services } = event;
            const ctx: DialogueContext = { player, services, npcId: 1672, npcName: "Count Draynor" };
            if (getQuestStage(player, vampyreSlayerQuest) < vampyreSlayerQuest.startedValue) return;
            if (!hasItem(player, services, 1549) || !hasItem(player, services, 2347)) {
                startConversation(ctx, [{ npc: ["You cannot harm me, mortal!"] }]);
                return;
            }
            startConversation(ctx, [
                {
                    exec: (dctx) => {
                        takeQuestItems(dctx.player, dctx.services, [{ itemId: 1549, quantity: 1, journalLabel: "" }]);
                        setQuestFlag(dctx.player, vampyreSlayerQuest.key, "slain_count", true);
                    },
                },
                { player: ["Take that, Count Draynor!"] },
                { npc: ["No! My power... fades..."] },
                { exec: (dctx) => completeQuest(dctx.player, dctx.services, vampyreSlayerQuest) },
            ]);
        });
    },
};

// -----------------------------------------------------------------------------
// 6) Pirate's Treasure
// -----------------------------------------------------------------------------
const piratesTreasureQuest: QuestDefinition = {
    key: "pirates_treasure",
    name: "Pirate's Treasure",
    varpId: 71,
    startedValue: 1,
    completionValue: 4,
    rewards: {
        questPoints: 1,
        items: [
            { itemId: COINS_ITEM_ID, quantity: 450, label: "450 Coins" },
            { itemId: 1631, quantity: 1, label: "Emerald" },
        ],
    },
    rewardItemId: 1631,
    overviewStartText:
        "hunting treasure with <col=800000>Redbeard Frank</col> in Port Sarim.",
    buildJournal(player, services): string[] {
        const stage = getQuestStage(player, piratesTreasureQuest);
        if (stage < piratesTreasureQuest.startedValue) {
            return buildNotStartedJournal(piratesTreasureQuest, "I can start this quest by talking to Redbeard Frank in Port Sarim.");
        }
        if (stage >= piratesTreasureQuest.completionValue) {
            return buildCompleteJournal([
                "Redbeard Frank traded treasure directions for Karamjan rum.",
                "I found the treasure chest and claimed the reward.",
            ]);
        }
        return [
            "Redbeard Frank knows of buried treasure.",
            "",
            strikeIf(hasItem(player, services, 431), "I need to bring Frank some Karamjan rum."),
            strikeIf(getQuestFlag(player, piratesTreasureQuest.key, "got_message"), "I need to follow Frank's directions to the treasure."),
        ];
    },
    register(registry, _services): void {
        registerQuestNpcTalk(registry, 3643, (event) => {
            const { player, services } = event;
            const ctx: DialogueContext = { player, services, npcId: 3643, npcName: "Redbeard Frank" };
            const stage = getQuestStage(player, piratesTreasureQuest);

            const finish: DialogueStep[] = [
                {
                    exec: (dctx) => {
                        takeQuestItems(dctx.player, dctx.services, [{ itemId: 431, quantity: 1, journalLabel: "" }]);
                        setQuestFlag(dctx.player, piratesTreasureQuest.key, "got_message", true);
                    },
                },
                { player: ["Here's your rum."] },
                { npc: ["Arr! The treasure be in Falador Park. Dig near the east fountain!"] },
                { player: ["I found it! Thanks Frank."] },
                { exec: (dctx) => completeQuest(dctx.player, dctx.services, piratesTreasureQuest) },
            ];

            if (stage >= piratesTreasureQuest.completionValue) {
                startConversation(ctx, [
                    { npc: ["Arr, that were fine treasure hunting!"] },
                    { player: ["Yarr!"] },
                ]);
                return;
            }
            if (stage >= piratesTreasureQuest.startedValue) {
                startConversation(
                    ctx,
                    hasItem(player, services, 431)
                        ? finish
                        : [
                              { npc: ["Got me rum yet, matey?"] },
                              { player: ["Not yet."] },
                          ],
                );
                return;
            }
            startConversation(ctx, [
                { npc: ["Arr! Bring me some Karamjan rum and I'll tell ye where treasure be buried!"] },
                {
                    options: [
                        {
                            text: "I'll get some rum.",
                            next: [
                                { player: ["I'll get some rum."] },
                                { exec: (dctx) => setQuestStage(dctx.player, piratesTreasureQuest, dctx.services, piratesTreasureQuest.startedValue) },
                                ...(hasItem(player, services, 431) ? finish : []),
                            ],
                        },
                        { text: "No thanks.", next: [{ player: ["No thanks."] }] },
                    ],
                },
            ]);
        });
    },
};

// -----------------------------------------------------------------------------
// 7) Goblin Diplomacy
// -----------------------------------------------------------------------------
const goblinDiplomacyQuest: QuestDefinition = {
    key: "goblin_diplomacy",
    name: "Goblin Diplomacy",
    varpId: 2378,
    startedValue: 1,
    completionValue: 6,
    rewards: {
        questPoints: 1,
        xp: [{ skillId: SkillId.Crafting, amount: 200, label: "Crafting" }],
        items: [{ itemId: 2357, quantity: 1, label: "Gold bar" }],
    },
    rewardItemId: 2357,
    overviewStartText:
        "settling a dispute between goblin generals north of <col=800000>Falador</col>.",
    buildJournal(player, services): string[] {
        const stage = getQuestStage(player, goblinDiplomacyQuest);
        if (stage < goblinDiplomacyQuest.startedValue) {
            return buildNotStartedJournal(goblinDiplomacyQuest, "I can start this quest by talking to either goblin general.");
        }
        if (stage >= goblinDiplomacyQuest.completionValue) {
            return buildCompleteJournal([
                "The goblin generals couldn't agree on armour colours.",
                "I brought each general the mail they wanted and peace was restored.",
            ]);
        }
        return [
            "The goblin generals are arguing over armour colours.",
            "",
            strikeIf(hasItem(player, services, 286), "I need orange goblin mail for General Bentnoze."),
            strikeIf(hasItem(player, services, 287), "I need dark blue goblin mail for General Wartface."),
        ];
    },
    register(registry, _services): void {
        const makeHandler = (npcId: number, npcName: string, doneLine: string): ((event: NpcInteractionEvent) => void) => {
            return (event) => {
                const { player, services } = event;
                const ctx: DialogueContext = { player, services, npcId, npcName };
                const stage = getQuestStage(player, goblinDiplomacyQuest);
                const hasArmour = hasItem(player, services, 286) && hasItem(player, services, 287);

                if (stage >= goblinDiplomacyQuest.completionValue) {
                    startConversation(ctx, [{ npc: [doneLine] }]);
                    return;
                }
                if (stage >= goblinDiplomacyQuest.startedValue) {
                    if (!hasArmour) {
                        startConversation(ctx, [
                            { npc: ["You bring mail colours yet?"] },
                            { player: ["Not yet."] },
                        ]);
                        return;
                    }
                    startConversation(ctx, [
                        {
                            exec: (dctx) =>
                                takeQuestItems(dctx.player, dctx.services, [
                                    { itemId: 286, quantity: 1, journalLabel: "" },
                                    { itemId: 287, quantity: 1, journalLabel: "" },
                                ]),
                        },
                        { player: ["Here's the armour you both wanted."] },
                        { npc: ["Goblins happy now! You take gold bar."] },
                        { exec: (dctx) => completeQuest(dctx.player, dctx.services, goblinDiplomacyQuest) },
                    ]);
                    return;
                }
                startConversation(ctx, [
                    { npc: ["We goblins fight over armour colour! You help?"] },
                    {
                        options: [
                            {
                                text: "I'll help.",
                                next: [
                                    { player: ["I'll help."] },
                                    { npc: ["You bring orange mail to Bentnoze and dark blue mail to Wartface. Then we happy."] },
                                    { exec: (dctx) => setQuestStage(dctx.player, goblinDiplomacyQuest, dctx.services, goblinDiplomacyQuest.startedValue) },
                                ],
                            },
                            { text: "Not interested.", next: [{ player: ["Not interested."] }] },
                        ],
                    },
                ]);
            };
        };

        registerQuestNpcTalk(registry, 3392, makeHandler(3392, "General Bentnoze", "Orange armour best!"));
        registerQuestNpcTalk(registry, 3391, makeHandler(3391, "General Wartface", "Dark blue armour best!"));
    },
};

// -----------------------------------------------------------------------------
// 8) Witch's Potion
// -----------------------------------------------------------------------------
const witchsPotionQuest: QuestDefinition = {
    key: "witchs_potion",
    name: "Witch's Potion",
    varpId: 67,
    startedValue: 1,
    completionValue: 3,
    rewards: {
        questPoints: 1,
        xp: [{ skillId: SkillId.Magic, amount: 325, label: "Magic" }],
    },
    rewardItemId: 221,
    overviewStartText: "helping <col=800000>Hetty the Witch</col> in Rimmington.",
    buildJournal(player, services): string[] {
        const stage = getQuestStage(player, witchsPotionQuest);
        if (stage < witchsPotionQuest.startedValue) {
            return buildNotStartedJournal(witchsPotionQuest, "I can start this quest by talking to Hetty in Rimmington.");
        }
        if (stage >= witchsPotionQuest.completionValue) {
            return buildCompleteJournal([
                "Hetty needed ingredients for her potion.",
                "I brought her an eye of newt, an onion and burnt meat. She taught me some magic.",
            ]);
        }
        return [
            "Hetty is brewing a potion and needs ingredients.",
            "",
            strikeIf(hasItem(player, services, 221), "I need an eye of newt, an onion and some burnt meat."),
            strikeIf(hasItem(player, services, 1957), "I need an eye of newt, an onion and some burnt meat."),
            strikeIf(hasItem(player, services, 2146), "I need an eye of newt, an onion and some burnt meat."),
        ];
    },
    register(registry, _services): void {
        registerQuestNpcTalk(registry, 4619, (event) => {
            const { player, services } = event;
            const ctx: DialogueContext = { player, services, npcId: 4619, npcName: "Hetty" };
            const stage = getQuestStage(player, witchsPotionQuest);
            const hasIngredients = hasItem(player, services, 221) && hasItem(player, services, 1957) && hasItem(player, services, 2146);

            if (stage >= witchsPotionQuest.completionValue) {
                startConversation(ctx, [
                    { npc: ["My potion turned out wonderfully thanks to you."] },
                    { player: ["Glad to hear it."] },
                ]);
                return;
            }
            if (stage >= witchsPotionQuest.startedValue) {
                if (!hasIngredients) {
                    startConversation(ctx, [
                        { npc: ["Have you got my ingredients?"] },
                        { player: ["Not yet."] },
                    ]);
                    return;
                }
                startConversation(ctx, [
                    {
                        exec: (dctx) =>
                            takeQuestItems(dctx.player, dctx.services, [
                                { itemId: 221, quantity: 1, journalLabel: "" },
                                { itemId: 1957, quantity: 1, journalLabel: "" },
                                { itemId: 2146, quantity: 1, journalLabel: "" },
                            ]),
                    },
                    { player: ["Here are your ingredients."] },
                    { npc: ["Perfect! Drink this and feel your magical power grow."] },
                    { exec: (dctx) => completeQuest(dctx.player, dctx.services, witchsPotionQuest) },
                ]);
                return;
            }

            startConversation(ctx, [
                { npc: ["I'm making a potion. Could you fetch some ingredients?"] },
                {
                    options: [
                        {
                            text: "What do you need?",
                            next: [
                                { player: ["What do you need?"] },
                                { npc: ["Bring me an eye of newt, an onion and a piece of burnt meat."] },
                                {
                                    options: [
                                        {
                                            text: "I'll get them.",
                                            next: [
                                                { player: ["I'll get them."] },
                                                {
                                                    exec: (dctx) =>
                                                        setQuestStage(
                                                            dctx.player,
                                                            witchsPotionQuest,
                                                            dctx.services,
                                                            witchsPotionQuest.startedValue,
                                                        ),
                                                },
                                            ],
                                        },
                                        { text: "Maybe later.", next: [{ player: ["Maybe later."] }] },
                                    ],
                                },
                            ],
                        },
                        { text: "No thanks.", next: [{ player: ["No thanks."] }] },
                    ],
                },
            ]);
        });
    },
};

// -----------------------------------------------------------------------------
// 9) Romeo & Juliet
// -----------------------------------------------------------------------------
const romeoAndJulietQuest: QuestDefinition = {
    key: "romeo_and_juliet",
    name: "Romeo & Juliet",
    varpId: 144,
    startedValue: 1,
    completionValue: 100,
    rewards: {
        questPoints: 1,
    },
    rewardItemId: 756,
    overviewStartText:
        "helping <col=800000>Romeo</col> win the heart of <col=800000>Juliet</col> in Varrock.",
    buildJournal(player, services): string[] {
        const stage = getQuestStage(player, romeoAndJulietQuest);
        if (stage < romeoAndJulietQuest.startedValue) {
            return buildNotStartedJournal(romeoAndJulietQuest, "I can start this quest by talking to Romeo in Varrock.");
        }
        if (stage >= romeoAndJulietQuest.completionValue) {
            return buildCompleteJournal([
                "Romeo asked me to help him with Juliet.",
                "I spoke with Juliet, obtained a cadava potion from the Apothecary, and gave it to Juliet.",
                "I returned to Romeo to let him know.",
            ]);
        }
        return [
            "Romeo wants me to help him speak with Juliet.",
            "",
            strikeIf(getQuestFlag(player, romeoAndJulietQuest.key, "spoke_juliet"), "I need to speak with Juliet."),
            strikeIf(
                getQuestFlag(player, romeoAndJulietQuest.key, "got_cadava") || hasItem(player, services, 756),
                "I need to get a cadava potion from the Apothecary.",
            ),
            strikeIf(getQuestFlag(player, romeoAndJulietQuest.key, "gave_cadava"), "I need to return to Romeo."),
        ];
    },
    register(registry, _services): void {
        registerQuestNpcTalk(registry, 5037, (event) => {
            const { player, services } = event;
            const ctx: DialogueContext = { player, services, npcId: 5037, npcName: "Romeo" };
            const stage = getQuestStage(player, romeoAndJulietQuest);
            if (stage >= romeoAndJulietQuest.completionValue) {
                startConversation(ctx, [
                    { npc: ["Juliet and I are most grateful!"] },
                    { player: ["Glad I could help."] },
                ]);
                return;
            }
            if (stage >= romeoAndJulietQuest.startedValue) {
                if (getQuestFlag(player, romeoAndJulietQuest.key, "gave_cadava")) {
                    startConversation(ctx, [
                        { player: ["I've given Juliet the cadava potion."] },
                        { npc: ["At last! Thank you, my friend!"] },
                        { exec: (dctx) => completeQuest(dctx.player, dctx.services, romeoAndJulietQuest) },
                    ]);
                } else {
                    startConversation(ctx, [
                        { npc: ["Please, you must help me win Juliet's heart!"] },
                        { player: ["What should I do?"] },
                        { npc: ["Speak with Juliet on the balcony west of here."] },
                    ]);
                }
                return;
            }
            startConversation(ctx, [
                { npc: ["Juliet! My love! She won't speak to me!"] },
                {
                    options: [
                        {
                            text: "Perhaps I can help.",
                            next: [
                                { player: ["Perhaps I can help."] },
                                { npc: ["Oh, thank you! Please speak with Juliet for me."] },
                                { exec: (dctx) => setQuestStage(dctx.player, romeoAndJulietQuest, dctx.services, romeoAndJulietQuest.startedValue) },
                            ],
                        },
                        { text: "Not my problem.", next: [{ player: ["Not my problem."] }] },
                    ],
                },
            ]);
        });

        registerQuestNpcTalk(registry, 6268, (event) => {
            const { player, services } = event;
            const ctx: DialogueContext = { player, services, npcId: 6268, npcName: "Juliet" };
            if (getQuestStage(player, romeoAndJulietQuest) < romeoAndJulietQuest.startedValue) {
                startConversation(ctx, [{ npc: ["I cannot talk right now."] }]);
                return;
            }
            if (getQuestFlag(player, romeoAndJulietQuest.key, "gave_cadava")) {
                startConversation(ctx, [{ npc: ["I drank the potion... tell Romeo I'm alright."] }]);
                return;
            }
            if (hasItem(player, services, 756)) {
                startConversation(ctx, [
                    {
                        exec: (dctx) => {
                            takeQuestItems(dctx.player, dctx.services, [{ itemId: 756, quantity: 1, journalLabel: "" }]);
                            setQuestFlag(dctx.player, romeoAndJulietQuest.key, "gave_cadava", true);
                        },
                    },
                    { player: ["Juliet, Romeo sent this cadava potion for you."] },
                    { npc: ["Oh! Thank you... please tell Romeo I'll be fine."] },
                ]);
                return;
            }
            startConversation(ctx, [
                { exec: (dctx) => setQuestFlag(dctx.player, romeoAndJulietQuest.key, "spoke_juliet", true) },
                { npc: ["Romeo! I cannot be with him... my father forbids it."] },
                { player: ["Isn't there anything we can do?"] },
                { npc: ["The Apothecary in south-west Varrock may help. Ask him for a cadava potion."] },
            ]);
        });

        registerQuestNpcTalk(registry, 5036, (event) => {
            const { player, services } = event;
            const ctx: DialogueContext = { player, services, npcId: 5036, npcName: "Apothecary" };
            const stage = getQuestStage(player, romeoAndJulietQuest);
            if (stage < romeoAndJulietQuest.startedValue || !getQuestFlag(player, romeoAndJulietQuest.key, "spoke_juliet")) {
                startConversation(ctx, [{ npc: ["I sell potions. What do you need?"] }]);
                return;
            }
            if (getQuestFlag(player, romeoAndJulietQuest.key, "got_cadava") || hasItem(player, services, 756)) {
                startConversation(ctx, [{ npc: ["You already have the cadava potion."] }]);
                return;
            }
            startConversation(ctx, [
                { npc: ["A cadava potion? For Romeo and Juliet? Very well."] },
                {
                    exec: (dctx) => {
                        if (hasItem(dctx.player, dctx.services, 5106, 2)) {
                            takeQuestItems(dctx.player, dctx.services, [{ itemId: 5106, quantity: 2, journalLabel: "" }]);
                        }
                        dctx.services.inventory.addItemToInventory(dctx.player, 756, 1);
                        dctx.services.inventory.snapshotInventory(dctx.player);
                        setQuestFlag(dctx.player, romeoAndJulietQuest.key, "got_cadava", true);
                    },
                },
                { player: ["Thank you!"] },
            ]);
        });
    },
};

// -----------------------------------------------------------------------------
// 10) Demon Slayer
// -----------------------------------------------------------------------------
const demonSlayerQuest: QuestDefinition = {
    key: "demon_slayer",
    name: "Demon Slayer",
    varpId: 2561,
    startedValue: 1,
    completionValue: 3,
    rewards: {
        questPoints: 1,
        xp: [{ skillId: SkillId.Attack, amount: 2750, label: "Attack" }],
    },
    rewardItemId: 2402,
    overviewStartText:
        "defeating the demon <col=800000>Delrith</col> with Silverlight.",
    buildJournal(player, services): string[] {
        const stage = getQuestStage(player, demonSlayerQuest);
        if (stage < demonSlayerQuest.startedValue) {
            return buildNotStartedJournal(demonSlayerQuest, "I can start this quest by talking to Gypsy Aris in Varrock.");
        }
        if (stage >= demonSlayerQuest.completionValue) {
            return buildCompleteJournal([
                "Aris told me how to defeat Delrith.",
                "I banished Delrith with Silverlight and saved Varrock.",
            ]);
        }
        return [
            "A dark wizard is summoning Delrith to destroy Varrock.",
            "",
            strikeIf(getQuestFlag(player, demonSlayerQuest.key, "has_keys"), "I need the three keys to claim Silverlight."),
            strikeIf(
                getQuestFlag(player, demonSlayerQuest.key, "has_silverlight") || hasItem(player, services, 2402),
                "I must wield Silverlight and defeat Delrith.",
            ),
            strikeIf(getQuestFlag(player, demonSlayerQuest.key, "slain_delrith"), "I have defeated Delrith."),
        ];
    },
    register(registry, _services): void {
        registerQuestNpcTalk(registry, 5082, (event) => {
            const { player, services } = event;
            const ctx: DialogueContext = { player, services, npcId: 5082, npcName: "Gypsy Aris" };
            const stage = getQuestStage(player, demonSlayerQuest);
            if (stage >= demonSlayerQuest.completionValue) {
                startConversation(ctx, [
                    { npc: ["Varrock is safe thanks to you, hero."] },
                    { player: ["Glad I could help."] },
                ]);
                return;
            }
            if (stage >= demonSlayerQuest.startedValue) {
                if (!getQuestFlag(player, demonSlayerQuest.key, "has_keys")) {
                    startConversation(ctx, [
                        { npc: ["You must find the three magical keys to unlock Silverlight."] },
                        { npc: ["Take these keys I have sensed for you."] },
                        { exec: (dctx) => setQuestFlag(dctx.player, demonSlayerQuest.key, "has_keys", true) },
                        { player: ["I'll get Silverlight and stop Delrith."] },
                    ]);
                    return;
                }
                if (!getQuestFlag(player, demonSlayerQuest.key, "has_silverlight")) {
                    startConversation(ctx, [
                        {
                            exec: (dctx) => {
                                addItemIfMissing(dctx.player, dctx.services, 2402, 1);
                                setQuestFlag(dctx.player, demonSlayerQuest.key, "has_silverlight", true);
                            },
                        },
                        { npc: ["Take Silverlight. Only this sword can harm Delrith!"] },
                        { player: ["I'll find Delrith in the stone circle."] },
                    ]);
                    return;
                }
                startConversation(ctx, [
                    { npc: ["Delrith must still be at the stone circle south of Varrock."] },
                    { player: ["I'm on my way."] },
                ]);
                return;
            }
            startConversation(ctx, [
                { npc: ["A dark wizard is summoning Delrith to destroy Varrock!"] },
                {
                    options: [
                        {
                            text: "I'll stop Delrith.",
                            next: [
                                { player: ["I'll stop Delrith."] },
                                { npc: ["Then we must hurry. Speak with me again when you are ready."] },
                                { exec: (dctx) => setQuestStage(dctx.player, demonSlayerQuest, dctx.services, demonSlayerQuest.startedValue) },
                            ],
                        },
                        { text: "That sounds dangerous.", next: [{ player: ["That sounds dangerous."] }] },
                    ],
                },
            ]);
        });

        registerQuestNpcTalk(registry, 1035, (event) => {
            const { player, services } = event;
            const ctx: DialogueContext = { player, services, npcId: 1035, npcName: "Delrith" };
            if (getQuestStage(player, demonSlayerQuest) < demonSlayerQuest.startedValue) {
                startConversation(ctx, [{ npc: ["Begone, mortal!"] }]);
                return;
            }
            if (!hasItem(player, services, 2402)) {
                startConversation(ctx, [{ npc: ["Your weapons cannot harm me!"] }]);
                return;
            }
            startConversation(ctx, [
                { exec: (dctx) => setQuestFlag(dctx.player, demonSlayerQuest.key, "slain_delrith", true) },
                { player: ["Silverlight, destroy Delrith!"] },
                { npc: ["No! I am banished!"] },
                { exec: (dctx) => completeQuest(dctx.player, dctx.services, demonSlayerQuest) },
            ]);
        });
    },
};

// -----------------------------------------------------------------------------
// 11) Shield of Arrav
// -----------------------------------------------------------------------------
const shieldOfArravQuest: QuestDefinition = {
    key: "shield_of_arrav",
    name: "Shield of Arrav",
    varpId: 145,
    startedValue: 1,
    completionValue: 7,
    rewards: {
        questPoints: 1,
        items: [{ itemId: COINS_ITEM_ID, quantity: 600, label: "600 Coins" }],
    },
    rewardItemId: 763,
    overviewStartText:
        "recovering the stolen <col=800000>Shield of Arrav</col> for Varrock.",
    buildJournal(player, services): string[] {
        const stage = getQuestStage(player, shieldOfArravQuest);
        if (stage < shieldOfArravQuest.startedValue) {
            return buildNotStartedJournal(shieldOfArravQuest, "I can start this quest by talking to Reldo in Varrock Palace library.");
        }
        if (stage >= shieldOfArravQuest.completionValue) {
            return buildCompleteJournal([
                "Reldo told me about the stolen Shield of Arrav.",
                "I infiltrated a gang, recovered the shield, and returned it to Varrock.",
            ]);
        }
        const joined = getQuestStringFlag(player, shieldOfArravQuest.key, "joined_gang") ?? "none";
        return [
            "The Shield of Arrav was stolen by thieves. Reldo thinks it was split between two gangs.",
            "",
            strikeIf(getQuestFlag(player, shieldOfArravQuest.key, "read_book"), "I should speak with Reldo in Varrock Palace library."),
            strikeIf(getQuestFlag(player, shieldOfArravQuest.key, "has_shield_half"), `I need to join a gang and recover half of the shield. (Joined: ${joined})`),
            strikeIf(getQuestFlag(player, shieldOfArravQuest.key, "has_certificate") || hasItem(player, services, 769), "I need a certificate proving ownership of the shield."),
            "I should bring the certificate to King Roald.",
        ];
    },
    register(registry, _services): void {
        registerQuestNpcTalk(registry, 6203, (event) => {
            const { player, services } = event;
            const ctx: DialogueContext = { player, services, npcId: 6203, npcName: "Reldo" };
            const stage = getQuestStage(player, shieldOfArravQuest);
            if (stage >= shieldOfArravQuest.completionValue) {
                startConversation(ctx, [
                    { npc: ["The Shield of Arrav is back where it belongs."] },
                    { player: ["Glad I could help."] },
                ]);
                return;
            }
            if (stage >= shieldOfArravQuest.startedValue) {
                if (!getQuestFlag(player, shieldOfArravQuest.key, "read_book")) {
                    startConversation(ctx, [
                        { exec: (dctx) => setQuestFlag(dctx.player, shieldOfArravQuest.key, "read_book", true) },
                        { npc: ["The Shield of Arrav was stolen! I believe the Phoenix and Black Arm gangs each hold half."] },
                        { player: ["Which gang should I join?"] },
                        { npc: ["Speak with Straven for the Phoenix Gang, or Katrine for the Black Arm Gang."] },
                    ]);
                    return;
                }
                if (getQuestFlag(player, shieldOfArravQuest.key, "has_shield_half") && !getQuestFlag(player, shieldOfArravQuest.key, "has_certificate")) {
                    startConversation(ctx, [
                        { npc: ["Take your shield half to the Curator at the museum for a certificate."] },
                        { player: ["I'll go see him."] },
                    ]);
                    return;
                }
                startConversation(ctx, [{ npc: ["Keep searching for the shield halves."] }]);
                return;
            }
            startConversation(ctx, [
                { npc: ["Ah, a quest seeker! I know of a famous stolen relic..."] },
                {
                    options: [
                        {
                            text: "Tell me about it.",
                            next: [
                                { player: ["Tell me about it."] },
                                { exec: (dctx) => setQuestFlag(dctx.player, shieldOfArravQuest.key, "read_book", true) },
                                { npc: ["The Shield of Arrav! Stolen by two rival gangs in Varrock."] },
                                { npc: ["Join the Phoenix Gang or Black Arm Gang to find a shield half."] },
                                { exec: (dctx) => setQuestStage(dctx.player, shieldOfArravQuest, dctx.services, shieldOfArravQuest.startedValue) },
                            ],
                        },
                        { text: "Not now.", next: [{ player: ["Not now."] }] },
                    ],
                },
            ]);
        });

        registerQuestNpcTalk(registry, 5212, (event) => {
            const { player, services } = event;
            const ctx: DialogueContext = { player, services, npcId: 5212, npcName: "Straven" };
            if (getQuestStage(player, shieldOfArravQuest) < shieldOfArravQuest.startedValue) {
                startConversation(ctx, [{ npc: ["Get lost."] }]);
                return;
            }
            const gang = getQuestStringFlag(player, shieldOfArravQuest.key, "joined_gang") ?? "none";
            if (gang === "black_arm") {
                startConversation(ctx, [{ npc: ["You're with the Black Arm Gang!"] }]);
                return;
            }
            if (getQuestFlag(player, shieldOfArravQuest.key, "has_shield_half")) {
                startConversation(ctx, [{ npc: ["You've got our half. Get the certificate from the Curator."] }]);
                return;
            }
            startConversation(ctx, [
                { exec: (dctx) => setQuestStringFlag(dctx.player, shieldOfArravQuest.key, "joined_gang", "phoenix") },
                { npc: ["Welcome to the Phoenix Gang. Our weaponsmaster guards the shield half upstairs."] },
                { player: ["I'll get it."] },
            ]);
        });

        registerQuestNpcTalk(registry, 5210, (event) => {
            const { player, services } = event;
            const ctx: DialogueContext = { player, services, npcId: 5210, npcName: "Katrine" };
            if (getQuestStage(player, shieldOfArravQuest) < shieldOfArravQuest.startedValue) {
                startConversation(ctx, [{ npc: ["Beat it."] }]);
                return;
            }
            const gang = getQuestStringFlag(player, shieldOfArravQuest.key, "joined_gang") ?? "none";
            if (gang === "phoenix") {
                startConversation(ctx, [{ npc: ["You're with the Phoenix Gang!"] }]);
                return;
            }
            if (getQuestFlag(player, shieldOfArravQuest.key, "has_shield_half")) {
                startConversation(ctx, [{ npc: ["Good work. Take the half to the Curator for a certificate."] }]);
                return;
            }
            startConversation(ctx, [
                {
                    exec: (dctx) => {
                        setQuestStringFlag(dctx.player, shieldOfArravQuest.key, "joined_gang", "black_arm");
                        addItemIfMissing(dctx.player, dctx.services, 765, 1);
                        setQuestFlag(dctx.player, shieldOfArravQuest.key, "has_shield_half", true);
                    },
                },
                { npc: ["Welcome to the Black Arm Gang. Here's our half of the shield."] },
                { player: ["I'll take it to the Curator."] },
            ]);
        });

        registerQuestNpcTalk(registry, 5211, (event) => {
            const { player, services } = event;
            const ctx: DialogueContext = { player, services, npcId: 5211, npcName: "Weaponsmaster" };
            if (getQuestStage(player, shieldOfArravQuest) < shieldOfArravQuest.startedValue) {
                startConversation(ctx, [{ npc: ["You're not one of us!"] }]);
                return;
            }
            const gang = getQuestStringFlag(player, shieldOfArravQuest.key, "joined_gang") ?? "none";
            if (gang !== "phoenix") {
                startConversation(ctx, [{ npc: ["You're not one of us!"] }]);
                return;
            }
            if (getQuestFlag(player, shieldOfArravQuest.key, "has_shield_half")) {
                startConversation(ctx, [{ npc: ["You already took the shield half!"] }]);
                return;
            }
            startConversation(ctx, [
                {
                    exec: (dctx) => {
                        addItemIfMissing(dctx.player, dctx.services, 763, 1);
                        setQuestFlag(dctx.player, shieldOfArravQuest.key, "has_shield_half", true);
                    },
                },
                { npc: ["Hey! That shield half is ours!"] },
                { player: ["Too late - I'm taking it to the Curator."] },
            ]);
        });

        registerQuestNpcTalk(registry, 5213, (event) => {
            const { player, services } = event;
            startConversation(
                { player, services, npcId: 5213, npcName: "Jonny the beard" },
                getQuestStage(player, shieldOfArravQuest) < shieldOfArravQuest.startedValue
                    ? [{ npc: ["Hello."] }]
                    : [
                          { npc: ["Looking for the Phoenix Gang? Talk to Straven in the alley."] },
                          { player: ["Thanks."] },
                      ],
            );
        });

        registerQuestNpcTalk(registry, 5214, (event) => {
            const { player, services } = event;
            const ctx: DialogueContext = { player, services, npcId: 5214, npcName: "Curator Haig Halen" };
            if (getQuestStage(player, shieldOfArravQuest) < shieldOfArravQuest.startedValue) {
                startConversation(ctx, [{ npc: ["Welcome to the Varrock Museum."] }]);
                return;
            }
            if (getQuestFlag(player, shieldOfArravQuest.key, "has_certificate")) {
                startConversation(ctx, [{ npc: ["Take the certificate to King Roald."] }]);
                return;
            }
            const hasHalf = hasItem(player, services, 763) || hasItem(player, services, 765);
            if (!hasHalf) {
                startConversation(ctx, [
                    { npc: ["Do you have something for the museum?"] },
                    { player: ["Not yet."] },
                ]);
                return;
            }
            startConversation(ctx, [
                {
                    exec: (dctx) => {
                        if (hasItem(dctx.player, dctx.services, 763)) {
                            takeQuestItems(dctx.player, dctx.services, [{ itemId: 763, quantity: 1, journalLabel: "" }]);
                        }
                        if (hasItem(dctx.player, dctx.services, 765)) {
                            takeQuestItems(dctx.player, dctx.services, [{ itemId: 765, quantity: 1, journalLabel: "" }]);
                        }
                        addItemIfMissing(dctx.player, dctx.services, 769, 1);
                        setQuestFlag(dctx.player, shieldOfArravQuest.key, "has_certificate", true);
                    },
                },
                { npc: ["Marvellous! This certificate proves the shield belongs to Varrock."] },
                { player: ["I'll take it to King Roald."] },
            ]);
        });

        registerQuestNpcTalk(registry, 5215, (event) => {
            const { player, services } = event;
            const ctx: DialogueContext = { player, services, npcId: 5215, npcName: "King Roald" };
            const stage = getQuestStage(player, shieldOfArravQuest);
            if (stage < shieldOfArravQuest.startedValue) {
                return;
            }
            if (stage >= shieldOfArravQuest.completionValue) {
                return;
            }
            if (stage >= shieldOfArravQuest.startedValue && getQuestFlag(player, shieldOfArravQuest.key, "has_certificate")) {
                if (!hasItem(player, services, 769)) {
                    startConversation(ctx, [{ npc: ["Where is the certificate?"] }]);
                    return;
                }
                startConversation(ctx, [
                    { exec: (dctx) => takeQuestItems(dctx.player, dctx.services, [{ itemId: 769, quantity: 1, journalLabel: "" }]) },
                    { player: ["I have recovered the Shield of Arrav!"] },
                    { npc: ["Splendid! Varrock rewards its heroes generously."] },
                    { exec: (dctx) => completeQuest(dctx.player, dctx.services, shieldOfArravQuest) },
                ]);
                return;
            }
            startConversation(ctx, [{ npc: ["Have you found the Shield of Arrav yet?"] }]);
        });
    },
};

// -----------------------------------------------------------------------------
// 12) Prince Ali Rescue
// -----------------------------------------------------------------------------
const princeAliRescueQuest: QuestDefinition = {
    key: "prince_ali_rescue",
    name: "Prince Ali Rescue",
    varpId: 273,
    startedValue: 1,
    completionValue: 110,
    rewards: {
        questPoints: 1,
        xp: [{ skillId: SkillId.Agility, amount: 700, label: "Agility" }],
    },
    rewardItemId: 2418,
    overviewStartText:
        "rescuing <col=800000>Prince Ali</col> from Lady Keli's cells.",
    buildJournal(player, services): string[] {
        const stage = getQuestStage(player, princeAliRescueQuest);
        if (stage < princeAliRescueQuest.startedValue) {
            return buildNotStartedJournal(princeAliRescueQuest, "I can start this quest by talking to Hassan in Al Kharid palace.");
        }
        if (stage >= princeAliRescueQuest.completionValue) {
            return buildCompleteJournal([
                "Hassan asked me to rescue Prince Ali.",
                "I disguised myself, stole the key, dealt with Joe, and freed the Prince.",
            ]);
        }
        return [
            "Prince Ali has been kidnapped. Hassan needs my help to free him.",
            "",
            strikeIf(getQuestFlag(player, princeAliRescueQuest.key, "spoke_osman"), "I should speak with Osman, the palace spymaster."),
            strikeIf(
                hasItem(player, services, 2419) && hasItem(player, services, 2424),
                "I need the disguise items and a plan to reach the cells.",
            ),
            strikeIf(getQuestFlag(player, princeAliRescueQuest.key, "has_key") || hasItem(player, services, 2418), "I must get the cell key from Lady Keli."),
            strikeIf(getQuestFlag(player, princeAliRescueQuest.key, "joe_drunk"), "I need to get past Joe, Keli's head guard."),
            strikeIf(getQuestFlag(player, princeAliRescueQuest.key, "rescued_ali"), "I must free Prince Ali from his cell."),
        ];
    },
    register(registry, _services): void {
        registerQuestNpcTalk(registry, 4285, (event) => {
            const { player, services } = event;
            const ctx: DialogueContext = { player, services, npcId: 4285, npcName: "Hassan" };
            const stage = getQuestStage(player, princeAliRescueQuest);
            if (stage >= princeAliRescueQuest.completionValue) {
                startConversation(ctx, [
                    { npc: ["Prince Ali is safe thanks to you."] },
                    { player: ["Glad I could help."] },
                ]);
                return;
            }
            if (getQuestFlag(player, princeAliRescueQuest.key, "rescued_ali")) {
                startConversation(ctx, [
                    { player: ["I've freed Prince Ali!"] },
                    { npc: ["Wonderful! Al Kharid owes you a great debt."] },
                    { exec: (dctx) => completeQuest(dctx.player, dctx.services, princeAliRescueQuest) },
                ]);
                return;
            }
            if (stage >= princeAliRescueQuest.startedValue) {
                startConversation(ctx, [
                    { npc: ["Have you freed the Prince yet?"] },
                    { player: ["I'm still working on it."] },
                ]);
                return;
            }
            startConversation(ctx, [
                { npc: ["Our Prince Ali has been kidnapped by Lady Keli!"] },
                {
                    options: [
                        {
                            text: "I'll rescue him.",
                            next: [
                                { player: ["I'll rescue him."] },
                                { npc: ["Speak with Osman in the palace. He will know what to do."] },
                                { exec: (dctx) => setQuestStage(dctx.player, princeAliRescueQuest, dctx.services, princeAliRescueQuest.startedValue) },
                            ],
                        },
                        { text: "That sounds difficult.", next: [{ player: ["That sounds difficult."] }] },
                    ],
                },
            ]);
        });

        registerQuestNpcTalk(registry, 6165, (event) => {
            const { player, services } = event;
            const ctx: DialogueContext = { player, services, npcId: 6165, npcName: "Osman" };
            if (getQuestStage(player, princeAliRescueQuest) < princeAliRescueQuest.startedValue) {
                startConversation(ctx, [{ npc: ["I have nothing to discuss with you."] }]);
                return;
            }
            if (!getQuestFlag(player, princeAliRescueQuest.key, "spoke_osman")) {
                startConversation(ctx, [
                    { exec: (dctx) => setQuestFlag(dctx.player, princeAliRescueQuest.key, "spoke_osman", true) },
                    { npc: ["Good, Hassan sent you. We need a disguise to infiltrate Keli's cells."] },
                    {
                        exec: (dctx) => {
                            addItemIfMissing(dctx.player, dctx.services, 2419, 1);
                            addItemIfMissing(dctx.player, dctx.services, 2424, 1);
                        },
                    },
                    { npc: ["Get the cell key from Lady Keli, then deal with her guard Joe."] },
                    { player: ["Understood."] },
                ]);
                return;
            }
            startConversation(ctx, [
                { npc: ["Lady Keli holds the key. Joe guards the cell door - a beer should keep him busy."] },
                { player: ["I'll handle it."] },
            ]);
        });

        registerQuestNpcTalk(registry, 4274, (event) => {
            const { player, services } = event;
            const ctx: DialogueContext = { player, services, npcId: 4274, npcName: "Leela" };
            if (getQuestStage(player, princeAliRescueQuest) < princeAliRescueQuest.startedValue) {
                startConversation(ctx, [{ npc: ["Hello."] }]);
                return;
            }
            startConversation(ctx, [
                { npc: ["My father sent you? Lady Keli is holding Prince Ali north of here."] },
                { player: ["I'm on my way."] },
            ]);
        });

        registerQuestNpcTalk(registry, 918, (event) => {
            const { player, services } = event;
            const ctx: DialogueContext = { player, services, npcId: 918, npcName: "Lady Keli" };
            if (getQuestStage(player, princeAliRescueQuest) < princeAliRescueQuest.startedValue) {
                startConversation(ctx, [{ npc: ["Don't bother me."] }]);
                return;
            }
            if (!hasItem(player, services, 2419) || !hasItem(player, services, 2424)) {
                startConversation(ctx, [{ npc: ["Who are you? Be off with you!"] }]);
                return;
            }
            if (getQuestFlag(player, princeAliRescueQuest.key, "has_key")) {
                startConversation(ctx, [{ npc: ["You again? Guards!"] }]);
                return;
            }
            startConversation(ctx, [
                {
                    exec: (dctx) => {
                        setQuestFlag(dctx.player, princeAliRescueQuest.key, "has_key", true);
                        addItemIfMissing(dctx.player, dctx.services, 2418, 1);
                    },
                },
                { npc: ["Hmm, you look trustworthy enough. Don't cause trouble."] },
                { player: ["Of course not."] },
            ]);
        });

        registerQuestNpcTalk(registry, 4275, (event) => {
            const { player, services } = event;
            const ctx: DialogueContext = { player, services, npcId: 4275, npcName: "Joe" };
            if (getQuestStage(player, princeAliRescueQuest) < princeAliRescueQuest.startedValue || !getQuestFlag(player, princeAliRescueQuest.key, "has_key")) {
                startConversation(ctx, [{ npc: ["No entry!"] }]);
                return;
            }
            if (getQuestFlag(player, princeAliRescueQuest.key, "joe_drunk")) {
                startConversation(ctx, [{ npc: ["Zzz... leave me alone..."] }]);
                return;
            }
            if (!hasItem(player, services, 1917)) {
                startConversation(ctx, [
                    { npc: ["I'm thirsty. Got any beer?"] },
                    { player: ["Not right now."] },
                ]);
                return;
            }
            startConversation(ctx, [
                { exec: (dctx) => takeQuestItems(dctx.player, dctx.services, [{ itemId: 1917, quantity: 1, journalLabel: "" }]) },
                { exec: (dctx) => setQuestFlag(dctx.player, princeAliRescueQuest.key, "joe_drunk", true) },
                { player: ["Here, have a beer."] },
                { npc: ["Cheers mate! *hic*"] },
            ]);
        });

        registerQuestNpcTalk(registry, 922, (event) => {
            const { player, services } = event;
            const ctx: DialogueContext = { player, services, npcId: 922, npcName: "Prince Ali" };
            if (getQuestStage(player, princeAliRescueQuest) < princeAliRescueQuest.startedValue) {
                startConversation(ctx, [{ npc: ["Please help me..."] }]);
                return;
            }
            if (!getQuestFlag(player, princeAliRescueQuest.key, "has_key") || !getQuestFlag(player, princeAliRescueQuest.key, "joe_drunk")) {
                startConversation(ctx, [{ npc: ["The guard won't let anyone in!"] }]);
                return;
            }
            if (getQuestFlag(player, princeAliRescueQuest.key, "rescued_ali")) {
                startConversation(ctx, [{ npc: ["Thank you! Return to Hassan in the palace."] }]);
                return;
            }
            startConversation(ctx, [
                {
                    exec: (dctx) => {
                        if (hasItem(dctx.player, dctx.services, 2418)) {
                            takeQuestItems(dctx.player, dctx.services, [{ itemId: 2418, quantity: 1, journalLabel: "" }]);
                        }
                        setQuestFlag(dctx.player, princeAliRescueQuest.key, "rescued_ali", true);
                    },
                },
                { player: ["You're free, Prince Ali!"] },
                { npc: ["At last! Please tell Hassan I'm safe."] },
            ]);
        });
    },
};

// -----------------------------------------------------------------------------
// 13) Black Knights' Fortress
// -----------------------------------------------------------------------------
const blackKnightsFortressQuest: QuestDefinition = {
    key: "black_knights_fortress",
    name: "Black Knights' Fortress",
    varpId: 130,
    startedValue: 1,
    completionValue: 4,
    rewards: {
        questPoints: 1,
        items: [{ itemId: COINS_ITEM_ID, quantity: 2500, label: "2,500 Coins" }],
    },
    rewardItemId: 1965,
    overviewStartText:
        "spying on the <col=800000>Black Knights' Fortress</col> for Sir Amik Varze.",
    buildJournal(player, services): string[] {
        const stage = getQuestStage(player, blackKnightsFortressQuest);
        if (stage < blackKnightsFortressQuest.startedValue) {
            return buildNotStartedJournal(blackKnightsFortressQuest, "I can start this quest by talking to Sir Amik Varze in Falador.");
        }
        if (stage >= blackKnightsFortressQuest.completionValue) {
            return buildCompleteJournal([
                "Sir Amik Varze sent me to spy on the Black Knights.",
                "I overheard their plan and destroyed their weapon with a cabbage.",
            ]);
        }
        return [
            "Sir Amik Varze suspects the Black Knights are building a secret weapon.",
            "",
            strikeIf(
                hasItem(player, services, 1101) && hasItem(player, services, 1139),
                "I need iron chainbody and a bronze med helm to infiltrate the fortress.",
            ),
            strikeIf(getQuestFlag(player, blackKnightsFortressQuest.key, "infiltrated"), "I have infiltrated the fortress."),
            strikeIf(getQuestFlag(player, blackKnightsFortressQuest.key, "listened"), "I should listen to the witch's plan."),
            strikeIf(getQuestFlag(player, blackKnightsFortressQuest.key, "sabotaged"), "I must sabotage the witch's cauldron with a cabbage."),
        ];
    },
    register(registry, _services): void {
        registerQuestNpcTalk(registry, 3395, (event) => {
            const { player, services } = event;
            const ctx: DialogueContext = { player, services, npcId: 3395, npcName: "Sir Amik Varze" };
            const stage = getQuestStage(player, blackKnightsFortressQuest);
            if (stage >= blackKnightsFortressQuest.completionValue) {
                startConversation(ctx, [
                    { npc: ["The Black Knights' plot has been foiled. Well done."] },
                    { player: ["Glad I could help."] },
                ]);
                return;
            }
            if (getQuestFlag(player, blackKnightsFortressQuest.key, "sabotaged")) {
                startConversation(ctx, [
                    { player: ["I stopped the Black Knights' weapon!"] },
                    { npc: ["Excellent work! The White Knights owe you a great debt."] },
                    { exec: (dctx) => completeQuest(dctx.player, dctx.services, blackKnightsFortressQuest) },
                ]);
                return;
            }
            if (stage >= blackKnightsFortressQuest.startedValue) {
                startConversation(ctx, [
                    { npc: ["Have you stopped the Black Knights yet?"] },
                    { player: ["Not yet."] },
                ]);
                return;
            }
            startConversation(ctx, [
                { npc: ["The Black Knights are plotting against us! I need a spy."] },
                {
                    options: [
                        {
                            text: "I'll investigate.",
                            next: [
                                { player: ["I'll investigate."] },
                                {
                                    npc: [
                                        "Wear an iron chainbody and bronze med helm to enter their fortress.",
                                        "Listen to the witch's plans, then sabotage their cauldron with a cabbage!",
                                    ],
                                },
                                {
                                    exec: (dctx) =>
                                        setQuestStage(
                                            dctx.player,
                                            blackKnightsFortressQuest,
                                            dctx.services,
                                            blackKnightsFortressQuest.startedValue,
                                        ),
                                },
                            ],
                        },
                        { text: "That sounds dangerous.", next: [{ player: ["That sounds dangerous."] }] },
                    ],
                },
            ]);
        });

        registerQuestNpcTalk(registry, 8010, (event) => {
            const { player, services } = event;
            const ctx: DialogueContext = { player, services, npcId: 8010, npcName: "Witch" };
            if (getQuestStage(player, blackKnightsFortressQuest) < blackKnightsFortressQuest.startedValue) return;

            if (!getQuestFlag(player, blackKnightsFortressQuest.key, "infiltrated")) {
                if (!hasItem(player, services, 1101) || !hasItem(player, services, 1139)) {
                    startConversation(ctx, [{ npc: ["Who are you? Guards!"] }]);
                    return;
                }
                startConversation(ctx, [
                    { exec: (dctx) => setQuestFlag(dctx.player, blackKnightsFortressQuest.key, "infiltrated", true) },
                    { npc: ["The witch is brewing a powerful weapon in her cauldron..."] },
                    { player: ["I need a cabbage to ruin her potion."] },
                    { npc: ["There's a hole above the cauldron. Drop a cabbage through it!"] },
                    { exec: (dctx) => setQuestFlag(dctx.player, blackKnightsFortressQuest.key, "listened", true) },
                ]);
                return;
            }

            if (!getQuestFlag(player, blackKnightsFortressQuest.key, "listened")) {
                startConversation(ctx, [
                    { npc: ["Keep quiet and don't get caught."] },
                    { exec: (dctx) => setQuestFlag(dctx.player, blackKnightsFortressQuest.key, "listened", true) },
                ]);
                return;
            }

            if (getQuestFlag(player, blackKnightsFortressQuest.key, "sabotaged")) {
                startConversation(ctx, [{ npc: ["My potion! Ruined!"] }]);
                return;
            }

            if (!hasItem(player, services, 1965)) {
                startConversation(ctx, [{ player: ["I need a cabbage for the hole above this cauldron."] }]);
                return;
            }

            startConversation(ctx, [
                { exec: (dctx) => takeQuestItems(dctx.player, dctx.services, [{ itemId: 1965, quantity: 1, journalLabel: "" }]) },
                { exec: (dctx) => setQuestFlag(dctx.player, blackKnightsFortressQuest.key, "sabotaged", true) },
                { player: ["Take that, witch!"] },
                { npc: ["No! My secret weapon!"] },
                { player: ["I should tell Sir Amik Varze."] },
            ]);
        });
    },
};

export const f2pRemainingQuests: QuestDefinition[] = [
    restlessGhostQuest,
    impCatcherQuest,
    runeMysteriesQuest,
    ernestTheChickenQuest,
    vampyreSlayerQuest,
    piratesTreasureQuest,
    goblinDiplomacyQuest,
    witchsPotionQuest,
    romeoAndJulietQuest,
    demonSlayerQuest,
    shieldOfArravQuest,
    princeAliRescueQuest,
    blackKnightsFortressQuest,
];
