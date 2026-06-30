import { EquipmentSlot } from "../../../../src/rs/config/player/Equipment";
import { consumeEquippedAmmoApply, ensureEquipArrayOn, ensureEquipQtyArrayOn } from "../equipment";
import type { PlayerAppearance, PlayerState } from "../player";
import { getChargesUsed, setChargesUsed } from "./DegradationSystem";

export const TOXIC_BLOWPIPE = 12926;
export const TOXIC_BLOWPIPE_EMPTY = 12924;
const BLOWPIPE_WEAPONS = new Set([TOXIC_BLOWPIPE, TOXIC_BLOWPIPE_EMPTY]);
const SCALES_PER_DART = 3;

export function isBlowpipeWeapon(weaponId: number): boolean {
    return BLOWPIPE_WEAPONS.has(weaponId);
}

export function getBlowpipeScaleCharges(player: PlayerState, weaponId: number): number {
    return Math.max(0, player.equipment.getCharges(weaponId));
}

export function setBlowpipeScaleCharges(player: PlayerState, weaponId: number, charges: number): void {
    player.equipment.setCharges(weaponId, Math.max(0, charges));
}

/**
 * Consume one blowpipe shot: 1 dart from the ammo slot and 1 scale per 3 darts.
 * Uses the weapon-slot degradation tracker to count partial scale consumption.
 */
export function consumeBlowpipeShot(
    player: PlayerState,
    appearance: PlayerAppearance,
    hitCount: number = 1,
): { ok: boolean; reason?: string; chatMessage?: string } {
    const equip = ensureEquipArrayOn(appearance);
    const weaponId = equip[EquipmentSlot.WEAPON];
    if (!isBlowpipeWeapon(weaponId)) {
        return { ok: false, reason: "not_blowpipe" };
    }
    if (weaponId === TOXIC_BLOWPIPE_EMPTY) {
        return {
            ok: false,
            reason: "blowpipe_empty",
            chatMessage: "Your blowpipe is not loaded.",
        };
    }

    const shots = Math.max(1, hitCount);
    const dartResult = consumeEquippedAmmoApply({
        appearance,
        count: shots,
    });
    if (!dartResult.ok) {
        return {
            ok: false,
            reason: dartResult.reason ?? "ammo_missing",
            chatMessage: "There is no ammo left in your quiver.",
        };
    }

    let scaleCycle = getChargesUsed(player.combat.degradationCharges, EquipmentSlot.WEAPON);
    let scalesRemaining = getBlowpipeScaleCharges(player, weaponId);

    for (let i = 0; i < shots; i++) {
        scaleCycle += 1;
        if (scaleCycle >= SCALES_PER_DART) {
            if (scalesRemaining <= 0) {
                return {
                    ok: false,
                    reason: "no_scales",
                    chatMessage: "Your blowpipe has run out of scales.",
                };
            }
            scalesRemaining -= 1;
            scaleCycle = 0;
        }
    }

    setChargesUsed(player.combat.degradationCharges, EquipmentSlot.WEAPON, scaleCycle);
    setBlowpipeScaleCharges(player, weaponId, scalesRemaining);
    player.combat.degradationLastItemId.set(EquipmentSlot.WEAPON, weaponId);

    const equipQty = ensureEquipQtyArrayOn(appearance);
    const dartQty = Math.max(0, equipQty[EquipmentSlot.AMMO] ?? 0);
    const dartId = equip[EquipmentSlot.AMMO];
    if (!(dartId > 0) || dartQty <= 0) {
        equip[EquipmentSlot.WEAPON] = TOXIC_BLOWPIPE_EMPTY;
    }

    return { ok: true };
}
