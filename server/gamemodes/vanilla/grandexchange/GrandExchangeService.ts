import type { GamemodeServerServices } from "../../../src/game/gamemodes/GamemodeDefinition";
import type { PlayerState } from "../../../src/game/player";
import { getItemDefinition } from "../../../src/game/scripts/serviceInterfaces";
import { encodeMessage } from "../../../src/network/messages";
import { TaskConditions } from "../../../src/game/model/queue";
import type { ScriptServices } from "../../../src/game/scripts/types";
import {
    COINS_ITEM_ID,
    GE_BUTTON_FLAGS,
    GE_COLLECT_ALL_COMPONENT,
    GE_COLLECT_INTERFACE_ID,
    GE_OFFERS_INTERFACE_ID,
    GE_OFFERS_SIDE_INTERFACE_ID,
    GE_SLOT_COMPONENTS,
    GE_SLOT_COUNT,
    SCRIPT_GE_COLLECT_INIT,
    SCRIPT_GE_OFFERS_INIT,
    geWidgetUid,
} from "./geConstants";
import {
    GeOffer,
    GeOfferType,
    GrandExchangeManager,
    getOfferRemaining,
    isOfferComplete,
} from "./GrandExchangeManager";
import { GrandExchangeMatcher } from "./GrandExchangeMatcher";
import { GrandExchangeStore } from "./GrandExchangeStore";
import type { InterfaceService } from "../../../src/widgets/InterfaceService";

export interface GrandExchangeServiceOptions {
    serverServices: GamemodeServerServices;
    getScriptServices: () => ScriptServices | undefined;
}

const CHATBOX_OPEN_INPUT_SCRIPT = 2251;

export type GeOfferSlotMessage = {
    slot: number;
    type: 0 | 1 | 2;
    itemId: number;
    quantity: number;
    quantityTraded: number;
    priceEach: number;
};

export type GeOffersServerPayload = {
    slots: GeOfferSlotMessage[];
};

function countCoins(player: PlayerState): number {
    let total = 0;
    for (const entry of player.items.getInventoryEntries()) {
        if (entry?.itemId === COINS_ITEM_ID) {
            total += entry.quantity;
        }
    }
    return total;
}

function removeCoins(player: PlayerState, amount: number): boolean {
    let remaining = amount;
    for (let slot = 0; slot < player.items.getInventoryEntries().length; slot++) {
        const entry = player.items.getInventoryEntries()[slot];
        if (!entry || entry.itemId !== COINS_ITEM_ID || entry.quantity <= 0) continue;
        const take = Math.min(entry.quantity, remaining);
        const nextQty = entry.quantity - take;
        if (nextQty > 0) {
            player.items.setInventorySlot(slot, COINS_ITEM_ID, nextQty);
        } else {
            player.items.setInventorySlot(slot, -1, 0);
        }
        remaining -= take;
        if (remaining <= 0) return true;
    }
    return remaining <= 0;
}

function countItem(player: PlayerState, itemId: number): number {
    let total = 0;
    for (const entry of player.items.getInventoryEntries()) {
        if (entry?.itemId === itemId) {
            total += entry.quantity;
        }
    }
    return total;
}

function removeItem(player: PlayerState, itemId: number, amount: number): number {
    let remaining = amount;
    let removed = 0;
    for (let slot = 0; slot < player.items.getInventoryEntries().length; slot++) {
        const entry = player.items.getInventoryEntries()[slot];
        if (!entry || entry.itemId !== itemId || entry.quantity <= 0) continue;
        const take = Math.min(entry.quantity, remaining);
        const nextQty = entry.quantity - take;
        if (nextQty > 0) {
            player.items.setInventorySlot(slot, itemId, nextQty);
        } else {
            player.items.setInventorySlot(slot, -1, 0);
        }
        remaining -= take;
        removed += take;
        if (remaining <= 0) break;
    }
    return removed;
}

function addItem(player: PlayerState, services: GamemodeServerServices, itemId: number, amount: number): number {
    if (amount <= 0) return 0;
    return services.addItemToInventory(player, itemId, amount);
}

function guidePrice(itemId: number): number {
    const def = getItemDefinition(itemId);
    if (!def) return 1;
    const value = Number(def.value ?? def.cost ?? 0);
    return Math.max(1, value | 0);
}

function isTradeableOnGe(itemId: number): boolean {
    const def = getItemDefinition(itemId);
    if (!def) return false;
    if (def.tradeable === false || def.sellable === false) return false;
    if (def.noted) return false;
    return itemId > 0;
}

export class GrandExchangeService {
    readonly manager = new GrandExchangeManager();
    private readonly store: GrandExchangeStore;
    private readonly matcher: GrandExchangeMatcher;
    private readonly ss: GamemodeServerServices;
    private readonly getScriptServices: () => ScriptServices | undefined;

