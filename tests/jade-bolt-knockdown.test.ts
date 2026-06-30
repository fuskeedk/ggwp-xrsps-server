import {
    BoltEffectType,
    doesJadeBoltKnockdownLand,
    getEnchantedBoltEffect,
    getJadeBoltKnockdownEvasionChance,
} from "../server/src/game/combat/AmmoSystem";

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

function assertClose(actual: number, expected: number, tolerance: number, msg: string): void {
    if (Math.abs(actual - expected) <= tolerance) {
        passed++;
        return;
    }
    failed++;
    const detail = `${msg} — expected ~${expected}, got ${actual}`;
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
    fn();
}

describe("jade bolt knockdown", () => {
    it("registers jade bolts as knockdown with 8-tick stun", () => {
        const jade = getEnchantedBoltEffect(9237);
        assert(!!jade, "jade bolts (e) should be registered");
        assert(jade?.effectType === BoltEffectType.Knockdown, "jade should use knockdown");
        assert(jade?.stunTicks === 8, "jade stun should be 8 ticks");
    });

    it("registers jade dragon bolts (e) variants", () => {
        for (const boltId of [21934, 21935]) {
            const effect = getEnchantedBoltEffect(boltId);
            assert(!!effect, `bolt ${boltId} should be registered`);
            assert(effect?.effectType === BoltEffectType.Knockdown, `bolt ${boltId} knockdown`);
            assert(effect?.stunTicks === 8, `bolt ${boltId} stun ticks`);
        }
    });

    it("matches OSRS agility evasion samples", () => {
        assertClose(getJadeBoltKnockdownEvasionChance(1), 0, 0.0001, "level 1 evasion");
        assertClose(getJadeBoltKnockdownEvasionChance(52), 0.5, 0.01, "level 52 evasion");
        assertClose(getJadeBoltKnockdownEvasionChance(99), 1, 0.0001, "level 99 evasion");
    });

    it("always lands at agility 1 and always fails at agility 99", () => {
        assert(doesJadeBoltKnockdownLand(1, () => 0), "low agility should not evade");
        assert(!doesJadeBoltKnockdownLand(99, () => 0.99), "high agility should evade");
    });
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length > 0) {
    console.error("\nFailures:");
    for (const failure of failures) {
        console.error(`  - ${failure}`);
    }
    process.exit(1);
}
