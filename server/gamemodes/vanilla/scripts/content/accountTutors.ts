import type { PlayerState } from "../../../../src/game/player";
import type { IScriptRegistry, NpcInteractionEvent, ScriptServices } from "../../../../src/game/scripts/types";
import {
    ACCOUNT_TYPE_HARDCORE,
    ACCOUNT_TYPE_IRONMAN,
    ACCOUNT_TYPE_MAIN,
    ACCOUNT_TYPE_ULTIMATE,
    accountTypeLabel,
    getAccountTypeVarbit,
    setAccountTypeVarbit,
} from "../../account/accountType";
import { countCarriedItem } from "../../quests/QuestService";

const IRONMAN_TUTOR_NPC_ID = 311;
const IRONMAN_TUTOR_NAME = "Ironman tutor";

const LEAGUE_TUTOR_NPC_ID = 315;
const LEAGUE_TUTOR_NAME = "League Tutor";

const IRONMAN_ARMOUR = [12810, 12811, 12812] as const;
const ULTIMATE_ARMOUR = [12813, 12814, 12815] as const;
const HARDCORE_ARMOUR = [20792, 20794, 20796] as const;

function armourForAccountType(accountType: number): readonly number[] | undefined {
    switch (accountType) {
        case ACCOUNT_TYPE_IRONMAN:
            return IRONMAN_ARMOUR;
        case ACCOUNT_TYPE_ULTIMATE:
            return ULTIMATE_ARMOUR;
        case ACCOUNT_TYPE_HARDCORE:
            return HARDCORE_ARMOUR;
        default:
            return undefined;
    }
}

function openNpcDialogForPlayer(
    player: PlayerState,
    services: ScriptServices,
    dialogId: string,
    npcId: number,
    npcName: string,
    lines: string[],
    onContinue?: () => void,
): void {
    services.dialog.openDialog(player, {
        kind: "npc",
        id: dialogId,
        npcId,
        npcName,
        lines,
        clickToContinue: true,
        closeOnContinue: !onContinue,
        onContinue,
        onClose: () => services.dialog.closeDialog(player, dialogId),
    });
}

function openNpcDialog(
    event: NpcInteractionEvent,
    services: ScriptServices,
    dialogId: string,
    npcId: number,
    npcName: string,
    lines: string[],
    onContinue?: () => void,
): void {
    openNpcDialogForPlayer(event.player, services, dialogId, npcId, npcName, lines, onContinue);
}

function grantArmourSet(
    player: PlayerState,
    services: ScriptServices,
    itemIds: readonly number[],
): string[] {
    const missing = itemIds.filter((id) => countCarriedItem(player, services, id) < 1);
    if (missing.length === 0) {
        return ["You already have your armour set with you."];
    }

    const notAdded: number[] = [];
    for (const itemId of missing) {
        const added = services.inventory.addItemToInventory(player, itemId, 1);
        if (added.added < 1) {
            notAdded.push(itemId);
            break;
        }
    }
    if (notAdded.length > 0) {
        services.inventory.snapshotInventory(player);
        return [
            "You'll need more free inventory space before I can give you the rest.",
            "Make some room and talk to me again.",
        ];
    }
    services.inventory.snapshotInventory(player);
    return ["Here is your armour.", "Wear it with pride."];
}

function confirmAccountTypeChange(
    player: PlayerState,
    services: ScriptServices,
    npcId: number,
    npcName: string,
    nextType: number,
): void {
    const convoId = `ironman_tutor_confirm_${player.id}_${nextType}`;
    services.dialog.openDialogOptions(player, {
        id: convoId,
        title: "Are you sure?",
        options: ["Yes, I'm sure.", "No, I've changed my mind."],
        onSelect: (choice) => {
            if (choice !== 0) {
                openNpcDialogForPlayer(
                    player,
                    services,
                    `${convoId}_cancel`,
                    npcId,
                    npcName,
                    ["Very well. Your account type is unchanged."],
                );
                return;
            }
            setAccountTypeVarbit(player, services, nextType);
            services.messaging.sendGameMessage(
                player,
                `Your account is now ${accountTypeLabel(nextType)} mode.`,
            );
            openNpcDialogForPlayer(player, services, `${convoId}_done`, npcId, npcName, [
                `You are now an ${accountTypeLabel(nextType)}.`,
                "Speak to me again if you need armour or a reminder of the rules.",
            ]);
        },
    });
}

