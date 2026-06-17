import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

import type { PlayerState } from "../../../src/game/player";
import type { ScriptServices } from "../../../src/game/scripts/types";

const DEFAULT_PACKAGE_DIR = "/home/ggwp/osrs-server/work/quest-package/osrs-quest-system";
const STATE_KEY = "vanilla:osrsQuestPackageState";

export interface OsrsQuestPackagePlayerState {
    quests: Record<string, { state: string; stage: number; readyToComplete: boolean }>;
    inventory: Record<string, number>;
    skills: Record<string, number>;
    skillLevels: Record<string, number>;
    questPoints: number;
    flags: Record<string, boolean | string | number>;
    interactions: Record<string, unknown>;
    enemies: Record<string, unknown>;
    events: Array<Record<string, unknown>>;
}

export interface OsrsQuestDialogueChoice {
    id: string;
    text: string;
    response?: string;
}

export interface OsrsQuestDialogueNode {
    nodeId: string;
    questId: string;
    questName: string;
    npcId: string;
    npcName: string;
    text: string;
    choices: OsrsQuestDialogueChoice[];
}

interface OsrsQuestEngineLike {
    loadQuestDatabase: (baseUrl?: URL) => Promise<unknown>;
    createPlayerState: (seed?: Partial<OsrsQuestPackagePlayerState>) => OsrsQuestPackagePlayerState;
    getBestDialogueNodeByGameNpcId: (
        database: unknown,
        playerState: OsrsQuestPackagePlayerState,
        gameNpcId: number,
        options?: { questId?: string },
    ) => OsrsQuestDialogueNode | null;
    getNpcQuestSummaryByGameNpcId: (
        database: unknown,
        gameNpcId: number,
    ) => Array<{ id: string; name: string }>;
    applyDialogueChoice: (
        database: unknown,
        playerState: OsrsQuestPackagePlayerState,
        nodeId: string,
        choiceId: string,
    ) => { events?: Array<Record<string, unknown>> };
}

export interface OsrsQuestBridgeRuntime {
    packageDir: string;
    questEngine: OsrsQuestEngineLike;
    database: unknown;
}

export type OsrsQuestResolution =
    | { status: "ok"; node: OsrsQuestDialogueNode }
    | { status: "missing_npc_id"; message: string }
    | { status: "no_available_dialogue"; message: string }
    | { status: "invalid_npc_id"; message: string };

let runtimePromise: Promise<OsrsQuestBridgeRuntime | null> | null = null;

function cloneState(
    value: OsrsQuestPackagePlayerState | undefined,
): OsrsQuestPackagePlayerState | undefined {
    if (!value) return undefined;
    return JSON.parse(JSON.stringify(value)) as OsrsQuestPackagePlayerState;
}

export function createOsrsQuestBridgeRuntimeForTests(
    questEngine: OsrsQuestEngineLike,
    database: unknown,
): OsrsQuestBridgeRuntime {
    return {
        packageDir: "test-fixture",
        questEngine,
        database,
    };
}

export async function loadOsrsQuestBridgeRuntime(
    services: Pick<ScriptServices, "system">,
): Promise<OsrsQuestBridgeRuntime | null> {
    if (!runtimePromise) {
        runtimePromise = createRuntime(services).catch((error) => {
            services.system.logger.warn?.("[script:osrs-quest] failed to initialize quest package", error);
            return null;
        });
    }
    return runtimePromise;
}

