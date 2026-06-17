import { SkillId } from "../../../../../src/rs/skill/skills";
import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import { getQuestFlag, setQuestFlag } from "../QuestFlags";
import {
    completeQuest,
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
import { simpleQuest } from "./questFactory";
import { addItemIfMissing, hasItem, isVarpAtLeast } from "./questUtils";

const PRIEST_IN_PERIL = 302;
const PRIEST_COMPLETE = 60;
const GRAND_TREE = 150;
const GRAND_TREE_COMPLETE = 160;
const TREE_GNOME = 111;
const TREE_GNOME_COMPLETE = 9;

// -----------------------------------------------------------------------------
// Watchtower
// -----------------------------------------------------------------------------
const watchtowerQuest: QuestDefinition = {
    key: "watchtower",
    name: "Watchtower",
    varpId: 212,
    startedValue: 1,
    completionValue: 13,
    rewards: {
        questPoints: 2,
        xp: [
            { skillId: SkillId.Magic, amount: 15250, label: "Magic" },
            { skillId: SkillId.Herblore, amount: 15250, label: "Herblore" },
        ],
        other: ["Watchtower Teleport spell"],
    },
    rewardItemId: 4808,
    overviewStartText: "investigating the <col=800000>Yanille Watchtower</col>.",
    buildJournal(player, _services) {
        const stage = getQuestStage(player, watchtowerQuest);
        if (stage < watchtowerQuest.startedValue) {
            return buildNotStartedJournal(watchtowerQuest, "I can start by talking to the Watchtower Wizard.");
        }
        if (stage >= watchtowerQuest.completionValue) {
            return buildCompleteJournal([
                "Goraks stole the Watchtower crystals.",
                "I recovered the black prism and restored the Watchtower.",
            ]);
        }
        return [
            "The Watchtower has been attacked.",
            "",
            strikeIf(getQuestFlag(player, watchtowerQuest.key, "spoke_skavid"), "The wizard needs help."),
            strikeIf(getQuestFlag(player, watchtowerQuest.key, "has_prism"), "I must find the stolen black prism."),
        ];
    },
    register(registry): void {
        registerQuestNpcTalk(registry, 4397, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 4397, npcName: "Watchtower Wizard" };
            const stage = getQuestStage(player, watchtowerQuest);
            if (stage >= watchtowerQuest.completionValue) {
                startConversation(ctx, [{ npc: ["The Watchtower is secure again."] }]);
                return;
            }
            if (hasItem(player, services, 4808)) {
                startConversation(ctx, [
                    { npc: ["The black prism! The Watchtower is saved."] },
                    { exec: (d) => completeQuest(d.player, d.services, watchtowerQuest) },
                ]);
                return;
            }
            if (stage >= watchtowerQuest.startedValue) {
                startConversation(ctx, [
                    { npc: ["Find the black prism in the ogre caves south of Yanille."] },
                ]);
                return;
            }
            startConversation(ctx, [
                { npc: ["Thieves stole our black prism! Will you recover it?"] },
                {
                    options: [
                        {
                            text: "I'll find it.",
                            next: [
                                { player: ["I'll find it."] },
                                {
                                    exec: (d) =>
                                        setQuestStage(
                                            d.player,
                                            watchtowerQuest,
                                            d.services,
                                            watchtowerQuest.startedValue,
                                        ),
                                },
                            ],
                        },
                        { text: "Not now.", next: [{ player: ["Not now."] }] },
                    ],
                },
            ]);
        });
        registerQuestNpcTalk(registry, 4399, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 4399, npcName: "Wizard" };
            if (getQuestStage(player, watchtowerQuest) < watchtowerQuest.startedValue) return;
            startConversation(ctx, [
                { exec: (d) => setQuestFlag(d.player, watchtowerQuest.key, "spoke_skavid", true) },
                { npc: ["The ogres took the prism to their caves. Search the southern tunnels."] },
                {
                    exec: (d) => {
                        addItemIfMissing(d.player, d.services, 4808, 1);
                        setQuestFlag(d.player, watchtowerQuest.key, "has_prism", true);
                    },
                },
            ]);
        });
    },
};

// -----------------------------------------------------------------------------
// The Grand Tree
// -----------------------------------------------------------------------------
const grandTreeQuest: QuestDefinition = {
    key: "the_grand_tree",
    name: "The Grand Tree",
    varpId: 150,
    startedValue: 1,
    completionValue: 160,
    rewards: {
        questPoints: 5,
        xp: [
            { skillId: SkillId.Attack, amount: 18400, label: "Attack" },
            { skillId: SkillId.Agility, amount: 7900, label: "Agility" },
            { skillId: SkillId.Magic, amount: 2150, label: "Magic" },
        ],
        other: ["Gnome glider travel"],
    },
    rewardItemId: 771,
    overviewStartText: "saving the <col=800000>Grand Tree</col> of the gnomes.",
    buildJournal(player, _services) {
        const stage = getQuestStage(player, grandTreeQuest);
        if (stage < grandTreeQuest.startedValue) {
            return buildNotStartedJournal(
                grandTreeQuest,
                "I can start by talking to King Narnode Shareen in the Grand Tree.",
            );
        }
        if (stage >= grandTreeQuest.completionValue) {
            return buildCompleteJournal([
                "Glough was plotting against the gnomes.",
                "I exposed his plans and saved the Grand Tree.",
            ]);
        }
        return [
            "The Grand Tree is dying.",
            "",
            strikeIf(getQuestFlag(player, grandTreeQuest.key, "spoke_hazelmere"), "King Narnode needs help."),
            strikeIf(getQuestFlag(player, grandTreeQuest.key, "spoke_foreman"), "Hazelmere knows about Glough's plot."),
            strikeIf(getQuestFlag(player, grandTreeQuest.key, "defeated_demon"), "The foreman has evidence against Glough."),
        ];
    },
    register(registry): void {
        registerQuestNpcTalk(registry, 1423, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 1423, npcName: "King Narnode Shareen" };
            const stage = getQuestStage(player, grandTreeQuest);
            if (stage >= grandTreeQuest.completionValue) {
                startConversation(ctx, [{ npc: ["The Grand Tree lives on!"] }]);
                return;
            }
            if (getQuestFlag(player, grandTreeQuest.key, "defeated_demon")) {
                startConversation(ctx, [
                    { npc: ["Glough is defeated! The tree is saved."] },
                    { exec: (d) => completeQuest(d.player, d.services, grandTreeQuest) },
                ]);
                return;
            }
            if (stage >= grandTreeQuest.startedValue) {
                startConversation(ctx, [{ npc: ["Speak with Hazelmere on the east coast."] }]);
                return;
            }
            if (!isVarpAtLeast(player, TREE_GNOME, TREE_GNOME_COMPLETE)) {
                startConversation(ctx, [{ npc: ["Help the Tree Gnome Village first."] }]);
                return;
            }
            startConversation(ctx, [
                { npc: ["Our Grand Tree is dying! Will you investigate?"] },
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
                                            grandTreeQuest,
                                            d.services,
                                            grandTreeQuest.startedValue,
                                        ),
                                },
                            ],
                        },
                        { text: "Not now.", next: [{ player: ["Not now."] }] },
                    ],
                },
            ]);
        });
        registerQuestNpcTalk(registry, 1422, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 1422, npcName: "Hazelmere" };
            if (getQuestStage(player, grandTreeQuest) < grandTreeQuest.startedValue) return;
            startConversation(ctx, [
                { exec: (d) => setQuestFlag(d.player, grandTreeQuest.key, "spoke_hazelmere", true) },
                { npc: ["Glough is a traitor! Speak with the shipyard foreman for proof."] },
            ]);
        });
        registerQuestNpcTalk(registry, 1429, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 1429, npcName: "Foreman" };
            if (getQuestStage(player, grandTreeQuest) < grandTreeQuest.startedValue) return;
            if (!getQuestFlag(player, grandTreeQuest.key, "spoke_hazelmere")) return;
            if (getQuestFlag(player, grandTreeQuest.key, "defeated_demon")) return;
            startConversation(ctx, [
                { exec: (d) => setQuestFlag(d.player, grandTreeQuest.key, "spoke_foreman", true) },
                { npc: ["Glough's black demon guards the tunnel. Defeat it and return to the King!"] },
                {
                    exec: (d) => setQuestFlag(d.player, grandTreeQuest.key, "defeated_demon", true),
                },
            ]);
        });
    },
};

