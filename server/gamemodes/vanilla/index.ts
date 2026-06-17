import { createDefaultAmmoDataProvider } from "../../src/game/combat/AmmoSystem";
import type { NpcLootConfig } from "../../src/game/combat/DamageTracker";
import { getWeaponDataProvider } from "../../src/game/combat/WeaponDataProvider";
import { BaseGamemode } from "../../src/game/gamemodes/BaseGamemode";
import type {
    GamemodeDefinition,
    GamemodeInitContext,
    GamemodeQuestListGroup,
    GamemodeServerServices,
    GamemodeUiBridge,
    GamemodeUiController,
} from "../../src/game/gamemodes/GamemodeDefinition";
import { PlayerType } from "../../../src/rs/chat/PlayerType";
import type { PlayerState } from "../../src/game/player";
import {
    getProviderRegistry,
    resetProviderRegistry,
} from "../../src/game/providers/ProviderRegistry";
import type { IScriptRegistry, ScriptServices } from "../../src/game/scripts/types";
import { encodeMessage } from "../../src/network/messages";
import { VanillaUiController } from "./VanillaUiController";
import { BankingManager, registerBankInterfaceHooks, registerBankingHandlers } from "./banking";
import type { BankingProviderServices } from "./banking/BankingProvider";
import "./combat/BossCombatScript";
import { createCombatFormulaProvider } from "./combat/CombatFormulas";
import { createCombatStyleSequenceProvider } from "./combat/CombatStyleSequences";
import { createEquipmentBonusProvider } from "./combat/EquipmentBonuses";
import { createInstantUtilitySpecialProvider } from "./combat/RockKnockerSpecial";
import { createSkillConfiguration } from "./combat/SkillConfiguration";
import { createSpecialAttackProvider } from "./combat/SpecialAttackRegistry";
import { createSpecialAttackVisualProvider } from "./combat/SpecialAttackVisuals";
import { createSpellXpProvider } from "./combat/SpellXpData";
import { registerVanillaGroundItemSpawns } from "./data/groundItemSpawns";
import { DEFAULT_LOGIN_VARBITS } from "./data/loginVarbits";
import { DEFAULT_LOGIN_VARPS } from "./data/loginVarps";
import { NPC_LOOT_CONFIGS } from "./data/lootDistribution";
import { createProjectileParamsProvider } from "./data/projectileParams";
import { createRuneDataProvider } from "./data/runes";
import { createSpellDataProvider } from "./data/spells";
import { createWeaponDataProvider } from "./data/weapons";
import { registerEquipmentStatsInterfaceHooks } from "./equipment/EquipmentStatsInterfaceHooks";
import { registerEquipmentHandlers } from "./equipment/equipment";
import { registerEquipmentWidgetHandlers } from "./equipment/equipmentWidgets";
import { computeTargetBonusPercentages } from "./equipment/targetBonuses";
import { registerSmithingBarModalHandler } from "./modals/smithingBarModalHandler";
import { registerWidgetCloseHandlers } from "./modals/widgetCloseHandlers";
import { registerWidgetOpenHandlers } from "./modals/widgetOpenHandlers";
import { registerQuestHandlers } from "./quests";
import { registerSkillMasterHandlers } from "./skillCapes/skillMasters";
import { importQuestFlags, exportQuestFlags } from "./quests/QuestFlags";
import {
    exportOsrsQuestPackagePlayerState,
    importOsrsQuestPackagePlayerState,
} from "./quests/osrsQuestBridge";
import { registerLumbridgeNpcHandlers } from "./scripts/content/lumbridgeNpcs";
import { registerAlKharidBorderHandlers } from "./scripts/content/alKharidBorder";
import { registerBobHandlers } from "./scripts/content/bob";
import { registerClimbingHandlers } from "./scripts/content/climbing";
import { registerAccountTutorHandlers } from "./scripts/content/accountTutors";
import { registerDefaultTalkHandlers } from "./scripts/content/defaultTalk";
import { getAccountTypePlayerTypes } from "./account/accountType";
import { registerDemoInteractionHandlers } from "./scripts/content/demoInteractions";
import { registerDoorHandlers } from "./scripts/content/doors";
import { registerPohPoolHandlers } from "./scripts/content/pohPools";
import { registerRomeoHandlers } from "./scripts/content/romeo";
import { registerWildernessAccessHandlers } from "./scripts/content/wildernessAccess";
import { registerFollowerItemHandlers } from "./scripts/items/followers";
import { registerPacksHandlers } from "./scripts/items/packs";
import { handleDismiss, handleResumePauseButton, registerLevelUpHandlers } from "./scripts/levelup";
import {
    GrandExchangeService,
    registerGrandExchangeHandlers,
    registerGrandExchangeInterfaceHooks,
} from "./grandexchange";
import { registerShopInterfaceHooks } from "./shops";
import { registerTradeInterfaceHooks } from "./trade/TradeInterfaceHooks";
import { ShopService } from "./shops/ShopService";
import { registerShopInteractionHandlers } from "./shops/shopInteractions";
import { registerShopWidgetHandlers } from "./shops/shopWidgets";
import { registerZaffHandlers } from "./shops/zaff";
import { register as registerSkillHandlers } from "./skills";
import { handleSailingPlayerRestore } from "./skills/sailing";
import { registerAccountSummaryWidgetHandlers } from "./widgets/accountSummaryWidgets";
import { registerCollectionLogWidgetHandlers } from "./widgets/collectionLogWidgets";
import { registerCombatWidgetHandlers } from "./widgets/combatWidgets";
import { registerDiaryJournalWidgetHandlers } from "./widgets/diaryJournalWidgets";
import { registerEmoteWidgetHandlers } from "./widgets/emoteWidgets";
import { registerMinimapWidgetHandlers } from "./widgets/minimapWidgets";
import { registerMusicWidgetHandlers } from "./widgets/musicWidgets";
import { registerPrayerWidgetHandlers } from "./widgets/prayerWidgets";
import { buildVanillaQuestListGroups } from "./widgets/buildQuestListGroups";
import { registerQuestJournalWidgetHandlers } from "./widgets/questJournalWidgets";
import { registerSettingsWidgetHandlers } from "./widgets/settingsWidgets";
import { registerSkillGuideWidgetHandlers } from "./widgets/skillGuideWidgets";
import { registerSpellbookWidgetHandlers } from "./widgets/spellbookWidgets";

