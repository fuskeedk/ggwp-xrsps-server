import { getItemDefinition } from "../server/src/data/items";
import type { InventoryEntry, PlayerState } from "../server/src/game/player";
import { TradeManager } from "../server/src/game/trade/TradeManager";
import {
    TradeAction,
    type TradeActionClientPayload,
    type TradeServerPayload,
} from "../server/src/network/messages";
import type { ServerServices } from "../server/src/game/ServerServices";

export const COINS_ID = 995;
export const WHIP_ID = 4151;
export const UNTRADEABLE_ID = 1;

export type TradeTestPlayer = PlayerState & {
    inventory: InventoryEntry[];
    gameMessages: string[];
    widgetsOpen: Set<number>;
};

export type TradeHarness = {
    manager: TradeManager;
    players: Map<number, TradeTestPlayer>;
    tradeMessages: Map<number, TradeServerPayload[]>;
    widgetEvents: Array<{ playerId: number; action: string; hidden?: boolean }>;
    inventorySnapshots: number[];
    setFailAddForPlayerId: (playerId: number | null) => void;
    getPlayer: (id: number) => TradeTestPlayer;
    offer: (playerId: number, slot: number, itemId: number, quantity: number) => void;
    remove: (playerId: number, slot: number, quantity: number) => void;
    accept: (playerId: number) => void;
    confirm: (playerId: number) => void;
    decline: (playerId: number) => void;
    acceptRequest: (responderId: number, fromId: number) => void;
    declineRequest: (responderId: number, fromId: number) => void;
    requestTrade: (fromId: number, toId: number, tick?: number) => void;
    lastTradeMessage: (playerId: number) => TradeServerPayload | undefined;
    countItem: (playerId: number, itemId: number) => number;
    setSlot: (playerId: number, slot: number, itemId: number, quantity: number) => void;
};

function createEmptyInventory(): InventoryEntry[] {
    return Array.from({ length: 28 }, () => ({ itemId: -1, quantity: 0 }));
}

function createTradePlayer(id: number, name: string): TradeTestPlayer {
    const widgetsOpen = new Set<number>();
    const player = {
        id,
        name,
        tileX: 3200,
        tileY: 3200,
        level: 0,
        worldViewId: 0,
        inventory: createEmptyInventory(),
        gameMessages: [] as string[],
        widgetsOpen,
        widgets: {
            isOpen: (groupId: number) => widgetsOpen.has(groupId | 0),
            close: (groupId: number) => {
                widgetsOpen.delete(groupId | 0);
            },
        },
        setInventorySlot(slot: number, itemId: number, quantity: number) {
            const inv = this.inventory;
            if (slot < 0 || slot >= inv.length) return;
            inv[slot] = {
                itemId: quantity > 0 ? itemId : -1,
                quantity: quantity > 0 ? quantity : 0,
            };
        },
        getInventoryEntries() {
            return this.inventory;
        },
    };
    return player as TradeTestPlayer;
}

function addItemToInventory(
    player: TradeTestPlayer,
    itemId: number,
    quantity: number,
    failForPlayerId: number | null,
): { added: number; slot: number } {
    if (player.id === failForPlayerId) {
        return { added: 0, slot: -1 };
    }
    const def = getItemDefinition(itemId);
    const stackable = !!def?.stackable;
    let remaining = Math.max(0, Math.floor(quantity));
    if (remaining <= 0) {
        return { added: 0, slot: -1 };
    }

    if (stackable) {
        for (const entry of player.inventory) {
            if (entry.itemId === itemId && entry.quantity > 0) {
                entry.quantity += remaining;
                return { added: remaining, slot: player.inventory.indexOf(entry) };
            }
        }
    }

    let added = 0;
    let firstSlot = -1;
    while (remaining > 0) {
        const freeSlot = player.inventory.findIndex((entry) => entry.itemId <= 0 || entry.quantity <= 0);
        if (freeSlot < 0) break;
        const amount = stackable ? remaining : 1;
        player.inventory[freeSlot] = { itemId, quantity: amount };
        if (firstSlot < 0) firstSlot = freeSlot;
        added += amount;
        remaining -= amount;
    }
    return { added, slot: firstSlot };
}

function removeItemQuantity(
    player: TradeTestPlayer,
    itemId: number,
    quantity: number,
    preferredSlot?: number,
): boolean {
    let remaining = Math.max(1, Math.floor(quantity));
    const takeFromSlot = (slot: number): void => {
        if (remaining <= 0 || slot < 0 || slot >= player.inventory.length) return;
        const entry = player.inventory[slot];
        if (!entry || entry.itemId !== itemId || entry.quantity <= 0) return;
        const take = Math.min(remaining, entry.quantity);
        const nextQty = entry.quantity - take;
        player.inventory[slot] =
            nextQty > 0 ? { itemId, quantity: nextQty } : { itemId: -1, quantity: 0 };
        remaining -= take;
    };

    if (typeof preferredSlot === "number") {
        takeFromSlot(preferredSlot | 0);
    }
    for (let i = 0; i < player.inventory.length && remaining > 0; i++) {
        if (typeof preferredSlot === "number" && i === (preferredSlot | 0)) continue;
        takeFromSlot(i);
    }
    return remaining <= 0;
}