    constructor(opts: GrandExchangeServiceOptions) {
        this.ss = opts.serverServices;
        this.getScriptServices = opts.getScriptServices;
        this.store = new GrandExchangeStore(this.manager);
        this.matcher = new GrandExchangeMatcher(this.manager, () => this.store.save());
        this.store.load();

        this.ss.registerSnapshotEncoder("ge_offers", (_playerId, payload) => ({
            message: encodeMessage({ type: "ge_offers", payload }),
            context: "ge_offers",
        }));
    }

    private getInterfaceService(): InterfaceService | undefined {
        return this.ss.getInterfaceService();
    }

    private sendMessage(player: PlayerState, text: string): void {
        this.ss.queueChatMessage({
            messageType: "game",
            text,
            targetPlayerIds: [player.id],
        });
    }

    buildOffersPayload(player: PlayerState): GeOffersServerPayload {
        const slots: GeOfferSlotMessage[] = [];
        const playerSlots = this.manager.slotOffers(player.id);
        for (let slot = 0; slot < GE_SLOT_COUNT; slot++) {
            const offer = playerSlots[slot];
            if (!offer || isOfferComplete(offer)) {
                slots.push({
                    slot,
                    type: 0,
                    itemId: 0,
                    quantity: 0,
                    quantityTraded: 0,
                    priceEach: 0,
                });
                continue;
            }
            slots.push({
                slot,
                type: offer.type === GeOfferType.BUY ? 1 : 2,
                itemId: offer.itemId,
                quantity: offer.quantity,
                quantityTraded: offer.quantityTraded,
                priceEach: offer.priceEach,
            });
        }
        return { slots };
    }

    syncPlayerUi(player: PlayerState): void {
        this.ss.queueGamemodeSnapshot("ge_offers", player.id, this.buildOffersPayload(player));
        const interfaceService = this.getInterfaceService();
        if (interfaceService?.isModalOpen(player, GE_OFFERS_INTERFACE_ID)) {
            interfaceService.runScript(player, SCRIPT_GE_OFFERS_INIT, []);
        }
        this.ss.sendInventorySnapshot(player.id);
    }

    openExchange(player: PlayerState): void {
        const interfaceService = this.getInterfaceService();
        if (!interfaceService) return;

        interfaceService.openModal(player, GE_OFFERS_INTERFACE_ID, { ge: true });
        interfaceService.openSidemodal(player, { interfaceId: GE_OFFERS_SIDE_INTERFACE_ID });
        interfaceService.runScript(player, SCRIPT_GE_OFFERS_INIT, []);

        for (const component of GE_SLOT_COMPONENTS) {
            interfaceService.setWidgetFlags(player, geWidgetUid(component), 0, 0, GE_BUTTON_FLAGS);
        }
        interfaceService.setWidgetFlags(
            player,
            geWidgetUid(GE_COLLECT_ALL_COMPONENT),
            0,
            0,
            GE_BUTTON_FLAGS,
        );

        this.syncPlayerUi(player);
        this.sendMessage(player, "Select an empty slot to create a buy or sell offer.");
    }

    openCollectionBox(player: PlayerState): void {
        const interfaceService = this.getInterfaceService();
        if (!interfaceService) return;
        interfaceService.openModal(player, GE_COLLECT_INTERFACE_ID);
        interfaceService.runScript(player, SCRIPT_GE_COLLECT_INIT, []);
        this.collect(player);
    }

    collect(player: PlayerState): void {
        const collection = this.manager.collection(player.id);
        if (collection.coins <= 0 && collection.items.length === 0) {
            this.sendMessage(player, "You have nothing to collect.");
            return;
        }

        let collected = false;
        if (collection.coins > 0) {
            const coins = Math.min(collection.coins, Number.MAX_SAFE_INTEGER);
            const added = addItem(player, this.ss, COINS_ITEM_ID, coins);
            if (added > 0) {
                collection.coins -= added;
                collected = true;
            } else {
                this.sendMessage(player, "You don't have enough inventory space to collect your coins.");
            }
        }

        const remaining: Array<{ itemId: number; amount: number }> = [];
        for (const stack of collection.items) {
            const added = addItem(player, this.ss, stack.itemId, stack.amount);
            if (added > 0) {
                collected = true;
                const left = stack.amount - added;
                if (left > 0) remaining.push({ itemId: stack.itemId, amount: left });
            } else {
                remaining.push(stack);
            }
        }
        collection.items.length = 0;
        collection.items.push(...remaining);

        if (collected) {
            this.sendMessage(player, "Collected items from the Grand Exchange.");
        } else if (remaining.length > 0) {
            this.sendMessage(player, "You don't have enough inventory space to collect your items.");
        }

        this.store.save();
        this.ss.sendInventorySnapshot(player.id);
    }