// -----------------------------------------------------------------------------
// Fight Arena
// -----------------------------------------------------------------------------
const fightArenaQuest: QuestDefinition = {
    key: "fight_arena",
    name: "Fight Arena",
    varpId: 17,
    startedValue: 1,
    completionValue: 14,
    rewards: {
        questPoints: 2,
        xp: [{ skillId: SkillId.Attack, amount: 12175, label: "Attack" }],
    },
    rewardItemId: 76,
    overviewStartText: "rescuing <col=800000>Jeremy Servil</col> from the Fight Arena.",
    buildJournal(player, _services) {
        const stage = getQuestStage(player, fightArenaQuest);
        if (stage < fightArenaQuest.startedValue) {
            return buildNotStartedJournal(
                fightArenaQuest,
                "I can start by talking to Lady Servil south of West Ardougne.",
            );
        }
        if (stage >= fightArenaQuest.completionValue) {
            return buildCompleteJournal([
                "General Khazard imprisoned the Servil family.",
                "I freed Justin and escaped the Fight Arena.",
            ]);
        }
        return [
            "The Servils are prisoners of Khazard.",
            "",
            strikeIf(getQuestFlag(player, fightArenaQuest.key, "got_keys"), "Lady Servil begged for help."),
            strikeIf(getQuestFlag(player, fightArenaQuest.key, "freed_justin"), "I need Khazard's cell keys."),
        ];
    },
    register(registry): void {
        registerQuestNpcTalk(registry, 1219, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 1219, npcName: "Lady Servil" };
            const stage = getQuestStage(player, fightArenaQuest);
            if (stage >= fightArenaQuest.completionValue) {
                startConversation(ctx, [{ npc: ["We're free at last!"] }]);
                return;
            }
            if (getQuestFlag(player, fightArenaQuest.key, "freed_justin")) {
                startConversation(ctx, [
                    { npc: ["You saved my son!"] },
                    { exec: (d) => completeQuest(d.player, d.services, fightArenaQuest) },
                ]);
                return;
            }
            if (stage >= fightArenaQuest.startedValue) {
                startConversation(ctx, [{ npc: ["Get the keys from General Khazard!"] }]);
                return;
            }
            startConversation(ctx, [
                { npc: ["Khazard took my family! Please help us!"] },
                {
                    options: [
                        {
                            text: "I'll help.",
                            next: [
                                { player: ["I'll help."] },
                                {
                                    exec: (d) =>
                                        setQuestStage(
                                            d.player,
                                            fightArenaQuest,
                                            d.services,
                                            fightArenaQuest.startedValue,
                                        ),
                                },
                            ],
                        },
                        { text: "Not now.", next: [{ player: ["Not now."] }] },
                    ],
                },
            ]);
        });
        registerQuestNpcTalk(registry, 1213, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 1213, npcName: "General Khazard" };
            if (getQuestStage(player, fightArenaQuest) < fightArenaQuest.startedValue) return;
            if (getQuestFlag(player, fightArenaQuest.key, "got_keys")) {
                startConversation(ctx, [{ npc: ["Curse you!"] }]);
                return;
            }
            startConversation(ctx, [
                { npc: ["Fine, take the keys and get out of my arena!"] },
                {
                    exec: (d) => {
                        addItemIfMissing(d.player, d.services, 76, 1);
                        setQuestFlag(d.player, fightArenaQuest.key, "got_keys", true);
                    },
                },
            ]);
        });
        registerQuestNpcTalk(registry, 1222, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 1222, npcName: "Justin Servil" };
            if (getQuestStage(player, fightArenaQuest) < fightArenaQuest.startedValue) return;
            if (!getQuestFlag(player, fightArenaQuest.key, "got_keys")) return;
            startConversation(ctx, [
                { npc: ["The keys! Let's get out of here!"] },
                { exec: (d) => setQuestFlag(d.player, fightArenaQuest.key, "freed_justin", true) },
            ]);
        });
    },
};

// -----------------------------------------------------------------------------
// Nature Spirit
// -----------------------------------------------------------------------------
const natureSpiritQuest: QuestDefinition = {
    key: "nature_spirit",
    name: "Nature Spirit",
    varpId: 93,
    startedValue: 1,
    completionValue: 110,
    rewards: {
        questPoints: 2,
        xp: [
            { skillId: SkillId.Crafting, amount: 3000, label: "Crafting" },
            { skillId: SkillId.Defence, amount: 2000, label: "Defence" },
            { skillId: SkillId.Hitpoints, amount: 2000, label: "Hitpoints" },
        ],
        other: ["Access to Mort Myre swamp"],
    },
    rewardItemId: 2963,
    overviewStartText: "helping <col=800000>Drezel</col> bless the Mort Myre swamp.",
    buildJournal(player, services) {
        const stage = getQuestStage(player, natureSpiritQuest);
        if (stage < natureSpiritQuest.startedValue) {
            return buildNotStartedJournal(
                natureSpiritQuest,
                "I can start by talking to Drezel under the temple on the Salve.",
            );
        }
        if (stage >= natureSpiritQuest.completionValue) {
            return buildCompleteJournal([
                "Filliman Tarlock became the Nature Spirit.",
                "Mort Myre swamp is safe to travel once more.",
            ]);
        }
        const reqs: QuestItemRequirement[] = [
            { itemId: 552, quantity: 1, journalLabel: "Ghostspeak amulet" },
            { itemId: 2961, quantity: 1, journalLabel: "Silver sickle" },
        ];
        if (getQuestFlag(player, natureSpiritQuest.key, "blessed_sickle")) {
            return ["The sickle is blessed.", "", "I should tell Drezel."];
        }
        return buildItemProgressJournal(
            player,
            services,
            ["Drezel needs me to bless a silver sickle for the swamp."],
            reqs,
        );
    },
    register(registry): void {
        registerQuestNpcTalk(registry, 9804, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 9804, npcName: "Drezel" };
            const stage = getQuestStage(player, natureSpiritQuest);
            if (stage >= natureSpiritQuest.completionValue) {
                startConversation(ctx, [{ npc: ["The swamp spirit watches over us."] }]);
                return;
            }
            if (getQuestFlag(player, natureSpiritQuest.key, "blessed_sickle")) {
                startConversation(ctx, [
                    { npc: ["The Nature Spirit is restored!"] },
                    { exec: (d) => completeQuest(d.player, d.services, natureSpiritQuest) },
                ]);
                return;
            }
            if (hasItem(player, services, 552) && hasItem(player, services, 2961)) {
                startConversation(ctx, [
                    { npc: ["I'll bless this sickle for the swamp ritual."] },
                    {
                        exec: (d) => {
                            takeQuestItems(d.player, d.services, [
                                { itemId: 2961, quantity: 1, journalLabel: "" },
                            ]);
                            addItemIfMissing(d.player, d.services, 2963, 1);
                            setQuestFlag(d.player, natureSpiritQuest.key, "blessed_sickle", true);
                        },
                    },
                ]);
                return;
            }
            if (stage >= natureSpiritQuest.startedValue) {
                startConversation(ctx, [
                    { npc: ["Bring a ghostspeak amulet and silver sickle to bless the swamp."] },
                ]);
                return;
            }
            if (!isVarpAtLeast(player, PRIEST_IN_PERIL, PRIEST_COMPLETE)) {
                startConversation(ctx, [{ npc: ["Complete Priest in Peril first."] }]);
                return;
            }
            startConversation(ctx, [
                { npc: ["Filliman Tarlock is missing in Mort Myre. Will you help?"] },
                {
                    options: [
                        {
                            text: "I'll help.",
                            next: [
                                { player: ["I'll help."] },
                                {
                                    exec: (d) => {
                                        setQuestStage(
                                            d.player,
                                            natureSpiritQuest,
                                            d.services,
                                            natureSpiritQuest.startedValue,
                                        );
                                        addItemIfMissing(d.player, d.services, 552, 1);
                                        addItemIfMissing(d.player, d.services, 2961, 1);
                                    },
                                },
                            ],
                        },
                        { text: "Not now.", next: [{ player: ["Not now."] }] },
                    ],
                },
            ]);
        });
    },
};

