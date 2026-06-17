import fs from "fs";
import path from "path";

import { logger } from "../../src/utils/logger";

const HOST_CATALOG_PATH = "/home/ggwp/public_html/data/osrs/items.json";
const BUNDLED_CATALOG_PATH = path.resolve(__dirname, "../../data/osrs-spawn-catalog.json");

let spawnToItemId: Map<string, number> | null = null;

function resolveCatalogPath(): string | undefined {
    const envPath = process.env.GGWP_ITEM_CATALOG_PATH?.trim();
    const candidates = [
        envPath,
        BUNDLED_CATALOG_PATH,
        HOST_CATALOG_PATH,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    for (const candidate of candidates) {
        try {
            if (fs.existsSync(candidate)) {
                return candidate;
            }
        } catch {
            // ignore access errors and try next candidate
        }
    }
    return undefined;
}

function loadCatalog(): Map<string, number> {
    if (spawnToItemId) {
        return spawnToItemId;
    }

    const map = new Map<string, number>();
    const catalogPath = resolveCatalogPath();

    if (!catalogPath) {
        logger.warn(
            "[ggwp-spawn-catalog] no catalog file found (set GGWP_ITEM_CATALOG_PATH or ship server/data/osrs-spawn-catalog.json)",
        );
        spawnToItemId = map;
        return map;
    }

    try {
        const raw = fs.readFileSync(catalogPath, "utf8");
        const parsed = JSON.parse(raw) as { items?: Array<{ id?: number; spawn?: string }> };
        const items = Array.isArray(parsed.items) ? parsed.items : [];
        for (const entry of items) {
            const spawn = typeof entry.spawn === "string" ? entry.spawn.trim().toLowerCase() : "";
            const id = typeof entry.id === "number" ? entry.id | 0 : 0;
            if (spawn.length > 0 && id > 0) {
                map.set(spawn, id);
            }
        }
        logger.info(`[ggwp-spawn-catalog] loaded ${map.size} spawn names from ${catalogPath}`);
    } catch (err) {
        logger.warn(`[ggwp-spawn-catalog] failed to load ${catalogPath}`, err);
    }

    spawnToItemId = map;
    return map;
}

export function resolveSpawnNameToItemId(spawnName: string): number | undefined {
    const normalized = spawnName.trim().toLowerCase();
    if (!normalized) {
        return undefined;
    }
    return loadCatalog().get(normalized);
}

/** Test hook: force reload after catalog file changes. */
export function resetSpawnCatalogForTests(): void {
    spawnToItemId = null;
}
