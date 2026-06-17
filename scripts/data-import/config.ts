import fs from "fs";
import path from "path";

/** Project root (xrsps-typescript). */
export const PROJECT_ROOT = path.resolve(__dirname, "../..");

export const DATA_ROOT = path.join(PROJECT_ROOT, "data");
export const RAW_ROOT = path.join(DATA_ROOT, "raw");
export const OSRSBOX_RAW_DIR = path.join(RAW_ROOT, "osrsbox");
export const PRICES_RAW_DIR = path.join(RAW_ROOT, "prices");
export const DB_PATH = path.join(DATA_ROOT, "db", "osrs.sqlite");

/** Existing server code expects monsters-complete here (gitignored). */
export const REFERENCES_DIR = path.join(PROJECT_ROOT, "references");

export const USER_AGENT = "ggwp-xrsps/0.1 (https://osrs.ggwp.dk; data-import)";

const OSRSBOX_GITHUB_BASE =
    "https://raw.githubusercontent.com/osrsbox/osrsbox-db/master/docs";

export const OSRSBOX_SOURCES = {
    itemsComplete: `${OSRSBOX_GITHUB_BASE}/items-complete.json`,
    monstersComplete: `${OSRSBOX_GITHUB_BASE}/monsters-complete.json`,
    itemsSummary: `${OSRSBOX_GITHUB_BASE}/items-summary.json`,
} as const;

export const PRICES_SOURCES = {
    latest: "https://prices.runescape.wiki/api/v1/osrs/latest",
    mapping: "https://prices.runescape.wiki/api/v1/osrs/mapping",
} as const;

export const ATTRIBUTION = {
    osrsbox: "https://github.com/osrsbox/osrsbox-db (GPL-3.0)",
    wiki: "https://oldschool.runescape.wiki/ (CC BY-NC-SA 3.0)",
    prices: "https://prices.runescape.wiki/",
} as const;

export function ensureDir(dir: string): void {
    fs.mkdirSync(dir, { recursive: true });
}

export function rawPath(subdir: string, filename: string): string {
    return path.join(RAW_ROOT, subdir, filename);
}
