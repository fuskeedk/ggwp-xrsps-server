import { getItemDefinition } from "../../data/items";
import {
    buildTradeConfirmPostScripts,
    buildTradeMainPostScripts,
} from "../../../gamemodes/vanilla/trade/TradeInterfaceHooks";
import {
    TRADE_CONFIRM_INTERFACE_ID,
    TRADE_MAIN_INTERFACE_ID,
} from "../../../gamemodes/vanilla/trade/tradeConstants";
import {
    TradeAction,
    TradeActionClientPayload,
    TradeServerPayload,
    TradeStage,
} from "../../network/messages";
import { logger } from "../../utils/logger";
import type { ServerServices } from "../ServerServices";
import { type InventoryEntry, PlayerState } from "../player";
import {
    CHATBOX_GROUP_ID,
    CHATBOX_MES_LAYER_HIDE,
} from "../../widgets/InterfaceService";

type TradeOfferState = {
    itemId: number;
    quantity: number;
};

type TradePartyState = {
    player: PlayerState;
    offers: TradeOfferState[];
    accepted: boolean;
    confirmAccepted: boolean;
};

type TradeSession = {
    id: string;
    parties: [TradePartyState, TradePartyState];
    stage: TradeStage;
};

type TradeRequestState = {
    fromId: number;
    toId: number;
    expireTick: number;
};

const REQUEST_TIMEOUT_TICKS = 64; // ~38.4 seconds at 600ms ticks
const MAX_TRADE_QUANTITY = 2_147_483_647;

export class TradeManager {
    private readonly requests = new Map<string, TradeRequestState>();
    private readonly sessions = new Map<string, TradeSession>();
    private readonly sessionByPlayer = new Map<number, TradeSession>();
    private sessionCounter = 1;

    constructor(private readonly svc: ServerServices) {
        this.registerInterfaceCloseHooks();
    }

    /** ESC / IF_CLOSE must end the trade and return offered items (OSRS behaviour). */
    private registerInterfaceCloseHooks(): void {
        const iface = this.svc.interfaceService;
        if (!iface) return;
        const onTradeUiClosed = (player: PlayerState) => this.handleInterfaceClosed(player);
        iface.onInterfaceClose(TRADE_MAIN_INTERFACE_ID, onTradeUiClosed);
        iface.onInterfaceClose(TRADE_CONFIRM_INTERFACE_ID, onTradeUiClosed);
    }

    handleInterfaceClosed(player: PlayerState): void {
        const session = this.sessionByPlayer.get(player.id);
        if (!session) return;
        const other = this.getCounterparty(session, player.id);
        this.closeSession(session, "You decline the trade.");
        if (other) {
            this.svc.messagingService.sendGameMessageToPlayer(
                other.player,
                `${this.resolveName(player)} declined the trade.`,
            );
        }
    }

    private currentTick(): number {
        return this.svc.ticker?.currentTick?.() ?? 0;
    }

    private queueInventorySnapshot(player: PlayerState): void {
        const sock = this.svc.players?.getSocketByPlayerId(player.id);
        if (sock) this.svc.inventoryService.sendInventorySnapshot(sock, player);
    }

    private openTradeWidget(player: PlayerState, partner: PlayerState): void {
        const iface = this.svc.interfaceService;
        if (!iface) {
            logger.warn("[trade] interfaceService unavailable; trade UI will not mount");
            return;
        }
        this.queueInventorySnapshot(player);
        iface.openModal(
            player,
            335,
            {
                partnerName: this.resolveName(partner),
            },
            { postScripts: buildTradeMainPostScripts() },
        );
    }

    private closeTradeWidget(player: PlayerState): void {
        const iface = this.svc.interfaceService;
        player.widgets.close(334);
        if (iface) {
            iface.restoreNormalInventory(player);
            iface.closeModal(player);
            return;
        }
        player.widgets.close(336);
        player.widgets.close(335);
    }

    private syncConfirmWidget(player: PlayerState, stage: TradeStage, partner?: PlayerState): void {
        const iface = this.svc.interfaceService;
        if (!iface) return;
        if (stage === TradeStage.Confirm) {
            const partnerName = partner ? this.resolveName(partner) : "Player";
            iface.openModal(
                player,
                334,
                { partnerName },
                { postScripts: buildTradeConfirmPostScripts() },
            );
            return;
        }
        if (player.widgets.isOpen(334)) {
            player.widgets.close(334);
        }
        if (!player.widgets.isOpen(335)) {
            const session = this.sessionByPlayer.get(player.id);
            const other = session ? this.getCounterparty(session, player.id) : undefined;
            if (other) {
                this.openTradeWidget(player, other.player);
            } else {
                iface.openModal(player, 335, undefined, { postScripts: buildTradeMainPostScripts() });
            }
        }
    }

