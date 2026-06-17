import { PlayerType } from "../../../../src/rs/chat/PlayerType";
import { VARBIT_ACCOUNT_TYPE } from "../../../../src/shared/vars";
import type { PlayerState } from "../../../src/game/player";
import type { ScriptServices } from "../../../src/game/scripts/types";

/** Varbit 1777 values (see shared/vars.ts). */
export const ACCOUNT_TYPE_MAIN = 0;
export const ACCOUNT_TYPE_IRONMAN = 1;
export const ACCOUNT_TYPE_ULTIMATE = 2;
export const ACCOUNT_TYPE_HARDCORE = 3;
export const ACCOUNT_TYPE_GROUP = 4;
export const ACCOUNT_TYPE_HARDCORE_GROUP = 5;

export function getAccountTypeVarbit(player: PlayerState): number {
    const raw = player.varps.getVarbitValue(VARBIT_ACCOUNT_TYPE) | 0;
    return raw >= 0 && raw <= ACCOUNT_TYPE_HARDCORE_GROUP ? raw : ACCOUNT_TYPE_MAIN;
}

export function setAccountTypeVarbit(
    player: PlayerState,
    services: ScriptServices,
    accountType: number,
): void {
    const clamped = Math.max(
        ACCOUNT_TYPE_MAIN,
        Math.min(ACCOUNT_TYPE_HARDCORE_GROUP, accountType | 0),
    );
    player.varps.setVarbitValue(VARBIT_ACCOUNT_TYPE, clamped);
    services.variables.queueVarbit?.(player.id, VARBIT_ACCOUNT_TYPE, clamped);
}

export function accountTypeLabel(accountType: number): string {
    switch (accountType) {
        case ACCOUNT_TYPE_IRONMAN:
            return "Ironman";
        case ACCOUNT_TYPE_ULTIMATE:
            return "Ultimate Ironman";
        case ACCOUNT_TYPE_HARDCORE:
            return "Hardcore Ironman";
        case ACCOUNT_TYPE_GROUP:
            return "Group Ironman";
        case ACCOUNT_TYPE_HARDCORE_GROUP:
            return "Hardcore Group Ironman";
        default:
            return "main";
    }
}

export function accountTypeToPlayerType(accountType: number): PlayerType {
    switch (accountType) {
        case ACCOUNT_TYPE_IRONMAN:
            return PlayerType.Ironman;
        case ACCOUNT_TYPE_ULTIMATE:
            return PlayerType.UltimateIronman;
        case ACCOUNT_TYPE_HARDCORE:
            return PlayerType.HardcoreIronman;
        case ACCOUNT_TYPE_GROUP:
            return PlayerType.GroupIronman;
        case ACCOUNT_TYPE_HARDCORE_GROUP:
            return PlayerType.HardcoreGroupIronman;
        default:
            return PlayerType.Normal;
    }
}

/** Account-type icon for chat (empty when main). */
export function getAccountTypePlayerTypes(player: PlayerState): PlayerType[] {
    const accountType = getAccountTypeVarbit(player);
    if (accountType === ACCOUNT_TYPE_MAIN) {
        return [];
    }
    return [accountTypeToPlayerType(accountType)];
}
