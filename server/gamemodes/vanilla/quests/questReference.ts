import fs from "fs";
import path from "path";
import { getQuestDefinitionByName } from "./QuestRegistry";

export type QuestReferenceNpc = {
    name: string;
    roles: string[];
    gameIds: number[];
    nearestGameId?: number;
};

export type QuestReferenceEntry = {
    questId: string;
    title: string;
    members: boolean;
    difficulty?: string;
    wikiStart?: string;
    startMap?: [number, number];
    startNpcGameIds: number[];
    npcs: QuestReferenceNpc[];
    itemRequirements: Array<{ title: string; quantity: number; itemId?: number }>;
    skillRequirements: Array<{ skill: string; level: number }>;
    questRequirements: string[];
    rewards: {
        questPoints: number;
        xp: Array<{ skill: string; amount: number }>;
        items: Array<{ title: string; quantity: number; itemId?: number }>;
    };
    overviewHint?: string;
};

type ResolvedQuestFile = {
    quests: QuestReferenceEntry[];
};

const byTitle = new Map<string, QuestReferenceEntry>();
const byQuestId = new Map<string, QuestReferenceEntry>();

function normalizeTitle(title: string): string {
    return title
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/['']/g, "'")
        .replace(/[^a-z0-9']+/g, " ")
        .trim();
}

function loadReferenceData(): void {
  if (byTitle.size > 0) return;

  const resolvedPath = path.join(__dirname, "../../../data/quest-reference/resolved-quests.json");
  if (!fs.existsSync(resolvedPath)) {
      return;
  }

  const parsed = JSON.parse(fs.readFileSync(resolvedPath, "utf8")) as ResolvedQuestFile;
  for (const quest of parsed.quests) {
      byTitle.set(normalizeTitle(quest.title), quest);
      byQuestId.set(quest.questId, quest);
  }
}

export function getQuestReference(displayName: string): QuestReferenceEntry | undefined {
    loadReferenceData();
    return byTitle.get(normalizeTitle(displayName));
}

export function getQuestReferenceById(questId: string): QuestReferenceEntry | undefined {
    loadReferenceData();
    return byQuestId.get(questId);
}

export function getQuestOverviewFromReference(displayName: string): string | undefined {
    if (getQuestDefinitionByName(displayName)) {
        return undefined;
    }
    return getQuestReference(displayName)?.overviewHint;
}

export function getAllQuestReferences(): QuestReferenceEntry[] {
    loadReferenceData();
    return [...byTitle.values()];
}

export function getUnimplementedQuestReferences(): QuestReferenceEntry[] {
    return getAllQuestReferences().filter((quest) => !getQuestDefinitionByName(quest.title));
}
