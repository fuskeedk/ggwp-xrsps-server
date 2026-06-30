/**
 * Powered staff charge tracking (Trident, Sanguinesti, Tumeken's Shadow, etc.).
 *
 * Charges are stored per item ID in player equipment charges and deplete to an
 * uncharged variant when empty. One charge is consumed per attack (hit or splash).
 */
import { EquipmentSlot } from "../../../../src/rs/config/player/Equipment";
import type { PlayerState } from "../player";

export const TRIDENT_MAX_CHARGES = 2_500;
export const SANGUINESTI_MAX_CHARGES = 20_000;
export const TUMEKEN_MAX_CHARGES = 16_000;

export interface PoweredStaffChargeConfig {
    chargedItemIds: readonly number[];
    /** Item IDs that start at max charges when no stored value exists (e.g. trident full). */
    fullItemIds: readonly number[];
    unchargedItemId: number;
    maxCharges: number;
    depletedMessage: string;
    unchargedAttackMessage: string;
}

const TRIDENT_SEAS_CONFIG: PoweredStaffChargeConfig = {
    chargedItemIds: [11_905, 11_907, 22_288],
    fullItemIds: [11_905],
    unchargedItemId: 11_908,
    maxCharges: TRIDENT_MAX_CHARGES,
    depletedMessage: "Your trident has run out of charges.",
    unchargedAttackMessage: "Your trident isn't charged.",
};

const TRIDENT_SWAMP_CONFIG: PoweredStaffChargeConfig = {
    chargedItemIds: [12_899, 22_292, 21_276],
    fullItemIds: [],
    unchargedItemId: 12_900,
    maxCharges: TRIDENT_MAX_CHARGES,
    depletedMessage: "Your toxic trident has run out of charges.",
    unchargedAttackMessage: "Your toxic trident isn't charged.",
};

const SANGUINESTI_CONFIG: PoweredStaffChargeConfig = {
    chargedItemIds: [22_323, 22_294, 24_144, 25_739],
    fullItemIds: [],
    unchargedItemId: 22_481,
    maxCharges: SANGUINESTI_MAX_CHARGES,
    depletedMessage: "Your Sanguinesti staff has run out of charges.",
    unchargedAttackMessage: "Your Sanguinesti staff isn't charged.",
};

const TUMEKEN_CONFIG: PoweredStaffChargeConfig = {
    chargedItemIds: [27_275],
    fullItemIds: [],
    unchargedItemId: 27_277,
    maxCharges: TUMEKEN_MAX_CHARGES,
    depletedMessage: "Your Tumeken's shadow has run out of charges.",
    unchargedAttackMessage: "Your Tumeken's shadow isn't charged.",
};

const THAMMARON_CONFIG: PoweredStaffChargeConfig = {
    chargedItemIds: [22_552, 27_676],
    fullItemIds: [],
    unchargedItemId: 27_785,
    maxCharges: TRIDENT_MAX_CHARGES,
    depletedMessage: "Your Thammaron's sceptre has run out of charges.",
    unchargedAttackMessage: "Your Thammaron's sceptre isn't charged.",
};

const ACCURSED_CONFIG: PoweredStaffChargeConfig = {
    chargedItemIds: [27_679],
    fullItemIds: [],
    unchargedItemId: 27_788,
    maxCharges: TRIDENT_MAX_CHARGES,
    depletedMessage: "Your accursed sceptre has run out of charges.",
    unchargedAttackMessage: "Your accursed sceptre isn't charged.",
};

const CHARGED_ITEM_LOOKUP = new Map<number, PoweredStaffChargeConfig>();
const UNCHARGED_ITEM_IDS = new Set<number>();

for (const config of [
    TRIDENT_SEAS_CONFIG,
    TRIDENT_SWAMP_CONFIG,
    SANGUINESTI_CONFIG,
    TUMEKEN_CONFIG,
    THAMMARON_CONFIG,
    ACCURSED_CONFIG,
]) {
    for (const itemId of config.chargedItemIds) {
        CHARGED_ITEM_LOOKUP.set(itemId, config);
    }
    UNCHARGED_ITEM_IDS.add(config.unchargedItemId);
}

export const ALL_CHARGEABLE_POWERED_STAFF_IDS = new Set(CHARGED_ITEM_LOOKUP.keys());

export function isChargeablePoweredStaff(itemId: number): boolean {
    return CHARGED_ITEM_LOOKUP.has(itemId);
}

export function isUnchargedPoweredStaff(itemId: number): boolean {
    return UNCHARGED_ITEM_IDS.has(itemId);
}

export function getPoweredStaffChargeConfig(itemId: number): PoweredStaffChargeConfig | undefined {
    return CHARGED_ITEM_LOOKUP.get(itemId);
}

function resolveCharges(
    player: PlayerState,
    weaponId: number,
    config: PoweredStaffChargeConfig,
): number {
    const stored = player.equipment.getChargesOrUndefined(weaponId);
    if (stored !== undefined) {
        return stored;
    }
    if (config.fullItemIds.includes(weaponId)) {
        return config.maxCharges;
    }
    return config.maxCharges;
}

export function canFirePoweredStaff(
    player: PlayerState,
    weaponId: number,
): { ok: boolean; chatMessage?: string } {
    if (isUnchargedPoweredStaff(weaponId)) {
        for (const config of [
            TRIDENT_SEAS_CONFIG,
            TRIDENT_SWAMP_CONFIG,
            SANGUINESTI_CONFIG,
            TUMEKEN_CONFIG,
            THAMMARON_CONFIG,
            ACCURSED_CONFIG,
        ]) {
            if (config.unchargedItemId === weaponId) {
                return { ok: false, chatMessage: config.unchargedAttackMessage };
            }
        }
        return { ok: false, chatMessage: "Your weapon isn't charged." };
    }

    const config = CHARGED_ITEM_LOOKUP.get(weaponId);
    if (!config) {
        return { ok: true };
    }

    const charges = resolveCharges(player, weaponId, config);
    if (charges <= 0) {
        return { ok: false, chatMessage: config.unchargedAttackMessage };
    }
    return { ok: true };
}

export function consumePoweredStaffCharge(
    player: PlayerState,
    weaponId: number,
    hitCount: number,
): {
    ok: boolean;
    newWeaponId: number;
    depleted: boolean;
    chatMessage?: string;
    remainingCharges?: number;
} {
    const config = CHARGED_ITEM_LOOKUP.get(weaponId);
    if (!config) {
        return { ok: true, newWeaponId: weaponId, depleted: false };
    }

    const shots = Math.max(1, hitCount);
    let charges = resolveCharges(player, weaponId, config);
    charges = Math.max(0, charges - shots);

    if (charges <= 0) {
        player.equipment.setCharges(weaponId, 0);
        player.combat.degradationLastItemId.delete(EquipmentSlot.WEAPON);
        return {
            ok: true,
            newWeaponId: config.unchargedItemId,
            depleted: true,
            chatMessage: config.depletedMessage,
            remainingCharges: 0,
        };
    }

    player.equipment.setCharges(weaponId, charges);
    player.combat.degradationLastItemId.set(EquipmentSlot.WEAPON, weaponId);
    return {
        ok: true,
        newWeaponId: weaponId,
        depleted: false,
        remainingCharges: charges,
    };
}
