import { SkillId } from "../../../../../src/rs/skill/skills";
import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
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
import type { QuestDefinition, QuestItemRequirement } from "../types";

const VARP_PLAGUE_CITY = 165;
const PLAGUE_CITY_COMPLETE = 29;
const VARP_JUNGLE_POTION = 175;
const JUNGLE_POTION_COMPLETE = 12;

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
    if (countCarriedItem(player, services, itemId) >= quantity) return;
    const added = services.inventory.addItemToInventory(player, itemId, quantity);
    if (added.added > 0) services.inventory.snapshotInventory(player);
}

function isPlagueCityComplete(player: Parameters<typeof getQuestStage>[0]): boolean {
    return player.varps.getVarpValue(VARP_PLAGUE_CITY) >= PLAGUE_CITY_COMPLETE;
}

function isJunglePotionComplete(player: Parameters<typeof getQuestStage>[0]): boolean {
    return player.varps.getVarpValue(VARP_JUNGLE_POTION) >= JUNGLE_POTION_COMPLETE;
}

// -----------------------------------------------------------------------------
// Lost City
// -----------------------------------------------------------------------------
const DRAMEN_BRANCH = 771;
const DRAMEN_STAFF = 772;
const KNIFE = 946;

const lostCityQuest: QuestDefinition = {
    key: "lost_city",
    name: "Lost City",
    varpId: 147,
    startedValue: 1,
    completionValue: 6,
    rewards: {
        questPoints: 3,
        other: ["Access to Zanaris"],
    },
    rewardItemId: DRAMEN_STAFF,
    overviewStartText: "discovering the fabled city of <col=800000>Zanaris</col>.",
    buildJournal(player, services): string[] {
        const stage = getQuestStage(player, lostCityQuest);
        if (stage < lostCityQuest.startedValue) {
            return buildNotStartedJournal(
                lostCityQuest,
                "I can start this quest by talking to the adventurers in Lumbridge Swamp.",
            );
        }
        if (stage >= lostCityQuest.completionValue) {
            return buildCompleteJournal([
                "Adventurers were searching for the lost city of Zanaris.",
                "I found the leprechaun's secret and entered Zanaris with a Dramen staff.",
            ]);
        }
        return [
            "I must find the entrance to Zanaris.",
            "",
            strikeIf(getQuestFlag(player, lostCityQuest.key, "spoke_warrior"), "The warrior may know about Zanaris."),
            strikeIf(
                getQuestFlag(player, lostCityQuest.key, "spoke_wizard"),
                "A leprechaun in a nearby tree knows the way.",
            ),
            strikeIf(
                hasItem(player, services, DRAMEN_STAFF),
                "I need a Dramen staff from Entrana to enter the shed portal.",
            ),
        ];
    },
    register(registry): void {
        const warriorHandler = (npcId: number, npcName: string) => {
            registerQuestNpcTalk(registry, npcId, ({ player, services }) => {
                const ctx: DialogueContext = { player, services, npcId, npcName };
                const stage = getQuestStage(player, lostCityQuest);
                if (stage >= lostCityQuest.completionValue) {
                    startConversation(ctx, [{ npc: ["Zanaris is open to you now."] }]);
                    return;
                }
                if (hasItem(player, services, DRAMEN_STAFF)) {
                    startConversation(ctx, [
                        { npc: ["The shed portal reacts to your Dramen staff!"] },
                        { exec: (d) => completeQuest(d.player, d.services, lostCityQuest) },
                    ]);
                    return;
                }
                if (stage >= lostCityQuest.startedValue) {
                    if (!getQuestFlag(player, lostCityQuest.key, "spoke_warrior")) {
                        startConversation(ctx, [
                            { exec: (d) => setQuestFlag(d.player, lostCityQuest.key, "spoke_warrior", true) },
                            {
                                npc: [
                                    "Zanaris? Uh... there's a leprechaun hiding in a tree nearby. He'd know more.",
                                ],
                            },
                        ]);
                        return;
                    }
                    startConversation(ctx, [
                        { npc: ["Get a Dramen staff from Entrana, then use the tool shed in the swamp."] },
                    ]);
                    return;
                }
                startConversation(ctx, [
                    { npc: ["We're searching for the lost city of Zanaris. Care to help?"] },
                    {
                        options: [
                            {
                                text: "I'll help you search.",
                                next: [
                                    { player: ["I'll help you search."] },
                                    {
                                        exec: (d) =>
                                            setQuestStage(
                                                d.player,
                                                lostCityQuest,
                                                d.services,
                                                lostCityQuest.startedValue,
                                            ),
                                    },
                                ],
                            },
                            { text: "Not now.", next: [{ player: ["Not now."] }] },
                        ],
                    },
                ]);
            });
        };

        warriorHandler(1158, "Warrior");
        warriorHandler(1157, "Archer");
        warriorHandler(1159, "Monk");

        registerQuestNpcTalk(registry, 1160, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 1160, npcName: "Wizard" };
            if (getQuestStage(player, lostCityQuest) < lostCityQuest.startedValue) return;
            if (getQuestStage(player, lostCityQuest) >= lostCityQuest.completionValue) {
                startConversation(ctx, [{ npc: ["Zanaris awaits through the shed in the swamp."] }]);
                return;
            }
            if (hasItem(player, services, DRAMEN_STAFF)) {
                startConversation(ctx, [{ npc: ["Equip the staff and enter the shed in the swamp centre."] }]);
                return;
            }
            if (hasItem(player, services, DRAMEN_BRANCH) && hasItem(player, services, KNIFE)) {
                startConversation(ctx, [
                    { npc: ["Use your knife on the Dramen branch to craft a staff."] },
                    {
                        exec: (d) => {
                            takeQuestItems(d.player, d.services, [
                                { itemId: DRAMEN_BRANCH, quantity: 1, journalLabel: "" },
                            ]);
                            addItemIfMissing(d.player, d.services, DRAMEN_STAFF, 1);
                        },
                    },
                ]);
                return;
            }
            if (!getQuestFlag(player, lostCityQuest.key, "spoke_wizard")) {
                startConversation(ctx, [
                    { exec: (d) => setQuestFlag(d.player, lostCityQuest.key, "spoke_wizard", true) },
                    {
                        npc: [
                            "Chop the Dramen tree in Entrana's dungeon. You'll need a knife to make a Dramen staff.",
                        ],
                    },
                    {
                        exec: (d) => {
                            addItemIfMissing(d.player, d.services, DRAMEN_BRANCH, 1);
                            addItemIfMissing(d.player, d.services, KNIFE, 1);
                        },
                    },
                ]);
                return;
            }
            startConversation(ctx, [{ npc: ["Bring me a Dramen branch and a knife."] }]);
        });
    },
};

