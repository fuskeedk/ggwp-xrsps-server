import type { WebSocket } from "ws";

import type { ServerServices } from "../../src/game/ServerServices";
import type { PlayerState } from "../../src/game/player";
import { encodeMessage } from "../../src/network/messages";
import { logger } from "../../src/utils/logger";
import { getGgwpGamePool } from "./gameDb";

export const GGWP_CHARACTER_ID_KEY = "ggwp:characterId";
export const GGWP_MEMBERS_KEY = "ggwp:members";

const VARP_ACCOUNT_CREDIT_DAYS = 1780;
const CLIENT_SCRIPT_PLAYER_MEMBER = 828;
const CLIENT_SCRIPT_ACCOUNT_INFO_UPDATE = 2498;
const CLIENT_SCRIPT_ACCOUNT_UPDATE_DISPLAY = 2500;
const LIFETIME_EXPIRES = 4_102_444_800;

export type GgwpCharacterRecord = {
    characterId: number;
    members: boolean;
    membershipExpiresAt: number;
};

export async function lookupGgwpCharacter(displayName: string): Promise<GgwpCharacterRecord | null> {
    const name = displayName.trim();
    if (!name) {
        return null;
    }

    try {
        const result = await getGgwpGamePool().query<{
            id: number;
            members: boolean;
            membership_expires_at: string | number | null;
        }>(
            `SELECT id, members, membership_expires_at
             FROM account_characters
             WHERE lower(display_name) = lower($1)
             LIMIT 1`,
            [name],
        );
        const row = result.rows[0];
        if (!row) {
            return null;
        }
        return {
            characterId: row.id | 0,
            members: row.members === true,
            membershipExpiresAt: Number(row.membership_expires_at ?? 0) | 0,
        };
    } catch (err) {
        logger.warn("[ggwp-membership] character lookup failed", err);
        return null;
    }
}

export function membershipDaysRemaining(record: GgwpCharacterRecord): number {
    if (!record.members) {
        return 0;
    }
    if (record.membershipExpiresAt >= LIFETIME_EXPIRES) {
        return 99_999;
    }
    const now = Math.floor(Date.now() / 1000);
    if (record.membershipExpiresAt <= now) {
        return 0;
    }
    return Math.ceil((record.membershipExpiresAt - now) / 86_400);
}

export function isGgwpMember(record: GgwpCharacterRecord): boolean {
    if (!record.members) {
        return false;
    }
    if (record.membershipExpiresAt >= LIFETIME_EXPIRES) {
        return true;
    }
    return record.membershipExpiresAt > Math.floor(Date.now() / 1000);
}

export function storeGgwpCharacterState(player: PlayerState, record: GgwpCharacterRecord): void {
    player.gamemodeState.set(GGWP_CHARACTER_ID_KEY, record.characterId);
    player.gamemodeState.set(GGWP_MEMBERS_KEY, isGgwpMember(record));
}

export function getGgwpCharacterId(player: PlayerState): number {
    const value = player.gamemodeState.get(GGWP_CHARACTER_ID_KEY);
    return typeof value === "number" && Number.isFinite(value) ? value | 0 : 0;
}

export function syncMembershipClientState(
    svc: ServerServices,
    ws: WebSocket,
    player: PlayerState,
    member: boolean,
    membershipDays: number,
): void {
    const days = member ? Math.min(99_999, Math.max(0, membershipDays | 0)) : 0;
    player.varps.setVarpValue(VARP_ACCOUNT_CREDIT_DAYS, days);

    svc.networkLayer.withDirectSendBypass("varp", () =>
        svc.networkLayer.sendWithGuard(
            ws,
            encodeMessage({
                type: "varp",
                payload: { varpId: VARP_ACCOUNT_CREDIT_DAYS, value: days },
            }),
            "varp",
        ),
    );

    svc.broadcastService.queueClientScript(
        player.id,
        CLIENT_SCRIPT_PLAYER_MEMBER,
        member ? 1 : 0,
    );
    svc.broadcastService.queueClientScript(
        player.id,
        CLIENT_SCRIPT_ACCOUNT_INFO_UPDATE,
        member ? 1 : 0,
        0,
        0,
    );
    svc.broadcastService.queueClientScript(player.id, CLIENT_SCRIPT_ACCOUNT_UPDATE_DISPLAY);
}

export async function refreshGgwpMembershipForPlayer(
    svc: ServerServices,
    ws: WebSocket,
    player: PlayerState,
): Promise<void> {
    const name = player.name?.trim();
    if (!name) {
        return;
    }

    const record = await lookupGgwpCharacter(name);
    if (!record) {
        logger.info(`[ggwp-membership] no character row for ${name}`);
        syncMembershipClientState(svc, ws, player, false, 0);
        return;
    }

    storeGgwpCharacterState(player, record);
    const member = isGgwpMember(record);
    const days = membershipDaysRemaining(record);
    syncMembershipClientState(svc, ws, player, member, days);
    logger.info(
        `[ggwp-membership] synced ${name} member=${member} days=${days} characterId=${record.characterId}`,
    );
}
