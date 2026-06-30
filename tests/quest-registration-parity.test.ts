import { validateQuestRegistration } from "../server/gamemodes/vanilla/quests/questRegistrationParity";

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

describe("Quest registration parity", () => {
    it("registers all 209 reference quests without duplicates", () => {
        const report = validateQuestRegistration();

        assertEqual(report.registeredCount, 209, "registered quest count");
        assertEqual(report.referenceCount, 209, "reference quest count");
        assertEqual(report.miniquestCount, 19, "reference miniquest count");
        assertEqual(report.missingFromRegistered.length, 0, "missing reference quests");
        assertEqual(report.extraRegistered.length, 0, "extra registered quests");
        assertEqual(report.duplicateKeys.length, 0, "duplicate quest keys");
    });
});

console.log("\n" + "=".repeat(60));
console.log(`Quest registration parity: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
    console.log("\nFailures:");
    for (const failure of failures) {
        console.log(`  - ${failure}`);
    }
}
console.log("=".repeat(60));

process.exit(failed > 0 ? 1 : 0);
