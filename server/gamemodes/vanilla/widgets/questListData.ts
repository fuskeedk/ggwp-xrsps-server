import fs from "fs";
import path from "path";
import { ScriptVarTypeId } from "../../../../src/rs/config/db/ScriptVarType";
import type { ScriptServices } from "../../../src/game/scripts/types";

export interface QuestEntry {
    questId: number;
    dbrowId: number;
    displayName: string;
}

export interface QuestCompletionInfo {
    varpId: number;
    startedValue?: number;
    completionValue: number;
    varbitEntries?: Array<{ varbitId: number; value: number }>;
}

let cachedQuestDisplayNames: string[] | undefined;

export function setAllCacheQuestDisplayNames(names: readonly string[]): void {
    cachedQuestDisplayNames = [...names].sort((a, b) => a.localeCompare(b));
}

export function getAllCacheQuestDisplayNames(): readonly string[] | undefined {
    return cachedQuestDisplayNames;
}

const QUEST_DB_TABLE_ID = 0;

export function buildQuestMap(services: ScriptServices): Map<number, QuestEntry> {
    const map = new Map<number, QuestEntry>();
    const dbRepo = services.data.getDbRepository();
    if (!dbRepo) return map;

    const rows = dbRepo.getRows(QUEST_DB_TABLE_ID);
    if (rows.length === 0) return map;

    const tableDef = dbRepo.getTables().get(QUEST_DB_TABLE_ID);
    if (!tableDef) return map;

    let idColumnId = -1;
    let nameColumnId = -1;

    for (const [colId, colDef] of tableDef.columns) {
        if (colDef.types.length !== 1) continue;
        if (colDef.types[0] === ScriptVarTypeId.INTEGER && idColumnId === -1) {
            idColumnId = colId;
        }
        if (colDef.types[0] === ScriptVarTypeId.STRING && nameColumnId === -1) {
            nameColumnId = colId;
        }
    }

    if (idColumnId === -1 || nameColumnId === -1) {
        services.system.logger.warn?.(
            `[quest-journal] Could not discover quest DB columns: id=${idColumnId} name=${nameColumnId}`,
        );
        return map;
    }

    for (const row of rows) {
        const idCol = row.getColumn(idColumnId);
        const nameCol = row.getColumn(nameColumnId);

        const questId = idCol?.values?.[0];
        const displayName = nameCol?.values?.[0];

        if (typeof questId === "number" && questId > 0 && typeof displayName === "string") {
            map.set(questId, {
                questId,
                dbrowId: row.id,
                displayName,
            });
        }
    }

    services.system.logger.info?.(
        `[quest-journal] Loaded ${map.size} quests from cache DB table ${QUEST_DB_TABLE_ID}`,
    );
    return map;
}

