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
            lines: [
                `${npcName} doesn't seem to have anything to say right now.`,
                "Content not implemented yet.",
            ],
            clickToContinue: true,
            closeOnContinue: true,
            onContinue: () => {
                services.dialog.closeDialog(event.player, `npc_${npc?.id ?? "unknown"}`);
            },
        });
    });
}
