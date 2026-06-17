import { SkillId } from "../../../../src/rs/skill/skills";
import type { PlayerState } from "../../../src/game/player";
import type { NpcInteractionEvent, ScriptServices } from "../../../src/game/scripts/types";
import { registerQuestNpcTalk } from "../quests/helpers";
import { skillCapeForSkill } from "./skillCapes";
import {
    SKILL_CAPE_MENU_OPTION,
    startSkillCapeExplanation,
    withSkillCapeMenuOption,
} from "./skillCapePurchases";

export type SkillMasterEntry = {
    npcId: number;
    name: string;
    skillId: SkillId;
    greeting?: string;
    capeExplanation?: string;
};

/** Lumbridge tutors — full tutorial dialogue in skillTutors.ts */
const LUMBRIDGE_TUTOR_NPC_IDS = new Set([
    3216, 3217, 3218, 3219, 3220, 3221, 3222, 3223, 3224, 3225, 3226,
]);

/** Aubury — rune shop + cape flow in shopInteractions.ts */
const CUSTOM_HANDLER_NPC_IDS = new Set([2886, 11434]);

const DEFAULT_CAPE_EXPLANATION =
    "Only someone who has achieved the highest possible level in a skill can wear one.";

const SKILL_MASTERS: SkillMasterEntry[] = [
    { npcId: 2460, name: "Ajjat", skillId: SkillId.Attack },
    { npcId: 2473, name: "Sloane", skillId: SkillId.Strength },
    { npcId: 6059, name: "Armour salesman", skillId: SkillId.Ranged },
    { npcId: 3343, name: "Surgeon General Tafani", skillId: SkillId.Hitpoints },
    { npcId: 2578, name: "Brother Jered", skillId: SkillId.Prayer },
    { npcId: 3249, name: "Wizard Sinina", skillId: SkillId.Magic },
    { npcId: 2658, name: "Head chef", skillId: SkillId.Cooking },
    { npcId: 2913, name: "Master fisher", skillId: SkillId.Fishing },
    {
        npcId: 118,
        name: "Ignatius Vulcan",
        skillId: SkillId.Firemaking,
        capeExplanation:
            "This is a Skillcape of Firemaking. When worn, it acts as a warm light source. Only someone who has achieved the highest possible level in a skill can wear one.",
    },
    { npcId: 5810, name: "Master Crafter", skillId: SkillId.Crafting },
    { npcId: 5811, name: "Master Crafter", skillId: SkillId.Crafting },
    { npcId: 5812, name: "Master Crafter", skillId: SkillId.Crafting },
    { npcId: 4733, name: "Thurgo", skillId: SkillId.Smithing },
    { npcId: 7716, name: "Gadrin", skillId: SkillId.Mining },
    { npcId: 5045, name: "Kaqemeex", skillId: SkillId.Herblore },
    { npcId: 3212, name: "Hickton", skillId: SkillId.Fletching },
    { npcId: 5789, name: "Cap'n Izzy No-Beard", skillId: SkillId.Agility },
    { npcId: 3193, name: "Martin Thwait", skillId: SkillId.Thieving },
    { npcId: 5832, name: "Martin the Master Gardener", skillId: SkillId.Farming },
    {
        npcId: 2886,
        name: "Aubury",
        skillId: SkillId.Runecraft,
        capeExplanation:
            "The Cape of Runecrafting lets you access any runic altar without talismans or tiaras. Only someone who has achieved the highest possible level in a skill can wear one.",
    },
    { npcId: 1504, name: "Hunting expert", skillId: SkillId.Hunter },
    { npcId: 5529, name: "Hunting expert", skillId: SkillId.Hunter },
    { npcId: 1503, name: "Hunting expert", skillId: SkillId.Hunter },
    { npcId: 3097, name: "Estate agent", skillId: SkillId.Construction },
    { npcId: 401, name: "Turael", skillId: SkillId.Slayer },
    { npcId: 402, name: "Mazchna", skillId: SkillId.Slayer },
    { npcId: 403, name: "Vannaka", skillId: SkillId.Slayer },
    { npcId: 404, name: "Chaeldar", skillId: SkillId.Slayer },
    { npcId: 405, name: "Duradel", skillId: SkillId.Slayer },
    { npcId: 1455, name: "Nieve", skillId: SkillId.Slayer },
    { npcId: 7663, name: "Krystilia", skillId: SkillId.Slayer },
    { npcId: 8623, name: "Konar quo Maten", skillId: SkillId.Slayer },
];

const byNpcId = new Map<number, SkillMasterEntry>();
for (const entry of SKILL_MASTERS) {
    byNpcId.set(entry.npcId, entry);
}

export function skillMasterForNpc(npcId: number): SkillMasterEntry | undefined {
    return byNpcId.get(npcId);
}

export function isSkillMasterNpc(npcId: number): boolean {
    return byNpcId.has(npcId);
}

