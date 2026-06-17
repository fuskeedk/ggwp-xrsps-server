import path from "path";

import Database from "better-sqlite3";

import { DB_PATH, ensureDir } from "./config";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  examine TEXT,
  members INTEGER NOT NULL DEFAULT 0,
  tradeable INTEGER NOT NULL DEFAULT 0,
  stackable INTEGER NOT NULL DEFAULT 0,
  noted INTEGER NOT NULL DEFAULT 0,
  value INTEGER NOT NULL DEFAULT 0,
  high_alch INTEGER,
  low_alch INTEGER,
  weight REAL,
  equipable INTEGER NOT NULL DEFAULT 0,
  equipable_weapon INTEGER NOT NULL DEFAULT 0,
  source_url TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);

CREATE TABLE IF NOT EXISTS equipment_stats (
  item_id INTEGER PRIMARY KEY,
  slot TEXT,
  attack_stab INTEGER NOT NULL DEFAULT 0,
  attack_slash INTEGER NOT NULL DEFAULT 0,
  attack_crush INTEGER NOT NULL DEFAULT 0,
  attack_magic INTEGER NOT NULL DEFAULT 0,
  attack_ranged INTEGER NOT NULL DEFAULT 0,
  defence_stab INTEGER NOT NULL DEFAULT 0,
  defence_slash INTEGER NOT NULL DEFAULT 0,
  defence_crush INTEGER NOT NULL DEFAULT 0,
  defence_magic INTEGER NOT NULL DEFAULT 0,
  defence_ranged INTEGER NOT NULL DEFAULT 0,
  melee_strength INTEGER NOT NULL DEFAULT 0,
  ranged_strength INTEGER NOT NULL DEFAULT 0,
  magic_damage REAL NOT NULL DEFAULT 0,
  prayer INTEGER NOT NULL DEFAULT 0,
  attack_speed INTEGER,
  weapon_type TEXT,
  requirements_json TEXT,
  weapon_styles_json TEXT,
  FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE TABLE IF NOT EXISTS npcs (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  combat_level INTEGER NOT NULL DEFAULT 0,
  hitpoints INTEGER,
  attack_level INTEGER,
  strength_level INTEGER,
  defence_level INTEGER,
  magic_level INTEGER,
  ranged_level INTEGER,
  aggressive INTEGER NOT NULL DEFAULT 0,
  attack_style TEXT,
  max_hit INTEGER,
  examine TEXT,
  members INTEGER NOT NULL DEFAULT 0,
  slayer_level INTEGER,
  slayer_xp REAL,
  locations_json TEXT,
  drops_json TEXT,
  source_url TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_npcs_name ON npcs(name);
CREATE INDEX IF NOT EXISTS idx_npcs_combat_level ON npcs(combat_level);

CREATE TABLE IF NOT EXISTS prices (
  item_id INTEGER PRIMARY KEY,
  high INTEGER,
  low INTEGER,
  high_time INTEGER,
  low_time INTEGER,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  members INTEGER,
  difficulty TEXT,
  length TEXT,
  quest_points INTEGER,
  start_npc TEXT,
  start_location TEXT,
  requirements_json TEXT,
  rewards_json TEXT,
  source_url TEXT,
  updated_at TEXT NOT NULL
);
`;

let cachedDb: Database.Database | undefined;

export function openDatabase(readonly = false): Database.Database {
    if (cachedDb && !readonly) return cachedDb;
    ensureDir(path.dirname(DB_PATH));
    const db = new Database(DB_PATH, readonly ? { readonly: true } : undefined);
    if (!readonly) {
        db.pragma("journal_mode = WAL");
        db.pragma("foreign_keys = ON");
        db.exec(SCHEMA_SQL);
        cachedDb = db;
    }
    return db;
}

export function setMeta(db: Database.Database, key: string, value: string): void {
    db.prepare(
        `INSERT INTO meta(key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ).run(key, value);
}

export function getMeta(db: Database.Database, key: string): string | undefined {
    const row = db.prepare(`SELECT value FROM meta WHERE key = ?`).get(key) as
        | { value: string }
        | undefined;
    return row?.value;
}
