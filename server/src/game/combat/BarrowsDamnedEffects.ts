/**
 * Amulet of the Damned bonuses for Barrows sets (OSRS parity).
 */
import { EquipmentSlot } from "../../../../src/rs/config/player/Equipment";
import { ensureEquipArrayOn } from "../equipment";
import type { PlayerState } from "../player";
import { hasBarrowsSet } from "./BarrowsEquipment";

const AMULET_OF_DAMNED = 12851;
const AMULET_OF_DAMNED_FULL = 12853;

export const DHAROK_DAMNED_RECOIL_CHANCE = 0.25;
export const DHAROK_DAMNED_RECOIL_FRACTION = 0.15;
export const VERAC_DAMNED_PRAYER_BONUS = 7;
export const TORAG_DAMNED_DEFENCE_PER_MISSING_HP = 0.01;

function hasAmuletOfDamned(equipment: number[]): boolean {
    const neck = equipment[EquipmentSlot.AMULET];
    return neck === AMULET_OF_DAMNED || neck === AMULET_OF_DAMNED_FULL;
}

export function hasDharoksDamnedSet(equipment: number[]): boolean {
    return hasBarrowsSet(equipment, "dharok") && hasAmuletOfDamned(equipment);
}

export function hasToragsDamnedSet(equipment: number[]): boolean {
    return hasBarrowsSet(equipment, "torag") && hasAmuletOfDamned(equipment);
}

export function hasVeracsDamnedSet(equipment: number[]): boolean {
    return hasBarrowsSet(equipment, "verac") && hasAmuletOfDamned(equipment);
}

export function getToragDamnedDefenceMultiplier(
    missingHp: number,
    equipment: number[],
): number {
    if (!hasToragsDamnedSet(equipment)) {
        return 1;
    }
    return 1 + Math.max(0, missingHp) * TORAG_DAMNED_DEFENCE_PER_MISSING_HP;
}

export function getVeracDamnedPrayerBonus(equipment: number[]): number {
    return hasVeracsDamnedSet(equipment) ? VERAC_DAMNED_PRAYER_BONUS : 0;
}

export function rollDharokDamnedRecoilDamage(
    equipment: number[],
    damageTaken: number,
    random: () => number = Math.random,
): number {
    if (damageTaken <= 0 || !hasDharoksDamnedSet(equipment)) {
        return 0;
    }
    if (random() >= DHAROK_DAMNED_RECOIL_CHANCE) {
        return 0;
    }
    return Math.max(1, Math.floor(damageTaken * DHAROK_DAMNED_RECOIL_FRACTION));
}

export function getPlayerToragDamnedDefenceMultiplier(player: PlayerState): number {
    const equipment = ensureEquipArrayOn(player.appearance);
    const current = player.skillSystem.getHitpointsCurrent();
    const max = player.skillSystem.getHitpointsMax();
    return getToragDamnedDefenceMultiplier(Math.max(0, max - current), equipment);
}

export function scaleDefenceLevelForToragDamned(
    player: PlayerState,
    defenceLevel: number,
): number {
    const multiplier = getPlayerToragDamnedDefenceMultiplier(player);
    if (multiplier === 1) {
        return defenceLevel;
    }
    return Math.max(1, Math.floor(defenceLevel * multiplier));
}
