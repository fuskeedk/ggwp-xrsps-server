import path from "path";

import Database from "better-sqlite3";

const DB_PATH = path.resolve(__dirname, "../../../data/db/osrs.sqlite");

export type OsrsDbItemRow = {
    id: number;
    name: string;
    examine: string | null;
    members: number;
    tradeable: number;
    stackable: number;
    value: number;
    weight: number | null;
    equipable: number;
    source_url: string | null;
};

export type OsrsDbEquipmentRow = {
    item_id: number;
    slot: string | null;
    attack_stab: number;
    attack_slash: number;
    attack_crush: number;
    attack_magic: number;
    attack_ranged: number;
    defence_stab: number;
    defence_slash: number;
    defence_crush: number;
    defence_magic: number;
    defence_ranged: number;
    melee_strength: number;
    ranged_strength: number;
    magic_damage: number;
    prayer: number;
    attack_speed: number | null;
    weapon_type: string | null;
    requirements_json: string | null;
};

export type OsrsDbNpcRow = {
    id: number;
    name: string;
    combat_level: number;
    hitpoints: number | null;
    max_hit: number | null;
    drops_json: string | null;
    source_url: string | null;
};

export type OsrsDbPriceRow = {
    item_id: number;
    high: number | null;
    low: number | null;
};

let cachedDb: Database.Database | undefined;

/** Read-only access to the imported OSRS reference database. */
export function openOsrsDb(): Database.Database | undefined {
    if (cachedDb) return cachedDb;
    try {
        cachedDb = new Database(DB_PATH, { readonly: true, fileMustExist: true });
        return cachedDb;
    } catch {
        return undefined;
    }
}

export function getOsrsDbItem(itemId: number): OsrsDbItemRow | undefined {
    const db = openOsrsDb();
    if (!db) return undefined;
    return db
        .prepare(`SELECT * FROM items WHERE id = ?`)
        .get(itemId) as OsrsDbItemRow | undefined;
}

export function getOsrsDbEquipment(itemId: number): OsrsDbEquipmentRow | undefined {
    const db = openOsrsDb();
    if (!db) return undefined;
    return db
        .prepare(`SELECT * FROM equipment_stats WHERE item_id = ?`)
        .get(itemId) as OsrsDbEquipmentRow | undefined;
}

export function getOsrsDbNpc(npcId: number): OsrsDbNpcRow | undefined {
    const db = openOsrsDb();
    if (!db) return undefined;
    return db
        .prepare(`SELECT * FROM npcs WHERE id = ?`)
        .get(npcId) as OsrsDbNpcRow | undefined;
}

export function getOsrsDbPrice(itemId: number): OsrsDbPriceRow | undefined {
    const db = openOsrsDb();
    if (!db) return undefined;
    return db
        .prepare(`SELECT item_id, high, low FROM prices WHERE item_id = ?`)
        .get(itemId) as OsrsDbPriceRow | undefined;
}

export function searchOsrsDbItemsByName(
    query: string,
    limit = 25,
): OsrsDbItemRow[] {
    const db = openOsrsDb();
    if (!db || !query.trim()) return [];
    return db
        .prepare(
            `SELECT id, name, examine, members, tradeable, stackable, value, weight, equipable, source_url
             FROM items WHERE name LIKE ? COLLATE NOCASE LIMIT ?`,
        )
        .all(`%${query.trim()}%`, limit) as OsrsDbItemRow[];
}