const fishingContestQuest = simpleQuest({
    key: "fishing_contest",
    name: "Fishing Contest",
    varpId: 11,
    startedValue: 1,
    completionValue: 5,
    rewards: {
        questPoints: 1,
        xp: [{ skillId: SkillId.Fishing, amount: 2437, label: "Fishing" }],
    },
    rewardItemId: 25,
    overviewStartText: "entering the <col=800000>Hemenster</col> fishing contest.",
    startNpc: { id: 1351, name: "Seth Groats" },
    startText: "The Hemenster fishing contest needs a champion. Will you enter?",
    startNpcActive: "Catch a giant carp with a red vine worm.",
    steps: [
        {
            npc: { id: 4293, name: "Arnold Lydspor" },
            flag: "got_worm",
            line: "Take this red vine worm for the contest.",
            item: { id: 25 },
        },
    ],
    finishNpc: { id: 1351, name: "Seth Groats" },
    finishText: "You win the fishing contest!",
    journalIntro: "I can start by talking to Seth Groats north of Ardougne.",
    journalDone: ["I entered the Hemenster fishing contest.", "Arnold's red vine worm won me the prize."],
});

const seaSlugQuest: QuestDefinition = {
    key: "sea_slug",
    name: "Sea Slug",
    varpId: 166,
    startedValue: 1,
    completionValue: 12,
    rewards: {
        questPoints: 1,
        xp: [{ skillId: SkillId.Fishing, amount: 7175, label: "Fishing" }],
    },
    rewardItemId: 1466,
    overviewStartText: "investigating the strange <col=800000>sea slug</col> cult.",
    buildJournal(player, _services) {
        const stage = getQuestStage(player, seaSlugQuest);
        if (stage < seaSlugQuest.startedValue) {
            return buildNotStartedJournal(
                seaSlugQuest,
                "I can start by talking to Caroline in Witchaven.",
            );
        }
        if (stage >= seaSlugQuest.completionValue) {
            return buildCompleteJournal([
                "Caroline's husband and son were taken by sea slugs.",
                "I rescued Kennith from the witchaven chapel.",
            ]);
        }
        return [
            "Something is wrong in Witchaven.",
            "",
            strikeIf(getQuestFlag(player, seaSlugQuest.key, "spoke_holgart"), "Caroline needs help finding her family."),
            strikeIf(getQuestFlag(player, seaSlugQuest.key, "found_kennith"), "Holgart can row me to the platform."),
        ];
    },
    register(registry): void {
        registerQuestNpcTalk(registry, 5067, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 5067, npcName: "Caroline" };
            const stage = getQuestStage(player, seaSlugQuest);
            if (stage >= seaSlugQuest.completionValue) {
                startConversation(ctx, [{ npc: ["Kennith is home safe."] }]);
                return;
            }
            if (getQuestFlag(player, seaSlugQuest.key, "found_kennith")) {
                startConversation(ctx, [
                    { npc: ["You saved my son!"] },
                    { exec: (d) => completeQuest(d.player, d.services, seaSlugQuest) },
                ]);
                return;
            }
            if (stage >= seaSlugQuest.startedValue) {
                startConversation(ctx, [{ npc: ["Ask Holgart for a boat to the fishing platform."] }]);
                return;
            }
            startConversation(ctx, [
                { npc: ["My husband and son are missing! Sea slugs are involved!"] },
                {
                    options: [
                        {
                            text: "I'll investigate.",
                            next: [
                                { player: ["I'll investigate."] },
                                {
                                    exec: (d) =>
                                        setQuestStage(d.player, seaSlugQuest, d.services, seaSlugQuest.startedValue),
                                },
                            ],
                        },
                        { text: "Not now.", next: [{ player: ["Not now."] }] },
                    ],
                },
            ]);
        });
        registerQuestNpcTalk(registry, 5071, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 5071, npcName: "Holgart" };
            if (getQuestStage(player, seaSlugQuest) < seaSlugQuest.startedValue) return;
            startConversation(ctx, [
                { exec: (d) => setQuestFlag(d.player, seaSlugQuest.key, "spoke_holgart", true) },
                { npc: ["I'll row you out. Kennith is trapped on the platform!"] },
            ]);
        });
        registerQuestNpcTalk(registry, 5064, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 5064, npcName: "Kennith" };
            if (getQuestStage(player, seaSlugQuest) < seaSlugQuest.startedValue) return;
            startConversation(ctx, [
                { npc: ["Get me out of here!"] },
                { exec: (d) => setQuestFlag(d.player, seaSlugQuest.key, "found_kennith", true) },
            ]);
        });
    },
};

const tribalTotemQuest = simpleQuest({
    key: "tribal_totem",
    name: "Tribal Totem",
    varpId: 200,
    startedValue: 1,
    completionValue: 6,
    rewards: {
        questPoints: 1,
        xp: [{ skillId: SkillId.Thieving, amount: 1775, label: "Thieving" }],
    },
    rewardItemId: 1857,
    overviewStartText: "investigating stolen <col=800000>totems</col> in Ardougne.",
    startNpc: { id: 5315, name: "Horacio" },
    startText: "Sacred totems were stolen from the mansion! Will you investigate?",
    steps: [
        {
            npc: { id: 1206, name: "Clivet" },
            flag: "found_totem",
            line: "We found a totem hidden in the cult cellar. Take it to Horacio.",
            item: { id: 1857 },
        },
    ],
    finishNpc: { id: 5315, name: "Horacio" },
    finishText: "The totem is returned. Well done!",
    journalIntro: "I can start by talking to Horacio in East Ardougne.",
    journalDone: ["Totems were stolen from Lord Handelmort's mansion.", "I recovered a totem from the thieves."],
});

const clockTowerQuest = simpleQuest({
    key: "clock_tower",
    name: "Clock Tower",
    varpId: 10,
    startedValue: 1,
    completionValue: 8,
    rewards: { questPoints: 1 },
    overviewStartText: "repairing the <col=800000>Ardougne Clock Tower</col>.",
    startNpc: { id: 3606, name: "Brother Kojo" },
    startText: "The clock tower mechanism is broken. Can you find the missing parts?",
    steps: [
        {
            npc: { id: 3634, name: "Student" },
            flag: "found_rat",
            line: "A rat took a cog! I saw it run east. Here's a spare cog.",
            item: { id: 23 },
        },
        {
            npc: { id: 3636, name: "Examiner" },
            flag: "found_black",
            line: "The black cog fell in the sewers. Take this one.",
            item: { id: 21 },
        },
    ],
    finishNpc: { id: 3606, name: "Brother Kojo" },
    finishText: "The clock ticks again. Thank you!",
    journalIntro: "I can start by talking to Brother Kojo at the Ardougne Clock Tower.",
    journalDone: ["The clock tower had stopped.", "I found the missing cogs and repaired the clock."],
});

const sheepHerderQuest = simpleQuest({
    key: "sheep_herder",
    name: "Sheep Herder",
    varpId: 60,
    startedValue: 1,
    completionValue: 30,
    rewards: {
        questPoints: 4,
        xp: [{ skillId: SkillId.Herblore, amount: 3100, label: "Herblore" }],
    },
    rewardItemId: 279,
    overviewStartText: "containing a <col=800000>plague</col> among the sheep of Ardougne.",
    startNpc: { id: 3984, name: "Doctor Orbon" },
    startText: "A plague infects the Ardougne sheep! Will you help contain it?",
    steps: [
        {
            npc: { id: 1351, name: "Seth Groats" },
            flag: "got_feed",
            line: "Take this plague poison to treat the sheep.",
            item: { id: 279 },
        },
    ],
    finishNpc: { id: 3984, name: "Doctor Orbon" },
    finishText: "The plague is contained. Excellent work!",
    journalIntro: "I can start by talking to Doctor Orbon in Ardougne.",
    journalDone: ["A plague threatened Ardougne's sheep.", "I helped Doctor Orbon contain the outbreak."],
});

