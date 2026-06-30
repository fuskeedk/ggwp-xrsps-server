/**
 * Barrows equipment item families and degradation chains.
 *
 * Each piece: full (chest) -> 100 -> 75 -> 50 -> 25 -> 0
 */
import { EquipmentSlot } from "../../../../src/rs/config/player/Equipment";

export type BarrowsSetKey = "ahrim" | "dharok" | "guthan" | "karil" | "torag" | "verac";

export interface BarrowsPieceChain {
    set: BarrowsSetKey;
    slot: EquipmentSlot;
    /** Ordered from full/new to broken (0). */
    itemIds: readonly number[];
}

/** Combat ticks of exposure required per degradation step (15 hours total / 5 steps). */
export const BARROWS_TICKS_PER_LEVEL = 18_000;

/** Combat ticks added per damaging hit (weapon dealt / armour received). */
export const BARROWS_TICKS_PER_HIT = 100;

const CHAINS: BarrowsPieceChain[] = [
    { set: "ahrim", slot: EquipmentSlot.HEAD, itemIds: [4708, 4856, 4857, 4858, 4859, 4860] },
    { set: "ahrim", slot: EquipmentSlot.WEAPON, itemIds: [4710, 4862, 4863, 4864, 4865, 4866] },
    { set: "ahrim", slot: EquipmentSlot.BODY, itemIds: [4712, 4868, 4869, 4870, 4871, 4872] },
    { set: "ahrim", slot: EquipmentSlot.LEGS, itemIds: [4714, 4874, 4875, 4876, 4877, 4878] },
    { set: "dharok", slot: EquipmentSlot.HEAD, itemIds: [4716, 4880, 4881, 4882, 4883, 4884] },
    { set: "dharok", slot: EquipmentSlot.WEAPON, itemIds: [4718, 4886, 4887, 4888, 4889, 4890] },
    { set: "dharok", slot: EquipmentSlot.BODY, itemIds: [4720, 4892, 4893, 4894, 4895, 4896] },
    { set: "dharok", slot: EquipmentSlot.LEGS, itemIds: [4722, 4898, 4899, 4900, 4901, 4902] },
    { set: "guthan", slot: EquipmentSlot.HEAD, itemIds: [4724, 4904, 4905, 4906, 4907, 4908] },
    { set: "guthan", slot: EquipmentSlot.WEAPON, itemIds: [4726, 4910, 4911, 4912, 4913, 4914] },
    { set: "guthan", slot: EquipmentSlot.BODY, itemIds: [4728, 4916, 4917, 4918, 4919, 4920] },
    { set: "guthan", slot: EquipmentSlot.LEGS, itemIds: [4730, 4922, 4923, 4924, 4925, 4926] },
    { set: "karil", slot: EquipmentSlot.HEAD, itemIds: [4732, 4928, 4929, 4930, 4931, 4932] },
    { set: "karil", slot: EquipmentSlot.WEAPON, itemIds: [4734, 4934, 4935, 4936, 4937, 4938] },
    { set: "karil", slot: EquipmentSlot.BODY, itemIds: [4736, 4940, 4941, 4942, 4943, 4944] },
    { set: "karil", slot: EquipmentSlot.LEGS, itemIds: [4738, 4946, 4947, 4948, 4949, 4950] },
    { set: "torag", slot: EquipmentSlot.HEAD, itemIds: [4745, 4952, 4953, 4954, 4955, 4956] },
    { set: "torag", slot: EquipmentSlot.WEAPON, itemIds: [4747, 4958, 4959, 4960, 4961, 4962] },
    { set: "torag", slot: EquipmentSlot.BODY, itemIds: [4749, 4964, 4965, 4966, 4967, 4968] },
    { set: "torag", slot: EquipmentSlot.LEGS, itemIds: [4751, 4970, 4971, 4972, 4973, 4974] },
    { set: "verac", slot: EquipmentSlot.HEAD, itemIds: [4753, 4976, 4977, 4978, 4979, 4980] },
    { set: "verac", slot: EquipmentSlot.WEAPON, itemIds: [4755, 4982, 4983, 4984, 4985, 4986] },
    { set: "verac", slot: EquipmentSlot.BODY, itemIds: [4757, 4988, 4989, 4990, 4991, 4992] },
    { set: "verac", slot: EquipmentSlot.LEGS, itemIds: [4759, 4994, 4995, 4996, 4997, 4998] },
];

const ITEM_TO_CHAIN = new Map<number, BarrowsPieceChain>();

for (const chain of CHAINS) {
    for (const itemId of chain.itemIds) {
        ITEM_TO_CHAIN.set(itemId, chain);
    }
}

const SET_SLOTS: Record<BarrowsSetKey, EquipmentSlot[]> = {
    ahrim: [EquipmentSlot.HEAD, EquipmentSlot.BODY, EquipmentSlot.LEGS, EquipmentSlot.WEAPON],
    dharok: [EquipmentSlot.HEAD, EquipmentSlot.BODY, EquipmentSlot.LEGS, EquipmentSlot.WEAPON],
    guthan: [EquipmentSlot.HEAD, EquipmentSlot.BODY, EquipmentSlot.LEGS, EquipmentSlot.WEAPON],
    karil: [EquipmentSlot.HEAD, EquipmentSlot.BODY, EquipmentSlot.LEGS, EquipmentSlot.WEAPON],
    torag: [EquipmentSlot.HEAD, EquipmentSlot.BODY, EquipmentSlot.LEGS, EquipmentSlot.WEAPON],
    verac: [EquipmentSlot.HEAD, EquipmentSlot.BODY, EquipmentSlot.LEGS, EquipmentSlot.WEAPON],
};

export function getBarrowsPieceChain(itemId: number): BarrowsPieceChain | undefined {
    return ITEM_TO_CHAIN.get(itemId);
}

export function isBarrowsItem(itemId: number): boolean {
    return ITEM_TO_CHAIN.has(itemId);
}

export function isBarrowsSetPiece(itemId: number, set: BarrowsSetKey, slot: EquipmentSlot): boolean {
    const chain = ITEM_TO_CHAIN.get(itemId);
    return chain?.set === set && chain.slot === slot;
}

export function hasBarrowsSet(equipment: number[], set: BarrowsSetKey): boolean {
    for (const slot of SET_SLOTS[set]) {
        const itemId = equipment[slot];
        if (!(itemId > 0) || !isBarrowsSetPiece(itemId, set, slot)) {
            return false;
        }
        const chain = ITEM_TO_CHAIN.get(itemId);
        if (!chain) return false;
        const level = chain.itemIds.indexOf(itemId);
        if (level < 0 || level >= chain.itemIds.length - 1) {
            return false;
        }
    }
    return true;
}

export function getBarrowsDegradeLevel(itemId: number): number {
    const chain = ITEM_TO_CHAIN.get(itemId);
    if (!chain) return -1;
    return chain.itemIds.indexOf(itemId);
}

export function getNextBarrowsItemId(itemId: number): number | undefined {
    const chain = ITEM_TO_CHAIN.get(itemId);
    if (!chain) return undefined;
    const level = chain.itemIds.indexOf(itemId);
    if (level < 0 || level >= chain.itemIds.length - 1) return undefined;
    return chain.itemIds[level + 1];
}

export const BARROWS_ARMOR_SLOTS = [EquipmentSlot.HEAD, EquipmentSlot.BODY, EquipmentSlot.LEGS] as const;

export const BARROWS_WEAPON_SLOT = EquipmentSlot.WEAPON;
