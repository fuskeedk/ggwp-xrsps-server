import fs from "fs";
import path from "path";

import type { AttackType } from "../../server/src/game/combat/AttackType";
import { OSRSBOX_RAW_DIR, PROJECT_ROOT } from "./config";

type OsrsboxMonster = {
    id: number;
    name: string;
    combat_level?: number | null;
    hitpoints?: number | null;
    max_hit?: number | null;
    attack_type?: string[];
    attack_speed?: number | null;
    aggressive?: boolean;
    slayer_level?: number | null;
    slayer_xp?: number | null;
    attack_level?: number | null;
    strength_level?: number | null;
    defence_level?: number | null;
    magic_level?: number | null;
    ranged_level?: number | null;
    attack_bonus?: number | null;
    strength_bonus?: number | null;
    magic_bonus?: number | null;
    attack_magic?: number | null;
    attack_ranged?: number | null;
    defence_stab?: number | null;
    defence_slash?: number | null;
    defence_crush?: number | null;
    defence_magic?: number | null;
    defence_ranged?: number | null;
    poisonous?: boolean;
    venomous?: boolean;
    immune_poison?: boolean;
    immune_venom?: boolean;
    attributes?: string[];
    category?: string[];
    duplicate?: boolean;
    incomplete?: boolean;
};

type OutputNpcStats = {
    name: string;
    combatLevel: number;
    hitpoints: number;
    attackLevel: number;
    strengthLevel: number;
    defenceLevel: number;
    magicLevel: number;
    rangedLevel: number;
    attackSpeed: number;
    attackType: AttackType;
    attackStyle?: string;
    maxHit: number;
    aggressive: boolean;
    aggressiveRadius?: number;
    poisonous?: boolean;
    venomous?: boolean;
    slayerLevel?: number;
    slayerXp?: number;
    attackBonus?: number;
    strengthBonus?: number;
    magicBonus?: number;
    rangedBonus?: number;
    defenceBonuses?: {
        stab: number;
        slash: number;
        crush: number;
        magic: number;
        ranged: number;
    };
    immunities?: string[];
    species?: string[];
    isBoss?: boolean;
};

type OutputFile = {
    $comment: string;
    generatedAt?: string;
    source?: string;
    npcs: Record<string, OutputNpcStats>;
};

const OUTPUT_PATH = path.join(PROJECT_ROOT, "server/data/npc-combat-stats.json");
const MONSTERS_PATH = path.join(OSRSBOX_RAW_DIR, "monsters-complete.json");

const MELEE_STYLES = new Set(["stab", "slash", "crush"]);

function loadMonsters(): OsrsboxMonster[] {
    if (!fs.existsSync(MONSTERS_PATH)) {
        throw new Error(`Missing ${MONSTERS_PATH} — run: npm run data:download`);
    }
    const raw = JSON.parse(fs.readFileSync(MONSTERS_PATH, "utf8")) as Record<
        string,
        OsrsboxMonster
    >;
    return Object.values(raw);
}

function loadExistingOutput(): OutputFile {
    if (!fs.existsSync(OUTPUT_PATH)) {
        return {
            $comment: "NPC combat statistics - OSRS parity.",
            npcs: {},
        };
    }
    return JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf8")) as OutputFile;
}

function resolvePositiveInt(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) && value > 0
        ? Math.trunc(value)
        : fallback;
}

function resolveNonNegativeInt(value: unknown, fallback = 0): number {
    return typeof value === "number" && Number.isFinite(value) && value >= 0
        ? Math.trunc(value)
        : fallback;
}

function resolveAttackType(attackTypes: string[] | undefined): AttackType {
    const types = (attackTypes ?? []).map((entry) => entry.toLowerCase());
    if (types.includes("magic") && !types.some((entry) => MELEE_STYLES.has(entry))) {
        return "magic";
    }
    if (types.includes("ranged") && !types.some((entry) => MELEE_STYLES.has(entry))) {
        return "ranged";
    }
    return "melee";
}

function resolveMeleeStyle(attackTypes: string[] | undefined): string | undefined {
    const types = (attackTypes ?? []).map((entry) => entry.toLowerCase());
    for (const style of ["stab", "slash", "crush"] as const) {
        if (types.includes(style)) {
            return style;
        }
    }
    return undefined;
}

function resolveSpecies(monster: OsrsboxMonster): string[] | undefined {
    const species = new Set<string>();
    for (const attr of monster.attributes ?? []) {
        const normalized = String(attr).trim().toLowerCase();
        if (normalized) species.add(normalized);
    }
    for (const cat of monster.category ?? []) {
        const normalized = String(cat).trim().toLowerCase();
        if (!normalized || normalized === "bosses") continue;
        species.add(normalized.replace(/\s+/g, "_"));
    }
    const values = Array.from(species);
    return values.length > 0 ? values : undefined;
}

function resolveImmunities(monster: OsrsboxMonster): string[] | undefined {
    const immunities: string[] = [];
    if (monster.immune_poison) immunities.push("poison");
    if (monster.immune_venom) immunities.push("venom");
    return immunities.length > 0 ? immunities : undefined;
}

