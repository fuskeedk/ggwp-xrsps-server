import { SkillId } from "../../../../../src/rs/skill/skills";
import type { ActionEffect, ActionExecutionResult } from "../../../../src/game/actions/types";
import type { PlayerState } from "../../../../src/game/player";
import type {
    IScriptRegistry,
    ScriptActionHandlerContext,
    ScriptServices,
} from "../../../../src/game/scripts/types";
import {
    buildMessageEffect,
    buildSkillFailure,
    clampBatchCount,
    enqueueSkillAction,
    getInventory,
} from "../production/shared";
import {
    consumeRingOfForgingCharge,
    getRingOfForgingCharges,
    getSmeltingXpWithBonuses,
    shouldGuaranteeIronSmelt,
} from "./smithingBonuses";
import {
    SMELTING_RECIPES,
    type SmeltingRecipe,
    calculateIronSmeltChance,
    computeSmeltingBatchCount,
    getSmeltingRecipeById,
} from "./smithingData";

const FURNACE_ANIMATION = 899;

interface SkillSmeltActionData {
    recipeId: string;
    count: number;
}

function buildSmeltInterfaceFailure(
    player: PlayerState,
    message: string,
    reason: string,
    services: ScriptServices,
): ActionExecutionResult {
    const result = buildSkillFailure(player, message, reason);
    services.production?.updateSmeltingInterface(player);
    return result;
}

function firstRemovedSlot(
    removed: Map<number, { itemId: number; quantity: number }>,
): number | undefined {
    for (const [slot] of removed) return slot;
    return undefined;
}

function describeBar(services: ScriptServices, itemId: number): string {
    return services.data.getObjType(itemId)?.name ?? "bar";
}

function rollSmeltingSuccess(
    level: number,
    recipe: SmeltingRecipe,
    equip: number[],
    ringCharges?: number,
): boolean {
    if (shouldGuaranteeIronSmelt(recipe, equip, ringCharges)) return true;
    if (recipe.successType === "iron") {
        const chance = calculateIronSmeltChance(level);
        return Math.random() < chance;
    }
    return true;
}

export function executeSmeltAction(ctx: ScriptActionHandlerContext): ActionExecutionResult {
    const { player, tick, services } = ctx;
    const data = ctx.data as SkillSmeltActionData;
    const recipe = getSmeltingRecipeById(data.recipeId);
    if (!recipe) {
        return buildSmeltInterfaceFailure(
            player,
            "You can't smelt that bar.",
            "unknown_recipe",
            services,
        );
    }

    const skill = services.skills.getSkill(player, SkillId.Smithing);
    if ((skill?.baseLevel ?? 1) < recipe.level) {
        return buildSmeltInterfaceFailure(
            player,
            `You need Smithing level ${recipe.level} to smelt that.`,
            "smelt_level",
            services,
        );
    }

    const removal = services.production?.takeInventoryItems(
        player,
        recipe.inputs as Array<{ itemId: number; quantity: number }>,
    );
    if (!removal?.ok) {
        return buildSmeltInterfaceFailure(
            player,
            "You need the right ores to smelt that.",
            "missing_ore",
            services,
        );
    }

    const targetCount = Math.max(1, data.count);
    const delay = recipe.delayTicks !== undefined ? Math.max(1, recipe.delayTicks) : 4;
    const effects: ActionEffect[] = [];

    const equip = services.equipment.getEquipArray(player) ?? [];
    const ringCharges = recipe.successType === "iron" ? getRingOfForgingCharges(player) : undefined;
    const success = rollSmeltingSuccess(skill?.baseLevel ?? 1, recipe, equip, ringCharges);

    if (success) {
        const fSlot = firstRemovedSlot(removal.removed);
        if (fSlot !== undefined) {
            services.inventory.setInventorySlot(
                player,
                fSlot,
                recipe.outputItemId,
                Math.max(1, recipe.outputQuantity),
            );
        } else {
            const dest = services.inventory.addItemToInventory(
                player,
                recipe.outputItemId,
                Math.max(1, recipe.outputQuantity),
            );
            if (dest.added <= 0) {
                services.production?.restoreInventoryRemovals(player, removal.removed);
                return buildSmeltInterfaceFailure(
                    player,
                    "You need more inventory space for the bar.",
                    "inventory_full",
                    services,
                );
            }
        }

        services.animation.playPlayerSeq(player, recipe.animation ?? FURNACE_ANIMATION);
        const xpAward = getSmeltingXpWithBonuses(recipe, equip);
        services.skills.addSkillXp(player, SkillId.Smithing, xpAward);
        services.system.eventBus?.emit("item:craft", {
            playerId: player.id,
            itemId: recipe.outputItemId,
            count: Math.max(1, recipe.outputQuantity),
        });
        const barName = describeBar(services, recipe.outputItemId);
        effects.push(
            { type: "inventorySnapshot", playerId: player.id },
            buildMessageEffect(player, `You retrieve a ${barName.toLowerCase()}.`),
        );
        if (recipe.successType === "iron") {
            consumeRingOfForgingCharge(player, services);
        }
    } else {
        effects.push(
            buildMessageEffect(player, "The iron ore is too impure and you fail to produce a bar."),
        );
    }

    const remaining = Math.max(0, targetCount - 1);
    if (remaining > 0) {
        const reschedule = services.combat.scheduleAction(
            player.id,
            {
                kind: "skill.smelt",
                data: { recipeId: recipe.id, count: remaining },
                delayTicks: delay,
                cooldownTicks: delay,
                groups: ["skill.smelt"],
            },
            tick,
        );
        if (!reschedule?.ok) {
            effects.push(buildMessageEffect(player, "You stop smelting."));
        }
    }

    services.production?.updateSmeltingInterface(player);
    return { ok: true, cooldownTicks: delay, groups: ["skill.smelt"], effects };
}

