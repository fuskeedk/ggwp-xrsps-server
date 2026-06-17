import type { PlayerState } from "../../../../../src/game/player";
import type { NpcInteractionEvent, ScriptServices } from "../../../../../src/game/scripts/types";
import { getQuestFlag, setQuestFlag } from "../../QuestFlags";
import {
    completeQuest,
    countCarriedItem,
    getQuestStage,
    setQuestStage,
    takeQuestItems,
} from "../../QuestService";
import { type DialogueContext, type DialogueStep, startConversation } from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    BUCKET_OF_MILK_ITEM_ID,
    COOK_NPC_ID,
    COOKS_ASSISTANT_KEY,
    EGG_ITEM_ID,
    FLAG_GIVEN_EGG,
    FLAG_GIVEN_FLOUR,
    FLAG_GIVEN_MILK,
    POT_OF_FLOUR_ITEM_ID,
    STAGE_COMPLETE,
    STAGE_STARTED,
} from "./constants";

function allItemsDelivered(player: PlayerState): boolean {
    return (
        getQuestFlag(player, COOKS_ASSISTANT_KEY, FLAG_GIVEN_MILK) &&
        getQuestFlag(player, COOKS_ASSISTANT_KEY, FLAG_GIVEN_EGG) &&
        getQuestFlag(player, COOKS_ASSISTANT_KEY, FLAG_GIVEN_FLOUR)
    );
}

function buildIngredientHelpSteps(quest: QuestDefinition, player: PlayerState, services: ScriptServices): DialogueStep[] {
    const hasPot = countCarriedItem(player, services, 1931) > 0;
    const hasBucket = countCarriedItem(player, services, 1925) > 0;
    return [
        {
            options: [
                {
                    text: "Where do I find some flour?",
                    next: [
                        {
                            npc: hasPot
                                ? [
                                      "Talk to Millie, she'll help, she's a lovely girl and a fine Miller.",
                                      "Make sure you take a pot with you for the flour though, you've got one on you already.",
                                  ]
                                : [
                                      "Talk to Millie, she'll help, she's a lovely girl and a fine Miller.",
                                      "Make sure you take a pot with you for the flour though, there should be one on the table in here.",
                                  ],
                        },
                        ...buildIngredientHelpSteps(quest, player, services),
                    ],
                },
                {
                    text: "How about milk?",
                    next: [
                        {
                            npc: hasBucket
                                ? [
                                      "You'll need an empty bucket for the milk itself.",
                                      "I do see you've got a bucket with you already luckily!",
                                  ]
                                : [
                                      "You'll need an empty bucket for the milk itself.",
                                      "The general store just north of the castle will sell you one for a couple of coins.",
                                  ],
                        },
                        ...buildIngredientHelpSteps(quest, player, services),
                    ],
                },
                {
                    text: "And eggs? Where are they found?",
                    next: [
                        { npc: ["I normally get my eggs from the Groats' farm, on the other side of the river."] },
                        { npc: ["But any chicken should lay eggs."] },
                        ...buildIngredientHelpSteps(quest, player, services),
                    ],
                },
                {
                    text: "I've got all the information I need. Thanks.",
                    next: [{ player: ["I've got all the information I need. Thanks."] }],
                },
            ],
        },
    ];
}

function buildFinishingSteps(quest: QuestDefinition): DialogueStep[] {
    return [
        { npc: ["You've brought me everything I need! I am saved! Thank you!"] },
        { player: ["So do I get to go to the Duke's Party?"] },
        { npc: ["I'm afraid not, only the big cheeses get to dine with the Duke."] },
        { player: ["Well, maybe one day I'll be important enough to sit on the Duke's table."] },
        { npc: ["Maybe, but I won't be holding my breath."] },
        { exec: (ctx) => completeQuest(ctx.player, ctx.services, quest) },
    ];
}

