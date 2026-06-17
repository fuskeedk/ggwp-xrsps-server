/**
 * Maps quest titles to progress varbit IDs using Quest Helper + RuneLite VarbitID.
 *
 * Output: server/data/quest-reference/quest-varbit-map.json
 */

import fs from "fs";
import path from "path";
import { PROJECT_ROOT } from "./config";

const REF_DIR = path.join(PROJECT_ROOT, "server/data/quest-reference");
const OUT_PATH = path.join(REF_DIR, "quest-varbit-map.json");

const QUEST_VARBITS_URL =
    "https://raw.githubusercontent.com/Zoinkwiz/quest-helper/master/src/main/java/com/questhelper/questinfo/QuestVarbits.java";
const VARBIT_ID_URL =
    "https://raw.githubusercontent.com/runelite/runelite/master/runelite-api/src/main/java/net/runelite/api/gameval/VarbitID.java";

const TITLE_OVERRIDES: Record<string, string> = {
    QUEST_X_MARKS_THE_SPOT: "X Marks the Spot",
    QUEST_THE_CORSAIR_CURSE: "The Corsair Curse",
    QUEST_MISTHALIN_MYSTERY: "Misthalin Mystery",
    QUEST_THE_IDES_OF_MILK: "The Ides of Milk",
    QUEST_BELOW_ICE_MOUNTAIN: "Below Ice Mountain",
    QUEST_FAIRYTALE_I_GROWING_PAINS: "Fairytale I - Growing Pains",
    QUEST_FAIRYTALE_II_CURE_A_QUEEN: "Fairytale II - Cure a Queen",
    QUEST_IN_AID_OF_THE_MYREQUE: "In Aid of the Myreque",
    QUEST_MOURNINGS_END_PART_II: "Mourning's End Part II",
    QUEST_RECIPE_FOR_DISASTER: "Recipe for Disaster",
    QUEST_RECIPE_FOR_DISASTER_DWARF: "Recipe for Disaster/Freeing the Mountain Dwarf",
    QUEST_RECIPE_FOR_DISASTER_WARTFACE_AND_BENTNOZE: "Recipe for Disaster/Freeing the Goblin generals",
    QUEST_RECIPE_FOR_DISASTER_PIRATE_PETE: "Recipe for Disaster/Freeing Pirate Pete",
    QUEST_RECIPE_FOR_DISASTER_LUMBRIDGE_GUIDE: "Recipe for Disaster/Freeing the Lumbridge Guide",
    QUEST_RECIPE_FOR_DISASTER_EVIL_DAVE: "Recipe for Disaster/Freeing Evil Dave",
    QUEST_RECIPE_FOR_DISASTER_SIR_AMIK_VARZE: "Recipe for Disaster/Freeing Sir Amik Varze",
    QUEST_RECIPE_FOR_DISASTER_SKRACH_UGLOGWEE: "Recipe for Disaster/Freeing Skrach Uglogwee",
    QUEST_RECIPE_FOR_DISASTER_MONKEY_AMBASSADOR: "Recipe for Disaster/Freeing King Awowogei",
    QUEST_DESERT_TREASURE: "Desert Treasure I",
    QUEST_DESERT_TREASURE_II: "Desert Treasure II - The Fallen Empire",
    QUEST_THE_RIBBITING_TALE_OF_A_LILY_PAD_LABOUR_DISPUTE:
        "The Ribbiting Tale of a Lily Pad Labour Dispute",
    QUEST_CURSE_OF_THE_EMPTY_LORD: "Curse of the Empty Lord",
    QUEST_THE_MAGE_ARENA_II: "Mage Arena II",
    QUEST_IN_SEARCH_OF_KNOWLEDGE: "In Search of Knowledge",
    QUEST_KINGS_RANSOM: "King's Ransom",
    QUEST_OLAFS_QUEST: "Olaf's Quest",
    QUEST_RUM_DEAL: "Rum Deal",
    QUEST_VALE_TOTEMS: "Vale Totems (miniquest)",
    QUEST_DADDYS_HOME: "Daddy's Home",
    HIS_FAITHFUL_SERVANTS: "His Faithful Servants",
    QUEST_TWILIGHTS_PROMISE: "Twilight's Promise",
};

const MANUAL_VARBIT_ENTRIES: Record<string, { varbitConst: string; source: string }> = {
    "into the tombs": { varbitConst: "ITT", source: "manual:ITT" },
    "recipe for disaster/another cook's quest": {
        varbitConst: "HUNDRED_MAIN_QUEST_VAR",
        source: "manual:RFD-intro",
    },
    "recipe for disaster/defeating the culinaromancer": {
        varbitConst: "HUNDRED_MAIN_QUEST_VAR",
        source: "manual:RFD-finale",
    },
    "twilight's promise": { varbitConst: "VMQ2", source: "manual:VMQ2" },
    "the frozen door": { varbitConst: "FROZEN_DOOR", source: "manual:FROZEN_DOOR" },
};

