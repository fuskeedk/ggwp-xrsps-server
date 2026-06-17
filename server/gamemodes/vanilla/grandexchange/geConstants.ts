/** Grand Exchange main interface (RuneLite InterfaceID.GE_OFFERS). */
export const GE_OFFERS_INTERFACE_ID = 465;

/** Grand Exchange inventory side panel (RuneLite InterfaceID.GE_OFFERS_SIDE). */
export const GE_OFFERS_SIDE_INTERFACE_ID = 467;

/** Grand Exchange collection box (RuneLite InterfaceID.GE_COLLECT). */
export const GE_COLLECT_INTERFACE_ID = 402;

/** clientscript,ge_offers_init */
export const SCRIPT_GE_OFFERS_INIT = 803;

/** clientscript,ge_collect_init */
export const SCRIPT_GE_COLLECT_INIT = 788;

/** GE clerk NPC type ids (Grand Exchange Clerks). */
export const GE_CLERK_NPC_IDS = [2148, 2149, 2150, 2151] as const;

export const GE_SLOT_COUNT = 8;
export const GE_TAX_RATE = 0.01;
export const COINS_ITEM_ID = 995;

/** Pause-button flag for GE slot / action widgets. */
export const GE_BUTTON_FLAGS = 1;

/**
 * Offer slot buttons within interface 465.
 * Mapped from cache CS2 init order (revision 237).
 */
export const GE_SLOT_COMPONENTS = [7, 8, 9, 10, 11, 12, 13, 14] as const;

/** Collect-all button on the offers screen. */
export const GE_COLLECT_ALL_COMPONENT = 6;

/** Setup-offer confirm button (unused until full setup UI is wired). */
export const GE_SETUP_CONFIRM_COMPONENT = 24;

export function geWidgetUid(component: number): number {
    return (GE_OFFERS_INTERFACE_ID << 16) | (component & 0xffff);
}
