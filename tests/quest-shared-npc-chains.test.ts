import fs from "fs";
import path from "path";

import { KNOWN_SHARED_QUEST_NPC_IDS } from "../server/gamemodes/vanilla/quests/questSharedNpcIds";

let passed = 0;
let failed = 0;
const failures: string[] = [];
let currentDescribe = "";
let currentIt = "";

function assert(condition: boolean, msg: string): void {
    if (condition) {
        passed++;
        return;
    }
    failed++;
    failures.push(`${currentDescribe} > ${currentIt} — ${msg}`);
    console.error(`  FAIL: ${msg}`);
}

function describe(name: string, fn: () => void): void {
    currentDescribe = name;
    console.log(`\n${name}`);
    fn();
}

function it(name: string, fn: () => void): void {
    currentIt = name;
    console.log(`  ${name}`);
    fn();
}

function collectRegisterQuestNpcIds(definitionsDir: string): Map<number, string[]> {
    const npcIds = new Map<number, string[]>();

    const walk = (dir: string): void => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
                continue;
            }
            if (!entry.name.endsWith(".ts")) continue;

            const source = fs.readFileSync(fullPath, "utf8");
            const relativePath = path.relative(definitionsDir, fullPath);
            for (const match of source.matchAll(/registerQuestNpcTalk\(registry,\s*(\d+)/g)) {
                const npcId = Number(match[1]);
                const files = npcIds.get(npcId) ?? [];
                files.push(relativePath);
                npcIds.set(npcId, files);
            }
        }
    };

    walk(definitionsDir);
    return npcIds;
}

describe("Quest shared NPC chains", () => {
    it("documents every bespoke shared NPC id", () => {
        const definitionsDir = path.join(__dirname, "../server/gamemodes/vanilla/quests/definitions");
        const npcIds = collectRegisterQuestNpcIds(definitionsDir);
        const shared = [...npcIds.entries()]
            .filter(([, files]) => files.length > 1)
            .map(([npcId]) => npcId)
            .sort((a, b) => a - b);

        const known = [...KNOWN_SHARED_QUEST_NPC_IDS].sort((a, b) => a - b);
        const undocumented = shared.filter((npcId) => !known.includes(npcId));
        const stale = known.filter((npcId) => !shared.includes(npcId) && !isGeneratedOnlySharedNpc(npcId));

        assert(undocumented.length === 0, `undocumented shared NPC ids: ${undocumented.join(", ")}`);
        assert(stale.length === 0, `stale known shared NPC ids: ${stale.join(", ")}`);
    });
});

/** Shared only via generatedAutoQuests questFactory registrations (not direct registerQuestNpcTalk). */
function isGeneratedOnlySharedNpc(npcId: number): boolean {
    const generatedOnly = new Set([
        1259, 1603, 3395, 3490, 3926, 4157, 4536, 4687, 5832,
    ]);
    return generatedOnly.has(npcId);
}

console.log("\n" + "=".repeat(60));
console.log(`Quest shared NPC chains: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
    console.log("\nFailures:");
    for (const failure of failures) {
        console.log(`  - ${failure}`);
    }
}
console.log("=".repeat(60));

process.exit(failed > 0 ? 1 : 0);