const dwarfCannonQuest: QuestDefinition = {
    key: "dwarf_cannon",
    name: "Dwarf Cannon",
    varpId: 77,
    startedValue: 1,
    completionValue: 11,
    rewards: {
        questPoints: 1,
        xp: [{ skillId: SkillId.Crafting, amount: 750, label: "Crafting" }],
        other: ["Ability to use the dwarf multicannon"],
    },
    rewardItemId: 2,
    overviewStartText: "helping the <col=800000>dwarves</col> repair their cannon.",
    buildJournal(player, _services) {
        const stage = getQuestStage(player, dwarfCannonQuest);
        if (stage < dwarfCannonQuest.startedValue) {
            return buildNotStartedJournal(
                dwarfCannonQuest,
                "I can start by talking to Captain Lawgof north of the Fishing Guild.",
            );
        }
        if (stage >= dwarfCannonQuest.completionValue) {
            return buildCompleteJournal([
                "Goblins were sabotaging the dwarf cannon.",
                "I repaired the cannon and learned to use it.",
            ]);
        }
        return [
            "The dwarven cannon is broken.",
            "",
            strikeIf(getQuestFlag(player, dwarfCannonQuest.key, "spoke_nulodion"), "Captain Lawgof needs help."),
            strikeIf(getQuestFlag(player, dwarfCannonQuest.key, "fixed_cannon"), "Nulodion has the cannon parts."),
        ];
    },
    register(registry): void {
        registerQuestNpcTalk(registry, 5191, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 5191, npcName: "Captain Lawgof" };
            const stage = getQuestStage(player, dwarfCannonQuest);
            if (stage >= dwarfCannonQuest.completionValue) {
                startConversation(ctx, [{ npc: ["The cannon is operational!"] }]);
                return;
            }
            if (getQuestFlag(player, dwarfCannonQuest.key, "fixed_cannon")) {
                startConversation(ctx, [
                    { npc: ["The cannon works! You're a true friend of the dwarves."] },
                    { exec: (d) => completeQuest(d.player, d.services, dwarfCannonQuest) },
                ]);
                return;
            }
            if (stage >= dwarfCannonQuest.startedValue) {
                startConversation(ctx, [{ npc: ["Speak with Nulodion at the cannon workshop."] }]);
                return;
            }
            startConversation(ctx, [
                { npc: ["Goblins broke our cannon! Will you help fix it?"] },
                {
                    options: [
                        {
                            text: "I'll help.",
                            next: [
                                { player: ["I'll help."] },
                                {
                                    exec: (d) =>
                                        setQuestStage(
                                            d.player,
                                            dwarfCannonQuest,
                                            d.services,
                                            dwarfCannonQuest.startedValue,
                                        ),
                                },
                            ],
                        },
                        { text: "Not now.", next: [{ player: ["Not now."] }] },
                    ],
                },
            ]);
        });
        registerQuestNpcTalk(registry, 1400, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 1400, npcName: "Nulodion" };
            if (getQuestStage(player, dwarfCannonQuest) < dwarfCannonQuest.startedValue) return;
            startConversation(ctx, [
                { exec: (d) => {
                    setQuestFlag(d.player, dwarfCannonQuest.key, "spoke_nulodion", true);
                    setQuestFlag(d.player, dwarfCannonQuest.key, "fixed_cannon", true);
                } },
                { npc: ["I've repaired the cannon frame. Tell Lawgof it's ready."] },
            ]);
        });
    },
};

const digSiteQuest = simpleQuest({
    key: "the_dig_site",
    name: "The Dig Site",
    varpId: 131,
    startedValue: 1,
    completionValue: 12,
    rewards: {
        questPoints: 2,
        xp: [{ skillId: SkillId.Herblore, amount: 2000, label: "Herblore" }],
    },
    rewardItemId: 675,
    overviewStartText: "excavating the <col=800000>Archaeological Dig Site</col>.",
    startNpc: { id: 3634, name: "Student" },
    startText: "The dig site exam is today! Will you help me pass?",
    steps: [
        {
            npc: { id: 3636, name: "Examiner" },
            flag: "passed_exam",
            line: "You pass the exam! Here's a rock pick for the dig.",
            item: { id: 675 },
        },
        {
            npc: { id: 3639, name: "Archaeological expert" },
            flag: "found_urn",
            line: "Remarkable! This ancient urn proves your findings.",
            item: { id: 296 },
        },
    ],
    finishNpc: { id: 3634, name: "Student" },
    finishText: "We graduated! The dig site is open to you.",
    journalIntro: "I can start at the Dig Site exam centre.",
    journalDone: ["I passed the dig site exam.", "I uncovered ancient treasures at the excavation."],
});

const holyGrailQuest: QuestDefinition = {
    key: "holy_grail",
    name: "Holy Grail",
    varpId: 5,
    startedValue: 1,
    completionValue: 10,
    rewards: {
        questPoints: 2,
        xp: [
            { skillId: SkillId.Prayer, amount: 11000, label: "Prayer" },
            { skillId: SkillId.Defence, amount: 15300, label: "Defence" },
        ],
        other: ["Access to the Fisher Realm"],
    },
    rewardItemId: 295,
    overviewStartText: "seeking the <col=800000>Holy Grail</col> for King Arthur.",
    buildJournal(player, _services) {
        const stage = getQuestStage(player, holyGrailQuest);
        if (stage < holyGrailQuest.startedValue) {
            return buildNotStartedJournal(
                holyGrailQuest,
                "I can start by talking to King Arthur in Camelot.",
            );
        }
        if (stage >= holyGrailQuest.completionValue) {
            return buildCompleteJournal([
                "King Arthur sought the Holy Grail.",
                "I found the Fisher Realm and returned with Glarial's amulet.",
            ]);
        }
        return [
            "The Holy Grail must be found.",
            "",
            strikeIf(getQuestFlag(player, holyGrailQuest.key, "spoke_fisher_king"), "King Arthur gave me a quest."),
            strikeIf(getQuestFlag(player, holyGrailQuest.key, "has_amulet"), "The Fisher King guards the Grail."),
        ];
    },
    register(registry): void {
        registerQuestNpcTalk(registry, 3531, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 3531, npcName: "King Arthur" };
            const stage = getQuestStage(player, holyGrailQuest);
            if (stage >= holyGrailQuest.completionValue) {
                startConversation(ctx, [{ npc: ["The Grail is found. Camelot is grateful."] }]);
                return;
            }
            if (hasItem(player, services, 295)) {
                startConversation(ctx, [
                    { npc: ["Glarial's amulet! The Grail is ours!"] },
                    { exec: (d) => completeQuest(d.player, d.services, holyGrailQuest) },
                ]);
                return;
            }
            if (stage >= holyGrailQuest.startedValue) {
                startConversation(ctx, [{ npc: ["Seek the Fisher King on Entrana's coast."] }]);
                return;
            }
            startConversation(ctx, [
                { npc: ["Find the Holy Grail for Camelot!"] },
                {
                    options: [
                        {
                            text: "I'll seek the Grail.",
                            next: [
                                { player: ["I'll seek the Grail."] },
                                {
                                    exec: (d) =>
                                        setQuestStage(
                                            d.player,
                                            holyGrailQuest,
                                            d.services,
                                            holyGrailQuest.startedValue,
                                        ),
                                },
                            ],
                        },
                        { text: "Not now.", next: [{ player: ["Not now."] }] },
                    ],
                },
            ]);
        });
        registerQuestNpcTalk(registry, 4066, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 4066, npcName: "The Fisher King" };
            if (getQuestStage(player, holyGrailQuest) < holyGrailQuest.startedValue) return;
            startConversation(ctx, [
                { exec: (d) => setQuestFlag(d.player, holyGrailQuest.key, "spoke_fisher_king", true) },
                { npc: ["Take Glarial's amulet. It will guide you to the Grail."] },
                {
                    exec: (d) => {
                        addItemIfMissing(d.player, d.services, 295, 1);
                        setQuestFlag(d.player, holyGrailQuest.key, "has_amulet", true);
                    },
                },
            ]);
        });
    },
};

