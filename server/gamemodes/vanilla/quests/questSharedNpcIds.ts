/**
 * NPC ids used by more than one quest talk-to handler.
 * Update this list when adding new shared-NPC chains so regressions are caught in tests.
 */
export const KNOWN_SHARED_QUEST_NPC_IDS: readonly number[] = [
    // Bespoke quest packs
    1259, // Rag and Bone Man I / II (generated)
    1423, // The Grand Tree / Monkey Madness I
    1603, // Mage Arena I / II (generated)
    2011, // Plague City / Biohazard (Elena)
    2985, // In Search of the Myreque / Ghosts Ahoy (Velorina)
    3395, // Recipe for Disaster / Recruitment Drive (generated)
    3443, // Temple of Ikov / Underground Pass (Lucien)
    3479, // Vampyre Slayer / Horror from the Deep (Morgan)
    3490, // Making History / The Slug Menace (generated finish)
    3531, // Merlin's Crystal / Holy Grail (King Arthur)
    3926, // The Fremennik Exiles / Trials (generated)
    4119, // Death Plateau / Troll Stronghold (Godric)
    4157, // Making Friends with My Arm / My Arm's Big Adventure (generated)
    4536, // Mourning's End Part II / Song of the Elves (generated finish)
    4625, // Jungle Potion / Shilo Village (Trufitus)
    4687, // The Slug Menace / Wanted (generated start)
    4963, // Tree Gnome Village / Regicide (King Bolren)
    5215, // Shield of Arrav / Priest in Peril (King Roald)
    5832, // Fairytale I / II (generated)
    6204, // Plague City / Underground Pass (Edmond)
    9804, // Priest in Peril / Nature Spirit (Drezel)
];
