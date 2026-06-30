import { SkillId } from "../../../../../src/rs/skill/skills";
import type { IScriptRegistry, NpcInteractionEvent, ScriptServices } from "../../../../../src/game/scripts/types";
import { getQuestFlag, setQuestFlag } from "../QuestFlags";
import {
    completeQuest,
    countCarriedItem,
    getQuestStage,
    setQuestStage,
    takeQuestItems,
} from "../QuestService";
import { type DialogueContext, startConversation } from "../dialogue";
import {
    buildCompleteJournal,
    buildItemProgressJournal,
    buildNotStartedJournal,
    registerQuestNpcTalk,
    strikeIf,
} from "../helpers";
import { openSkillMasterDialogForPlayer, skillMasterQuestOptions } from "../../skillCapes/skillMasters";
import { isQuestInProgress } from "../questSharedNpcYield";
import type { QuestDefinition, QuestItemRequirement } from "../types";

function hasItem(
    player: Parameters<typeof countCarriedItem>[0],
    services: ScriptServices,
    itemId: number,
    quantity = 1,
): boolean {
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
// Gertrude's Cat
// -----------------------------------------------------------------------------
const gertrudesCatQuest: QuestDefinition = {
    key: "gertrudes_cat",
    name: "Gertrude's Cat",
    varpId: 180,
    startedValue: 1,
    completionValue: 6,
    rewards: {
        questPoints: 1,
        xp: [{ skillId: SkillId.Cooking, amount: 1525, label: "Cooking" }],
        items: [{ itemId: 1555, quantity: 1, label: "Pet kitten" }],
    },
    rewardItemId: 1555,
    overviewStartText: "helping <col=800000>Gertrude</col> find her lost cat in Varrock.",
    buildJournal(player, services): string[] {
        const stage = getQuestStage(player, gertrudesCatQuest);
        if (stage < gertrudesCatQuest.startedValue) {
            return buildNotStartedJournal(
                gertrudesCatQuest,
                "I can start this quest by talking to Gertrude in Varrock.",
            );
        }
        if (stage >= gertrudesCatQuest.completionValue) {
            return buildCompleteJournal([
                "Gertrude's cat Fluffs had run away.",
                "I found her kitten and reunited the family.",
            ]);
        }
        if (getQuestFlag(player, gertrudesCatQuest.key, "has_kitten") || hasItem(player, services, 1555)) {
            return ["I found Fluffs' kitten.", "", "I should return to Gertrude."];
        }
        return [
            "Gertrude's cat is missing.",
            "",
            strikeIf(getQuestFlag(player, gertrudesCatQuest.key, "spoke_shilop"), "I should speak with her sons in Varrock."),
            strikeIf(
                getQuestFlag(player, gertrudesCatQuest.key, "has_kitten"),
                "Shilop wants a bucket of milk and a raw sardine for the kitten.",
            ),
        ];
    },
    register(registry): void {
        registerQuestNpcTalk(registry, 3500, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 3500, npcName: "Gertrude" };
            const stage = getQuestStage(player, gertrudesCatQuest);
            if (stage >= gertrudesCatQuest.completionValue) {
                startConversation(ctx, [{ npc: ["Fluffs and her kitten are safe thanks to you."] }]);
                return;
            }
            if (hasItem(player, services, 1555)) {
                startConversation(ctx, [
                    { player: ["I found your cat's kitten!"] },
                    { npc: ["Oh thank you! You're wonderful."] },
                    {
                        exec: (d) => {
                            takeQuestItems(d.player, d.services, [
                                { itemId: 1555, quantity: 1, journalLabel: "" },
                            ]);
                            completeQuest(d.player, d.services, gertrudesCatQuest);
                            addItemIfMissing(d.player, d.services, 1555, 1);
                        },
                    },
                ]);
                return;
            }
            if (stage >= gertrudesCatQuest.startedValue) {
                startConversation(ctx, [
                    { npc: ["Please find Fluffs. Her sons may know where she went."] },
                ]);
                return;
            }
            if (isQuestInProgress(player, "ratcatchers")) {
                return;
            }
            startConversation(ctx, [
                { npc: ["My cat Fluffs is missing! Could you help find her?"] },
                {
                    options: [
                        {
                            text: "Yes, I'll help.",
                            next: [
                                { player: ["Yes, I'll help."] },
                                { npc: ["Speak with my sons Shilop and Wilough in Varrock."] },
                                {
                                    exec: (d) =>
                                        setQuestStage(
                                            d.player,
                                            gertrudesCatQuest,
                                            d.services,
                                            gertrudesCatQuest.startedValue,
                                        ),
                                },
                            ],
                        },
                        { text: "Not now.", next: [{ player: ["Not now."] }] },
                    ],
                },
            ]);
        });

        registerQuestNpcTalk(registry, 3501, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 3501, npcName: "Shilop" };
            if (getQuestStage(player, gertrudesCatQuest) < gertrudesCatQuest.startedValue) return;
            if (getQuestFlag(player, gertrudesCatQuest.key, "has_kitten")) {
                startConversation(ctx, [{ npc: ["Take the kitten back to Gertrude!"] }]);
                return;
            }
            if (hasItem(player, services, 1927) && hasItem(player, services, 327)) {
                startConversation(ctx, [
                    { npc: ["Milk and sardine! Here's Fluffs' kitten."] },
                    {
                        exec: (d) => {
                            takeQuestItems(d.player, d.services, [
                                { itemId: 1927, quantity: 1, journalLabel: "" },
                                { itemId: 327, quantity: 1, journalLabel: "" },
                            ]);
                            addItemIfMissing(d.player, d.services, 1555, 1);
                            setQuestFlag(d.player, gertrudesCatQuest.key, "has_kitten", true);
                        },
                    },
                ]);
                return;
            }
            startConversation(ctx, [
                { exec: (d) => setQuestFlag(d.player, gertrudesCatQuest.key, "spoke_shilop", true) },
                { npc: ["Fluffs is in the lumber yard. Bring milk and a raw sardine for her kitten."] },
            ]);
        });
    },
};

