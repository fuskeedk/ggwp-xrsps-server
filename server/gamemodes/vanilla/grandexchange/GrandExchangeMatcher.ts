import {
    GeOffer,
    GeOfferType,
    GrandExchangeManager,
    getOfferRemaining,
    isOfferComplete,
} from "./GrandExchangeManager";
import { GE_TAX_RATE } from "./geConstants";

export class GrandExchangeMatcher {
    constructor(
        private readonly manager: GrandExchangeManager,
        private readonly onMatched: () => void,
    ) {}

    tryMatch(offer: GeOffer): void {
        if (offer.type === GeOfferType.BUY) {
            this.matchBuy(offer);
        } else {
            this.matchSell(offer);
        }
        this.onMatched();
    }

    private matchBuy(buy: GeOffer): void {
        const sells = this.manager
            .activeOffers()
            .filter(
                (offer) =>
                    offer.type === GeOfferType.SELL &&
                    offer.itemId === buy.itemId &&
                    !isOfferComplete(offer) &&
                    offer.id !== buy.id &&
                    offer.priceEach <= buy.priceEach,
            )
            .sort((a, b) => a.priceEach - b.priceEach || a.id - b.id);

        for (const sell of sells) {
            if (isOfferComplete(buy)) break;
            this.executeTrade(buy, sell);
        }
    }

    private matchSell(sell: GeOffer): void {
        const buys = this.manager
            .activeOffers()
            .filter(
                (offer) =>
                    offer.type === GeOfferType.BUY &&
                    offer.itemId === sell.itemId &&
                    !isOfferComplete(offer) &&
                    offer.id !== sell.id &&
                    offer.priceEach >= sell.priceEach,
            )
            .sort((a, b) => b.priceEach - a.priceEach || a.id - b.id);

        for (const buy of buys) {
            if (isOfferComplete(sell)) break;
            this.executeTrade(buy, sell);
        }
    }

    private executeTrade(buy: GeOffer, sell: GeOffer): void {
        const amount = Math.min(getOfferRemaining(buy), getOfferRemaining(sell));
        if (amount <= 0) return;

        const price = sell.priceEach;
        const total = price * amount;
        const tax = Math.floor(total * GE_TAX_RATE);
        const payout = total - tax;

        buy.quantityTraded += amount;
        sell.quantityTraded += amount;

        this.manager.addToCollection(buy.ownerPlayerId, buy.itemId, amount);
        this.manager.addCoinsToCollection(sell.ownerPlayerId, payout);

        if (isOfferComplete(buy)) this.manager.removeOffer(buy);
        if (isOfferComplete(sell)) this.manager.removeOffer(sell);
    }
}
