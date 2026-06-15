import type { PlayerState } from "../../../../../src/game/player";
import type { NpcInteractionEvent, ScriptServices } from "../../../../../src/game/scripts/types";
import {
    completeQuest,
    getQuestStage,
    hasQuestItems,
    setQuestStage,
    takeQuestItems,
} from "../../QuestService";
import { type DialogueContext, type DialogueStep, startConversation } from "../../dialogue";
import type { QuestDefinition } from "../../types";
import { DORIC_NPC_ID, REQUIRED_ITEMS, STAGE_COMPLETE, STAGE_STARTED } from "./constants";

function buildAcceptSteps(quest: QuestDefinition): DialogueStep[] {
    return [
        {
            npc: [
                "Clay is what I use more than anything, to make",
                "casts. Could you get me 6 clay, 4 copper ore, and 2",
                "iron ore, please? I could pay a little, as well as",
                "letting you use my anvils.",
            ],
        },
        {
            exec: (ctx) => {
                setQuestStage(ctx.player, quest, ctx.services, STAGE_STARTED);
            },
        },
        { player: ["Certainly, I'll be right back!"] },
    ];
}

function buildAnvilRequestSteps(quest: QuestDefinition): DialogueStep[] {
    return [
        {
            npc: [
                "My anvils get enough work with my own use. I",
                "make pickaxes, and it takes a lot of hammering to",
                "get them just right.",
            ],
        },
        {
            npc: [
                "But you could be some help to me; I'm running",
                "low on certain materials, and I could do with a",
                "hand collecting them.",
            ],
        },
        {
            npc: ["If you could fetch me what I need, I would be", "happy to let you use my anvils."],
        },
        {
            options: [
                { text: "Yes, I will get you the materials.", next: buildAcceptSteps(quest) },
                {
                    text: "No, hitting rocks is for the boring people, sorry.",
                    next: [{ npc: ["That is your choice. Nice to meet you anyway."] }],
                },
            ],
        },
    ];
}

function buildNotStartedSteps(quest: QuestDefinition): DialogueStep[] {
    return [
        { npc: ["Hello traveller, what brings you to my humble", "smithy?"] },
        {
            options: [
                { text: "I wanted to use your anvils.", next: buildAnvilRequestSteps(quest) },
                {
                    text: "Mind your own business, shortstuff!",
                    next: [
                        {
                            npc: [
                                "How nice to meet someone with such pleasant",
                                "manners. Do come again when you need to shout",
                                "at someone smaller than you!",
                            ],
                        },
                    ],
                },
                {
                    text: "I was just checking out the landscape.",
                    next: [
                        {
                            npc: [
                                "Hope you like it. I do enjoy the solitude of my",
                                "little home. If you get time, please say hello to",
                                "my friends in the Dwarven Mine.",
                            ],
                        },
                        { player: ["Dwarven Mine, eh?"] },
                        {
                            npc: [
                                "Yes, the entrance is in the side of Ice Mountain",
                                "just east of here. They're a friendly bunch.",
                            ],
                        },
                    ],
                },
                {
                    text: "What do you make here?",
                    next: [
                        {
                            npc: [
                                "I make pickaxes. I am the best maker of pickaxes",
                                "in the whole of Gielinor.",
                            ],
                        },
                        { player: ["Do you have any pickaxes for sale?"] },
                        {
                            npc: [
                                "Sorry, but I've got a running order with the",
                                "dwarves of the Dwarven Mine.",
                            ],
                        },
                    ],
                },
            ],
        },
    ];
}

function buildInProgressSteps(
    quest: QuestDefinition,
    player: PlayerState,
    services: ScriptServices,
): DialogueStep[] {
    if (!hasQuestItems(player, services, REQUIRED_ITEMS)) {
        return [
            { npc: ["Have you got my materials yet, traveller?"] },
            { player: ["Sorry, I don't have them all yet."] },
            {
                npc: [
                    "Not to worry, stick at it. Remember, I need 6 clay,",
                    "4 copper ore, and 2 iron ore.",
                ],
            },
            { player: ["OK, I'll get on with it."] },
        ];
    }
    return [
        { npc: ["Have you got my materials yet, traveller?"] },
        { player: ["I have everything you need."] },
        {
            npc: [
                "Many thanks. Pass them here, please. I can spare",
                "you some coins for your trouble, and please use my",
                "anvils any time you want.",
            ],
        },
        {
            exec: (ctx) => {
                if (!takeQuestItems(ctx.player, ctx.services, REQUIRED_ITEMS)) {
                    ctx.services.messaging.sendGameMessage(
                        ctx.player,
                        "You don't have all the materials Doric needs.",
                    );
                    return;
                }
                completeQuest(ctx.player, ctx.services, quest);
            },
        },
    ];
}

const completedSteps: DialogueStep[] = [
    { npc: ["Hello traveller, how is your metalwork coming", "along?"] },
    { player: ["Not too bad, Doric."] },
    { npc: ["Good, the love of metal is a thing close to my", "heart."] },
];

export function createDoricTalkHandler(quest: QuestDefinition): (event: NpcInteractionEvent) => void {
    return (event) => {
        const { player, services } = event;
        const ctx: DialogueContext = { player, services, npcId: DORIC_NPC_ID, npcName: "Doric" };

        const stage = getQuestStage(player, quest);
        if (stage >= STAGE_COMPLETE) {
            startConversation(ctx, completedSteps);
        } else if (stage >= STAGE_STARTED) {
            startConversation(ctx, buildInProgressSteps(quest, player, services));
        } else {
            startConversation(ctx, buildNotStartedSteps(quest));
        }
    };
}
