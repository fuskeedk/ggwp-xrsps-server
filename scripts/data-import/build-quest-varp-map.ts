/**
 * Builds quest varp mapping by merging questListData entries with VarPlayerID
 * constant fuzzy matching against resolved quest titles.
 *
 * Output: server/data/quest-reference/quest-varp-map.json
 */

import fs from "fs";
import path from "path";
import { PROJECT_ROOT } from "./config";

const REF_DIR = path.join(PROJECT_ROOT, "server/data/quest-reference");
const VARPLAYER_URL =
    "https://raw.githubusercontent.com/runelite/runelite/master/runelite-api/src/main/java/net/runelite/api/gameval/VarPlayerID.java";

type VarpEntry = {
    varpId: number;
    startedValue: number;
    completionValue: number;
    source: string;
    constant?: string;
};

const MANUAL_CONSTANT_TO_TITLE: Record<string, string> = {
    COOKQUEST: "Cook's Assistant",
    DORICQUEST: "Doric's Quest",
    DRUNKMONKQUEST: "The Knight's Sword",
    HAUNTED: "Ernest the Chicken",
    GOBLINQUEST: "Rune Mysteries",
    RUNEMYSTERIES: "Rune Mysteries",
    WATERFALL_QUEST: "Waterfall Quest",
    BIOHAZARD: "Biohazard",
    DRUIDQUEST: "Druidic Ritual",
    PRIESTSTART: "Priest in Peril",
    TREEQUEST: "Tree Gnome Village",
    ZOMBIEQUEEN: "Shilo Village",
    LEGENDSQUEST: "Legend's Quest",
    RJQUEST: "Romeo & Juliet",
    CRESTQUEST: "Family Crest",
    GRANDTREE: "The Grand Tree",
    SEASLUGQUEST: "Sea Slug",
    IMP: "Imp Catcher",
    ELENAQUEST: "Plague City",
    JUNGLEPOTION: "Jungle Potion",
    DRAGONQUEST: "Dragon Slayer I",
    SHEEP: "Sheep Shearer",
    HEROQUEST: "Heroes' Quest",
    MURDERQUEST: "Murder Mystery",
    DESERTRESCUE: "The Tourist Trap",
    TOTEMQUEST: "Tribal Totem",
    HAZEELCULTQUEST: "Hazeel Cult",
    BALLQUEST: "Witch's House",
    PRINCEQUEST: "Prince Ali Rescue",
    TROLL_QUEST: "Troll Stronghold",
    REGICIDE_QUEST: "Regicide",
    EADGAR_QUEST: "Eadgar's Ruse",
    MORTTONQUEST: "Shades of Mort'ton",
    ROVING_ELVES_QUEST: "Roving Elves",
    FENK_QUEST: "Creature of Fenkenstrain",
    DESERTTREASUREMAIN: "Desert Treasure I",
    DESERT_TREASURE: "Desert Treasure I",
    MONKEY_MADNESS: "Monkey Madness II",
    DRAGON_SLAYER: "Dragon Slayer II",
    RECIPE_FOR_DISASTER: "Recipe for Disaster",
    LEGENDS_QUEST: "Legend's Quest",
    MAGE_ARENA: "Mage Arena I",
    MAGE_ARENA_II: "Mage Arena II",
    ANIMAL_MAGNETISM: "Animal Magnetism",
    ANOTHER_SLICE_OF_HAM: "Another Slice of H.A.M.",
    THE_ASCENT_OF_ARCEUUS: "The Ascent of Arceuus",
    BELOW_ICE_MOUNTAIN: "Below Ice Mountain",
    BETWEEN_A_ROCK: "Between a Rock...",
    BONE_VOYAGE: "Bone Voyage",
    COLD_WAR: "Cold War",
    THE_CORSAIR_CURSE: "The Corsair Curse",
    CURSE_OF_THE_EMPTY_LORD: "Curse of the Empty Lord",
    DADDYS_HOME: "Daddy's Home",
    TGOD_PRIMARY: "The Garden of Death",
    ITT_PRIMARY: "Into the Tombs",
    DARKNESS_OF_HALLOWVALE: "Darkness of Hallowvale",
    DEATH_TO_THE_DORGESHUUN: "Death to the Dorgeshuun",
    THE_DEPTHS_OF_DESPAIR: "The Depths of Despair",
    DEVIOUS_MINDS: "Devious Minds",
    DRAGON_SLAYER_II: "Dragon Slayer II",
    DREAM_MENTOR: "Dream Mentor",
    THE_ENCHANTED_KEY: "The Enchanted Key",
    ENLIGHTENED_JOURNEY: "Enlightened Journey",
    THE_EYES_OF_GLOUPHRIE: "The Eyes of Glouphrie",
    FAIRYTALE_I: "Fairytale I - Growing Pains",
    FAIRYTALE_II: "Fairytale II - Cure a Queen",
    THE_FORSAKEN_TOWER: "The Forsaken Tower",
    THE_FREMENNIK_EXILES: "The Fremennik Exiles",
    THE_FREMENNIK_ISLES: "The Fremennik Isles",
    THE_FREMENNIK_TRIALS: "The Fremennik Trials",
    GARDEN_OF_TRANQUILLITY: "Garden of Tranquillity",
    THE_GENERALS_SHADOW: "The General's Shadow",
    GETTING_AHEAD: "Getting Ahead",
    THE_GIANT_DWARF: "The Giant Dwarf",
    THE_GOLEM: "The Golem",
    THE_GREAT_BRAIN_ROBBERY: "The Great Brain Robbery",
    GRIM_TALES: "Grim Tales",
    THE_HAND_IN_THE_SAND: "The Hand in the Sand",
    HAUNTED_MINE: "Haunted Mine",
    ICTHLARINS_LITTLE_HELPER: "Icthlarin's Little Helper",
    A_KINGDOM_DIVIDED: "A Kingdom Divided",
    KINGS_RANSOM: "King's Ransom",
    LAIR_OF_TARN_RAZORLOR: "Lair of Tarn Razorlor",
    THE_LOST_TRIBE: "The Lost Tribe",
    MAKING_FRIENDS_WITH_MY_ARM: "Making Friends with My Arm",
    MAKING_HISTORY: "Making History",
    MISTHALIN_MYSTERY: "Misthalin Mystery",
    MONKEY_MADNESS_II: "Monkey Madness II",
    MOUNTAIN_DAUGHTER: "Mountain Daughter",
    MOURNINGS_END_PART_I: "Mourning's End Part I",
    MOURNINGS_END_PART_II: "Mourning's End Part II",
    MY_ARMS_BIG_ADVENTURE: "My Arm's Big Adventure",
    A_NIGHT_AT_THE_THEATRE: "A Night at the Theatre",
    OLAFS_QUEST: "Olaf's Quest",
    A_PORCINE_OF_INTEREST: "A Porcine of Interest",
    THE_QUEEN_OF_THIEVES: "The Queen of Thieves",
    RAG_AND_BONE_MAN_I: "Rag and Bone Man I",
    RAG_AND_BONE_MAN_II: "Rag and Bone Man II",
    RATCATCHERS: "Ratcatchers",
    RECRUITMENT_DRIVE: "Recruitment Drive",
    RUM_DEAL: "Rum Deal",
    SHADES_OF_MORTTON: "Shades of Mort'ton",
    SHADOW_OF_THE_STORM: "Shadow of the Storm",
    SINS_OF_THE_FATHER: "Sins of the Father",
    THE_SLUG_MENACE: "The Slug Menace",
    SONG_OF_THE_ELVES: "Song of the Elves",
    A_SOULS_BANE: "A Soul's Bane",
    SPIRITS_OF_THE_ELID: "Spirits of the Elid",
    SWAN_SONG: "Swan Song",
    A_TAIL_OF_TWO_CATS: "A Tail of Two Cats",
    TALE_OF_THE_RIGHTEOUS: "Tale of the Righteous",
    A_TASTE_OF_HOPE: "A Taste of Hope",
    TEARS_OF_GUTHIX: "Tears of Guthix",
    TOWER_OF_LIFE: "Tower of Life",
    TROLL_ROMANCE: "Troll Romance",
    WANTED: "Wanted!",
    WHAT_LIES_BELOW: "What Lies Below",
    X_MARKS_THE_SPOT: "X Marks the Spot",
    THE_FROZEN_DOOR: "The Frozen Door",
    LAND_OF_THE_GOBLINS: "Land of the Goblins",
    HOPESPEARS_WILL: "Hopespear's Will",
    TEMPLE_OF_THE_EYE: "Temple of the Eye",
    BENEATH_CURSED_SANDS: "Beneath Cursed Sands",
    SLEEPING_GIANTS: "Sleeping Giants",
    SECRETS_OF_THE_NORTH: "Secrets of the North",
    CHILDREN_OF_THE_SUN: "Children of the Sun",
    DEFENDER_OF_VARROCK: "Defender of Varrock",
    WHILE_GUTHIX_SLEEPS: "While Guthix Sleeps",
    CLIENT_OF_KOUREND: "Client of Kourend",
    TROLL_LOVE: "Troll Romance",
    DWARFROCK_MAIN: "Between a Rock...",
    MAIN_FEUD_VAR: "The Feud",
    MAIN_ICS_VAR: "Icthlarin's Little Helper",
    ICS_LITTLE_MULTI: "Icthlarin's Little Helper",
    LOST_TRIBE: "The Lost Tribe",
    GIANTDWARF_MAIN: "The Giant Dwarf",
    HAUNTEDMINE: "Haunted Mine",
    MDAUGHTER_VAR: "Mountain Daughter",
    FORGET_MAIN_VAR: "Forgettable Tale...",
    MAIN_RATCATCH_VAR: "Ratcatchers",
    MAKINGHISTORY: "Making History",
    HANDSAND: "The Hand in the Sand",
    FEVER_QUEST: "Recipe for Disaster",
    SOULBANE: "A Soul's Bane",
    RECRUITMENTDRIVE: "Recruitment Drive",
    GARDEN_VARP_1: "Garden of Tranquillity",
    TWOCATS_VARBIT: "A Tail of Two Cats",
    BARCRAWL: "Alfred Grimhand's Barcrawl",
    SCORPCATCHER: "Scorpion Catcher",
    UPASS: "Underground Pass",
    PRIESTPERIL: "Priest in Peril",
    DRUIDSPIRIT: "Nature Spirit",
    ITWATCHTOWER: "Watchtower",
    CHOMPYBIRD: "Big Chompy Bird Hunting",
    ELEMENTAL_WORKSHOP_BITS: "Elemental Workshop I",
    MM_MAIN: "Monkey Madness I",
    TBWT_MAIN: "Tai Bwo Wannai Trio",
    AHOY_VARBITS_1: "Ghosts Ahoy",
    ONESMALLFAVOUR: "One Small Favour",
    MAGEARENA: "Mage Arena I",
    VAMPIRE: "Vampyre Slayer",
    FLUFFS: "Gertrude's Cat",
    HETTY: "Witch's Potion",
    ZANARIS: "Lost City",
    SQUIRE: "The Knight's Sword",
    HUNT: "Pirate's Treasure",
    DEMONSTART: "Demon Slayer",
    ARTHUR: "Merlin's Crystal",
    ITEXAMLEVEL: "The Dig Site",
    ITGRONIGEN: "Observatory Quest",
    ZOMBIEQUEEN: "Shilo Village",
    DEEPHORROR: "Horror from the Deep",
    VIKING: "The Fremennik Trials",
    DEAL_QUEST: "Rum Deal",
    AGRITH_QUEST_VARP: "Shadow of the Storm",
    DESERT: "The Feud",
    LUNAR_QUEST: "Lunar Diplomacy",
    MYARM_QUEST: "My Arm's Big Adventure",
    ARENAQUEST: "Fight Arena",
    COGQUEST: "Clock Tower",
    FISHINGCOMPO: "Fishing Contest",
    IKOV: "Temple of Ikov",
    SHEEPHERDERQUEST: "Sheep Herder",
    MCANNON: "Dwarf Cannon",
    GRAIL: "Holy Grail",
    ITDIGSITEMULTI: "The Dig Site",
    MOURNING_QUEST: "Mourning's End Part I",
    MOURNING_QUEST_PART2: "Mourning's End Part II",
    AGRITH_QUEST_VARP: "Shadow of the Storm",
    ENAKH_QUEST_EXPOSITBITS: "Enakhra's Lament",
    FEVER_QUEST: "Recipe for Disaster",
    SWANSONG_QUEST: "Swan Song",
    ROYAL_QUESTVARBITS: "Royal Trouble",
    QUEST_SLUG2: "The Slug Menace",
    ELEMENTAL_QUEST_2_BITS: "Elemental Workshop II",
    BRAIN_QUEST_VAR: "The Great Brain Robbery",
    QUEST_WANTED: "Wanted!",
    GOLEM_QUEST: "The Golem",
    ABYSSAL_MINIQUEST: "Enter the Abyss",
    RAG_QUEST: "Rag and Bone Man I",
    MISC_QUEST: "Throne of Miscellania",
    ROUTEQUEST: "One Small Favour",
    DESERT: "The Feud",
    _100_PIRATE_QUEST: "Cabin Fever",
    TUTORIAL: "Learning the Ropes",
};