const deathPlateauQuest: QuestDefinition = {
    key: "death_plateau",
    name: "Death Plateau",
    varpId: 62,
    startedValue: 1,
    completionValue: 80,
    rewards: {
        questPoints: 1,
        xp: [{ skillId: SkillId.Attack, amount: 3000, label: "Attack" }],
        other: ["Climbing boots"],
    },
    rewardItemId: 3105,
    overviewStartText: "helping the <col=800000>White Knights</col> against the trolls.",
    buildJournal(player, _services) {
        const stage = getQuestStage(player, deathPlateauQuest);
        if (stage < deathPlateauQuest.startedValue) {
            return buildNotStartedJournal(
                deathPlateauQuest,
                "I can start by talking to Denulth in Burthorpe.",
            );
        }
        if (stage >= deathPlateauQuest.completionValue) {
            return buildCompleteJournal([
                "Trolls blocked the path to Death Plateau.",
                "I helped Denulth and rescued Godric.",
            ]);
        }
        return [
            "Trolls threaten Burthorpe.",
            "",
            strikeIf(getQuestFlag(player, deathPlateauQuest.key, "spoke_tenzing"), "Denulth needs a scout."),
            strikeIf(getQuestFlag(player, deathPlateauQuest.key, "rescued_godric"), "Tenzing knows a secret path."),
        ];
    },
    register(registry): void {
        registerQuestNpcTalk(registry, 4083, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 4083, npcName: "Denulth" };
            const stage = getQuestStage(player, deathPlateauQuest);
            if (stage >= deathPlateauQuest.completionValue) {
                startConversation(ctx, [{ npc: ["Burthorpe is safe!"] }]);
                return;
            }
            if (getQuestFlag(player, deathPlateauQuest.key, "rescued_godric")) {
                startConversation(ctx, [
                    { npc: ["Godric is safe! Take these climbing boots."] },
                    { exec: (d) => completeQuest(d.player, d.services, deathPlateauQuest) },
                ]);
                return;
            }
            if (stage >= deathPlateauQuest.startedValue) {
                startConversation(ctx, [{ npc: ["Tenzing can guide you up the plateau."] }]);
                return;
            }
            startConversation(ctx, [
                { npc: ["Trolls block our supply route! Will you help?"] },
                {
                    options: [
                        {
                            text: "I'll help.",
                            next: [
                                { player: ["I'll help."] },
                                {
                                    exec: (d) =>
                                        setQuestStage(
                                            d.player,
                                            deathPlateauQuest,
                                            d.services,
                                            deathPlateauQuest.startedValue,
                                        ),
                                },
                            ],
                        },
                        { text: "Not now.", next: [{ player: ["Not now."] }] },
                    ],
                },
            ]);
        });
        registerQuestNpcTalk(registry, 4094, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 4094, npcName: "Tenzing" };
            if (getQuestStage(player, deathPlateauQuest) < deathPlateauQuest.startedValue) return;
            startConversation(ctx, [
                { exec: (d) => setQuestFlag(d.player, deathPlateauQuest.key, "spoke_tenzing", true) },
                { npc: ["Godric is trapped on the plateau. Hurry!"] },
            ]);
        });
        registerQuestNpcTalk(registry, 4119, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 4119, npcName: "Godric" };
            if (getQuestStage(player, deathPlateauQuest) < deathPlateauQuest.startedValue) return;
            startConversation(ctx, [
                { npc: ["Thank you! Let's get down from here!"] },
                { exec: (d) => setQuestFlag(d.player, deathPlateauQuest.key, "rescued_godric", true) },
            ]);
        });
    },
};

const touristTrapQuest: QuestDefinition = {
    key: "the_tourist_trap",
    name: "The Tourist Trap",
    varpId: 197,
    startedValue: 1,
    completionValue: 19,
    rewards: {
        questPoints: 2,
        xp: [
            { skillId: SkillId.Agility, amount: 4650, label: "Agility" },
            { skillId: SkillId.Smithing, amount: 4650, label: "Smithing" },
        ],
        other: ["Ability to smith dart tips"],
    },
    rewardItemId: 2347,
    overviewStartText: "rescuing <col=800000>Ana</col> from the desert mining camp.",
    buildJournal(player, _services) {
        const stage = getQuestStage(player, touristTrapQuest);
        if (stage < touristTrapQuest.startedValue) {
            return buildNotStartedJournal(
                touristTrapQuest,
                "I can start by talking to Irena south of Shantay Pass.",
            );
        }
        if (stage >= touristTrapQuest.completionValue) {
            return buildCompleteJournal([
                "Ana was kidnapped by desert mercenaries.",
                "I smuggled her out of the mining camp.",
            ]);
        }
        return [
            "Ana is missing in the desert.",
            "",
            strikeIf(getQuestFlag(player, touristTrapQuest.key, "spoke_shantay"), "Irena needs help."),
            strikeIf(getQuestFlag(player, touristTrapQuest.key, "freed_ana"), "Shantay can get me into the desert."),
        ];
    },
    register(registry): void {
        registerQuestNpcTalk(registry, 6233, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 6233, npcName: "Irena" };
            const stage = getQuestStage(player, touristTrapQuest);
            if (stage >= touristTrapQuest.completionValue) {
                startConversation(ctx, [{ npc: ["Ana is home!"] }]);
                return;
            }
            if (getQuestFlag(player, touristTrapQuest.key, "freed_ana")) {
                startConversation(ctx, [
                    { npc: ["You brought Ana back!"] },
                    { exec: (d) => completeQuest(d.player, d.services, touristTrapQuest) },
                ]);
                return;
            }
            if (stage >= touristTrapQuest.startedValue) {
                startConversation(ctx, [{ npc: ["Talk to Shantay at the pass."] }]);
                return;
            }
            startConversation(ctx, [
                { npc: ["My daughter Ana disappeared in the desert!"] },
                {
                    options: [
                        {
                            text: "I'll find her.",
                            next: [
                                { player: ["I'll find her."] },
                                {
                                    exec: (d) =>
                                        setQuestStage(
                                            d.player,
                                            touristTrapQuest,
                                            d.services,
                                            touristTrapQuest.startedValue,
                                        ),
                                },
                            ],
                        },
                        { text: "Not now.", next: [{ player: ["Not now."] }] },
                    ],
                },
            ]);
        });
        registerQuestNpcTalk(registry, 4642, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 4642, npcName: "Shantay" };
            if (getQuestStage(player, touristTrapQuest) < touristTrapQuest.startedValue) return;
            startConversation(ctx, [
                { exec: (d) => setQuestFlag(d.player, touristTrapQuest.key, "spoke_shantay", true) },
                { npc: ["Ana is held at the mining camp. Captain Siad runs it."] },
            ]);
        });
        registerQuestNpcTalk(registry, 6231, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 6231, npcName: "Ana" };
            if (getQuestStage(player, touristTrapQuest) < touristTrapQuest.startedValue) return;
            startConversation(ctx, [
                { npc: ["Get me out of this barrel!"] },
                { exec: (d) => setQuestFlag(d.player, touristTrapQuest.key, "freed_ana", true) },
            ]);
        });
    },
};

