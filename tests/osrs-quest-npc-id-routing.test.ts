import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

import {
    applyQuestDialogueChoice,
    createOsrsQuestBridgeRuntimeForTests,
    resolveQuestDialogueByGameNpcId,
} from "../server/gamemodes/vanilla/quests/osrsQuestBridge";

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
    try {
        fn();
    } catch (error) {
        failed++;
        const detail = `${name} — threw: ${error instanceof Error ? error.message : String(error)}`;
        failures.push(`${currentDescribe} > ${detail}`);
        console.error(`  FAIL: ${detail}`);
    }
}

async function loadQuestEngineFixture(): Promise<
    | {
          questEngine: {
              createQuestDatabase: (input: unknown) => unknown;
              createPlayerState: () => Record<string, unknown>;
          };
      }
    | undefined
> {
    const packageDir =
        process.env.XRSPS_OSRS_QUEST_PACKAGE_DIR ??
        "/home/ggwp/osrs-server/work/quest-package/osrs-quest-system";
    const questEnginePath = path.join(packageDir, "src", "questEngine.js");
    if (!fs.existsSync(questEnginePath)) {
        return undefined;
    }
    const moduleUrl = pathToFileURL(questEnginePath).href;
    const imported = await import(moduleUrl);
    if (!imported.createQuestDatabase || !imported.createPlayerState) {
        return undefined;
    }
    return {
        questEngine: imported as {
            createQuestDatabase: (input: unknown) => unknown;
            createPlayerState: () => Record<string, unknown>;
        },
    };
}