function handleIronmanTalk(event: NpcInteractionEvent, services: ScriptServices): void {
    const player = event.player;
    const accountType = getAccountTypeVarbit(player);
    const base = `ironman_tutor_${player.id}`;

    const openOptions = () => {
        const isMain = accountType === ACCOUNT_TYPE_MAIN;
        const options = isMain
            ? [
                  "What is an Ironman?",
                  "I'd like to be an Ironman.",
                  "I'd like to be an Ultimate Ironman.",
                  "I'd like to be a Hardcore Ironman.",
              ]
            : [
                  "Remind me of the Ironman rules.",
                  "I'd like some Ironman armour.",
                  "I'd like to return to a main account.",
              ];

        services.dialog.openDialogOptions(player, {
            id: `${base}_options`,
            title: IRONMAN_TUTOR_NAME,
            options,
            onSelect: (choice) => {
                if (isMain) {
                    if (choice === 0) {
                        openNpcDialog(event, services, `${base}_what`, IRONMAN_TUTOR_NPC_ID, IRONMAN_TUTOR_NAME, [
                            "Ironmen are self-sufficient adventurers.",
                            "You cannot trade with other players or use the Grand Exchange.",
                            "You must gather your own supplies and earn your achievements.",
                        ]);
                        return;
                    }
                    const nextType =
                        choice === 1
                            ? ACCOUNT_TYPE_IRONMAN
                            : choice === 2
                              ? ACCOUNT_TYPE_ULTIMATE
                              : ACCOUNT_TYPE_HARDCORE;
                    confirmAccountTypeChange(
                        player,
                        services,
                        IRONMAN_TUTOR_NPC_ID,
                        IRONMAN_TUTOR_NAME,
                        nextType,
                    );
                    return;
                }

                if (choice === 0) {
                    openNpcDialog(event, services, `${base}_rules`, IRONMAN_TUTOR_NPC_ID, IRONMAN_TUTOR_NAME, [
                        "As an Ironman you stand alone.",
                        "No trading, no Grand Exchange, and no picking up other players' loot.",
                        "Ultimate Ironmen cannot use banks. Hardcore Ironmen die permanently to standard Ironman.",
                    ]);
                    return;
                }
                if (choice === 1) {
                    const set = armourForAccountType(accountType);
                    if (!set) {
                        openNpcDialog(event, services, `${base}_no_armour`, IRONMAN_TUTOR_NPC_ID, IRONMAN_TUTOR_NAME, [
                            "I only provide armour for standard, Ultimate, and Hardcore Ironmen.",
                        ]);
                        return;
                    }
                    openNpcDialog(
                        event,
                        services,
                        `${base}_armour`,
                        IRONMAN_TUTOR_NPC_ID,
                        IRONMAN_TUTOR_NAME,
                        grantArmourSet(player, services, set),
                    );
                    return;
                }
                confirmAccountTypeChange(
                    player,
                    services,
                    IRONMAN_TUTOR_NPC_ID,
                    IRONMAN_TUTOR_NAME,
                    ACCOUNT_TYPE_MAIN,
                );
            },
        });
    };

    openNpcDialog(
        event,
        services,
        `${base}_hello`,
        IRONMAN_TUTOR_NPC_ID,
        IRONMAN_TUTOR_NAME,
        accountType === ACCOUNT_TYPE_MAIN
            ? ["Hello. I can explain Ironman mode or change your account type."]
            : [`You're currently an ${accountTypeLabel(accountType)}.`, "How can I help?"],
        openOptions,
    );
}