const QUEST_COMPLETION_DATA = new Map<string, QuestCompletionInfo>([
    ["desert treasure", { varpId: 440, completionValue: 15 }],
    ["lunar diplomacy", { varpId: 823, completionValue: 190 }],
    ["legend's quest", { varpId: 139, completionValue: 180 }],
    ["watchtower", { varpId: 212, startedValue: 1, completionValue: 13 }],
    ["the grand tree", { varpId: 150, startedValue: 1, completionValue: 160 }],
    ["fight arena", { varpId: 17, startedValue: 1, completionValue: 14 }],
    ["nature spirit", { varpId: 93, startedValue: 1, completionValue: 110 }],
    ["fishing contest", { varpId: 11, startedValue: 1, completionValue: 5 }],
    ["sea slug", { varpId: 166, startedValue: 1, completionValue: 12 }],
    ["tribal totem", { varpId: 200, startedValue: 1, completionValue: 6 }],
    ["clock tower", { varpId: 10, startedValue: 1, completionValue: 8 }],
    ["sheep herder", { varpId: 60, startedValue: 1, completionValue: 30 }],
    ["dwarf cannon", { varpId: 77, startedValue: 1, completionValue: 11 }],
    ["the dig site", { varpId: 131, startedValue: 1, completionValue: 12 }],
    ["holy grail", { varpId: 5, startedValue: 1, completionValue: 10 }],
    ["death plateau", { varpId: 62, startedValue: 1, completionValue: 80 }],
    ["the tourist trap", { varpId: 197, startedValue: 1, completionValue: 19 }],
    ["witch's house", { varpId: 226, startedValue: 1, completionValue: 7 }],
    ["hazeel cult", { varpId: 223, startedValue: 1, completionValue: 9 }],
    ["family crest", { varpId: 148, startedValue: 1, completionValue: 11 }],
    ["temple of ikov", { varpId: 26, startedValue: 1, completionValue: 90 }],
    ["observatory quest", { varpId: 112, startedValue: 1, completionValue: 9 }],
    ["monkey madness i", { varpId: 365, startedValue: 1, completionValue: 90 }],
    ["elemental workshop i", { varpId: 75, startedValue: 1, completionValue: 6 }],
    ["underground pass", { varpId: 161, startedValue: 1, completionValue: 110 }],
    ["heroes' quest", { varpId: 188, startedValue: 1, completionValue: 3 }],
    ["troll stronghold", { varpId: 317, startedValue: 1, completionValue: 90 }],
    ["eadgar's ruse", { varpId: 335, startedValue: 1, completionValue: 110 }],
    ["scorpion catcher", { varpId: 76, startedValue: 1, completionValue: 6 }],
    ["big chompy bird hunting", { varpId: 283, startedValue: 1, completionValue: 65 }],
    ["elemental workshop ii", { varpId: 273, startedValue: 1, completionValue: 2 }],
    ["in search of the myreque", { varpId: 199, startedValue: 1, completionValue: 95 }],
    ["in aid of the myreque", { varpId: 240, startedValue: 1, completionValue: 220 }],
    ["creature of fenkenstrain", { varpId: 255, startedValue: 1, completionValue: 17 }],
    ["ghosts ahoy", { varpId: 217, startedValue: 1, completionValue: 60 }],
    ["the feud", { varpId: 101, startedValue: 1, completionValue: 28 }],
    ["monk's friend", { varpId: 30, startedValue: 1, completionValue: 80 }],
    ["horror from the deep", { varpId: 34, startedValue: 1, completionValue: 11 }],
    ["tai bwo wannai trio", { varpId: 320, startedValue: 1, completionValue: 29 }],
    ["zogre flesh eaters", { varpId: 487, startedValue: 1, completionValue: 15 }],
    ["eagles' peak", { varpId: 308, startedValue: 1, completionValue: 15 }],
    ["regicide", { varpId: 328, startedValue: 1, completionValue: 15 }],
    ["roving elves", { varpId: 402, startedValue: 1, completionValue: 80 }],
    ["one small favour", { varpId: 416, startedValue: 1, completionValue: 75 }],
    ["mage arena", { varpId: 267, startedValue: 1, completionValue: 8 }],
    [
        "mage arena ii",
        { varpId: -1, completionValue: 0, varbitEntries: [{ varbitId: 6067, value: 6 }] },
    ],
    ["plague city", { varpId: 165, startedValue: 1, completionValue: 29 }],
    ["biohazard", { varpId: 68, startedValue: 1, completionValue: 16 }],
    ["lost city", { varpId: 147, startedValue: 1, completionValue: 6 }],
    ["tree gnome village", { varpId: 111, startedValue: 1, completionValue: 9 }],
    ["shilo village", { varpId: 116, startedValue: 1, completionValue: 15 }],
    ["gertrude's cat", { varpId: 180, startedValue: 1, completionValue: 6 }],
    ["druidic ritual", { varpId: 80, startedValue: 1, completionValue: 4 }],
    ["priest in peril", { varpId: 302, startedValue: 1, completionValue: 60 }],
    ["waterfall quest", { varpId: 65, startedValue: 1, completionValue: 10 }],
    ["jungle potion", { varpId: 175, startedValue: 1, completionValue: 12 }],
    ["merlin's crystal", { varpId: 14, startedValue: 1, completionValue: 7 }],
    ["murder mystery", { varpId: 192, startedValue: 1, completionValue: 2 }],
    [
        "client of kourend",
        { varpId: -1, completionValue: 0, varbitEntries: [{ varbitId: 5619, value: 9 }] },
    ],
    [
        "dream mentor",
        { varpId: -1, completionValue: 0, varbitEntries: [{ varbitId: 3618, value: 28 }] },
    ],
    ["cook's assistant", { varpId: 29, startedValue: 1, completionValue: 2 }],
    ["demon slayer", { varpId: 2561, startedValue: 1, completionValue: 3 }],
    ["doric's quest", { varpId: 31, startedValue: 10, completionValue: 100 }],
    ["dragon slayer i", { varpId: 176, startedValue: 1, completionValue: 10 }],
    ["ernest the chicken", { varpId: 32, startedValue: 1, completionValue: 3 }],
    ["goblin diplomacy", { varpId: 2378, startedValue: 1, completionValue: 6 }],
    ["imp catcher", { varpId: 160, startedValue: 1, completionValue: 2 }],
    ["the knight's sword", { varpId: 122, startedValue: 1, completionValue: 7 }],
    ["pirate's treasure", { varpId: 71, startedValue: 1, completionValue: 4 }],
    ["prince ali rescue", { varpId: 273, startedValue: 1, completionValue: 110 }],
    ["the restless ghost", { varpId: 107, startedValue: 1, completionValue: 5 }],
    ["romeo & juliet", { varpId: 144, startedValue: 1, completionValue: 100 }],
    ["rune mysteries", { varpId: 63, startedValue: 1, completionValue: 6 }],
    ["sheep shearer", { varpId: 179, startedValue: 1, completionValue: 21 }],
    ["shield of arrav", { varpId: 145, startedValue: 1, completionValue: 7 }],
    ["vampyre slayer", { varpId: 178, startedValue: 1, completionValue: 3 }],
    ["witch's potion", { varpId: 67, startedValue: 1, completionValue: 3 }],
    ["black knights' fortress", { varpId: 130, startedValue: 1, completionValue: 4 }],
    [
        "pandemonium",
        { varpId: -1, completionValue: 0, varbitEntries: [{ varbitId: 18314, value: 6 }] },
    ],
]);

