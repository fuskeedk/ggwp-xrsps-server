/**
 * Modern crystal weapon charge tracking (post-Song of the Elves).
 *
 * Historical crystal bow uses item-ID degradation in DegradationSystem.
 * Modern crystal bow / Bow of faerdhinen use a charge pool (up to 20,000)
 * stored in player equipment charges and deplete to an inactive item.
 */
import { EquipmentSlot } from "../../../../src/rs/config/player/Equipment";
import type { PlayerState } from "../player";

export const MAX_CRYSTAL_WEAPON_CHARGES = 20_000;

/** Client varbit for modern crystal bow charges. */
export const CRYSTAL_BOW_CHARGE_VARBIT = 16_172;
/** Client varbit for Bow of faerdhinen charges. */
export const BOW_OF_FAERDHINEN_CHARGE_VARBIT = 16_130;

export const MODERN_CRYSTAL_BOW_CHARGED_IDS = [
    23_901, // Crystal bow (basic) — Gauntlet
    23_902, // Crystal bow (attuned)
    23_903, // Crystal bow (perfected)
    23_983, // Crystal bow
    24_123, // Crystal bow
] as const;

export const MODERN_CRYSTAL_BOW_INACTIVE_ID = 23_985;

export const BOW_OF_FAERDHINEN_CHARGED_IDS = [
    25_865, // Bow of faerdhinen
    25_867, // Bow of faerdhinen (c)
    25_884, // Bow of faerdhinen (c) colour variants
    25_886,
    25_888,
    25_890,
    25_892,
    25_894,
    25_896,
] as const;

export const BOW_OF_FAERDHINEN_INACTIVE_ID = 25_862;

export interface ModernChargeWeaponConfig {
    chargedItemIds: readonly number[];
    inactiveItemId: number;
    maxCharges: number;
    chargeVarbit: number;
    depletedMessage: string;
}

const MODERN_CRYSTAL_BOW_CONFIG: ModernChargeWeaponConfig = {
    chargedItemIds: MODERN_CRYSTAL_BOW_CHARGED_IDS,
    inactiveItemId: MODERN_CRYSTAL_BOW_INACTIVE_ID,
    maxCharges: MAX_CRYSTAL_WEAPON_CHARGES,
    chargeVarbit: CRYSTAL_BOW_CHARGE_VARBIT,
    depletedMessage: "Your crystal bow has run out of charges.",
};

const BOW_OF_FAERDHINEN_CONFIG: ModernChargeWeaponConfig = {
    chargedItemIds: BOW_OF_FAERDHINEN_CHARGED_IDS,
    inactiveItemId: BOW_OF_FAERDHINEN_INACTIVE_ID,
    maxCharges: MAX_CRYSTAL_WEAPON_CHARGES,
    chargeVarbit: BOW_OF_FAERDHINEN_CHARGE_VARBIT,
    depletedMessage: "Your bow of faerdhinen has run out of charges.",
};

const CHARGED_ITEM_LOOKUP = new Map<number, ModernChargeWeaponConfig>();

for (const itemId of MODERN_CRYSTAL_BOW_CHARGED_IDS) {
    CHARGED_ITEM_LOOKUP.set(itemId, MODERN_CRYSTAL_BOW_CONFIG);
}
for (const itemId of BOW_OF_FAERDHINEN_CHARGED_IDS) {
    CHARGED_ITEM_LOOKUP.set(itemId, BOW_OF_FAERDHINEN_CONFIG);
}

export const ALL_MODERN_CHARGE_WEAPON_IDS = new Set(CHARGED_ITEM_LOOKUP.keys());

export function isModernChargeWeapon(itemId: number): boolean {
    return CHARGED_ITEM_LOOKUP.has(itemId);
}

export function getModernChargeWeaponConfig(itemId: number): ModernChargeWeaponConfig | undefined {
    return CHARGED_ITEM_LOOKUP.get(itemId);
}

function resolveCharges(player: PlayerState, weaponId: number, config: ModernChargeWeaponConfig): number {
    const stored = player.equipment.getChargesOrUndefined(weaponId);
    if (stored !== undefined) {
        return stored;
    }
    return config.maxCharges;
}

export function consumeModernChargeWeaponShot(
    player: PlayerState,
    weaponId: number,
    hitCount: number,
): {
    ok: boolean;
    newWeaponId: number;
    depleted: boolean;
    chatMessage?: string;
    chargeVarbit?: number;
    remainingCharges?: number;
} {
    const config = CHARGED_ITEM_LOOKUP.get(weaponId);
    if (!config) {
        return { ok: false, newWeaponId: weaponId, depleted: false };
    }

    const shots = Math.max(1, hitCount);
    let charges = resolveCharges(player, weaponId, config);
    charges = Math.max(0, charges - shots);

    if (charges <= 0) {
        player.equipment.setCharges(weaponId, 0);
        player.combat.degradationLastItemId.delete(EquipmentSlot.WEAPON);
        return {
            ok: true,
            newWeaponId: config.inactiveItemId,
            depleted: true,
            chatMessage: config.depletedMessage,
            chargeVarbit: config.chargeVarbit,
            remainingCharges: 0,
        };
    }

    player.equipment.setCharges(weaponId, charges);
    player.combat.degradationLastItemId.set(EquipmentSlot.WEAPON, weaponId);
    return {
        ok: true,
        newWeaponId: weaponId,
        depleted: false,
        chargeVarbit: config.chargeVarbit,
        remainingCharges: charges,
    };
}
