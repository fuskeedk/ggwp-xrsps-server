import type Database from "better-sqlite3";

import { openDatabase } from "./db";

/** Spot-check known items from the guide. */
const SPOT_CHECK_ITEMS: Array<{
    id: number;
    name: string;
    meleeStrength?: number;
    attackSlash?: number;
}> = [
    { id: 4151, name: "Abyssal whip", meleeStrength: 82 },
    { id: 1333, name: "Rune scimitar", attackSlash: 45 },
    { id: 4587, name: "Dragon scimitar", attackSlash: 67 },
    { id: 11828, name: "Armadyl chestplate" },
    { id: 11832, name: "Bandos chestplate" },
    { id: 12926, name: "Toxic blowpipe" },
    { id: 20997, name: "Twisted bow" },
    { id: 11907, name: "Trident of the seas" },
];

export function validateDatabase(db: Database.Database): boolean {
    let ok = true;

    const itemCount = (
        db.prepare(`SELECT COUNT(*) AS c FROM items`).get() as { c: number }
    ).c;
    const equipmentCount = (
        db.prepare(`SELECT COUNT(*) AS c FROM equipment_stats`).get() as { c: number }
    ).c;
    const npcCount = (db.prepare(`SELECT COUNT(*) AS c FROM npcs`).get() as { c: number }).c;
    const priceCount = (db.prepare(`SELECT COUNT(*) AS c FROM prices`).get() as { c: number }).c;

    console.log(
        `[validate] items=${itemCount} equipment=${equipmentCount} npcs=${npcCount} prices=${priceCount}`,
    );

    if (itemCount < 1000) {
        console.error("[validate] FAIL: too few items");
        ok = false;
    }
    if (equipmentCount < 500) {
        console.error("[validate] FAIL: too few equipment rows");
        ok = false;
    }
    if (npcCount < 1000) {
        console.error("[validate] FAIL: too few NPCs");
        ok = false;
    }

    const duplicateIds = db
        .prepare(
            `SELECT id, COUNT(*) AS c FROM items GROUP BY id HAVING c > 1 LIMIT 5`,
        )
        .all();
    if (duplicateIds.length > 0) {
        console.error("[validate] FAIL: duplicate item IDs", duplicateIds);
        ok = false;
    }

    for (const check of SPOT_CHECK_ITEMS) {
        const row = db
            .prepare(
                `SELECT i.name, e.melee_strength, e.attack_slash
                 FROM items i
                 LEFT JOIN equipment_stats e ON e.item_id = i.id
                 WHERE i.id = ?`,
            )
            .get(check.id) as
            | { name: string; melee_strength: number | null; attack_slash: number | null }
            | undefined;

        if (!row) {
            console.error(`[validate] FAIL: missing item ${check.id} (${check.name})`);
            ok = false;
            continue;
        }
        if (!row.name.toLowerCase().includes(check.name.split(" ")[0]!.toLowerCase())) {
            console.warn(`[validate] WARN: name mismatch for ${check.id}: ${row.name}`);
        }
        if (
            check.meleeStrength !== undefined &&
            row.melee_strength !== check.meleeStrength
        ) {
            console.error(
                `[validate] FAIL: ${check.name} melee_strength expected ${check.meleeStrength}, got ${row.melee_strength}`,
            );
            ok = false;
        }
        if (check.attackSlash !== undefined && row.attack_slash !== check.attackSlash) {
            console.error(
                `[validate] FAIL: ${check.name} attack_slash expected ${check.attackSlash}, got ${row.attack_slash}`,
            );
            ok = false;
        }
        if (ok) {
            console.log(`[validate] OK: ${check.name} (${check.id})`);
        }
    }

    if (ok) {
        console.log("[validate] all checks passed");
    }
    return ok;
}

if (require.main === module) {
    const db = openDatabase(true);
    const ok = validateDatabase(db);
    process.exit(ok ? 0 : 1);
}
