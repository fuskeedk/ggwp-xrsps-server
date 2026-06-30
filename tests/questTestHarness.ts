import { PlayerVarpState } from "../server/src/game/state/PlayerVarpState";
import type { PlayerState } from "../server/src/game/player";
import type { ScriptServices } from "../server/src/game/scripts/types";

export type QuestDialogCapture = {
    modalOpen: boolean;
    npcLines: string[];
    optionTitles: string[];
};

export function createQuestTestPlayer(id = 1): PlayerState {
    return {
        id,
        name: "Test Player",
        varps: new PlayerVarpState(),
        gamemodeState: new Map<string, unknown>(),
    } as PlayerState;
}

export function createQuestTestServices(): {
    services: ScriptServices;
    dialog: QuestDialogCapture;
} {
    const dialog: QuestDialogCapture = {
        modalOpen: false,
        npcLines: [],
        optionTitles: [],
    };

    const services = {
        dialog: {
            openDialog(_player, request) {
                dialog.modalOpen = true;
                if (request.kind === "npc") {
                    dialog.npcLines.push(...request.lines);
                }
            },
            openDialogOptions(_player, request) {
                dialog.modalOpen = true;
                dialog.optionTitles.push(request.title);
            },
            openSkillMulti() {},
            closeDialog() {
                dialog.modalOpen = false;
            },
            closeInterruptibleInterfaces() {},
            openSubInterface() {},
            closeSubInterface() {},
            closeModal() {
                dialog.modalOpen = false;
            },
            getInterfaceService() {
                return {
                    getCurrentChatboxModal: () => (dialog.modalOpen ? 162 : undefined),
                };
            },
            openRemainingTabs() {},
            queueClientScript() {},
            queueWidgetEvent() {},
        },
        variables: {
            sendVarp() {},
            sendVarbit() {},
        },
        inventory: {
            getInventoryItems: () => [],
            findInventorySlotWithItem: () => undefined,
            consumeItem: () => false,
            addItemToInventory: () => {},
            snapshotInventory: () => {},
            hasItem: () => false,
        },
        messaging: {
            sendGameMessage: () => {},
        },
        sound: {
            sendJingle: () => {},
        },
        skills: {
            addSkillXp: () => {},
        },
        system: {
            logger: {
                info: () => {},
                warn: () => {},
            },
        },
        data: {
            getDbRepository: () => undefined,
        },
    } as unknown as ScriptServices;

    return { services, dialog };
}

export function resetQuestDialog(dialog: QuestDialogCapture): void {
    dialog.modalOpen = false;
    dialog.npcLines = [];
    dialog.optionTitles = [];
}
