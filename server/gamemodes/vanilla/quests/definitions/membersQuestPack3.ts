import { SkillId } from "../../../../../src/rs/skill/skills";
import type { IScriptRegistry } from "../../../../../src/game/scripts/types";
import { getQuestFlag, setQuestFlag } from "../QuestFlags";
import { completeQuest, getQuestStage, setQuestStage } from "../QuestService";
import { type DialogueContext, startConversation } from "../dialogue";
import {
    buildCompleteJournal,
    buildNotStartedJournal,
    registerQuestNpcTalk,
    strikeIf,
} from "../helpers";
import type { QuestDefinition } from "../types";
import { simpleQuest } from "./questFactory";
import { addItemIfMissing, isVarpAtLeast } from "./questUtils";

const DEATH_PLATEAU = 62;
const DEATH_PLATEAU_DONE = 80;
const TROLL_STRONGHOLD = 317;
const TROLL_STRONGHOLD_DONE = 90;
const PRIEST_IN_PERIL = 302;
const PRIEST_DONE = 60;
const UNDERGROUND_PASS = 161;
const UNDERGROUND_DONE = 110;

const heroesQuest = simpleQuest({
    key: "heroes_quest",
    name: "Heroes' Quest",
    varpId: 188,
    startedValue: 1,
    completionValue: 3,
    rewards: { questPoints: 1, other: ["Access to the Heroes' Guild"] },
    rewardItemId: 1580,
    overviewStartText: "joining the ranks of the <col=800000>Heroes' Guild</col>.",
    startNpc: { id: 4923, name: "Achietties" },
    startText: "Only a hero may enter our guild. Prove yourself!",
    startNpcActive: "Gather what the guild masters require.",
    steps: [
        { npc: { id: 4924, name: "Helemos" }, flag: "helemos", line: "Take this lava scale.", item: { id: 11992 } },
        { npc: { id: 2891, name: "Gerrant" }, flag: "gerrant", line: "Here's the fish food.", item: { id: 272 } },
        { npc: { id: 5232, name: "Thormac" }, flag: "thormac", line: "Take my enchanted gloves.", item: { id: 776 } },
    ],
    finishNpc: { id: 4923, name: "Achietties" },
    finishText: "Welcome to the Heroes' Guild!",
    journalIntro: "I can start at the Heroes' Guild in Burthorpe.",
    journalDone: ["Achietties tested my worth.", "I gathered the guild masters' items."],
});

const trollStrongholdQuest: QuestDefinition = {
    key: "troll_stronghold",
    name: "Troll Stronghold",
    varpId: TROLL_STRONGHOLD,
    startedValue: 1,
    completionValue: TROLL_STRONGHOLD_DONE,
    rewards: {
        questPoints: 1,
        xp: [
            { skillId: SkillId.Strength, amount: 10000, label: "Strength" },
            { skillId: SkillId.Attack, amount: 10000, label: "Attack" },
        ],
        other: ["Access to Trollheim"],
    },
    rewardItemId: 3105,
    overviewStartText: "rescuing Godric from the <col=800000>Troll Stronghold</col>.",
    buildJournal(player, _services) {
        const stage = getQuestStage(player, trollStrongholdQuest);
        if (stage < trollStrongholdQuest.startedValue) {
            return buildNotStartedJournal(trollStrongholdQuest, "I can start with Eadgar after Death Plateau.");
        }
        if (stage >= trollStrongholdQuest.completionValue) {
            return buildCompleteJournal(["Godric was prisoner of the trolls.", "Eadgar helped me free him."]);
        }
        return [
            "Godric is held in the troll stronghold.",
            "",
            strikeIf(getQuestFlag(player, trollStrongholdQuest.key, "spoke_eadgar"), "Eadgar knows a secret path."),
            strikeIf(getQuestFlag(player, trollStrongholdQuest.key, "freed_godric"), "I must enter the stronghold."),
        ];
    },
    register(registry: IScriptRegistry) {
        registerQuestNpcTalk(registry, 4118, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 4118, npcName: "Eadgar" };
            const stage = getQuestStage(player, trollStrongholdQuest);
            if (stage >= trollStrongholdQuest.completionValue) {
                startConversation(ctx, [{ npc: ["Trollheim is open to you."] }]);
                return;
            }
            if (getQuestFlag(player, trollStrongholdQuest.key, "freed_godric")) {
                startConversation(ctx, [
                    { npc: ["Godric is free!"] },
                    { exec: (d) => completeQuest(d.player, d.services, trollStrongholdQuest) },
                ]);
                return;
            }
            if (stage >= trollStrongholdQuest.startedValue) {
                startConversation(ctx, [{ npc: ["Find Godric inside the stronghold."] }]);
                return;
            }
            if (!isVarpAtLeast(player, DEATH_PLATEAU, DEATH_PLATEAU_DONE)) {
                startConversation(ctx, [{ npc: ["Complete Death Plateau first."] }]);
                return;
            }
            startConversation(ctx, [
                { npc: ["Godric is captured! I'll disguise you to get inside."] },
                {
                    options: [
                        {
                            text: "I'll rescue Godric.",
                            next: [
                                { player: ["I'll rescue Godric."] },
                                {
                                    exec: (d) => {
                                        setQuestStage(d.player, trollStrongholdQuest, d.services, 1);
                                        setQuestFlag(d.player, trollStrongholdQuest.key, "spoke_eadgar", true);
                                    },
                                },
                            ],
                        },
                        { text: "Not now.", next: [{ player: ["Not now."] }] },
                    ],
                },
            ]);
        });
        registerQuestNpcTalk(registry, 4119, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 4119, npcName: "Godric" };
            if (getQuestStage(player, trollStrongholdQuest) < 1) return;
            if (getQuestStage(player, trollStrongholdQuest) >= trollStrongholdQuest.completionValue) {
                startConversation(ctx, [{ npc: ["I'll never forget what you did for me."] }]);
                return;
            }
            startConversation(ctx, [
                { npc: ["You found me! Let's escape!"] },
                { exec: (d) => setQuestFlag(d.player, trollStrongholdQuest.key, "freed_godric", true) },
            ]);
        });
    },
};