    requestTrade(initiator: PlayerState, target: PlayerState, currentTick: number): void {
        if (initiator.id === target.id) return;
        if (this.sessionByPlayer.has(initiator.id)) {
            this.svc.messagingService.sendGameMessageToPlayer(
                initiator,
                "You are already in a trade.",
            );
            return;
        }
        if (this.sessionByPlayer.has(target.id)) {
            this.svc.messagingService.sendGameMessageToPlayer(
                initiator,
                "That player is currently busy.",
            );
            return;
        }
        const reverseKey = this.buildRequestKey(target.id, initiator.id);
        const key = this.buildRequestKey(initiator.id, target.id);
        const reverse = this.requests.get(reverseKey);
        if (reverse) {
            this.requests.delete(reverseKey);
            this.requests.delete(key);
            this.startSession(initiator, target);
            return;
        }
        this.requests.set(key, {
            fromId: initiator.id,
            toId: target.id,
            expireTick: currentTick + REQUEST_TIMEOUT_TICKS,
        });
        const name = this.resolveName(initiator);
        this.svc.messagingService.sendGameMessageToPlayer(initiator, "Sending trade offer...");
        this.svc.messagingService.queueChatMessage({
            messageType: "trade",
            from: name,
            text: "wishes to trade with you.",
            targetPlayerIds: [target.id],
        });
        this.setTradeRequestMeslayerVisible(target.id, true);
        this.svc.broadcastService.queueTradeMessage(target.id, {
            kind: "request",
            fromId: initiator.id,
            fromName: name,
        });
    }

    /** OSRS-style accept/decline from chat meslayer (widget 162). */
    handleResumePauseButton(
        player: PlayerState,
        widgetId: number,
        childIndex: number,
        currentTick: number,
    ): boolean {
        const group = (widgetId >>> 16) & 0xffff;
        if (group !== 162) return false;
        const fromId = this.findIncomingRequestFrom(player.id);
        if (fromId === undefined) return false;
        this.respondToTradeRequest(player, fromId, childIndex !== 1, currentTick);
        return true;
    }

    handlePlayerLogout(
        player: PlayerState,
        reason: string = "Other player declined the trade.",
    ): void {
        this.clearRequestsFor(player.id);
        const session = this.sessionByPlayer.get(player.id);
        if (!session) return;
        const other = this.getCounterparty(session, player.id);
        this.closeSession(session, reason, player.id);
        if (other) {
            this.svc.messagingService.sendGameMessageToPlayer(other.player, reason);
        }
    }

    tick(currentTick: number): void {
        for (const [key, req] of Array.from(this.requests.entries())) {
            if (req.expireTick <= currentTick) {
                this.requests.delete(key);
                this.clearTradeRequestMeslayer(req.toId);
                const fromPlayer = this.svc.players?.getById(req.fromId);
                if (fromPlayer) {
                    this.svc.messagingService.sendGameMessageToPlayer(
                        fromPlayer,
                        "Your trade offer has expired.",
                    );
                }
            }
        }
    }

    handleAction(player: PlayerState, action: TradeActionClientPayload, currentTick: number): void {
        if (action.action === TradeAction.AcceptRequest) {
            this.respondToTradeRequest(player, action.fromPlayerId, true, currentTick);
            return;
        }
        if (action.action === TradeAction.DeclineRequest) {
            this.respondToTradeRequest(player, action.fromPlayerId, false, currentTick);
            return;
        }
        const session = this.sessionByPlayer.get(player.id);
        if (!session) {
            this.svc.messagingService.sendGameMessageToPlayer(
                player,
                "You're not currently trading.",
            );
            return;
        }
        switch (action.action) {
            case TradeAction.Offer:
                this.handleOfferAction(
                    session,
                    player,
                    action.slot,
                    action.quantity,
                    action.itemId,
                );
                break;
            case TradeAction.Remove:
                this.handleRemoveAction(session, player, action.slot, action.quantity);
                break;
            case TradeAction.Accept:
                this.handleAccept(session, player);
                break;
            case TradeAction.Decline:
                this.closeSession(session, "You decline the trade.");
                break;
            case TradeAction.ConfirmAccept:
                this.handleConfirmAccept(session, player);
                break;
            case TradeAction.ConfirmDecline:
                this.closeSession(session, "You decline the trade.");
                break;
        }
    }

