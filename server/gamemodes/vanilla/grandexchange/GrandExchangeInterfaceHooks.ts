import type { PlayerState } from "../../../src/game/player";
import type { InterfaceService } from "../../../src/widgets/InterfaceService";
import {
    GE_OFFERS_INTERFACE_ID,
    GE_OFFERS_SIDE_INTERFACE_ID,
    SCRIPT_GE_OFFERS_INIT,
} from "./geConstants";
import type { GrandExchangeService } from "./GrandExchangeService";

export function registerGrandExchangeInterfaceHooks(
    interfaceService: InterfaceService,
    geService: GrandExchangeService,
): void {
    interfaceService.onInterfaceOpen(GE_OFFERS_INTERFACE_ID, (player, ctx) => {
        ctx.service.runScript(player, SCRIPT_GE_OFFERS_INIT, []);
        geService.syncPlayerUi(player);
    });

    interfaceService.onInterfaceClose(GE_OFFERS_INTERFACE_ID, (player, ctx) => {
        const side = player.widgets.getByScope("sidemodal");
        if (side?.groupId === GE_OFFERS_SIDE_INTERFACE_ID) {
            ctx.service.closeSidemodal(player);
        }
    });
}
