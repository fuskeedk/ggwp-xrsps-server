import type { PlayerState } from "../../../src/game/player";
import {
    GameframeTab,
    type InterfaceService,
    PLAYER_INV_ID,
} from "../../../src/widgets/InterfaceService";
import { SCRIPT_INTERFACE_INV_INIT } from "../shops/shopConstants";
import {
    TRADE_BUTTON_FLAGS,
    TRADE_CONFIRM_INTERFACE_ID,
    TRADE_MAIN_INTERFACE_ID,
    TRADE_OFFER_INV_FLAGS,
    TRADE_OTHER_OFFER_FLAGS,
    TRADE_OTHER_OFFER_INV_ID,
    TRADE_SELF_OFFER_INV_ID,
    TRADE_SIDE_INTERFACE_ID,
    TRADE_SIDE_INV_FLAGS,
    TradeConfirmChild,
    TradeMainChild,
    TradeSideChild,
} from "./tradeConstants";

export interface TradeOpenData {
    partnerName: string;
}

function widgetUid(groupId: number, childId: number): number {
    return ((groupId | 0) << 16) | (childId | 0);
}

/** Run after trademain (335) mounts so offer grids get item slots. */
export function buildTradeMainPostScripts(): Array<{
    scriptId: number;
    args: (string | number)[];
}> {
    const yourOfferUid = widgetUid(TRADE_MAIN_INTERFACE_ID, TradeMainChild.YOUR_OFFER);
    const otherOfferUid = widgetUid(TRADE_MAIN_INTERFACE_ID, TradeMainChild.OTHER_OFFER);
    return [
        {
            scriptId: SCRIPT_INTERFACE_INV_INIT,
            args: [
                yourOfferUid,
                TRADE_SELF_OFFER_INV_ID,
                7,
                4,
                0,
                -1,
                "Remove",
                "Remove-5",
                "Remove-10",
                "Remove-All",
                "Remove-X",
            ],
        },
        {
            scriptId: SCRIPT_INTERFACE_INV_INIT,
            args: [otherOfferUid, TRADE_OTHER_OFFER_INV_ID, 7, 4, 0, -1, "", "", "", "", ""],
        },
    ];
}

/** Run after tradeconfirm (334) mounts. */
export function buildTradeConfirmPostScripts(): Array<{
    scriptId: number;
    args: (string | number)[];
}> {
    const yourOfferUid = widgetUid(TRADE_CONFIRM_INTERFACE_ID, TradeConfirmChild.YOUR_OFFER);
    const otherOfferUid = widgetUid(TRADE_CONFIRM_INTERFACE_ID, TradeConfirmChild.OTHER_OFFER);
    return [
        {
            scriptId: SCRIPT_INTERFACE_INV_INIT,
            args: [yourOfferUid, TRADE_SELF_OFFER_INV_ID, 7, 4, 0, -1, "", "", "", "", ""],
        },
        {
            scriptId: SCRIPT_INTERFACE_INV_INIT,
            args: [otherOfferUid, TRADE_OTHER_OFFER_INV_ID, 7, 4, 0, -1, "", "", "", "", ""],
        },
    ];
}

/** Run after tradeside (336) mounts so backpack shows Offer ops. */
export function buildTradeSidePostScripts(): Array<{
    scriptId: number;
    args: (string | number)[];
}> {
    const sideUid = widgetUid(TRADE_SIDE_INTERFACE_ID, TradeSideChild.SIDE_LAYER);
    return [
        {
            scriptId: SCRIPT_INTERFACE_INV_INIT,
            args: [
                sideUid,
                PLAYER_INV_ID,
                4,
                7,
                0,
                -1,
                "Offer",
                "Offer-5",
                "Offer-10",
                "Offer-All",
                "Offer-X",
            ],
        },
    ];
}

function initializeTradeSidePanel(service: InterfaceService, player: PlayerState): void {
    const sideUid = widgetUid(TRADE_SIDE_INTERFACE_ID, TradeSideChild.SIDE_LAYER);
    service.openInventorySidePanel(player, {
        interfaceId: TRADE_SIDE_INTERFACE_ID,
        destination: "inventory_tab",
        postScripts: buildTradeSidePostScripts(),
        setFlags: {
            uid: sideUid,
            fromSlot: 0,
            toSlot: 27,
            flags: TRADE_SIDE_INV_FLAGS,
        },
    });
}

