import {
    MAX_REAL_LEVEL,
    SkillId,
    getXpForLevel,
} from "../../../src/rs/skill/skills";
import { TaskConditions } from "../../src/game/model/queue";
import type { PlayerState } from "../../src/game/player";
import type { IScriptRegistry, ScriptServices } from "../../src/game/scripts/types";
import {
    SKILL_GUIDE_ENTRIES,
    SKILLS_TAB_GROUP_ID,
    type SkillGuideEntry,
    openSkillGuidePanel,
} from "../vanilla/widgets/skillGuideWidgets";
import { isGgwpStaff } from "./auth";

/** OSRS stat-guide varbit value → internal SkillId (see StatComponents in OpenRune). */
const STAT_VARBIT_TO_SKILL_ID: Record<number, SkillId> = {
    1: SkillId.Attack,
    2: SkillId.Strength,
    3: SkillId.Ranged,
    4: SkillId.Magic,
    5: SkillId.Defence,
    6: SkillId.Hitpoints,
    7: SkillId.Prayer,
    8: SkillId.Agility,
    9: SkillId.Herblore,
    10: SkillId.Thieving,
    11: SkillId.Crafting,
    12: SkillId.Runecraft,
    13: SkillId.Mining,
    14: SkillId.Smithing,
    15: SkillId.Fishing,
    16: SkillId.Cooking,
    17: SkillId.Firemaking,
    18: SkillId.Woodcutting,
    19: SkillId.Fletching,
    20: SkillId.Slayer,
    21: SkillId.Farming,
    22: SkillId.Construction,
    23: SkillId.Hunter,
    24: SkillId.Sailing,
};

/** OSRS meslayer count dialog — same script as RSMod `mesLayerMode7` / `countDialog`. */
const MESLAYER_COUNT_DIALOG_SCRIPT = 108;

function resolveSkillId(entry: SkillGuideEntry): SkillId | undefined {
    return STAT_VARBIT_TO_SKILL_ID[entry.skillVarbitValue];
}

function countDialogPrompt(skillName: string): string {
    return `Enter a level for ${skillName} (1-99)`;
}

function applySkillLevel(
    player: PlayerState,
    services: ScriptServices,
    skillId: SkillId,
    level: number,
    skillName: string,
): void {
    const clamped = Math.max(1, Math.min(MAX_REAL_LEVEL, level | 0));
    const previousLevel = player.skillSystem.getSkill(skillId).baseLevel;
    const oldCombatLevel = player.skillSystem.combatLevel;

    // RSMod parity: reset current to base, set xp/base, then fire stat add/sub messages.
    player.skillSystem.setSkillBoost(skillId, previousLevel);
    player.skillSystem.setSkillXp(skillId, getXpForLevel(clamped));
    player.skillSystem.setSkillBoost(skillId, clamped);

    if (clamped > previousLevel) {
        services.system.eventBus?.emit("skill:levelUp", {
            player,
            skillId,
            oldLevel: previousLevel,
            newLevel: clamped,
        });
    }

    const newCombatLevel = player.skillSystem.combatLevel;
    if (newCombatLevel !== oldCombatLevel) {
        services.system.eventBus?.emit("combat:levelUp", {
            player,
            oldLevel: oldCombatLevel,
            newLevel: newCombatLevel,
        });
    }

    services.messaging.sendGameMessage(player, `Set ${skillName} to level ${clamped}.`);
}

function promptAdminSkillLevel(
    player: PlayerState,
    services: ScriptServices,
    entry: SkillGuideEntry,
): void {
    const skillId = resolveSkillId(entry);
    if (skillId === undefined) {
        services.messaging.sendGameMessage(player, "Unknown skill.");
        return;
    }

    player.queueStrong(function* (task) {
        // Let the options dialog finish closing before opening chatbox input.
        yield TaskConditions.wait(2);

        services.dialog.queueWidgetEvent(player.id, {
            action: "run_script",
            scriptId: MESLAYER_COUNT_DIALOG_SCRIPT,
            args: [countDialogPrompt(entry.skillName)],
        });

        yield TaskConditions.waitReturnValue(task);

        const raw = task.requestReturnValue;
        task.requestReturnValue = null;
        if (raw === null || raw === undefined) {
            return;
        }

        const parsed = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
        if (!Number.isFinite(parsed) || parsed < 1) {
            if (parsed === -1) {
                services.messaging.sendGameMessage(player, "Set level cancelled.");
            } else {
                services.messaging.sendGameMessage(player, "Invalid level.");
            }
            return;
        }

        applySkillLevel(player, services, skillId, parsed, entry.skillName);
    });
}

function handleAdminSkillClick(
    player: PlayerState,
    services: ScriptServices,
    entry: SkillGuideEntry,
): void {
    if (!services.dialog.openDialogOptions) {
        openSkillGuidePanel(player, services, entry);
        return;
    }

    // RSMod parity: close any open overlay before presenting Guide / Set Level.
    services.dialog.closeDialog(player);

    services.dialog.openDialogOptions(player, {
        id: `ggwp_skill_admin_${entry.childId}`,
        title: entry.skillName,
        options: ["Guide", "Set Level"],
        onSelect: (choice) => {
            if (choice === 0) {
                openSkillGuidePanel(player, services, entry);
                return;
            }
            if (choice === 1) {
                promptAdminSkillLevel(player, services, entry);
            }
        },
    });
}

/**
 * Re-registers skills-tab (320) handlers so staff can choose Guide or Set level.
 * Must run after vanilla registerSkillGuideWidgetHandlers (overwrites button handlers).
 */
export function registerGgwpAdminSkillWidgets(
    registry: IScriptRegistry,
    services: ScriptServices,
): void {
    for (const entry of SKILL_GUIDE_ENTRIES) {
        registry.onButton(SKILLS_TAB_GROUP_ID, entry.childId, (event) => {
            const player = event.player;
            if (!isGgwpStaff(player)) {
                openSkillGuidePanel(player, services, entry);
                return;
            }
            handleAdminSkillClick(player, services, entry);
        });
    }
}

export function setPlayerSkillLevel(
    player: PlayerState,
    services: ScriptServices,
    skillId: SkillId,
    level: number,
): string | void {
    if (!isGgwpStaff(player)) {
        return "You do not have permission to use that command.";
    }
    const name =
        SKILL_GUIDE_ENTRIES.find((entry) => resolveSkillId(entry) === skillId)?.skillName ??
        `Skill ${skillId}`;
    applySkillLevel(player, services, skillId, level, name);
}
