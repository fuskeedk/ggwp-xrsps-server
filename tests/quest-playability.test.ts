import fs from "fs";
import path from "path";

import {
    buildQuestPlayabilityMatrix,
    buildQuestChainCatalog,
} from "../server/gamemodes/vanilla/quests/questPlayabilityMatrix";
import { getQuestDefinitionList } from "../server/gamemodes/vanilla/quests";

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

function assertEqual<T>(actual: T, expected: T, msg: string): void {
    if (actual === expected) {
        passed++;
        return;
    }
    failed++;
    const detail = `${msg} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
    failures.push(`${currentDescribe} > ${currentIt} — ${detail}`);
    console.error(`  FAIL: ${detail}`);
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

describe("quest playability matrix", () => {
    it("covers all registered quests", () => {
        const matrix = buildQuestPlayabilityMatrix();
        assertEqual(matrix.totalQuests, getQuestDefinitionList().length, "matrix size");
        assertEqual(matrix.entries.length, matrix.totalQuests, "entry count");
    });

    it("maps factory quest chains for generated and simple quests", () => {
        const catalog = buildQuestChainCatalog();
        assert(catalog.has("a_kingdom_divided"), "auto quest chain");
        assert(catalog.has("heroes_quest"), "simple quest chain");
        const auto = catalog.get("a_kingdom_divided");
        assert(!!auto?.startNpc?.id, "auto quest start npc");
        assert((auto?.steps.length ?? 0) > 0, "auto quest steps");
    });

    it("classifies all F2P catalog quests with working start dialogue", () => {
        const matrix = buildQuestPlayabilityMatrix();
        const f2p = matrix.entries.filter((entry) => entry.f2pCatalog);
        assert(f2p.length >= 18, "f2p catalog count");
        for (const entry of f2p) {
            assertEqual(entry.start, "pass", `${entry.name} start dialogue`);
            assert(entry.tier !== "broken", `${entry.name} should not be broken wiring`);
        }
    });

    it("has zero broken wiring across all quests", () => {
        const matrix = buildQuestPlayabilityMatrix();
        assertEqual(matrix.summary.broken, 0, "broken tier count");
        assertEqual(matrix.summary.osrsWiringBroken, 0, "osrs wiring broken count");
        const broken = matrix.entries.filter((entry) => entry.tier === "broken");
        assert(broken.length === 0, `broken quests: ${broken.map((entry) => entry.key).join(", ")}`);
    });

    it("catalogs folder-based bespoke quests", () => {
        const catalog = buildQuestChainCatalog();
        for (const key of [
            "cooks_assistant",
            "dorics_quest",
            "dragon_slayer_i",
            "sheep_shearer",
            "knights_sword",
            "garden_of_death",
        ]) {
            const chain = catalog.get(key);
            assert(!!chain, `${key} in catalog`);
            assertEqual(chain?.implementation, "bespoke", `${key} implementation`);
        }
    });

    it("simulates loc-based Garden of Death start through finish", () => {
        const matrix = buildQuestPlayabilityMatrix();
        const entry = matrix.entries.find((quest) => quest.key === "garden_of_death");
        assert(!!entry, "garden of death entry");
        assertEqual(entry?.start, "pass", "garden of death tent start");
        assertEqual(entry?.mid, "pass", "garden of death camp mid");
        assertEqual(entry?.complete, "pass", "garden of death tent complete");
    });

    it("committed playability-matrix.json matches live matrix", () => {
        const live = buildQuestPlayabilityMatrix();
        const outputPath = path.join(
            __dirname,
            "../server/data/quest-reference/playability-matrix.json",
        );
        assert(fs.existsSync(outputPath), "committed playability-matrix.json exists");
        const committed = JSON.parse(fs.readFileSync(outputPath, "utf8")) as {
            totalQuests: number;
            summary: typeof live.summary;
            entries: Array<{
                key: string;
                start: string;
                mid: string;
                complete: string;
                tier: string;
                osrsMechanics: string;
            }>;
        };

        assertEqual(committed.totalQuests, live.totalQuests, "artifact quest count");
        assertEqual(committed.summary.broken, live.summary.broken, "broken summary");
        assertEqual(committed.summary.osrsWiringBroken, live.summary.osrsWiringBroken, "wiring summary");

        for (const entry of live.entries) {
            const saved = committed.entries.find((candidate) => candidate.key === entry.key);
            assert(!!saved, `committed entry for ${entry.key}`);
            assertEqual(saved?.start, entry.start, `${entry.key} start phase`);
            assertEqual(saved?.mid, entry.mid, `${entry.key} mid phase`);
            assertEqual(saved?.complete, entry.complete, `${entry.key} complete phase`);
            assertEqual(saved?.tier, entry.tier, `${entry.key} tier`);
            assertEqual(saved?.osrsMechanics, entry.osrsMechanics, `${entry.key} osrs mechanics`);
        }
    });

    it("playability-matrix.json has phase columns", () => {
        const outputPath = path.join(
            __dirname,
            "../server/data/quest-reference/playability-matrix.json",
        );
        const parsed = JSON.parse(fs.readFileSync(outputPath, "utf8")) as {
            totalQuests: number;
            entries: Array<{ start: string; mid: string; complete: string; osrsMechanics: string }>;
        };
        assertEqual(parsed.totalQuests, 209, "artifact quest count");
        assert(parsed.entries.every((entry) => entry.start && entry.mid && entry.complete), "phase columns");
        assert(parsed.entries.every((entry) => entry.osrsMechanics), "osrs mechanics column");
    });
});

console.log("\n" + "=".repeat(60));
console.log(`Quest playability: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
    console.log("\nFailures:");
    for (const failure of failures) {
        console.log(`  - ${failure}`);
    }
}
console.log("=".repeat(60));

process.exit(failed > 0 ? 1 : 0);