export function openSmeltingSkillMulti(player: PlayerState, services: ScriptServices, tick?: number): void {
    const smithLevel = services.skills.getSkill(player, SkillId.Smithing)?.baseLevel ?? 1;
    const inventory = getInventory(services, player);
    const craftableRecipes = SMELTING_RECIPES.filter((recipe) => {
        const available = clampBatchCount(computeSmeltingBatchCount(inventory, recipe));
        return available > 0 && smithLevel >= recipe.level;
    });

    if (craftableRecipes.length === 0) {
        const hasAnyOre = SMELTING_RECIPES.some(
            (recipe) => clampBatchCount(computeSmeltingBatchCount(inventory, recipe)) > 0,
        );
        if (!hasAnyOre) {
            services.messaging.sendGameMessage(player, "You need ores to smelt any bars.");
            return;
        }
        services.messaging.sendGameMessage(
            player,
            "You need a higher Smithing level or more ores to smelt bars.",
        );
        return;
    }

    const trySmelt = (
        recipe: SmeltingRecipe,
        desiredCount?: number,
    ) => {
        const requestAction = services.combat.requestAction;
        const smithLvl = services.skills.getSkill(player, SkillId.Smithing)?.baseLevel ?? 1;
        if (smithLvl < recipe.level) {
            services.messaging.sendGameMessage(
                player,
                `You need Smithing level ${recipe.level} to smelt that.`,
            );
            return;
        }
        const inventoryNow = getInventory(services, player);
        const batch = clampBatchCount(computeSmeltingBatchCount(inventoryNow, recipe));
        if (batch <= 0) {
            services.messaging.sendGameMessage(
                player,
                "You need the proper ores to smelt that bar.",
            );
            return;
        }
        const desired = Math.max(1, Math.min(batch, desiredCount ?? batch));
        if (services.production?.smeltBars) {
            services.production.smeltBars(player, { recipeId: recipe.id, count: desired });
            return;
        }
        enqueueSkillAction(
            requestAction,
            "smelt",
            player,
            recipe.id,
            desired,
            recipe.delayTicks ?? 4,
            tick,
            services.messaging.sendGameMessage,
        );
    };

    if (!services.dialog.openSkillMulti) {
        trySmelt(craftableRecipes[0]!);
        return;
    }

    const maxQuantity = Math.max(
        ...craftableRecipes.map((recipe) =>
            clampBatchCount(computeSmeltingBatchCount(inventory, recipe)),
        ),
    );
    services.dialog.openSkillMulti(player, {
        id: `smelt_skillmulti_${player.id}`,
        title: "What would you like to make?",
        products: craftableRecipes.map((recipe) => ({
            itemId: recipe.outputItemId,
            label: recipe.name,
            maxQuantity: clampBatchCount(computeSmeltingBatchCount(inventory, recipe)),
        })),
        maxQuantity,
        defaultQuantity: 1,
        onSelect: (index, quantity) => {
            const recipe = craftableRecipes[index];
            if (!recipe) {
                services.messaging.sendGameMessage(player, "You decide not to smelt anything.");
                return;
            }
            trySmelt(recipe, Math.max(1, quantity | 0));
        },
    });
}

export function registerSmeltingInteractions(registry: IScriptRegistry, services: ScriptServices) {
    registry.registerLocAction("smelt", (event) => {
        openSmeltingSkillMulti(event.player, services, event.tick);
    });
}