    private buildRequestKey(fromId: number, toId: number): string {
        return `${fromId}->${toId}`;
    }

    private findIncomingRequestFrom(playerId: number): number | undefined {
        for (const req of this.requests.values()) {
            if (req.toId === playerId) {
                return req.fromId;
            }
        }
        return undefined;
    }

    private setTradeRequestMeslayerVisible(playerId: number, visible: boolean): void {
        const uid = (CHATBOX_GROUP_ID << 16) | CHATBOX_MES_LAYER_HIDE;
        this.svc.queueWidgetEvent(playerId, {
            action: "set_hidden",
            uid,
            hidden: !visible,
        });
    }

    private clearTradeRequestMeslayer(playerId: number): void {
        this.setTradeRequestMeslayerVisible(playerId, false);
    }

    private respondToTradeRequest(
        responder: PlayerState,
        fromId: number,
        accept: boolean,
        currentTick: number,
    ): void {
        const key = this.buildRequestKey(fromId, responder.id);
        const req = this.requests.get(key);
        if (!req || req.toId !== responder.id) {
            this.svc.messagingService.sendGameMessageToPlayer(
                responder,
                "Unable to find that player to trade with.",
            );
            return;
        }
        this.requests.delete(key);
        this.requests.delete(this.buildRequestKey(responder.id, fromId));

        const initiator = this.svc.players?.getById(fromId);
        if (!initiator) {
            this.svc.messagingService.sendGameMessageToPlayer(
                responder,
                "Unable to find that player to trade with.",
            );
            return;
        }

        if (!accept) {
            this.clearTradeRequestMeslayer(responder.id);
            this.svc.messagingService.sendGameMessageToPlayer(
                initiator,
                `${this.resolveName(responder)} declined the trade.`,
            );
            return;
        }

        this.clearTradeRequestMeslayer(responder.id);

        if (this.sessionByPlayer.has(initiator.id) || this.sessionByPlayer.has(responder.id)) {
            this.svc.messagingService.sendGameMessageToPlayer(
                responder,
                "That player is currently busy.",
            );
            return;
        }

        this.startSession(initiator, responder);
    }

    private clearRequestsFor(playerId: number): void {
        for (const [key, req] of Array.from(this.requests.entries())) {
            if (req.fromId === playerId || req.toId === playerId) {
                this.requests.delete(key);
            }
        }
        this.clearTradeRequestMeslayer(playerId);
    }

    private startSession(a: PlayerState, b: PlayerState): void {
        const session: TradeSession = {
            id: `trade:${Math.min(a.id, b.id)}:${Math.max(a.id, b.id)}:${this.sessionCounter++}`,
            parties: [this.createParty(a), this.createParty(b)],
            stage: TradeStage.Offer,
        };
        this.sessions.set(session.id, session);
        this.sessionByPlayer.set(a.id, session);
        this.sessionByPlayer.set(b.id, session);
        try {
            this.openTradeWidget(a, b);
            this.openTradeWidget(b, a);
        } catch (err) {
            logger.warn("[trade] failed to open trade widget", err);
        }
        this.broadcastSession(session, "open");
    }

    private closeSession(session: TradeSession, reason: string, _blamedId?: number): void {
        this.returnOffers(session.parties[0]);
        this.returnOffers(session.parties[1]);

        // Drop session before closing widgets so close hooks cannot re-enter.
        this.sessions.delete(session.id);
        for (const party of session.parties) {
            this.sessionByPlayer.delete(party.player.id);
        }

        for (const party of session.parties) {
            try {
                this.closeTradeWidget(party.player);
            } catch (err) {
                logger.warn("[trade] failed to close trade widget", err);
            }
            this.queueInventorySnapshot(party.player);
            this.svc.broadcastService.queueTradeMessage(party.player.id, {
                kind: "close",
                reason,
            });
        }
    }

    private createParty(player: PlayerState): TradePartyState {
        return {
            player,
            offers: [],
            accepted: false,
            confirmAccepted: false,
        };
    }

    private getParty(session: TradeSession, playerId: number): TradePartyState | undefined {
        return session.parties.find((party) => party.player.id === playerId);
    }