export class VanillaGamemode extends BaseGamemode {
    override readonly id: string = "vanilla";
    override readonly name: string = "Vanilla";

    private bankingManager: BankingManager | undefined;
    private shopService: ShopService | undefined;
    private geService: GrandExchangeService | undefined;
    private serverServices: GamemodeServerServices | undefined;
    private scriptServices: ScriptServices | undefined;

    getLootDistributionConfig(npcTypeId: number): NpcLootConfig | undefined {
        return NPC_LOOT_CONFIGS.get(npcTypeId);
    }

    getLoginVarbits(_player: PlayerState): Array<[number, number]> {
        return DEFAULT_LOGIN_VARBITS;
    }

    getLoginVarps(_player: PlayerState): Array<[number, number]> {
        return DEFAULT_LOGIN_VARPS;
    }

    onPlayerRestore(player: PlayerState): void {
        const services = this.scriptServices;
        if (!services) return;

        handleSailingPlayerRestore(player, services);
    }

    getGamemodeServices(): Record<string, unknown> {
        return {
            banking: this.bankingManager,
            weaponDataProvider: getWeaponDataProvider(),
        };
    }

    override createUiController(bridge: GamemodeUiBridge): GamemodeUiController {
        return new VanillaUiController(bridge, (player) => this.getQuestListGroups(player));
    }

    override getQuestListGroups(_player: PlayerState): readonly GamemodeQuestListGroup[] {
        return buildVanillaQuestListGroups();
    }

    override getPlayerTypes(player: PlayerState, isAdmin: boolean): PlayerType[] {
        const types: PlayerType[] = [];
        if (isAdmin) {
            types.push(PlayerType.JagexModerator);
        }
        types.push(...getAccountTypePlayerTypes(player));
        if (types.length === 0) {
            types.push(PlayerType.Normal);
        }
        return types;
    }

    override serializePlayerState(player: PlayerState): Record<string, unknown> | undefined {
        const questFlags = exportQuestFlags(player);
        const osrsQuestPackageState = exportOsrsQuestPackagePlayerState(player);
        if (!questFlags && !osrsQuestPackageState) return undefined;
        return { questFlags, osrsQuestPackageState };
    }

    override deserializePlayerState(player: PlayerState, data: Record<string, unknown>): void {
        const questFlags = data.questFlags;
        if (questFlags && typeof questFlags === "object") {
            importQuestFlags(player, questFlags as Record<string, boolean | string>);
        } else {
            importQuestFlags(player, undefined);
        }

        const osrsQuestPackageState = data.osrsQuestPackageState;
        if (osrsQuestPackageState && typeof osrsQuestPackageState === "object") {
            importOsrsQuestPackagePlayerState(
                player,
                osrsQuestPackageState as ReturnType<typeof exportOsrsQuestPackagePlayerState>,
            );
        } else {
            importOsrsQuestPackagePlayerState(player, undefined);
        }
    }

