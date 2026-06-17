import {
  applyDialogueChoice,
  checkQuestRequirements,
  createPlayerState,
  getAvailableDialogueNodes,
  getBestDialogueNode,
  getBestDialogueNodeByGameNpcId,
  getQuestChecklist,
  loadQuestDatabase,
  setQuestReady,
  startQuest,
} from "../src/questEngine.js";

const database = await loadQuestDatabase();
const player = createPlayerState();

console.log(`Loaded ${database.quests.length} quests and ${database.npcs.length} NPC/monster records.`);

const cassius = database.npcs.find((npc) => npc.name === "Cassius");
const ides = database.quests.find((quest) => quest.name === "The Ides of Milk");

const startNode = cassius.primaryGameNpcId
  ? getBestDialogueNodeByGameNpcId(database, player, cassius.primaryGameNpcId, { questId: ides.id })
  : getBestDialogueNode(database, player, cassius.id, { questId: ides.id });
console.log("\nNPC:", cassius.name);
console.log("Server NPC ID:", cassius.primaryGameNpcId ?? "not imported yet");
console.log("Quest:", ides.name);
console.log("Dialogue:", startNode.text);
console.log("Choice:", startNode.choices[0].text);

const startResult = applyDialogueChoice(database, player, startNode.nodeId, startNode.choices[0].id);
console.log("Response:", startResult.response);
console.log("Quest state:", player.quests[ides.id]);

const turnInDialogue = database.dialogues.find((dialogue) => dialogue.roles.includes("turn_in"));
const turnInNpc = database.npcById.get(turnInDialogue.npcId);
const turnInQuest = database.questById.get(turnInDialogue.questId);

startQuest(player, turnInQuest.id);
setQuestReady(player, turnInQuest.id, true);

const readyNode = getAvailableDialogueNodes(database, player, turnInNpc.id, {
  questId: turnInQuest.id,
}).find((node) => node.nodeId.endsWith(".turn_in.ready"));

console.log("\nNPC:", turnInNpc.name);
console.log("Quest:", turnInQuest.name);
console.log("Dialogue:", readyNode.text);
console.log("Choice:", readyNode.choices[0].text);

const completeResult = applyDialogueChoice(database, player, readyNode.nodeId, readyNode.choices[0].id);
console.log("Response:", completeResult.response);
console.log("Quest state:", player.quests[turnInQuest.id]);

const dragonSlayer = database.questByTitle.get("Dragon Slayer I");
const dragonCheck = checkQuestRequirements(database, player, dragonSlayer.id);
const dragonChecklist = getQuestChecklist(database, player, dragonSlayer.id);

console.log("\nQuest script:", dragonSlayer.name);
console.log("Can start:", dragonCheck.canStart);
console.log("Missing quest points:", dragonCheck.missingQuestPoints);
console.log("Required/recommended item candidates:", dragonChecklist.items.slice(0, 5));
console.log("Enemy candidates:", dragonChecklist.enemies.slice(0, 5));