function normalizeTitle(title: string): string {
    return title
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/['']/g, "'")
        .replace(/[^a-z0-9']+/g, " ")
        .trim();
}

function enumToTitle(enumName: string): string {
    if (TITLE_OVERRIDES[enumName]) return TITLE_OVERRIDES[enumName];
    const stripped = enumName.replace(/^(?:QUEST_)/, "");
    const words = stripped.toLowerCase().split("_").filter(Boolean);
    const roman = new Set(["i", "ii", "iii", "iv"]);
    return words
        .map((word, index) => {
            if (roman.has(word) && index > 0) return word.toUpperCase();
            if (word === "and") return "&";
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(" ")
        .replace(" & ", " & ")
        .replace(/ Ii/g, " II");
}

async function loadCached(url: string, filename: string): Promise<string> {
    const cached = path.join(REF_DIR, filename);
    if (fs.existsSync(cached)) return fs.readFileSync(cached, "utf8");
    const res = await fetch(url);
    const text = await res.text();
    fs.writeFileSync(cached, text);
    return text;
}

function parseVarbitIds(source: string): Map<string, number> {
    const map = new Map<string, number>();
    for (const match of source.matchAll(/public static final int ([A-Z0-9_]+) = (\d+);/g)) {
        map.set(match[1], Number(match[2]));
    }
    return map;
}

async function main(): Promise<void> {
    const questVarbitsSource = await loadCached(QUEST_VARBITS_URL, "QuestVarbits.java");
    const varbitIdSource = await loadCached(VARBIT_ID_URL, "VarbitID.java");
    const varbitIds = parseVarbitIds(varbitIdSource);

    const resolved = JSON.parse(
        fs.readFileSync(path.join(REF_DIR, "resolved-quests.json"), "utf8"),
    ) as { quests: Array<{ title: string }> };
    const titleByNorm = new Map(resolved.quests.map((q) => [normalizeTitle(q.title), q.title]));

    const quests: Record<
        string,
        { varpId: -1; progressVarbitId: number; startedValue: number; completionValue: number; source: string }
    > = {};

    for (const match of questVarbitsSource.matchAll(
        /(?:QUEST_[A-Z0-9_]+|HIS_FAITHFUL_SERVANTS)\(VarbitID\.([A-Z0-9_]+)\)/g,
    )) {
        const full = match[0];
        const enumName = full.slice(0, full.indexOf("("));
        if (enumName.includes("ACHIEVEMENT_DIARY") || enumName.includes("BALLOON_")) continue;

        const varbitConst = match[1];
        const varbitId = varbitIds.get(varbitConst);
        if (varbitId === undefined) continue;

        const guessedTitle = enumToTitle(enumName);
        const key = normalizeTitle(guessedTitle);
        let title = titleByNorm.get(key);
        if (!title) {
            // Fuzzy: find resolved title with best token overlap
            const tokens = new Set(key.split(" ").filter((t) => t.length > 2));
            let best: string | undefined;
            let bestScore = 0;
            for (const [norm, display] of titleByNorm) {
                let score = 0;
                for (const token of tokens) {
                    if (norm.includes(token)) score++;
                }
                if (score > bestScore) {
                    bestScore = score;
                    best = display;
                }
            }
            if (best && bestScore >= 2) title = best;
        }
        if (!title) continue;

        quests[normalizeTitle(title)] = {
            varpId: -1,
            progressVarbitId: varbitId,
            startedValue: 1,
            completionValue: 100,
            source: `quest-helper:${enumName}`,
        };
    }

    for (const [normTitle, entry] of Object.entries(MANUAL_VARBIT_ENTRIES)) {
        const varbitId = varbitIds.get(entry.varbitConst);
        if (varbitId === undefined) continue;
        quests[normalizeTitle(normTitle)] = {
            varpId: -1,
            progressVarbitId: varbitId,
            startedValue: 1,
            completionValue: 100,
            source: entry.source,
        };
    }

    fs.writeFileSync(
        OUT_PATH,
        JSON.stringify(
            {
                meta: {
                    generatedAt: new Date().toISOString(),
                    count: Object.keys(quests).length,
                },
                quests,
            },
            null,
            2,
        ),
    );
    console.log(`[build-quest-varbit-map] wrote ${OUT_PATH} (${Object.keys(quests).length} entries)`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
