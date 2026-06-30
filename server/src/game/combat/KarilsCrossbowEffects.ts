/**
 * Karil's crossbow effects — Amulet of the Damned double hit.
 *
 * With full Karil's set + Amulet of the Damned, each attack has a 25% chance
 * to land a second hitsplat dealing half the primary damage on the same tick.
 */
import { EquipmentSlot } from "../../../../src/rs/config/player/Equipment";
import { HITMARK_DAMAGE } from "./HitEffects";
import { hasBarrowsSet } from "./BarrowsEquipment";

export const KARILS_CROSSBOW_IDS = new Set([4734, 4934, 4935, 4936, 4937, 4938]);

const AMULET_OF_DAMNED = 12851;
const AMULET_OF_DAMNED_FULL = 12853;

export const KARIL_DAMNED_DOUBLE_HIT_CHANCE = 0.25;

export interface KarilSecondaryHit {
    damage: number;
    style: number;
}

export function isKarilsCrossbow(weaponId: number): boolean {
    return KARILS_CROSSBOW_IDS.has(weaponId);
}

export function hasKarilDamnedSet(equipment: number[]): boolean {
    if (!hasBarrowsSet(equipment, "karil")) {
        return false;
    }
    const neck = equipment[EquipmentSlot.AMULET];
    return neck === AMULET_OF_DAMNED || neck === AMULET_OF_DAMNED_FULL;
}

export function rollKarilDamnedSecondaryHit(
    primaryDamage: number,
    random: () => number = Math.random,
): KarilSecondaryHit | undefined {
    if (primaryDamage <= 0 || random() >= KARIL_DAMNED_DOUBLE_HIT_CHANCE) {
        return undefined;
    }
    const damage = Math.max(1, Math.floor(primaryDamage / 2));
    return { damage, style: HITMARK_DAMAGE };
}

export function tryKarilDamnedSecondaryHit(
    equipment: number[],
    weaponId: number,
    primaryDamage: number,
    random: () => number = Math.random,
): KarilSecondaryHit | undefined {
    if (!isKarilsCrossbow(weaponId) || !hasKarilDamnedSet(equipment)) {
        return undefined;
    }
    return rollKarilDamnedSecondaryHit(primaryDamage, random);
}