// -----------------------------------------------------------------------------
// Druidic Ritual
// -----------------------------------------------------------------------------
const DRUID_MEATS: QuestItemRequirement[] = [
    { itemId: 2134, quantity: 1, journalLabel: "Raw rat meat" },
    { itemId: 2136, quantity: 1, journalLabel: "Raw bear meat" },
    { itemId: 2132, quantity: 1, journalLabel: "Raw beef" },
    { itemId: 2138, quantity: 1, journalLabel: "Raw chicken" },
];

const druidicRitualQuest: QuestDefinition = {
    key: "druidic_ritual",
    name: "Druidic Ritual",
    varpId: 80,
    startedValue: 1,
    completionValue: 4,
    rewards: {
        questPoints: 1,
        xp: [{ skillId: SkillId.Herblore, amount: 250, label: "Herblore" }],
        other: ["Ability to train Herblore"],
    },
    rewardItemId: 249,
    overviewStartText: "helping the druids of <col=800000>Taverley</col> perform a ritual.",
    buildJournal(player, services): string[] {
        const stage = getQuestStage(player, druidicRitualQuest);
        if (stage < druidicRitualQuest.startedValue) {
            return buildNotStartedJournal(
                druidicRitualQuest,
                "I can start this quest by talking to Kaqemeex in Taverley.",
            );
        }
        if (stage >= druidicRitualQuest.completionValue) {
            return buildCompleteJournal([
                "Kaqemeex sent me to collect meats for a ritual.",
                "Sanfew accepted the offering and I learned the ways of Herblore.",
            ]);
        }
        if (getQuestFlag(player, druidicRitualQuest.key, "sanfew_done")) {
            return ["Sanfew has the meats.", "", "I should return to Kaqemeex."];
        }
        return buildItemProgressJournal(
            player,
            services,
            ["I must bring four types of raw meat to Sanfew in Taverley."],
            DRUID_MEATS,
        );
    },
    register(registry): void {
        registerQuestNpcTalk(registry, 5045, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 5045, npcName: "Kaqemeex" };
            const stage = getQuestStage(player, druidicRitualQuest);
            if (stage >= druidicRitualQuest.completionValue) {
                openSkillMasterDialogForPlayer(player, services, {
                    npcId: 5045,
                    name: "Kaqemeex",
                    skillId: SkillId.Herblore,
                });
                return;
            }
            if (getQuestFlag(player, druidicRitualQuest.key, "sanfew_done")) {
                startConversation(ctx, [
                    { npc: ["Well done! You may now train Herblore."] },
                    { exec: (d) => completeQuest(d.player, d.services, druidicRitualQuest) },
                ]);
                return;
            }
            if (stage >= druidicRitualQuest.startedValue) {
                startConversation(ctx, [
                    { npc: ["Take the meats to Sanfew in the Taverley dungeon."] },
                ]);
                return;
            }
            startConversation(ctx, [
                { npc: ["We need raw meats for a ritual. Will you help?"] },
                {
                    options: [
                        {
                            text: "Yes.",
                            next: [
                                { player: ["Yes."] },
                                { npc: ["Bring rat, bear, beef and chicken meat to Sanfew underground."] },
                                {
                                    exec: (d) =>
                                        setQuestStage(
                                            d.player,
                                            druidicRitualQuest,
                                            d.services,
                                            druidicRitualQuest.startedValue,
                                        ),
                                },
                            ],
                        },
                        { text: "No.", next: [{ player: ["No."] }] },
                        ...skillMasterQuestOptions({
                            npcId: 5045,
                            name: "Kaqemeex",
                            skillId: SkillId.Herblore,
                        }),
                    ],
                },
            ]);
        });

        registerQuestNpcTalk(registry, 5044, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 5044, npcName: "Sanfew" };
            if (getQuestStage(player, druidicRitualQuest) < druidicRitualQuest.startedValue) return;
            if (getQuestFlag(player, druidicRitualQuest.key, "sanfew_done")) {
                startConversation(ctx, [{ npc: ["Speak with Kaqemeex above."] }]);
                return;
            }
            if (DRUID_MEATS.every((req) => hasItem(player, services, req.itemId, req.quantity))) {
                startConversation(ctx, [
                    { npc: ["Perfect! These meats will do nicely."] },
                    {
                        exec: (d) => {
                            takeQuestItems(d.player, d.services, DRUID_MEATS);
                            setQuestFlag(d.player, druidicRitualQuest.key, "sanfew_done", true);
                        },
                    },
                ]);
                return;
            }
            startConversation(ctx, [{ npc: ["I need raw rat, bear, beef and chicken meat."] }]);
        });
    },
};