const witchsHouseQuest: QuestDefinition = {
    key: "witchs_house",
    name: "Witch's House",
    varpId: 226,
    startedValue: 1,
    completionValue: 7,
    rewards: {
        questPoints: 4,
        xp: [{ skillId: SkillId.Hitpoints, amount: 6325, label: "Hitpoints" }],
    },
    rewardItemId: 2407,
    overviewStartText: "investigating the strange house in <col=800000>Taverley</col>.",
    buildJournal(player, _services) {
        const stage = getQuestStage(player, witchsHouseQuest);
        if (stage < witchsHouseQuest.startedValue) {
            return buildNotStartedJournal(
                witchsHouseQuest,
                "I can start by talking to the boy in Taverley.",
            );
        }
        if (stage >= witchsHouseQuest.completionValue) {
            return buildCompleteJournal([
                "A boy's ball was lost in the witch's garden.",
                "I defeated the witch's experiment and returned the ball.",
            ]);
        }
        return [
            "Something sinister lives in the witch's house.",
            "",
            strikeIf(getQuestFlag(player, witchsHouseQuest.key, "got_key"), "The boy wants his ball back."),
            strikeIf(getQuestFlag(player, witchsHouseQuest.key, "defeated_experiment"), "The witch has a house key."),
        ];
    },
    register(registry): void {
        registerQuestNpcTalk(registry, 3994, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 3994, npcName: "Boy" };
            const stage = getQuestStage(player, witchsHouseQuest);
            if (stage >= witchsHouseQuest.completionValue) {
                startConversation(ctx, [{ npc: ["Thanks for getting my ball back!"] }]);
                return;
            }
            if (getQuestFlag(player, witchsHouseQuest.key, "defeated_experiment")) {
                startConversation(ctx, [
                    { npc: ["You got my ball! You're amazing!"] },
                    { exec: (d) => completeQuest(d.player, d.services, witchsHouseQuest) },
                ]);
                return;
            }
            if (stage >= witchsHouseQuest.startedValue) {
                startConversation(ctx, [{ npc: ["The witch won't give me my ball back!"] }]);
                return;
            }
            startConversation(ctx, [
                { npc: ["A witch stole my ball! Will you get it back?"] },
                {
                    options: [
                        {
                            text: "I'll help.",
                            next: [
                                { player: ["I'll help."] },
                                {
                                    exec: (d) =>
                                        setQuestStage(
                                            d.player,
                                            witchsHouseQuest,
                                            d.services,
                                            witchsHouseQuest.startedValue,
                                        ),
                                },
                            ],
                        },
                        { text: "Not now.", next: [{ player: ["Not now."] }] },
                    ],
                },
            ]);
        });
        registerQuestNpcTalk(registry, 4410, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 4410, npcName: "Witch" };
            if (getQuestStage(player, witchsHouseQuest) < witchsHouseQuest.startedValue) return;
            if (!getQuestFlag(player, witchsHouseQuest.key, "got_key")) {
                startConversation(ctx, [
                    { npc: ["Fine, take the key. My experiment will stop you!"] },
                    {
                        exec: (d) => {
                            addItemIfMissing(d.player, d.services, 2411, 1);
                            setQuestFlag(d.player, witchsHouseQuest.key, "got_key", true);
                        },
                    },
                ]);
                return;
            }
            startConversation(ctx, [
                { npc: ["My experiment is defeated. Take the ball and go."] },
                { exec: (d) => setQuestFlag(d.player, witchsHouseQuest.key, "defeated_experiment", true) },
            ]);
        });
    },
};

const hazeelCultQuest: QuestDefinition = {
    key: "hazeel_cult",
    name: "Hazeel Cult",
    varpId: 223,
    startedValue: 1,
    completionValue: 9,
    rewards: { questPoints: 1, xp: [{ skillId: SkillId.Thieving, amount: 1500, label: "Thieving" }] },
    rewardItemId: 2406,
    overviewStartText: "investigating the <col=800000>Hazeel Cult</col> in Ardougne.",
    buildJournal(player, _services) {
        const stage = getQuestStage(player, hazeelCultQuest);
        if (stage < hazeelCultQuest.startedValue) {
            return buildNotStartedJournal(
                hazeelCultQuest,
                "I can start by talking to Clivet in East Ardougne.",
            );
        }
        if (stage >= hazeelCultQuest.completionValue) {
            return buildCompleteJournal([
                "The Hazeel Cult plotted in Ardougne's sewers.",
                "I stopped their ritual and recovered Hazeel's mark.",
            ]);
        }
        return [
            "A cult worships the demon Hazeel.",
            "",
            strikeIf(getQuestFlag(player, hazeelCultQuest.key, "spoke_alomone"), "Clivet recruited me."),
            strikeIf(getQuestFlag(player, hazeelCultQuest.key, "stopped_ritual"), "Alomone leads the cult."),
        ];
    },
    register(registry): void {
        registerQuestNpcTalk(registry, 1206, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 1206, npcName: "Clivet" };
            const stage = getQuestStage(player, hazeelCultQuest);
            if (stage >= hazeelCultQuest.completionValue) {
                startConversation(ctx, [{ npc: ["The cult is finished."] }]);
                return;
            }
            if (getQuestFlag(player, hazeelCultQuest.key, "stopped_ritual")) {
                startConversation(ctx, [
                    { npc: ["You stopped Hazeel. Here is your reward."] },
                    { exec: (d) => completeQuest(d.player, d.services, hazeelCultQuest) },
                ]);
                return;
            }
            if (stage >= hazeelCultQuest.startedValue) {
                startConversation(ctx, [{ npc: ["Find Alomone in the cult headquarters."] }]);
                return;
            }
            startConversation(ctx, [
                { npc: ["Join us or oppose the Hazeel Cult!"] },
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
                                            hazeelCultQuest,
                                            d.services,
                                            hazeelCultQuest.startedValue,
                                        ),
                                },
                            ],
                        },
                        { text: "Not now.", next: [{ player: ["Not now."] }] },
                    ],
                },
            ]);
        });
        registerQuestNpcTalk(registry, 1204, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 1204, npcName: "Alomone" };
            if (getQuestStage(player, hazeelCultQuest) < hazeelCultQuest.startedValue) return;
            startConversation(ctx, [
                { exec: (d) => setQuestFlag(d.player, hazeelCultQuest.key, "spoke_alomone", true) },
                { npc: ["You cannot stop Lord Hazeel's return! ...or can you?"] },
                {
                    exec: (d) => {
                        addItemIfMissing(d.player, d.services, 2406, 1);
                        setQuestFlag(d.player, hazeelCultQuest.key, "stopped_ritual", true);
                    },
                },
            ]);
        });
    },
};

const FAMILY_CREST_PARTS = [
    { npcId: 4986, name: "Caleb", itemId: 782, flag: "caleb_crest" },
    { npcId: 4983, name: "Avan", itemId: 782, flag: "avan_crest" },
    { npcId: 4985, name: "Boot", itemId: 782, flag: "boot_crest" },
    { npcId: 4988, name: "Johnathon", itemId: 782, flag: "johnathon_crest" },
];

const familyCrestQuest: QuestDefinition = {
    key: "family_crest",
    name: "Family Crest",
    varpId: 148,
    startedValue: 1,
    completionValue: 11,
    rewards: {
        questPoints: 2,
        xp: [
            { skillId: SkillId.Magic, amount: 5000, label: "Magic" },
            { skillId: SkillId.Mining, amount: 5000, label: "Mining" },
            { skillId: SkillId.Smithing, amount: 5000, label: "Smithing" },
        ],
        other: ["Family gauntlets (choose skill bonus)"],
    },
    rewardItemId: 782,
    overviewStartText: "recovering the <col=800000>Family Crest</col> for Dimintheis.",
    buildJournal(player, _services) {
        const stage = getQuestStage(player, familyCrestQuest);
        if (stage < familyCrestQuest.startedValue) {
            return buildNotStartedJournal(
                familyCrestQuest,
                "I can start by talking to Dimintheis in Varrock.",
            );
        }
        if (stage >= familyCrestQuest.completionValue) {
            return buildCompleteJournal([
                "Dimintheis's family crest was split among his sons.",
                "I reunited the crest pieces.",
            ]);
        }
        return [
            "The Fitzharmony crest is in pieces.",
            "",
            ...FAMILY_CREST_PARTS.map((p) =>
                strikeIf(getQuestFlag(player, familyCrestQuest.key, p.flag), `I must speak with ${p.name}.`),
            ),
        ];
    },
    register(registry): void {
        registerQuestNpcTalk(registry, 4984, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 4984, npcName: "Dimintheis" };
            const stage = getQuestStage(player, familyCrestQuest);
            if (stage >= familyCrestQuest.completionValue) {
                startConversation(ctx, [{ npc: ["The crest is whole again!"] }]);
                return;
            }
            const allParts = FAMILY_CREST_PARTS.every((p) => getQuestFlag(player, familyCrestQuest.key, p.flag));
            if (allParts) {
                startConversation(ctx, [
                    { npc: ["You found every piece! The crest is restored."] },
                    { exec: (d) => completeQuest(d.player, d.services, familyCrestQuest) },
                ]);
                return;
            }
            if (stage >= familyCrestQuest.startedValue) {
                startConversation(ctx, [{ npc: ["My sons each hold a piece of the crest."] }]);
                return;
            }
            startConversation(ctx, [
                { npc: ["Thieves stole my family crest! Will you recover it?"] },
                {
                    options: [
                        {
                            text: "I'll recover it.",
                            next: [
                                { player: ["I'll recover it."] },
                                {
                                    exec: (d) =>
                                        setQuestStage(
                                            d.player,
                                            familyCrestQuest,
                                            d.services,
                                            familyCrestQuest.startedValue,
                                        ),
                                },
                            ],
                        },
                        { text: "Not now.", next: [{ player: ["Not now."] }] },
                    ],
                },
            ]);
        });
        for (const part of FAMILY_CREST_PARTS) {
            registerQuestNpcTalk(registry, part.npcId, ({ player, services }) => {
                const ctx: DialogueContext = {
                    player,
                    services,
                    npcId: part.npcId,
                    npcName: part.name,
                };
                if (getQuestStage(player, familyCrestQuest) < familyCrestQuest.startedValue) return;
                if (getQuestFlag(player, familyCrestQuest.key, part.flag)) {
                    startConversation(ctx, [{ npc: ["I already gave you my piece."] }]);
                    return;
                }
                startConversation(ctx, [
                    { npc: ["Take this piece of the family crest."] },
                    {
                        exec: (d) => {
                            setQuestFlag(d.player, familyCrestQuest.key, part.flag, true);
                        },
                    },
                ]);
            });
        }
    },
};

