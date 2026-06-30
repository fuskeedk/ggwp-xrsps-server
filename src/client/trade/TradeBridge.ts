import { Inventory } from "../../rs/inventory/Inventory";
import {
    getLatestTradeState,
    sendTradeAccept,
    sendTradeAcceptRequest,
    sendTradeConfirmAccept,
    sendTradeDecline,
    sendTradeDeclineRequest,
    sendTradeOffer,
    sendTradeRemove,
    subscribeTrade,
} from "../../network/ServerConnection";
import type { TradeOfferEntryMessage, TradeWindowState } from "../../network/ServerConnection";
import { markInvTransmit } from "../TransmitCycles";
import type { WidgetSessionManager } from "../../ui/widgets/WidgetSessionManager";

/** Trade main screen (first screen). */
export const TRADE_MAIN_INTERFACE = 335;
/** Trade confirm screen (second screen). */
export const TRADE_CONFIRM_INTERFACE = 334;
/** Trade inventory side panel. */
export const TRADE_SIDE_INTERFACE = 336;

/** CS2 inventory id for your trade offer. */
export const TRADE_SELF_INV_ID = 149;
/** CS2 inventory id for the other player's trade offer (INVOTHER uses +32768). */
export const TRADE_OTHER_INV_ID = 150;
export const TRADE_OTHER_INV_MAP_KEY = TRADE_OTHER_INV_ID + 32768;

const TRADEMAIN_ACCEPT_CHILDREN = new Set([10, 11, 12]);
const TRADEMAIN_DECLINE_CHILDREN = new Set([13, 14, 15]);
const TRADECONFIRM_ACCEPT_CHILDREN = new Set([13]);
const TRADECONFIRM_DECLINE_CHILDREN = new Set([14]);

const TRADE_OFFER_INVENTORY_GROUPS = new Set([
    TRADE_SIDE_INTERFACE,
    336,
]);

const TRADE_REMOVE_INTERFACE_GROUPS = new Set([
    TRADE_MAIN_INTERFACE,
    TRADE_CONFIRM_INTERFACE,
    TRADE_SELF_INV_ID,
]);
const MAX_TRADE_QUANTITY = 2_147_483_647;

export type TradeQuantityPromptRequest = {
    kind: "offer" | "remove";
    slot: number;
    itemId?: number;
    prompt?: string;
};

type TradeBridgeHost = {
    tradeSelfInventory: Inventory;
    tradeOtherInventory: Inventory;
    widgetSessionManager: WidgetSessionManager;
    inventory: Inventory;
    promptTradeQuantity?: (request: TradeQuantityPromptRequest) => void;
    invalidateTradeWidgets?: () => void;
    onTradeRequest?: (fromName: string, fromPlayerId: number) => void;
    onTradeSessionOpen?: () => void;
    onTradeClosed?: () => void;
};

type ParsedTradeQuantity = number | "prompt" | null;

function parseTradeQuantityOption(
    verb: "offer" | "remove",
    option: string,
    maxAvailable: number,
): ParsedTradeQuantity {
    const normalized = option.trim().toLowerCase();
    if (!normalized.startsWith(verb)) {
        return null;
    }
    const suffix = normalized.slice(verb.length);
    if (suffix === "") {
        return maxAvailable > 0 ? 1 : 0;
    }
    if (suffix === "-1") {
        return maxAvailable > 0 ? 1 : 0;
    }
    if (suffix === "-all") {
        return maxAvailable;
    }
    if (suffix === "-x") {
        return "prompt";
    }
    const match = /^-(\d+)$/.exec(suffix);
    if (match) {
        const qty = parseInt(match[1], 10);
        return qty > 0 ? Math.min(maxAvailable, qty) : 0;
    }
    return null;
}

function looksLikeOfferOption(option: string): boolean {
    const normalized = option.trim().toLowerCase();
    return normalized === "" || normalized.startsWith("offer");
}

function looksLikeRemoveOption(option: string): boolean {
    const normalized = option.trim().toLowerCase();
    return normalized === "" || normalized.startsWith("remove");
}

function looksLikeTradeRequestAccept(option: string): boolean {
    const normalized = option.trim().toLowerCase();
    return (
        normalized === "accept" ||
        normalized === "accept trade" ||
        normalized === "accept invitation" ||
        normalized.includes("accept trade") ||
        normalized.includes("click here to accept") ||
        normalized.includes("click to accept")
    );
}

function looksLikeTradeRequestDecline(option: string): boolean {
    const normalized = option.trim().toLowerCase();
    return (
        normalized === "decline" ||
        normalized === "decline trade" ||
        normalized === "decline invitation" ||
        normalized.includes("decline trade") ||
        normalized.includes("click here to decline") ||
        normalized.includes("click to decline")
    );
}

export class TradeBridge {
    private unsubscribe?: () => void;
    private lastStage: "offer" | "confirm" | "closed" = "closed";

    constructor(private readonly host: TradeBridgeHost) {}

