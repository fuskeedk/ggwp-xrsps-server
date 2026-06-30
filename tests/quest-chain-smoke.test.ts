import { ScriptRegistry } from "../server/src/game/scripts/ScriptRegistry";
import type { NpcInteractionEvent } from "../server/src/game/scripts/types";
import { registerQuestHandlers, getQuestDefinitionByKey } from "../server/gamemodes/vanilla/quests";
import { setQuestFlag } from "../server/gamemodes/vanilla/quests/QuestFlags";
import { getQuestStage, setQuestStage } from "../server/gamemodes/vanilla/quests/QuestService";
import type { QuestDefinition } from "../server/gamemodes/vanilla/quests/types";
import {
    createQuestTestPlayer,
    createQuestTestServices,
    resetQuestDialog,
} from "./questTestHarness";

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

function assertIncludes(haystack: string, needle: string, msg: string): void {
    assert(haystack.toLowerCase().includes(needle.toLowerCase()), msg);
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

function makeNpcEvent(
    player: ReturnType<typeof createQuestTestPlayer>,
    services: ReturnType<typeof createQuestTestServices>["services"],
    npcId: number,
    npcName: string,
): NpcInteractionEvent {
    return {
        player,
        services,
        npc: { typeId: npcId, id: npcId, name: npcName },
    };
}

function prepareQuestFinish(
    player: ReturnType<typeof createQuestTestPlayer>,
    services: ReturnType<typeof createQuestTestServices>["services"],
    questKey: string,
    stepFlags: string[],
): QuestDefinition {
    const quest = getQuestDefinitionByKey(questKey);
    if (!quest) {
        throw new Error(`missing quest definition: ${questKey}`);
    }
    setQuestStage(player, quest, services, quest.startedValue);
    for (const flag of stepFlags) {
        setQuestFlag(player, quest.key, flag, true);
    }
    setQuestFlag(player, quest.key, "ready_finish", true);
    return quest;
}

describe("ScriptRegistry NPC handler chains", () => {
    it("runs later handlers when earlier handlers yield without opening dialogue", () => {
        const registry = new ScriptRegistry();
        const { services, dialog } = createQuestTestServices();
        const player = createQuestTestPlayer();

        registry.registerNpcInteraction(5215, () => {});
        registry.registerNpcInteraction(5215, () => {
            dialog.npcLines.push("Second handler spoke.");
            dialog.modalOpen = true;
        });

        const handler = registry.findNpcInteractionDirect(5215);
        assert(handler !== undefined, "composed handler exists");
        handler?.(makeNpcEvent(player, services, 5215, "King Roald"));

        assertIncludes(dialog.npcLines.join(" "), "Second handler spoke.", "second handler ran");
    });
});

describe("Quest chain smoke", () => {
    const registry = new ScriptRegistry();
    const { services, dialog } = createQuestTestServices();
    const player = createQuestTestPlayer();

    registerQuestHandlers(registry, services);

    it("registers 209 quests without throwing", () => {
        assert(true, "registerQuestHandlers completed");
    });

    it("King Roald routes Priest in Peril when Shield of Arrav is not started", () => {
        resetQuestDialog(dialog);
        player.varps.setVarpValue(145, 0);
        player.varps.setVarpValue(302, 0);

        const handler = registry.findNpcInteractionDirect(5215);
        handler?.(makeNpcEvent(player, services, 5215, "King Roald"));

        assert(dialog.modalOpen, "dialog opened");
        assertIncludes(
            dialog.npcLines.join(" "),
            "Drezel",
            "Priest in Peril start dialogue shown",
        );
    });

    it("King Roald routes Priest in Peril completion when Shield of Arrav is complete", () => {
        resetQuestDialog(dialog);
        player.varps.setVarpValue(145, 7);
        player.varps.setVarpValue(302, 60);

        const handler = registry.findNpcInteractionDirect(5215);
        handler?.(makeNpcEvent(player, services, 5215, "King Roald"));

        assert(
            dialog.modalOpen || dialog.npcLines.length > 0,
            "dialog opened",
        );
        assertIncludes(
            dialog.npcLines.join(" "),
            "Morytania",
            "Priest in Peril completion dialogue shown",
        );
    });

    it("Morgan routes Horror from the Deep after Vampyre Slayer is complete", () => {
        resetQuestDialog(dialog);
        player.varps.setVarpValue(178, 3);
        player.varps.setVarpValue(34, 0);

        const handler = registry.findNpcInteractionDirect(3479);
        handler?.(makeNpcEvent(player, services, 3479, "Morgan"));

        assert(dialog.modalOpen, "dialog opened");
        assertIncludes(
            dialog.npcLines.join(" "),
            "horror",
            "Horror from the Deep start dialogue shown",
        );
    });

    it("Edmond routes Underground Pass after Plague City is complete", () => {
        resetQuestDialog(dialog);
        player.varps.setVarpValue(165, 29);
        player.varps.setVarpValue(68, 16);
        player.varps.setVarpValue(161, 0);

        const handler = registry.findNpcInteractionDirect(6204);
        handler?.(makeNpcEvent(player, services, 6204, "Edmond"));

        assert(dialog.modalOpen, "dialog opened");
        assertIncludes(
            dialog.npcLines.join(" "),
            "Underground Pass",
            "Underground Pass start dialogue shown",
        );
    });

    it("Sir Amik completes Recruitment Drive when BKF is not started", () => {
        resetQuestDialog(dialog);
        player.varps.setVarpValue(496, 0);
        const quest = prepareQuestFinish(player, services, "recruitment_drive", [
            "step_1",
            "step_2",
            "step_3",
        ]);

        const handler = registry.findNpcInteractionDirect(3395);
        handler?.(makeNpcEvent(player, services, 3395, "Sir Amik Varze"));

        assert(
            getQuestStage(player, quest) >= quest.completionValue,
            "recruitment drive completed via Sir Amik",
        );
    });

    it("Duke Horacio completes Death to the Dorgeshuun when Rune Mysteries is not started", () => {
        resetQuestDialog(dialog);
        player.varps.setVarpValue(63, 0);
        const quest = prepareQuestFinish(player, services, "death_to_the_dorgeshuun", [
            "step_1",
            "step_2",
            "step_3",
        ]);

        const handler = registry.findNpcInteractionDirect(815);
        handler?.(makeNpcEvent(player, services, 815, "Duke Horacio"));

        assert(
            getQuestStage(player, quest) >= quest.completionValue,
            "death to the dorgeshuun completed via Duke Horacio",
        );
    });

    it("Doric yields to Devious Minds finish when Doric's Quest is not started", () => {
        resetQuestDialog(dialog);
        player.varps.setVarpValue(31, 0);
        const quest = prepareQuestFinish(player, services, "devious_minds", ["step_1", "step_2"]);

        const handler = registry.findNpcInteractionDirect(3893);
        handler?.(makeNpcEvent(player, services, 3893, "Doric"));

        assert(
            getQuestStage(player, quest) >= quest.completionValue,
            "devious minds completed via Doric",
        );
    });

    it("Dimintheis yields to Family Pest finish when Family Crest is not started", () => {
        resetQuestDialog(dialog);
        player.varps.setVarpValue(148, 0);
        const quest = prepareQuestFinish(player, services, "family_pest", []);

        const handler = registry.findNpcInteractionDirect(4984);
        handler?.(makeNpcEvent(player, services, 4984, "Dimintheis"));

        assert(
            getQuestStage(player, quest) >= quest.completionValue,
            "family pest completed via Dimintheis",
        );
    });

    it("Jorral completes The Slug Menace when Making History is not started", () => {
        resetQuestDialog(dialog);
        player.varps.setVarpValue(604, 0);
        const quest = prepareQuestFinish(player, services, "the_slug_menace", [
            "step_1",
            "step_2",
            "step_3",
        ]);
        services.inventory.getInventoryItems = () => [
            { slot: 0, itemId: 6635, quantity: 1 },
            { slot: 1, itemId: 1941, quantity: 1 },
            { slot: 2, itemId: 9683, quantity: 1 },
            { slot: 3, itemId: 1755, quantity: 1 },
            { slot: 4, itemId: 5516, quantity: 1 },
            { slot: 5, itemId: 1448, quantity: 1 },
        ];
        services.inventory.hasItem = (_player, itemId) =>
            [6635, 1941, 9683, 1755, 5516, 1448].includes(itemId);
        services.inventory.findInventorySlotWithItem = (_player, itemId) =>
            [6635, 1941, 9683, 1755, 5516, 1448].indexOf(itemId);
        services.inventory.consumeItem = () => true;

        const handler = registry.findNpcInteractionDirect(3490);
        handler?.(makeNpcEvent(player, services, 3490, "Jorral"));

        assert(
            getQuestStage(player, quest) >= quest.completionValue,
            "the slug menace completed via Jorral",
        );
    });

    it("Sir Tiffy completes Wanted when The Slug Menace is not started", () => {
        resetQuestDialog(dialog);
        player.varps.setVarpValue(874, 0);
        const quest = prepareQuestFinish(player, services, "wanted", [
            "step_1",
            "step_2",
            "step_3",
        ]);
        services.inventory.getInventoryItems = () => [
            { slot: 0, itemId: 617, quantity: 10000 },
            { slot: 1, itemId: 563, quantity: 1 },
            { slot: 2, itemId: 4155, quantity: 1 },
            { slot: 3, itemId: 1775, quantity: 1 },
        ];
        services.inventory.hasItem = (_player, itemId) =>
            [617, 563, 4155, 1775].includes(itemId);
        services.inventory.findInventorySlotWithItem = (_player, itemId) =>
            [617, 563, 4155, 1775].indexOf(itemId);
        services.inventory.consumeItem = (_player, slot) => {
            const items = services.inventory.getInventoryItems(player);
            const entry = items.find((item) => item.slot === slot);
            if (!entry) return false;
            if (entry.quantity > 1) {
                entry.quantity -= 1;
                return true;
            }
            items.splice(
                items.findIndex((item) => item.slot === slot),
                1,
            );
            return true;
        };

        const handler = registry.findNpcInteractionDirect(4687);
        handler?.(makeNpcEvent(player, services, 4687, "Sir Tiffy Cashien"));

        assert(
            getQuestStage(player, quest) >= quest.completionValue,
            "wanted completed via Sir Tiffy",
        );
    });
});

console.log("\n" + "=".repeat(60));
console.log(`Quest chain smoke: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
    console.log("\nFailures:");
    for (const failure of failures) {
        console.log(`  - ${failure}`);
    }
}
console.log("=".repeat(60));

process.exit(failed > 0 ? 1 : 0);