    private registerProviders(): void {
        const registry = getProviderRegistry();
        registry.spellXp = createSpellXpProvider();
        registry.specialAttackVisual = createSpecialAttackVisualProvider();
        registry.instantUtilitySpecial = createInstantUtilitySpecialProvider();
        registry.weaponData = createWeaponDataProvider();
        registry.specialAttack = createSpecialAttackProvider();
        registry.combatFormula = createCombatFormulaProvider();
        registry.combatStyleSequence = createCombatStyleSequenceProvider();
        registry.skillConfiguration = createSkillConfiguration();
        registry.equipmentBonus = createEquipmentBonusProvider();
        registry.projectileParams = createProjectileParamsProvider();
        registry.spellData = createSpellDataProvider();
        registry.runeData = createRuneDataProvider();
        registry.ammoData = createDefaultAmmoDataProvider();
    }

    contributeScriptServices(services: ScriptServices): void {
        this.scriptServices = services;
        const ss = this.serverServices;

        // Banking services
        const bm = this.bankingManager;
        if (bm) {
            services.banking = {
                openBank: (player, opts) => bm.openBank(player, opts),
                depositInventoryToBank: (player, tab) => bm.depositInventory(player, tab),
                depositEquipmentToBank: (player, tab) => bm.depositEquipment(player, tab),
                depositEquipmentSlotToBank: (player, slot, tab) =>
                    bm.depositEquipmentSlot(player, slot, tab),
                removeEquipmentSlot: (player, slot) => bm.removeEquipmentSlot(player, slot),
                depositInventoryItemToBank: (player, slot, quantity, opts) => {
                    const slotIndex = Math.trunc(slot);
                    const amount = Math.trunc(quantity);
                    const itemIdHintRaw = opts?.itemIdHint;
                    const tabRaw = opts?.tab;
                    return bm.depositItem(
                        player,
                        slotIndex,
                        amount,
                        itemIdHintRaw !== undefined && Number.isFinite(itemIdHintRaw)
                            ? Math.trunc(itemIdHintRaw)
                            : undefined,
                        tabRaw !== undefined && Number.isFinite(tabRaw)
                            ? Math.trunc(tabRaw)
                            : undefined,
                    );
                },
                depositAllMatchingInventoryItems: (player, itemId, opts) => {
                    const itemIdHintRaw = opts?.itemIdHint;
                    const tabRaw = opts?.tab;
                    return bm.depositAllMatchingInventoryItems(player, Math.trunc(itemId), {
                        itemIdHint:
                            itemIdHintRaw !== undefined && Number.isFinite(itemIdHintRaw)
                                ? Math.trunc(itemIdHintRaw)
                                : undefined,
                        tab:
                            tabRaw !== undefined && Number.isFinite(tabRaw)
                                ? Math.trunc(tabRaw)
                                : undefined,
                    });
                },
                withdrawFromBankSlot: (player, slot, quantity, opts) =>
                    bm.withdraw(player, slot, quantity, { overrideNoted: opts?.noted }),
                getBankEntryAtClientSlot: (player, clientSlot) =>
                    bm.getBankEntryAtClientSlot(player, clientSlot),
                moveBankSlot: (player, from, to, opts) => bm.moveBankSlot(player, from, to, opts),
                handleIfButtonD: (player, payload) => bm.handleIfButtonD(player, payload),
                queueBankSnapshot: (player) => bm.queueBankSnapshot(player),
                sendBankTabVarbits: (player) => bm.sendBankTabVarbits(player),
                setCurrentTab: (player, tabIndex) => bm.setCurrentTab(player, tabIndex),
                setTabDisplayMode: (player, mode) => bm.setTabDisplayMode(player, mode),
                collapseTab: (player, tabIndex) => bm.collapseTab(player, tabIndex),
                releasePlaceholder: (player, slot, itemIdHint) =>
                    bm.releasePlaceholder(player, slot, itemIdHint),
                releasePlaceholders: (player, tabIndex) =>
                    bm.releasePlaceholders(player, tabIndex),
                addItemToBank: (player, itemId, qty) => bm.addItemToBank(player, itemId, qty),
            };
        }

        // Shop services
        if (this.shopService) {
            services.shopping = this.shopService.createScriptServices();
        }

        // Equipment target-specific bonuses
        services.equipment.computeTargetBonusPercentages = (player) =>
            computeTargetBonusPercentages(player, services.equipment.getEquipArray(player));

        // Widget lifecycle handlers
        registerWidgetCloseHandlers(services, {
            closeModal: (player) => ss?.getInterfaceService()?.closeModal(player),
        });
        registerWidgetOpenHandlers(services);

        // Smithing bar modal handler
        registerSmithingBarModalHandler(services, {
            closeModal: (player) => ss?.getInterfaceService()?.closeModal(player),
        });
    }

