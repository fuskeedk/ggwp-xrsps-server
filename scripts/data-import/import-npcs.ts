import fs from "fs";
import path from "path";

import type Database from "better-sqlite3";

import { OSRSBOX_RAW_DIR } from "./config";
import { openDatabase, setMeta } from "./db";

type OsrsboxMonster = {
    id: number;
    name: string;
    examine?: string;
    members?: boolean;
    combat_level?: number;
    hitpoints?: number | null;
    max_hit?: number | null;
    attack_type?: string[];
    attack_speed?: number | null;
    aggressive?: boolean;
    slayer_level?: number | null;
    slayer_xp?: number | null;
    wiki_url?: string;
    attack_level?: number;
    strength_level?: number;
    defence_level?: number;
    magic_level?: number;
    ranged_level?: number;
    duplicate?: boolean;
    incomplete?: boolean;
    drops?: Array<{
        id: number;
        name: string;
        quantity?: string;
        rarity?: number;
        rolls?: number;
        noted?: boolean;
        members?: boolean;
    }>;
};

function loadMonsters(): OsrsboxMonster[] {
    const filePath = path.join(OSRSBOX_RAW_DIR, "monsters-complete.json");
    if (!fs.existsSync(filePath)) {
        throw new Error(`Missing ${filePath} — run: npm run data:download`);
    }
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, OsrsboxMonster>;
    return Object.values(raw);
}

export function importNpcs(db: Database.Database): number {
    const now = new Date().toISOString();
    const monsters = loadMonsters().filter((m) => !m.duplicate);

    const insertNpc = db.prepare(`
        INSERT INTO npcs (
            id, name, combat_level, hitpoints,
            attack_level, strength_level, defence_level, magic_level, ranged_level,
            aggressive, attack_style, max_hit, examine, members,
            slayer_level, slayer_xp, locations_json, drops_json,
            source_url, updated_at
        ) VALUES (
            @id, @name, @combat_level, @hitpoints,
            @attack_level, @strength_level, @defence_level, @magic_level, @ranged_level,
            @aggressive, @attack_style, @max_hit, @examine, @members,
            @slayer_level, @slayer_xp, @locations_json, @drops_json,
            @source_url, @updated_at
        )
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            combat_level = excluded.combat_level,
            hitpoints = excluded.hitpoints,
            attack_level = excluded.attack_level,
            strength_level = excluded.strength_level,
            defence_level = excluded.defence_level,
            magic_level = excluded.magic_level,
            ranged_level = excluded.ranged_level,
            aggressive = excluded.aggressive,
            attack_style = excluded.attack_style,
            max_hit = excluded.max_hit,
            examine = excluded.examine,
            members = excluded.members,
            slayer_level = excluded.slayer_level,
            slayer_xp = excluded.slayer_xp,
            locations_json = excluded.locations_json,
            drops_json = excluded.drops_json,
            source_url = excluded.source_url,
            updated_at = excluded.updated_at
    `);

    const importAll = db.transaction(() => {
        for (const monster of monsters) {
            if (!monster?.id && monster.id !== 0) continue;
            insertNpc.run({
                id: monster.id,
                name: monster.name ?? "",
                combat_level: monster.combat_level ?? 0,
                hitpoints: monster.hitpoints ?? null,
                attack_level: monster.attack_level ?? null,
                strength_level: monster.strength_level ?? null,
                defence_level: monster.defence_level ?? null,
                magic_level: monster.magic_level ?? null,
                ranged_level: monster.ranged_level ?? null,
                aggressive: monster.aggressive ? 1 : 0,
                attack_style: monster.attack_type?.join(", ") ?? null,
                max_hit: monster.max_hit ?? null,
                examine: monster.examine ?? null,
                members: monster.members ? 1 : 0,
                slayer_level: monster.slayer_level ?? null,
                slayer_xp: monster.slayer_xp ?? null,
                locations_json: null,
                drops_json: monster.drops?.length ? JSON.stringify(monster.drops) : null,
                source_url: monster.wiki_url ?? null,
                updated_at: now,
            });
        }
    });

    importAll();
    setMeta(db, "npcs_imported_at", now);
    setMeta(db, "npcs_source", "osrsbox-db/monsters-complete.json");
    return monsters.length;
}

if (require.main === module) {
    const db = openDatabase();
    const count = importNpcs(db);
    console.log(`[import-npcs] ${count} NPCs/monsters`);
}
