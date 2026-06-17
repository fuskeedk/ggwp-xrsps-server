import type { PlayerState } from "../../src/game/player";
import { GGWP_XP_MULTIPLIER } from "./config";

const XP_RATE_KEY = "ggwp:xpRate";

/** Allowed per-player XP multipliers on ggwp. */
export const GGWP_XP_RATE_OPTIONS = [1, 5, 10, 25, 50, 100] as const;

export type GgwpXpRate = (typeof GGWP_XP_RATE_OPTIONS)[number];

function normalizeXpRate(value: unknown): GgwpXpRate {
    const numeric = Math.trunc(Number(value));
    if ((GGWP_XP_RATE_OPTIONS as readonly number[]).includes(numeric)) {
        return numeric as GgwpXpRate;
    }
    return GGWP_XP_MULTIPLIER as GgwpXpRate;
}

export function getPlayerXpRate(player: PlayerState): number {
    const stored = player.gamemodeState.get(XP_RATE_KEY);
    if (stored === undefined || stored === null) {
        return GGWP_XP_MULTIPLIER;
    }
    return normalizeXpRate(stored);
}

export function setPlayerXpRate(player: PlayerState, rate: number): GgwpXpRate {
    const normalized = normalizeXpRate(rate);
    player.gamemodeState.set(XP_RATE_KEY, normalized);
    return normalized;
}

export function formatXpRateOptions(): string {
    return GGWP_XP_RATE_OPTIONS.map((rate) => `${rate}x`).join(", ");
}

export function exportXpRate(player: PlayerState): number | undefined {
    const rate = getPlayerXpRate(player);
    if (rate === GGWP_XP_MULTIPLIER) {
        return undefined;
    }
    return rate;
}

export function importXpRate(player: PlayerState, rate: unknown): void {
    if (rate === undefined || rate === null) {
        return;
    }
    setPlayerXpRate(player, Number(rate));
}
