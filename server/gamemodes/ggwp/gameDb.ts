import { Pool } from "pg";

import { logger } from "../../src/utils/logger";

let pool: Pool | null = null;

function buildGameConnectionString(): string {
    const direct = process.env.GGWP_GAME_POSTGRES_URL?.trim();
    if (direct) {
        return direct;
    }

    const user = process.env.GGWP_POSTGRES_USER?.trim() || "openrune";
    const password = process.env.GGWP_POSTGRES_PASSWORD ?? "";
    const host =
        process.env.GGWP_GAME_POSTGRES_HOST?.trim() ||
        process.env.GGWP_POSTGRES_HOST?.trim() ||
        "localhost";
    const port = Number(process.env.GGWP_GAME_POSTGRES_PORT ?? process.env.GGWP_POSTGRES_PORT ?? 5432);
    const database = process.env.GGWP_GAME_POSTGRES_DATABASE?.trim() || "openrune_game";
    const encodedUser = encodeURIComponent(user);
    const encodedPassword = encodeURIComponent(password);

    return `postgresql://${encodedUser}:${encodedPassword}@${host}:${port}/${database}`;
}

export function getGgwpGamePool(): Pool {
    if (!pool) {
        pool = new Pool({
            connectionString: buildGameConnectionString(),
            max: 5,
            idleTimeoutMillis: 30_000,
        });
    }
    return pool;
}

export async function closeGgwpGamePool(): Promise<void> {
    if (pool) {
        await pool.end().catch((err) => {
            logger.warn("[ggwp-game-db] pool close failed", err);
        });
        pool = null;
    }
}
