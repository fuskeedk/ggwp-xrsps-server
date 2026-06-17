import { MAX_REAL_LEVEL, SkillId, getXpForLevel } from "../../../src/rs/skill/skills";
import { getItemDefinition, loadItemDefinitions } from "../../src/game/scripts/serviceInterfaces";
import type { CommandEvent, IScriptRegistry, ScriptServices } from "../../src/game/scripts/types";
import type { PlayerState } from "../../src/game/player";
import { requireStaff } from "./auth";
import { resolveAdminSpawnItem } from "./adminSpawnItem";
import { GGWP_SPAWN } from "./config";
import {
    formatXpRateOptions,
    getPlayerXpRate,
    setPlayerXpRate,
} from "./xpRate";
import {
    purchaseSkillCapeMessage,
    resolveSkillCape,
    SKILL_CAPES,
    type SkillCapeDefinition,
} from "../vanilla/skillCapes/skillCapes";
import {
    listMaxedSkillCapes,
    ownsSkillCape,
    purchaseSkillCape as executeSkillCapePurchase,
    SkillCapePurchaseResult,
} from "../vanilla/skillCapes/skillCapePurchases";
import { setPlayerSkillLevel } from "./adminSkillWidgets";

const YELL_COOLDOWN_MS = 30_000;
const MAX_YELL_LENGTH = 80;
const yellCooldowns = new Map<string, number>();

type GgwpCommandServices = ScriptServices & {
    broadcastGameMessage?: (text: string) => void;
};

function servicesOf(services: ScriptServices): GgwpCommandServices {
    return services as GgwpCommandServices;
}

function send(player: PlayerState, services: ScriptServices, text: string): void {
    services.messaging.sendGameMessage(player, text);
}

function broadcast(services: ScriptServices, text: string): void {
    servicesOf(services).broadcastGameMessage?.(text);
}

function register(
    registry: IScriptRegistry,
    names: string[],
    handler: (event: CommandEvent) => string | void,
): void {
    for (const name of names) {
        registry.registerCommand(name, handler);
    }
}

function registerStaff(
    registry: IScriptRegistry,
    names: string[],
    handler: (event: CommandEvent) => string | void,
): void {
    register(registry, names, (event) => {
        const denied = requireStaff(event.player);
        if (denied) {
            return denied;
        }
        return handler(event);
    });
}

function showHelp(player: PlayerState, services: ScriptServices): void {
    const lines = [
        "Velkommen til ggwp OSRS!",
        "",
        "Kommandoer:",
        "::bank - åbn bank",
        "::home - teleporter til spawn",
        "::yell <besked> - global chat (30 sek. cooldown)",
        "::xprate [rate] - vælg XP rate (1x, 5x, 10x, 25x, 50x, 100x)",
        "::skillcape <skill> - køb skillcape ved 99",
        "::help - vis denne besked igen",
        "",
        "Admin: ::tele ::ge ::mypos ::master ::reset ::setskill ::invadd ::itemsearch",
        "",
        "Skill capes koster 99.000 gp + gratis hood.",
        "Skill capes cost 99.000 gp + hood. Buy them from skill masters across Gielinor (or Lumbridge tutors) at 99.",
    ];
    for (const line of lines) {
        send(player, services, line);
    }
}

function purchaseSkillcape(
    player: PlayerState,
    services: ScriptServices,
    cape: SkillCapeDefinition,
): string {
    const alreadyOwned = ownsSkillCape(player, services, cape);
    const result = executeSkillCapePurchase(player, services, cape, SKILL_CAPES);
    if (result === SkillCapePurchaseResult.Success && alreadyOwned) {
        return `You receive another ${cape.displayName} hood.`;
    }
    if (result === SkillCapePurchaseResult.Success) {
        return `You purchase a ${cape.displayName} skillcape and hood for 99,000 coins.`;
    }
    return purchaseSkillCapeMessage(result, cape);
}

function setAllSkills(player: PlayerState, level: number): void {
    const xp = getXpForLevel(level);
    for (let skillId = SkillId.Attack; skillId <= SkillId.Construction; skillId++) {
        player.skillSystem.setSkillXp(skillId, xp);
    }
}

