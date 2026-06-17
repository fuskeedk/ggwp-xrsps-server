import { GENERATED_ALL_SHOPS } from "./generatedAllShops";
import { type ShopDefinition } from "./types";

const TEST_WEAPONS_SHOP: ShopDefinition = {
    id: "test_weapons_shop",
    name: "Test Weapons Shop",
    npcIds: [3201],
    currencyItemId: 995,
    capacity: 60,
    generalStore: false,
    restockTicks: 1,
    buyPriceMultiplier: 0,
    sellPriceMultiplier: 0,
    stock: [
        // Melee weapons
        { itemId: 4151, quantity: 100, price: 0 }, // Abyssal whip
        { itemId: 4587, quantity: 100, price: 0 }, // Dragon scimitar
        { itemId: 1305, quantity: 100, price: 0 }, // Dragon longsword
        { itemId: 5698, quantity: 100, price: 0 }, // Dragon dagger (p++)
        { itemId: 11802, quantity: 100, price: 0 }, // Armadyl godsword
        { itemId: 11804, quantity: 100, price: 0 }, // Bandos godsword
        { itemId: 11806, quantity: 100, price: 0 }, // Saradomin godsword
        { itemId: 11808, quantity: 100, price: 0 }, // Zamorak godsword
        { itemId: 13652, quantity: 100, price: 0 }, // Dragon claws
        { itemId: 13576, quantity: 100, price: 0 }, // Dragon warhammer
        { itemId: 21003, quantity: 100, price: 0 }, // Elder maul
        { itemId: 22324, quantity: 100, price: 0 }, // Ghrazi rapier
        { itemId: 24417, quantity: 100, price: 0 }, // Inquisitor's mace
        { itemId: 22325, quantity: 100, price: 0 }, // Scythe of vitur
        { itemId: 25867, quantity: 100, price: 0 }, // Blade of saeldor
        { itemId: 1434, quantity: 100, price: 0 }, // Dragon mace
        { itemId: 4718, quantity: 100, price: 0 }, // Dharok's greataxe
        { itemId: 4726, quantity: 100, price: 0 }, // Guthan's warspear
        { itemId: 4747, quantity: 100, price: 0 }, // Torag's hammers
        { itemId: 4755, quantity: 100, price: 0 }, // Verac's flail
        // Ranged weapons
        { itemId: 11785, quantity: 100, price: 0 }, // Armadyl crossbow
        { itemId: 20997, quantity: 100, price: 0 }, // Twisted bow
        { itemId: 25862, quantity: 100, price: 0 }, // Bow of faerdhinen
        { itemId: 12926, quantity: 100, price: 0 }, // Toxic blowpipe
        { itemId: 861, quantity: 100, price: 0 }, // Magic shortbow
        { itemId: 4212, quantity: 100, price: 0 }, // Crystal bow
        { itemId: 9185, quantity: 100, price: 0 }, // Rune crossbow
        { itemId: 11235, quantity: 100, price: 0 }, // Dark bow
        { itemId: 19481, quantity: 100, price: 0 }, // Heavy ballista
        { itemId: 19478, quantity: 100, price: 0 }, // Light ballista
        // Magic weapons
        { itemId: 11791, quantity: 100, price: 0 }, // Staff of the dead
        { itemId: 11905, quantity: 100, price: 0 }, // Trident of the seas
        { itemId: 12899, quantity: 100, price: 0 }, // Trident of the swamp
        { itemId: 21006, quantity: 100, price: 0 }, // Kodai wand
        { itemId: 24422, quantity: 100, price: 0 }, // Eldritch nightmare staff
        { itemId: 24423, quantity: 100, price: 0 }, // Harmonised nightmare staff
        { itemId: 24424, quantity: 100, price: 0 }, // Volatile nightmare staff
        { itemId: 22647, quantity: 100, price: 0 }, // Sanguinesti staff
        { itemId: 4675, quantity: 100, price: 0 }, // Ancient staff
        { itemId: 6914, quantity: 100, price: 0 }, // Master wand
        // Ammo
        { itemId: 11212, quantity: 10000, price: 0 }, // Dragon arrow
        { itemId: 9244, quantity: 10000, price: 0 }, // Dragon bolts (e)
        { itemId: 892, quantity: 10000, price: 0 }, // Rune arrow
        { itemId: 9245, quantity: 10000, price: 0 }, // Onyx bolts (e)
        { itemId: 21326, quantity: 10000, price: 0 }, // Dragon javelin
    ],
};

const SHOP_DEFINITIONS: ShopDefinition[] = [
    TEST_WEAPONS_SHOP,
    ...GENERATED_ALL_SHOPS,
];

export function getShopDefinitionById(id: string): ShopDefinition | undefined {
    return SHOP_DEFINITIONS.find((shop) => shop.id === id);
}

export function getShopDefinitionByNpcId(npcId: number): ShopDefinition | undefined {
    const normalized = npcId;
    return SHOP_DEFINITIONS.find((shop) => shop.npcIds?.some((id) => id === normalized));
}

export function getAllShopDefinitions(): ShopDefinition[] {
    return SHOP_DEFINITIONS.slice();
}