    override registerHandlers(registry: IScriptRegistry, services: ScriptServices): void {
        this.scriptServices = services;
        // Banking, equipment, shops
        registerBankingHandlers(registry, services);
        registerEquipmentHandlers(registry, services);
        registerEquipmentWidgetHandlers(registry, services);
        registerShopInteractionHandlers(registry, services);
        registerShopWidgetHandlers(registry, services);
        registerZaffHandlers(registry, services);
        if (this.geService) {
            registerGrandExchangeHandlers(registry, this.geService);
        }

        // Content
        registerClimbingHandlers(registry, services);
        registerDoorHandlers(registry, services);
        registerDefaultTalkHandlers(registry, services);
        registerAccountTutorHandlers(registry, services);
        registerPohPoolHandlers(registry, services);
        registerWildernessAccessHandlers(registry, services);
        registerAlKharidBorderHandlers(registry, services);
        registerBobHandlers(registry, services);
        registerLumbridgeNpcHandlers(registry, services);
        registerRomeoHandlers(registry, services);
        registerDemoInteractionHandlers(registry, services);

        // Items
        registerFollowerItemHandlers(registry, services);
        registerPacksHandlers(registry, services);

        // Widgets
        registerCombatWidgetHandlers(registry, services);
        registerMinimapWidgetHandlers(registry, services);
        registerPrayerWidgetHandlers(registry, services);
        registerMusicWidgetHandlers(registry, services);
        registerEmoteWidgetHandlers(registry, services);
        registerSpellbookWidgetHandlers(registry, services);
        registerSkillGuideWidgetHandlers(registry, services);
        registerSettingsWidgetHandlers(registry, services);
        registerQuestJournalWidgetHandlers(registry, services);
        registerDiaryJournalWidgetHandlers(registry, services);
        registerAccountSummaryWidgetHandlers(registry, services, (player) =>
            this.getQuestListGroups(player),
        );
        registerCollectionLogWidgetHandlers(registry, services);

        // Skills
        registerSkillHandlers(registry, services);

        // Skill masters (before quests — quest handlers override for active quest NPCs)
        registerSkillMasterHandlers(registry, services);

        // Quests (after skills so quest gates can wrap skill loc handlers)
        registerQuestHandlers(registry, services);

        // Level-up display (event-driven from SkillService)
        if (services.system.eventBus) {
            registerLevelUpHandlers(services, services.system.eventBus);
        }
    }

    override initialize(context: GamemodeInitContext): void {
        const ss = context.serverServices;
        this.serverServices = ss;

        this.registerProviders();

        // === Banking ===
        const bankingServices: BankingProviderServices = {
            ...ss,
            queueBankSnapshot: (playerId, payload) =>
                ss.queueGamemodeSnapshot("bank", playerId, payload),
            sendBankSnapshot: (playerId, payload) =>
                ss.queueGamemodeSnapshot("bank", playerId, payload),
        };

        this.bankingManager = new BankingManager(bankingServices);

        const bm = this.bankingManager;
        ss.registerSnapshotEncoder(
            "bank",
            (_playerId, payload) => ({
                message: encodeMessage({ type: "bank", payload }),
                context: "bank_snapshot",
            }),
            (playerId, _payload) => {
                const player = ss.getPlayer(playerId);
                if (player) {
                    player.bank.setBankClientSlotMapping(bm.buildBankSlotMapping(player));
                }
            },
        );

        // === Shops ===
        this.shopService = new ShopService({ serverServices: ss });

        // === Grand Exchange ===
        this.geService = new GrandExchangeService({
            serverServices: ss,
            getScriptServices: () => this.scriptServices,
        });

        // === Static ground item spawns ===
        registerVanillaGroundItemSpawns(ss);

        // === Interface hooks ===
        const interfaceService = ss.getInterfaceService();
        if (interfaceService) {
            registerBankInterfaceHooks(interfaceService);
            registerEquipmentStatsInterfaceHooks(interfaceService);
            registerShopInterfaceHooks(interfaceService);
            registerTradeInterfaceHooks(interfaceService);
            if (this.geService) {
                registerGrandExchangeInterfaceHooks(interfaceService, this.geService);
            }
        }
    }

    onResumePauseButton(player: PlayerState, widgetId: number, childIndex: number): boolean {
        if (this.geService?.handleResumePauseButton(player, widgetId, childIndex)) {
            return true;
        }
        if (!this.scriptServices) return false;
        return handleResumePauseButton(this.scriptServices, player, widgetId, childIndex);
    }

    onPlayerDisconnect(playerId: number): void {
        if (this.scriptServices) {
            handleDismiss(this.scriptServices, playerId);
        }
    }

    override dispose(): void {
        resetProviderRegistry();

        this.bankingManager = undefined;
        this.shopService = undefined;
        this.geService = undefined;
        this.serverServices = undefined;
        this.scriptServices = undefined;
    }
}

export function createGamemode(): GamemodeDefinition {
    return new VanillaGamemode();
}