function initializeTradeOfferGrids(service: InterfaceService, player: PlayerState): void {
    const yourOfferUid = widgetUid(TRADE_MAIN_INTERFACE_ID, TradeMainChild.YOUR_OFFER);
    const otherOfferUid = widgetUid(TRADE_MAIN_INTERFACE_ID, TradeMainChild.OTHER_OFFER);

    service.setWidgetFlags(player, yourOfferUid, 0, 27, TRADE_OFFER_INV_FLAGS);
    service.setWidgetFlags(player, otherOfferUid, 0, 27, TRADE_OTHER_OFFER_FLAGS);
}

function initializeTradeMain(service: InterfaceService, player: PlayerState, data: TradeOpenData): void {
    const partnerName = data.partnerName?.trim() || "Player";
    service.setWidgetText(
        player,
        widgetUid(TRADE_MAIN_INTERFACE_ID, TradeMainChild.TITLE),
        `Trading with: ${partnerName}`,
    );
    service.setSingleWidgetFlags(
        player,
        widgetUid(TRADE_MAIN_INTERFACE_ID, TradeMainChild.ACCEPT),
        TRADE_BUTTON_FLAGS,
    );
    service.setSingleWidgetFlags(
        player,
        widgetUid(TRADE_MAIN_INTERFACE_ID, TradeMainChild.DECLINE),
        TRADE_BUTTON_FLAGS,
    );
    initializeTradeSidePanel(service, player);
    initializeTradeOfferGrids(service, player);
    service.focusTab(player, GameframeTab.INVENTORY);
}

function initializeTradeConfirm(
    service: InterfaceService,
    player: PlayerState,
    data: TradeOpenData,
): void {
    const partnerName = data.partnerName?.trim() || "Player";
    service.setWidgetText(
        player,
        widgetUid(TRADE_CONFIRM_INTERFACE_ID, TradeConfirmChild.TITLE),
        `Trading with: ${partnerName}`,
    );
    service.setSingleWidgetFlags(
        player,
        widgetUid(TRADE_CONFIRM_INTERFACE_ID, TradeConfirmChild.ACCEPT),
        TRADE_BUTTON_FLAGS,
    );
    service.setSingleWidgetFlags(
        player,
        widgetUid(TRADE_CONFIRM_INTERFACE_ID, TradeConfirmChild.DECLINE),
        TRADE_BUTTON_FLAGS,
    );

    const yourOfferUid = widgetUid(TRADE_CONFIRM_INTERFACE_ID, TradeConfirmChild.YOUR_OFFER);
    const otherOfferUid = widgetUid(TRADE_CONFIRM_INTERFACE_ID, TradeConfirmChild.OTHER_OFFER);
    service.setWidgetFlags(player, yourOfferUid, 0, 27, TRADE_OTHER_OFFER_FLAGS);
    service.setWidgetFlags(player, otherOfferUid, 0, 27, TRADE_OTHER_OFFER_FLAGS);
}

export function registerTradeInterfaceHooks(interfaceService: InterfaceService): void {
    interfaceService.onInterfaceOpen(TRADE_MAIN_INTERFACE_ID, (player, ctx) => {
        const data = ctx.data as TradeOpenData | undefined;
        if (!data?.partnerName) {
            console.warn("[TradeHooks] onOpen: missing partner name");
            return;
        }
        initializeTradeMain(ctx.service, player, data);
    });

    interfaceService.onInterfaceClose(TRADE_MAIN_INTERFACE_ID, (player, ctx) => {
        ctx.service.restoreNormalInventory(player);
    });

    interfaceService.onInterfaceOpen(TRADE_CONFIRM_INTERFACE_ID, (player, ctx) => {
        const data = ctx.data as TradeOpenData | undefined;
        if (!data?.partnerName) {
            console.warn("[TradeHooks] confirm onOpen: missing partner name");
            return;
        }
        initializeTradeConfirm(ctx.service, player, data);
    });

    interfaceService.onInterfaceClose(TRADE_CONFIRM_INTERFACE_ID, (player, ctx) => {
        if (ctx.service.getCurrentModal(player) === TRADE_MAIN_INTERFACE_ID) {
            return;
        }
        ctx.service.restoreNormalInventory(player);
    });
}
