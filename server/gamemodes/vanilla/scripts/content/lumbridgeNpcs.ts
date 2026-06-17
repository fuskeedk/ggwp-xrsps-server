import type { PlayerState } from "../../../../src/game/player";
import type { IScriptRegistry, NpcInteractionEvent, ScriptServices } from "../../../../src/game/scripts/types";
import { registerQuestNpcTalk } from "../../quests/helpers";
import { registerSkillTutorHandlers } from "./skillTutors";

const HANS_NPC_ID = 3105;
const DONIE_NPC_ID = 921;
const GEE_NPC_ID = 6816;
const DUKE_HORACIO_NPC_ID = 815;
function openNpcDialog(
    event: NpcInteractionEvent,
    services: ScriptServices,
    dialogId: string,
    npcName: string,
    lines: string[],
    onContinue?: () => void,
): void {
    services.dialog.openDialog(event.player, {
        kind: "npc",
        id: dialogId,
        npcId: event.npc.typeId,
        npcName,
        lines,
        clickToContinue: true,
        closeOnContinue: !onContinue,
        onContinue,
        onClose: () => services.dialog.closeDialog(event.player, dialogId),
    });
}

function openPlayerDialog(
    player: PlayerState,
    services: ScriptServices,
    dialogId: string,
    lines: string[],
    onContinue?: () => void,
): void {
    services.dialog.openDialog(player, {
        kind: "player",
        id: dialogId,
        playerName: player.name ?? "You",
        lines,
        clickToContinue: true,
        closeOnContinue: !onContinue,
        onContinue,
        onClose: () => services.dialog.closeDialog(player, dialogId),
    });
}

function handleGuideNpcTalk(
    event: NpcInteractionEvent,
    services: ScriptServices,
    npcName: string,
): void {
    const player = event.player;
    const base = `${npcName.toLowerCase()}_${player.id}`;
    openNpcDialog(
        event,
        services,
        `${base}_hello`,
        npcName,
        ["Hello there, can I help you?"],
        () => {
            services.dialog.closeDialog(player, `${base}_hello`);
            services.dialog.openDialogOptions(player, {
                id: `${base}_options`,
                title: "Select an Option",
                options: [
                    "Where am I?",
                    "Are there any quests I can do here?",
                    "How are you today?",
                ],
                onSelect: (choice) => {
                    if (choice === 0) {
                        openPlayerDialog(player, services, `${base}_where`, ["Where am I?"], () => {
                            openNpcDialog(event, services, `${base}_where_reply`, npcName, [
                                "This is Lumbridge Castle, in the Kingdom of Misthalin.",
                                "The road south leads to Draynor Village and the Wizards' Tower.",
                            ]);
                        });
                    } else if (choice === 1) {
                        openPlayerDialog(
                            player,
                            services,
                            `${base}_quests`,
                            ["Are there any quests I can do here?"],
                            () => {
                                openNpcDialog(event, services, `${base}_quests_reply`, npcName, [
                                    "Talk to the Cook in the castle kitchen, or Fred the Farmer north-west of here.",
                                    "Father Aereck in the church might need help too.",
                                ]);
                            },
                        );
                    } else {
                        openPlayerDialog(player, services, `${base}_how`, ["How are you today?"], () => {
                            openNpcDialog(event, services, `${base}_how_reply`, npcName, [
                                "I'm well, thank you. Lovely weather for adventuring!",
                            ]);
                        });
                    }
                },
            });
        },
    );
}

export function registerLumbridgeNpcHandlers(
    registry: IScriptRegistry,
    services: ScriptServices,
): void {
    registerQuestNpcTalk(registry, HANS_NPC_ID, (event) => {
        const player = event.player;
        const base = `hans_${player.id}`;
        openNpcDialog(
            event,
            services,
            `${base}_intro`,
            "Hans",
            ["Hello. What are you doing here?"],
            () => {
                services.dialog.closeDialog(player, `${base}_intro`);
                services.dialog.openDialogOptions(player, {
                    id: `${base}_options`,
                    title: "Select an Option",
                    options: [
                        "I'm looking for whoever is in charge of this place.",
                        "I don't know. I'm lost. Where am I?",
                        "Nothing.",
                    ],
                    onSelect: (choice) => {
                        if (choice === 0) {
                            openPlayerDialog(player, services, `${base}_p1`, [
                                "I'm looking for whoever is in charge of this place.",
                            ], () => {
                                openNpcDialog(
                                    event,
                                    services,
                                    `${base}_n1`,
                                    "Hans",
                                    ["Who, the Duke? He's in his study, on the first floor."],
                                );
                            });
                        } else if (choice === 1) {
                            openPlayerDialog(player, services, `${base}_p2`, [
                                "I don't know. I'm lost. Where am I?",
                            ], () => {
                                openNpcDialog(
                                    event,
                                    services,
                                    `${base}_n2`,
                                    "Hans",
                                    [
                                        "You are in Lumbridge Castle, in the Kingdom of Misthalin.",
                                        "Across the river, the road leads north to Varrock, and to the west lies Draynor Village.",
                                    ],
                                );
                            });
                        } else {
                            openPlayerDialog(player, services, `${base}_p3`, ["Nothing."]);
                        }
                    },
                });
            },
        );
    });

    registerQuestNpcTalk(registry, DONIE_NPC_ID, (event) => {
        handleGuideNpcTalk(event, services, "Donie");
    });

    registerQuestNpcTalk(registry, GEE_NPC_ID, (event) => {
        handleGuideNpcTalk(event, services, "Gee");
    });

    registerQuestNpcTalk(registry, DUKE_HORACIO_NPC_ID, (event) => {
        openNpcDialog(event, services, `duke_${event.player.id}`, "Duke Horacio", [
            "Welcome to my castle. If you need guidance, speak with the tutors in the courtyard.",
        ]);
    });

    registerSkillTutorHandlers(registry, services);
}