    handleSlotSelected(player: PlayerState, slot: number): void {
        if (slot < 0 || slot >= GE_SLOT_COUNT) return;
        const existing = this.manager.offerInSlot(player.id, slot);
        if (existing && !isOfferComplete(existing)) {
            this.promptExistingOffer(player, existing);
            return;
        }
        this.promptCreateOffer(player, slot);
    }

    private promptExistingOffer(player: PlayerState, offer: GeOffer): void {
        const itemName = getItemDefinition(offer.itemId)?.name ?? `Item ${offer.itemId}`;
        const typeLabel = offer.type === GeOfferType.BUY ? "Buying" : "Selling";
        this.getScriptServices()?.dialog.openDialogOptions(player, {
            id: `ge_existing_${player.id}_${offer.slot}`,
            title: "Grand Exchange",
            options: ["Cancel offer.", "View offer.", "Go back."],
            onSelect: (choice) => {
                if (choice === 0) {
                    this.cancelOffer(player, offer);
                } else if (choice === 1) {
                    this.sendMessage(
                        player,
                        `${typeLabel} ${itemName}: ${offer.quantityTraded}/${offer.quantity} at ${offer.priceEach} gp each.`,
                    );
                }
            },
        });
    }

    private promptCreateOffer(player: PlayerState, slot: number): void {
        this.getScriptServices()?.dialog.openDialogOptions(player, {
            id: `ge_create_${player.id}_${slot}`,
            title: "Grand Exchange",
            options: ["Create a buy offer.", "Create a sell offer.", "Go back."],
            onSelect: (choice) => {
                if (choice === 0) {
                    this.beginBuyOffer(player, slot);
                } else if (choice === 1) {
                    this.beginSellOffer(player, slot);
                }
            },
        });
    }

    private beginBuyOffer(player: PlayerState, slot: number): void {
        this.getScriptServices()?.dialog.openDialogOptions(player, {
            id: `ge_buy_item_${player.id}_${slot}`,
            title: "Select an item to buy",
            options: this.buildBuyItemOptions(player, slot),
            onSelect: (choice) => {
                const itemId = this.buyItemOptionIds[player.id]?.[choice];
                if (!itemId) return;
                this.promptQuantity(player, slot, GeOfferType.BUY, itemId);
            },
        });
    }

    private buyItemOptionIds = new Map<number, number[]>();

    private buildBuyItemOptions(player: PlayerState, slot: number): string[] {
        const commonIds = [
            995, 590, 1511, 1513, 1515, 1517, 1519, 1521, 436, 438, 440, 453, 2357, 2351,
            318, 314, 313, 327, 379, 385, 2434, 2436, 2432, 2430, 11212, 11230, 11232,
        ];
        const options: string[] = [];
        const ids: number[] = [];
        for (const itemId of commonIds) {
            if (!isTradeableOnGe(itemId)) continue;
            const name = getItemDefinition(itemId)?.name;
            if (!name) continue;
            options.push(name);
            ids.push(itemId);
            if (options.length >= 8) break;
        }
        if (options.length === 0) {
            options.push("Coins");
            ids.push(COINS_ITEM_ID);
        }
        options.push("Go back.");
        this.buyItemOptionIds.set(player.id, ids);
        return options;
    }

    private beginSellOffer(player: PlayerState, slot: number): void {
        const options: string[] = [];
        const ids: number[] = [];
        for (const entry of player.items.getInventoryEntries()) {
            if (!entry || entry.itemId <= 0 || entry.quantity <= 0) continue;
            if (!isTradeableOnGe(entry.itemId)) continue;
            const name = getItemDefinition(entry.itemId)?.name ?? `Item ${entry.itemId}`;
            options.push(`${name} x${entry.quantity}`);
            ids.push(entry.itemId);
            if (options.length >= 8) break;
        }
        if (options.length === 0) {
            this.sendMessage(player, "You don't have anything tradeable to sell.");
            return;
        }
        options.push("Go back.");
        this.buyItemOptionIds.set(player.id, ids);
        this.getScriptServices()?.dialog.openDialogOptions(player, {
            id: `ge_sell_item_${player.id}_${slot}`,
            title: "Select an item to sell",
            options,
            onSelect: (choice) => {
                const itemId = ids[choice];
                if (!itemId) return;
                this.promptQuantity(player, slot, GeOfferType.SELL, itemId);
            },
        });
    }