const eadgarsRuseQuest = simpleQuest({
    key: "eadgars_ruse",
    name: "Eadgar's Ruse",
    varpId: 335,
    startedValue: 1,
    completionValue: 110,
    rewards: {
        questPoints: 1,
        xp: [{ skillId: SkillId.Herblore, amount: 11000, label: "Herblore" }],
        other: ["Trollheim Teleport spell"],
    },
    rewardItemId: 326,
    overviewStartText: "helping <col=800000>Eadgar</col> trick the trolls with a goutweed ruse.",
    startNpc: { id: 4118, name: "Eadgar" },
    startText: "I need goutweed from the trolls. Will you help?",
    steps: [
        {
            npc: { id: 4119, name: "Godric" },
            flag: "got_weed",
            line: "I smuggled goutweed out. Take it to Eadgar.",
            item: { id: 326 },
        },
    ],
    finishNpc: { id: 4118, name: "Eadgar" },
    finishText: "The ruse worked!",
    journalIntro: "I can continue with Eadgar after Troll Stronghold.",
    journalDone: ["Eadgar tricked the trolls.", "I retrieved goutweed."],
    prereq: (p) => isVarpAtLeast(p, TROLL_STRONGHOLD, TROLL_STRONGHOLD_DONE),
    prereqText: "Complete Troll Stronghold first.",
});

const scorpionCatcherQuest = simpleQuest({
    key: "scorpion_catcher",
    name: "Scorpion Catcher",
    varpId: 76,
    startedValue: 1,
    completionValue: 6,
    rewards: {
        questPoints: 1,
        xp: [
            { skillId: SkillId.Strength, amount: 6625, label: "Strength" },
            { skillId: SkillId.Prayer, amount: 6625, label: "Prayer" },
        ],
    },
    rewardItemId: 679,
    overviewStartText: "helping <col=800000>Thormac</col> find his lost scorpions.",
    startNpc: { id: 5232, name: "Thormac" },
    startText: "My scorpions escaped! The Seer saw where they went.",
    steps: [{ npc: { id: 5231, name: "Seer" }, flag: "seer_clue", line: "I scry them near the Barbarian Outpost." }],
    finishNpc: { id: 5232, name: "Thormac" },
    finishText: "My scorpions are home!",
    journalIntro: "I can start at the Sorcerer's Tower.",
    journalDone: ["Thormac's scorpions escaped.", "The Seer helped locate them."],
});

const bigChompyBirdQuest = simpleQuest({
    key: "big_chompy_bird_hunting",
    name: "Big Chompy Bird Hunting",
    varpId: 283,
    startedValue: 1,
    completionValue: 65,
    rewards: {
        questPoints: 2,
        xp: [
            { skillId: SkillId.Fletching, amount: 1470, label: "Fletching" },
            { skillId: SkillId.Cooking, amount: 1470, label: "Cooking" },
        ],
        other: ["Ability to hunt chompy birds"],
    },
    rewardItemId: 2876,
    overviewStartText: "hunting a <col=800000>chompy bird</col> for Rantz.",
    startNpc: { id: 1470, name: "Rantz" },
    startText: "I want chompy bird meat! Help me hunt one.",
    steps: [
        { npc: { id: 3967, name: "Boulder" }, flag: "built_trap", line: "The trap is set in the ogre lands." },
        { npc: { id: 1357, name: "Phantuwti Fanstuwi Farsight" }, flag: "ogre_bellows", line: "Take these ogre bellows.", item: { id: 2876 } },
    ],
    finishNpc: { id: 1470, name: "Rantz" },
    finishText: "Chompy bird! Rantz is happy!",
    journalIntro: "I can start by talking to Rantz in Feldip Hills.",
    journalDone: ["Rantz wanted a chompy bird.", "I helped hunt one."],
});

