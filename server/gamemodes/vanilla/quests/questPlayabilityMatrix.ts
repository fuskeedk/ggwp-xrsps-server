import fs from "fs";
import path from "path";

import { ScriptRegistry } from "../../../src/game/scripts/ScriptRegistry";
import type { NpcInteractionEvent, ScriptServices } from "../../../src/game/scripts/types";
import type { PlayerState } from "../../../src/game/player";
import { PlayerVarpState } from "../../../src/game/state/PlayerVarpState";
import { F2P_QUEST_NAMES } from "./questCatalog";
import { setQuestFlag } from "./QuestFlags";
import { getQuestDefinitionList, registerQuestHandlers } from "./index";
import { getQuestStage, setQuestStage } from "./QuestService";
import { REGISTERED_KEY_ALIASES } from "./questRegistrationParity";
import type { QuestDefinition } from "./types";

// =============================================================================
// Types
// =============================================================================

export type QuestImplementationKind =
    | "bespoke"
    | "factory-simple"
    | "factory-auto"
    | "unknown";

export type QuestPlayabilityPhase = "pass" | "fail" | "skip" | "manual";

export type QuestPlayabilityTier =
    | "full-dialog"
    | "bespoke-handcrafted"
    | "dialog-shell"
    | "broken";

export interface QuestNpcRef {
    id: number;
    name: string;
}

export interface QuestChainMeta {
    key: string;
    implementation: QuestImplementationKind;
    sourceFile: string;
    startNpc?: QuestNpcRef;
    steps: QuestNpcRef[];
    finishNpc?: QuestNpcRef;
    stepFlags: string[];
    itemRequirementCount: number;
    itemRequirements: Array<{ itemId: number; quantity: number }>;
}

export type QuestOsrsMechanics = "custom" | "dialog-chain" | "dialog-shell" | "wiring-broken";

export interface QuestPlayabilityEntry {
    key: string;
    name: string;
    referenceId: string;
    members: boolean;
    f2pCatalog: boolean;
    miniquest: boolean;
    implementation: QuestImplementationKind;
    sourceFile: string;
    startNpcId: number | null;
    stepNpcIds: number[];
    finishNpcId: number | null;
    itemRequirementCount: number;
    start: QuestPlayabilityPhase;
    mid: QuestPlayabilityPhase;
    complete: QuestPlayabilityPhase;
    tier: QuestPlayabilityTier;
    osrsMechanics: QuestOsrsMechanics;
    notes: string[];
}

export interface QuestPlayabilityMatrix {
    generatedAt: string;
    totalQuests: number;
    summary: {
        fullDialog: number;
        bespokeHandcrafted: number;
        dialogShell: number;
        broken: number;
        f2pCatalog: number;
        members: number;
    };
    entries: QuestPlayabilityEntry[];
}

type ResolvedQuest = {
    questId: string;
    title: string;
    members: boolean;
    type?: string;
    startNpcGameIds?: number[];
};

type DialogCapture = {
    modalOpen: boolean;
    npcLines: string[];
};

// =============================================================================
// Metadata extraction
// =============================================================================

const DEFINITIONS_DIR = path.join(__dirname, "definitions");

function invertAliases(): Record<string, string> {
    const inverted: Record<string, string> = {};
    for (const [registered, reference] of Object.entries(REGISTERED_KEY_ALIASES)) {
        inverted[reference] = registered;
    }
    return inverted;
}

const REFERENCE_TO_REGISTERED = invertAliases();

export function registeredKeyToReferenceId(key: string): string {
    return REGISTERED_KEY_ALIASES[key] ?? key;
}

export function referenceIdToRegisteredKey(questId: string): string {
    return REFERENCE_TO_REGISTERED[questId] ?? questId;
}

function listDefinitionFiles(dir = DEFINITIONS_DIR): string[] {
    const files: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...listDefinitionFiles(full));
        } else if (entry.isFile() && entry.name.endsWith(".ts")) {
            files.push(full);
        }
    }
    return files;
}

