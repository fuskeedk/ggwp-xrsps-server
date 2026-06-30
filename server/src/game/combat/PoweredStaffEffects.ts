import type { PlayerState } from "../player";
import { getPoweredStaffSpellData } from "../spells/SpellDataProvider";

/**
 * Apply powered staff on-hit effects (e.g. Sanguinesti 1/6 chance to heal 50%).
 */
export function applyPoweredStaffHitEffects(
    player: PlayerState,
    weaponId: number,
    damageDealt: number,
    landed: boolean,
): void {
    if (!landed || !(damageDealt > 0) || !(weaponId > 0)) return;

    const staffData = getPoweredStaffSpellData(weaponId);
    const effects = staffData?.effects;
    if (!effects?.healChance || !effects.healPercent) return;

    if (Math.random() >= effects.healChance) return;

    const healAmount = Math.floor(damageDealt * effects.healPercent);
    if (healAmount > 0) {
        player.skillSystem.applyHitpointsHeal(healAmount);
    }
}
