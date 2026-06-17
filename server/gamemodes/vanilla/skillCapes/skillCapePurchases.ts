import { MAX_REAL_LEVEL } from "../../../../src/rs/skill/skills";
import type { PlayerState } from "../../../src/game/player";
import type { ScriptServices } from "../../../src/game/scripts/types";
import {
    COINS_ITEM_ID,
    SKILL_CAPE_PRICE,
    type SkillCapeDefinition,
} from "./skillCapes";

export const SKILL_CAPE_MENU_OPTION = "What is that cape you're wearing?";

export enum SkillCapePurchaseResult {
    Success = "success",
    NotMaxed = "not_maxed",
    NotEnoughCoins = "not_enough_coins",
    NotEnoughSpace = "not_enough_space",
}

type TutorDialogContext = {
    player: PlayerState;
    services: ScriptServices;
    base: string;
    npcName: string;
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
        if (!entry || entry.itemId !== COINS_ITEM_ID || entry.quantity <= 0) {
            continue;
        }
        const take = Math.min(entry.quantity, remaining);
        const nextQty = entry.quantity - take;
        if (nextQty > 0) {
            player.items.setInventorySlot(slot, COINS_ITEM_ID, nextQty);
        } else {
            player.items.setInventorySlot(slot, 0, 0);
        }
        remaining -= take;
        if (remaining <= 0) {
            return true;
        }
    }
    return false;
}

function freeInventorySlots(player: PlayerState): number {
    let free = 0;
    for (const entry of player.items.getInventoryEntries()) {
        if (!entry || entry.itemId <= 0 || entry.quantity <= 0) {
            free++;
        }
    }
    return free;
}

export function ownsSkillCape(
    player: PlayerState,
    services: ScriptServices,
    cape: SkillCapeDefinition,
): boolean {
    const ids = new Set([cape.capeId, cape.trimmedCapeId, cape.hoodId]);
    for (const entry of player.items.getInventoryEntries()) {
        if (entry && ids.has(entry.itemId)) {
            return true;
        }
    }
    for (const itemId of services.equipment.getEquipArray(player)) {
        if (itemId > 0 && ids.has(itemId)) {
            return true;
        }
    }
    return false;
}

export function listMaxedSkillCapes(
    player: PlayerState,
    services: ScriptServices,
    capes: readonly SkillCapeDefinition[],
): SkillCapeDefinition[] {
    return capes.filter((cape) => {
        const skill = services.skills.getSkill(player, cape.skillId);
        return skill.baseLevel >= MAX_REAL_LEVEL;
    });
}

function eligibleForTrimmed(
    player: PlayerState,
    services: ScriptServices,
    capes: readonly SkillCapeDefinition[],
): boolean {
    return listMaxedSkillCapes(player, services, capes).length >= 2;
}

export function purchaseSkillCape(
    player: PlayerState,
    services: ScriptServices,
    cape: SkillCapeDefinition,
    allCapes: readonly SkillCapeDefinition[],
): SkillCapePurchaseResult {
    const skill = services.skills.getSkill(player, cape.skillId);
    if (skill.baseLevel < MAX_REAL_LEVEL) {
        return SkillCapePurchaseResult.NotMaxed;
    }

    if (ownsSkillCape(player, services, cape)) {
        if (freeInventorySlots(player) < 1) {
            return SkillCapePurchaseResult.NotEnoughSpace;
        }
        const hood = services.inventory.addItemToInventory(player, cape.hoodId, 1);
        if (!hood.added || hood.added <= 0) {
            return SkillCapePurchaseResult.NotEnoughSpace;
        }
        services.inventory.snapshotInventory(player);
        return SkillCapePurchaseResult.Success;
    }

    if (countCoins(player) < SKILL_CAPE_PRICE) {
        return SkillCapePurchaseResult.NotEnoughCoins;
    }
    if (freeInventorySlots(player) < 2) {
        return SkillCapePurchaseResult.NotEnoughSpace;
    }
    if (!removeCoins(player, SKILL_CAPE_PRICE)) {
        return SkillCapePurchaseResult.NotEnoughCoins;
    }

    const trimmed = eligibleForTrimmed(player, services, allCapes);
    const capeItemId = trimmed ? cape.trimmedCapeId : cape.capeId;
    const capeAdd = services.inventory.addItemToInventory(player, capeItemId, 1);
    const hoodAdd = services.inventory.addItemToInventory(player, cape.hoodId, 1);
    if (!capeAdd.added || !hoodAdd.added) {
        return SkillCapePurchaseResult.NotEnoughSpace;
    }
    services.inventory.snapshotInventory(player);
    return SkillCapePurchaseResult.Success;
}

export function purchaseSkillCapeMessage(
    result: SkillCapePurchaseResult,
    cape: SkillCapeDefinition,
): string {
    switch (result) {
        case SkillCapePurchaseResult.Success:
            return `You purchase a ${cape.displayName} skillcape and hood for 99,000 coins.`;
        case SkillCapePurchaseResult.NotMaxed:
            return `You need level 99 ${cape.displayName} before you can buy a skillcape.`;
        case SkillCapePurchaseResult.NotEnoughCoins:
            return "You do not have enough coins. A skillcape costs 99,000 gp.";
        case SkillCapePurchaseResult.NotEnoughSpace:
            return "Skillcapes come with a free hood — you need 2 free inventory slots.";
    }
}