const elementalWorkshopIIQuest = simpleQuest({
    key: "elemental_workshop_ii",
    name: "Elemental Workshop II",
    varpId: -1,
    progressVarbitId: 2639,
    startedValue: 1,
    completionValue: 100,
    rewards: {
        questPoints: 1,
        xp: [
            { skillId: SkillId.Smithing, amount: 7500, label: "Smithing" },
            { skillId: SkillId.Crafting, amount: 7500, label: "Crafting" },
        ],
        other: ["Mind and body elemental equipment"],
    },
    rewardItemId: 2892,
    overviewStartText: "exploring deeper into the <col=800000>Elemental Workshop</col>.",
    startNpc: { id: 3639, name: "Archaeological expert" },
    startText: "There's more to the elemental workshop below!",
    prereq: (p) => isVarpAtLeast(p, 75, 6),
    prereqText: "Complete Elemental Workshop I first.",
    steps: [
        { npc: { id: 3634, name: "Student" }, flag: "found_schema", line: "I found the body and mind schemas.", item: { id: 2892 } },
    ],
    finishNpc: { id: 3639, name: "Archaeological expert" },
    finishText: "Elemental body and mind smithing unlocked!",
    journalIntro: "I can continue at the Dig Site.",
    journalDone: ["The workshop had a hidden lower level.", "I unlocked mind and body gear."],
});

const inSearchOfTheMyrequeQuest: QuestDefinition = {
    key: "in_search_of_the_myreque",
    name: "In Search of the Myreque",
    varpId: 199,
    startedValue: 1,
    completionValue: 95,
    rewards: { questPoints: 2, other: ["Access to Burgh de Rott area"] },
    rewardItemId: 552,
    overviewStartText: "finding the hidden <col=800000>Myreque</col> resistance.",
    buildJournal(player, _services) {
        const q = inSearchOfTheMyrequeQuest;
        const stage = getQuestStage(player, q);
        if (stage < q.startedValue) return buildNotStartedJournal(q, "I can start with Velorina in Mort'ton.");
        if (stage >= q.completionValue) {
            return buildCompleteJournal(["Velorina sought the Myreque.", "I found their hideout."]);
        }
        return [
            "The Myreque hide in Morytania.",
            "",
            strikeIf(getQuestFlag(player, q.key, "spoke_bill"), "Velorina needs a guide."),
            strikeIf(getQuestFlag(player, q.key, "found_hideout"), "Bill Teach knows the swamps."),
        ];
    },
    register(registry: IScriptRegistry) {
        registerQuestNpcTalk(registry, 2985, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 2985, npcName: "Velorina" };
            const q = inSearchOfTheMyrequeQuest;
            const stage = getQuestStage(player, q);
            if (stage >= q.completionValue) {
                return;
            }
            if (getQuestFlag(player, q.key, "found_hideout")) {
                startConversation(ctx, [
                    { npc: ["You found them!"] },
                    { exec: (d) => completeQuest(d.player, d.services, q) },
                ]);
                return;
            }
            if (stage >= q.startedValue) {
                startConversation(ctx, [{ npc: ["Find Bill Teach in Port Phasmatys."] }]);
                return;
            }
            if (!isVarpAtLeast(player, PRIEST_IN_PERIL, PRIEST_DONE)) {
                startConversation(ctx, [{ npc: ["Complete Priest in Peril first."] }]);
                return;
            }
            startConversation(ctx, [
                { npc: ["Find the Myreque for me!"] },
                {
                    options: [
                        {
                            text: "I'll search.",
                            next: [
                                { player: ["I'll search."] },
                                { exec: (d) => setQuestStage(d.player, q, d.services, q.startedValue) },
                            ],
                        },
                        { text: "Not now.", next: [{ player: ["Not now."] }] },
                    ],
                },
            ]);
        });
        registerQuestNpcTalk(registry, 4014, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 4014, npcName: "Bill Teach" };
            const q = inSearchOfTheMyrequeQuest;
            if (getQuestStage(player, q) < q.startedValue) return;
            startConversation(ctx, [
                { exec: (d) => setQuestFlag(d.player, q.key, "spoke_bill", true) },
                { npc: ["The hideout is in the swamps."] },
                { exec: (d) => setQuestFlag(d.player, q.key, "found_hideout", true) },
            ]);
        });
    },
};