function extractBalancedBlock(source: string, openBraceIndex: number): string {
    let depth = 0;
    for (let i = openBraceIndex; i < source.length; i++) {
        const ch = source[i];
        if (ch === "{") depth++;
        else if (ch === "}") {
            depth--;
            if (depth === 0) {
                return source.slice(openBraceIndex, i + 1);
            }
        }
    }
    return source.slice(openBraceIndex);
}

function parseNpcRef(block: string, field: "startNpc" | "finishNpc"): QuestNpcRef | undefined {
    const match = block.match(
        new RegExp(`${field}:\\s*\\{\\s*id:\\s*(\\d+),\\s*name:\\s*"([^"]+)"\\s*\\}`),
    );
    if (!match) return undefined;
    return { id: Number(match[1]), name: match[2] };
}

function parseSteps(block: string): { steps: QuestNpcRef[]; flags: string[] } {
    const steps: QuestNpcRef[] = [];
    const flags: string[] = [];
    const stepRegex =
        /\{\s*npc:\s*\{\s*id:\s*(\d+),\s*name:\s*"([^"]+)"\s*\},\s*flag:\s*"([^"]+)"/g;
    for (const match of block.matchAll(stepRegex)) {
        steps.push({ id: Number(match[1]), name: match[2] });
        flags.push(match[3]);
    }
    return { steps, flags };
}

function parseItemRequirements(block: string): Array<{ itemId: number; quantity: number }> {
    const requirements: Array<{ itemId: number; quantity: number }> = [];
    const regex = /itemId:\s*(\d+),\s*quantity:\s*(\d+)/g;
    for (const match of block.matchAll(regex)) {
        requirements.push({ itemId: Number(match[1]), quantity: Number(match[2]) });
    }
    return requirements;
}

function countItemRequirements(block: string): number {
    return parseItemRequirements(block).length;
}

function extractFactoryChainsFromFile(filePath: string): QuestChainMeta[] {
    const source = fs.readFileSync(filePath, "utf8");
    const relative = path.relative(path.join(__dirname, "..", "..", ".."), filePath);
    const results: QuestChainMeta[] = [];
    const factoryRegex = /=\s*(simpleQuest|autoQuest)\s*\(/g;

    for (const match of source.matchAll(factoryRegex)) {
        const kind = match[1] as "simpleQuest" | "autoQuest";
        const openParen = match.index! + match[0].length - 1;
        const openBrace = source.indexOf("{", openParen);
        if (openBrace < 0) continue;
        const block = extractBalancedBlock(source, openBrace);
        const keyMatch = block.match(/key:\s*"([^"]+)"/);
        if (!keyMatch) continue;
        const { steps, flags } = parseSteps(block);
        const itemRequirements = parseItemRequirements(block);
        results.push({
            key: keyMatch[1],
            implementation: kind === "autoQuest" ? "factory-auto" : "factory-simple",
            sourceFile: relative,
            startNpc: parseNpcRef(block, "startNpc"),
            steps,
            finishNpc: parseNpcRef(block, "finishNpc"),
            stepFlags: flags,
            itemRequirementCount: itemRequirements.length,
            itemRequirements,
        });
    }

    return results;
}

function extractBespokeNpcIds(filePath: string): number[] {
    const source = fs.readFileSync(filePath, "utf8");
    const ids = new Set<number>();
    for (const match of source.matchAll(/registerQuestNpcTalk\(registry,\s*(\d+)/g)) {
        ids.add(Number(match[1]));
    }
    return [...ids];
}

function extractQuestNpcIdsForKey(key: string): number[] {
    const ids = new Set<number>();
    const pathHint = key.replace(/_/g, "").toLowerCase();

    for (const filePath of listDefinitionFiles()) {
        const source = fs.readFileSync(filePath, "utf8");
        const relative = filePath.toLowerCase();
        const keyToken = `key: "${key}"`;
        const keyIndex = source.indexOf(keyToken);
        const usesPathHint = relative.includes(pathHint);
        if (keyIndex < 0 && !usesPathHint) continue;

        const slice = keyIndex >= 0 ? source.slice(keyIndex, keyIndex + 20_000) : source;
        for (const match of slice.matchAll(/registerQuestNpcTalk\(registry,\s*(\d+)/g)) {
            ids.add(Number(match[1]));
        }
        for (const match of slice.matchAll(/registerQuestNpcTalk\(registry,\s*([A-Z_][A-Z0-9_]*)/g)) {
            const constName = match[1];
            const constMatch = source.match(new RegExp(`const ${constName} = (\\d+)`));
            if (constMatch) ids.add(Number(constMatch[1]));
        }
    }
    return [...ids];
}

function extractBespokeKeys(filePath: string): string[] {
    const source = fs.readFileSync(filePath, "utf8");
    const keys = new Set<string>();
    for (const match of source.matchAll(/key:\s*"([^"]+)"/g)) {
        keys.add(match[1]);
    }
    return [...keys];
}

export function buildQuestChainCatalog(): Map<string, QuestChainMeta> {
    const catalog = new Map<string, QuestChainMeta>();
    for (const filePath of listDefinitionFiles()) {
        const relative = path.relative(path.join(__dirname, "..", "..", ".."), filePath);
        if (relative.endsWith("questFactory.ts")) continue;

        for (const chain of extractFactoryChainsFromFile(filePath)) {
            catalog.set(chain.key, chain);
        }

        if (
            relative.includes("generatedAutoQuests.ts") ||
            relative.includes("questFactory.ts")
        ) {
            continue;
        }

        const bespokeKeys = extractBespokeKeys(filePath);
        const npcIds = extractBespokeNpcIds(filePath);
        for (const key of bespokeKeys) {
            if (catalog.has(key)) continue;
            catalog.set(key, {
                key,
                implementation: "bespoke",
                sourceFile: relative,
                steps: [],
                stepFlags: [],
                itemRequirementCount: 0,
                itemRequirements: [],
                startNpc: npcIds[0] ? { id: npcIds[0], name: "start" } : undefined,
            });
        }
    }
    return catalog;
}

function loadResolvedQuests(): ResolvedQuest[] {
    const resolvedPath = path.join(__dirname, "../../../data/quest-reference/resolved-quests.json");
    const parsed = JSON.parse(fs.readFileSync(resolvedPath, "utf8")) as { quests: ResolvedQuest[] };
    return parsed.quests;
}

function resolveReferenceQuest(
    key: string,
    name: string,
    resolved: ResolvedQuest[],
): ResolvedQuest | undefined {
    const referenceId = registeredKeyToReferenceId(key);
    return (
        resolved.find((quest) => quest.questId === referenceId) ??
        resolved.find((quest) => quest.title.toLowerCase() === name.toLowerCase())
    );
}

// =============================================================================
// Simulation
// =============================================================================

function createMatrixTestPlayer(): PlayerState {
    return {
        id: 1,
        name: "Matrix Tester",
        varps: new PlayerVarpState(),
        gamemodeState: new Map<string, unknown>(),
        displayMode: 1,
        gamemode: {
            getQuestListGroups: () => [],
        },
    } as PlayerState;
}

function buildInventory(itemRequirements: Array<{ itemId: number; quantity: number }>) {
    const inventory: Array<{ slot: number; itemId: number; quantity: number }> = [];
    let slot = 0;
    for (const req of itemRequirements) {
        inventory.push({ slot: slot++, itemId: req.itemId, quantity: req.quantity });
    }
    return inventory;
}

function createMatrixTestServices(itemRequirements: Array<{ itemId: number; quantity: number }> = []): {
    services: ScriptServices;
    dialog: DialogCapture;
} {
    const dialog: DialogCapture = { modalOpen: false, npcLines: [] };
    const inventory = buildInventory(itemRequirements);

    const services = {
        dialog: {
            openDialog(_player: PlayerState, request: {
                kind: string;
                lines?: string[];
                onContinue?: () => void;
            }) {
                dialog.modalOpen = true;
                if (request.kind === "npc" && request.lines) {
                    dialog.npcLines.push(...request.lines);
                    request.onContinue?.();
                }
            },
            openDialogOptions(_player: PlayerState, request: {
                options?: string[];
                onSelect?: (choice: number) => void;
            }) {
                dialog.modalOpen = true;
                if (request.options?.length) {
                    request.onSelect?.(0);
                }
            },
            openSkillMulti() {},
            closeDialog() {
                dialog.modalOpen = false;
            },
            closeInterruptibleInterfaces() {},
            openSubInterface() {},
            closeSubInterface() {},
            closeModal() {
                dialog.modalOpen = false;
            },
            getInterfaceService() {
                return {
                    getCurrentChatboxModal: () => (dialog.modalOpen ? 162 : undefined),
                };
            },
            openRemainingTabs() {},
            queueClientScript() {},
            queueWidgetEvent() {},
        },
        variables: {
            sendVarp() {},
            sendVarbit() {},
        },
        inventory: {
            getInventoryItems: () => inventory,
            findInventorySlotWithItem: (_player: PlayerState, itemId: number) =>
                inventory.find((entry) => entry.itemId === itemId)?.slot,
            consumeItem: (_player: PlayerState, slot: number) => {
                const index = inventory.findIndex((entry) => entry.slot === slot);
                if (index < 0) return false;
                if (inventory[index].quantity > 1) {
                    inventory[index].quantity -= 1;
                    return true;
                }
                inventory.splice(index, 1);
                return true;
            },
            addItemToInventory: () => ({ added: 1 }),
            snapshotInventory: () => {},
            hasItem: (_player: PlayerState, itemId: number) =>
                inventory.some((entry) => entry.itemId === itemId),
        },
        messaging: {
            sendGameMessage: () => {},
        },
        sound: {
            sendJingle: () => {},
        },
        skills: {
            addSkillXp: () => {},
        },
        system: {
            logger: {
                info: () => {},
                warn: () => {},
            },
        },
        viewport: {
            getMainmodalUid: () => 0,
        },
        data: {
            getDbRepository: () => undefined,
        },
    } as unknown as ScriptServices;

    return { services, dialog };
}

function resetDialog(dialog: DialogCapture): void {
    dialog.modalOpen = false;
    dialog.npcLines = [];
}

function dialogHasContent(dialog: DialogCapture): boolean {
    return dialog.modalOpen || dialog.npcLines.length > 0;
}

function primeQuestSimulationPrereqs(player: PlayerState, questKey: string): void {
    switch (questKey) {
        case "elemental_workshop_ii":
            player.varps.setVarpValue(75, 6);
            break;
        case "biohazard":
            player.varps.setVarpValue(165, 29);
            break;
        default:
            break;
    }
}

function makeNpcEvent(
    player: PlayerState,
    services: ScriptServices,
    npcId: number,
    npcName: string,
): NpcInteractionEvent {
    return {
        player,
        services,
        npc: { typeId: npcId, id: npcId, name: npcName },
    };
}

function invokeNpc(registry: ScriptRegistry, event: NpcInteractionEvent): boolean {
    const handler = registry.findNpcInteractionDirect(event.npc.id);
    if (!handler) return false;
    handler(event);
    return true;
}

function simulateFactoryQuest(
    registry: ScriptRegistry,
    quest: QuestDefinition,
    chain: QuestChainMeta,
): { start: QuestPlayabilityPhase; mid: QuestPlayabilityPhase; complete: QuestPlayabilityPhase; notes: string[] } {
    const notes: string[] = [];
    const startNpc = chain.startNpc;
    const finishNpc = chain.finishNpc;
    if (!startNpc || !finishNpc) {
        return { start: "fail", mid: "fail", complete: "fail", notes: ["missing start or finish NPC metadata"] };
    }

    const itemRequirements = chain.itemRequirements;
    if (itemRequirements.length > 0) {
        notes.push(`requires ${itemRequirements.length} item type(s) at finish`);
    }

    const { services, dialog } = createMatrixTestServices(itemRequirements);
    const player = createMatrixTestPlayer();

    resetDialog(dialog);
    const startInvoked = invokeNpc(registry, makeNpcEvent(player, services, startNpc.id, startNpc.name));
    const start = startInvoked && dialogHasContent(dialog) ? "pass" : "fail";

    let mid: QuestPlayabilityPhase = chain.steps.length === 0 ? "skip" : "fail";
    if (chain.steps.length > 0) {
        setQuestStage(player, quest, services, quest.startedValue);
        const firstStep = chain.steps[0];
        resetDialog(dialog);
        const midInvoked = invokeNpc(
            registry,
            makeNpcEvent(player, services, firstStep.id, firstStep.name),
        );
        mid = midInvoked && dialogHasContent(dialog) ? "pass" : "fail";
    }

    primeQuestSimulationPrereqs(player, quest.key);
    setQuestStage(player, quest, services, quest.startedValue);
    for (const flag of chain.stepFlags) {
        setQuestFlag(player, quest.key, flag, true);
    }
    setQuestFlag(player, quest.key, "ready_finish", true);

    resetDialog(dialog);
    const completeInvoked = invokeNpc(
        registry,
        makeNpcEvent(player, services, finishNpc.id, finishNpc.name),
    );
    const complete =
        completeInvoked && getQuestStage(player, quest) >= quest.completionValue ? "pass" : "fail";

    return { start, mid, complete, notes };
}

function classifyOsrsMechanics(
    implementation: QuestImplementationKind,
    tier: QuestPlayabilityTier,
): QuestOsrsMechanics {
    if (tier === "broken") return "wiring-broken";
    if (implementation === "bespoke") return "custom";
    if (implementation === "factory-auto") return "dialog-shell";
    if (implementation === "factory-simple") return "dialog-chain";
    return "wiring-broken";
}

function simulateBespokeQuest(
    registry: ScriptRegistry,
    quest: QuestDefinition,
    _chain: QuestChainMeta,
    reference?: ResolvedQuest,
): { start: QuestPlayabilityPhase; mid: QuestPlayabilityPhase; complete: QuestPlayabilityPhase; notes: string[] } {
    const notes = ["bespoke quest — mid/complete require manual gameplay"];
    const referenceNpcIds = reference?.startNpcGameIds ?? [];
    const extractedNpcIds = extractQuestNpcIdsForKey(quest.key);
    const candidateNpcIds = [...referenceNpcIds, ...extractedNpcIds].filter(
        (id, index, all) => all.indexOf(id) === index,
    );

    if (quest.key === "garden_of_death") {
        return {
            start: "manual",
            mid: "manual",
            complete: "manual",
            notes: [...notes, "loc-based start via tent search (npc 46324)"],
        };
    }

    if (candidateNpcIds.length === 0) {
        return { start: "fail", mid: "manual", complete: "manual", notes: [...notes, "no start NPC id"] };
    }

    const { services, dialog } = createMatrixTestServices();
    const player = createMatrixTestPlayer();
    primeQuestSimulationPrereqs(player, quest.key);

    let start: QuestPlayabilityPhase = "fail";
    for (const startNpcId of candidateNpcIds) {
        resetDialog(dialog);
        const invoked = invokeNpc(
            registry,
            makeNpcEvent(player, services, startNpcId, quest.name),
        );
        if (invoked && dialogHasContent(dialog)) {
            start = "pass";
            break;
        }
        if (invoked && !dialog.modalOpen) {
            notes.push(`npc ${startNpcId} handler ran without dialog`);
        }
    }

    return { start, mid: "manual", complete: "manual", notes };
}

function classifyTier(
    implementation: QuestImplementationKind,
    start: QuestPlayabilityPhase,
    complete: QuestPlayabilityPhase,
): QuestPlayabilityTier {
    if (implementation === "bespoke") {
        return start === "pass" || start === "manual" ? "bespoke-handcrafted" : "broken";
    }
    if (implementation === "factory-auto") {
        return start === "pass" && complete === "pass" ? "dialog-shell" : "broken";
    }
    if (implementation === "factory-simple") {
        return start === "pass" && complete === "pass" ? "full-dialog" : "broken";
    }
    return start === "pass" || start === "manual" ? "bespoke-handcrafted" : "broken";
}

// =============================================================================
// Matrix builder
// =============================================================================

export function buildQuestPlayabilityMatrix(): QuestPlayabilityMatrix {
    const catalog = buildQuestChainCatalog();
    const resolved = loadResolvedQuests();
    const f2pLower = new Set(F2P_QUEST_NAMES.map((name) => name.toLowerCase()));
    const registry = new ScriptRegistry();
    const { services } = createMatrixTestServices();
    registerQuestHandlers(registry, services);

    const entries: QuestPlayabilityEntry[] = [];

    for (const quest of getQuestDefinitionList()) {
        const reference = resolveReferenceQuest(quest.key, quest.name, resolved);
        const chain = catalog.get(quest.key) ?? {
            key: quest.key,
            implementation: "unknown" as const,
            sourceFile: "unknown",
            steps: [],
            stepFlags: [],
            itemRequirementCount: 0,
            itemRequirements: [],
        };

        let phases: {
            start: QuestPlayabilityPhase;
            mid: QuestPlayabilityPhase;
            complete: QuestPlayabilityPhase;
            notes: string[];
        };

        if (chain.implementation === "factory-auto" || chain.implementation === "factory-simple") {
            phases = simulateFactoryQuest(registry, quest, chain);
        } else {
            phases = simulateBespokeQuest(registry, quest, chain, reference);
        }

        const tier = classifyTier(chain.implementation, phases.start, phases.complete);
        const osrsMechanics = classifyOsrsMechanics(chain.implementation, tier);

        entries.push({
            key: quest.key,
            name: quest.name,
            referenceId: registeredKeyToReferenceId(quest.key),
            members: reference?.members ?? !f2pLower.has(quest.name.toLowerCase()),
            f2pCatalog: f2pLower.has(quest.name.toLowerCase()),
            miniquest: reference?.type === "miniquest",
            implementation: chain.implementation,
            sourceFile: chain.sourceFile,
            startNpcId: chain.startNpc?.id ?? reference?.startNpcGameIds?.[0] ?? null,
            stepNpcIds: chain.steps.map((step) => step.id),
            finishNpcId: chain.finishNpc?.id ?? null,
            itemRequirementCount: chain.itemRequirementCount,
            start: phases.start,
            mid: phases.mid,
            complete: phases.complete,
            tier,
            osrsMechanics,
            notes: phases.notes,
        });
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));

    return {
        generatedAt: new Date().toISOString(),
        totalQuests: entries.length,
        summary: {
            fullDialog: entries.filter((entry) => entry.tier === "full-dialog").length,
            bespokeHandcrafted: entries.filter((entry) => entry.tier === "bespoke-handcrafted").length,
            dialogShell: entries.filter((entry) => entry.tier === "dialog-shell").length,
            broken: entries.filter((entry) => entry.tier === "broken").length,
            f2pCatalog: entries.filter((entry) => entry.f2pCatalog).length,
            members: entries.filter((entry) => entry.members).length,
            osrsCustom: entries.filter((entry) => entry.osrsMechanics === "custom").length,
            osrsDialogChain: entries.filter((entry) => entry.osrsMechanics === "dialog-chain").length,
            osrsDialogShell: entries.filter((entry) => entry.osrsMechanics === "dialog-shell").length,
            osrsWiringBroken: entries.filter((entry) => entry.osrsMechanics === "wiring-broken").length,
        },
        entries,
    };
}