// -----------------------------------------------------------------------------
// Priest in Peril
// -----------------------------------------------------------------------------
const priestInPerilQuest: QuestDefinition = {
    key: "priest_in_peril",
    name: "Priest in Peril",
    varpId: 302,
    startedValue: 1,
    completionValue: 60,
    rewards: {
        questPoints: 1,
        xp: [{ skillId: SkillId.Prayer, amount: 1406, label: "Prayer" }],
        other: ["Access to Morytania"],
    },
    rewardItemId: 552,
    overviewStartText: "helping <col=800000>King Roald</col> rescue Drezel near the border.",
    buildJournal(player, _services): string[] {
        const stage = getQuestStage(player, priestInPerilQuest);
        if (stage < priestInPerilQuest.startedValue) {
            return buildNotStartedJournal(
                priestInPerilQuest,
                "I can start this quest by talking to King Roald in Varrock Palace.",
            );
        }
        if (stage >= priestInPerilQuest.completionValue) {
            return buildCompleteJournal([
                "Drezel was trapped beneath the temple.",
                "I freed him and secured passage to Morytania.",
            ]);
        }
        return [
            "Drezel needs help at the temple on the Salve.",
            "",
            strikeIf(getQuestFlag(player, priestInPerilQuest.key, "spoke_drezel"), "I should speak with King Roald."),
            strikeIf(
                getQuestFlag(player, priestInPerilQuest.key, "freed_drezel"),
                "I must find Drezel at the temple and free him.",
            ),
        ];
    },
    register(registry): void {
        registerQuestNpcTalk(registry, 5215, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 5215, npcName: "King Roald" };
            const stage = getQuestStage(player, priestInPerilQuest);
            if (stage >= priestInPerilQuest.completionValue) {
                startConversation(ctx, [{ npc: ["Morytania is open thanks to you."] }]);
                return;
            }
            if (stage >= priestInPerilQuest.startedValue) {
                startConversation(ctx, [
                    { npc: ["Find Drezel at the temple on the River Salve."] },
                ]);
                return;
            }
            startConversation(ctx, [
                { npc: ["Priest Drezel has not returned from the temple. Will you investigate?"] },
                {
                    options: [
                        {
                            text: "I'll find Drezel.",
                            next: [
                                { player: ["I'll find Drezel."] },
                                {
                                    exec: (d) =>
                                        setQuestStage(
                                            d.player,
                                            priestInPerilQuest,
                                            d.services,
                                            priestInPerilQuest.startedValue,
                                        ),
                                },
                            ],
                        },
                        { text: "Not now.", next: [{ player: ["Not now."] }] },
                    ],
                },
            ]);
        });

        const drezelHandler = (event: NpcInteractionEvent, drezelName: string): void => {
            const { player, services } = event;
            const ctx: DialogueContext = { player, services, npcId: event.npc.typeId, npcName: drezelName };
            if (getQuestStage(player, priestInPerilQuest) < priestInPerilQuest.startedValue) return;
            if (getQuestStage(player, priestInPerilQuest) >= priestInPerilQuest.completionValue) {
                return;
            }
            if (!getQuestFlag(player, priestInPerilQuest.key, "freed_drezel")) {
                startConversation(ctx, [
                    { exec: (d) => setQuestFlag(d.player, priestInPerilQuest.key, "spoke_drezel", true) },
                    { npc: ["The temple guardian trapped me! Please, drive it away and bless the Salve."] },
                    { player: ["I'll deal with the guardian."] },
                    {
                        exec: (d) => setQuestFlag(d.player, priestInPerilQuest.key, "freed_drezel", true),
                    },
                    { npc: ["You have saved me! Morytania is safe to enter once more."] },
                    { exec: (d) => completeQuest(d.player, d.services, priestInPerilQuest) },
                ]);
                return;
            }
            startConversation(ctx, [{ npc: ["Speak with King Roald if you need anything."] }]);
        };

        registerQuestNpcTalk(registry, 9804, (e) => drezelHandler(e, "Drezel"));
        registerQuestNpcTalk(registry, 9805, (e) => drezelHandler(e, "Drezel"));
    },
};

