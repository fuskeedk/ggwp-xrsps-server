import { isGgwpAdminRights } from "../../src/auth/GgwpAccountService";
import type { PlayerState } from "../../src/game/player";

const GGWP_RIGHTS_KEY = "ggwp:rights";

const ADMIN_USERNAMES = new Set(
    (
        process.env.ADMIN_USERNAMES ??
        process.env.ADMIN_PLAYERS ??
        process.env.ADMIN_NAMES ??
        "fuskee"
    )
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value.length > 0),
);

export function setGgwpPlayerRights(player: PlayerState, rights: string): void {
    if (rights.trim()) {
        player.gamemodeState.set(GGWP_RIGHTS_KEY, rights);
    }
}

export function getGgwpPlayerRights(player: PlayerState): string {
    const value = player.gamemodeState.get(GGWP_RIGHTS_KEY);
    return typeof value === "string" ? value : "";
}

export function isGgwpStaff(player: PlayerState): boolean {
    const name = player.name?.trim().toLowerCase() ?? "";
    if (name && ADMIN_USERNAMES.has(name)) {
        return true;
    }
    return isGgwpAdminRights(getGgwpPlayerRights(player));
}

export function requireStaff(player: PlayerState): string | null {
    if (isGgwpStaff(player)) {
        return null;
    }
    return "You do not have permission to use that command.";
}
