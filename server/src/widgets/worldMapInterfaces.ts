import type { PlayerState } from "../game/player";
import type { InterfaceService } from "./InterfaceService";

export const WORLD_MAP_GROUP_ID = 595;
export const FLOATER_BLANKMODAL_GROUP_ID = 594;
export const WORLD_MAP_CLOSE_WIDGET_ID = (WORLD_MAP_GROUP_ID << 16) | 38;

export function closeWorldMapInterfaces(
    player: PlayerState,
    interfaceService?: InterfaceService,
): boolean {
    const closedEntries = [
        ...player.widgets.close(WORLD_MAP_GROUP_ID),
        ...player.widgets.close(FLOATER_BLANKMODAL_GROUP_ID),
    ];
    if (closedEntries.length === 0) {
        return false;
    }
    interfaceService?.triggerCloseHooksForEntries(player, closedEntries);
    return true;
}
