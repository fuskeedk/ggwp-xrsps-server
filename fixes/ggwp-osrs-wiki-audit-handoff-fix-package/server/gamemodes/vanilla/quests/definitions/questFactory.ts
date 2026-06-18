import type { IScriptRegistry } from "../../../../../src/game/scripts/types";
import { getQuestFlag, setQuestFlag } from "../QuestFlags";
import {
    completeQuest,
    getQuestStage,
    hasQuestItems,
    setQuestStage,
    takeQuestItems,
} from "../QuestService";
import { type DialogueContext, startConversation } from "../dialogue";
import {
    buildCompleteJournal,
    buildItemProgressJournal,
    buildNotStartedJournal,
    registerQuestNpcTalk,
    strikeIf,
} from "../helpers";
import type { QuestDefinition, QuestItemRequirement } from "../types";
import { addItemIfMissing } from "./questUtils";
import {
    openSkillMasterDialogForPlayer,
    skillMasterForNpc,
    skillMasterQuestOptions,
} from "../../skillCapes/skillMasters";

function startOptionsForSkillMasterNpc(npcId: number, baseOptions: Array<{ text: string; next: unknown[] }>) {
    const master = skillMasterForNpc(npcId);
    if (!master) return baseOptions;
    return [...baseOptions, ...skillMasterQuestOptions(master)];
}

export function simpleQuest(opts: {
    key: string;
    name: string;
    varpId: number;
    progressVarbitId?: number;
    startedValue: number;
    completionValue: number;
    rewards: QuestDefinition["rewards"];
    rewardItemId?: number;
    overviewStartText: string;
    startNpc: { id: number; name: string };
    startText: string;
    startNpcActive?: string;
    steps: Array<{
        npc: { id: number; name: string };
        flag: string;
        line: string;
        item?: { id: number; qty?: number };
    }>;
    finishNpc: { id: number; name: string };
    finishFlag?: string;
    finishText: string;
    journalIntro: string;
    journalDone: string[];
    prereq?: (player: Parameters<typeof getQuestStage>[0]) => boolean;
    prereqText?: string;
}): QuestDefinition {
    const q: QuestDefinition = {
        key: opts.key,
        name: opts.name,
        varpId: opts.varpId,
        progressVarbitId: opts.progressVarbitId,
        startedValue: opts.startedValue,
        completionValue: opts.completionValue,
        rewards: opts.rewards,
        rewardItemId: opts.rewardItemId,
        overviewStartText: opts.overviewStartText,
        buildJournal(player, _services) {
            const stage = getQuestStage(player, q);
            if (stage < q.startedValue) {
                return buildNotStartedJournal(q, opts.journalIntro);
            }
            if (stage >= q.completionValue) {
                return buildCompleteJournal(opts.journalDone);
            }
            return [
                opts.startText,
                "",
                ...opts.steps.map((s) => strikeIf(getQuestFlag(player, q.key, s.flag), s.line)),
                strikeIf(getQuestFlag(player, q.key, "ready_finish"), "I should return for my reward."),
            ];
        },
        register(registry: IScriptRegistry) {
            registerQuestNpcTalk(registry, opts.startNpc.id, ({ player, services }) => {
                const ctx: DialogueContext = {
                    player,
                    services,
                    npcId: opts.startNpc.id,
                    npcName: opts.startNpc.name,
                };
                const stage = getQuestStage(player, q);
                if (stage >= q.completionValue) {
                    const master = skillMasterForNpc(opts.startNpc.id);
                    if (master) {
                        openSkillMasterDialogForPlayer(player, services, master);
                        return;
                    }
                    startConversation(ctx, [{ npc: ["Thank you for your help."] }]);
                    return;
                }
                if (opts.prereq && !opts.prereq(player)) {
                    startConversation(ctx, [{ npc: [opts.prereqText ?? "You're not ready for this yet."] }]);
                    return;
                }
                const readyForSameNpcFinish =
                    opts.finishNpc.id === opts.startNpc.id &&
                    stage >= q.startedValue &&
                    (getQuestFlag(player, q.key, "ready_finish") ||
                        (opts.finishFlag ? getQuestFlag(player, q.key, opts.finishFlag) : false) ||
                        opts.steps.every((s) => getQuestFlag(player, q.key, s.flag)));
                if (readyForSameNpcFinish) {
                    startConversation(ctx, [
                        { npc: [opts.finishText] },
                        { exec: (d) => completeQuest(d.player, d.services, q) },
                    ]);
                    return;
                }
                if (stage >= q.startedValue) {
                    startConversation(ctx, [{ npc: [opts.startNpcActive ?? "Keep following the trail I gave you."] }]);
                    return;
                }
                startConversation(ctx, [
                    { npc: [opts.startText] },
                    {
                        options: startOptionsForSkillMasterNpc(opts.startNpc.id, [
                            {
                                text: "I'll help.",
                                next: [
                                    { player: ["I'll help."] },
                                    {
                                        exec: (d) => setQuestStage(d.player, q, d.services, q.startedValue),
                                    },
                                ],
                            },
                            { text: "Not now.", next: [{ player: ["Not now."] }] },
                        ]),
                    },
                ]);
            });

            for (const step of opts.steps) {
                registerQuestNpcTalk(registry, step.npc.id, ({ player, services }) => {
                    const ctx: DialogueContext = {
                        player,
                        services,
                        npcId: step.npc.id,
                        npcName: step.npc.name,
                    };
                    if (getQuestStage(player, q) < q.startedValue) return;
                    if (getQuestStage(player, q) >= q.completionValue) return;
                    if (getQuestFlag(player, q.key, step.flag)) {
                        startConversation(ctx, [{ npc: ["You already did that part."] }]);
                        return;
                    }
                    startConversation(ctx, [
                        { npc: [step.line] },
                        {
                            exec: (d) => {
                                if (step.item) {
                                    addItemIfMissing(d.player, d.services, step.item.id, step.item.qty ?? 1);
                                }
                                setQuestFlag(d.player, q.key, step.flag, true);
                                const allDone = opts.steps.every((s) =>
                                    s === step ? true : getQuestFlag(d.player, q.key, s.flag),
                                );
                                if (allDone) {
                                    setQuestFlag(d.player, q.key, "ready_finish", true);
                                }
                            },
                        },
                    ]);
                });
            }

            registerQuestNpcTalk(registry, opts.finishNpc.id, ({ player, services }) => {
                const ctx: DialogueContext = {
                    player,
                    services,
                    npcId: opts.finishNpc.id,
                    npcName: opts.finishNpc.name,
                };
                if (getQuestStage(player, q) < q.startedValue) return;
                if (getQuestStage(player, q) >= q.completionValue) {
                    const master = skillMasterForNpc(opts.finishNpc.id);
                    if (master) {
                        openSkillMasterDialogForPlayer(player, services, master);
                        return;
                    }
                    startConversation(ctx, [{ npc: ["All done!"] }]);
                    return;
                }
                const ready =
                    getQuestFlag(player, q.key, "ready_finish") ||
                    (opts.finishFlag ? getQuestFlag(player, q.key, opts.finishFlag) : false) ||
                    opts.steps.every((s) => getQuestFlag(player, q.key, s.flag));
                if (!ready) {
                    startConversation(ctx, [{ npc: ["You still have work to do."] }]);
                    return;
                }
                startConversation(ctx, [
                    { npc: [opts.finishText] },
                    { exec: (d) => completeQuest(d.player, d.services, q) },
                ]);
            });
        },
    };
    return q;
}