    registerInventories(map: Map<number, Inventory>): void {
        map.set(TRADE_SELF_INV_ID, this.host.tradeSelfInventory);
        map.set(TRADE_OTHER_INV_MAP_KEY, this.host.tradeOtherInventory);
    }

    start(): void {
        this.unsubscribe?.();
        this.unsubscribe = subscribeTrade((state) => {
            try {
                if (state.requestFrom) {
                    const fromName = state.requestFrom.name?.trim() || "Player";
                    this.host.onTradeRequest?.(fromName, state.requestFrom.playerId | 0);
                }
                this.applyState(state);
            } catch (err) {
                console.warn("[trade] failed to apply server state", err);
            }
        });
    }

    stop(): void {
        this.unsubscribe?.();
        this.unsubscribe = undefined;
        this.clearInventories();
        this.lastStage = "closed";
    }

    isTradeOpen(): boolean {
        return getLatestTradeState().open === true;
    }

    handleWidgetAction(
        groupId: number,
        childId: number,
        option: string | undefined,
        slot?: number,
        itemId?: number,
    ): boolean {
        const state = getLatestTradeState();
        const normalizedOption = (option ?? "").trim().toLowerCase();

        if (!state.open && state.requestFrom) {
            if (looksLikeTradeRequestAccept(normalizedOption)) {
                sendTradeAcceptRequest(state.requestFrom.playerId | 0);
                return true;
            }
            if (looksLikeTradeRequestDecline(normalizedOption)) {
                sendTradeDeclineRequest(state.requestFrom.playerId | 0);
                return true;
            }
            return false;
        }

        if (!state.open) {
            return false;
        }

        const gid = groupId | 0;
        const cid = childId | 0;

        if (gid === TRADE_MAIN_INTERFACE) {
            if (TRADEMAIN_ACCEPT_CHILDREN.has(cid) || normalizedOption === "accept") {
                sendTradeAccept();
                return true;
            }
            if (TRADEMAIN_DECLINE_CHILDREN.has(cid) || normalizedOption === "decline") {
                sendTradeDecline();
                return true;
            }
        }

        if (gid === TRADE_CONFIRM_INTERFACE) {
            if (TRADECONFIRM_ACCEPT_CHILDREN.has(cid) || normalizedOption === "accept") {
                sendTradeConfirmAccept();
                return true;
            }
            if (TRADECONFIRM_DECLINE_CHILDREN.has(cid) || normalizedOption === "decline") {
                sendTradeDecline();
                return true;
            }
        }

        if (TRADE_OFFER_INVENTORY_GROUPS.has(gid) && typeof slot === "number" && slot >= 0) {
            const parsed = parseTradeQuantityOption("offer", normalizedOption, Number.MAX_SAFE_INTEGER);
            if (parsed !== null) {
                return this.handleOfferQuantity(slot, itemId, parsed);
            }
            if (looksLikeOfferOption(normalizedOption)) {
                return this.handleOfferQuantity(slot, itemId, 1);
            }
        }

        if (
            TRADE_REMOVE_INTERFACE_GROUPS.has(gid) &&
            typeof slot === "number" &&
            slot >= 0
        ) {
            const offer = this.host.tradeSelfInventory.getSlot(slot);
            const available = Math.max(0, offer?.quantity ?? 0);
            const parsed = parseTradeQuantityOption("remove", normalizedOption, available);
            if (parsed !== null) {
                return this.handleRemoveQuantity(slot, offer?.itemId, parsed);
            }
            if (looksLikeRemoveOption(normalizedOption) && available > 0) {
                return this.handleRemoveQuantity(slot, offer?.itemId, 1);
            }
        }

        // Some layouts emit group 149 for both trade-side and self-offer slots.
        // Resolve ambiguity by looking at where the clicked slot currently exists.
        if ((gid | 0) === TRADE_SELF_INV_ID && typeof slot === "number" && slot >= 0) {
            const selfOfferEntry = this.host.tradeSelfInventory.getSlot(slot);
            const playerInvEntry = this.host.inventory.getSlot(slot);
            if (
                selfOfferEntry &&
                selfOfferEntry.itemId > 0 &&
                selfOfferEntry.quantity > 0 &&
                looksLikeRemoveOption(normalizedOption)
            ) {
                const parsed = parseTradeQuantityOption(
                    "remove",
                    normalizedOption,
                    selfOfferEntry.quantity,
                );
                const qty = parsed === null || parsed === "prompt" ? 1 : parsed;
                return this.handleRemoveQuantity(slot, selfOfferEntry.itemId, qty);
            }
            if (
                playerInvEntry &&
                playerInvEntry.itemId > 0 &&
                playerInvEntry.quantity > 0 &&
                looksLikeOfferOption(normalizedOption)
            ) {
                const parsed = parseTradeQuantityOption("offer", normalizedOption, Number.MAX_SAFE_INTEGER);
                const qty = parsed === null || parsed === "prompt" ? 1 : parsed;
                return this.handleOfferQuantity(slot, playerInvEntry.itemId, qty);
            }
        }

        return false;
    }