async function createRuntime(
    services: Pick<ScriptServices, "system">,
): Promise<OsrsQuestBridgeRuntime | null> {
    const packageDir = process.env.XRSPS_OSRS_QUEST_PACKAGE_DIR ?? DEFAULT_PACKAGE_DIR;
    const questEnginePath = path.join(packageDir, "src", "questEngine.js");
    if (!fs.existsSync(questEnginePath)) {
        services.system.logger.warn?.(
            `[script:osrs-quest] quest engine not found at ${questEnginePath}. ` +
                "Set XRSPS_OSRS_QUEST_PACKAGE_DIR to enable package dialogues.",
        );
        return null;
    }

    const moduleUrl = pathToFileURL(questEnginePath).href;
    const imported = (await import(moduleUrl)) as Partial<OsrsQuestEngineLike>;
    if (
        !imported.loadQuestDatabase ||
        !imported.createPlayerState ||
        !imported.getBestDialogueNodeByGameNpcId ||
        !imported.getNpcQuestSummaryByGameNpcId ||
        !imported.applyDialogueChoice
    ) {
        services.system.logger.warn?.(
            `[script:osrs-quest] quest engine exports are incomplete at ${questEnginePath}`,
        );
        return null;
    }

    const dataUrl = pathToFileURL(path.join(packageDir, "data") + path.sep);
    const database = await imported.loadQuestDatabase(dataUrl);
    services.system.logger.info?.(
        `[script:osrs-quest] loaded package quest database from ${packageDir}`,
    );
    return {
        packageDir,
        questEngine: imported as OsrsQuestEngineLike,
        database,
    };
}

export function getOrCreateOsrsQuestPackagePlayerState(
    player: Pick<PlayerState, "gamemodeState">,
    runtime: Pick<OsrsQuestBridgeRuntime, "questEngine">,
): OsrsQuestPackagePlayerState {
    const existing = player.gamemodeState.get(STATE_KEY) as OsrsQuestPackagePlayerState | undefined;
    if (existing) return existing;
    const created = runtime.questEngine.createPlayerState();
    player.gamemodeState.set(STATE_KEY, created);
    return created;
}

export function exportOsrsQuestPackagePlayerState(
    player: Pick<PlayerState, "gamemodeState">,
): OsrsQuestPackagePlayerState | undefined {
    const state = player.gamemodeState.get(STATE_KEY) as OsrsQuestPackagePlayerState | undefined;
    return cloneState(state);
}

export function importOsrsQuestPackagePlayerState(
    player: Pick<PlayerState, "gamemodeState">,
    data: OsrsQuestPackagePlayerState | undefined,
): void {
    if (!data) {
        player.gamemodeState.delete(STATE_KEY);
        return;
    }
    player.gamemodeState.set(STATE_KEY, cloneState(data));
}

export function resolveQuestDialogueByGameNpcId(
    runtime: OsrsQuestBridgeRuntime,
    playerState: OsrsQuestPackagePlayerState,
    serverNpcId: number,
    options?: { questId?: string },
): OsrsQuestResolution {
    if (!Number.isInteger(serverNpcId) || serverNpcId < 0) {
        return {
            status: "invalid_npc_id",
            message: `Invalid NPC id for quest routing: ${String(serverNpcId)}`,
        };
    }

    const summaries = runtime.questEngine.getNpcQuestSummaryByGameNpcId(
        runtime.database,
        serverNpcId,
    );
    if (!summaries || summaries.length === 0) {
        return {
            status: "missing_npc_id",
            message: `No OSRS quest mapping found for NPC id ${serverNpcId}.`,
        };
    }

    const node = runtime.questEngine.getBestDialogueNodeByGameNpcId(
        runtime.database,
        playerState,
        serverNpcId,
        options,
    );
    if (!node) {
        return {
            status: "no_available_dialogue",
            message: `No quest dialogue available for NPC id ${serverNpcId} in current state.`,
        };
    }
    return { status: "ok", node };
}

export function applyQuestDialogueChoice(
    runtime: OsrsQuestBridgeRuntime,
    playerState: OsrsQuestPackagePlayerState,
    nodeId: string,
    choiceId: string,
): { events: Array<Record<string, unknown>> } {
    const result = runtime.questEngine.applyDialogueChoice(
        runtime.database,
        playerState,
        nodeId,
        choiceId,
    );
    return { events: Array.isArray(result.events) ? result.events : [] };
}