function normalizeTitle(title: string): string {
    return title
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/['']/g, "'")
        .replace(/[^a-z0-9']+/g, " ")
        .trim();
}

function parseQuestListData(): Map<string, VarpEntry> {
    const file = fs.readFileSync(
        path.join(PROJECT_ROOT, "server/gamemodes/vanilla/widgets/questListData.ts"),
        "utf8",
    );
    const map = new Map<string, VarpEntry>();
    const re = /\["([^"]+)",\s*\{([^}]+)\}/g;
    for (const match of file.matchAll(re)) {
        const name = match[1];
        const body = match[2];
        const varpId = Number((body.match(/varpId:\s*(-?\d+)/) ?? [])[1]);
        if (!Number.isFinite(varpId) || varpId < 0) continue;
        const completionValue = Number((body.match(/completionValue:\s*(\d+)/) ?? [])[1] ?? 100);
        const startedValue = Number((body.match(/startedValue:\s*(\d+)/) ?? [])[1] ?? 1);
        map.set(normalizeTitle(name), {
            varpId,
            startedValue,
            completionValue,
            source: "questListData",
        });
    }
    return map;
}

function tokenize(value: string): string[] {
    return normalizeTitle(value)
        .split(" ")
        .filter((t) => t.length > 2);
}

function scoreTitleToConstant(title: string, constant: string): number {
    const titleTokens = tokenize(title);
    const constantTokens = new Set(
        constant
            .replace(/_QUEST$/, "")
            .replace(/_/g, " ")
            .toLowerCase()
            .split(/[^a-z]+/)
            .filter((t) => t.length > 2),
    );
    let score = 0;
    for (const token of titleTokens) {
        if (constantTokens.has(token)) score += 1;
    }
    const compactTitle = normalizeTitle(title).replace(/ /g, "");
    const compactConst = constant.toLowerCase().replace(/_/g, "");
    if (compactConst.includes(compactTitle.slice(0, 6)) || compactTitle.includes(compactConst.slice(0, 6))) {
        score += 1.5;
    }
    return score;
}