type DialogContext = {
    player: NpcInteractionEvent["player"];
    services: ScriptServices;
    base: string;
    npcName: string;
};

function openNpcDialog(
    ctx: DialogContext,
    dialogId: string,
    npcId: number,
    lines: string[],
    onContinue?: () => void,
): void {
    ctx.services.dialog.openDialog(ctx.player, {
        kind: "npc",
        id: dialogId,
        npcId,
        npcName: ctx.npcName,
        lines,
        clickToContinue: true,
        closeOnContinue: !onContinue,
        onContinue,
        onClose: () => ctx.services.dialog.closeDialog(ctx.player, dialogId),
    });
}

function openOptions(
    ctx: DialogContext,
    dialogId: string,
    options: string[],
    onSelect: (choice: number) => void,
): void {
    ctx.services.dialog.openDialogOptions(ctx.player, {
        id: dialogId,
        title: "Select an Option",
        options,
        onSelect,
    });
}

function capeExplanation(entry: SkillMasterEntry): string {
    if (entry.capeExplanation) return entry.capeExplanation;
    const cape = skillCapeForSkill(entry.skillId);
    if (!cape) return DEFAULT_CAPE_EXPLANATION;
    return `This is a Skillcape of ${cape.displayName}. ${DEFAULT_CAPE_EXPLANATION}`;
}

function handleCapeChoice(
    ctx: DialogContext,
    entry: SkillMasterEntry,
    options: string[],
    choice: number,
    onDone?: () => void,
): void {
    if (options[choice] !== SKILL_CAPE_MENU_OPTION) {
        onDone?.();
        return;
    }
    const cape = skillCapeForSkill(entry.skillId);
    if (!cape) return;
    startSkillCapeExplanation(
        { player: ctx.player, services: ctx.services, base: ctx.base, npcName: ctx.npcName },
        cape,
        capeExplanation(entry),
        onDone,
    );
}

/** Opens the standard skill-master talk menu (cape purchase). */
export function openSkillMasterDialog(
    event: NpcInteractionEvent,
    services: ScriptServices,
    entry: SkillMasterEntry,
    onDone?: () => void,
): void {
    openSkillMasterDialogForPlayer(event.player, services, entry, onDone);
}

export function openSkillMasterDialogForPlayer(
    player: PlayerState,
    services: ScriptServices,
    entry: SkillMasterEntry,
    onDone?: () => void,
): void {
    const ctx: DialogContext = {
        player,
        services,
        base: `skill_master_${entry.npcId}_${player.id}`,
        npcName: entry.name,
    };
    const greeting = entry.greeting ?? `Hello. I'm ${entry.name}.`;
    const openMenu = () => {
        const options = withSkillCapeMenuOption(["Goodbye."]);
        openOptions(ctx, `${ctx.base}_menu`, options, (choice) => {
            if (options[choice] === "Goodbye.") {
                services.dialog.closeDialog(player, `${ctx.base}_menu`);
                onDone?.();
                return;
            }
            handleCapeChoice(ctx, entry, options, choice, openMenu);
        });
    };
    openNpcDialog(ctx, `${ctx.base}_greeting`, entry.npcId, [greeting], () => {
        services.dialog.closeDialog(player, `${ctx.base}_greeting`);
        openMenu();
    });
}

/** Extra quest dialogue options for NPCs that are also skill masters. */
export function skillMasterQuestOptions(entry: SkillMasterEntry): Array<{
    text: string;
    next: Array<Record<string, unknown>>;
}> {
    const cape = skillCapeForSkill(entry.skillId);
    if (!cape) return [];
    return [
        {
            text: SKILL_CAPE_MENU_OPTION,
            next: [
                { player: [SKILL_CAPE_MENU_OPTION] },
                { npc: [capeExplanation(entry)] },
                {
                    exec: (d: { player: DialogContext["player"]; services: ScriptServices }) => {
                        const skill = d.services.skills.getSkill(d.player, entry.skillId);
                        if ((skill?.baseLevel ?? 1) < 99) return;
                        startSkillCapeExplanation(
                            {
                                player: d.player,
                                services: d.services,
                                base: `skill_master_${entry.npcId}_${d.player.id}`,
                                npcName: entry.name,
                            },
                            cape,
                            capeExplanation(entry),
                        );
                    },
                },
            ],
        },
    ];
}

export function registerSkillMasterHandlers(
    registry: Parameters<typeof registerQuestNpcTalk>[0],
    services: ScriptServices,
): void {
    const registered = new Set<number>();
    for (const entry of SKILL_MASTERS) {
        if (registered.has(entry.npcId)) continue;
        if (LUMBRIDGE_TUTOR_NPC_IDS.has(entry.npcId)) continue;
        if (CUSTOM_HANDLER_NPC_IDS.has(entry.npcId)) continue;
        registered.add(entry.npcId);
        registerQuestNpcTalk(registry, entry.npcId, (event) =>
            openSkillMasterDialog(event, services, entry),
        );
    }
}
