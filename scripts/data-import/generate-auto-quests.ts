/**
 * Generates auto-implemented quest definitions from resolved wiki reference data.
 *
 * Prereqs: npm run data:import:quests && npm run data:build-quest-varps
 * Output:  server/gamemodes/vanilla/quests/definitions/generatedAutoQuests.ts
 */

import fs from "fs";
import path from "path";
import { PROJECT_ROOT } from "./config";

const REF_DIR = path.join(PROJECT_ROOT, "server/data/quest-reference");
const OUT_PATH = path.join(
    PROJECT_ROOT,
    "server/gamemodes/vanilla/quests/definitions/generatedAutoQuests.ts",
);
const DEFS_DIR = path.join(PROJECT_ROOT, "server/gamemodes/vanilla/quests/definitions");

type ResolvedQuest = {
    questId: string;
    title: string;
    wikiStart?: string;
    overviewHint?: string;
    startNpcGameIds: number[];
    npcs: Array<{
        name: string;
        roles: string[];
        nearestGameId?: number;
    }>;
    itemRequirements: Array<{ title: string; quantity: number; itemId?: number }>;
    questRequirements: string[];
    rewards: {
        questPoints: number;
        xp: Array<{ skill: string; amount: number }>;
        items: Array<{ title: string; quantity: number; itemId?: number }>;
    };
};

type VarpEntry = {
    varpId: number;
    progressVarbitId?: number;
    startedValue: number;
    completionValue: number;
};

const SKILL_ENUM: Record<string, string> = {
    Attack: "SkillId.Attack",
    Strength: "SkillId.Strength",
    Defence: "SkillId.Defence",
    Hitpoints: "SkillId.Hitpoints",
    Ranged: "SkillId.Ranged",
    Prayer: "SkillId.Prayer",
    Magic: "SkillId.Magic",
    Cooking: "SkillId.Cooking",
    Woodcutting: "SkillId.Woodcutting",
    Fletching: "SkillId.Fletching",
    Fishing: "SkillId.Fishing",
    Firemaking: "SkillId.Firemaking",
    Crafting: "SkillId.Crafting",
    Smithing: "SkillId.Smithing",
    Mining: "SkillId.Mining",
    Herblore: "SkillId.Herblore",
    Agility: "SkillId.Agility",
    Thieving: "SkillId.Thieving",
    Slayer: "SkillId.Slayer",
    Farming: "SkillId.Farming",
    Runecraft: "SkillId.Runecraft",
    Hunter: "SkillId.Hunter",
    Construction: "SkillId.Construction",
    Sailing: "SkillId.Sailing",
};

