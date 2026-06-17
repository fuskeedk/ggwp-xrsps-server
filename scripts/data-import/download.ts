import fs from "fs";
import path from "path";

import {
    OSRSBOX_RAW_DIR,
    OSRSBOX_SOURCES,
    PRICES_RAW_DIR,
    PRICES_SOURCES,
    REFERENCES_DIR,
    ensureDir,
} from "./config";
import { downloadFile, fetchJson } from "./http";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function downloadOsrsbox(): Promise<void> {
    ensureDir(OSRSBOX_RAW_DIR);
    const files: Array<{ url: string; name: string }> = [
        { url: OSRSBOX_SOURCES.itemsComplete, name: "items-complete.json" },
        { url: OSRSBOX_SOURCES.monstersComplete, name: "monsters-complete.json" },
        { url: OSRSBOX_SOURCES.itemsSummary, name: "items-summary.json" },
    ];
    for (const file of files) {
        await downloadFile(file.url, path.join(OSRSBOX_RAW_DIR, file.name), {
            maxAgeMs: ONE_DAY_MS,
        });
    }
}

async function downloadPrices(): Promise<void> {
    ensureDir(PRICES_RAW_DIR);
    const latestPath = path.join(PRICES_RAW_DIR, "latest.json");
    const mappingPath = path.join(PRICES_RAW_DIR, "mapping.json");

    if (
        !fs.existsSync(latestPath) ||
        Date.now() - fs.statSync(latestPath).mtimeMs > ONE_DAY_MS
    ) {
        console.log(`[download] ${PRICES_SOURCES.latest}`);
        const latest = await fetchJson<unknown>(PRICES_SOURCES.latest);
        fs.writeFileSync(latestPath, JSON.stringify(latest, null, 2));
        console.log(`[saved] ${latestPath}`);
    } else {
        console.log(`[skip] ${latestPath} (fresh)`);
    }

    if (
        !fs.existsSync(mappingPath) ||
        Date.now() - fs.statSync(mappingPath).mtimeMs > 7 * ONE_DAY_MS
    ) {
        console.log(`[download] ${PRICES_SOURCES.mapping}`);
        const mapping = await fetchJson<unknown>(PRICES_SOURCES.mapping);
        fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));
        console.log(`[saved] ${mappingPath}`);
    } else {
        console.log(`[skip] ${mappingPath} (fresh)`);
    }
}

function syncReferences(): void {
    const monstersSrc = path.join(OSRSBOX_RAW_DIR, "monsters-complete.json");
    if (!fs.existsSync(monstersSrc)) {
        console.warn("[warn] monsters-complete.json missing — run download first");
        return;
    }
    ensureDir(REFERENCES_DIR);
    const monstersDest = path.join(REFERENCES_DIR, "monsters-complete.json");
    fs.copyFileSync(monstersSrc, monstersDest);
    console.log(`[sync] ${monstersDest}`);
}

async function main(): Promise<void> {
    await downloadOsrsbox();
    await downloadPrices();
    syncReferences();
    console.log("[done] download complete");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
