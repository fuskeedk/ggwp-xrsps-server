/**
 * Resolves wiki quest reference data (from kan-du-kode-runescape zip) to game NPC
 * and item IDs using npc-spawns.json and items.json.
 *
 * Input:  server/data/quest-reference/{quest-scripts,quests,osrs-quest-npc-mapping-final}.json
 * Output: server/data/quest-reference/resolved-quests.json
 */

import fs from "fs";
import path from "path";
import { PROJECT_ROOT } from "./config";

const REF_DIR = path.join(PROJECT_ROOT, "server/data/quest-reference");
const OUT_PATH = path.join(REF_DIR, "resolved-quests.json");

type NpcSpawn = { id: number; name: string; x: number; y: number; level?: number };
type GameItem = { id: number; name: string; noted?: boolean };

type NpcRoleLink = {
    name: string;
    pageTitle?: string;
    entityType?: string;
    roles: string[];
};

type QuestMapping = {
    title: string;
    name: string;
    npcMappings?: NpcRoleLink[];
};

type QuestScript = {
    questId: string;
    questTitle: string;
    questType?: string;
    infobox?: { members?: string };
    details?: {
        start?: string;
        startMap?: string;
        difficulty?: string;
        length?: string;
        description?: string;
    };
    requirements?: {
        skillRequirements?: Array<{ skill: string; level: number }>;
        questRequirements?: Array<{ title: string; label?: string }>;
    };
    items?: {
        itemRequirements?: Array<{
            title: string;
            label?: string;
            quantity: number;
            requirementType?: string;
        }>;
    };
    rewards?: {
        questPoints?: number | null;
        xpRewards?: Array<{ skill: string; amount: number }>;
        itemRewards?: Array<{ title: string; quantity: number }>;
    };
};

type ResolvedNpc = {
    name: string;
    roles: string[];
    gameIds: number[];
    nearestGameId?: number;
};

type ResolvedItemReq = {
    title: string;
    quantity: number;
    itemId?: number;
};

type ResolvedQuest = {
    questId: string;
    title: string;
    members: boolean;
    difficulty?: string;
    wikiStart?: string;
    startMap?: [number, number];
    startNpcGameIds: number[];
    npcs: ResolvedNpc[];
    itemRequirements: ResolvedItemReq[];
    skillRequirements: Array<{ skill: string; level: number }>;
    questRequirements: string[];
    rewards: {
        questPoints: number;
        xp: Array<{ skill: string; amount: number }>;
        items: Array<{ title: string; quantity: number; itemId?: number }>;
    };
    overviewHint?: string;
};

function normalizeKey(value: string): string {
    return value
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/['']/g, "'")
        .replace(/[^a-z0-9']+/g, " ")
        .trim();
}

function normalizeItemName(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function parseStartMap(raw?: string): [number, number] | undefined {
    if (!raw) return undefined;
    const parts = raw.split(",").map((p) => Number(p.trim()));
    if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) return undefined;
    return [parts[0], parts[1]];
}

function distanceSq(ax: number, ay: number, bx: number, by: number): number {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
}

function buildNpcIndex(spawns: NpcSpawn[]): Map<string, NpcSpawn[]> {
    const index = new Map<string, NpcSpawn[]>();
    for (const spawn of spawns) {
        const key = normalizeKey(spawn.name);
        const list = index.get(key) ?? [];
        list.push(spawn);
        index.set(key, list);
    }
    return index;
}

function buildItemIndex(items: GameItem[]): Map<string, number> {
    const index = new Map<string, number>();
    for (const item of items) {
        if (item.noted) continue;
        const key = normalizeItemName(item.name);
        if (!index.has(key)) {
            index.set(key, item.id);
        }
    }
    return index;
}

function npcNameVariants(name: string): string[] {
    const variants = new Set<string>();
    variants.add(name);
    const beforeParen = name.replace(/\s*\([^)]*\)\s*$/, "").trim();
    if (beforeParen.length > 0) variants.add(beforeParen);
    const beforeDash = name.replace(/\s+-\s+.*$/, "").trim();
    if (beforeDash.length > 0) variants.add(beforeDash);
    return [...variants];
}

function resolveNpcIds(
    name: string,
    npcIndex: Map<string, NpcSpawn[]>,
    startMap?: [number, number],
): { gameIds: number[]; nearestGameId?: number } {
    let spawns: NpcSpawn[] = [];
    for (const variant of npcNameVariants(name)) {
        const found = npcIndex.get(normalizeKey(variant)) ?? [];
        if (found.length > 0) {
            spawns = found;
            break;
        }
    }

    const uniqueIds = [...new Set(spawns.map((s) => s.id))];
    if (uniqueIds.length === 0) {
        return { gameIds: [] };
    }

    if (!startMap) {
        return { gameIds: uniqueIds, nearestGameId: uniqueIds[0] };
    }

    const [sx, sy] = startMap;
    let best: NpcSpawn | undefined;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const spawn of spawns) {
        const dist = distanceSq(spawn.x, spawn.y, sx, sy);
        if (dist < bestDist) {
            bestDist = dist;
            best = spawn;
        }
    }

    const withinRange = best && bestDist <= 30 * 30;
    return {
        gameIds: uniqueIds,
        nearestGameId: withinRange ? best?.id : uniqueIds[0],
    };
}