// -----------------------------------------------------------------------------
// Plague City
// -----------------------------------------------------------------------------
const PLAGUE_HERBS: QuestItemRequirement[] = [
    { itemId: 249, quantity: 1, journalLabel: "Guam leaf" },
    { itemId: 251, quantity: 1, journalLabel: "Marrentill" },
    { itemId: 255, quantity: 1, journalLabel: "Harralander" },
];

const plagueCityQuest: QuestDefinition = {
    key: "plague_city",
    name: "Plague City",
    varpId: 165,
    startedValue: 1,
    completionValue: 29,
    rewards: {
        questPoints: 1,
        xp: [{ skillId: SkillId.Thieving, amount: 2425, label: "Thieving" }],
        other: ["Ability to use the Ardougne mine shortcut"],
    },
    rewardItemId: 1506,
    overviewStartText: "rescuing <col=800000>Elena</col> from the plague in West Ardougne.",
    buildJournal(player, services): string[] {
        const stage = getQuestStage(player, plagueCityQuest);
        if (stage < plagueCityQuest.startedValue) {
            return buildNotStartedJournal(
                plagueCityQuest,
                "I can start this quest by talking to Edmond in East Ardougne.",
            );
        }
        if (stage >= plagueCityQuest.completionValue) {
            return buildCompleteJournal([
                "Edmond's daughter Elena was trapped in plague-ridden West Ardougne.",
                "I smuggled in a cure and rescued her.",
            ]);
        }
        if (getQuestFlag(player, plagueCityQuest.key, "rescued_elena")) {
            return ["Elena is safe.", "", "I should tell Edmond."];
        }
        if (getQuestFlag(player, plagueCityQuest.key, "has_mask")) {
            return buildItemProgressJournal(
                player,
                services,
                ["I need herbs to cure Elena."],
                PLAGUE_HERBS,
            );
        }
        return [
            "I must reach Elena in West Ardougne.",
            "",
            strikeIf(getQuestFlag(player, plagueCityQuest.key, "has_mask"), "Edmond will help me get inside."),
            strikeIf(getQuestFlag(player, plagueCityQuest.key, "spoke_jethick"), "I should speak with Jethick in West Ardougne."),
        ];
    },
    register(registry): void {
        registerQuestNpcTalk(registry, 6204, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 6204, npcName: "Edmond" };
            const stage = getQuestStage(player, plagueCityQuest);
            if (stage >= plagueCityQuest.completionValue) {
                return;
            }
            if (stage < plagueCityQuest.startedValue) {
                return;
            }
            if (getQuestFlag(player, plagueCityQuest.key, "rescued_elena")) {
                startConversation(ctx, [
                    { npc: ["You saved my daughter!"] },
                    { exec: (d) => completeQuest(d.player, d.services, plagueCityQuest) },
                ]);
                return;
            }
            if (stage >= plagueCityQuest.startedValue) {
                if (!getQuestFlag(player, plagueCityQuest.key, "has_mask")) {
                    startConversation(ctx, [
                        { npc: ["Take this gas mask and rope. Get into West Ardougne through the sewer."] },
                        {
                            exec: (d) => {
                                addItemIfMissing(d.player, d.services, 1506, 1);
                                addItemIfMissing(d.player, d.services, 954, 1);
                                setQuestFlag(d.player, plagueCityQuest.key, "has_mask", true);
                            },
                        },
                    ]);
                    return;
                }
                startConversation(ctx, [{ npc: ["Find Elena and bring her herbs to cure the plague."] }]);
                return;
            }
            startConversation(ctx, [
                { npc: ["My daughter Elena is trapped in West Ardougne!"] },
                {
                    options: [
                        {
                            text: "I'll rescue her.",
                            next: [
                                { player: ["I'll rescue her."] },
                                {
                                    exec: (d) =>
                                        setQuestStage(
                                            d.player,
                                            plagueCityQuest,
                                            d.services,
                                            plagueCityQuest.startedValue,
                                        ),
                                },
                            ],
                        },
                        { text: "Not now.", next: [{ player: ["Not now."] }] },
                    ],
                },
            ]);
        });

        registerQuestNpcTalk(registry, 5312, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 5312, npcName: "Jethick" };
            if (getQuestStage(player, plagueCityQuest) < plagueCityQuest.startedValue) return;
            startConversation(ctx, [
                { exec: (d) => setQuestFlag(d.player, plagueCityQuest.key, "spoke_jethick", true) },
                { npc: ["Elena is in a house nearby. She needs a herbal cure."] },
            ]);
        });

        registerQuestNpcTalk(registry, 2011, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 2011, npcName: "Elena" };
            const stage = getQuestStage(player, plagueCityQuest);
            if (stage >= plagueCityQuest.completionValue) {
                return;
            }
            if (stage < plagueCityQuest.startedValue) return;
            if (getQuestFlag(player, plagueCityQuest.key, "rescued_elena")) {
                startConversation(ctx, [{ npc: ["Thank you for saving me!"] }]);
                return;
            }
            if (PLAGUE_HERBS.every((req) => hasItem(player, services, req.itemId, req.quantity))) {
                startConversation(ctx, [
                    { npc: ["The herbs work! I feel better already."] },
                    {
                        exec: (d) => {
                            takeQuestItems(d.player, d.services, PLAGUE_HERBS);
                            setQuestFlag(d.player, plagueCityQuest.key, "rescued_elena", true);
                        },
                    },
                    { player: ["Let's get you out of here."] },
                ]);
                return;
            }
            startConversation(ctx, [{ npc: ["Please... bring guam, marrentill and harralander..."] }]);
        });
    },
};

