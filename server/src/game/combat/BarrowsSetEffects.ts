/**
 * Barrows armour set passive on-hit effects (OSRS parity).
 *
 * Requires the full four-piece set plus matching weapon. Each effect has a 25% proc chance.
 */
import { SkillId } from "../../../../src/rs/skill/skills";
import { ensureEquipArrayOn } from "../equipment";
import type { NpcState } from "../npc";
import type { PlayerState } from "../player";
import { AttackType } from "./AttackType";
import { hasBarrowsSet } from "./BarrowsEquipment";
import { hasAhrimsDamnedSet } from "./EquipmentBonusProvider";

export const BARROWS_SET_PROC_CHANCE = 0.25;

const TORAG_NPC_STATS = ["attack", "strength", "defence", "magic", "ranged"] as const;

function rollProc(random: () => number): boolean {
    return random() < BARROWS_SET_PROC_CHANCE;
}

function getEquipment(player: PlayerState): number[] {
    return ensureEquipArrayOn(player.appearance);
}

function drainPlayerSkillPercent(player: PlayerState, skillId: SkillId, percent: number): void {
    const skill = player.skillSystem.getSkill(skillId);
    const current = Math.max(1, skill.baseLevel + skill.boost);
    const drain = Math.max(1, Math.floor(current * percent));
    player.skillSystem.setSkillBoost(skillId, Math.max(1, current - drain));
}

function drainPlayerSkillFlat(player: PlayerState, skillId: SkillId, amount: number): void {
    const skill = player.skillSystem.getSkill(skillId);
    const current = Math.max(1, skill.baseLevel + skill.boost);
    player.skillSystem.setSkillBoost(skillId, Math.max(1, current - amount));
}

/**
 * Apply barrows set passives when the player hits an NPC.
 * Returns true if player skills were modified (caller should sync).
 */
export function applyBarrowsSetOnNpcHit(
    player: PlayerState,
    npc: NpcState,
    attackType: AttackType,
    damageDealt: number,
    random: () => number = Math.random,
): boolean {
    if (damageDealt <= 0) return false;

    const equipment = getEquipment(player);
    let skillsChanged = false;

    if (hasBarrowsSet(equipment, "guthan") && rollProc(random)) {
        player.skillSystem.applyHitpointsHeal(damageDealt);
        skillsChanged = true;
    }

    if (hasBarrowsSet(equipment, "torag") && rollProc(random)) {
        for (const stat of TORAG_NPC_STATS) {
            npc.drainCombatStat(stat, 1);
        }
    }

    if (
        hasBarrowsSet(equipment, "ahrim") &&
        attackType === AttackType.Magic &&
        rollProc(random)
    ) {
        npc.drainCombatStat("strength", 5);
        if (hasAhrimsDamnedSet(equipment)) {
            npc.drainCombatStat("magic", 5);
        }
    }

    return skillsChanged;
}

/**
 * Apply barrows set passives when the player hits another player.
 * Returns true if either player's skills/energy were modified.
 */
export function applyBarrowsSetOnPlayerHit(
    attacker: PlayerState,
    target: PlayerState,
    attackType: AttackType,
    damageDealt: number,
    random: () => number = Math.random,
): boolean {
    if (damageDealt <= 0) return false;

    const equipment = getEquipment(attacker);
    let changed = false;

    if (hasBarrowsSet(equipment, "guthan") && rollProc(random)) {
        attacker.skillSystem.applyHitpointsHeal(damageDealt);
        changed = true;
    }

    if (hasBarrowsSet(equipment, "torag") && rollProc(random)) {
        const targetUnits = target.energy.getRunEnergyUnits();
        const drainUnits = Math.floor(targetUnits * 0.2);
        if (drainUnits > 0) {
            target.energy.adjustRunEnergyUnits(-drainUnits);
            changed = true;
        }
    }

    if (
        hasBarrowsSet(equipment, "karil") &&
        attackType === AttackType.Ranged &&
        rollProc(random)
    ) {
        drainPlayerSkillPercent(target, SkillId.Agility, 0.2);
        changed = true;
    }

    if (
        hasBarrowsSet(equipment, "ahrim") &&
        attackType === AttackType.Magic &&
        rollProc(random)
    ) {
        drainPlayerSkillFlat(target, SkillId.Strength, 5);
        if (hasAhrimsDamnedSet(equipment)) {
            drainPlayerSkillFlat(target, SkillId.Magic, 5);
        }
        changed = true;
    }

    return changed;
}
