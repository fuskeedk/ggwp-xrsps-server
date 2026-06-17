import assert from "node:assert/strict";
import {
  applyDialogueChoice,
  checkQuestRequirements,
  createQuestDatabase,
  completeQuestWithRewards,
  createPlayerState,
  getAvailableDialogueNodes,
  getAvailableDialogueNodesByGameNpcId,
  getBestDialogueNode,
  getBestDialogueNodeByGameNpcId,
  getNpcQuestSummaryByGameNpcId,
  getNpcsByGameNpcId,
  getQuestChecklist,
  getQuestScript,
  loadQuestDatabase,
  setQuestReady,
  startQuest,
  startQuestWithRequirements,
} from "../src/questEngine.js";

const database = await loadQuestDatabase();

assert.equal(database.quests.length, 209, "quest count should match Quests/List + miniquests");
assert.equal(database.npcs.length, 1937, "NPC/entity count should match final QA mapping");
assert.equal(database.scripts.length, 209, "quest scripts should cover every quest-like entry");
assert.ok(database.dialogues.length > 2000, "dialogues should be generated for all mapped entities");

for (const quest of database.quests) {
  assert.ok(quest.id, `quest missing id: ${quest.name}`);
  assert.ok(quest.sourceUrl, `quest missing source URL: ${quest.name}`);
  assert.ok(Array.isArray(quest.participants), `quest missing participants: ${quest.name}`);
  assert.ok(quest.participants.length > 0, `quest has no mapped participants: ${quest.name}`);
}

for (const dialogue of database.dialogues) {
  assert.ok(database.questById.has(dialogue.questId), `dialogue references unknown quest: ${dialogue.id}`);
  assert.ok(database.npcById.has(dialogue.npcId), `dialogue references unknown NPC: ${dialogue.id}`);
  assert.ok(dialogue.nodes.length >= 3, `dialogue has too few nodes: ${dialogue.id}`);
}

const startDialogue = database.dialogues.find((dialogue) => dialogue.roles.includes("start"));
assert.ok(startDialogue, "expected at least one start dialogue");

const numericNpcId = 123456;
const numericDatabase = createQuestDatabase({
  quests: [database.questById.get(startDialogue.questId)],
  npcs: [
    {
      ...database.npcById.get(startDialogue.npcId),
      gameNpcIds: [numericNpcId],
      primaryGameNpcId: numericNpcId,
    },
  ],
  dialogues: [
    {
      ...startDialogue,
      gameNpcIds: [numericNpcId],
      primaryGameNpcId: numericNpcId,
    },
  ],
});

assert.equal(getNpcsByGameNpcId(numericDatabase, numericNpcId)[0].id, startDialogue.npcId);
assert.equal(getNpcQuestSummaryByGameNpcId(numericDatabase, String(numericNpcId))[0].id, startDialogue.npcId);

const numericPlayer = createPlayerState();
const startNodeByGameId = getBestDialogueNodeByGameNpcId(numericDatabase, numericPlayer, numericNpcId, {
  questId: startDialogue.questId,
});
assert.equal(startNodeByGameId.gameNpcId, numericNpcId);
assert.ok(startNodeByGameId.nodeId.endsWith(".start.not_started"));
assert.equal(
  getAvailableDialogueNodesByGameNpcId(numericDatabase, numericPlayer, numericNpcId).length,
  getAvailableDialogueNodes(numericDatabase, numericPlayer, startDialogue.npcId).length
);

const player = createPlayerState();
const startNode = getBestDialogueNode(database, player, startDialogue.npcId, {
  questId: startDialogue.questId,
});

assert.ok(startNode.nodeId.endsWith(".start.not_started"), "best node should start the quest");
assert.equal(startNode.choices[0].id, "accept");

applyDialogueChoice(database, player, startNode.nodeId, "accept");
assert.equal(player.quests[startDialogue.questId].state, "in_progress");
assert.equal(player.quests[startDialogue.questId].stage, 10);

const inProgressNodes = getAvailableDialogueNodes(database, player, startDialogue.npcId, {
  questId: startDialogue.questId,
});
assert.ok(inProgressNodes.some((node) => node.nodeId.includes(".in_progress")));

const turnInDialogue = database.dialogues.find((dialogue) => dialogue.roles.includes("turn_in"));
assert.ok(turnInDialogue, "expected at least one turn-in dialogue");

startQuest(player, turnInDialogue.questId);
setQuestReady(player, turnInDialogue.questId, true);

const readyNode = getAvailableDialogueNodes(database, player, turnInDialogue.npcId, {
  questId: turnInDialogue.questId,
}).find((node) => node.nodeId.endsWith(".turn_in.ready"));

assert.ok(readyNode, "expected ready turn-in node");
applyDialogueChoice(database, player, readyNode.nodeId, "complete");
assert.equal(player.quests[turnInDialogue.questId].state, "completed");
assert.equal(player.quests[turnInDialogue.questId].stage, 100);

const dragonSlayer = database.questByTitle.get("Dragon Slayer I");
const dragonSlayerScript = getQuestScript(database, dragonSlayer.id);
assert.equal(dragonSlayerScript.rewards.questPoints, 2);
assert.equal(dragonSlayerScript.requirements.questPointRequirement, 32);

const weakPlayer = createPlayerState({ questPoints: 31 });
const dragonCheck = checkQuestRequirements(database, weakPlayer, dragonSlayer.id);
assert.equal(dragonCheck.canStart, false);
assert.equal(dragonCheck.missingQuestPoints[0].required, 32);
assert.throws(() => startQuestWithRequirements(database, weakPlayer, dragonSlayer.id));

const readyPlayer = createPlayerState({ questPoints: 32 });
startQuestWithRequirements(database, readyPlayer, dragonSlayer.id);
assert.equal(readyPlayer.quests[dragonSlayer.id].state, "in_progress");

completeQuestWithRewards(database, readyPlayer, dragonSlayer.id);
assert.equal(readyPlayer.quests[dragonSlayer.id].state, "completed");
assert.equal(readyPlayer.questPoints, 34);
assert.equal(readyPlayer.skills.strength, 18650);
assert.equal(readyPlayer.skills.defence, 18650);

const dragonChecklist = getQuestChecklist(database, readyPlayer, dragonSlayer.id);
assert.ok(dragonChecklist.items.length > 0);
assert.ok(dragonChecklist.enemies.some((enemy) => enemy.title === "Elvarg"));
assert.ok(dragonChecklist.steps.length > 0);

console.log("questEngine.test.js passed");
