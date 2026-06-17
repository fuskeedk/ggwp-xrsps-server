import fs from "fs";
import path from "path";
import { PROJECT_ROOT } from "./config";

const REF_DIR = path.join(PROJECT_ROOT, "server/data/quest-reference");
const DEFS_DIR = path.join(PROJECT_ROOT, "server/gamemodes/vanilla/quests/definitions");

function norm(t: string): string {
    return t
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/['']/g, "'")
        .replace(/[^a-z0-9']+/g, " ")
        .trim();
}

function lookupProgress(
    title: string,
    varpMap: Record<string, { varpId: number; progressVarbitId?: number }>,
    varbitMap: Record<string, { varpId: number; progressVarbitId?: number }>,
): boolean {
    const key = norm(title);
    const aliases = [
        key,
        key.replace(/\s+i$/, ""),
        key.replace(/\s+ii - .*$/, "").replace(/\s+ii$/, ""),
        key.replace(/\s+quest$/, ""),
    ];
    for (const alias of aliases) {
        if (varpMap[alias]?.varpId >= 0) return true;
    }
    for (const alias of aliases) {
        if (varbitMap[alias]?.progressVarbitId !== undefined) return true;
    }
    return false;
}

function loadImplementedNames(): Set<string> {
    const names = new Set<string>();
    const addFromFile = (filePath: string) => {
        if (!fs.existsSync(filePath)) return;
        const text = fs.readFileSync(filePath, "utf8");
        for (const match of text.matchAll(/name:\s*"([^"]+)"/g)) {
            names.add(norm(match[1]));
        }
    };
    for (const file of fs.readdirSync(DEFS_DIR)) {
        if (!file.endsWith(".ts") || file === "generatedAutoQuests.ts") continue;
        addFromFile(path.join(DEFS_DIR, file));
    }
    for (const dir of fs.readdirSync(DEFS_DIR, { withFileTypes: true })) {
        if (!dir.isDirectory()) continue;
        addFromFile(path.join(DEFS_DIR, dir.name, "index.ts"));
    }
    return names;
}

const resolved = JSON.parse(fs.readFileSync(path.join(REF_DIR, "resolved-quests.json"), "utf8"));
const varpMap = JSON.parse(fs.readFileSync(path.join(REF_DIR, "quest-varp-map.json"), "utf8")).quests;
const varbitMap = JSON.parse(fs.readFileSync(path.join(REF_DIR, "quest-varbit-map.json"), "utf8")).quests;
const gen = fs.readFileSync(path.join(DEFS_DIR, "generatedAutoQuests.ts"), "utf8");
const genKeys = new Set([...gen.matchAll(/key: "([^"]+)"/g)].map((m) => m[1]));
const implemented = loadImplementedNames();

type Gap = { title: string; questId: string; reason: string; startNpc: number | null };

const gaps: Gap[] = [];
for (const q of resolved.quests) {
    const hasImpl = implemented.has(norm(q.title)) || genKeys.has(q.questId.replace(/[^a-z0-9_]+/gi, "_").toLowerCase());
    if (hasImpl) continue;
    const startNpc = q.startNpcGameIds?.[0] ?? null;
    const hasVarp = lookupProgress(q.title, varpMap, varbitMap);
    let reason = "unknown";
    if (!startNpc) reason = "no_start_npc";
    else if (!hasVarp) reason = "no_varp";
    gaps.push({ title: q.title, questId: q.questId, reason, startNpc });
}

console.log(`Implemented (hand): ${implemented.size}, generated: ${genKeys.size}, resolved: ${resolved.quests.length}`);
console.log(`Gaps: ${gaps.length}\n`);
for (const g of gaps) {
    console.log(`[${g.reason}] ${g.title} (start=${g.startNpc ?? "none"})`);
}
