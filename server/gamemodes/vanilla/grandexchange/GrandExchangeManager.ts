import { GE_SLOT_COUNT } from "./geConstants";

export enum GeOfferType {
    BUY = "BUY",
    SELL = "SELL",
}

export interface GeOffer {
    id: number;
    ownerPlayerId: number;
    ownerName: string;
    slot: number;
    type: GeOfferType;
    itemId: number;
    quantity: number;
    priceEach: number;
    quantityTraded: number;
}

export interface GeCollection {
    coins: number;
    items: Array<{ itemId: number; amount: number }>;
}

export interface GeRuntimeState {
    nextOfferId: number;
    offers: GeOffer[];
    slots: Record<number, Array<GeOffer | null>>;
    collections: Record<number, GeCollection>;
}

export class GrandExchangeManager {
    private nextOfferId = 1;
    private readonly offers = new Map<number, GeOffer>();
    private readonly playerSlots = new Map<number, Array<GeOffer | null>>();
    private readonly collections = new Map<number, GeCollection>();

    slotOffers(playerId: number): Array<GeOffer | null> {
        if (!this.playerSlots.has(playerId)) {
            this.playerSlots.set(playerId, new Array(GE_SLOT_COUNT).fill(null));
        }
        return this.playerSlots.get(playerId)!;
    }

    collection(playerId: number): GeCollection {
        if (!this.collections.has(playerId)) {
            this.collections.set(playerId, { coins: 0, items: [] });
        }
        return this.collections.get(playerId)!;
    }

    activeOffers(): GeOffer[] {
        return [...this.offers.values()];
    }

    offerInSlot(playerId: number, slot: number): GeOffer | null {
        if (slot < 0 || slot >= GE_SLOT_COUNT) return null;
        return this.slotOffers(playerId)[slot];
    }

    registerOffer(offer: GeOffer): void {
        this.offers.set(offer.id, offer);
        this.slotOffers(offer.ownerPlayerId)[offer.slot] = offer;
    }

    removeOffer(offer: GeOffer): void {
        this.offers.delete(offer.id);
        const slots = this.slotOffers(offer.ownerPlayerId);
        if (slots[offer.slot]?.id === offer.id) {
            slots[offer.slot] = null;
        }
    }

    createOfferId(): number {
        return this.nextOfferId++;
    }

    addToCollection(playerId: number, itemId: number, amount: number): void {
        if (amount <= 0 || itemId <= 0) return;
        const collection = this.collection(playerId);
        const existing = collection.items.find((entry) => entry.itemId === itemId);
        if (existing) {
            existing.amount += amount;
        } else {
            collection.items.push({ itemId, amount });
        }
    }

    addCoinsToCollection(playerId: number, amount: number): void {
        if (amount <= 0) return;
        this.collection(playerId).coins += amount;
    }

    export(): GeRuntimeState {
        const slots: Record<number, Array<GeOffer | null>> = {};
        for (const [playerId, offerArray] of this.playerSlots.entries()) {
            slots[playerId] = [...offerArray];
        }
        const collections: Record<number, GeCollection> = {};
        for (const [playerId, collection] of this.collections.entries()) {
            collections[playerId] = {
                coins: collection.coins,
                items: collection.items.map((entry) => ({ ...entry })),
            };
        }
        return {
            nextOfferId: this.nextOfferId,
            offers: [...this.offers.values()],
            slots,
            collections,
        };
    }

    restore(state: GeRuntimeState): void {
        this.offers.clear();
        this.playerSlots.clear();
        this.collections.clear();
        this.nextOfferId = Math.max(1, state.nextOfferId | 0);

        for (const offer of state.offers) {
            this.offers.set(offer.id, offer);
        }
        for (const [playerIdRaw, offerArray] of Object.entries(state.slots)) {
            const playerId = Number(playerIdRaw);
            const slots = this.slotOffers(playerId);
            offerArray.forEach((offer, index) => {
                if (index < GE_SLOT_COUNT) {
                    slots[index] = offer;
                }
            });
        }
        for (const [playerIdRaw, collection] of Object.entries(state.collections)) {
            const playerId = Number(playerIdRaw);
            this.collections.set(playerId, {
                coins: collection.coins,
                items: collection.items.map((entry) => ({ ...entry })),
            });
        }
    }
}

export function getOfferRemaining(offer: GeOffer): number {
    return Math.max(0, offer.quantity - offer.quantityTraded);
}

export function isOfferComplete(offer: GeOffer): boolean {
    return offer.quantityTraded >= offer.quantity;
}