// -----------------------------------------------------------------------------
// Tree Gnome Village
// -----------------------------------------------------------------------------
const ORB_OF_PROTECTION = 587;

const treeGnomeVillageQuest: QuestDefinition = {
    key: "tree_gnome_village",
    name: "Tree Gnome Village",
    varpId: 111,
    startedValue: 1,
    completionValue: 9,
    rewards: {
        questPoints: 2,
        xp: [{ skillId: SkillId.Attack, amount: 11450, label: "Attack" }],
        other: ["Access to Spirit tree travel"],
    },
    rewardItemId: ORB_OF_PROTECTION,
    overviewStartText: "helping the <col=800000>Tree Gnomes</col> against General Khazard.",
    buildJournal(player, services): string[] {
        const stage = getQuestStage(player, treeGnomeVillageQuest);
        if (stage < treeGnomeVillageQuest.startedValue) {
            return buildNotStartedJournal(
                treeGnomeVillageQuest,
                "I can start this quest by talking to King Bolren in the Tree Gnome Maze.",
            );
        }
        if (stage >= treeGnomeVillageQuest.completionValue) {
            return buildCompleteJournal([
                "Khazard's army stole the orbs of protection.",
                "I recovered both orbs and restored the gnome village.",
            ]);
        }
        if (hasItem(player, services, ORB_OF_PROTECTION, 2)) {
            return ["I have both orbs.", "", "I should return them to King Bolren."];
        }
        return [
            "I must recover the orbs of protection.",
            "",
            strikeIf(getQuestFlag(player, treeGnomeVillageQuest.key, "spoke_montai"), "King Bolren needs my help."),
            strikeIf(
                getQuestFlag(player, treeGnomeVillageQuest.key, "spoke_trackers"),
                "Commander Montai sent me to speak with the tracker gnomes.",
            ),
            strikeIf(
                getQuestFlag(player, treeGnomeVillageQuest.key, "orb_trooper"),
                "One orb is held by Khazard troops near the stronghold.",
            ),
            strikeIf(
                getQuestFlag(player, treeGnomeVillageQuest.key, "orb_warlord"),
                "The Khazard Warlord has the second orb.",
            ),
        ];
    },
    register(registry): void {
        registerQuestNpcTalk(registry, 4963, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 4963, npcName: "King Bolren" };
            const stage = getQuestStage(player, treeGnomeVillageQuest);
            if (stage < treeGnomeVillageQuest.startedValue) {
                return;
            }
            if (stage >= treeGnomeVillageQuest.completionValue) {
                return;
            }
            if (hasItem(player, services, ORB_OF_PROTECTION, 2)) {
                startConversation(ctx, [
                    { npc: ["You found both orbs! The spirit tree is protected again."] },
                    {
                        exec: (d) => {
                            takeQuestItems(d.player, d.services, [
                                { itemId: ORB_OF_PROTECTION, quantity: 2, journalLabel: "" },
                            ]);
                            completeQuest(d.player, d.services, treeGnomeVillageQuest);
                        },
                    },
                ]);
                return;
            }
            if (stage >= treeGnomeVillageQuest.startedValue) {
                startConversation(ctx, [
                    { npc: ["Recover both orbs from Khazard's forces. Montai can direct you."] },
                ]);
                return;
            }
            startConversation(ctx, [
                { npc: ["Khazard stole our orbs of protection! Will you help us?"] },
                {
                    options: [
                        {
                            text: "I'll recover the orbs.",
                            next: [
                                { player: ["I'll recover the orbs."] },
                                { npc: ["Speak with Commander Montai in the village."] },
                                {
                                    exec: (d) =>
                                        setQuestStage(
                                            d.player,
                                            treeGnomeVillageQuest,
                                            d.services,
                                            treeGnomeVillageQuest.startedValue,
                                        ),
                                },
                            ],
                        },
                        { text: "Not now.", next: [{ player: ["Not now."] }] },
                    ],
                },
            ]);
        });

        registerQuestNpcTalk(registry, 4964, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 4964, npcName: "Commander Montai" };
            if (getQuestStage(player, treeGnomeVillageQuest) < treeGnomeVillageQuest.startedValue) return;
            startConversation(ctx, [
                { exec: (d) => setQuestFlag(d.player, treeGnomeVillageQuest.key, "spoke_montai", true) },
                { npc: ["Our trackers saw troops take an orb north. The warlord has the other."] },
            ]);
        });

        const trackerHandler = (npcId: number, name: string) => {
            registerQuestNpcTalk(registry, npcId, ({ player, services }) => {
                const ctx: DialogueContext = { player, services, npcId, npcName: name };
                if (getQuestStage(player, treeGnomeVillageQuest) < treeGnomeVillageQuest.startedValue) return;
                startConversation(ctx, [
                    {
                        exec: (d) =>
                            setQuestFlag(d.player, treeGnomeVillageQuest.key, "spoke_trackers", true),
                    },
                    { npc: ["Khazard troops are north-west. The warlord camps beyond the wolves."] },
                ]);
            });
        };
        trackerHandler(4975, "Tracker gnome 1");
        trackerHandler(4976, "Tracker gnome 2");
        trackerHandler(4977, "Tracker gnome 3");

        registerQuestNpcTalk(registry, 5971, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 5971, npcName: "Khazard trooper" };
            if (getQuestStage(player, treeGnomeVillageQuest) < treeGnomeVillageQuest.startedValue) return;
            if (getQuestFlag(player, treeGnomeVillageQuest.key, "orb_trooper")) {
                startConversation(ctx, [{ npc: ["Keep away from our stronghold!"] }]);
                return;
            }
            startConversation(ctx, [
                { npc: ["You can't have this orb! ...Fine, take it and leave."] },
                {
                    exec: (d) => {
                        addItemIfMissing(d.player, d.services, ORB_OF_PROTECTION, 1);
                        setQuestFlag(d.player, treeGnomeVillageQuest.key, "orb_trooper", true);
                    },
                },
            ]);
        });

        registerQuestNpcTalk(registry, 4971, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 4971, npcName: "Khazard warlord" };
            if (getQuestStage(player, treeGnomeVillageQuest) < treeGnomeVillageQuest.startedValue) return;
            if (getQuestFlag(player, treeGnomeVillageQuest.key, "orb_warlord")) {
                startConversation(ctx, [{ npc: ["You've already taken my orb!"] }]);
                return;
            }
            startConversation(ctx, [
                { npc: ["No one takes from the warlord! ...Curse you, gnome-lover!"] },
                {
                    exec: (d) => {
                        addItemIfMissing(d.player, d.services, ORB_OF_PROTECTION, 1);
                        setQuestFlag(d.player, treeGnomeVillageQuest.key, "orb_warlord", true);
                    },
                },
            ]);
        });
    },
};