    private getCounterparty(session: TradeSession, playerId: number): TradePartyState | undefined {
        return session.parties.find((party) => party.player.id !== playerId);
    }

    private resolveName(player: PlayerState): string {
        if (player.name && player.name.length > 0) return player.name;
        return `Player ${player.id}`;
    }

    private ensureTradeable(player: PlayerState, itemId: number): boolean {
        const def = getItemDefinition(itemId);
        if (!def) return true;
        if (def.tradeable) return true;
        this.svc.messagingService.sendGameMessageToPlayer(player, "That item isn't tradeable.");
        return false;
    }

    private handleOfferAction(
        session: TradeSession,
        player: PlayerState,
        slotIndex: number,
        requestedQty: number,
        itemIdHint?: number,
    ): void {
        const party = this.getParty(session, player.id);
        if (!party) return;
        if (session.stage === TradeStage.Confirm) {
            session.stage = TradeStage.Offer;
            party.confirmAccepted = false;
            const other = this.getCounterparty(session, player.id);
            if (other) other.confirmAccepted = false;
        }
        const inventory = this.svc.inventoryService.getInventory(player);
        const slot = Math.max(0, Math.min(inventory.length - 1, slotIndex));
        const entry = inventory[slot];
        if (!entry || entry.itemId <= 0 || entry.quantity <= 0) {
            this.svc.messagingService.sendGameMessageToPlayer(
                player,
                "That item is no longer in your inventory.",
            );
            return;
        }
        if (itemIdHint && itemIdHint !== entry.itemId) {
            this.svc.messagingService.sendGameMessageToPlayer(
                player,
                "That item is no longer in your inventory.",
            );
            return;
        }
        const offeredItemId = entry.itemId;
        if (!this.ensureTradeable(player, offeredItemId)) return;
        const def = getItemDefinition(offeredItemId);
        const isStackable = !!def?.stackable;
        const desiredRaw = Number.isFinite(requestedQty) ? Math.floor(requestedQty) : 1;
        const desired = Math.max(1, Math.min(MAX_TRADE_QUANTITY, desiredRaw));
        const available = isStackable
            ? entry.quantity
            : this.svc.inventoryService.countInventoryItem(player, offeredItemId);
        const amount = Math.min(available, desired);
        if (!(amount > 0)) {
            this.svc.messagingService.sendGameMessageToPlayer(
                player,
                "You don't have enough of that item.",
            );
            return;
        }
        if (!this.removeItemQuantityFromInventory(player, offeredItemId, amount, slot)) {
            this.svc.messagingService.sendGameMessageToPlayer(
                player,
                "That item is no longer in your inventory.",
            );
            return;
        }
        this.addOffer(party, offeredItemId, amount);
        this.resetAcceptances(session);
        this.queueInventorySnapshot(player);
        this.broadcastSession(session);
    }

    private handleRemoveAction(
        session: TradeSession,
        player: PlayerState,
        offerSlot: number,
        quantity: number,
    ): void {
        const party = this.getParty(session, player.id);
        if (!party) return;
        if (party.offers.length === 0) return;
        const idx = Math.max(0, Math.min(party.offers.length - 1, offerSlot));
        const offer = party.offers[idx];
        if (!offer || offer.quantity <= 0) return;
        const amount = Math.max(1, Math.min(offer.quantity, quantity));
        if (!(amount > 0)) return;
        if (!this.addItemsToInventory(party.player, offer.itemId, amount)) {
            this.svc.messagingService.sendGameMessageToPlayer(
                player,
                "You don't have enough space in your inventory.",
            );
            return;
        }
        offer.quantity -= amount;
        if (offer.quantity <= 0) {
            party.offers.splice(idx, 1);
        }
        this.queueInventorySnapshot(player);
        if (session.stage === TradeStage.Confirm) {
            session.stage = TradeStage.Offer;
            party.confirmAccepted = false;
            const otherParty = this.getCounterparty(session, player.id);
            if (otherParty) otherParty.confirmAccepted = false;
        }
        this.resetAcceptances(session);
        this.broadcastSession(session);
    }

    private handleAccept(session: TradeSession, player: PlayerState): void {
        const party = this.getParty(session, player.id);
        if (!party) return;
        party.accepted = true;
        const other = this.getCounterparty(session, player.id);
        if (session.stage === TradeStage.Offer && other?.accepted) {
            session.stage = TradeStage.Confirm;
            party.confirmAccepted = false;
            if (other) other.confirmAccepted = false;
        }
        this.broadcastSession(session);
    }

