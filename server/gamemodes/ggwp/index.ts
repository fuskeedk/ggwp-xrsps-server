import type { GamemodeDefinition } from "../../src/game/gamemodes/GamemodeDefinition";
import type { PlayerState } from "../../src/game/player";
import type { IScriptRegistry, ScriptServices } from "../../src/game/scripts/types";
import { VanillaGamemode } from "../vanilla/index";
import { registerGgwpAdminSkillWidgets } from "./adminSkillWidgets";
import { registerGgwpCommands } from "./commands";
import { GGWP_SPAWN } from "./config";
import {
    exportXpRate,
    getPlayerXpRate,
    importXpRate,
} from "./xpRate";

/**
 * ggwp.dk OSRS — extends vanilla with ggwp branding, spawn, rates and commands.
 * Account passwords are verified via Postgres (see GgwpAccountService).
 */
export class GgwpGamemode extends VanillaGamemode {
    override readonly id = "ggwp";
    override readonly name = "ggwp OSRS";

    override getSpawnLocation(_player: PlayerState): { x: number; y: number; level: number } {
        return { ...GGWP_SPAWN };
    }

    override getSkillXpMultiplier(player: PlayerState): number {
        return getPlayerXpRate(player);
    }

    override serializePlayerState(player: PlayerState): Record<string, unknown> | undefined {
        const base = super.serializePlayerState(player);
        const xpRate = exportXpRate(player);
        if (!base && xpRate === undefined) {
            return undefined;
        }
        return {
            ...(base ?? {}),
            ...(xpRate !== undefined ? { xpRate } : {}),
        };
    }

    override deserializePlayerState(player: PlayerState, data: Record<string, unknown>): void {
        super.deserializePlayerState(player, data);
        importXpRate(player, data.xpRate);
    }

    override contributeScriptServices(services: ScriptServices): void {
        super.contributeScriptServices(services);
        const messaging = this.serverServices?.messagingService;
        if (!messaging) {
            return;
        }
        const base = services.messaging;
        services.messaging = {
            ...base,
            sendGameMessage: (player, text) => base.sendGameMessage(player, text),
            queueNotification: (playerId, payload) => base.queueNotification(playerId, payload),
        };
        (services as ScriptServices & { broadcastGameMessage?: (text: string) => void }).broadcastGameMessage =
            (text: string) => {
                messaging.queueChatMessage({
                    messageType: "game",
                    text,
                });
            };
    }

    override registerHandlers(registry: IScriptRegistry, services: ScriptServices): void {
        super.registerHandlers(registry, services);
        registerGgwpAdminSkillWidgets(registry, services);
        registerGgwpCommands(registry, services);
    }
}

export function createGamemode(): GamemodeDefinition {
    return new GgwpGamemode();
}
