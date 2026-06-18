import { type IScriptRegistry, type ScriptServices } from "../../../../src/game/scripts/types";
import { type DialogueContext, type DialogueStep, startConversation } from "../../quests/dialogue";
import {
    applyQuestDialogueChoice,
    getOrCreateOsrsQuestPackagePlayerState,
    loadOsrsQuestBridgeRuntime,
    resolveQuestDialogueByGameNpcId,
} from "../../quests/osrsQuestBridge";

/**
 * Fallback Talk-to handler so NPCs without bespoke scripts still respond.
 * This keeps client-side interactions working while content is fleshed out.
 */

function pickById<T>(values: readonly T[], id: number): T {
    return values[Math.trunc(Math.abs(id)) % values.length]!;
}

function buildFallbackLines(npcName: string, serverNpcId: number, combatLevel: number): string[] {
    const lower = npcName.toLowerCase();
    const stableNpcId = Number.isFinite(serverNpcId) ? serverNpcId : 0;

    if (lower.includes("banker") || lower.includes("bank")) {
        return [
            "Welcome. I can help you with your bank if you use the Bank option.",
            "Keep your valuables safe; Gielinor has a way of testing pockets.",
        ];
    }

    if (
        lower.includes("shop") ||
        lower.includes("trader") ||
        lower.includes("merchant") ||
        lower.includes("store")
    ) {
        return [
            "Looking to buy or sell? The trade option is the quickest way.",
            "Prices change, but a prepared adventurer always finds a use for supplies.",
        ];
    }

    if (
        lower.includes("guard") ||
        lower.includes("knight") ||
        lower.includes("soldier") ||
        lower.includes("warrior")
    ) {
        return [
            "Move along, adventurer. The roads are safer when everyone keeps their eyes open.",
            "If you are looking for trouble, try not to bring it back here.",
        ];
    }

    if (
        lower.includes("tutor") ||
        lower.includes("guide") ||
        lower.includes("instructor") ||
        lower.includes("master")
    ) {
        return [
            "Take your time and learn the basics. A steady start saves trouble later.",
            "Your skills will carry you farther than luck ever will.",
        ];
    }

    if (combatLevel > 0) {
        return [
            `${npcName} does not seem interested in a long conversation.`,
            "You get the feeling this meeting could turn rough if you press the matter.",
        ];
    }

    const genericLines = [
        [
            "Good day. Keep your wits about you out there.",
            "There is always something happening if you know where to look.",
        ],
        [
            "Have you checked your quest journal lately?",
            "A clear journal is often better than a wild guess.",
        ],
        [
            "The roads are busy today. Safe travels.",
            "If you hear anything interesting, pass it along.",
        ],
        [
            "I have not heard anything useful lately.",
            "Still, the right question asked in the right place can open doors.",
        ],
    ] as const;

    return [...pickById(genericLines, stableNpcId)];
}

export function registerDefaultTalkHandlers(
    registry: IScriptRegistry,
    services: ScriptServices,
): void {
    registry.registerNpcAction("talk-to", async (event) => {
        const npc = event.npc;
        const npcName =
            npc?.name && npc.name !== "null"
                ? String(npc.name)
                : `NPC ${npc?.typeId ?? npc?.id ?? ""}`.trim();
        const serverNpcId = Number(npc?.typeId);

        if (Number.isInteger(serverNpcId) && serverNpcId >= 0) {
            const runtime = await loadOsrsQuestBridgeRuntime(services);
            if (runtime) {
                const playerState = getOrCreateOsrsQuestPackagePlayerState(event.player, runtime);
                const resolution = resolveQuestDialogueByGameNpcId(runtime, playerState, serverNpcId);

                if (resolution.status === "ok") {
                    const node = resolution.node;
                    const ctx: DialogueContext = {
                        player: event.player,
                        services,
                        npcId: npc?.typeId ?? serverNpcId,
                        npcName: node.npcName || npcName,
                    };

                    if (!Array.isArray(node.choices) || node.choices.length === 0) {
                        startConversation(ctx, [{ npc: [node.text] }]);
                        return;
                    }

                    startConversation(ctx, [
                        { npc: [node.text] },
                        {
                            options: node.choices.map((choice) => {
                                const nextSteps: DialogueStep[] = [
                                    {
                                        exec: () => {
                                            try {
                                                const outcome = applyQuestDialogueChoice(
                                                    runtime,
                                                    playerState,
                                                    node.nodeId,
                                                    choice.id,
                                                );
                                                for (const raisedEvent of outcome.events) {
                                                    const eventType =
                                                        typeof raisedEvent.type === "string"
                                                            ? raisedEvent.type
                                                            : undefined;
                                                    const questId =
                                                        typeof raisedEvent.questId === "string"
                                                            ? raisedEvent.questId
                                                            : node.questId;
                                                    if (eventType === "questStarted") {
                                                        services.messaging.sendGameMessage(
                                                            event.player,
                                                            `Quest started: ${questId}`,
                                                        );
                                                    } else if (eventType === "questCompleted") {
                                                        services.messaging.sendGameMessage(
                                                            event.player,
                                                            `Quest completed: ${questId}`,
                                                        );
                                                    }
                                                }
                                            } catch (error) {
                                                services.system.logger.warn?.(
                                                    `[script:osrs-quest] failed to apply choice node=${node.nodeId} choice=${choice.id}`,
                                                    error,
                                                );
                                                services.messaging.sendGameMessage(
                                                    event.player,
                                                    "That quest option could not be applied.",
                                                );
                                            }
                                        },
                                    },
                                ];
                                if (choice.response) {
                                    nextSteps.push({ npc: [choice.response] });
                                }
                                return {
                                    text: choice.text,
                                    next: nextSteps,
                                };
                            }),
                        },
                    ]);
                    return;
                }

                if (resolution.status === "missing_npc_id") {
                    // Explicitly report unmapped numeric IDs rather than silently failing.
                    services.messaging.sendGameMessage(event.player, resolution.message);
                    services.system.logger.warn?.(`[script:osrs-quest] ${resolution.message}`);
                }
            }
        }

        services.system.logger.info?.(
            `[script:default-talk] fallback dialog npc=${npc?.id} type=${npc?.typeId}`,
        );

        services.dialog.openDialog(event.player, {
            kind: "npc",
            id: `npc_${npc?.id ?? "unknown"}`,
            npcId: npc?.typeId,
            npcName,
            lines: buildFallbackLines(npcName, serverNpcId, npc?.getCombatLevel?.() ?? 0),
            clickToContinue: true,
            closeOnContinue: true,
            onContinue: () => {
                services.dialog.closeDialog(event.player, `npc_${npc?.id ?? "unknown"}`);
            },
        });
    });
}