const inAidOfTheMyrequeQuest = simpleQuest({
    key: "in_aid_of_the_myreque",
    name: "In Aid of the Myreque",
    varpId: 240,
    startedValue: 1,
    completionValue: 220,
    rewards: {
        questPoints: 2,
        xp: [
            { skillId: SkillId.Herblore, amount: 2000, label: "Herblore" },
            { skillId: SkillId.Strength, amount: 3000, label: "Strength" },
        ],
        other: ["Burgh de Rott bank"],
    },
    rewardItemId: 552,
    overviewStartText: "helping the <col=800000>Myreque</col> rebuild Burgh de Rott.",
    startNpc: { id: 2985, name: "Velorina" },
    startText: "Burgh de Rott needs supplies!",
    prereq: (p) => isVarpAtLeast(p, 199, 95),
    prereqText: "Complete In Search of the Myreque first.",
    steps: [
        { npc: { id: 5857, name: "Gravingas" }, flag: "supplies", line: "The citizens gathered repair supplies." },
        { npc: { id: 5859, name: "Ak-Haranu" }, flag: "steel", line: "Steel bars for the furnace.", item: { id: 2353 } },
    ],
    finishNpc: { id: 2985, name: "Velorina" },
    finishText: "Burgh de Rott is restored!",
    journalIntro: "I can help Velorina after finding the Myreque.",
    journalDone: ["Burgh de Rott was in ruins.", "I helped rebuild the town."],
});

const creatureOfFenkenstrainQuest = simpleQuest({
    key: "creature_of_fenkenstrain",
    name: "Creature of Fenkenstrain",
    varpId: 255,
    startedValue: 1,
    completionValue: 17,
    rewards: {
        questPoints: 2,
        xp: [{ skillId: SkillId.Thieving, amount: 5000, label: "Thieving" }],
        other: ["Experiment cave access"],
    },
    rewardItemId: 4187,
    overviewStartText: "helping <col=800000>Dr Fenkenstrain</col> with his creation.",
    startNpc: { id: 2014, name: "Dr Fenkenstrain" },
    startText: "I need body parts for my experiment!",
    prereq: (p) => isVarpAtLeast(p, PRIEST_IN_PERIL, PRIEST_DONE),
    prereqText: "Complete Priest in Peril first.",
    steps: [
        { npc: { id: 2017, name: "Lord Rologarth" }, flag: "arm", line: "Take this severed arm.", item: { id: 4187 } },
        { npc: { id: 2996, name: "Old crone" }, flag: "torso", line: "The torso is ready. Hurry!" },
    ],
    finishNpc: { id: 2014, name: "Dr Fenkenstrain" },
    finishText: "The experiment lives!",
    journalIntro: "I can start at Castle Fenkenstrain.",
    journalDone: ["Dr Fenkenstrain needed body parts.", "I assembled his creation."],
});

const ghostsAhoyQuest: QuestDefinition = {
    key: "ghosts_ahoy",
    name: "Ghosts Ahoy",
    varpId: 217,
    startedValue: 1,
    completionValue: 60,
    rewards: {
        questPoints: 2,
        xp: [
            { skillId: SkillId.Crafting, amount: 2400, label: "Crafting" },
            { skillId: SkillId.Prayer, amount: 2400, label: "Prayer" },
        ],
        other: ["Free entry to Port Phasmatys"],
    },
    rewardItemId: 552,
    overviewStartText: "helping the ghosts of <col=800000>Port Phasmatys</col>.",
    buildJournal(player, _services) {
        const q = ghostsAhoyQuest;
        const stage = getQuestStage(player, q);
        if (stage < q.startedValue) return buildNotStartedJournal(q, "I can start with Velorina in Mort'ton.");
        if (stage >= q.completionValue) {
            return buildCompleteJournal(["Necrovarus trapped the ghosts.", "I broke the barrier."]);
        }
        return [
            "Port Phasmatys is haunted.",
            "",
            strikeIf(getQuestFlag(player, q.key, "spoke_necrovarus"), "Velorina needs help."),
            strikeIf(getQuestFlag(player, q.key, "got_bone_mead"), "Necrovarus guards the town."),
        ];
    },
    register(registry: IScriptRegistry) {
        registerQuestNpcTalk(registry, 2985, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 2985, npcName: "Velorina" };
            const q = ghostsAhoyQuest;
            if (getQuestStage(player, q) >= q.completionValue) {
                startConversation(ctx, [{ npc: ["Port Phasmatys is free at last."] }]);
                return;
            }
            if (getQuestStage(player, q) < q.startedValue) {
                return;
            }
            if (getQuestFlag(player, q.key, "got_bone_mead")) {
                startConversation(ctx, [
                    { npc: ["Phasmatys is free!"] },
                    { exec: (d) => completeQuest(d.player, d.services, q) },
                ]);
                return;
            }
            if (getQuestStage(player, q) >= q.startedValue) {
                startConversation(ctx, [{ npc: ["Confront Necrovarus."] }]);
                return;
            }
            if (!isVarpAtLeast(player, PRIEST_IN_PERIL, PRIEST_DONE)) return;
            startConversation(ctx, [
                { npc: ["Free the ghosts of Port Phasmatys!"] },
                {
                    options: [
                        {
                            text: "I'll help.",
                            next: [
                                { player: ["I'll help."] },
                                { exec: (d) => setQuestStage(d.player, q, d.services, q.startedValue) },
                            ],
                        },
                        { text: "Not now.", next: [{ player: ["Not now."] }] },
                    ],
                },
            ]);
        });
        registerQuestNpcTalk(registry, 2986, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 2986, npcName: "Necrovarus" };
            const q = ghostsAhoyQuest;
            if (getQuestStage(player, q) < q.startedValue) return;
            startConversation(ctx, [
                { exec: (d) => setQuestFlag(d.player, q.key, "spoke_necrovarus", true) },
                { npc: ["My barrier is unbreakable! ...fine."] },
                { exec: (d) => setQuestFlag(d.player, q.key, "got_bone_mead", true) },
            ]);
        });
    },
};

