/**
 * Client-side Grand Exchange offer state read by CS2 stockmarket_* opcodes.
 *
 * Type encoding matches script 798:
 * - 0 = buy
 * - 1 = sell
 */
export type ClientGeOfferSlot = {
    type: 0 | 1;
    itemId: number;
    quantity: number;
    quantityTraded: number;
    priceEach: number;
};

const EMPTY_SLOT: ClientGeOfferSlot = {
    type: 0,
    itemId: 0,
    quantity: 0,
    quantityTraded: 0,
    priceEach: 0,
};

const slots: ClientGeOfferSlot[] = Array.from({ length: 8 }, () => ({ ...EMPTY_SLOT }));

export function resetGrandExchangeOffers(): void {
    for (let i = 0; i < slots.length; i++) {
        slots[i] = { ...EMPTY_SLOT };
    }
}

export function setGrandExchangeOffers(
    nextSlots: Array<{
        slot: number;
        type: 0 | 1 | 2;
        itemId: number;
        quantity: number;
        quantityTraded: number;
        priceEach: number;
    }>,
): void {
    for (const entry of nextSlots) {
        const index = entry.slot | 0;
        if (index < 0 || index >= slots.length) continue;
        if (entry.type === 0 || entry.itemId <= 0) {
            slots[index] = { ...EMPTY_SLOT };
            continue;
        }
        slots[index] = {
            type: entry.type === 2 ? 1 : 0,
            itemId: entry.itemId | 0,
            quantity: Math.max(0, entry.quantity | 0),
            quantityTraded: Math.max(0, entry.quantityTraded | 0),
            priceEach: Math.max(0, entry.priceEach | 0),
        };
    }
}

export function getGrandExchangeOffer(slot: number): ClientGeOfferSlot | undefined {
    if (slot < 0 || slot >= slots.length) return undefined;
    return slots[slot];
}

export function isGrandExchangeOfferEmpty(slot: number): boolean {
    const offer = getGrandExchangeOffer(slot);
    return !offer || offer.itemId <= 0 || offer.quantity <= 0;
}

export function isGrandExchangeOfferFinished(slot: number): boolean {
    const offer = getGrandExchangeOffer(slot);
    if (!offer || offer.itemId <= 0) return true;
    return offer.quantityTraded >= offer.quantity;
}

export function isGrandExchangeOfferStable(slot: number): boolean {
    const offer = getGrandExchangeOffer(slot);
    if (!offer || offer.itemId <= 0) return true;
    return offer.quantityTraded >= offer.quantity;
}

export function isGrandExchangeOfferAdding(slot: number): boolean {
    const offer = getGrandExchangeOffer(slot);
    if (!offer || offer.itemId <= 0) return false;
    return offer.quantityTraded < offer.quantity;
}

export function getGrandExchangeOfferCompletedGold(slot: number): number {
    const offer = getGrandExchangeOffer(slot);
    if (!offer) return 0;
    return offer.priceEach * offer.quantityTraded;
}