function buildFixtureDatabase(questEngine: {
    createQuestDatabase: (input: unknown) => unknown;
}): unknown {
    return questEngine.createQuestDatabase({
        quests: [
            {
                id: "numeric_routing_demo",
                name: "Numeric Routing Demo",
                title: "Numeric Routing Demo",
                type: "quest",
                order: 1,
                sourceUrl: "https://example.invalid/numeric-routing-demo",
                participants: [],
            },
        ],
        npcs: [
            {
                id: "demo_quest_npc",
                name: "This Name Is Ignored For Routing",
                entityType: "npc",
                gameNpcIds: [7001, 7002],
                primaryGameNpcId: 7001,
                quests: [],
            },
        ],
        dialogues: [
            {
                id: "numeric_routing_demo.start",
                questId: "numeric_routing_demo",
                questName: "Numeric Routing Demo",
                npcId: "demo_quest_npc",
                npcName: "This Name Is Ignored For Routing",
                gameNpcIds: [7001, 7002],
                primaryGameNpcId: 7001,
                roles: ["start"],
                nodes: [
                    {
                        id: "numeric_routing_demo__demo_quest_npc.start.not_started",
                        when: { questState: "not_started" },
                        speaker: "Quest NPC",
                        text: "Start the quest?",
                        choices: [
                            {
                                id: "accept",
                                text: "Yes, start it.",
                                actions: [
                                    {
                                        type: "startQuest",
                                        questId: "numeric_routing_demo",
                                        stage: 10,
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        id: "numeric_routing_demo__demo_quest_npc.helper.in_progress",
                        when: { questState: "in_progress", questReady: false },
                        speaker: "Quest NPC",
                        text: "You're in progress. Mark quest as ready?",
                        choices: [
                            {
                                id: "mark_ready",
                                text: "Mark ready.",
                                actions: [
                                    {
                                        type: "advanceQuestStage",
                                        questId: "numeric_routing_demo",
                                        stage: 50,
                                    },
                                    {
                                        type: "setQuestReady",
                                        questId: "numeric_routing_demo",
                                        ready: true,
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        id: "numeric_routing_demo__demo_quest_npc.turn_in.ready",
                        when: { questState: "in_progress", questReady: true },
                        speaker: "Quest NPC",
                        text: "Ready to complete?",
                        choices: [
                            {
                                id: "complete",
                                text: "Complete quest.",
                                actions: [
                                    {
                                        type: "completeQuest",
                                        questId: "numeric_routing_demo",
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        ],
        scripts: [],
    });
}

async function main(): Promise<void> {
    const fixture = await loadQuestEngineFixture();
    if (!fixture) {
        describe("OSRS quest package fixture", () => {
            it("skipped (questEngine.js package not found)", () => {
                assert(true, "skipped");
            });
        });
        reportAndExit();
        return;
    }

    const database = buildFixtureDatabase(fixture.questEngine);
    const runtime = createOsrsQuestBridgeRuntimeForTests(
        fixture.questEngine as never,
        database as never,
    );

    describe("numeric NPC routing", () => {
        it("does not require NPC name lookup", () => {
            const playerState = fixture.questEngine.createPlayerState();
            const result = resolveQuestDialogueByGameNpcId(
                runtime,
                playerState as never,
                7001,
                undefined,
            );
            assertEqual(result.status, "ok", "status is ok");
            if (result.status !== "ok") return;
            assertEqual(
                result.node.nodeId,
                "numeric_routing_demo__demo_quest_npc.start.not_started",
                "start node resolved by numeric id",
            );
        });

        it("any variant id in gameNpcIds can resolve dialogue", () => {
            const playerState = fixture.questEngine.createPlayerState();
            const result = resolveQuestDialogueByGameNpcId(
                runtime,
                playerState as never,
                7002,
                undefined,
            );
            assertEqual(result.status, "ok", "variant id status is ok");
        });

        it("quest can start, advance, and complete via numeric npc interactions", () => {
            const playerState = fixture.questEngine.createPlayerState();

            const start = resolveQuestDialogueByGameNpcId(runtime, playerState as never, 7001);
            assertEqual(start.status, "ok", "start node found");
            if (start.status !== "ok") return;
            applyQuestDialogueChoice(runtime, playerState as never, start.node.nodeId, "accept");

            const afterStart = (playerState.quests as Record<string, Record<string, unknown>>)[
                "numeric_routing_demo"
            ];
            assertEqual(afterStart.state, "in_progress", "quest started");
            assert((afterStart.stage as number) >= 10, "stage advanced on start");

            const progress = resolveQuestDialogueByGameNpcId(runtime, playerState as never, 7002);
            assertEqual(progress.status, "ok", "progress node found via variant id");
            if (progress.status !== "ok") return;
            assertEqual(
                progress.node.nodeId,
                "numeric_routing_demo__demo_quest_npc.helper.in_progress",
                "progress node selected",
            );
            applyQuestDialogueChoice(runtime, playerState as never, progress.node.nodeId, "mark_ready");

            const ready = resolveQuestDialogueByGameNpcId(runtime, playerState as never, 7001);
            assertEqual(ready.status, "ok", "ready turn-in node found");
            if (ready.status !== "ok") return;
            assertEqual(
                ready.node.nodeId,
                "numeric_routing_demo__demo_quest_npc.turn_in.ready",
                "ready turn-in node selected",
            );
            applyQuestDialogueChoice(runtime, playerState as never, ready.node.nodeId, "complete");

            const completed = (playerState.quests as Record<string, Record<string, unknown>>)[
                "numeric_routing_demo"
            ];
            assertEqual(completed.state, "completed", "quest completed");
            assertEqual(completed.stage, 100, "completion stage set");
        });

        it("missing numeric npc ids are reported explicitly", () => {
            const playerState = fixture.questEngine.createPlayerState();
            const result = resolveQuestDialogueByGameNpcId(runtime, playerState as never, 999999);
            assertEqual(result.status, "missing_npc_id", "missing npc id status");
            if (result.status !== "missing_npc_id") return;
            assert(
                result.message.includes("999999"),
                "missing npc id message includes numeric npc id",
            );
        });
    });

    reportAndExit();
}

function reportAndExit(): void {
    console.log("\n" + "=".repeat(60));
    if (failed === 0) {
        console.log(`ALL ${passed} TESTS PASSED`);
    } else {
        console.log(`${passed} passed, ${failed} FAILED`);
        console.log("\nFailures:");
        for (const failure of failures) {
            console.log(`  - ${failure}`);
        }
    }
    console.log("=".repeat(60));
    process.exit(failed > 0 ? 1 : 0);
}

void main().catch((error) => {
    console.error(error);
    process.exit(1);
});