function countInventoryItem(player: TradeTestPlayer, itemId: number): number {
    let total = 0;
    for (const entry of player.inventory) {
        if (entry.itemId === itemId && entry.quantity > 0) {
            total += entry.quantity;
        }
    }
    return total;
}

export function createTradeHarness(): TradeHarness {
    const players = new Map<number, TradeTestPlayer>();
    const tradeMessages = new Map<number, TradeServerPayload[]>();
    const widgetEvents: Array<{ playerId: number; action: string; hidden?: boolean }> = [];
    const inventorySnapshots: number[] = [];
    let failAddForPlayerId: number | null = null;

    const inventoryService = {
        getInventory: (player: TradeTestPlayer) => player.inventory,
        setInventorySlot: (player: TradeTestPlayer, slot: number, itemId: number, quantity: number) => {
            player.setInventorySlot(slot, itemId, quantity);
        },
        addItemToInventory: (player: TradeTestPlayer, itemId: number, quantity: number) =>
            addItemToInventory(player, itemId, quantity, failAddForPlayerId),
        countInventoryItem: (player: TradeTestPlayer, itemId: number) =>
            countInventoryItem(player, itemId),
        sendInventorySnapshot: (_sock: unknown, player: TradeTestPlayer) => {
            inventorySnapshots.push(player.id);
        },
    };

    const svc = {
        inventoryService,
        messagingService: {
            sendGameMessageToPlayer: (player: TradeTestPlayer, message: string) => {
                player.gameMessages.push(message);
            },
            queueChatMessage: () => {},
        },
        broadcastService: {
            queueTradeMessage: (playerId: number, payload: TradeServerPayload) => {
                if (!tradeMessages.has(playerId)) {
                    tradeMessages.set(playerId, []);
                }
                tradeMessages.get(playerId)!.push(payload);
            },
        },
        interfaceService: {
            onInterfaceClose: () => {},
            openModal: (player: TradeTestPlayer, groupId: number) => {
                player.widgetsOpen.add(groupId | 0);
            },
            closeModal: (player: TradeTestPlayer) => {
                player.widgetsOpen.delete(335);
                player.widgetsOpen.delete(334);
            },
            restoreNormalInventory: () => {},
        },
        players: {
            getById: (id: number) => players.get(id | 0),
            getSocketByPlayerId: () => undefined,
        },
        ticker: {
            currentTick: () => 0,
        },
        groundItems: {
            spawn: () => false,
        },
        queueWidgetEvent: (
            playerId: number,
            event: { action: string; hidden?: boolean },
        ) => {
            widgetEvents.push({ playerId, action: event.action, hidden: event.hidden });
        },
    } as unknown as ServerServices;

    const manager = new TradeManager(svc);

    const runAction = (playerId: number, payload: TradeActionClientPayload, tick = 0): void => {
        const player = players.get(playerId | 0);
        if (!player) throw new Error(`missing player ${playerId}`);
        manager.handleAction(player, payload, tick);
    };

    const getPlayer = (id: number): TradeTestPlayer => {
        let player = players.get(id | 0);
        if (!player) {
            player = createTradePlayer(id, `Player ${id}`);
            players.set(id, player);
        }
        return player;
    };

    return {
        manager,
        players,
        tradeMessages,
        widgetEvents,
        inventorySnapshots,
        setFailAddForPlayerId: (playerId: number | null) => {
            failAddForPlayerId = playerId;
        },
        getPlayer,
        offer: (playerId, slot, itemId, quantity) => {
            runAction(playerId, {
                action: TradeAction.Offer,
                slot,
                quantity,
                itemId,
            });
        },
        remove: (playerId, slot, quantity) => {
            runAction(playerId, { action: TradeAction.Remove, slot, quantity });
        },
        accept: (playerId) => {
            runAction(playerId, { action: TradeAction.Accept });
        },
        confirm: (playerId) => {
            runAction(playerId, { action: TradeAction.ConfirmAccept });
        },
        decline: (playerId) => {
            runAction(playerId, { action: TradeAction.Decline });
        },
        acceptRequest: (responderId, fromId) => {
            runAction(responderId, {
                action: TradeAction.AcceptRequest,
                fromPlayerId: fromId,
            });
        },
        declineRequest: (responderId, fromId) => {
            runAction(responderId, {
                action: TradeAction.DeclineRequest,
                fromPlayerId: fromId,
            });
        },
        requestTrade: (fromId, toId, tick = 0) => {
            manager.requestTrade(getPlayer(fromId), getPlayer(toId), tick);
        },
        lastTradeMessage: (playerId) => {
            const messages = tradeMessages.get(playerId | 0);
            return messages?.[messages.length - 1];
        },
        countItem: (playerId, itemId) => countInventoryItem(getPlayer(playerId), itemId),
        setSlot: (playerId, slot, itemId, quantity) => {
            getPlayer(playerId).setInventorySlot(slot, itemId, quantity);
        },
    };
}

export function fillInventoryWithUntradeable(player: TradeTestPlayer, itemId = UNTRADEABLE_ID): void {
    for (let slot = 0; slot < player.inventory.length; slot++) {
        player.setInventorySlot(slot, itemId, 1);
    }
}

export function removeItemQuantityForTest(
    player: TradeTestPlayer,
    itemId: number,
    quantity: number,
    preferredSlot?: number,
): boolean {
    return removeItemQuantity(player, itemId, quantity, preferredSlot);
}