async function fetchVarPlayerConstants(): Promise<Array<{ name: string; id: number }>> {
    const cached = path.join(REF_DIR, "VarPlayerID.java");
    let text: string;
    if (fs.existsSync(cached)) {
        text = fs.readFileSync(cached, "utf8");
    } else {
        const res = await fetch(VARPLAYER_URL);
        text = await res.text();
        fs.writeFileSync(cached, text);
    }
    return [...text.matchAll(/public static final int ([A-Z0-9_]+) = (\d+);/g)].map((m) => ({
        name: m[1],
        id: Number(m[2]),
    }));
}

async function main(): Promise<void> {
    const resolved = JSON.parse(
        fs.readFileSync(path.join(REF_DIR, "resolved-quests.json"), "utf8"),
    ) as { quests: Array<{ title: string }> };

    const map = parseQuestListData();
    const constants = await fetchVarPlayerConstants();
    const questConstants = constants.filter((c) =>
        /QUEST|COOKQUEST|DORIC|DRAGON|LUNAR|DESERT|LEGEND|MYREQUE|MONKEY|GRAND|WATCH|PLAGUE|BIO|HERO|REGICIDE|ROVING|FEUD|GHOST|FENK|CHOMPY|SCORPION|EADGAR|TROLL|UNDERGROUND|NATURE|PRIEST|MERLIN|MURDER|GERTRUDE|DRUID|JUNGLE|SHILO|LOST|TREE|CANNON|DIG|GRAIL|DEATH|TOURIST|WITCH|HAZEEL|FAMILY|IKOV|OBSERVATORY|ELEMENTAL|FISHING|SEASLUG|TRIBAL|CLOCK|SHEEP|DWARF|WATERFALL|VAMPYRE|IMP|DEMON|ERNEST|GOBLIN|KNIGHT|PIRATE|PRINCE|ROMEO|RUNE|RESTLESS|SHIELD|ARENA|FAVOUR|EAGLE|ZOGRE|HORROR|MONK|MOURNING|ANIMAL|RECIPE|COLD|BONE|CABIN|CLIENT|CONTACT|CORSAIR|CURSE|DADDY|DARKNESS|DORGESHUUN|DEPTHS|DEVIOUS|DREAM|ENAKHRA|ENCHANTED|ENLIGHTENED|ABYSS|EYES|FAIRYTALE|FREMENNIK|GARDEN|GIANT|GOLEM|BRAIN|GRIM|HAND|HAUNTED|ICTHLARIN|KINGDOM|KINGS|LAIR|TRIBE|MAKING|MISTHALIN|MOUNTAIN|MYARM|NIGHT|PORCINE|QUEEN|RAG|RAT|RECRUIT|RUM|SHADES|SHADOW|SINS|SKIPPY|SLUG|SONG|SOUL|SPIRITS|SWAN|TAIL|TALE|TASTE|TEARS|THRONE|TOWER|WANTED|FROZEN|GOBLINS|HOPESPEAR|TEMPLE|EYE|CURSED|SLEEPING|SECRETS|PATH|CHILDREN|DEFENDER|GUTHIX|TWILIGHT|PERILOUS|RIBBITING|HEART|MEAT|ETHICAL|ARRAV|FINAL|SHADOWS|SCRAMBLED|VALE|PANDEMONIUM|PRYING|CURRENT|TROUBLED|REEF|LEARNING|IDES|ELENA|HAUNTED|BALL|DEAL|GOLEM|FEVER|SWANSONG|ROYAL|WANTED|MISC|ROUTE|AGRITH|BRAIN|MCANNON|GRAIL|COG|FISHINGCOMPO|DRUNKMONK|ZOMBIE|ITDIG|RJ|CREST|SEASLUG|ELENA|JUNGLEPOTION|SHEEP|HERO|MURDER|DESERTRESCUE|TOTEM|PRINCE|REGICIDE|EADGAR|MORTTON|TROLL|ROVING|FENK|DESERTTREASURE|ABYSSAL|MOURNING|LUNAR|MYARM|ELEMENTAL|SLUG2/i.test(
            c.name,
        ),
    );

    for (const quest of resolved.quests) {
        const key = normalizeTitle(quest.title);
        if (map.has(key)) continue;

        const manualEntries = Object.entries(MANUAL_CONSTANT_TO_TITLE).filter(
            ([, title]) => normalizeTitle(title) === key,
        );
        let matchedManual = false;
        for (const [constantName] of manualEntries) {
            const constant = constants.find((c) => c.name === constantName);
            if (!constant) continue;
            map.set(key, {
                varpId: constant.id,
                startedValue: 1,
                completionValue: 100,
                source: "manual-constant",
                constant: constant.name,
            });
            matchedManual = true;
            break;
        }
        if (matchedManual) continue;

        let best: { name: string; id: number } | undefined;
        let bestScore = 0;
        for (const constant of constants) {
            const score = scoreTitleToConstant(quest.title, constant.name);
            if (score > bestScore) {
                bestScore = score;
                best = constant;
            }
        }
        const FUZZY_BLOCKED: Record<string, string[]> = {
            "the garden of death": ["GARDEN_VARP_1", "GARDEN_VARP_2", "GARDEN_OF_TRANQUILLITY"],
        };
        const blocked = FUZZY_BLOCKED[key] ?? [];

        if (best && bestScore >= 1.5 && !blocked.includes(best.name)) {
            map.set(key, {
                varpId: best.id,
                startedValue: 1,
                completionValue: 100,
                source: "fuzzy-constant",
                constant: best.name,
            });
        }
    }

    const output = {
        meta: {
            generatedAt: new Date().toISOString(),
            count: map.size,
        },
        quests: Object.fromEntries(
            [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])),
        ),
    };

    const outPath = path.join(REF_DIR, "quest-varp-map.json");
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
    console.log(`[build-quest-varp-map] wrote ${outPath} (${map.size} entries)`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
