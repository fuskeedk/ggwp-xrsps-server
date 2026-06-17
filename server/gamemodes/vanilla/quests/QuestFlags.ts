import type { PlayerState } from "../../../src/game/player";

const STATE_KEY = "vanilla:questFlags";

export type QuestFlagStore = Record<string, boolean | string>;

function getStore(player: PlayerState): QuestFlagStore {
    let store = player.gamemodeState.get(STATE_KEY) as QuestFlagStore | undefined;
    if (!store) {
        store = {};
        player.gamemodeState.set(STATE_KEY, store);
    }
    return store;
}

export function questFlagKey(questKey: string, flag: string): string {
    return `${questKey}:${flag}`;
}

export function getQuestFlag(player: PlayerState, questKey: string, flag: string): boolean {
    const value = getStore(player)[questFlagKey(questKey, flag)];
    return value === true;
}

export function setQuestFlag(
    player: PlayerState,
    questKey: string,
    flag: string,
    value: boolean,
): void {
    getStore(player)[questFlagKey(questKey, flag)] = value;
}

export function getQuestStringFlag(
    player: PlayerState,
    questKey: string,
    flag: string,
): string | undefined {
    const value = getStore(player)[questFlagKey(questKey, flag)];
    return typeof value === "string" ? value : undefined;
}

export function setQuestStringFlag(
    player: PlayerState,
    questKey: string,
    flag: string,
    value: string,
): void {
    getStore(player)[questFlagKey(questKey, flag)] = value;
}

export function clearQuestFlags(player: PlayerState, questKey: string): void {
    const store = getStore(player);
    const prefix = `${questKey}:`;
    for (const key of Object.keys(store)) {
        if (key.startsWith(prefix)) {
            delete store[key];
        }
    }
}

export function exportQuestFlags(player: PlayerState): QuestFlagStore | undefined {
    const store = player.gamemodeState.get(STATE_KEY) as QuestFlagStore | undefined;
    if (!store || Object.keys(store).length === 0) return undefined;
    return { ...store };
}

export function importQuestFlags(player: PlayerState, flags: QuestFlagStore | undefined): void {
    if (!flags || Object.keys(flags).length === 0) {
        player.gamemodeState.delete(STATE_KEY);
        return;
    }
    player.gamemodeState.set(STATE_KEY, { ...flags });
}
