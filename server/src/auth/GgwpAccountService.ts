import argon2 from "argon2";
import { Pool } from "pg";

import { logger } from "../utils/logger";

const USERNAME_RE = /^[a-z0-9_]{3,12}$/;

export interface GgwpAccountRow {
    accountName: string;
    passwordHash: string;
    rights: string;
}

export type GgwpLoginResult =
    | { ok: true; displayName: string; rights: string }
    | { ok: false; message: string };

function isAuthEnabled(): boolean {
    const flag = (process.env.GGWP_AUTH_ENABLED ?? "1").trim().toLowerCase();
    return flag !== "0" && flag !== "false" && flag !== "off";
}

function jdbcToPgUrl(jdbcUrl: string, user: string, password: string): string {
    const match = jdbcUrl.match(/^jdbc:postgresql:\/\/([^/]+)\/(.+)$/);
    if (!match) {
        throw new Error("Invalid GGWP_POSTGRES_JDBC_URL");
    }
    const encodedUser = encodeURIComponent(user);
    const encodedPassword = encodeURIComponent(password);
    return `postgresql://${encodedUser}:${encodedPassword}@${match[1]}/${match[2]}`;
}

function buildConnectionString(): string {
    const direct = process.env.GGWP_POSTGRES_URL?.trim();
    if (direct) {
        return direct;
    }

    const user = process.env.GGWP_POSTGRES_USER?.trim() || "openrune";
    const password = process.env.GGWP_POSTGRES_PASSWORD ?? "";
    const jdbc = process.env.GGWP_POSTGRES_JDBC_URL?.trim();
    if (jdbc) {
        return jdbcToPgUrl(jdbc, user, password);
    }

    return jdbcToPgUrl("jdbc:postgresql://localhost:5432/openrune_central", user, password);
}

let pool: Pool | null = null;

function getPool(): Pool {
    if (pool) {
        return pool;
    }

    pool = new Pool({
        connectionString: buildConnectionString(),
        max: 5,
        idleTimeoutMillis: 30_000,
    });

    return pool;
}

export function ggwpAuthEnabled(): boolean {
    return isAuthEnabled();
}

export function isGgwpAdminRights(rights: string): boolean {
    const r = rights.trim().toLowerCase();
    return r === "modlevel.owner" || r === "modlevel.admin";
}

export async function verifyGgwpAccount(
    username: string,
    password: string,
): Promise<GgwpLoginResult> {
    if (!isAuthEnabled()) {
        return { ok: true, displayName: username.slice(0, 12), rights: "" };
    }

    const normalized = username.trim().toLowerCase();
    if (!USERNAME_RE.test(normalized)) {
        return { ok: false, message: "Invalid username or password." };
    }
    if (password.length < 1) {
        return { ok: false, message: "Invalid username or password." };
    }

    try {
        const result = await getPool().query<GgwpAccountRow>(
            `SELECT account_name AS "accountName", password_hash AS "passwordHash", rights
             FROM accounts
             WHERE lower(account_name) = lower($1)
             LIMIT 1`,
            [normalized],
        );
        const row = result.rows[0];
        if (!row?.passwordHash) {
            return { ok: false, message: "Invalid username or password." };
        }

        const valid = await argon2.verify(row.passwordHash, password);
        if (!valid) {
            return { ok: false, message: "Invalid username or password." };
        }

        return {
            ok: true,
            displayName: row.accountName.slice(0, 12),
            rights: row.rights ?? "",
        };
    } catch (err) {
        logger.error("[ggwp-auth] Database error during login", err);
        return { ok: false, message: "Login service unavailable. Try again shortly." };
    }
}

export async function closeGgwpAccountPool(): Promise<void> {
    if (pool) {
        await pool.end();
        pool = null;
    }
}
