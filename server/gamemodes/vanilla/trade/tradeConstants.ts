/** Trade first screen (offer stage). */
export const TRADE_MAIN_INTERFACE_ID = 335;
/** Trade confirm screen (second stage). */
export const TRADE_CONFIRM_INTERFACE_ID = 334;
/** Trade inventory side panel (player backpack during trade). */
export const TRADE_SIDE_INTERFACE_ID = 336;

/** CS2 inventory ids used by the trade UI scripts. */
export const TRADE_SELF_OFFER_INV_ID = 149;
export const TRADE_OTHER_OFFER_INV_ID = 150;

/** Trade main (335) components — from InterfaceID.Trademain. */
export const TradeMainChild = {
    ACCEPT: 10,
    DECLINE: 13,
    YOUR_OFFER: 25,
    OTHER_OFFER: 28,
    TITLE: 31,
} as const;

/** Trade confirm (334) components — from InterfaceID.Tradeconfirm. */
export const TradeConfirmChild = {
    TITLE: 4,
    ACCEPT: 13,
    DECLINE: 14,
    YOUR_OFFER: 28,
    OTHER_OFFER: 29,
} as const;

/** Trade side panel (336) components. */
export const TradeSideChild = {
    SIDE_LAYER: 0,
} as const;

/** interface_inv_init */
export const SCRIPT_INTERFACE_INV_INIT = 149;

const EVENT_OP11 = 1;
function eventOp(op: number): number {
    return op === 11 ? EVENT_OP11 : 1 << op;
}

function eventOps(from: number, to: number): number {
    let flags = 0;
    for (let op = from; op <= to; op++) {
        flags |= eventOp(op);
    }
    return flags;
}

/** Offer ops on backpack + examine. */
export const TRADE_SIDE_INV_FLAGS = eventOps(1, 5) | eventOp(10);
/** Remove ops on your offer + examine. */
export const TRADE_OFFER_INV_FLAGS = eventOps(1, 5) | eventOp(10);
/** Examine only on other player's offer grid. */
export const TRADE_OTHER_OFFER_FLAGS = eventOp(10);
/** Accept / decline buttons. */
export const TRADE_BUTTON_FLAGS = eventOp(1);