// -----------------------------------------------------------------------------
// Shilo Village
// -----------------------------------------------------------------------------
const TATTERED_SCROLL = 607;
const BONE_SHARD = 604;
const BONE_BEADS = 618;

const SHILO_HERBS: QuestItemRequirement[] = [
    { itemId: 1526, quantity: 1, journalLabel: "Snake weed" },
    { itemId: 1528, quantity: 1, journalLabel: "Ardrigal" },
];

const shiloVillageQuest: QuestDefinition = {
    key: "shilo_village",
    name: "Shilo Village",
    varpId: 116,
    startedValue: 1,
    completionValue: 15,
    rewards: {
        questPoints: 2,
        xp: [
            { skillId: SkillId.Crafting, amount: 3875, label: "Crafting" },
            { skillId: SkillId.Strength, amount: 2775, label: "Strength" },
        ],
        other: ["Access to Shilo Village"],
    },
    rewardItemId: BONE_BEADS,
    overviewStartText: "helping <col=800000>Mosol Rei</col> cleanse Shilo Village.",
    buildJournal(player, services): string[] {
        const stage = getQuestStage(player, shiloVillageQuest);
        if (stage < shiloVillageQuest.startedValue) {
            return buildNotStartedJournal(
                shiloVillageQuest,
                "I can start this quest by talking to Mosol Rei east of Shilo Village.",
            );
        }
        if (stage >= shiloVillageQuest.completionValue) {
            return buildCompleteJournal([
                "An evil spirit plagued Shilo Village.",
                "I gathered the relics and broke Rashiliyia's curse.",
            ]);
        }
        if (getQuestFlag(player, shiloVillageQuest.key, "has_beads")) {
            return ["I have the bone beads.", "", "I should return to Mosol Rei."];
        }
        if (getQuestFlag(player, shiloVillageQuest.key, "spoke_yanni")) {
            return buildItemProgressJournal(
                player,
                services,
                ["Trufitus needs herbs to bless the relics."],
                SHILO_HERBS,
            );
        }
        return [
            "Mosol Rei needs help lifting a curse on Shilo Village.",
            "",
            strikeIf(getQuestFlag(player, shiloVillageQuest.key, "spoke_trufitus"), "I should speak with Mosol Rei."),
            strikeIf(
                getQuestFlag(player, shiloVillageQuest.key, "spoke_yanni"),
                "Trufitus sent me to Yanni Salika for a tattered scroll.",
            ),
            strikeIf(
                getQuestFlag(player, shiloVillageQuest.key, "has_scroll"),
                "Yanni may know where to find bone shards and beads.",
            ),
        ];
    },
    register(registry): void {
        registerQuestNpcTalk(registry, 8695, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 8695, npcName: "Mosol Rei" };
            const stage = getQuestStage(player, shiloVillageQuest);
            if (stage >= shiloVillageQuest.completionValue) {
                startConversation(ctx, [{ npc: ["Shilo Village is peaceful again."] }]);
                return;
            }
            if (
                getQuestFlag(player, shiloVillageQuest.key, "has_beads") ||
                (hasItem(player, services, BONE_BEADS) && hasItem(player, services, BONE_SHARD))
            ) {
                startConversation(ctx, [
                    { npc: ["The curse is broken! Shilo Village is open to you."] },
                    {
                        exec: (d) => {
                            if (hasItem(d.player, d.services, BONE_BEADS)) {
                                takeQuestItems(d.player, d.services, [
                                    { itemId: BONE_BEADS, quantity: 1, journalLabel: "" },
                                ]);
                            }
                            completeQuest(d.player, d.services, shiloVillageQuest);
                        },
                    },
                ]);
                return;
            }
            if (stage >= shiloVillageQuest.startedValue) {
                startConversation(ctx, [{ npc: ["Speak with Trufitus in Tai Bwo Wannai."] }]);
                return;
            }
            if (!isJunglePotionComplete(player)) {
                startConversation(ctx, [
                    { npc: ["First help Trufitus with his jungle potion, then return to me."] },
                ]);
                return;
            }
            startConversation(ctx, [
                { npc: ["A dark curse grips Shilo Village. Will you help break it?"] },
                {
                    options: [
                        {
                            text: "I'll help.",
                            next: [
                                { player: ["I'll help."] },
                                { npc: ["Trufitus knows the old rituals. Start with him."] },
                                {
                                    exec: (d) =>
                                        setQuestStage(
                                            d.player,
                                            shiloVillageQuest,
                                            d.services,
                                            shiloVillageQuest.startedValue,
                                        ),
                                },
                            ],
                        },
                        { text: "Not now.", next: [{ player: ["Not now."] }] },
                    ],
                },
            ]);
        });

        registerQuestNpcTalk(registry, 4625, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 4625, npcName: "Trufitus" };
            if (getQuestStage(player, shiloVillageQuest) < shiloVillageQuest.startedValue) return;
            if (getQuestFlag(player, shiloVillageQuest.key, "has_beads")) {
                startConversation(ctx, [{ npc: ["Take the beads to Mosol Rei."] }]);
                return;
            }
            if (
                SHILO_HERBS.every((req) => hasItem(player, services, req.itemId, req.quantity)) &&
                hasItem(player, services, TATTERED_SCROLL) &&
                hasItem(player, services, BONE_SHARD)
            ) {
                startConversation(ctx, [
                    { npc: ["The herbs and relics are ready. Take these blessed bone beads."] },
                    {
                        exec: (d) => {
                            takeQuestItems(d.player, d.services, [
                                ...SHILO_HERBS,
                                { itemId: TATTERED_SCROLL, quantity: 1, journalLabel: "" },
                                { itemId: BONE_SHARD, quantity: 1, journalLabel: "" },
                            ]);
                            addItemIfMissing(d.player, d.services, BONE_BEADS, 1);
                            setQuestFlag(d.player, shiloVillageQuest.key, "has_beads", true);
                        },
                    },
                ]);
                return;
            }
            if (!getQuestFlag(player, shiloVillageQuest.key, "spoke_trufitus")) {
                startConversation(ctx, [
                    { exec: (d) => setQuestFlag(d.player, shiloVillageQuest.key, "spoke_trufitus", true) },
                    { npc: ["Yanni Salika has a tattered scroll. You'll also need snake weed and ardrigal."] },
                ]);
                return;
            }
            startConversation(ctx, [
                { npc: ["Bring snake weed, ardrigal, the scroll, and a bone shard from Yanni."] },
            ]);
        });

        registerQuestNpcTalk(registry, 5361, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 5361, npcName: "Yanni Salika" };
            if (getQuestStage(player, shiloVillageQuest) < shiloVillageQuest.startedValue) return;
            if (getQuestFlag(player, shiloVillageQuest.key, "has_scroll")) {
                startConversation(ctx, [{ npc: ["I already gave you the scroll and shard."] }]);
                return;
            }
            startConversation(ctx, [
                { exec: (d) => setQuestFlag(d.player, shiloVillageQuest.key, "spoke_yanni", true) },
                { npc: ["Take this tattered scroll and bone shard. Rashiliyia's tomb holds more secrets."] },
                {
                    exec: (d) => {
                        addItemIfMissing(d.player, d.services, TATTERED_SCROLL, 1);
                        addItemIfMissing(d.player, d.services, BONE_SHARD, 1);
                        setQuestFlag(d.player, shiloVillageQuest.key, "has_scroll", true);
                    },
                },
            ]);
        });
    },
};

