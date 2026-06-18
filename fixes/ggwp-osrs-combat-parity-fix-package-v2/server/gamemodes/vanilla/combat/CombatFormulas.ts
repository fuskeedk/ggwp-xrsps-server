import { AttackType } from "../../../src/game/combat/AttackType";
import type {
    AttackerStats,
    CombatFormulaProvider,
    DefenderStats,
    MaxHitParams,
    NpcAttackBonusProfile,
    NpcDefenceBonusProfile,
    NpcMaxHitProfile,
    NpcVsPlayerProfile,
    NpcVsPlayerResult,
    PlayerDefenceProfile,
} from "../../../src/game/combat/CombatFormulaProvider";

function attackRoll(attacker: AttackerStats): number {
    return attacker.effectiveLevel * (attacker.bonus + 64);
}

function defenceRoll(defender: DefenderStats): number {
    return defender.effectiveLevel * (defender.bonus + 64);
}

function hitChance(atkRoll: number, defRoll: number): number {
    if (defRoll <= 0) return 1;
    if (atkRoll > defRoll) {
        return 1 - (defRoll + 2) / (2 * (atkRoll + 1));
    }
    return atkRoll / (2 * (defRoll + 1));
}

function maxHit(params: MaxHitParams): number {
    const raw = 0.5 + (params.effectiveStrength * (params.strengthBonus + 64)) / 640;
    return Math.floor(raw);
}

function rollDamage(max: number, random: number): number {
    if (max <= 0) return 0;
    return Math.floor(random * (max + 1));
}

function effectiveLevel(level: number, prayerMultiplier: number, stanceBonus: number): number {
    const prayed = Math.floor(level * prayerMultiplier);
    return Math.max(1, prayed + stanceBonus + 8);
}

function effectiveMagicDefence(magicLevel: number, defenceLevel: number): number {
    return Math.max(1, Math.floor(magicLevel * 0.7 + defenceLevel * 0.3) + 8);
}

function npcEffectiveAttack(attackLevel: number): number {
    return attackLevel + 9;
}

function npcEffectiveStrength(strengthLevel: number): number {
    return strengthLevel + 9;
}

function npcEffectiveDefence(defenceLevel: number): number {
    return defenceLevel + 9;
}

function getNpcAttackBonus(profile: NpcAttackBonusProfile, attackType: AttackType): number {
    switch (attackType) {
        case AttackType.Magic:
            return profile.magicBonus;
        case AttackType.Ranged:
            return profile.rangedBonus;
        case AttackType.Melee:
        default:
            return profile.attackBonus;
    }
}

function getNpcDefenceBonus(
    profile: NpcDefenceBonusProfile,
    attackType: AttackType,
    meleeStyle: "stab" | "slash" | "crush" = "slash",
): number {
    switch (attackType) {
        case AttackType.Magic:
            return profile.defenceMagic;
        case AttackType.Ranged:
            return profile.defenceRanged;
        case AttackType.Melee:
        default:
            switch (meleeStyle) {
                case "stab":
                    return profile.defenceStab;
                case "crush":
                    return profile.defenceCrush;
                case "slash":
                default:
                    return profile.defenceSlash;
            }
    }
}

function npcMaxHit(profile: NpcMaxHitProfile): number {
    if (profile.maxHit > 0) {
        return profile.maxHit;
    }
    const attackType = profile.attackType ?? AttackType.Melee;
    const strengthLevel =
        attackType === AttackType.Magic
            ? (profile.magicLevel ?? profile.strengthLevel)
            : attackType === AttackType.Ranged
              ? (profile.rangedLevel ?? profile.strengthLevel)
              : profile.strengthLevel;
    const strengthBonus =
        attackType === AttackType.Magic
            ? (profile.magicStrengthBonus ?? profile.strengthBonus)
            : attackType === AttackType.Ranged
              ? (profile.rangedStrengthBonus ?? profile.strengthBonus)
              : profile.strengthBonus;
    const effectiveStr = npcEffectiveStrength(strengthLevel);
    return maxHit({ effectiveStrength: effectiveStr, strengthBonus });
}

function calculateNpcVsPlayer(
    npcProfile: NpcVsPlayerProfile,
    playerDefence: PlayerDefenceProfile,
    attackType?: AttackType,
): NpcVsPlayerResult {
    const type = attackType ?? npcProfile.attackType;

    const npcAttackLevel =
        type === AttackType.Magic
            ? (npcProfile.magicLevel ?? npcProfile.attackLevel)
            : type === AttackType.Ranged
              ? (npcProfile.rangedLevel ?? npcProfile.attackLevel)
              : npcProfile.attackLevel;
    const npcEffAtk = npcEffectiveAttack(npcAttackLevel);
    const npcAtkBonus = getNpcAttackBonus(npcProfile, type);
    const npcAtkRoll = attackRoll({ effectiveLevel: npcEffAtk, bonus: npcAtkBonus });

    const defencePrayer = playerDefence.defencePrayerMultiplier ?? 1;
    const defenceStance = playerDefence.defenceStanceBonus ?? 0;
    let playerEffDef: number;
    if (type === AttackType.Magic) {
        const magicPrayer = playerDefence.magicPrayerMultiplier ?? 1;
        const prayedMagic = Math.max(1, Math.floor(playerDefence.magicLevel * magicPrayer));
        const prayedDefence = Math.max(
            1,
            Math.floor(playerDefence.defenceLevel * defencePrayer) + defenceStance,
        );
        playerEffDef = effectiveMagicDefence(prayedMagic, prayedDefence);
    } else {
        playerEffDef = effectiveLevel(playerDefence.defenceLevel, defencePrayer, defenceStance);
    }
    const playerDefRoll = defenceRoll({
        effectiveLevel: playerEffDef,
        bonus: playerDefence.defenceBonus,
    });

    return {
        hitChance: hitChance(npcAtkRoll, playerDefRoll),
        maxHit: npcMaxHit({ ...npcProfile, attackType: type }),
    };
}

export function createCombatFormulaProvider(): CombatFormulaProvider {
    return {
        attackRoll,
        defenceRoll,
        hitChance,
        maxHit,
        rollDamage,
        effectiveLevel,
        effectiveMagicDefence,
        npcEffectiveAttack,
        npcEffectiveStrength,
        npcEffectiveDefence,
        getNpcAttackBonus,
        getNpcDefenceBonus,
        npcMaxHit,
        calculateNpcVsPlayer,
    };
}