function deliverItemsSteps(
    quest: QuestDefinition,
    player: PlayerState,
    services: ScriptServices,
): DialogueStep[] {
    const steps: DialogueStep[] = [];
    if (countCarriedItem(player, services, BUCKET_OF_MILK_ITEM_ID) > 0) {
        steps.push({
            exec: (ctx) => {
                if (takeQuestItems(ctx.player, ctx.services, [{ itemId: BUCKET_OF_MILK_ITEM_ID, quantity: 1, journalLabel: "" }])) {
                    setQuestFlag(ctx.player, COOKS_ASSISTANT_KEY, FLAG_GIVEN_MILK, true);
                }
            },
        });
        steps.push({ player: ["Here's a bucket of milk."] });
    }
    if (countCarriedItem(player, services, EGG_ITEM_ID) > 0) {
        steps.push({
            exec: (ctx) => {
                if (takeQuestItems(ctx.player, ctx.services, [{ itemId: EGG_ITEM_ID, quantity: 1, journalLabel: "" }])) {
                    setQuestFlag(ctx.player, COOKS_ASSISTANT_KEY, FLAG_GIVEN_EGG, true);
                }
            },
        });
        steps.push({ player: ["Here's a fresh egg."] });
    }
    if (countCarriedItem(player, services, POT_OF_FLOUR_ITEM_ID) > 0) {
        steps.push({
            exec: (ctx) => {
                if (takeQuestItems(ctx.player, ctx.services, [{ itemId: POT_OF_FLOUR_ITEM_ID, quantity: 1, journalLabel: "" }])) {
                    setQuestFlag(ctx.player, COOKS_ASSISTANT_KEY, FLAG_GIVEN_FLOUR, true);
                }
            },
        });
        steps.push({ player: ["Here's a pot of flour."] });
    }
    if (allItemsDelivered(player)) {
        steps.push(...buildFinishingSteps(quest));
    } else {
        steps.push(
            {
                npc: [
                    "Thanks for the ingredients you have got so far.",
                    "Please get the rest quickly - I'm running out of time! The Duke will throw me into the streets!",
                ],
            },
            {
                options: [
                    { text: "I'll get right on it.", next: [{ player: ["I'll get right on it."] }] },
                    {
                        text: "Can you remind me how to find these things again?",
                        next: buildIngredientHelpSteps(quest, player, services),
                    },
                ],
            },
        );
    }
    return steps;
}

function buildWhatsWrongSteps(quest: QuestDefinition, player: PlayerState, services: ScriptServices): DialogueStep[] {
    return [
        { player: ["What's wrong?"] },
        {
            npc: [
                "Oh dear, oh dear, oh dear, I'm in a terrible terrible mess!",
                "It's the Duke's birthday and I should be making him a lovely big birthday cake.",
            ],
        },
        {
            npc: [
                "I've forgotten to buy the ingredients. I'll never get them in time now.",
                "He'll sack me! What will I do? I have four children and a goat to look after. Would you help me? Please?",
            ],
        },
        {
            options: [
                {
                    text: "I'm always happy to help a cook in distress.",
                    next: [
                        { player: ["Yes, I'll help you."] },
                        {
                            exec: (ctx) => {
                                setQuestStage(ctx.player, quest, ctx.services, STAGE_STARTED);
                                const hasAll =
                                    countCarriedItem(ctx.player, ctx.services, BUCKET_OF_MILK_ITEM_ID) > 0 &&
                                    countCarriedItem(ctx.player, ctx.services, EGG_ITEM_ID) > 0 &&
                                    countCarriedItem(ctx.player, ctx.services, POT_OF_FLOUR_ITEM_ID) > 0;
                                if (hasAll) {
                                    setQuestFlag(ctx.player, COOKS_ASSISTANT_KEY, FLAG_GIVEN_MILK, true);
                                    setQuestFlag(ctx.player, COOKS_ASSISTANT_KEY, FLAG_GIVEN_EGG, true);
                                    setQuestFlag(ctx.player, COOKS_ASSISTANT_KEY, FLAG_GIVEN_FLOUR, true);
                                }
                            },
                        },
                        {
                            npc: ["Oh thank you, thank you. I need milk, an egg and flour. I'd be very grateful if you can get them for me."],
                        },
                    ],
                },
                {
                    text: "I can't right now, maybe later.",
                    next: [
                        { player: ["No, I don't feel like it. Maybe later."] },
                        { npc: ["Fine. I always knew you Adventurer types were callous beasts. Go on your merry way!"] },
                    ],
                },
            ],
        },
    ];
}

