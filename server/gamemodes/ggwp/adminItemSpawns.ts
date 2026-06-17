import type { ServerServices } from "../../src/game/ServerServices";
import type { PlayerState } from "../../src/game/player";
import { logger } from "../../src/utils/logger";
import { getGgwpCharacterId } from "./membership";
import { getGgwpGamePool } from "./gameDb";
import { resolveAdminSpawnItem } from "./adminSpawnItem";
import { resolveSpawnNameToItemId } from "./spawnCatalog";

type PendingSpawn = {
    id: number;
    spawnName: string;
    quantity: number;
};

export class GgwpAdminItemSpawnService {
    private readonly processing = new Set<number>();

    constructor(private readonly svc: ServerServices) {}

    tick(): void {
        const players = this.svc.players;
        if (!players) {
            return;
        }
        players.forEach((_ws, player) => {
            void this.processPlayer(player);
        });
    }

    private async processPlayer(player: PlayerState): Promise<void> {
        if (this.processing.has(player.id)) {
            return;
        }
        this.processing.add(player.id);
        try {
            await this.processPlayerInner(player);
        } finally {
            this.processing.delete(player.id);
        }
    }

    private async processPlayerInner(player: PlayerState): Promise<void> {
        const characterId = getGgwpCharacterId(player);
        if (characterId <= 0) {
            return;
        }

        let pending: PendingSpawn[] = [];
        try {
            const result = await getGgwpGamePool().query<{
                id: number;
                spawn_name: string;
                quantity: number;
            }>(
                `SELECT id, spawn_name, quantity
                 FROM admin_item_spawns
                 WHERE character_id = $1 AND processed_at IS NULL
                 ORDER BY id
                 LIMIT 25`,
                [characterId],
            );
            pending = result.rows.map((row) => ({
                id: row.id | 0,
                spawnName: String(row.spawn_name ?? ""),
                quantity: Math.max(1, Number(row.quantity) || 1),
            }));
        } catch (err) {
            logger.warn(`[ggwp-admin-spawn] fetch failed for ${player.name}`, err);
            return;
        }

        if (pending.length === 0) {
            return;
        }

        for (const request of pending) {
            const error = this.deliverSpawn(player, request);
            try {
                await getGgwpGamePool().query(
                    `UPDATE admin_item_spawns
                     SET processed_at = CURRENT_TIMESTAMP,
                         error_message = $2
                     WHERE id = $1`,
                    [request.id, error],
                );
            } catch (err) {
                logger.warn(`[ggwp-admin-spawn] mark processed failed id=${request.id}`, err);
            }
        }
    }

    private deliverSpawn(player: PlayerState, request: PendingSpawn): string | null {
        const itemId = resolveSpawnNameToItemId(request.spawnName);
        if (!itemId || itemId <= 0) {
            const message = `Unknown item: ${request.spawnName}`;
            logger.warn(`[ggwp-admin-spawn] ${player.name}: ${message}`);
            return message;
        }

        const quantity = Math.max(1, request.quantity | 0);
        const delivery = resolveAdminSpawnItem(itemId, quantity);
        const result = this.svc.inventoryService.addItemToInventory(
            player,
            delivery.itemId,
            quantity,
        );
        if (result.added <= 0) {
            const message = "Not enough inventory space.";
            this.svc.messagingService.sendGameMessageToPlayer(player, message);
            logger.warn(`[ggwp-admin-spawn] ${player.name}: ${message} (${request.spawnName})`);
            return message;
        }

        const sock = this.svc.players?.getSocketByPlayerId(player.id);
        if (sock) {
            this.svc.inventoryService.sendInventorySnapshot(sock, player);
        }

        const delivered = result.added | 0;
        const noteSuffix = delivery.asNotes ? " (noter)" : "";
        this.svc.messagingService.sendGameMessageToPlayer(
            player,
            `Admin spawn: ${request.spawnName} x ${delivered}${noteSuffix}`,
        );
        logger.info(
            `[ggwp-admin-spawn] delivered to ${player.name}: ${request.spawnName} x ${delivered} (id=${request.id})`,
        );
        return null;
    }
}