    handleInventoryDragToTrade(sourceSlot: number, itemId?: number): boolean {
        if (!this.isTradeOpen()) {
            return false;
        }
        this.offerFromInventorySlot(sourceSlot, itemId, undefined);
        return true;
    }

    handleTradeCloseByUser(groupId: number): void {
        if (!this.isTradeOpen()) {
            return;
        }
        if (
            (groupId | 0) === TRADE_MAIN_INTERFACE ||
            (groupId | 0) === TRADE_CONFIRM_INTERFACE
        ) {
            sendTradeDecline();
        }
    }

    private handleOfferQuantity(
        slot: number,
        itemIdHint: number | undefined,
        parsed: ParsedTradeQuantity,
    ): boolean {
        const entry = this.host.inventory.getSlot(slot);
        if (!entry || entry.itemId <= 0 || entry.quantity <= 0) {
            return true;
        }
        if (itemIdHint && itemIdHint > 0 && itemIdHint !== entry.itemId) {
            return true;
        }
        if (parsed === "prompt") {
            this.host.promptTradeQuantity?.({
                kind: "offer",
                slot,
                itemId: entry.itemId,
                prompt: "How many would you like to offer?",
            });
            return true;
        }
        if (typeof parsed !== "number" || parsed <= 0) {
            return true;
        }
        const quantity = Math.max(
            1,
            Math.min(entry.quantity, MAX_TRADE_QUANTITY, Math.floor(parsed)),
        );
        sendTradeOffer(slot, entry.itemId, quantity);
        return true;
    }

    private handleRemoveQuantity(
        slot: number,
        itemIdHint: number | undefined,
        parsed: ParsedTradeQuantity,
    ): boolean {
        const offer = this.host.tradeSelfInventory.getSlot(slot);
        if (!offer || offer.itemId <= 0 || offer.quantity <= 0) {
            return true;
        }
        if (itemIdHint && itemIdHint > 0 && itemIdHint !== offer.itemId) {
            return true;
        }
        const available = offer.quantity | 0;
        if (parsed === "prompt") {
            this.host.promptTradeQuantity?.({
                kind: "remove",
                slot,
                itemId: offer.itemId,
                prompt: "How many would you like to remove?",
            });
            return true;
        }
        if (typeof parsed !== "number" || parsed <= 0) {
            return true;
        }
        const quantity = Math.max(
            1,
            Math.min(available, Math.min(MAX_TRADE_QUANTITY, Math.floor(parsed))),
        );
        sendTradeRemove(slot, quantity);
        return true;
    }

    private offerFromInventorySlot(
        slot: number,
        itemIdHint?: number,
        quantity?: number,
    ): void {
        const entry = this.host.inventory.getSlot(slot);
        if (!entry || entry.itemId <= 0 || entry.quantity <= 0) {
            return;
        }
        if (itemIdHint && itemIdHint > 0 && itemIdHint !== entry.itemId) {
            return;
        }
        const amount =
            typeof quantity === "number" && quantity > 0
                ? Math.max(1, Math.min(MAX_TRADE_QUANTITY, Math.floor(quantity)))
                : entry.quantity;
        sendTradeOffer(slot, entry.itemId, amount);
    }

    private applyState(state: TradeWindowState): void {
        if (!state.open) {
            this.clearInventories();
            this.lastStage = "closed";
            markInvTransmit(93);
            this.host.onTradeClosed?.();
            return;
        }

        if (this.lastStage === "closed") {
            this.host.onTradeSessionOpen?.();
        }

        this.populateInventory(this.host.tradeSelfInventory, state.self?.offers);
        this.populateInventory(this.host.tradeOtherInventory, state.other?.offers);
        markInvTransmit(93);
        markInvTransmit(TRADE_SELF_INV_ID);
        markInvTransmit(TRADE_OTHER_INV_ID);
        markInvTransmit(TRADE_OTHER_INV_MAP_KEY);
        this.host.invalidateTradeWidgets?.();
        this.lastStage = state.stage === "confirm" ? "confirm" : "offer";
    }

    private populateInventory(inventory: Inventory, offers?: TradeOfferEntryMessage[]): void {
        inventory.clear();
        if (!Array.isArray(offers)) {
            return;
        }
        for (const offer of offers) {
            const slot = Math.max(0, Math.min(inventory.capacity - 1, offer.slot | 0));
            const itemId = offer.itemId | 0;
            const quantity = Math.max(1, offer.quantity | 0);
            if (itemId > 0) {
                inventory.setSlot(slot, itemId, quantity);
            }
        }
    }

    private clearInventories(): void {
        this.host.tradeSelfInventory.clear();
        this.host.tradeOtherInventory.clear();
        markInvTransmit(TRADE_SELF_INV_ID);
        markInvTransmit(TRADE_OTHER_INV_ID);
        markInvTransmit(TRADE_OTHER_INV_MAP_KEY);
    }
}
