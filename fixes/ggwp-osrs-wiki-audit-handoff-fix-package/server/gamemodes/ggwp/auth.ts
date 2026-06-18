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

export type GgwpStaffChatTag = {
    label: string;
    color: string;
};

export function getGgwpStaffChatTag(player: PlayerState): GgwpStaffChatTag | null {
    const rights = getGgwpPlayerRights(player).trim().toLowerCase();
    if (rights === "modlevel.owner") {
        return { label: "Owner", color: "ff0000" };
    }
    if (rights === "modlevel.admin") {
        return { label: "Admin", color: "ff981f" };
    }
    return null;
}

export function formatGgwpStaffChatPrefix(player: PlayerState): string {
    const tag = getGgwpStaffChatTag(player);
    return tag ? `<col=${tag.color}>[${tag.label}]</col>` : "";
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