const theFeudQuest = simpleQuest({
    key: "the_feud",
    name: "The Feud",
    varpId: 101,
    startedValue: 1,
    completionValue: 28,
    rewards: {
        questPoints: 1,
        xp: [
            { skillId: SkillId.Thieving, amount: 15000, label: "Thieving" },
            { skillId: SkillId.Attack, amount: 15000, label: "Attack" },
        ],
    },
    rewardItemId: 4625,
    overviewStartText: "infiltrating the <col=800000>Bandit Camp</col> in the desert.",
    startNpc: { id: 3533, name: "Ali Morrisane" },
    startText: "Bandits stole my goods!",
    steps: [
        { npc: { id: 6605, name: "Bandit" }, flag: "infiltrated", line: "Take Morrisane's goods.", item: { id: 4625 } },
        { npc: { id: 6290, name: "Sigmund" }, flag: "dealt_with_sigmund", line: "Sigmund backs off." },
    ],
    finishNpc: { id: 3533, name: "Ali Morrisane" },
    finishText: "My goods are returned!",
    journalIntro: "I can start with Ali Morrisane in Al Kharid.",
    journalDone: ["Bandits stole Ali's goods.", "I recovered them."],
});

const monksFriendQuest = simpleQuest({
    key: "monks_friend",
    name: "Monk's Friend",
    varpId: 30,
    startedValue: 1,
    completionValue: 80,
    rewards: { questPoints: 1, xp: [{ skillId: SkillId.Woodcutting, amount: 2000, label: "Woodcutting" }] },
    rewardItemId: 1963,
    overviewStartText: "helping the <col=800000>monks</col> of Ardougne.",
    startNpc: { id: 2577, name: "Abbot Langley" },
    startText: "Brother Cedric is drunk again!",
    steps: [
        { npc: { id: 4245, name: "Brother Cedric" }, flag: "cedric_sober", line: "Thanks... I'll go back." },
        { npc: { id: 9485, name: "Brother Brace" }, flag: "brace_helped", line: "Here's a hangover cure.", item: { id: 1963 } },
    ],
    finishNpc: { id: 2577, name: "Abbot Langley" },
    finishText: "Brother Cedric is sober.",
    journalIntro: "I can start at Ardougne Monastery.",
    journalDone: ["Brother Cedric had too much wine.", "I helped sober him up."],
});

