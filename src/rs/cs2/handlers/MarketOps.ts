/**
 * Stock market and trading post operations
 */
import {
    getGrandExchangeOffer,
    getGrandExchangeOfferCompletedGold,
    isGrandExchangeOfferAdding,
    isGrandExchangeOfferEmpty,
    isGrandExchangeOfferFinished,
    isGrandExchangeOfferStable,
} from "../../../client/grandexchange/GrandExchangeOffers";
import { Opcodes } from "../Opcodes";
import type { HandlerContext, HandlerMap } from "./HandlerTypes";

function readSlot(ctx: HandlerContext): number {
    return ctx.intStack[--ctx.intStackSize] | 0;
}

export function registerMarketOps(handlers: HandlerMap): void {
    handlers.set(Opcodes.STOCKMARKET_GETOFFERTYPE, (ctx) => {
        const slot = readSlot(ctx);
        const offer = getGrandExchangeOffer(slot);
        ctx.pushInt(offer && offer.itemId > 0 ? offer.type : 0);
    });

    handlers.set(Opcodes.STOCKMARKET_GETOFFERITEM, (ctx) => {
        const slot = readSlot(ctx);
        const offer = getGrandExchangeOffer(slot);
        ctx.pushInt(offer?.itemId ?? 0);
    });

    handlers.set(Opcodes.STOCKMARKET_GETOFFERPRICE, (ctx) => {
        const slot = readSlot(ctx);
        const offer = getGrandExchangeOffer(slot);
        ctx.pushInt(offer?.priceEach ?? 0);
    });

    handlers.set(Opcodes.STOCKMARKET_GETOFFERCOUNT, (ctx) => {
        const slot = readSlot(ctx);
        const offer = getGrandExchangeOffer(slot);
        ctx.pushInt(offer?.quantity ?? 0);
    });

    handlers.set(Opcodes.STOCKMARKET_GETOFFERCOMPLETEDCOUNT, (ctx) => {
        const slot = readSlot(ctx);
        const offer = getGrandExchangeOffer(slot);
        ctx.pushInt(offer?.quantityTraded ?? 0);
    });

    handlers.set(Opcodes.STOCKMARKET_GETOFFERCOMPLETEDGOLD, (ctx) => {
        const slot = readSlot(ctx);
        ctx.pushInt(getGrandExchangeOfferCompletedGold(slot));
    });

    handlers.set(Opcodes.STOCKMARKET_ISOFFEREMPTY, (ctx) => {
        const slot = readSlot(ctx);
        ctx.pushInt(isGrandExchangeOfferEmpty(slot) ? 1 : 0);
    });

    handlers.set(Opcodes.STOCKMARKET_ISOFFERSTABLE, (ctx) => {
        const slot = readSlot(ctx);
        ctx.pushInt(isGrandExchangeOfferStable(slot) ? 1 : 0);
    });

    handlers.set(Opcodes.STOCKMARKET_ISOFFERFINISHED, (ctx) => {
        const slot = readSlot(ctx);
        ctx.pushInt(isGrandExchangeOfferFinished(slot) ? 1 : 0);
    });

    handlers.set(Opcodes.STOCKMARKET_ISOFFERADDING, (ctx) => {
        const slot = readSlot(ctx);
        ctx.pushInt(isGrandExchangeOfferAdding(slot) ? 1 : 0);
    });

    // === Trading Post ===
    handlers.set(Opcodes.TRADINGPOST_SORTBY_NAME, (ctx) => {
        ctx.intStackSize--;
    });

    handlers.set(Opcodes.TRADINGPOST_SORTBY_PRICE, (ctx) => {
        ctx.intStackSize--;
    });

    handlers.set(Opcodes.TRADINGPOST_SORTFILTERBY_WORLD, (ctx) => {
        ctx.intStackSize -= 2;
    });

    handlers.set(Opcodes.TRADINGPOST_SORTBY_AGE, (ctx) => {
        ctx.intStackSize--;
    });

    handlers.set(Opcodes.TRADINGPOST_SORTBY_COUNT, (ctx) => {
        ctx.intStackSize--;
    });

    handlers.set(Opcodes.TRADINGPOST_GETTOTALOFFERS, (ctx) => {
        ctx.pushInt(0);
    });

    handlers.set(Opcodes.TRADINGPOST_GETOFFERWORLD, (ctx) => {
        ctx.intStackSize--;
        ctx.pushInt(0);
    });

    handlers.set(Opcodes.TRADINGPOST_GETOFFERNAME, (ctx) => {
        ctx.intStackSize--;
        ctx.pushString("");
    });

    handlers.set(Opcodes.TRADINGPOST_GETOFFERPREVIOUSNAME, (ctx) => {
        ctx.intStackSize--;
        ctx.pushString("");
    });

    handlers.set(Opcodes.TRADINGPOST_GETOFFERAGE, (ctx) => {
        ctx.intStackSize--;
        ctx.pushInt(0);
    });

    handlers.set(Opcodes.TRADINGPOST_GETOFFERCOUNT, (ctx) => {
        ctx.intStackSize--;
        ctx.pushInt(0);
    });

    handlers.set(Opcodes.TRADINGPOST_GETOFFERPRICE, (ctx) => {
        ctx.intStackSize--;
        ctx.pushInt(0);
    });

    handlers.set(Opcodes.TRADINGPOST_GETOFFERITEM, (ctx) => {
        ctx.intStackSize--;
        ctx.pushInt(-1);
    });

    handlers.set(Opcodes.HISCORE_GETSTATUS, (ctx) => {
        ctx.pushInt(0);
    });
}