    private handleConfirmAccept(session: TradeSession, player: PlayerState): void {
        if (session.stage !== TradeStage.Confirm) return;
        const party = this.getParty(session, player.id);
        if (!party) return;
        party.confirmAccepted = true;
        const other = this.getCounterparty(session, player.id);
        if (party.confirmAccepted && other?.confirmAccepted) {
            this.finalizeTrade(session);
            return;
        }
        this.broadcastSession(session);
    }

    private finalizeTrade(session: TradeSession): void {
        const [a, b] = session.parties;
        if (!this.canReceiveItems(a.player, b.offers)) {
            this.svc.messagingService.sendGameMessageToPlayer(
                b.player,
                "Other player doesn't have enough space.",
            );
            this.svc.messagingService.sendGameMessageToPlayer(
                a.player,
                "You don't have enough space in your inventory.",
            );
            session.stage = TradeStage.Offer;
            this.resetAcceptances(session);
            this.broadcastSession(session);
            return;
        }
        if (!this.canReceiveItems(b.player, a.offers)) {
            this.svc.messagingService.sendGameMessageToPlayer(
                a.player,
                "Other player doesn't have enough space.",
            );
            this.svc.messagingService.sendGameMessageToPlayer(
                b.player,
                "You don't have enough space in your inventory.",
            );
            session.stage = TradeStage.Offer;
            this.resetAcceptances(session);
            this.broadcastSession(session);
            return;
        }
        if (
            !this.applyOffersToInventory(a.player, b.offers) ||
            !this.applyOffersToInventory(b.player, a.offers)
        ) {
            logger.warn(`[trade] finalize apply failed for session ${session.id}`);
            this.svc.messagingService.sendGameMessageToPlayer(
                a.player,
                "Trade failed. Please try again.",
            );
            this.svc.messagingService.sendGameMessageToPlayer(
                b.player,
                "Trade failed. Please try again.",
            );
            session.stage = TradeStage.Offer;
            this.resetAcceptances(session);
            this.broadcastSession(session);
            return;
        }
        a.offers = [];
        b.offers = [];
        this.queueInventorySnapshot(a.player);
        this.queueInventorySnapshot(b.player);
        this.closeSession(session, "Trade completed.");
    }

    private applyOffersToInventory(player: PlayerState, offers: TradeOfferState[]): boolean {
        for (const offer of offers) {
            if (offer.quantity <= 0) continue;
            if (!this.addItemsToInventory(player, offer.itemId, offer.quantity)) {
                return false;
            }
        }
        return true;
    }

    private removeItemQuantityFromInventory(
        player: PlayerState,
        itemId: number,
        quantity: number,
        preferredSlot?: number,
    ): boolean {
        const quantityRaw = Number.isFinite(quantity) ? Math.floor(quantity) : 1;
        const needed = Math.max(1, Math.min(MAX_TRADE_QUANTITY, quantityRaw));
        if (this.svc.inventoryService.countInventoryItem(player, itemId) < needed) {
            return false;
        }

        const inventory = this.svc.inventoryService.getInventory(player);
        let remaining = needed;

        const takeFromSlot = (slot: number): void => {
            if (remaining <= 0) return;
            if (slot < 0 || slot >= inventory.length) return;
            const entry = inventory[slot];
            if (!entry || entry.itemId !== itemId || entry.quantity <= 0) return;

            const take = Math.min(remaining, entry.quantity);
            const nextQty = entry.quantity - take;
            if (nextQty > 0) {
                this.svc.inventoryService.setInventorySlot(player, slot, itemId, nextQty);
            } else {
                this.svc.inventoryService.setInventorySlot(player, slot, -1, 0);
            }
            remaining -= take;
        };

        if (typeof preferredSlot === "number") {
            takeFromSlot(preferredSlot | 0);
        }
        for (let i = 0; i < inventory.length && remaining > 0; i++) {
            if (typeof preferredSlot === "number" && i === (preferredSlot | 0)) {
                continue;
            }
            takeFromSlot(i);
        }
        return remaining <= 0;
    }

    private addOffer(party: TradePartyState, itemId: number, amount: number): void {
        const existing = party.offers.find((offer) => offer.itemId === itemId);
        if (existing) existing.quantity += amount;
        else party.offers.push({ itemId, quantity: amount });
    }