// -----------------------------------------------------------------------------
// Waterfall Quest
// -----------------------------------------------------------------------------
const waterfallQuest: QuestDefinition = {
    key: "waterfall_quest",
    name: "Waterfall Quest",
    varpId: 65,
    startedValue: 1,
    completionValue: 10,
    rewards: {
        questPoints: 1,
        xp: [
            { skillId: SkillId.Attack, amount: 13750, label: "Attack" },
            { skillId: SkillId.Strength, amount: 13750, label: "Strength" },
        ],
    },
    rewardItemId: 954,
    overviewStartText: "exploring the mysterious <col=800000>Waterfall</col> near Baxtorian Falls.",
    buildJournal(player, _services): string[] {
        const stage = getQuestStage(player, waterfallQuest);
        if (stage < waterfallQuest.startedValue) {
            return buildNotStartedJournal(
                waterfallQuest,
                "I can start this quest by talking to Almera in her house above Baxtorian Falls.",
            );
        }
        if (stage >= waterfallQuest.completionValue) {
            return buildCompleteJournal([
                "Almera's husband was lost searching Baxtorian Falls.",
                "I explored the waterfall and claimed the treasure of Baxtorian.",
            ]);
        }
        return [
            "I must explore the waterfall dungeon.",
            "",
            strikeIf(getQuestFlag(player, waterfallQuest.key, "spoke_hadley"), "I should speak with Almera."),
            strikeIf(getQuestFlag(player, waterfallQuest.key, "spoke_golrie"), "Hadley mentioned a dwarf named Golrie."),
            strikeIf(
                getQuestFlag(player, waterfallQuest.key, "found_treasure"),
                "I need a rope to explore the waterfall with Golrie.",
            ),
        ];
    },
    register(registry): void {
        registerQuestNpcTalk(registry, 4181, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 4181, npcName: "Almera" };
            const stage = getQuestStage(player, waterfallQuest);
            if (stage >= waterfallQuest.completionValue) {
                startConversation(ctx, [{ npc: ["You honoured Baxtorian's memory. Thank you."] }]);
                return;
            }
            if (stage >= waterfallQuest.startedValue) {
                startConversation(ctx, [{ npc: ["Ask Hadley on the east side of the falls for directions."] }]);
                return;
            }
            startConversation(ctx, [
                { npc: ["My husband vanished searching the waterfall. Will you investigate?"] },
                {
                    options: [
                        {
                            text: "I'll search the waterfall.",
                            next: [
                                { player: ["I'll search the waterfall."] },
                                {
                                    exec: (d) =>
                                        setQuestStage(
                                            d.player,
                                            waterfallQuest,
                                            d.services,
                                            waterfallQuest.startedValue,
                                        ),
                                },
                            ],
                        },
                        { text: "Not now.", next: [{ player: ["Not now."] }] },
                    ],
                },
            ]);
        });

        registerQuestNpcTalk(registry, 4179, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 4179, npcName: "Hadley" };
            if (getQuestStage(player, waterfallQuest) < waterfallQuest.startedValue) return;
            startConversation(ctx, [
                { exec: (d) => setQuestFlag(d.player, waterfallQuest.key, "spoke_hadley", true) },
                { npc: ["There's a dwarf named Golrie trapped in the caves. You'll need a rope."] },
            ]);
        });

        registerQuestNpcTalk(registry, 892, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 892, npcName: "Golrie" };
            if (getQuestStage(player, waterfallQuest) < waterfallQuest.startedValue) return;
            if (getQuestStage(player, waterfallQuest) >= waterfallQuest.completionValue) {
                startConversation(ctx, [{ npc: ["Baxtorian's treasure is yours."] }]);
                return;
            }
            if (hasItem(player, services, 954)) {
                startConversation(ctx, [
                    { npc: ["A rope! You can reach Baxtorian's tomb. The treasure is yours."] },
                    {
                        exec: (d) => {
                            setQuestFlag(d.player, waterfallQuest.key, "found_treasure", true);
                            completeQuest(d.player, d.services, waterfallQuest);
                        },
                    },
                ]);
                return;
            }
            startConversation(ctx, [
                { exec: (d) => setQuestFlag(d.player, waterfallQuest.key, "spoke_golrie", true) },
                { npc: ["Bring a rope if you want to reach the treasure chamber."] },
            ]);
        });
    },
};