/** Like simpleQuest, but supports item turn-in at the finish NPC. */
export function autoQuest(
    opts: Parameters<typeof simpleQuest>[0] & {
        itemRequirements?: QuestItemRequirement[];
    },
): QuestDefinition {
    const itemRequirements = opts.itemRequirements ?? [];
    const q: QuestDefinition = {
        key: opts.key,
        name: opts.name,
        varpId: opts.varpId,
        progressVarbitId: opts.progressVarbitId,
        startedValue: opts.startedValue,
        completionValue: opts.completionValue,
        rewards: opts.rewards,
        rewardItemId: opts.rewardItemId,
        overviewStartText: opts.overviewStartText,
        buildJournal(player, services) {
            const stage = getQuestStage(player, q);
            if (stage < q.startedValue) {
                return buildNotStartedJournal(q, opts.journalIntro);
            }
            if (stage >= q.completionValue) {
                return buildCompleteJournal(opts.journalDone);
            }
            if (itemRequirements.length > 0) {
                return buildItemProgressJournal(
                    player,
                    services,
                    [opts.startText],
                    itemRequirements,
                    [strikeIf(getQuestFlag(player, q.key, "ready_finish"), "I should return for my reward.")],
                );
            }
            return [
                opts.startText,
                "",
                ...opts.steps.map((s) => strikeIf(getQuestFlag(player, q.key, s.flag), s.line)),
                strikeIf(getQuestFlag(player, q.key, "ready_finish"), "I should return for my reward."),
            ];
        },
        register(registry: IScriptRegistry) {
            registerQuestNpcTalk(registry, opts.startNpc.id, ({ player, services }) => {
                const ctx: DialogueContext = {
                    player,
                    services,
                    npcId: opts.startNpc.id,
                    npcName: opts.startNpc.name,
                };
                const stage = getQuestStage(player, q);
                if (stage >= q.completionValue) {
                    const master = skillMasterForNpc(opts.startNpc.id);
                    if (master) {
                        openSkillMasterDialogForPlayer(player, services, master);
                        return;
                    }
                    startConversation(ctx, [{ npc: ["Thank you for your help."] }]);
                    return;
                }
                if (opts.prereq && !opts.prereq(player)) {
                    startConversation(ctx, [{ npc: [opts.prereqText ?? "You're not ready for this yet."] }]);
                    return;
                }
                const readyForSameNpcFinish =
                    opts.finishNpc.id === opts.startNpc.id &&
                    stage >= q.startedValue &&
                    (getQuestFlag(player, q.key, "ready_finish") ||
                        (opts.finishFlag ? getQuestFlag(player, q.key, opts.finishFlag) : false) ||
                        opts.steps.every((s) => getQuestFlag(player, q.key, s.flag)));
                if (readyForSameNpcFinish) {
                    if (itemRequirements.length > 0 && !hasQuestItems(player, services, itemRequirements)) {
                        startConversation(ctx, [{ npc: ["Bring me everything I asked for first."] }]);
                        return;
                    }
                    startConversation(ctx, [
                        { npc: [opts.finishText] },
                        {
                            exec: (d) => {
                                if (itemRequirements.length > 0 && !takeQuestItems(d.player, d.services, itemRequirements)) {
                                    return;
                                }
                                completeQuest(d.player, d.services, q);
                            },
                        },
                    ]);
                    return;
                }
                if (stage >= q.startedValue) {
                    startConversation(ctx, [{ npc: [opts.startNpcActive ?? "Keep following the trail I gave you."] }]);
                    return;
                }
                startConversation(ctx, [
                    { npc: [opts.startText] },
                    {
                        options: startOptionsForSkillMasterNpc(opts.startNpc.id, [
                            {
                                text: "I'll help.",
                                next: [
                                    { player: ["I'll help."] },
                                    { exec: (d) => setQuestStage(d.player, q, d.services, q.startedValue) },
                                ],
                            },
                            { text: "Not now.", next: [{ player: ["Not now."] }] },
                        ]),
                    },
                ]);
            });

            for (const step of opts.steps) {
                registerQuestNpcTalk(registry, step.npc.id, ({ player, services }) => {
                    const ctx: DialogueContext = {
                        player,
                        services,
                        npcId: step.npc.id,
                        npcName: step.npc.name,
                    };
                    if (getQuestStage(player, q) < q.startedValue) return;
                    if (getQuestStage(player, q) >= q.completionValue) return;
                    if (getQuestFlag(player, q.key, step.flag)) {
                        startConversation(ctx, [{ npc: ["You already did that part."] }]);
                        return;
                    }
                    startConversation(ctx, [
                        { npc: [step.line] },
                        {
                            exec: (d) => {
                                if (step.item) {
                                    addItemIfMissing(d.player, d.services, step.item.id, step.item.qty ?? 1);
                                }
                                setQuestFlag(d.player, q.key, step.flag, true);
                                const allDone = opts.steps.every((s) =>
                                    s === step ? true : getQuestFlag(d.player, q.key, s.flag),
                                );
                                if (allDone) {
                                    setQuestFlag(d.player, q.key, "ready_finish", true);
                                }
                            },
                        },
                    ]);
                });
            }

            registerQuestNpcTalk(registry, opts.finishNpc.id, ({ player, services }) => {
                const ctx: DialogueContext = {
                    player,
                    services,
                    npcId: opts.finishNpc.id,
                    npcName: opts.finishNpc.name,
                };
                if (getQuestStage(player, q) < q.startedValue) return;
                if (getQuestStage(player, q) >= q.completionValue) {
                    const master = skillMasterForNpc(opts.finishNpc.id);
                    if (master) {
                        openSkillMasterDialogForPlayer(player, services, master);
                        return;
                    }
                    startConversation(ctx, [{ npc: ["All done!"] }]);
                    return;
                }
                const ready =
                    getQuestFlag(player, q.key, "ready_finish") ||
                    (opts.finishFlag ? getQuestFlag(player, q.key, opts.finishFlag) : false) ||
                    opts.steps.every((s) => getQuestFlag(player, q.key, s.flag));
                if (!ready) {
                    startConversation(ctx, [{ npc: ["You still have work to do."] }]);
                    return;
                }
                if (itemRequirements.length > 0 && !hasQuestItems(player, services, itemRequirements)) {
                    startConversation(ctx, [{ npc: ["Bring me everything I asked for first."] }]);
                    return;
                }
                startConversation(ctx, [
                    { npc: [opts.finishText] },
                    {
                        exec: (d) => {
                            if (itemRequirements.length > 0 && !takeQuestItems(d.player, d.services, itemRequirements)) {
                                return;
                            }
                            completeQuest(d.player, d.services, q);
                        },
                    },
                ]);
            });
        },
    };
    return q;
}