function normalizeTitle(title: string): string {
    return title
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/['']/g, "'")
        .replace(/[^a-z0-9']+/g, " ")
        .trim();
}

function escapeString(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function toKey(questId: string): string {
    return questId.replace(/[^a-z0-9_]+/gi, "_").toLowerCase();
}

function stripNpcLabel(name: string): string {
    return name.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function loadImplementedNames(): Set<string> {
    const names = new Set<string>();
    const addFromFile = (filePath: string) => {
        if (!fs.existsSync(filePath)) return;
        const text = fs.readFileSync(filePath, "utf8");
        for (const match of text.matchAll(/key:\s*"([^"]+)"[\s\S]{0,400}?name:\s*"([^"]+)"/g)) {
            names.add(normalizeTitle(match[2]));
        }
        for (const match of text.matchAll(
            /export const \w+Quest[\s\S]{0,200}?name:\s*"([^"]+)"/g,
        )) {
            names.add(normalizeTitle(match[1]));
        }
    };

    for (const file of fs.readdirSync(DEFS_DIR)) {
        if (!file.endsWith(".ts") || file === "generatedAutoQuests.ts") continue;
        addFromFile(path.join(DEFS_DIR, file));
    }

    for (const dir of fs.readdirSync(DEFS_DIR, { withFileTypes: true })) {
        if (!dir.isDirectory()) continue;
        addFromFile(path.join(DEFS_DIR, dir.name, "index.ts"));
    }

    return names;
}

function lookupProgress(
    title: string,
    varpMap: Record<string, VarpEntry>,
    varbitMap: Record<string, VarpEntry>,
): VarpEntry | undefined {
    const key = normalizeTitle(title);
    const aliases = [
        key,
        key.replace(/\s+i$/, ""),
        key.replace(/\s+ii - .*$/, "").replace(/\s+ii$/, ""),
        key.replace(/\s+quest$/, ""),
    ];
    for (const alias of aliases) {
        if (varpMap[alias]?.varpId >= 0) return varpMap[alias];
    }
    for (const alias of aliases) {
        if (varbitMap[alias]?.progressVarbitId !== undefined) return varbitMap[alias];
    }
    return undefined;
}

function buildQuestBlock(quest: ResolvedQuest, varp: VarpEntry): string {
    const key = toKey(quest.questId);
    const startNpcId = quest.startNpcGameIds[0];
    const startNpcName = stripNpcLabel(
        quest.npcs.find((n) => n.roles.includes("start"))?.name ??
            quest.npcs.find((n) => n.nearestGameId === startNpcId)?.name ??
            "Quest NPC",
    );

    const helperNpcs = quest.npcs
        .filter(
            (n) =>
                (n.roles.includes("helper") || n.roles.includes("turn_in")) &&
                n.nearestGameId &&
                n.nearestGameId !== startNpcId,
        )
        .slice(0, 3);

    const finishNpc = quest.npcs.find((n) => n.roles.includes("turn_in") && n.nearestGameId);
    const finishNpcId = finishNpc?.nearestGameId ?? startNpcId;
    const finishNpcName = stripNpcLabel(finishNpc?.name ?? startNpcName);

    const itemReqs = quest.itemRequirements
        .filter((item) => item.itemId !== undefined)
        .slice(0, 6)
        .map(
            (item) =>
                `{ itemId: ${item.itemId}, quantity: ${item.quantity}, journalLabel: "${escapeString(`${item.quantity} ${item.title}`)}" }`,
        );

    const xpRewards = quest.rewards.xp
        .filter((xp) => SKILL_ENUM[xp.skill])
        .slice(0, 4)
        .map(
            (xp) =>
                `{ skillId: ${SKILL_ENUM[xp.skill]}, amount: ${xp.amount}, label: "${escapeString(xp.skill)}" }`,
        );

    const itemRewards = quest.rewards.items
        .filter((item) => item.itemId !== undefined)
        .slice(0, 3)
        .map(
            (item) =>
                `{ itemId: ${item.itemId}, quantity: ${item.quantity}, label: "${escapeString(`${item.quantity} ${item.title}`)}" }`,
        );

    const rewardItemId = quest.rewards.items.find((item) => item.itemId !== undefined)?.itemId;
    const overview =
        quest.overviewHint ??
        `helping with <col=800000>${escapeString(startNpcName)}</col> and their troubles.`;
    const startText =
        quest.wikiStart ??
        `${startNpcName} needs help with something important.`;
    const journalIntro = `I can start this quest by talking to ${startNpcName}.`;

    const steps = helperNpcs.map((npc, index) => {
        const flag = `step_${index + 1}`;
        const npcId = npc.nearestGameId!;
        const npcName = stripNpcLabel(npc.name);
        return `        { npc: { id: ${npcId}, name: "${escapeString(npcName)}" }, flag: "${flag}", line: "I should speak with ${escapeString(npcName)}." }`;
    });

    let prereqBlock = "";
    if (quest.questRequirements.length > 0) {
        const prereqTitle = quest.questRequirements[0];
        const prereqKey = toKey(
            prereqTitle
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "_")
                .replace(/^_+|_+$/g, ""),
        );
        prereqBlock = `
    prereq: (player) => getQuestStage(player, { varpId: ${varp.varpId} } as never) >= 0 || player.varps.getVarpValue(0) >= 0,
    prereqText: "You must complete ${escapeString(prereqTitle)} first.",
`;
        // Better prereq: use isVarpAtLeast with mapped prereq varp - skip for now if complex
        void prereqKey;
        prereqBlock = "";
    }

    return `const ${key}Quest = autoQuest({
    key: "${key}",
    name: "${escapeString(quest.title)}",
    varpId: ${varp.varpId},${
        varp.progressVarbitId !== undefined
            ? `\n    progressVarbitId: ${varp.progressVarbitId},`
            : ""
    }
    startedValue: ${varp.startedValue},
    completionValue: ${varp.completionValue},
    rewards: {
        questPoints: ${quest.rewards.questPoints || 1},${
            xpRewards.length > 0 ? `\n        xp: [\n            ${xpRewards.join(",\n            ")},\n        ],` : ""
        }${
            itemRewards.length > 0
                ? `\n        items: [\n            ${itemRewards.join(",\n            ")},\n        ],`
                : ""
        }
    },${rewardItemId !== undefined ? `\n    rewardItemId: ${rewardItemId},` : ""}
    overviewStartText: "${escapeString(overview)}",
    startNpc: { id: ${startNpcId}, name: "${escapeString(startNpcName)}" },
    startText: "${escapeString(startText)}",
    steps: [
${steps.join(",\n")}
    ],
    finishNpc: { id: ${finishNpcId}, name: "${escapeString(finishNpcName)}" },
    finishText: "Excellent work! You've done everything I needed.",
    journalIntro: "${escapeString(journalIntro)}",
    journalDone: [
        "I helped complete the quest.",
        "The task is finished.",
    ],${
        itemReqs.length > 0
            ? `\n    itemRequirements: [\n        ${itemReqs.join(",\n        ")},\n    ],`
            : ""
    }${prereqBlock}
});`;
}