    private promptQuantity(
        player: PlayerState,
        slot: number,
        type: GeOfferType,
        itemId: number,
    ): void {
        const maxQty =
            type === GeOfferType.SELL
                ? countItem(player, itemId)
                : Math.min(2_147_483_647, Math.floor(countCoins(player) / Math.max(1, guidePrice(itemId))));

        player.queueStandard(function* (task) {
            yield TaskConditions.wait(2);
            this.getScriptServices()?.dialog.queueWidgetEvent(player.id, {
                action: "run_script",
                scriptId: CHATBOX_OPEN_INPUT_SCRIPT,
                args: [],
            });
            yield TaskConditions.waitReturnValue(task);
            const raw = task.requestReturnValue;
            task.requestReturnValue = null;
            if (raw === null || raw === undefined) return;
            const quantity = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
            if (!Number.isFinite(quantity) || quantity <= 0) return;
            this.promptPrice(player, slot, type, itemId, Math.min(quantity | 0, maxQty));
        }.bind(this));
    }

    private promptPrice(
        player: PlayerState,
        slot: number,
        type: GeOfferType,
        itemId: number,
        quantity: number,
    ): void {
        const guide = guidePrice(itemId);
        this.sendMessage(
            player,
            `Set a price per item (guide: ${guide} gp) using the chatbox prompt.`,
        );

        player.queueStandard(function* (task) {
            yield TaskConditions.wait(2);
            this.getScriptServices()?.dialog.queueWidgetEvent(player.id, {
                action: "run_script",
                scriptId: CHATBOX_OPEN_INPUT_SCRIPT,
                args: [],
            });
            yield TaskConditions.waitReturnValue(task);
            const raw = task.requestReturnValue;
            task.requestReturnValue = null;
            if (raw === null || raw === undefined) return;
            const priceEach = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
            if (!Number.isFinite(priceEach) || priceEach <= 0) return;
            this.placeOffer(player, slot, type, itemId, quantity, priceEach | 0);
        }.bind(this));
    }

    placeOffer(
        player: PlayerState,
        slot: number,
        type: GeOfferType,
        itemId: number,
        quantity: number,
        priceEach: number,
    ): void {
        if (!isTradeableOnGe(itemId)) {
            this.sendMessage(player, "You can't trade that item on the Grand Exchange.");
            return;
        }

        const existing = this.manager.offerInSlot(player.id, slot);
        if (existing && !isOfferComplete(existing)) {
            this.sendMessage(player, "That slot is already in use.");
            return;
        }

        const totalCost = priceEach * quantity;
        if (type === GeOfferType.BUY) {
            if (totalCost > Number.MAX_SAFE_INTEGER) {
                this.sendMessage(player, "That offer costs too many coins.");
                return;
            }
            if (countCoins(player) < totalCost) {
                this.sendMessage(player, "You don't have enough coins.");
                return;
            }
            if (!removeCoins(player, totalCost)) {
                this.sendMessage(player, "You don't have enough coins.");
                return;
            }
        } else {
            const removed = removeItem(player, itemId, quantity);
            if (removed < quantity) {
                this.sendMessage(player, "You don't have enough of that item.");
                return;
            }
        }

        const offer: GeOffer = {
            id: this.manager.createOfferId(),
            ownerPlayerId: player.id,
            ownerName: player.name ?? "Player",
            slot,
            type,
            itemId,
            quantity,
            priceEach,
            quantityTraded: 0,
        };
        this.manager.registerOffer(offer);
        this.matcher.tryMatch(offer);
        this.store.save();
        this.sendMessage(player, "Grand Exchange offer created.");
        this.syncPlayerUi(player);
        this.ss.sendInventorySnapshot(player.id);
    }

    cancelOffer(player: PlayerState, offer: GeOffer): void {
        const untraded = getOfferRemaining(offer);
        if (untraded > 0) {
            if (offer.type === GeOfferType.BUY) {
                this.manager.addCoinsToCollection(player.id, offer.priceEach * untraded);
            } else {
                this.manager.addToCollection(player.id, offer.itemId, untraded);
            }
        }
        this.manager.removeOffer(offer);
        this.store.save();
        this.sendMessage(player, "Offer cancelled. Collect returned items from the collection box.");
        this.syncPlayerUi(player);
    }

    handleResumePauseButton(player: PlayerState, widgetId: number, childIndex: number): boolean {
        const groupId = widgetId >>> 16;
        if (groupId !== GE_OFFERS_INTERFACE_ID) return false;

        if (childIndex === GE_COLLECT_ALL_COMPONENT) {
            this.collect(player);
            return true;
        }

        const slot = GE_SLOT_COMPONENTS.indexOf(childIndex as (typeof GE_SLOT_COMPONENTS)[number]);
        if (slot >= 0) {
            this.handleSlotSelected(player, slot);
            return true;
        }
        return false;
    }
}
