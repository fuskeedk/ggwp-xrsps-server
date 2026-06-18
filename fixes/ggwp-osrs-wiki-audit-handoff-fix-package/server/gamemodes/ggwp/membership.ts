import type { WebSocket } from "ws";

import type { ServerServices } from "../../src/game/ServerServices";
import { setPlayerMembershipState } from "../../src/game/membership";
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

type GgwpCharacterRow = {
    id: number;
    members: boolean | number | string | null;
    membership_expires_at?: string | number | Date | null;
};

function normalizeDbBoolean(value: boolean | number | string | null | undefined): boolean {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    const text = String(value ?? "").trim().toLowerCase();
    return text === "1" || text === "true" || text === "t" || text === "yes" || text === "on";
}

function normalizeMembershipExpiresAt(
    value: string | number | Date | null | undefined,
    members: boolean,
): number {
    if (value === undefined || value === null || value === "") {
        return members ? LIFETIME_EXPIRES : 0;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
        return Math.floor(value);
    }
    if (value instanceof Date) {
        const ms = value.getTime();
        return Number.isFinite(ms) ? Math.floor(ms / 1000) : members ? LIFETIME_EXPIRES : 0;
    }

    const text = String(value).trim();
    const numeric = Number(text);
    if (Number.isFinite(numeric)) {
        return Math.floor(numeric);
    }

    const parsedMs = Date.parse(text);
    if (Number.isFinite(parsedMs)) {
        return Math.floor(parsedMs / 1000);
    }

    return members ? LIFETIME_EXPIRES : 0;
}

async function queryGgwpCharacter(
    name: string,
    includeExpiresAt: boolean,
    joinAccounts: boolean,
): Promise<GgwpCharacterRow | null> {
    const expiresSelect = includeExpiresAt ? ", c.membership_expires_at" : "";
    const join = joinAccounts ? "LEFT JOIN accounts a ON a.id = c.account_id" : "";
    const accountPredicate = joinAccounts ? " OR lower(a.account_name) = lower($1)" : "";
    const displayOrder = joinAccounts
        ? "CASE WHEN lower(c.display_name) = lower($1) THEN 0 ELSE 1 END,"
        : "";
    const result = await getGgwpGamePool().query<GgwpCharacterRow>(
        `SELECT c.id, c.members${expiresSelect}
         FROM account_characters c
         ${join}
         WHERE lower(c.display_name) = lower($1)${accountPredicate}
         ORDER BY ${displayOrder} c.id ASC
         LIMIT 1`,
        [name],
    );
    return result.rows[0] ?? null;
}

export async function lookupGgwpCharacter(displayName: string): Promise<GgwpCharacterRecord | null> {
    const name = displayName.trim();
    if (!name) {
        return null;
    }

    try {
        let row: GgwpCharacterRow | null = null;
        try {
            row = await queryGgwpCharacter(name, true, true);
        } catch (err) {
            logger.warn(
                "[ggwp-membership] membership_expires_at lookup failed; falling back to members boolean",
                err,
            );
            try {
                row = await queryGgwpCharacter(name, false, true);
            } catch {
                row = await queryGgwpCharacter(name, false, false);
            }
        }
        if (!row) {
            return null;
        }
        const members = normalizeDbBoolean(row.members);
        return {
            characterId: row.id | 0,
            members,
            membershipExpiresAt: normalizeMembershipExpiresAt(row.membership_expires_at, members),
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
    const member = isGgwpMember(record);
    const days = membershipDaysRemaining(record);
    player.gamemodeState.set(GGWP_MEMBERS_KEY, member);
    setPlayerMembershipState(player, member, days, record.characterId);
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
        setPlayerMembershipState(player, false, 0);
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