function isCombatMonster(monster: OsrsboxMonster): boolean {
    if (monster.duplicate) return false;
    const combatLevel = monster.combat_level ?? 0;
    const hitpoints = monster.hitpoints ?? 0;
    return combatLevel > 0 && hitpoints > 0;
}

function buildNpcStats(monster: OsrsboxMonster): OutputNpcStats {
    const attackType = resolveAttackType(monster.attack_type);
    const attackStyle = attackType === "melee" ? resolveMeleeStyle(monster.attack_type) : undefined;
    const aggressive = !!monster.aggressive;
    const defenceBonuses = {
        stab: resolveNonNegativeInt(monster.defence_stab),
        slash: resolveNonNegativeInt(monster.defence_slash),
        crush: resolveNonNegativeInt(monster.defence_crush),
        magic: resolveNonNegativeInt(monster.defence_magic),
        ranged: resolveNonNegativeInt(monster.defence_ranged),
    };
    const hasDefenceBonuses = Object.values(defenceBonuses).some((value) => value !== 0);

    const stats: OutputNpcStats = {
        name: monster.name,
        combatLevel: resolvePositiveInt(monster.combat_level, 1),
        hitpoints: resolvePositiveInt(monster.hitpoints, 1),
        attackLevel: resolvePositiveInt(monster.attack_level, 1),
        strengthLevel: resolvePositiveInt(monster.strength_level, 1),
        defenceLevel: resolvePositiveInt(monster.defence_level, 1),
        magicLevel: resolvePositiveInt(monster.magic_level, 1),
        rangedLevel: resolvePositiveInt(monster.ranged_level, 1),
        attackSpeed: Math.max(1, resolvePositiveInt(monster.attack_speed, 4)),
        attackType,
        maxHit: Math.max(0, resolveNonNegativeInt(monster.max_hit)),
        aggressive,
    };

    if (attackStyle) stats.attackStyle = attackStyle;
    if (aggressive) stats.aggressiveRadius = 3;
    if (monster.poisonous) stats.poisonous = true;
    if (monster.venomous) stats.venomous = true;

    const slayerLevel = resolveNonNegativeInt(monster.slayer_level);
    if (slayerLevel > 0) stats.slayerLevel = slayerLevel;
    const slayerXp = resolveNonNegativeInt(monster.slayer_xp);
    if (slayerXp > 0) stats.slayerXp = slayerXp;

    const attackBonus = resolveNonNegativeInt(monster.attack_bonus);
    if (attackBonus !== 0) stats.attackBonus = attackBonus;
    const strengthBonus = resolveNonNegativeInt(monster.strength_bonus);
    if (strengthBonus !== 0) stats.strengthBonus = strengthBonus;
    const magicBonus = resolveNonNegativeInt(monster.magic_bonus ?? monster.attack_magic);
    if (magicBonus !== 0) stats.magicBonus = magicBonus;
    const rangedBonus = resolveNonNegativeInt(monster.attack_ranged);
    if (rangedBonus !== 0) stats.rangedBonus = rangedBonus;
    if (hasDefenceBonuses) stats.defenceBonuses = defenceBonuses;

    const immunities = resolveImmunities(monster);
    if (immunities) stats.immunities = immunities;

    const species = resolveSpecies(monster);
    if (species) stats.species = species;

    if ((monster.category ?? []).some((entry) => entry.toLowerCase() === "bosses")) {
        stats.isBoss = true;
    }

    return stats;
}

function normalizeName(name?: string): string {
    return (name ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function namesMatch(left?: string, right?: string): boolean {
    const a = normalizeName(left);
    const b = normalizeName(right);
    return !!a && !!b && a === b;
}

function main(): void {
    const existing = loadExistingOutput();
    const manualOverrides = { ...existing.npcs };
    const monsters = loadMonsters().filter(isCombatMonster);

    const npcs: Record<string, OutputNpcStats> = {};
    for (const monster of monsters) {
        npcs[String(monster.id)] = buildNpcStats(monster);
    }

    let preservedOverrides = 0;
    let skippedMismatchedOverrides = 0;
    for (const [npcId, overrideStats] of Object.entries(manualOverrides)) {
        const generated = npcs[npcId];
        if (!generated) {
            npcs[npcId] = overrideStats;
            preservedOverrides++;
            continue;
        }
        if (namesMatch(generated.name, overrideStats.name)) {
            npcs[npcId] = overrideStats;
            preservedOverrides++;
            continue;
        }
        skippedMismatchedOverrides++;
    }

    const output: OutputFile = {
        $comment: "NPC combat statistics - OSRS parity. Generated from osrsbox with manual overrides preserved.",
        generatedAt: new Date().toISOString(),
        source: "scripts/data-import/build-npc-combat-stats.ts",
        npcs,
    };

    fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
    console.log(
        `[build-npc-combat-stats] wrote ${Object.keys(npcs).length} NPC profiles to ${OUTPUT_PATH}`,
    );
    console.log(`[build-npc-combat-stats] preserved ${preservedOverrides} manual override entries`);
    if (skippedMismatchedOverrides > 0) {
        console.log(
            `[build-npc-combat-stats] skipped ${skippedMismatchedOverrides} mismatched manual overrides`,
        );
    }
}

main();
