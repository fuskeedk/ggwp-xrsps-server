import { DB_PATH } from "./config";
import { openDatabase } from "./db";
import { importItems } from "./import-items";
import { importNpcs } from "./import-npcs";
import { importPrices } from "./import-prices";
import { validateDatabase } from "./validate";

async function main(): Promise<void> {
    console.log(`[import-all] database: ${DB_PATH}`);
    const db = openDatabase();

    const items = importItems(db);
    console.log(`[import-items] ${items.items} items, ${items.equipment} equipment`);

    const npcs = importNpcs(db);
    console.log(`[import-npcs] ${npcs} NPCs`);

    const prices = importPrices(db);
    console.log(`[import-prices] ${prices} GE prices`);

    const ok = validateDatabase(db);
    if (!ok) {
        process.exit(1);
    }
    console.log("[done] import complete");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