// -----------------------------------------------------------------------------
// Jungle Potion
// -----------------------------------------------------------------------------
const JUNGLE_HERBS: QuestItemRequirement[] = [
    { itemId: 249, quantity: 1, journalLabel: "Guam leaf" },
    { itemId: 251, quantity: 1, journalLabel: "Marrentill" },
    { itemId: 253, quantity: 1, journalLabel: "Tarromin" },
    { itemId: 255, quantity: 1, journalLabel: "Harralander" },
    { itemId: 259, quantity: 1, journalLabel: "Irit leaf" },
];

const junglePotionQuest: QuestDefinition = {
    key: "jungle_potion",
    name: "Jungle Potion",
    varpId: 175,
    startedValue: 1,
    completionValue: 12,
    rewards: {
        questPoints: 1,
        xp: [{ skillId: SkillId.Herblore, amount: 775, label: "Herblore" }],
    },
    rewardItemId: 249,
    overviewStartText: "helping <col=800000>Trufitus</col> on Karamja with a sacred potion.",
    buildJournal(player, services): string[] {
        const stage = getQuestStage(player, junglePotionQuest);
        if (stage < junglePotionQuest.startedValue) {
            return buildNotStartedJournal(
                junglePotionQuest,
                "I can start this quest by talking to Trufitus in Tai Bwo Wannai.",
            );
        }
        if (stage >= junglePotionQuest.completionValue) {
            return buildCompleteJournal([
                "Trufitus needed herbs for a jungle potion.",
                "I gathered all five herbs and helped the village.",
            ]);
        }
        return buildItemProgressJournal(
            player,
            services,
            ["Trufitus needs five herbs for his potion."],
            JUNGLE_HERBS,
        );
    },
    register(registry): void {
        registerQuestNpcTalk(registry, 4625, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 4625, npcName: "Trufitus" };
            const stage = getQuestStage(player, junglePotionQuest);
            if (stage >= junglePotionQuest.completionValue) {
                return;
            }
            if (stage >= junglePotionQuest.startedValue) {
                if (JUNGLE_HERBS.every((req) => hasItem(player, services, req.itemId, req.quantity))) {
                    startConversation(ctx, [
                        { npc: ["Perfect! These herbs are exactly what I needed."] },
                        {
                            exec: (d) => {
                                takeQuestItems(d.player, d.services, JUNGLE_HERBS);
                                completeQuest(d.player, d.services, junglePotionQuest);
                            },
                        },
                    ]);
                    return;
                }
                startConversation(ctx, [{ npc: ["I still need all five herbs."] }]);
                return;
            }
            startConversation(ctx, [
                { npc: ["I need herbs for a jungle potion. Will you gather them?"] },
                {
                    options: [
                        {
                            text: "Yes.",
                            next: [
                                { player: ["Yes."] },
                                { npc: ["Bring guam, marrentill, tarromin, harralander and irit."] },
                                {
                                    exec: (d) =>
                                        setQuestStage(
                                            d.player,
                                            junglePotionQuest,
                                            d.services,
                                            junglePotionQuest.startedValue,
                                        ),
                                },
                            ],
                        },
                        { text: "No.", next: [{ player: ["No."] }] },
                    ],
                },
            ]);
        });
    },
};

