import {
    ACCOUNT_SUMMARY_ACHIEVEMENT_DIARY_CHILD_INDEX,
    ACCOUNT_SUMMARY_COLLECTION_ACTION_FLAGS,
    ACCOUNT_SUMMARY_COLLECTION_LOG_CHILD_INDEX,
    ACCOUNT_SUMMARY_ENTRY_LIST_UID,
    ACCOUNT_SUMMARY_GROUP_ID,
    ACCOUNT_SUMMARY_NAV_ENTRY_ACTION_FLAGS,
    ACCOUNT_SUMMARY_PLAYTIME_ACTION_FLAGS,
    ACCOUNT_SUMMARY_PLAYTIME_CHILD_INDEX,
    ACCOUNT_SUMMARY_QUEST_LIST_CHILD_INDEX,
} from "../../../../src/shared/ui/accountSummary";
import {
    DIARY_LIST_ENTRY_EVENT_FLAGS,
    DIARY_LIST_ENTRY_MAX_SLOT,
    DIARY_LIST_TASKBOX_UID,
    INTERFACE_ACHIEVEMENT_DIARY_ID,
    INTERFACE_QUEST_LIST_ID,
    QUEST_LIST_ENTRY_EVENT_FLAGS,
    QUEST_LIST_ENTRY_LIST_UID,
    QUEST_LIST_ENTRY_MAX_SLOT,
    SIDE_JOURNAL_CONTENT_GROUP_BY_TAB,
    SIDE_JOURNAL_TAB_CONTAINER_UID,
    encodeSideJournalTabInStateVarp,
} from "../../../../src/shared/ui/sideJournal";
import { VARBIT_SIDE_JOURNAL_TAB, VARP_SIDE_JOURNAL_STATE } from "../../../../src/shared/vars";
import type {
    GamemodeQuestListGroup,
    GamemodeUiBridge,
} from "../../../src/game/gamemodes/GamemodeDefinition";
import type { PlayerState } from "../../../src/game/player";
import { queuePlayerQuestListUi } from "./questListUi";

type SideJournalTabBridge = Pick<
    GamemodeUiBridge,
    "queueWidgetEvent" | "queueVarp" | "queueVarbit"
>;

export function queueAccountSummaryEntryFlags(
    playerId: number,
    bridge: Pick<GamemodeUiBridge, "queueWidgetEvent">,
): void {
    bridge.queueWidgetEvent(playerId, {
        action: "set_flags_range",
        uid: ACCOUNT_SUMMARY_ENTRY_LIST_UID,
        fromSlot: ACCOUNT_SUMMARY_QUEST_LIST_CHILD_INDEX,
        toSlot: ACCOUNT_SUMMARY_ACHIEVEMENT_DIARY_CHILD_INDEX,
        flags: ACCOUNT_SUMMARY_NAV_ENTRY_ACTION_FLAGS,
    });
    bridge.queueWidgetEvent(playerId, {
        action: "set_flags_range",
        uid: ACCOUNT_SUMMARY_ENTRY_LIST_UID,
        fromSlot: ACCOUNT_SUMMARY_COLLECTION_LOG_CHILD_INDEX,
        toSlot: ACCOUNT_SUMMARY_COLLECTION_LOG_CHILD_INDEX,
        flags: ACCOUNT_SUMMARY_COLLECTION_ACTION_FLAGS,
    });
    bridge.queueWidgetEvent(playerId, {
        action: "set_flags_range",
        uid: ACCOUNT_SUMMARY_ENTRY_LIST_UID,
        fromSlot: ACCOUNT_SUMMARY_PLAYTIME_CHILD_INDEX,
        toSlot: ACCOUNT_SUMMARY_PLAYTIME_CHILD_INDEX,
        flags: ACCOUNT_SUMMARY_PLAYTIME_ACTION_FLAGS,
    });
}

export function switchSideJournalTab(
    player: PlayerState,
    tab: number,
    bridge: SideJournalTabBridge,
    questListGroups?: readonly GamemodeQuestListGroup[],
): void {
    const contentGroup = SIDE_JOURNAL_CONTENT_GROUP_BY_TAB[tab] ?? 0;
    if (contentGroup <= 0) return;

    const baseStateVarp = player.varps.getVarpValue(VARP_SIDE_JOURNAL_STATE);
    const stateVarp = encodeSideJournalTabInStateVarp(baseStateVarp, tab);
    player.varps.setVarpValue(VARP_SIDE_JOURNAL_STATE, stateVarp);
    player.varps.setVarbitValue(VARBIT_SIDE_JOURNAL_TAB, tab);
    bridge.queueVarp?.(player.id, VARP_SIDE_JOURNAL_STATE, stateVarp);
    bridge.queueVarbit?.(player.id, VARBIT_SIDE_JOURNAL_TAB, tab);

    bridge.queueWidgetEvent(player.id, {
        action: "open_sub",
        targetUid: SIDE_JOURNAL_TAB_CONTAINER_UID,
        groupId: contentGroup,
        type: 1,
    });

    if (contentGroup === INTERFACE_QUEST_LIST_ID) {
        queuePlayerQuestListUi(player, bridge, questListGroups);
        bridge.queueWidgetEvent(player.id, {
            action: "set_flags_range",
            uid: QUEST_LIST_ENTRY_LIST_UID,
            fromSlot: 0,
            toSlot: QUEST_LIST_ENTRY_MAX_SLOT,
            flags: QUEST_LIST_ENTRY_EVENT_FLAGS,
        });
        return;
    }

    if (contentGroup === INTERFACE_ACHIEVEMENT_DIARY_ID) {
        bridge.queueWidgetEvent(player.id, {
            action: "set_flags_range",
            uid: DIARY_LIST_TASKBOX_UID,
            fromSlot: 0,
            toSlot: DIARY_LIST_ENTRY_MAX_SLOT,
            flags: DIARY_LIST_ENTRY_EVENT_FLAGS,
        });
        return;
    }

    if (contentGroup === ACCOUNT_SUMMARY_GROUP_ID) {
        queueAccountSummaryEntryFlags(player.id, bridge);
    }
}