const horrorFromTheDeepQuest: QuestDefinition = {
    key: "horror_from_the_deep",
    name: "Horror from the Deep",
    varpId: 34,
    startedValue: 1,
    completionValue: 11,
    rewards: {
        questPoints: 2,
        xp: [{ skillId: SkillId.Magic, amount: 4662, label: "Magic" }],
        other: ["God book rewards"],
    },
    rewardItemId: 3840,
    overviewStartText: "defeating the horror beneath the <col=800000>Lighthouse</col>.",
    buildJournal(player, _services) {
        const q = horrorFromTheDeepQuest;
        const stage = getQuestStage(player, q);
        if (stage < q.startedValue) return buildNotStartedJournal(q, "I can start with Morgan in Draynor.");
        if (stage >= q.completionValue) {
            return buildCompleteJournal(["A horror lurked beneath the lighthouse.", "I defeated it."]);
        }
        return [
            "Something threatens the lighthouse.",
            "",
            strikeIf(getQuestFlag(player, q.key, "got_manual"), "Morgan needs help."),
            strikeIf(getQuestFlag(player, q.key, "defeated_horror"), "I need the lighthouse manual."),
        ];
    },
    register(registry: IScriptRegistry) {
        registerQuestNpcTalk(registry, 3479, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 3479, npcName: "Morgan" };
            const q = horrorFromTheDeepQuest;
            const stage = getQuestStage(player, q);
            if (stage >= q.completionValue) {
                startConversation(ctx, [{ npc: ["The lighthouse is safe again."] }]);
                return;
            }
            if (stage < q.startedValue) {
                return;
            }
            if (getQuestFlag(player, q.key, "defeated_horror")) {
                startConversation(ctx, [
                    { npc: ["You saved the lighthouse!"] },
                    { exec: (d) => completeQuest(d.player, d.services, q) },
                ]);
                return;
            }
            if (stage >= q.startedValue) {
                startConversation(ctx, [{ npc: ["Descend into the basement!"] }]);
                return;
            }
            startConversation(ctx, [
                { npc: ["A horror from the deep threatens us!"] },
                {
                    options: [
                        {
                            text: "I'll fight it.",
                            next: [
                                { player: ["I'll fight it."] },
                                {
                                    exec: (d) => {
                                        setQuestStage(d.player, q, d.services, q.startedValue);
                                        addItemIfMissing(d.player, d.services, 3840, 1);
                                        setQuestFlag(d.player, q.key, "got_manual", true);
                                    },
                                },
                            ],
                        },
                        { text: "Not now.", next: [{ player: ["Not now."] }] },
                    ],
                },
            ]);
        });
        registerQuestNpcTalk(registry, 4004, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 4004, npcName: "Shadow" };
            const q = horrorFromTheDeepQuest;
            if (getQuestStage(player, q) < q.startedValue) return;
            startConversation(ctx, [
                { npc: ["The horror is defeated."] },
                { exec: (d) => setQuestFlag(d.player, q.key, "defeated_horror", true) },
            ]);
        });
    },
};

const taiBwoWannaiTrioQuest = simpleQuest({
    key: "tai_bwo_wannai_trio",
    name: "Tai Bwo Wannai Trio",
    varpId: 320,
    startedValue: 1,
    completionValue: 29,
    rewards: {
        questPoints: 2,
        xp: [
            { skillId: SkillId.Cooking, amount: 5000, label: "Cooking" },
            { skillId: SkillId.Fishing, amount: 5000, label: "Fishing" },
        ],
    },
    rewardItemId: 3152,
    overviewStartText: "helping the <col=800000>Tai Bwo Wannai</col> villagers.",
    startNpc: { id: 4705, name: "Tamayu" },
    startText: "My family needs special Karamjan dishes!",
    prereq: (p) => isVarpAtLeast(p, 175, 12),
    prereqText: "Complete Jungle Potion first.",
    steps: [
        { npc: { id: 6237, name: "Tinsay" }, flag: "tinsay_food", line: "This stew is perfect!" },
        { npc: { id: 6557, name: "Gabooty" }, flag: "gabooty_food", line: "Trading sticks for you.", item: { id: 3152 } },
    ],
    finishNpc: { id: 4705, name: "Tamayu" },
    finishText: "My family is fed!",
    journalIntro: "I can start in Tai Bwo Wannai.",
    journalDone: ["Tamayu's family needed food.", "I cooked for the trio."],
});

const zogreFleshEatersQuest = simpleQuest({
    key: "zogre_flesh_eaters",
    name: "Zogre Flesh Eaters",
    varpId: 487,
    startedValue: 1,
    completionValue: 15,
    rewards: {
        questPoints: 1,
        xp: [
            { skillId: SkillId.Smithing, amount: 2000, label: "Smithing" },
            { skillId: SkillId.Herblore, amount: 2000, label: "Herblore" },
        ],
        other: ["Brutal arrows"],
    },
    rewardItemId: 4827,
    overviewStartText: "investigating the <col=800000>zogre</col> menace.",
    startNpc: { id: 881, name: "Zavistic Rarve" },
    startText: "Zogres infest the sewers!",
    prereq: (p) => isVarpAtLeast(p, 116, 15),
    prereqText: "Complete Shilo Village first.",
    steps: [
        { npc: { id: 2893, name: "Jiminua" }, flag: "ogre_arrows", line: "Take brutal arrows.", item: { id: 4827 } },
        { npc: { id: 2094, name: "Jogre" }, flag: "defeated_zogres", line: "The zogres retreat!" },
    ],
    finishNpc: { id: 881, name: "Zavistic Rarve" },
    finishText: "The zogre threat is contained.",
    journalIntro: "I can start in Yanille.",
    journalDone: ["Zogres threatened Yanille.", "I cleared the sewers."],
});