function buildOverviewHint(startText: string | undefined, startNpcName?: string): string | undefined {
    if (!startText) return undefined;
    const trimmed = startText.trim();
    if (trimmed.length === 0) return undefined;

    let hint = trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
    if (hint.endsWith(".")) {
        hint = hint.slice(0, -1);
    }

    if (startNpcName) {
        const highlightName = npcNameVariants(startNpcName).find((variant) => variant.length > 0) ?? startNpcName;
        const escaped = highlightName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        hint = hint.replace(new RegExp(`\\b${escaped}\\b`, "i"), `<col=800000>${highlightName}</col>`);
    }

    return `${hint}.`;
}

function extractStartNpcNameFromWikiStart(text?: string): string | undefined {
    if (!text) return undefined;
    const patterns = [
        /speak to (?:the )?([^.,:]+?)(?:\s+(?:in|at|on|near|by)\b|[.,:]|$)/i,
        /talk to (?:the )?([^.,:]+?)(?:\s+(?:in|at|on|near|by)\b|[.,:]|$)/i,
        /see (?:the )?([^.,:]+?)(?:\s+(?:in|at|on|near|by)\b|[.,:]|$)/i,
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match?.[1]) return match[1].trim();
    }
    return undefined;
}

type QuestJsonParticipant = {
    npcId: string;
    name: string;
    entityType?: string;
    roles: string[];
};

type QuestJsonEntry = {
    id: string;
    title: string;
    startNpcIds: string[];
    participants: QuestJsonParticipant[];
};

