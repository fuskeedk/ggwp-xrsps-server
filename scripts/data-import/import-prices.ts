import fs from "fs";
import path from "path";

import type Database from "better-sqlite3";

import { PRICES_RAW_DIR } from "./config";
import { openDatabase, setMeta } from "./db";

type LatestResponse = {
    data?: Record<
        string,
        {
            high?: number;
            low?: number;
            highTime?: number;
            lowTime?: number;
        }
    >;
};

export function importPrices(db: Database.Database): number {
    const latestPath = path.join(PRICES_RAW_DIR, "latest.json");
    if (!fs.existsSync(latestPath)) {
        throw new Error(`Missing ${latestPath} — run: npm run data:download`);
    }

    const now = new Date().toISOString();
    const latest = JSON.parse(fs.readFileSync(latestPath, "utf8")) as LatestResponse;
    const data = latest.data ?? {};

    const insertPrice = db.prepare(`
        INSERT INTO prices (item_id, high, low, high_time, low_time, updated_at)
        VALUES (@item_id, @high, @low, @high_time, @low_time, @updated_at)
        ON CONFLICT(item_id) DO UPDATE SET
            high = excluded.high,
            low = excluded.low,
            high_time = excluded.high_time,
            low_time = excluded.low_time,
            updated_at = excluded.updated_at
    `);

    let count = 0;
    const importAll = db.transaction(() => {
        for (const [itemIdStr, entry] of Object.entries(data)) {
            const itemId = Number(itemIdStr);
            if (!Number.isFinite(itemId)) continue;
            insertPrice.run({
                item_id: itemId,
                high: entry.high ?? null,
                low: entry.low ?? null,
                high_time: entry.highTime ?? null,
                low_time: entry.lowTime ?? null,
                updated_at: now,
            });
            count++;
        }
    });

    importAll();
    setMeta(db, "prices_imported_at", now);
    setMeta(db, "prices_source", "prices.runescape.wiki/api/v1/osrs/latest");
    return count;
}

if (require.main === module) {
    const db = openDatabase();
    const count = importPrices(db);
    console.log(`[import-prices] ${count} price rows`);
}
