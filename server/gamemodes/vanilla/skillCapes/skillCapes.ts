import { SkillId } from "../../../../src/rs/skill/skills";

export type SkillCapeDefinition = {
    skillId: SkillId;
    displayName: string;
    aliases: string[];
    capeId: number;
    trimmedCapeId: number;
    hoodId: number;
};

export const SKILL_CAPE_PRICE = 99_000;
export const COINS_ITEM_ID = 995;

export const SKILL_CAPES: SkillCapeDefinition[] = [
    def(SkillId.Attack, "Attack", ["atk"]),
    def(SkillId.Defence, "Defence", ["def"]),
    def(SkillId.Strength, "Strength", ["str"]),
    def(SkillId.Hitpoints, "Hitpoints", ["hp", "hitpoint"]),
    def(SkillId.Ranged, "Ranging", ["range", "ranged"]),
    def(SkillId.Prayer, "Prayer"),
    def(SkillId.Magic, "Magic", ["mage"]),
    def(SkillId.Cooking, "Cooking", ["cook"]),
    def(SkillId.Woodcutting, "Woodcutting", ["wc", "woodcut"]),
    def(SkillId.Fletching, "Fletching", ["fletch"]),
    def(SkillId.Fishing, "Fishing", ["fish"]),
    def(SkillId.Firemaking, "Firemaking", ["fm"]),
    def(SkillId.Crafting, "Crafting"),
    def(SkillId.Smithing, "Smithing", ["smith"]),
    def(SkillId.Mining, "Mining", ["mine"]),
    def(SkillId.Herblore, "Herblore", ["herb"]),
    def(SkillId.Agility, "Agility", ["agi"]),
    def(SkillId.Thieving, "Thieving", ["thief"]),
    def(SkillId.Slayer, "Slayer"),
    def(SkillId.Farming, "Farming", ["farm"]),
    def(SkillId.Runecraft, "Runecrafting", ["rc", "runecraft"]),
    def(SkillId.Hunter, "Hunter", ["hunt"]),
    def(SkillId.Construction, "Construction", ["con", "cons"]),
];

const byLookup = new Map<string, SkillCapeDefinition>();
const bySkillId = new Map<SkillId, SkillCapeDefinition>();
for (const cape of SKILL_CAPES) {
    byLookup.set(normalize(cape.displayName), cape);
    bySkillId.set(cape.skillId, cape);
    for (const alias of cape.aliases) {
        byLookup.set(normalize(alias), cape);
    }
}

function def(
    skillId: SkillId,
    displayName: string,
    aliases: string[] = [],
    ids?: { cape: number; trimmed: number; hood: number },
): SkillCapeDefinition {
    const table: Partial<Record<SkillId, { cape: number; trimmed: number; hood: number }>> = {
        [SkillId.Attack]: { cape: 9747, trimmed: 9748, hood: 9749 },
        [SkillId.Strength]: { cape: 9750, trimmed: 9751, hood: 9752 },
        [SkillId.Defence]: { cape: 9753, trimmed: 9754, hood: 9755 },
        [SkillId.Ranged]: { cape: 9756, trimmed: 9757, hood: 9758 },
        [SkillId.Prayer]: { cape: 9759, trimmed: 9760, hood: 9761 },
        [SkillId.Magic]: { cape: 9762, trimmed: 9763, hood: 9764 },
        [SkillId.Runecraft]: { cape: 9765, trimmed: 9766, hood: 9767 },
        [SkillId.Hitpoints]: { cape: 9768, trimmed: 9769, hood: 9770 },
        [SkillId.Agility]: { cape: 9771, trimmed: 9772, hood: 9773 },
        [SkillId.Herblore]: { cape: 9774, trimmed: 9775, hood: 9776 },
        [SkillId.Thieving]: { cape: 9777, trimmed: 9778, hood: 9779 },
        [SkillId.Crafting]: { cape: 9780, trimmed: 9781, hood: 9782 },
        [SkillId.Fletching]: { cape: 9783, trimmed: 9784, hood: 9785 },
        [SkillId.Slayer]: { cape: 9786, trimmed: 9787, hood: 9788 },
        [SkillId.Construction]: { cape: 9789, trimmed: 9790, hood: 9791 },
        [SkillId.Mining]: { cape: 9792, trimmed: 9793, hood: 9794 },
        [SkillId.Smithing]: { cape: 9795, trimmed: 9796, hood: 9797 },
        [SkillId.Fishing]: { cape: 9798, trimmed: 9799, hood: 9800 },
        [SkillId.Cooking]: { cape: 9801, trimmed: 9802, hood: 9803 },
        [SkillId.Firemaking]: { cape: 9804, trimmed: 9805, hood: 9806 },
        [SkillId.Woodcutting]: { cape: 9807, trimmed: 9808, hood: 9809 },
        [SkillId.Farming]: { cape: 9810, trimmed: 9811, hood: 9812 },
        [SkillId.Hunter]: { cape: 9948, trimmed: 9949, hood: 9950 },
    };
    const resolved = ids ?? table[skillId];
    if (!resolved) {
        throw new Error(`Missing skillcape ids for ${displayName}`);
    }
    return {
        skillId,
        displayName,
        aliases,
        capeId: resolved.cape,
        trimmedCapeId: resolved.trimmed,
        hoodId: resolved.hood,
    };
}

function normalize(value: string): string {
    return value.toLowerCase().replace(/[\s_-]/g, "");
}

export function resolveSkillCape(input: string): SkillCapeDefinition | undefined {
    return byLookup.get(normalize(input));
}

export function skillCapeForSkill(skillId: SkillId): SkillCapeDefinition | undefined {
    return bySkillId.get(skillId);
}
