/**
 * Barrows equipment degradation during combat.
 *
 * OSRS parity model:
 * - Weapons degrade when dealing damage in combat
 * - Armour degrades when receiving damage in combat
 * - Each piece degrades independently over ~15 hours of combat (90,000 ticks)
 */
import { EquipmentSlot } from "../../../../src/rs/config/player/Equipment";
import { ensureEquipArrayOn } from "../equipment";
import type { PlayerState } from "../player";
import {
    BARROWS_ARMOR_SLOTS,
    BARROWS_TICKS_PER_HIT,
    BARROWS_TICKS_PER_LEVEL,
    BARROWS_WEAPON_SLOT,
    getBarrowsPieceChain,
    getNextBarrowsItemId,
    isBarrowsItem,
} from "./BarrowsEquipment";

export interface BarrowsDegradeChange {
    slot: EquipmentSlot;
    oldItemId: number;
    newItemId: number;
}

function getBarrowsCombatTicks(player: PlayerState, slot: number, itemId: number): number {
    const key = slot * 1_000_000 + itemId;
    return player.combat.barrowsCombatTicks.get(key) ?? 0;
}

function setBarrowsCombatTicks(
    player: PlayerState,
    slot: number,
    itemId: number,
    ticks: number,
): void {
    const key = slot * 1_000_000 + itemId;
    if (ticks <= 0) {
        player.combat.barrowsCombatTicks.delete(key);
    } else {
        player.combat.barrowsCombatTicks.set(key, ticks);
    }
}

function clearBarrowsTicksForSlot(player: PlayerState, slot: number): void {
    const prefix = slot * 1_000_000;
    const suffix = prefix + 1_000_000;
    for (const key of [...player.combat.barrowsCombatTicks.keys()]) {
        if (key >= prefix && key < suffix) {
            player.combat.barrowsCombatTicks.delete(key);
        }
    }
}

function processSlotExposure(
    player: PlayerState,
    slot: EquipmentSlot,
    itemId: number,
    exposureTicks: number,
): BarrowsDegradeChange | undefined {
    if (!(itemId > 0) || !isBarrowsItem(itemId)) {
        return undefined;
    }

    const chain = getBarrowsPieceChain(itemId);
    if (!chain) return undefined;

    const level = chain.itemIds.indexOf(itemId);
    if (level < 0 || level >= chain.itemIds.length - 1) {
        return undefined;
    }

    const nextTicks = getBarrowsCombatTicks(player, slot, itemId) + exposureTicks;
    if (nextTicks < BARROWS_TICKS_PER_LEVEL) {
        setBarrowsCombatTicks(player, slot, itemId, nextTicks);
        return undefined;
    }

    const nextItemId = getNextBarrowsItemId(itemId);
    if (!nextItemId) {
        setBarrowsCombatTicks(player, slot, itemId, 0);
        return undefined;
    }

    clearBarrowsTicksForSlot(player, slot);
    const equip = ensureEquipArrayOn(player.appearance);
    equip[slot] = nextItemId;
    player.markEquipmentDirty();
    player.markAppearanceDirty();

    return { slot, oldItemId: itemId, newItemId: nextItemId };
}

/**
 * Degrade barrows weapon after dealing damage in combat.
 */
export function processBarrowsWeaponExposure(
    player: PlayerState,
    exposureTicks: number = BARROWS_TICKS_PER_HIT,
): BarrowsDegradeChange | undefined {
    const equip = player.appearance?.equip;
    if (!equip) return undefined;
    const weaponId = equip[BARROWS_WEAPON_SLOT];
    return processSlotExposure(player, BARROWS_WEAPON_SLOT, weaponId, exposureTicks);
}

/**
 * Degrade worn barrows armour after receiving damage in combat.
 */
export function processBarrowsArmorExposure(
    player: PlayerState,
    exposureTicks: number = BARROWS_TICKS_PER_HIT,
): BarrowsDegradeChange[] {
    const equip = player.appearance?.equip;
    if (!equip) return [];

    const changes: BarrowsDegradeChange[] = [];
    for (const slot of BARROWS_ARMOR_SLOTS) {
        const itemId = equip[slot];
        const change = processSlotExposure(player, slot, itemId, exposureTicks);
        if (change) {
            changes.push(change);
        }
    }
    return changes;
}
