import type { NpcInteractionEvent, IScriptRegistry, ScriptServices } from "../../../src/game/scripts/types";
import { startConversation, type DialogueContext } from "../quests/dialogue";
import { GE_CLERK_NPC_IDS } from "./geConstants";
import type { GrandExchangeService } from "./GrandExchangeService";

function clerkDialogue(
    event: NpcInteractionEvent,
    services: ScriptServices,
    geService: GrandExchangeService,
): void {
    const { player, npc } = event;
    const ctx: DialogueContext = {
        player,
        services,
        npcId: npc.typeId,
        npcName: "Grand Exchange Clerk",
    };

    startConversation(ctx, [
        { npc: ["Welcome to the Grand Exchange."] },
        {
            options: [
                {
                    text: "I'd like to trade.",
                    next: [{ exec: () => geService.openExchange(player) }],
                },
                {
                    text: "I'd like to collect items.",
                    next: [{ exec: () => geService.openCollectionBox(player) }],
                },
                {
                    text: "How does the Grand Exchange work?",
                    next: [
                        {
                            npc: [
                                "Place buy or sell offers and the exchange will match you with other players.",
                                "Completed trades can be collected here or from any bank collection box.",
                            ],
                        },
                    ],
                },
                { text: "I'm fine thanks." },
            ],
        },
    ]);
}

export function registerGrandExchangeHandlers(
    registry: IScriptRegistry,
    geService: GrandExchangeService,
): void {
    for (const npcId of GE_CLERK_NPC_IDS) {
        const talkHandler = (event: NpcInteractionEvent) => {
            clerkDialogue(event, event.services, geService);
        };
        registry.registerNpcScript({ npcId, option: "talk-to", handler: talkHandler });
        registry.registerNpcScript({ npcId, option: undefined, handler: talkHandler });
        registry.registerNpcAction("trade", (event) => {
            geService.openExchange(event.player);
        });
        registry.registerNpcAction("trade-with", (event) => {
            geService.openExchange(event.player);
        });
    }
}