function openNpcDialog(
    ctx: TutorDialogContext,
    dialogId: string,
    lines: string[],
    onContinue?: () => void,
): void {
    ctx.services.dialog.openDialog(ctx.player, {
        kind: "npc",
        id: dialogId,
        npcId: undefined,
        npcName: ctx.npcName,
        lines,
        clickToContinue: true,
        closeOnContinue: !onContinue,
        onContinue,
        onClose: () => ctx.services.dialog.closeDialog(ctx.player, dialogId),
    });
}

function openPlayerDialog(
    ctx: TutorDialogContext,
    dialogId: string,
    lines: string[],
    onContinue?: () => void,
): void {
    ctx.services.dialog.openDialog(ctx.player, {
        kind: "player",
        id: dialogId,
        playerName: ctx.player.name ?? "You",
        lines,
        clickToContinue: true,
        closeOnContinue: !onContinue,
        onContinue,
        onClose: () => ctx.services.dialog.closeDialog(ctx.player, dialogId),
    });
}

function openOptions(
    ctx: TutorDialogContext,
    dialogId: string,
    options: string[],
    onSelect: (choice: number) => void,
): void {
    ctx.services.dialog.openDialogOptions(ctx.player, {
        id: dialogId,
        title: "Select an Option",
        options,
        onSelect,
    });
}

export function withSkillCapeMenuOption(options: string[]): string[] {
    if (options.some((option) => option === SKILL_CAPE_MENU_OPTION)) {
        return options;
    }
    const withoutGoodbye = options.filter((option) => option.toLowerCase() !== "goodbye.");
    const hadGoodbye = withoutGoodbye.length !== options.length;
    const next = [...withoutGoodbye, SKILL_CAPE_MENU_OPTION];
    if (hadGoodbye) {
        next.push("Goodbye.");
    }
    return next;
}

export function isSkillCapeMenuSelection(options: string[], choice: number): boolean {
    return options[choice] === SKILL_CAPE_MENU_OPTION;
}

export function startSkillCapeExplanation(
    ctx: TutorDialogContext,
    cape: SkillCapeDefinition,
    explanation: string,
    onDone?: () => void,
): void {
    openPlayerDialog(ctx, `${ctx.base}_cape_player`, [SKILL_CAPE_MENU_OPTION], () => {
        openNpcDialog(ctx, `${ctx.base}_cape_explain`, [explanation], () => {
            const skill = ctx.services.skills.getSkill(ctx.player, cape.skillId);
            if (skill.baseLevel < MAX_REAL_LEVEL) {
                onDone?.();
                return;
            }
            offerSkillCapePurchase(ctx, cape, onDone);
        });
    });
}

export function offerSkillCapePurchase(
    ctx: TutorDialogContext,
    cape: SkillCapeDefinition,
    onDone?: () => void,
): void {
    if (ownsSkillCape(ctx.player, ctx.services, cape)) {
        openOptions(ctx, `${ctx.base}_hood_menu`, ["Can I have another hood?", "No thanks."], (choice) => {
            if (choice === 0) {
                openPlayerDialog(ctx, `${ctx.base}_hood_player`, ["Can I have another hood, please?"], () => {
                    const result = purchaseSkillCape(ctx.player, ctx.services, cape, [cape]);
                    if (result === SkillCapePurchaseResult.Success) {
                        openNpcDialog(ctx, `${ctx.base}_hood_ok`, [
                            `${ctx.npcName} hands you another hood for your skillcape.`,
                        ], onDone);
                        return;
                    }
                    openNpcDialog(
                        ctx,
                        `${ctx.base}_hood_fail`,
                        ["You'll need a free inventory slot before I can hand you the hood."],
                        onDone,
                    );
                });
                return;
            }
            openPlayerDialog(ctx, `${ctx.base}_hood_no`, ["No thanks."], onDone);
        });
        return;
    }

    openPlayerDialog(ctx, `${ctx.base}_buy_player`, [`Can I buy a ${cape.displayName} skillcape?`], () => {
        openNpcDialog(
            ctx,
            `${ctx.base}_buy_price`,
            [
                `A ${cape.displayName} skillcape costs 99,000 coins and comes with a free hood.`,
            ],
            () => {
                openOptions(ctx, `${ctx.base}_buy_confirm`, ["That's too expensive.", "Yes please."], (choice) => {
                    if (choice === 0) {
                        openPlayerDialog(ctx, `${ctx.base}_buy_expensive`, ["That's too expensive."], () => {
                            openNpcDialog(ctx, `${ctx.base}_buy_later`, ["Come back when you've saved up."], onDone);
                        });
                        return;
                    }
                    const result = purchaseSkillCape(ctx.player, ctx.services, cape, [cape]);
                    if (result === SkillCapePurchaseResult.Success) {
                        openNpcDialog(ctx, `${ctx.base}_buy_ok`, [
                            `Enjoy your ${cape.displayName} skillcape!`,
                        ], onDone);
                        return;
                    }
                    if (result === SkillCapePurchaseResult.NotEnoughCoins) {
                        openPlayerDialog(ctx, `${ctx.base}_buy_nocoins`, ["I don't have enough coins with me."], () => {
                            openNpcDialog(ctx, `${ctx.base}_buy_nocoins_npc`, ["Come back when you do."], onDone);
                        });
                        return;
                    }
                    openNpcDialog(
                        ctx,
                        `${ctx.base}_buy_nospace`,
                        ["Skillcapes come with a free hood, so you'll need 2 free inventory spaces."],
                        onDone,
                    );
                });
            },
        );
    });
}
