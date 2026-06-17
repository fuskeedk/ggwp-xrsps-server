import fs from "fs";
import path from "path";

import type Database from "better-sqlite3";

import { OSRSBOX_RAW_DIR } from "./config";
import { openDatabase, setMeta } from "./db";

type OsrsboxItem = {
    id: number;
    name: string;
    examine?: string | null;
    members?: boolean;
    tradeable?: boolean;
    stackable?: boolean;
    noted?: boolean;
    cost?: number;
    highalch?: number | null;
    lowalch?: number | null;
    weight?: number | null;
    equipable_by_player?: boolean;
    equipable_weapon?: boolean;
    wiki_url?: string | null;
    equipment?: {
        attack_stab?: number;
        attack_slash?: number;
        attack_crush?: number;
        attack_magic?: number;
        attack_ranged?: number;
        defence_stab?: number;
        defence_slash?: number;
        defence_crush?: number;
        defence_magic?: number;
        defence_ranged?: number;
        melee_strength?: number;
        ranged_strength?: number;
        magic_damage?: number;
        prayer?: number;
        slot?: string;
        requirements?: Record<string, number> | null;
    } | null;
    weapon?: {
        attack_speed?: number;
        weapon_type?: string;
        stances?: unknown[];
    } | null;
};

function loadItems(): OsrsboxItem[] {
    const filePath = path.join(OSRSBOX_RAW_DIR, "items-complete.json");
    if (!fs.existsSync(filePath)) {
        throw new Error(`Missing ${filePath} — run: npm run data:download`);
    }
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, OsrsboxItem>;
    return Object.values(raw);
}

export function importItems(db: Database.Database): { items: number; equipment: number } {
    const now = new Date().toISOString();
    const items = loadItems();

    const insertItem = db.prepare(`
        INSERT INTO items (
            id, name, examine, members, tradeable, stackable, noted,
            value, high_alch, low_alch, weight, equipable, equipable_weapon,
            source_url, updated_at
        ) VALUES (
            @id, @name, @examine, @members, @tradeable, @stackable, @noted,
            @value, @high_alch, @low_alch, @weight, @equipable, @equipable_weapon,
            @source_url, @updated_at
        )
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            examine = excluded.examine,
            members = excluded.members,
            tradeable = excluded.tradeable,
            stackable = excluded.stackable,
            noted = excluded.noted,
            value = excluded.value,
            high_alch = excluded.high_alch,
            low_alch = excluded.low_alch,
            weight = excluded.weight,
            equipable = excluded.equipable,
            equipable_weapon = excluded.equipable_weapon,
            source_url = excluded.source_url,
            updated_at = excluded.updated_at
    `);

    const insertEquipment = db.prepare(`
        INSERT INTO equipment_stats (
            item_id, slot,
            attack_stab, attack_slash, attack_crush, attack_magic, attack_ranged,
            defence_stab, defence_slash, defence_crush, defence_magic, defence_ranged,
            melee_strength, ranged_strength, magic_damage, prayer,
            attack_speed, weapon_type, requirements_json, weapon_styles_json
        ) VALUES (
            @item_id, @slot,
            @attack_stab, @attack_slash, @attack_crush, @attack_magic, @attack_ranged,
            @defence_stab, @defence_slash, @defence_crush, @defence_magic, @defence_ranged,
            @melee_strength, @ranged_strength, @magic_damage, @prayer,
            @attack_speed, @weapon_type, @requirements_json, @weapon_styles_json
        )
        ON CONFLICT(item_id) DO UPDATE SET
            slot = excluded.slot,
            attack_stab = excluded.attack_stab,
            attack_slash = excluded.attack_slash,
            attack_crush = excluded.attack_crush,
            attack_magic = excluded.attack_magic,
            attack_ranged = excluded.attack_ranged,
            defence_stab = excluded.defence_stab,
            defence_slash = excluded.defence_slash,
            defence_crush = excluded.defence_crush,
            defence_magic = excluded.defence_magic,
            defence_ranged = excluded.defence_ranged,
            melee_strength = excluded.melee_strength,
            ranged_strength = excluded.ranged_strength,
            magic_damage = excluded.magic_damage,
            prayer = excluded.prayer,
            attack_speed = excluded.attack_speed,
            weapon_type = excluded.weapon_type,
            requirements_json = excluded.requirements_json,
            weapon_styles_json = excluded.weapon_styles_json
    `);

    let equipmentCount = 0;
    const importAll = db.transaction(() => {
        db.prepare(`DELETE FROM equipment_stats`).run();
        for (const item of items) {
            if (!item?.id && item.id !== 0) continue;
            insertItem.run({
                id: item.id,
                name: item.name ?? "",
                examine: item.examine ?? null,
                members: item.members ? 1 : 0,
                tradeable: item.tradeable ? 1 : 0,
                stackable: item.stackable ? 1 : 0,
                noted: item.noted ? 1 : 0,
                value: item.cost ?? 0,
                high_alch: item.highalch ?? null,
                low_alch: item.lowalch ?? null,
                weight: item.weight ?? null,
                equipable: item.equipable_by_player ? 1 : 0,
                equipable_weapon: item.equipable_weapon ? 1 : 0,
                source_url: item.wiki_url ?? null,
                updated_at: now,
            });

            if (item.equipable_by_player && item.equipment) {
                const eq = item.equipment;
                insertEquipment.run({
                    item_id: item.id,
                    slot: eq.slot ?? null,
                    attack_stab: eq.attack_stab ?? 0,
                    attack_slash: eq.attack_slash ?? 0,
                    attack_crush: eq.attack_crush ?? 0,
                    attack_magic: eq.attack_magic ?? 0,
                    attack_ranged: eq.attack_ranged ?? 0,
                    defence_stab: eq.defence_stab ?? 0,
                    defence_slash: eq.defence_slash ?? 0,
                    defence_crush: eq.defence_crush ?? 0,
                    defence_magic: eq.defence_magic ?? 0,
                    defence_ranged: eq.defence_ranged ?? 0,
                    melee_strength: eq.melee_strength ?? 0,
                    ranged_strength: eq.ranged_strength ?? 0,
                    magic_damage: eq.magic_damage ?? 0,
                    prayer: eq.prayer ?? 0,
                    attack_speed: item.weapon?.attack_speed ?? null,
                    weapon_type: item.weapon?.weapon_type ?? null,
                    requirements_json: eq.requirements
                        ? JSON.stringify(eq.requirements)
                        : null,
                    weapon_styles_json: item.weapon?.stances
                        ? JSON.stringify(item.weapon.stances)
                        : null,
                });
                equipmentCount++;
            }
        }
    });

    importAll();
    setMeta(db, "items_imported_at", now);
    setMeta(db, "items_source", "osrsbox-db/items-complete.json");
    return { items: items.length, equipment: equipmentCount };
}

if (require.main === module) {
    const db = openDatabase();
    const result = importItems(db);
    console.log(`[import-items] ${result.items} items, ${result.equipment} equipment rows`);
}
