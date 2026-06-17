import type { PlayerState } from "../../../src/game/player";
import type { IScriptRegistry, NpcInteractionEvent, ScriptServices } from "../../../src/game/scripts/types";
import { countCarriedItem } from "./QuestService";
import type { QuestDefinition, QuestItemRequirement } from "./types";

export function registerQuestNpcTalk(
    registry: IScriptRegistry,
    npcId: number,
    handler: (event: NpcInteractionEvent) => void,
): void {
    registry.registerNpcScript({ npcId, option: "talk-to", handler });
    registry.registerNpcScript({ npcId, option: undefined, handler });
}

export function buildNotStartedJournal(
    quest: QuestDefinition,
    locationLine: string,
    requirementLine?: string,
): string[] {
    const lines = [
        "I can start this quest by",
        quest.overviewStartText ?? locationLine,
        "",
    ];
    lines.push(requirementLine ?? "There aren't any requirements for this quest.");
    return lines;
}

export function buildCompleteJournal(strikethroughLines: string[]): string[] {
    return [...strikethroughLines.map((line) => `<str>${line}</str>`), "", "<col=ff0000>QUEST COMPLETE!</col>"];
}

export function buildItemProgressJournal(
    player: PlayerState,
    services: ScriptServices,
    introLines: string[],
    requirements: QuestItemRequirement[],
    footerLines: string[] = [],
): string[] {
    const lines = [...introLines, ""];
    for (const req of requirements) {
        const carried = countCarriedItem(player, services, req.itemId);
        lines.push(carried >= req.quantity ? `<str>${req.journalLabel}</str>` : req.journalLabel);
    }
    if (footerLines.length > 0) {
        lines.push("", ...footerLines);
    }
    return lines;
}

export function strikeIf(done: boolean, text: string): string {
    return done ? `<str>${text}</str>` : text;
}