const eaglesPeakQuest = simpleQuest({
    key: "eagles_peak",
    name: "Eagles' Peak",
    varpId: 308,
    startedValue: 1,
    completionValue: 15,
    rewards: {
        questPoints: 2,
        xp: [
            { skillId: SkillId.Hunter, amount: 2500, label: "Hunter" },
            { skillId: SkillId.Agility, amount: 2500, label: "Agility" },
        ],
        other: ["Eagle transport"],
    },
    rewardItemId: 10150,
    overviewStartText: "investigating <col=800000>Eagles' Peak</col>.",
    startNpc: { id: 2024, name: "Nickolaus" },
    startText: "I'm studying eagles but I'm stuck!",
    steps: [
        { npc: { id: 5316, name: "Kangai Mau" }, flag: "eagle_lure", line: "Use this dead ferret.", item: { id: 10150 } },
    ],
    finishNpc: { id: 2024, name: "Nickolaus" },
    finishText: "My research is complete!",
    journalIntro: "I can start near Eagles' Peak.",
    journalDone: ["Nickolaus researched eagles.", "I helped him finish."],
});

const regicideQuest: QuestDefinition = {
    key: "regicide",
    name: "Regicide",
    varpId: 328,
    startedValue: 1,
    completionValue: 15,
    rewards: {
        questPoints: 3,
        xp: [
            { skillId: SkillId.Agility, amount: 13750, label: "Agility" },
            { skillId: SkillId.Herblore, amount: 13750, label: "Herblore" },
        ],
        other: ["Access to Tirannwn"],
    },
    rewardItemId: 420,
    overviewStartText: "continuing the elven questline through <col=800000>Isafdar</col>.",
    buildJournal(player, _services) {
        const q = regicideQuest;
        const stage = getQuestStage(player, q);
        if (stage < q.startedValue) {
            return buildNotStartedJournal(q, "I can start after Underground Pass.");
        }
        if (stage >= q.completionValue) {
            return buildCompleteJournal(["King Tyras was targeted.", "I reached Lord Iorwerth."]);
        }
        return [
            "Tyras must fall.",
            "",
            strikeIf(getQuestFlag(player, q.key, "got_message"), "I have a grim task."),
            strikeIf(getQuestFlag(player, q.key, "crossed_tirannwn"), "I must reach Lord Iorwerth."),
        ];
    },
    register(registry: IScriptRegistry) {
        registerQuestNpcTalk(registry, 4963, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 4963, npcName: "King Bolren" };
            const q = regicideQuest;
            const stage = getQuestStage(player, q);
            if (stage >= q.completionValue) {
                startConversation(ctx, [{ npc: ["Tirannwn holds many secrets yet."] }]);
                return;
            }
            if (stage >= q.startedValue) {
                startConversation(ctx, [{ npc: ["Speak with Lord Iorwerth in Tirannwn."] }]);
                return;
            }
            if (!isVarpAtLeast(player, UNDERGROUND_PASS, UNDERGROUND_DONE)) {
                startConversation(ctx, [{ npc: ["Complete Underground Pass first."] }]);
                return;
            }
            startConversation(ctx, [
                { npc: ["Dark elves plot in Tirannwn. Will you go?"] },
                {
                    options: [
                        {
                            text: "I'll go.",
                            next: [
                                { player: ["I'll go."] },
                                {
                                    exec: (d) => {
                                        setQuestStage(d.player, q, d.services, q.startedValue);
                                        setQuestFlag(d.player, q.key, "got_message", true);
                                    },
                                },
                            ],
                        },
                        { text: "Not now.", next: [{ player: ["Not now."] }] },
                    ],
                },
            ]);
        });
        registerQuestNpcTalk(registry, 638, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 638, npcName: "Lord Iorwerth" };
            const q = regicideQuest;
            if (getQuestStage(player, q) < q.startedValue) return;
            startConversation(ctx, [
                { npc: ["The message is received."] },
                {
                    exec: (d) => {
                        setQuestFlag(d.player, q.key, "crossed_tirannwn", true);
                        completeQuest(d.player, d.services, q);
                    },
                },
            ]);
        });
    },
};

const rovingElvesQuest = simpleQuest({
    key: "roving_elves",
    name: "Roving Elves",
    varpId: 402,
    startedValue: 1,
    completionValue: 80,
    rewards: {
        questPoints: 1,
        xp: [
            { skillId: SkillId.Strength, amount: 10000, label: "Strength" },
            { skillId: SkillId.Herblore, amount: 10000, label: "Herblore" },
        ],
        other: ["Crystal bow and shield"],
    },
    rewardItemId: 420,
    overviewStartText: "aiding the <col=800000>elven</col> refugees after Regicide.",
    startNpc: { id: 9146, name: "Islwyn" },
    startText: "Glarial's tomb was desecrated!",
    prereq: (p) => isVarpAtLeast(p, 328, 15),
    prereqText: "Complete Regicide first.",
    steps: [
        { npc: { id: 8828, name: "Eluned" }, flag: "crystal_seed", line: "Take this crystal seed.", item: { id: 420 } },
        { npc: { id: 4536, name: "Arianwyn" }, flag: "blessed", line: "Arianwyn blesses the seed." },
    ],
    finishNpc: { id: 9146, name: "Islwyn" },
    finishText: "Glarial's memory is honoured.",
    journalIntro: "I can start in Isafdar after Regicide.",
    journalDone: ["Glarial's tomb was violated.", "I helped restore it."],
});

