import type { PlayerState } from "./player";

export const PLAYER_MEMBERS_KEY = "membership:members";
export const PLAYER_MEMBERSHIP_DAYS_KEY = "membership:days";
export const PLAYER_MEMBERSHIP_CHARACTER_ID_KEY = "membership:characterId";

const LEGACY_GGWP_MEMBERS_KEY = "ggwp:members";

function readBooleanEnv(name: string): boolean | undefined {
    const raw = process.env[name]?.trim().toLowerCase();
    if (!raw) return undefined;
    if (raw === "1" || raw === "true" || raw === "yes" || raw === "on") return true;
    if (raw === "0" || raw === "false" || raw === "no" || raw === "off") return false;
    return undefined;
}

export function isMembersWorldEnabled(): boolean {
    return (
        readBooleanEnv("GGWP_MEMBERS_WORLD") ??
        readBooleanEnv("MEMBERS_WORLD") ??
        readBooleanEnv("WORLD_MEMBERS") ??
        true
    );
}

export function setPlayerMembershipState(
    player: PlayerState,
    member: boolean,
    membershipDays: number = 0,
    characterId?: number,
): void {
    player.gamemodeState.set(PLAYER_MEMBERS_KEY, member);
    player.gamemodeState.set(LEGACY_GGWP_MEMBERS_KEY, member);
    player.gamemodeState.set(
        PLAYER_MEMBERSHIP_DAYS_KEY,
        Math.max(0, Math.min(99_999, membershipDays | 0)),
    );
    if (characterId !== undefined) {
        player.gamemodeState.set(PLAYER_MEMBERSHIP_CHARACTER_ID_KEY, characterId | 0);
    }
}

export function isPlayerMember(player: PlayerState | undefined): boolean {
    if (!player) return false;
    const direct = player.gamemodeState.get(PLAYER_MEMBERS_KEY);
    if (typeof direct === "boolean") return direct;
    const legacy = player.gamemodeState.get(LEGACY_GGWP_MEMBERS_KEY);
    if (typeof legacy === "boolean") return legacy;
    if (player.gamemode.id === "ggwp") return false;
    return isMembersWorldEnabled();
}

export function canUseMembersContent(player: PlayerState | undefined): boolean {
    return isMembersWorldEnabled() && isPlayerMember(player);
}