function main(): void {
    const resolved = JSON.parse(fs.readFileSync(path.join(REF_DIR, "resolved-quests.json"), "utf8")) as {
        quests: ResolvedQuest[];
    };
    const varpMap = JSON.parse(fs.readFileSync(path.join(REF_DIR, "quest-varp-map.json"), "utf8")) as {
        quests: Record<string, VarpEntry>;
    };
    const varbitMapPath = path.join(REF_DIR, "quest-varbit-map.json");
    const varbitMap = fs.existsSync(varbitMapPath)
        ? (JSON.parse(fs.readFileSync(varbitMapPath, "utf8")) as { quests: Record<string, VarpEntry> })
        : { quests: {} as Record<string, VarpEntry> };

    const implemented = loadImplementedNames();
    const generated: ResolvedQuest[] = [];

    for (const quest of resolved.quests) {
        if (implemented.has(normalizeTitle(quest.title))) continue;
        if (quest.startNpcGameIds.length === 0) continue;
        const progress = lookupProgress(quest.title, varpMap.quests, varbitMap.quests);
        if (!progress) continue;
        if (progress.varpId < 0 && progress.progressVarbitId === undefined) continue;
        generated.push(quest);
    }

    generated.sort((a, b) => a.title.localeCompare(b.title));

    const blocks = generated.map((quest) => {
        const progress = lookupProgress(quest.title, varpMap.quests, varbitMap.quests)!;
        return buildQuestBlock(quest, progress);
    });

    const exportNames = generated.map((q) => `${toKey(q.questId)}Quest`);
    const usesSkillId = generated.some((q) => q.rewards.xp.some((xp) => SKILL_ENUM[xp.skill]));

    const file = `// AUTO-GENERATED by scripts/data-import/generate-auto-quests.ts — do not edit manually.
// Shared-NPC start yields: server/gamemodes/vanilla/quests/questAutoQuestOverrides.ts
${usesSkillId ? 'import { SkillId } from "../../../../../src/rs/skill/skills";\n' : ""}import { autoQuest } from "./questFactory";

${blocks.join("\n\n")}

export const generatedAutoQuests = [
    ${exportNames.join(",\n    ")},
];
`;

    fs.writeFileSync(OUT_PATH, file);
    console.log(`[generate-auto-quests] wrote ${OUT_PATH} (${generated.length} quests)`);
}

main();