function main(): void {
    const scriptsPath = path.join(REF_DIR, "quest-scripts.json");
    const mappingPath = path.join(REF_DIR, "osrs-quest-npc-mapping-final.json");
    const questsJsonPath = path.join(REF_DIR, "quests.json");
    const spawnsPath = path.join(PROJECT_ROOT, "server/data/npc-spawns.json");
    const itemsPath = path.join(PROJECT_ROOT, "server/data/items.json");

    const scriptsJson = JSON.parse(fs.readFileSync(scriptsPath, "utf8")) as { scripts: QuestScript[] };
    const mappingJson = JSON.parse(fs.readFileSync(mappingPath, "utf8")) as { quests: QuestMapping[] };
    const questsJson = fs.existsSync(questsJsonPath)
        ? (JSON.parse(fs.readFileSync(questsJsonPath, "utf8")) as { quests: QuestJsonEntry[] })
        : { quests: [] as QuestJsonEntry[] };
    const spawns = JSON.parse(fs.readFileSync(spawnsPath, "utf8")) as NpcSpawn[];
    const items = JSON.parse(fs.readFileSync(itemsPath, "utf8")) as GameItem[];

    const npcIndex = buildNpcIndex(spawns);
    const itemIndex = buildItemIndex(items);

    const mappingByTitle = new Map<string, QuestMapping>();
    for (const quest of mappingJson.quests) {
        mappingByTitle.set(normalizeKey(quest.title), quest);
    }

    const questsJsonById = new Map(questsJson.quests.map((q) => [q.id, q]));
    const questsJsonByTitle = new Map(questsJson.quests.map((q) => [normalizeKey(q.title), q]));

    let matchedStartNpcs = 0;
    let matchedItems = 0;
    let totalItemReqs = 0;

    const quests: ResolvedQuest[] = scriptsJson.scripts.map((script) => {
        const title = script.questTitle;
        const mapping = mappingByTitle.get(normalizeKey(title));
        const startMap = parseStartMap(script.details?.startMap);

        const npcLinks = mapping?.npcMappings ?? [];
        const npcByName = new Map<string, ResolvedNpc>();

        for (const link of npcLinks) {
            const resolved = resolveNpcIds(link.name, npcIndex, startMap);
            npcByName.set(link.name, {
                name: link.name,
                roles: [...link.roles],
                gameIds: resolved.gameIds,
                nearestGameId: resolved.nearestGameId,
            });
        }

        const startNpcNames = npcLinks
            .filter((n) => n.roles.includes("start"))
            .map((n) => n.name);
        let startNpcGameIds = [
            ...new Set(
                startNpcNames
                    .map((name) => npcByName.get(name)?.nearestGameId)
                    .filter((id): id is number => typeof id === "number"),
            ),
        ];

        if (startNpcGameIds.length === 0) {
            const questJson =
                questsJsonById.get(script.questId) ?? questsJsonByTitle.get(normalizeKey(title));
            if (questJson) {
                for (const participant of questJson.participants) {
                    const isStart =
                        participant.roles.includes("start") ||
                        questJson.startNpcIds.includes(participant.npcId);
                    if (!isStart || participant.entityType === "monster") continue;
                    const resolved = resolveNpcIds(participant.name, npcIndex, startMap);
                    if (!resolved.nearestGameId) continue;
                    npcByName.set(participant.name, {
                        name: participant.name,
                        roles: participant.roles,
                        gameIds: resolved.gameIds,
                        nearestGameId: resolved.nearestGameId,
                    });
                    startNpcGameIds.push(resolved.nearestGameId);
                }
                startNpcGameIds = [...new Set(startNpcGameIds)];
            }
        }

        if (startNpcGameIds.length === 0) {
            const wikiNpc = extractStartNpcNameFromWikiStart(script.details?.start);
            if (wikiNpc) {
                const resolved = resolveNpcIds(wikiNpc, npcIndex, startMap);
                if (resolved.nearestGameId) {
                    npcByName.set(wikiNpc, {
                        name: wikiNpc,
                        roles: ["start"],
                        gameIds: resolved.gameIds,
                        nearestGameId: resolved.nearestGameId,
                    });
                    startNpcGameIds = [resolved.nearestGameId];
                }
            }
        }

        if (startNpcGameIds.length === 0) {
            const questJson =
                questsJsonById.get(script.questId) ?? questsJsonByTitle.get(normalizeKey(title));
            const fallbackNpc = questJson?.participants.find(
                (p) =>
                    p.entityType !== "monster" &&
                    (p.roles.includes("helper") || p.roles.includes("story")),
            );
            if (fallbackNpc) {
                const resolved = resolveNpcIds(fallbackNpc.name, npcIndex, startMap);
                if (resolved.nearestGameId) {
                    npcByName.set(fallbackNpc.name, {
                        name: fallbackNpc.name,
                        roles: ["start", ...fallbackNpc.roles],
                        gameIds: resolved.gameIds,
                        nearestGameId: resolved.nearestGameId,
                    });
                    startNpcGameIds = [resolved.nearestGameId];
                }
            }
        }

        const overridesPath = path.join(REF_DIR, "quest-npc-overrides.json");
        if (startNpcGameIds.length === 0 && fs.existsSync(overridesPath)) {
            const overridesJson = JSON.parse(fs.readFileSync(overridesPath, "utf8")) as {
                overrides?: Record<string, { startNpcGameIds: number[]; npcName?: string }>;
            };
            const override =
                overridesJson.overrides?.[script.questId] ??
                overridesJson.overrides?.[normalizeKey(title)];
            if (override?.startNpcGameIds?.length) {
                const npcName = override.npcName ?? "Quest NPC";
                npcByName.set(npcName, {
                    name: npcName,
                    roles: ["start"],
                    gameIds: override.startNpcGameIds,
                    nearestGameId: override.startNpcGameIds[0],
                });
                startNpcGameIds = [...override.startNpcGameIds];
            }
        }

        if (startNpcGameIds.length > 0) matchedStartNpcs++;

        const resolvedStartNpcNames =
            startNpcNames.length > 0
                ? startNpcNames
                : [...npcByName.values()]
                      .filter((n) => n.roles.includes("start") || startNpcGameIds.includes(n.nearestGameId ?? -1))
                      .map((n) => n.name);

        const itemRequirements: ResolvedItemReq[] = [];
        for (const req of script.items?.itemRequirements ?? []) {
            if (req.requirementType && req.requirementType !== "direct") continue;
            totalItemReqs++;
            const itemId = itemIndex.get(normalizeItemName(req.title));
            if (itemId !== undefined) matchedItems++;
            itemRequirements.push({
                title: req.title,
                quantity: req.quantity,
                itemId,
            });
        }

        const rewardItems = (script.rewards?.itemRewards ?? []).map((reward) => {
            const itemId = itemIndex.get(normalizeItemName(reward.title));
            return {
                title: reward.title,
                quantity: reward.quantity,
                itemId,
            };
        });

        const primaryStartNpc = resolvedStartNpcNames[0];
        const overviewHint = buildOverviewHint(script.details?.start, primaryStartNpc);

        return {
            questId: script.questId,
            title,
            members: String(script.infobox?.members ?? "").toLowerCase() === "yes",
            difficulty: script.details?.difficulty,
            wikiStart: script.details?.start,
            startMap,
            startNpcGameIds,
            npcs: [...npcByName.values()],
            itemRequirements,
            skillRequirements: script.requirements?.skillRequirements ?? [],
            questRequirements: (script.requirements?.questRequirements ?? []).map(
                (q) => q.title || q.label || "",
            ),
            rewards: {
                questPoints: script.rewards?.questPoints ?? 0,
                xp: script.rewards?.xpRewards ?? [],
                items: rewardItems,
            },
            overviewHint,
        };
    });

    const output = {
        meta: {
            generatedAt: new Date().toISOString(),
            source: "kan-du-kode-runescape.zip (wiki quest scripts + NPC role mapping)",
            counts: {
                quests: quests.length,
                questsWithStartNpc: matchedStartNpcs,
                itemRequirements: totalItemReqs,
                itemRequirementsMatched: matchedItems,
            },
        },
        quests,
    };

    fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));
    console.log(`[import-quest-reference] wrote ${OUT_PATH}`);
    console.log(
        `[import-quest-reference] ${quests.length} quests, ${matchedStartNpcs} with start NPC IDs, ${matchedItems}/${totalItemReqs} item reqs matched`,
    );
}

main();