    private addItemsToInventory(player: PlayerState, itemId: number, quantity: number): boolean {
        const def = getItemDefinition(itemId);
        const isStackable = !!def?.stackable;
        if (isStackable) {
            return (
                this.svc.inventoryService.addItemToInventory(player, itemId, quantity).added ===
                quantity
            );
        }
        for (let i = 0; i < quantity; i++) {
            const result = this.svc.inventoryService.addItemToInventory(player, itemId, 1);
            if (result.added <= 0) {
                return false;
            }
        }
        return true;
    }

    private returnOffers(party: TradePartyState): void {
        if (party.offers.length === 0) return;
        const player = party.player;
        const tick = this.currentTick();
        for (const offer of party.offers) {
            if (offer.quantity <= 0) continue;
            if (this.addItemsToInventory(player, offer.itemId, offer.quantity)) {
                continue;
            }
            const spawned = this.svc.groundItems.spawn(
                offer.itemId,
                offer.quantity,
                { x: player.tileX, y: player.tileY, level: player.level },
                tick,
                { ownerId: player.id },
                player.worldViewId,
            );
            if (spawned) {
                this.svc.messagingService.sendGameMessageToPlayer(
                    player,
                    "Some traded items were dropped beneath you.",
                );
            } else {
                logger.warn(
                    `[trade] failed to return offer player=${player.id} item=${offer.itemId} qty=${offer.quantity}`,
                );
                this.svc.messagingService.sendGameMessageToPlayer(
                    player,
                    "Could not return some traded items due to lack of space.",
                );
            }
        }
        party.offers = [];
    }

    private canReceiveItems(player: PlayerState, offers: TradeOfferState[]): boolean {
        if (offers.length === 0) return true;
        const clone = this.svc.inventoryService
            .getInventory(player)
            .map((entry: InventoryEntry) => ({ itemId: entry.itemId, quantity: entry.quantity }));
        const findFreeSlot = () => clone.find((slot) => slot.itemId <= 0 || slot.quantity <= 0);
        for (const offer of offers) {
            if (offer.quantity <= 0) continue;
            const def = getItemDefinition(offer.itemId);
            const stackable = !!def?.stackable;
            if (stackable) {
                const existing = clone.find((slot) => slot.itemId === offer.itemId);
                if (existing) existing.quantity += offer.quantity;
                else {
                    const free = findFreeSlot();
                    if (!free) return false;
                    free.itemId = offer.itemId;
                    free.quantity = offer.quantity;
                }
            } else {
                let remaining = offer.quantity;
                while (remaining-- > 0) {
                    const free = findFreeSlot();
                    if (!free) return false;
                    free.itemId = offer.itemId;
                    free.quantity = 1;
                }
            }
        }
        return true;
    }

    private resetAcceptances(session: TradeSession): void {
        for (const party of session.parties) {
            party.accepted = false;
            party.confirmAccepted = false;
        }
    }

    private broadcastSession(session: TradeSession, kind: "open" | "update" = "update"): void {
        for (const party of session.parties) {
            const other = this.getCounterparty(session, party.player.id);
            this.syncConfirmWidget(party.player, session.stage, other?.player);
            const payload: TradeServerPayload = {
                kind,
                sessionId: session.id,
                stage: session.stage,
                self: this.buildPartyMessage(party),
                other: other ? this.buildPartyMessage(other) : { playerId: undefined, offers: [] },
                info: this.buildInfoMessage(session, party, other ?? null),
            };
            this.svc.broadcastService.queueTradeMessage(party.player.id, payload);
        }
    }

    private buildPartyMessage(party: TradePartyState) {
        return {
            playerId: party.player.id,
            name: this.resolveName(party.player),
            offers: party.offers.map((offer, idx) => ({
                slot: idx,
                itemId: offer.itemId,
                quantity: Math.max(0, offer.quantity),
            })),
            accepted: party.accepted,
            confirmAccepted: party.confirmAccepted,
        };
    }

    private buildInfoMessage(
        session: TradeSession,
        party: TradePartyState,
        other: TradePartyState | null,
    ): string | undefined {
        if (session.stage === TradeStage.Offer) {
            if (party.accepted && other && !other.accepted)
                return "Waiting for the other player...";
            if (!party.accepted && other?.accepted) return "Other player accepted.";
            return undefined;
        }
        if (session.stage === TradeStage.Confirm) {
            if (party.confirmAccepted && other && !other.confirmAccepted) {
                return "Waiting for the other player...";
            }
            return "Please check the items carefully.";
        }
        return undefined;
    }
}