export function registerGgwpCommands(registry: IScriptRegistry, services: ScriptServices): void {
    register(registry, ["bank", "openbank", "ob"], ({ player }) => {
        if (!services.banking?.openBank) {
            return "Banking is unavailable.";
        }
        services.banking.openBank(player, { mode: "bank" });
        return "Opening your bank.";
    });

    register(registry, ["home"], ({ player }) => {
        services.movement.teleportPlayer(
            player,
            GGWP_SPAWN.x,
            GGWP_SPAWN.y,
            GGWP_SPAWN.level,
        );
        return "Welcome home.";
    });

    register(registry, ["help"], ({ player }) => {
        showHelp(player, services);
    });

    register(registry, ["yell"], ({ player, args }) => {
        if (args.length === 0) {
            return "Usage: ::yell <message>";
        }
        const now = Date.now();
        const key = player.name?.trim().toLowerCase() ?? String(player.id);
        const last = yellCooldowns.get(key) ?? 0;
        const remaining = YELL_COOLDOWN_MS - (now - last);
        if (remaining > 0) {
            const seconds = Math.ceil(remaining / 1000);
            return `You must wait ${seconds} more second(s) before yelling again.`;
        }

        const message = args.join(" ").trim();
        if (!message) {
            return "Usage: ::yell <message>";
        }
        if (message.length > MAX_YELL_LENGTH) {
            return `Your message is too long. Maximum length is ${MAX_YELL_LENGTH} characters.`;
        }

        yellCooldowns.set(key, now);
        const playerName = player.name || "Player";
        broadcast(services, `[Yell] ${playerName}: ${message}`);
    });

    register(registry, ["xprate", "rate", "xp"], ({ player, args }) => {
        if (args.length === 0) {
            const current = getPlayerXpRate(player);
            return `Din XP rate er ${current}x. Tilgængelige: ${formatXpRateOptions()}. Brug: ::xprate <rate>`;
        }
        const raw = args[0].trim().toLowerCase().replace(/x$/, "");
        const parsed = Number(raw);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            return `Ugyldig rate. Vælg mellem: ${formatXpRateOptions()}.`;
        }
        const next = setPlayerXpRate(player, parsed);
        return `XP rate sat til ${next}x.`;
    });

    register(registry, ["skillcape", "cape"], ({ player, args }) => {
        if (args.length === 0) {
            const available = listMaxedSkillCapes(player, services, SKILL_CAPES);
            if (available.length === 0) {
                return "You need level 99 in a skill to buy a skillcape.";
            }
            return `Skills available: ${available.map((c) => c.displayName).join(", ")}. Usage: ::skillcape <skill>`;
        }
        const cape = resolveSkillCape(args.join(" "));
        if (!cape) {
            return "Unknown skill. Try: fishing, mining, slayer, cooking, etc.";
        }
        return purchaseSkillcape(player, services, cape);
    });

    registerStaff(registry, ["mypos"], ({ player }) => {
        return `Position: ${player.tileX}, ${player.tileY}, ${player.tileLevel}`;
    });

    registerStaff(registry, ["tele"], ({ player, args }) => {
        const parts =
            args.length === 1 ? args[0].split(",").map((part) => part.trim()) : args;
        const x = Number(parts[0]);
        const y = Number(parts[1]);
        const level = Number(parts[2] ?? player.tileLevel);
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(level)) {
            return "Usage: ::tele x y [level]";
        }
        services.movement.teleportPlayer(player, x, y, level);
        return `Teleported to ${x}, ${y}, ${level}.`;
    });

    registerStaff(registry, ["ge"], ({ player }) => {
        services.movement.teleportPlayer(player, 3165, 3487, 0);
        return "Teleported to the Grand Exchange.";
    });

    registerStaff(registry, ["up"], ({ player, args }) => {
        const amount = Math.max(1, Number(args[0] ?? 1) || 1);
        services.movement.teleportPlayer(
            player,
            player.tileX,
            player.tileY,
            player.tileLevel + amount,
        );
        return `Moved up ${amount} level(s).`;
    });

    registerStaff(registry, ["down"], ({ player, args }) => {
        const amount = Math.max(1, Number(args[0] ?? 1) || 1);
        const level = Math.max(0, player.tileLevel - amount);
        services.movement.teleportPlayer(player, player.tileX, player.tileY, level);
        return `Moved down ${amount} level(s).`;
    });

    registerStaff(registry, ["master"], ({ player }) => {
        setAllSkills(player, MAX_REAL_LEVEL);
        return "All stats set to 99.";
    });

    registerStaff(registry, ["reset"], ({ player }) => {
        setAllSkills(player, 1);
        return "All stats reset to 1.";
    });

    registerStaff(registry, ["setskill", "setlevel"], ({ player, args, services }) => {
        const skillName = args[0]?.trim().toLowerCase();
        const level = Number(args[1]);
        if (!skillName || !Number.isFinite(level)) {
            return "Usage: ::setskill <skill> <level>";
        }
        const cape = resolveSkillCape(skillName);
        if (!cape) {
            return "Unknown skill. Try: attack, fishing, slayer, etc.";
        }
        return setPlayerSkillLevel(player, services, cape.skillId, level);
    });

    registerStaff(registry, ["invclear", "clearinv"], ({ player }) => {
        player.items.clearInventory();
        services.inventory.snapshotInventory(player);
        return "Inventory cleared.";
    });

    registerStaff(registry, ["itemsearch"], ({ args }) => {
        const query = args.join(" ").trim().toLowerCase();
        if (!query) {
            return "Usage: ::itemsearch <name>";
        }
        const matches = loadItemDefinitions()
            .filter((item) => item.name?.toLowerCase().includes(query))
            .slice(0, 8);
        if (matches.length === 0) {
            return `No items found for "${query}".`;
        }
        return matches.map((item) => `${item.id}: ${item.name}`).join(" | ");
    });

    registerStaff(registry, ["invadd"], ({ player, args }) => {
        const itemId = Number(args[0]);
        const qty = Math.max(1, Number(args[1] ?? 1) || 1);
        if (!Number.isFinite(itemId) || itemId <= 0) {
            return "Usage: ::invadd <itemId> [qty]";
        }
        const def = getItemDefinition(itemId);
        if (!def) {
            return `Unknown item id ${itemId}.`;
        }
        const delivery = resolveAdminSpawnItem(itemId, qty);
        const result = services.inventory.addItemToInventory(player, delivery.itemId, qty);
        services.inventory.snapshotInventory(player);
        const noteSuffix = delivery.asNotes ? " (noter)" : "";
        return result.added > 0
            ? `Added ${result.added}x ${def.name ?? itemId}${noteSuffix}.`
            : "Not enough inventory space.";
    });
}