// -----------------------------------------------------------------------------
// Merlin's Crystal
// -----------------------------------------------------------------------------
const merlinsCrystalQuest: QuestDefinition = {
    key: "merlins_crystal",
    name: "Merlin's Crystal",
    varpId: 14,
    startedValue: 1,
    completionValue: 7,
    rewards: {
        questPoints: 1,
        xp: [
            { skillId: SkillId.Magic, amount: 6325, label: "Magic" },
        ],
    },
    rewardItemId: 38,
    overviewStartText: "freeing <col=800000>Merlin</col> from his crystal prison in Camelot.",
    buildJournal(player, services): string[] {
        const stage = getQuestStage(player, merlinsCrystalQuest);
        if (stage < merlinsCrystalQuest.startedValue) {
            return buildNotStartedJournal(
                merlinsCrystalQuest,
                "I can start this quest by talking to King Arthur in Camelot.",
            );
        }
        if (stage >= merlinsCrystalQuest.completionValue) {
            return buildCompleteJournal([
                "Merlin was trapped in crystal by Morgan Le Faye.",
                "I exorcised the demon and freed Merlin.",
            ]);
        }
        return [
            "Merlin is trapped in crystal.",
            "",
            strikeIf(getQuestFlag(player, merlinsCrystalQuest.key, "spoke_merlin"), "I should speak with King Arthur."),
            strikeIf(
                hasItem(player, services, 530) && hasItem(player, services, 38),
                "I need bat bones and a black candle to exorcise the demon.",
            ),
        ];
    },
    register(registry): void {
        registerQuestNpcTalk(registry, 3531, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 3531, npcName: "King Arthur" };
            const stage = getQuestStage(player, merlinsCrystalQuest);
            if (stage >= merlinsCrystalQuest.completionValue) {
                return;
            }
            if (stage >= merlinsCrystalQuest.startedValue) {
                startConversation(ctx, [{ npc: ["Speak with Merlin in the tower. He knows what to do."] }]);
                return;
            }
            startConversation(ctx, [
                { npc: ["Merlin is imprisoned in crystal! Morgan Le Faye's doing. Can you help?"] },
                {
                    options: [
                        {
                            text: "I'll free Merlin.",
                            next: [
                                { player: ["I'll free Merlin."] },
                                {
                                    exec: (d) =>
                                        setQuestStage(
                                            d.player,
                                            merlinsCrystalQuest,
                                            d.services,
                                            merlinsCrystalQuest.startedValue,
                                        ),
                                },
                            ],
                        },
                        { text: "Not now.", next: [{ player: ["Not now."] }] },
                    ],
                },
            ]);
        });

        registerQuestNpcTalk(registry, 4341, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 4341, npcName: "Merlin" };
            if (getQuestStage(player, merlinsCrystalQuest) < merlinsCrystalQuest.startedValue) return;
            if (getQuestStage(player, merlinsCrystalQuest) >= merlinsCrystalQuest.completionValue) {
                startConversation(ctx, [{ npc: ["I am free at last!"] }]);
                return;
            }
            if (hasItem(player, services, 530) && hasItem(player, services, 38)) {
                startConversation(ctx, [
                    { player: ["Bat bones and a black candle — begone, demon!"] },
                    { npc: ["The crystal shatters! I am free!"] },
                    {
                        exec: (d) => {
                            takeQuestItems(d.player, d.services, [
                                { itemId: 530, quantity: 1, journalLabel: "" },
                                { itemId: 38, quantity: 1, journalLabel: "" },
                            ]);
                            completeQuest(d.player, d.services, merlinsCrystalQuest);
                        },
                    },
                ]);
                return;
            }
            startConversation(ctx, [
                { exec: (d) => setQuestFlag(d.player, merlinsCrystalQuest.key, "spoke_merlin", true) },
                { npc: ["Bring bat bones and a black candle to banish the demon holding me."] },
            ]);
        });
    },
};

