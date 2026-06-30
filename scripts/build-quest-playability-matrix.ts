import fs from "fs";
import path from "path";

import { buildQuestPlayabilityMatrix } from "../server/gamemodes/vanilla/quests/questPlayabilityMatrix";

const OUTPUT_JSON = path.join(
    __dirname,
    "../server/data/quest-reference/playability-matrix.json",
);

function main(): void {
    const matrix = buildQuestPlayabilityMatrix();
    fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
    fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(matrix, null, 2)}\n`, "utf8");

    console.log("Quest playability matrix");
    console.log("=".repeat(40));
    console.log(`Total quests:          ${matrix.totalQuests}`);
    console.log(`Full dialog (simple):  ${matrix.summary.fullDialog}`);
    console.log(`Dialog shell (auto):   ${matrix.summary.dialogShell}`);
    console.log(`Bespoke handcrafted:   ${matrix.summary.bespokeHandcrafted}`);
    console.log(`Broken wiring:         ${matrix.summary.broken}`);
    console.log(`F2P catalog:           ${matrix.summary.f2pCatalog}`);
    console.log(`Members:               ${matrix.summary.members}`);
    console.log(`OSRS custom logic:     ${matrix.summary.osrsCustom}`);
    console.log(`OSRS dialog chain:     ${matrix.summary.osrsDialogChain}`);
    console.log(`OSRS dialog shell:     ${matrix.summary.osrsDialogShell}`);
    console.log(`OSRS wiring broken:    ${matrix.summary.osrsWiringBroken}`);
    console.log(`\nWrote ${OUTPUT_JSON}`);

    const broken = matrix.entries.filter((entry) => entry.tier === "broken");
    if (broken.length > 0) {
        console.log(`\nBroken wiring quests (${broken.length}):`);
        for (const entry of broken.slice(0, 25)) {
            console.log(`  - ${entry.name} [${entry.key}] start=${entry.start} complete=${entry.complete}`);
        }
        if (broken.length > 25) {
            console.log(`  ... and ${broken.length - 25} more (see JSON)`);
        }
    }
}

main();
