import type { PlayerState } from "../player";
import {
    SpecialAttackRegistry,
    isDarkBow,
    resolveAmmoModifiers,
    type SpecialAttackDef,
} from "./SpecialAttackProvider";

export type PlayerAttackModifiers = {
    accuracyMultiplier?: number;
    maxHitMultiplier?: number;
    forceHit?: boolean;
};

export type BuiltSpecialAttackPayload = {
    weaponItemId: number;
    costPercent: number;
    accuracyMultiplier: number;
    maxHitMultiplier: number;
    hitCount: number;
    forceHit?: boolean;
    effects?: {
        siphonRunEnergyPercent?: number;
        healFraction?: number;
        prayerFraction?: number;
        freezeTicks?: number;
        prayerDisableTicks?: number;
        drainDefencePercent?: number;
        drainDefenceByDamage?: number;
        drainDefenceOnlyIfNotDrained?: boolean;
        drainMagicByDamage?: boolean;
        drainCombatStatByDamage?: boolean;
        ignoreProtectionPrayer?: boolean;
    };
    minDamagePerHit?: number;
    maxDamagePerHit?: number;
    specGraphicId?: number;
    specProjectileId?: number;
    specSoundId?: number;
    hitSounds?: number[];
};

export type BuiltPlayerSpecialAttack = {
    special: BuiltSpecialAttackPayload;
    modifiers: PlayerAttackModifiers;
    hitCount: number;
    specialDef: SpecialAttackDef;
    forceFirstHit: boolean;
};

/**
 * Build special-attack payload and roll modifiers when spec is activated.
 * Shared by NPC and PvP player attack scheduling.
 */
export function buildPlayerSpecialAttack(
    player: PlayerState,
    weaponItemId: number,
    getWeaponSpecialCostPercent?: (weaponItemId: number) => number | undefined,
): BuiltPlayerSpecialAttack | undefined {
    if (!player.specEnergy.isActivated() || weaponItemId <= 0) {
        return undefined;
    }

    const specialDef = SpecialAttackRegistry.get(weaponItemId);
    if (!specialDef) {
        return undefined;
    }

    const costPercent = getWeaponSpecialCostPercent?.(weaponItemId) ?? specialDef.energyCost;
    if (costPercent === undefined || costPercent <= 0) {
        return undefined;
    }

    const forceFirstHit = !!specialDef.effects?.guaranteedFirstHit;
    const hitCount = Math.max(1, Math.min(10, specialDef.hitCount || 1));
    const forceHit = forceFirstHit ? true : undefined;
    const modifiers: PlayerAttackModifiers = {
        accuracyMultiplier: specialDef.accuracyMultiplier,
        maxHitMultiplier: specialDef.damageMultiplier,
        forceHit,
    };

    const effects: NonNullable<BuiltSpecialAttackPayload["effects"]> = {};
    if (specialDef.effects?.freezeTicks !== undefined) {
        effects.freezeTicks = specialDef.effects.freezeTicks;
    }
    if (specialDef.effects?.healFraction !== undefined) {
        effects.healFraction = specialDef.effects.healFraction;
    }
    if (specialDef.effects?.prayerFraction !== undefined) {
        effects.prayerFraction = specialDef.effects.prayerFraction;
    }
    if (specialDef.effects?.drainRunEnergy !== undefined) {
        effects.siphonRunEnergyPercent = specialDef.effects.drainRunEnergy;
    }
    if (specialDef.effects?.drainDefence !== undefined) {
        effects.drainDefencePercent = specialDef.effects.drainDefence;
    }
    if (specialDef.effects?.drainDefenceByDamage !== undefined) {
        effects.drainDefenceByDamage = specialDef.effects.drainDefenceByDamage;
        if (specialDef.effects.drainDefenceOnlyIfNotDrained) {
            effects.drainDefenceOnlyIfNotDrained = true;
        }
    }
    const prayerDisableTicks = (
        specialDef.effects as { prayerDisableTicks?: number } | undefined
    )?.prayerDisableTicks;
    if (prayerDisableTicks !== undefined) {
        effects.prayerDisableTicks = prayerDisableTicks;
    }
    if (specialDef.effects?.drainMagicByDamage) {
        effects.drainMagicByDamage = true;
    }
    const drainCombatStatByDamage = (
        specialDef.effects as { drainCombatStatByDamage?: boolean } | undefined
    )?.drainCombatStatByDamage;
    if (drainCombatStatByDamage || specialDef.effects?.drainAllCombatByDamage) {
        effects.drainCombatStatByDamage = true;
    }
    if (specialDef.effects?.ignoreProtectionPrayer) {
        effects.ignoreProtectionPrayer = true;
    }
    const hasEffects = Object.values(effects).some((v) => v !== undefined);

    let damageMultiplier = specialDef.damageMultiplier;
    let minDamagePerHit: number | undefined;
    let maxDamagePerHit: number | undefined;
    let specGraphicId: number | undefined;
    let specProjectileId: number | undefined;
    let specSoundId: number | undefined;

    if (isDarkBow(weaponItemId) && specialDef.ammoModifiers) {
        const equip = player.appearance?.equip;
        const ammoId = Array.isArray(equip) ? equip[10] : 0;
        const ammoMods = resolveAmmoModifiers(specialDef, ammoId);
        damageMultiplier = ammoMods.damageMultiplier;
        minDamagePerHit = ammoMods.minDamagePerHit;
        maxDamagePerHit = ammoMods.maxDamagePerHit;
        specGraphicId = ammoMods.graphicId;
        specProjectileId = ammoMods.projectileId;
        specSoundId = ammoMods.soundId;
        modifiers.maxHitMultiplier = damageMultiplier;
    }

    const special: BuiltSpecialAttackPayload = {
        weaponItemId,
        costPercent: Math.max(1, Math.min(100, costPercent)),
        accuracyMultiplier: specialDef.accuracyMultiplier,
        maxHitMultiplier: damageMultiplier,
        hitCount,
        forceHit,
        effects: hasEffects ? effects : undefined,
        minDamagePerHit,
        maxDamagePerHit,
        specGraphicId,
        specProjectileId,
        specSoundId,
        hitSounds: specialDef.hitSounds,
    };

    return {
        special,
        modifiers,
        hitCount,
        specialDef,
        forceFirstHit,
    };
}