const mageArenaQuest: QuestDefinition = {
    key: "mage_arena",
    name: "Mage Arena",
    varpId: 267,
    startedValue: 1,
    completionValue: 8,
    rewards: {
        questPoints: 2,
        other: ["God spells (Claws of Guthix, Flames of Zamorak, Saradomin Strike)"],
    },
    rewardItemId: 2416,
    overviewStartText: "proving yourself in the <col=800000>Mage Arena</col>.",
    buildJournal(player, _services) {
        const q = mageArenaQuest;
        const stage = getQuestStage(player, q);
        if (stage < q.startedValue) return buildNotStartedJournal(q, "I can start with Kolodion in the Mage Arena.");
        if (stage >= q.completionValue) {
            return buildCompleteJournal(["Kolodion tested me.", "I earned the god spells."]);
        }
        return ["The Mage Arena demands a champion.", "", strikeIf(getQuestFlag(player, q.key, "won"), "Kolodion will test me.")];
    },
    register(registry: IScriptRegistry) {
        registerQuestNpcTalk(registry, 1603, ({ player, services }) => {
            const ctx: DialogueContext = { player, services, npcId: 1603, npcName: "Kolodion" };
            const q = mageArenaQuest;
            const stage = getQuestStage(player, q);
            if (stage >= q.completionValue) {
                startConversation(ctx, [{ npc: ["You are a champion."] }]);
                return;
            }
            if (getQuestFlag(player, q.key, "won")) {
                startConversation(ctx, [
                    { npc: ["You earned the god spells!"] },
                    { exec: (d) => completeQuest(d.player, d.services, q) },
                ]);
                return;
            }
            if (stage >= q.startedValue) {
                startConversation(ctx, [
                    { npc: ["Defeat the guardians!"] },
                    { exec: (d) => setQuestFlag(d.player, q.key, "won", true) },
                ]);
                return;
            }
            startConversation(ctx, [
                { npc: ["Prove yourself in the Mage Arena!"] },
                {
                    options: [
                        {
                            text: "I accept.",
                            next: [
                                { player: ["I accept."] },
                                { exec: (d) => setQuestStage(d.player, q, d.services, q.startedValue) },
                            ],
                        },
                        { text: "Not now.", next: [{ player: ["Not now."] }] },
                    ],
                },
            ]);
        });
    },
};

const oneSmallFavourQuest = simpleQuest({
    key: "one_small_favour",
    name: "One Small Favour",
    varpId: 416,
    startedValue: 1,
    completionValue: 75,
    rewards: {
        questPoints: 2,
        xp: [
            { skillId: SkillId.Agility, amount: 10000, label: "Agility" },
            { skillId: SkillId.Smithing, amount: 10000, label: "Smithing" },
            { skillId: SkillId.Crafting, amount: 10000, label: "Crafting" },
        ],
        other: ["Gnome glider repair"],
    },
    rewardItemId: 954,
    overviewStartText: "doing favours across <col=800000>Gielinor</col> for a gnome pilot.",
    startNpc: { id: 4642, name: "Shantay" },
    startText: "A gnome pilot needs help. Can you run errands across the land?",
    steps: [
        { npc: { id: 1351, name: "Seth Groats" }, flag: "favour_1", line: "I'll watch the sheep while you help the pilot." },
        { npc: { id: 2886, name: "Aubury" }, flag: "favour_2", line: "Take these rune stones to the pilot." },
        { npc: { id: 2020, name: "Daero" }, flag: "favour_3", line: "The glider is repaired. Tell Shantay." },
    ],
    finishNpc: { id: 4642, name: "Shantay" },
    finishText: "One small favour led to many. Well done!",
    journalIntro: "I can start with Shantay at the desert pass.",
    journalDone: ["A gnome pilot needed help.", "I ran errands all over Gielinor."],
});

export const membersQuestPack3: QuestDefinition[] = [
    heroesQuest,
    trollStrongholdQuest,
    eadgarsRuseQuest,
    scorpionCatcherQuest,
    bigChompyBirdQuest,
    elementalWorkshopIIQuest,
    inSearchOfTheMyrequeQuest,
    inAidOfTheMyrequeQuest,
    creatureOfFenkenstrainQuest,
    ghostsAhoyQuest,
    theFeudQuest,
    monksFriendQuest,
    horrorFromTheDeepQuest,
    taiBwoWannaiTrioQuest,
    zogreFleshEatersQuest,
    eaglesPeakQuest,
    regicideQuest,
    rovingElvesQuest,
    oneSmallFavourQuest,
];
