import fs from "fs";
import path from "path";

import type { GeRuntimeState } from "./GrandExchangeManager";
import { GrandExchangeManager } from "./GrandExchangeManager";

const STATE_PATH = path.resolve("server/data/ge/state.json");

export class GrandExchangeStore {
    constructor(private readonly manager: GrandExchangeManager) {}

    load(): void {
        if (!fs.existsSync(STATE_PATH)) return;
        try {
            const json = fs.readFileSync(STATE_PATH, "utf8");
            const state = JSON.parse(json) as GeRuntimeState | null;
            if (state) {
                this.manager.restore(state);
            }
        } catch (error) {
            console.warn("[GrandExchangeStore] Failed to load state:", error);
        }
    }

    save(): void {
        try {
            const state = this.manager.export();
            fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
            const tempPath = `${STATE_PATH}.tmp`;
            fs.writeFileSync(tempPath, JSON.stringify(state, null, 2));
            fs.renameSync(tempPath, STATE_PATH);
        } catch (error) {
            console.warn("[GrandExchangeStore] Failed to save state:", error);
        }
    }
}
