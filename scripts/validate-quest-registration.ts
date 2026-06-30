import { validateQuestRegistration } from "../server/gamemodes/vanilla/quests/questRegistrationParity";

function main(): void {
    const report = validateQuestRegistration();

    console.log("Quest registration parity");
    console.log("=".repeat(40));
    console.log(`Registered definitions: ${report.registeredCount}`);
    console.log(`Reference definitions:  ${report.referenceCount}`);
    console.log(`Reference miniquests:   ${report.miniquestCount}`);
    console.log(`Missing from registered: ${report.missingFromRegistered.length}`);
    console.log(`Extra registered:        ${report.extraRegistered.length}`);
    console.log(`Duplicate keys:          ${report.duplicateKeys.length}`);

    let failed = false;

    if (report.missingFromRegistered.length > 0) {
        failed = true;
        console.log("\nMissing quests:");
        for (const quest of report.missingFromRegistered) {
            console.log(`  - ${quest.id} (${quest.title})`);
        }
    }

    if (report.extraRegistered.length > 0) {
        failed = true;
        console.log("\nExtra registered quests:");
        for (const quest of report.extraRegistered) {
            console.log(`  + ${quest.key} (${quest.name})`);
        }
    }

    if (report.duplicateKeys.length > 0) {
        failed = true;
        console.log("\nDuplicate keys:");
        for (const key of report.duplicateKeys) {
            console.log(`  ! ${key}`);
        }
    }

    if (failed) {
        process.exit(1);
    }

    console.log("\nOK: registered quests match the 209-entry quest reference.");
}

main();