export function createCookTalkHandler(quest: QuestDefinition): (event: NpcInteractionEvent) => void {
    return (event) => {
        const { player, services } = event;
        const ctx: DialogueContext = { player, services, npcId: COOK_NPC_ID, npcName: "Cook" };
        const stage = getQuestStage(player, quest);

        if (stage >= STAGE_COMPLETE) {
            startConversation(ctx, [
                { npc: ["How is the adventuring going, my friend?"] },
                {
                    options: [
                        {
                            text: "Do you have any other quests for me?",
                            next: [
                                { player: ["Do you have any other quests for me?"] },
                                { npc: ["I don't have anything for you to do right now, sorry."] },
                            ],
                        },
                        {
                            text: "Can I use your range?",
                            next: [
                                { player: ["Can I use your range?"] },
                                {
                                    npc: [
                                        "Go ahead - it's a very good range.",
                                        "It's easier to use than most other ranges.",
                                        "It's called the Cook-o-matic 100.",
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ]);
            return;
        }

        if (stage >= STAGE_STARTED) {
            const hasAny =
                countCarriedItem(player, services, BUCKET_OF_MILK_ITEM_ID) > 0 ||
                countCarriedItem(player, services, EGG_ITEM_ID) > 0 ||
                countCarriedItem(player, services, POT_OF_FLOUR_ITEM_ID) > 0 ||
                getQuestFlag(player, COOKS_ASSISTANT_KEY, FLAG_GIVEN_MILK) ||
                getQuestFlag(player, COOKS_ASSISTANT_KEY, FLAG_GIVEN_EGG) ||
                getQuestFlag(player, COOKS_ASSISTANT_KEY, FLAG_GIVEN_FLOUR);

            if (!hasAny) {
                startConversation(ctx, [
                    { npc: ["How are you getting on with finding the ingredients?"] },
                    { player: ["I haven't got any of them yet, I'm still looking."] },
                    {
                        npc: [
                            "Please get the ingredients quickly.",
                            "I'm running out of time! The Duke will throw me into the streets!",
                        ],
                    },
                    {
                        options: [
                            { text: "I'll get right on it.", next: [{ player: ["I'll get right on it."] }] },
                            {
                                text: "Can you remind me how to find these things again?",
                                next: buildIngredientHelpSteps(quest, player, services),
                            },
                        ],
                    },
                ]);
                return;
            }

            startConversation(ctx, [
                { npc: ["How are you getting on with finding the ingredients?"] },
                ...deliverItemsSteps(quest, player, services),
            ]);
            return;
        }

        startConversation(ctx, [
            { npc: ["What am I to do?"] },
            {
                options: [
                    { text: "What's wrong?", next: buildWhatsWrongSteps(quest, player, services) },
                    {
                        text: "You don't look very happy.",
                        next: [
                            { player: ["You don't look very happy."] },
                            { npc: ["No, I'm not. The world is caving in around me - I am overcome by dark feelings of impending doom."] },
                            ...buildWhatsWrongSteps(quest, player, services),
                        ],
                    },
                    {
                        text: "Nice hat!",
                        next: [
                            { player: ["Nice hat!"] },
                            { npc: ["Err thank you. It's a pretty ordinary cook's hat really."] },
                            ...buildWhatsWrongSteps(quest, player, services),
                        ],
                    },
                ],
            },
        ]);
    };
}