export function getQuestCompletionInfo(displayName: string): QuestCompletionInfo | undefined {
    const direct = QUEST_COMPLETION_DATA.get(displayName.toLowerCase());
    if (direct) return direct;
    return EXTENDED_QUEST_COMPLETION_DATA.get(displayName.toLowerCase());
}

let extendedLoaded = false;
const EXTENDED_QUEST_COMPLETION_DATA = new Map<string, QuestCompletionInfo>();

function loadExtendedQuestCompletionData(): void {
    if (extendedLoaded) return;
    extendedLoaded = true;

    try {
        const mapPath = path.join(__dirname, "../../../data/quest-reference/quest-varp-map.json");
        const varbitMapPath = path.join(__dirname, "../../../data/quest-reference/quest-varbit-map.json");
        if (!fs.existsSync(mapPath) && !fs.existsSync(varbitMapPath)) return;

        if (fs.existsSync(mapPath)) {
            const parsed = JSON.parse(fs.readFileSync(mapPath, "utf8")) as {
                quests: Record<string, QuestCompletionInfo & { progressVarbitId?: number }>;
            };
            for (const [name, info] of Object.entries(parsed.quests)) {
                if (!QUEST_COMPLETION_DATA.has(name)) {
                    EXTENDED_QUEST_COMPLETION_DATA.set(name, info);
                }
            }
        }

        if (fs.existsSync(varbitMapPath)) {
            const parsed = JSON.parse(fs.readFileSync(varbitMapPath, "utf8")) as {
                quests: Record<
                    string,
                    {
                        varpId: -1;
                        progressVarbitId: number;
                        startedValue?: number;
                        completionValue: number;
                    }
                >;
            };
            for (const [name, info] of Object.entries(parsed.quests)) {
                if (QUEST_COMPLETION_DATA.has(name) || EXTENDED_QUEST_COMPLETION_DATA.has(name)) continue;
                EXTENDED_QUEST_COMPLETION_DATA.set(name, {
                    varpId: -1,
                    startedValue: info.startedValue ?? 1,
                    completionValue: info.completionValue,
                    varbitEntries: [{ varbitId: info.progressVarbitId, value: info.completionValue }],
                });
            }
        }
    } catch {
        // Optional reference data — ignore load failures.
    }
}

const _loadExtendedOnImport = loadExtendedQuestCompletionData();
void _loadExtendedOnImport;
