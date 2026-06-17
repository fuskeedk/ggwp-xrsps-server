import {
    ACCOUNT_SUMMARY_ACHIEVEMENT_DIARY_CHILD_INDEX,
    ACCOUNT_SUMMARY_ENTRY_LIST_UID,
    ACCOUNT_SUMMARY_GROUP_ID,
    ACCOUNT_SUMMARY_PLAYTIME_CHILD_INDEX,
    ACCOUNT_SUMMARY_QUEST_LIST_CHILD_INDEX,
    SCRIPT_ACCOUNT_SUMMARY_SET_TIME_ID,
    buildAccountSummarySetTimeScriptArgs,
} from "../../../../src/shared/ui/accountSummary";
import {
    SIDE_JOURNAL_ACHIEVEMENT_DIARY_TAB,
    SIDE_JOURNAL_QUEST_TAB,
} from "../../../../src/shared/ui/sideJournal";
import { VARBIT_ACCOUNT_SUMMARY_DISPLAY_PLAYTIME } from "../../../../src/shared/vars";
import type { GamemodeQuestListGroup } from "../../../src/game/gamemodes/GamemodeDefinition";
import type { PlayerState } from "../../../src/game/player";
import {
    type IScriptRegistry,
    type ScriptServices,
    type WidgetActionEvent,
    getAccountSummaryTimeMinutes,
} from "../../../src/game/scripts/types";
import { buildVanillaQuestListGroups } from "./buildQuestListGroups";
import { switchSideJournalTab } from "./sideJournalTabSwitch";

function resolveAccountSummaryEntryIndex(event: WidgetActionEvent): number {
    const slotVal = event.slot ?? -1;
    if (slotVal >= 0 && slotVal !== 65535) {
        return slotVal;
    }
    return event.childId ?? -1;
}

function createSideJournalBridge(services: ScriptServices) {
    return {
        queueWidgetEvent: (
            playerId: number,
            action: Parameters<ScriptServices["dialog"]["queueWidgetEvent"]>[1],
        ) => services.dialog.queueWidgetEvent(playerId, action),
        queueVarp: services.variables.queueVarp,
        queueVarbit: services.variables.queueVarbit,
    };
}

export function registerAccountSummaryWidgetHandlers(
    registry: IScriptRegistry,
    services: ScriptServices,
    getQuestListGroups: (
        player: PlayerState,
    ) => readonly GamemodeQuestListGroup[] = buildVanillaQuestListGroups,
): void {
    registry.registerWidgetAction({
        widgetId: ACCOUNT_SUMMARY_ENTRY_LIST_UID,
        handler: (event: WidgetActionEvent) => {
            if (event.groupId !== ACCOUNT_SUMMARY_GROUP_ID) return;

            const entryIndex = resolveAccountSummaryEntryIndex(event);
            const player = event.player;
            const bridge = createSideJournalBridge(services);

            if (entryIndex === ACCOUNT_SUMMARY_QUEST_LIST_CHILD_INDEX) {
                switchSideJournalTab(
                    player,
                    SIDE_JOURNAL_QUEST_TAB,
                    bridge,
                    getQuestListGroups(player),
                );
                return;
            }

            if (entryIndex === ACCOUNT_SUMMARY_ACHIEVEMENT_DIARY_CHILD_INDEX) {
                switchSideJournalTab(player, SIDE_JOURNAL_ACHIEVEMENT_DIARY_TAB, bridge);
                return;
            }

            if (entryIndex !== ACCOUNT_SUMMARY_PLAYTIME_CHILD_INDEX) {
                return;
            }

            const nextValue =
                player.varps.getVarbitValue(VARBIT_ACCOUNT_SUMMARY_DISPLAY_PLAYTIME) === 1 ? 0 : 1;

            player.varps.setVarbitValue(VARBIT_ACCOUNT_SUMMARY_DISPLAY_PLAYTIME, nextValue);
            services.variables.queueVarbit?.(
                player.id,
                VARBIT_ACCOUNT_SUMMARY_DISPLAY_PLAYTIME,
                nextValue,
            );
            services.dialog.queueWidgetEvent(player.id, {
                action: "run_script",
                scriptId: SCRIPT_ACCOUNT_SUMMARY_SET_TIME_ID,
                args: buildAccountSummarySetTimeScriptArgs(getAccountSummaryTimeMinutes(player)),
            });
        },
    });
}
