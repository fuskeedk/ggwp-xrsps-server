import type { PlayerState } from "../player";
import { canGraniteMaulCombo } from "./SpecialAttackProvider";

const GRANITE_MAUL_WEAPON_IDS = new Set([4153, 12848]);

export function isGraniteMaulWeapon(weaponId: number): boolean {
    return GRANITE_MAUL_WEAPON_IDS.has(weaponId);
}

export function recordPlayerAttackSwing(player: PlayerState, tick: number): void {
    player.combat.lastAttackSwingTick = tick;
}

/**
 * OSRS granite maul combo: activating spec on the same tick as the previous
 * weapon swing allows an immediate follow-up attack.
 */
export function tryGrantGraniteMaulCombo(
    player: PlayerState,
    weaponId: number,
    tick: number,
): boolean {
    if (!isGraniteMaulWeapon(weaponId)) return false;
    if (!player.specEnergy.isActivated()) return false;
    if (!canGraniteMaulCombo(weaponId, player.combat.lastAttackSwingTick, tick)) {
        return false;
    }
    player.combat.allowImmediateAttack(tick);
    return true;
}