// -----------------------------------------------------------------------------
// Murder Mystery
// -----------------------------------------------------------------------------
const murderMysteryQuest: QuestDefinition = {
    key: "murder_mystery",
    name: "Murder Mystery",
    varpId: 192,
    startedValue: 1,
    completionValue: 2,
    rewards: {
        questPoints: 1,
        xp: [{ skillId: SkillId.Crafting, amount: 2756, label: "Crafting" }],
        items: [{ itemId: 995, quantity: 2000, label: "2000 Coins" }],
    },
    rewardItemId: 995,
    overviewStartText: "solving a murder at the <col=800000>Sinclair Mansion</col>.",
    buildJournal(player, _services): string[] {
        const stage = getQuestStage(player, murderMysteryQuest);
        if (stage < murderMysteryQuest.startedValue) {
            return buildNotStartedJournal(
                murderMysteryQuest,
                "I can start this quest by talking to Anna at Sinclair Mansion.",
            );
        }
        if (stage >= murderMysteryQuest.completionValue) {
            return buildCompleteJournal([
                "Lord Sinclair was murdered.",
                "I interviewed the household and exposed the killer.",
            ]);
        }
        const clues =
            (getQuestFlag(player, murderMysteryQuest.key, "clue_hobbes") ? 1 : 0) +
            (getQuestFlag(player, murderMysteryQuest.key, "clue_louisa") ? 1 : 0) +
            (getQuestFlag(player, murderMysteryQuest.key, "clue_mary") ? 1 : 0);
        return [
            "Someone at the mansion murdered Lord Sinclair.",
            "",
            `I have interviewed ${clues}/3 suspects.`,
            clues >= 3 ? "I should report my findings to Anna." : "I should interview the household staff.",
        ];
    },
    register(registry): void {
        const clueNpc = (
            npcId: number,
            name: string,
            flag: "clue_hobbes" | "clue_louisa" | "clue_mary",
            line: string,
        ) => {
            registerQuestNpcTalk(registry, npcId, ({ player, services }) => {
                const ctx: DialogueContext = { player, services, npcId, npcName: name };
                if (getQuestStage(player, murderMysteryQuest) < murderMysteryQuest.startedValue) return;
                if (getQuestFlag(player, murderMysteryQuest.key, flag)) {
                    startConversation(ctx, [{ npc: ["I've told you everything I know."] }]);
                    return;
                }
                startConversation(ctx, [
                    { npc: [line] },
                    { exec: (d) => setQuestFlag(d.player, murderMysteryQuest.key, flag, true) },
                ]);
            });
        };

        registerQuestNpcTalk(registry, 1995, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 1995, npcName: "Anna" };
            const stage = getQuestStage(player, murderMysteryQuest);
            if (stage >= murderMysteryQuest.completionValue) {
                startConversation(ctx, [{ npc: ["The mystery is solved."] }]);
                return;
            }
            const cluesReady =
                getQuestFlag(player, murderMysteryQuest.key, "clue_hobbes") &&
                getQuestFlag(player, murderMysteryQuest.key, "clue_louisa") &&
                getQuestFlag(player, murderMysteryQuest.key, "clue_mary");
            if (stage >= murderMysteryQuest.startedValue && cluesReady) {
                startConversation(ctx, [
                    { player: ["It was the poison in the study. Hobbes is the killer."] },
                    { npc: ["You're right! The guard will arrest him."] },
                    { exec: (d) => completeQuest(d.player, d.services, murderMysteryQuest) },
                ]);
                return;
            }
            if (stage >= murderMysteryQuest.startedValue) {
                startConversation(ctx, [
                    { npc: ["Interview Hobbes, Louisa and Mary, then return to me."] },
                ]);
                return;
            }
            startConversation(ctx, [
                { npc: ["Father has been murdered! Will you investigate?"] },
                {
                    options: [
                        {
                            text: "I'll investigate.",
                            next: [
                                { player: ["I'll investigate."] },
                                {
                                    exec: (d) =>
                                        setQuestStage(
                                            d.player,
                                            murderMysteryQuest,
                                            d.services,
                                            murderMysteryQuest.startedValue,
                                        ),
                                },
                            ],
                        },
                        { text: "Not now.", next: [{ player: ["Not now."] }] },
                    ],
                },
            ]);
        });

        clueNpc(
            4214,
            "Hobbes",
            "clue_hobbes",
            "I saw Louisa near the study that night... but I won't say more.",
        );
        clueNpc(
            4215,
            "Louisa",
            "clue_louisa",
            "Hobbes was acting strangely. He kept washing his hands.",
        );
        clueNpc(
            4216,
            "Mary",
            "clue_mary",
            "There was a strange smell of poison coming from the kitchen.",
        );
    },
};

export const membersQuestPack: QuestDefinition[] = [
    gertrudesCatQuest,
    druidicRitualQuest,
    priestInPerilQuest,
    plagueCityQuest,
    waterfallQuest,
    junglePotionQuest,
    merlinsCrystalQuest,
    murderMysteryQuest,
];