function handleIronmanArmour(event: NpcInteractionEvent, services: ScriptServices): void {
    const accountType = getAccountTypeVarbit(event.player);
    const set = armourForAccountType(accountType);
    if (!set) {
        openNpcDialog(event, services, `ironman_armour_${event.player.id}`, IRONMAN_TUTOR_NPC_ID, IRONMAN_TUTOR_NAME, [
            "You need to be an Ironman, Ultimate Ironman, or Hardcore Ironman for me to give you armour.",
            "Talk to me if you'd like to become one.",
        ]);
        return;
    }
    openNpcDialog(
        event,
        services,
        `ironman_armour_${event.player.id}`,
        IRONMAN_TUTOR_NPC_ID,
        IRONMAN_TUTOR_NAME,
        grantArmourSet(event.player, services, set),
    );
}

function handleIronmanSetup(event: NpcInteractionEvent, services: ScriptServices): void {
    openNpcDialog(event, services, `ironman_setup_${event.player.id}`, IRONMAN_TUTOR_NPC_ID, IRONMAN_TUTOR_NAME, [
        "Ironmen rely on self-sufficiency — plan your gear and inventory before heading out.",
        "Use the bank wisely; Ultimate Ironmen cannot bank items at all.",
        "I can also replace lost Ironman armour if you speak to me and choose Armour.",
    ]);
}

function handleLeagueTutorTalk(event: NpcInteractionEvent, services: ScriptServices): void {
    const player = event.player;
    const base = `league_tutor_${player.id}`;
    openNpcDialog(event, services, `${base}_hello`, LEAGUE_TUTOR_NPC_ID, LEAGUE_TUTOR_NAME, [
        "Welcome, adventurer.",
        "Leagues are a seasonal challenge world with relics, tasks, and accelerated progression.",
    ], () => {
        services.dialog.closeDialog(player, `${base}_hello`);
        services.dialog.openDialogOptions(player, {
            id: `${base}_options`,
            title: LEAGUE_TUTOR_NAME,
            options: ["What are Leagues?", "Is this a League world?"],
            onSelect: (choice) => {
                if (choice === 0) {
                    openNpcDialog(event, services, `${base}_about`, LEAGUE_TUTOR_NPC_ID, LEAGUE_TUTOR_NAME, [
                        "League worlds run for a limited time with unique relics and area unlocks.",
                        "You earn points from tasks to unlock powerful upgrades.",
                        "Join a dedicated League world when a season is live.",
                    ]);
                    return;
                }
                openNpcDialog(event, services, `${base}_world`, LEAGUE_TUTOR_NPC_ID, LEAGUE_TUTOR_NAME, [
                    "This is a standard game world, not an active League season.",
                    "You'll find me here in Lumbridge on League worlds with the full tutorial and relic systems.",
                ]);
            },
        });
    });
}

function registerNpcHandler(
    registry: IScriptRegistry,
    npcId: number,
    option: string | undefined,
    handler: (event: NpcInteractionEvent) => void,
): void {
    registry.registerNpcScript({ npcId, option, handler });
}

export function registerAccountTutorHandlers(registry: IScriptRegistry, services: ScriptServices): void {
    const ironTalk = (event: NpcInteractionEvent) => handleIronmanTalk(event, services);
    const ironArmour = (event: NpcInteractionEvent) => handleIronmanArmour(event, services);
    const ironSetup = (event: NpcInteractionEvent) => handleIronmanSetup(event, services);
    const leagueTalk = (event: NpcInteractionEvent) => handleLeagueTutorTalk(event, services);

    for (const option of [undefined, "talk-to"] as const) {
        registerNpcHandler(registry, IRONMAN_TUTOR_NPC_ID, option, ironTalk);
        registerNpcHandler(registry, LEAGUE_TUTOR_NPC_ID, option, leagueTalk);
    }
    registerNpcHandler(registry, IRONMAN_TUTOR_NPC_ID, "armour", ironArmour);
    registerNpcHandler(registry, IRONMAN_TUTOR_NPC_ID, "setup", ironSetup);
}