const templeOfIkovQuest: QuestDefinition = {
    key: "temple_of_ikov",
    name: "Temple of Ikov",
    varpId: 26,
    startedValue: 1,
    completionValue: 90,
    rewards: {
        questPoints: 2,
        xp: [
            { skillId: SkillId.Ranged, amount: 10500, label: "Ranged" },
            { skillId: SkillId.Fletching, amount: 8000, label: "Fletching" },
        ],
        other: ["Yew shortbow or Armadyl pendant"],
    },
    rewardItemId: 87,
    overviewStartText: "investigating the <col=800000>Temple of Ikov</col>.",
    buildJournal(player, _services) {
        const stage = getQuestStage(player, templeOfIkovQuest);
        if (stage < templeOfIkovQuest.startedValue) {
            return buildNotStartedJournal(
                templeOfIkovQuest,
                "I can start by talking to Lucien in the Ardougne Tavern.",
            );
        }
        if (stage >= templeOfIkovQuest.completionValue) {
            return buildCompleteJournal([
                "Lucien sought the Staff of Armadyl.",
                "I sided with the Guardians and stopped him.",
            ]);
        }
        return [
            "Lucien wants the Staff of Armadyl.",
            "",
            strikeIf(getQuestFlag(player, templeOfIkovQuest.key, "spoke_guardian"), "Lucien hired me."),
            strikeIf(getQuestFlag(player, templeOfIkovQuest.key, "got_staff"), "The Guardians protect the staff."),
        ];
    },
    register(registry): void {
        registerQuestNpcTalk(registry, 3443, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 3443, npcName: "Lucien" };
            const stage = getQuestStage(player, templeOfIkovQuest);
            if (stage >= templeOfIkovQuest.completionValue) {
                startConversation(ctx, [{ npc: ["Curse you!"] }]);
                return;
            }
            if (stage >= templeOfIkovQuest.startedValue) {
                startConversation(ctx, [{ npc: ["Get the staff from the temple!"] }]);
                return;
            }
            startConversation(ctx, [
                { npc: ["Retrieve the Staff of Armadyl from the Temple of Ikov!"] },
                {
                    options: [
                        {
                            text: "I'll do it.",
                            next: [
                                { player: ["I'll do it."] },
                                {
                                    exec: (d) =>
                                        setQuestStage(
                                            d.player,
                                            templeOfIkovQuest,
                                            d.services,
                                            templeOfIkovQuest.startedValue,
                                        ),
                                },
                            ],
                        },
                        { text: "Not now.", next: [{ player: ["Not now."] }] },
                    ],
                },
            ]);
        });
        registerQuestNpcTalk(registry, 3446, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 3446, npcName: "Guardian of Armadyl" };
            if (getQuestStage(player, templeOfIkovQuest) < templeOfIkovQuest.startedValue) return;
            if (getQuestStage(player, templeOfIkovQuest) >= templeOfIkovQuest.completionValue) return;
            startConversation(ctx, [
                { exec: (d) => setQuestFlag(d.player, templeOfIkovQuest.key, "spoke_guardian", true) },
                { npc: ["Lucien is evil! Stop him from taking the staff."] },
                {
                    exec: (d) => {
                        setQuestFlag(d.player, templeOfIkovQuest.key, "got_staff", true);
                        completeQuest(d.player, d.services, templeOfIkovQuest);
                    },
                },
            ]);
        });
    },
};

const observatoryQuest = simpleQuest({
    key: "observatory_quest",
    name: "Observatory Quest",
    varpId: 112,
    startedValue: 1,
    completionValue: 9,
    rewards: {
        questPoints: 2,
        xp: [
            { skillId: SkillId.Crafting, amount: 2250, label: "Crafting" },
            { skillId: SkillId.Agility, amount: 2250, label: "Agility" },
        ],
    },
    rewardItemId: 4808,
    overviewStartText: "helping the <col=800000>Observatory</col> professor.",
    startNpc: { id: 6403, name: "Observatory professor" },
    startText: "Goblins stole my lens! Will you recover it?",
    steps: [
        {
            npc: { id: 5365, name: "Observatory assistant" },
            flag: "found_lens",
            line: "I found the lens piece in the goblin camp.",
            item: { id: 4808 },
        },
    ],
    finishNpc: { id: 6403, name: "Observatory professor" },
    finishText: "The stars are visible again!",
    journalIntro: "I can start at the Observatory north of Castle Wars.",
    journalDone: ["Goblins stole the observatory lens.", "I recovered it and restored the telescope."],
});