// -----------------------------------------------------------------------------
// Biohazard
// -----------------------------------------------------------------------------
const PIGEON_CAGE = 424;
const DISTILLATOR = 420;
const ROTTEN_APPLE = 1984;

const biohazardQuest: QuestDefinition = {
    key: "biohazard",
    name: "Biohazard",
    varpId: 68,
    startedValue: 1,
    completionValue: 16,
    rewards: {
        questPoints: 3,
        xp: [{ skillId: SkillId.Thieving, amount: 1250, label: "Thieving" }],
        other: ["Ability to cast Ardougne Teleport"],
    },
    rewardItemId: DISTILLATOR,
    overviewStartText: "continuing the investigation into the <col=800000>plague</col>.",
    buildJournal(player, services): string[] {
        const stage = getQuestStage(player, biohazardQuest);
        if (stage < biohazardQuest.startedValue) {
            return buildNotStartedJournal(
                biohazardQuest,
                "I can start this quest by talking to Elena after completing Plague City.",
            );
        }
        if (stage >= biohazardQuest.completionValue) {
            return buildCompleteJournal([
                "The plague was a hoax spread by King Lathas.",
                "I helped Elena expose the conspiracy and can now teleport to Ardougne.",
            ]);
        }
        if (getQuestFlag(player, biohazardQuest.key, "distillator_ready")) {
            return ["The distillator is ready.", "", "I should return to Elena."];
        }
        return [
            "I must uncover the truth behind the plague.",
            "",
            strikeIf(getQuestFlag(player, biohazardQuest.key, "spoke_jerico"), "Elena needs my help again."),
            strikeIf(
                getQuestFlag(player, biohazardQuest.key, "has_cage"),
                "Jerico in Ardougne has a pigeon cage.",
            ),
            strikeIf(
                getQuestFlag(player, biohazardQuest.key, "distillator_ready"),
                "Guidor in Varrock needs a rotten apple for the distillator.",
            ),
        ];
    },
    register(registry): void {
        registerQuestNpcTalk(registry, 2011, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 2011, npcName: "Elena" };
            const stage = getQuestStage(player, biohazardQuest);
            if (stage >= biohazardQuest.completionValue) {
                startConversation(ctx, [{ npc: ["The plague conspiracy is exposed. Thank you!"] }]);
                return;
            }
            if (getQuestFlag(player, biohazardQuest.key, "distillator_ready")) {
                startConversation(ctx, [
                    { npc: ["The distillator proves the plague is fake! Quest complete."] },
                    { exec: (d) => completeQuest(d.player, d.services, biohazardQuest) },
                ]);
                return;
            }
            if (stage >= biohazardQuest.startedValue) {
                startConversation(ctx, [{ npc: ["Speak with Jerico near Ardougne market."] }]);
                return;
            }
            if (!isPlagueCityComplete(player)) {
                startConversation(ctx, [
                    { npc: ["Rescue me from West Ardougne first — speak with my father Edmond."] },
                ]);
                return;
            }
            startConversation(ctx, [
                { npc: ["The plague may be a lie. Will you help me investigate?"] },
                {
                    options: [
                        {
                            text: "I'll investigate.",
                            next: [
                                { player: ["I'll investigate."] },
                                { npc: ["Jerico has pigeons that can carry samples. Find him in Ardougne."] },
                                {
                                    exec: (d) =>
                                        setQuestStage(
                                            d.player,
                                            biohazardQuest,
                                            d.services,
                                            biohazardQuest.startedValue,
                                        ),
                                },
                            ],
                        },
                        { text: "Not now.", next: [{ player: ["Not now."] }] },
                    ],
                },
            ]);
        });

        registerQuestNpcTalk(registry, 1145, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 1145, npcName: "Jerico" };
            if (getQuestStage(player, biohazardQuest) < biohazardQuest.startedValue) return;
            if (getQuestFlag(player, biohazardQuest.key, "has_cage")) {
                startConversation(ctx, [{ npc: ["Take the cage to Guidor in south-east Varrock."] }]);
                return;
            }
            startConversation(ctx, [
                { exec: (d) => setQuestFlag(d.player, biohazardQuest.key, "spoke_jerico", true) },
                { npc: ["Take this pigeon cage to Guidor. He can distill a test sample."] },
                {
                    exec: (d) => {
                        addItemIfMissing(d.player, d.services, PIGEON_CAGE, 1);
                        setQuestFlag(d.player, biohazardQuest.key, "has_cage", true);
                    },
                },
            ]);
        });

        registerQuestNpcTalk(registry, 1110, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 1110, npcName: "Guidor" };
            if (getQuestStage(player, biohazardQuest) < biohazardQuest.startedValue) return;
            if (getQuestFlag(player, biohazardQuest.key, "distillator_ready")) {
                startConversation(ctx, [{ npc: ["Return to Elena with the distillator."] }]);
                return;
            }
            if (hasItem(player, services, PIGEON_CAGE) && hasItem(player, services, ROTTEN_APPLE)) {
                startConversation(ctx, [
                    { npc: ["Perfect. The distillator shows the plague sample is harmless!"] },
                    {
                        exec: (d) => {
                            takeQuestItems(d.player, d.services, [
                                { itemId: ROTTEN_APPLE, quantity: 1, journalLabel: "" },
                            ]);
                            addItemIfMissing(d.player, d.services, DISTILLATOR, 1);
                            setQuestFlag(d.player, biohazardQuest.key, "distillator_ready", true);
                        },
                    },
                ]);
                return;
            }
            startConversation(ctx, [
                { npc: ["Bring me Jerico's pigeon cage and a rotten apple from West Ardougne."] },
            ]);
        });
    },
};

export const additionalMembersQuests: QuestDefinition[] = [
    lostCityQuest,
    treeGnomeVillageQuest,
    shiloVillageQuest,
    biohazardQuest,
];
