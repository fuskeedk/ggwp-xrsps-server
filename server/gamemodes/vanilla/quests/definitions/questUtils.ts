import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { countCarriedItem } from "../QuestService";

export function hasItem(
    player: Parameters<typeof countCarriedItem>[0],
    services: ScriptServices,
    itemId: number,
    quantity = 1,
): boolean {
    return countCarriedItem(player, services, itemId) >= quantity;
}

export function addItemIfMissing(
    player: Parameters<typeof countCarriedItem>[0],
    services: ScriptServices,
    itemId: number,
    quantity = 1,
): void {
    if (countCarriedItem(player, services, itemId) >= quantity) return;
    const added = services.inventory.addItemToInventory(player, itemId, quantity);
    if (added.added > 0) services.inventory.snapshotInventory(player);
}

export function isVarpAtLeast(player: Parameters<typeof countCarriedItem>[0], varpId: number, value: number): boolean {
    return player.varps.getVarpValue(varpId) >= value;
}