const monkeyMadnessQuest: QuestDefinition = {
    key: "monkey_madness_i",
    name: "Monkey Madness I",
    varpId: 365,
    startedValue: 1,
    completionValue: 90,
    rewards: {
        questPoints: 3,
        xp: [
            { skillId: SkillId.Attack, amount: 35000, label: "Attack" },
            { skillId: SkillId.Defence, amount: 35000, label: "Defence" },
            { skillId: SkillId.Strength, amount: 35000, label: "Strength" },
            { skillId: SkillId.Hitpoints, amount: 35000, label: "Hitpoints" },
        ],
        other: ["Access to Ape Atoll"],
    },
    rewardItemId: 3179,
    overviewStartText: "investigating the mysterious <col=800000>ape</col> at the Grand Tree.",
    buildJournal(player, _services) {
        const stage = getQuestStage(player, monkeyMadnessQuest);
        if (stage < monkeyMadnessQuest.startedValue) {
            return buildNotStartedJournal(
                monkeyMadnessQuest,
                "I can start by talking to King Narnode Shareen after The Grand Tree.",
            );
        }
        if (stage >= monkeyMadnessQuest.completionValue) {
            return buildCompleteJournal([
                "Glough's monkeys were amassing on Ape Atoll.",
                "I infiltrated Marim and defeated the jungle demon.",
            ]);
        }
        return [
            "Ape Atoll threatens the gnomes.",
            "",
            strikeIf(getQuestFlag(player, monkeyMadnessQuest.key, "spoke_daero"), "King Narnode needs an envoy."),
            strikeIf(getQuestFlag(player, monkeyMadnessQuest.key, "spoke_garkor"), "Daero will smuggle me to the island."),
            strikeIf(getQuestFlag(player, monkeyMadnessQuest.key, "spoke_zooknock"), "Garkor's squad awaits in Marim."),
            strikeIf(getQuestFlag(player, monkeyMadnessQuest.key, "defeated_demon"), "Zooknock can make monkey greegree."),
        ];
    },
    register(registry): void {
        registerQuestNpcTalk(registry, 1423, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 1423, npcName: "King Narnode Shareen" };
            const stage = getQuestStage(player, monkeyMadnessQuest);
            if (stage >= monkeyMadnessQuest.completionValue) {
                startConversation(ctx, [{ npc: ["Ape Atoll is safe for now."] }]);
                return;
            }
            if (getQuestFlag(player, monkeyMadnessQuest.key, "defeated_demon")) {
                startConversation(ctx, [
                    { npc: ["You've saved us from the monkeys!"] },
                    { exec: (d) => completeQuest(d.player, d.services, monkeyMadnessQuest) },
                ]);
                return;
            }
            if (stage >= monkeyMadnessQuest.startedValue) {
                startConversation(ctx, [{ npc: ["Speak with Daero on the top floor."] }]);
                return;
            }
            if (!isVarpAtLeast(player, GRAND_TREE, GRAND_TREE_COMPLETE)) {
                startConversation(ctx, [{ npc: ["Complete The Grand Tree first."] }]);
                return;
            }
            startConversation(ctx, [
                { npc: ["Strange monkeys gather on Ape Atoll! Will you investigate?"] },
                {
                    options: [
                        {
                            text: "I'll go.",
                            next: [
                                { player: ["I'll go."] },
                                {
                                    exec: (d) =>
                                        setQuestStage(
                                            d.player,
                                            monkeyMadnessQuest,
                                            d.services,
                                            monkeyMadnessQuest.startedValue,
                                        ),
                                },
                            ],
                        },
                        { text: "Not now.", next: [{ player: ["Not now."] }] },
                    ],
                },
            ]);
        });
        registerQuestNpcTalk(registry, 2020, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 2020, npcName: "Daero" };
            if (getQuestStage(player, monkeyMadnessQuest) < monkeyMadnessQuest.startedValue) return;
            startConversation(ctx, [
                { exec: (d) => setQuestFlag(d.player, monkeyMadnessQuest.key, "spoke_daero", true) },
                { npc: ["I'll fly you to Ape Atoll. Find Garkor's squad."] },
            ]);
        });
        registerQuestNpcTalk(registry, 1456, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 1456, npcName: "Garkor" };
            if (getQuestStage(player, monkeyMadnessQuest) < monkeyMadnessQuest.startedValue) return;
            startConversation(ctx, [
                { exec: (d) => setQuestFlag(d.player, monkeyMadnessQuest.key, "spoke_garkor", true) },
                { npc: ["Zooknock can disguise you. Find him in the temple."] },
            ]);
        });
        registerQuestNpcTalk(registry, 1458, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 1458, npcName: "Zooknock" };
            if (getQuestStage(player, monkeyMadnessQuest) < monkeyMadnessQuest.startedValue) return;
            startConversation(ctx, [
                { exec: (d) => setQuestFlag(d.player, monkeyMadnessQuest.key, "spoke_zooknock", true) },
                { npc: ["Take this greegree. Defeat the demon and return to the King!"] },
                {
                    exec: (d) => {
                        addItemIfMissing(d.player, d.services, 3179, 1);
                        setQuestFlag(d.player, monkeyMadnessQuest.key, "defeated_demon", true);
                    },
                },
            ]);
        });
    },
};

const elementalWorkshopQuest = simpleQuest({
    key: "elemental_workshop_i",
    name: "Elemental Workshop I",
    varpId: 75,
    startedValue: 1,
    completionValue: 6,
    rewards: {
        questPoints: 1,
        xp: [
            { skillId: SkillId.Smithing, amount: 5000, label: "Smithing" },
            { skillId: SkillId.Crafting, amount: 5000, label: "Crafting" },
        ],
        other: ["Ability to smith elemental equipment"],
    },
    rewardItemId: 2892,
    overviewStartText: "exploring the <col=800000>Elemental Workshop</col>.",
    startNpc: { id: 3639, name: "Archaeological expert" },
    startText: "A hidden workshop lies beneath Seers' Village! Will you explore it?",
    steps: [
        {
            npc: { id: 3634, name: "Student" },
            flag: "found_book",
            line: "This book explains the elemental ore. Take some ore.",
            item: { id: 2892 },
        },
    ],
    finishNpc: { id: 3639, name: "Archaeological expert" },
    finishText: "Elemental smithing is unlocked!",
    journalIntro: "I can start by talking to the archaeological expert.",
    journalDone: ["An elemental workshop was hidden below Seers' Village.", "I learned to smith elemental bars."],
});

const undergroundPassQuest: QuestDefinition = {
    key: "underground_pass",
    name: "Underground Pass",
    varpId: 161,
    startedValue: 1,
    completionValue: 110,
    rewards: {
        questPoints: 2,
        xp: [
            { skillId: SkillId.Agility, amount: 3000, label: "Agility" },
            { skillId: SkillId.Attack, amount: 3000, label: "Attack" },
        ],
        other: ["Iban Blast spell"],
    },
    rewardItemId: 87,
    overviewStartText: "braving the dangers of the <col=800000>Underground Pass</col>.",
    buildJournal(player, _services) {
        const stage = getQuestStage(player, undergroundPassQuest);
        if (stage < undergroundPassQuest.startedValue) {
            return buildNotStartedJournal(
                undergroundPassQuest,
                "I can start by talking to Edmond after completing Biohazard.",
            );
        }
        if (stage >= undergroundPassQuest.completionValue) {
            return buildCompleteJournal([
                "King Lathas sent me through the Underground Pass.",
                "I defeated Iban and claimed his staff.",
            ]);
        }
        return [
            "The Underground Pass leads to West Ardougne.",
            "",
            strikeIf(getQuestFlag(player, undergroundPassQuest.key, "entered_pass"), "Edmond knows about the pass."),
            strikeIf(getQuestFlag(player, undergroundPassQuest.key, "defeated_iban"), "I must traverse the pass."),
        ];
    },
    register(registry): void {
        registerQuestNpcTalk(registry, 6204, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 6204, npcName: "Edmond" };
            if (getQuestStage(player, undergroundPassQuest) >= undergroundPassQuest.completionValue) return;
            // King Lathas not spawned — use King Roald as alternate start after biohazard
            if (!isVarpAtLeast(player, 68, 16)) return;
            const stage = getQuestStage(player, undergroundPassQuest);
            if (stage >= undergroundPassQuest.completionValue) return;
            if (getQuestFlag(player, undergroundPassQuest.key, "defeated_iban")) {
                startConversation(ctx, [
                    { npc: ["Iban is defeated. The pass is clear."] },
                    { exec: (d) => completeQuest(d.player, d.services, undergroundPassQuest) },
                ]);
                return;
            }
            if (stage >= undergroundPassQuest.startedValue) {
                startConversation(ctx, [{ npc: ["Brave the pass and destroy Iban."] }]);
                return;
            }
            startConversation(ctx, [
                { npc: ["The Underground Pass must be cleared of Iban's evil!"] },
                {
                    options: [
                        {
                            text: "I'll enter the pass.",
                            next: [
                                { player: ["I'll enter the pass."] },
                                {
                                    exec: (d) => {
                                        setQuestStage(
                                            d.player,
                                            undergroundPassQuest,
                                            d.services,
                                            undergroundPassQuest.startedValue,
                                        );
                                        setQuestFlag(d.player, undergroundPassQuest.key, "entered_pass", true);
                                    },
                                },
                            ],
                        },
                        { text: "Not now.", next: [{ player: ["Not now."] }] },
                    ],
                },
            ]);
        });
        registerQuestNpcTalk(registry, 3443, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 3443, npcName: "Lucien" };
            if (getQuestStage(player, undergroundPassQuest) < undergroundPassQuest.startedValue) return;
            if (getQuestFlag(player, undergroundPassQuest.key, "defeated_iban")) return;
            startConversation(ctx, [
                { npc: ["Iban's spirit is broken. Take his staff."] },
                {
                    exec: (d) => setQuestFlag(d.player, undergroundPassQuest.key, "defeated_iban", true),
                },
            ]);
        });
    },
};

export const membersQuestPack2: QuestDefinition[] = [
    watchtowerQuest,
    grandTreeQuest,
    fightArenaQuest,
    natureSpiritQuest,
    fishingContestQuest,
    seaSlugQuest,
    tribalTotemQuest,
    clockTowerQuest,
    sheepHerderQuest,
    dwarfCannonQuest,
    digSiteQuest,
    holyGrailQuest,
    deathPlateauQuest,
    touristTrapQuest,
    witchsHouseQuest,
    hazeelCultQuest,
    familyCrestQuest,
    templeOfIkovQuest,
    observatoryQuest,
    monkeyMadnessQuest,
    elementalWorkshopQuest,
    undergroundPassQuest,
];
