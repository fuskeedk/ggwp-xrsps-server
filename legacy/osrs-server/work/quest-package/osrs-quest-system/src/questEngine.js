import { readFile } from "node:fs/promises";

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function asArrayData(input, key) {
  if (Array.isArray(input)) return input;
  if (input && Array.isArray(input[key])) return input[key];
  throw new Error(`Expected an array or an object with ${key}.`);
}

export async function loadQuestDatabase(baseUrl = new URL("../data/", import.meta.url)) {
  const readJson = async (fileName) => {
    const text = await readFile(new URL(fileName, baseUrl), "utf8");
    return JSON.parse(text);
  };
  const readOptionalJson = async (fileName) => {
    try {
      return await readJson(fileName);
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  };

  const [quests, npcs, dialogues, scripts] = await Promise.all([
    readJson("quests.json"),
    readJson("npcs.json"),
    readJson("dialogues.json"),
    readOptionalJson("quest-scripts.json"),
  ]);

  return createQuestDatabase({ quests, npcs, dialogues, scripts });
}

export function createQuestDatabase({ quests, npcs, dialogues, scripts = null }) {
  const questList = asArrayData(quests, "quests");
  const npcList = asArrayData(npcs, "npcs");
  const dialogueList = asArrayData(dialogues, "dialogues");
  const scriptList = scripts ? asArrayData(scripts, "scripts") : [];

  const questById = new Map();
  const questByTitle = new Map();
  const npcById = new Map();
  const dialogueById = new Map();
  const nodeById = new Map();
  const scriptByQuestId = new Map();
  const dialoguesByNpcId = new Map();
  const dialoguesByQuestId = new Map();
  const npcByGameNpcId = new Map();
  const dialoguesByGameNpcId = new Map();

  for (const quest of questList) {
    if (questById.has(quest.id)) throw new Error(`Duplicate quest id: ${quest.id}`);
    questById.set(quest.id, quest);
    questByTitle.set(quest.title, quest);
    questByTitle.set(quest.name, quest);
  }

  for (const npc of npcList) {
    if (npcById.has(npc.id)) throw new Error(`Duplicate NPC id: ${npc.id}`);
    npcById.set(npc.id, npc);
    for (const gameNpcId of npc.gameNpcIds || []) {
      const key = normalizeGameNpcId(gameNpcId);
      if (!npcByGameNpcId.has(key)) npcByGameNpcId.set(key, []);
      npcByGameNpcId.get(key).push(npc);
    }
  }

  for (const dialogue of dialogueList) {
    if (!questById.has(dialogue.questId)) {
      throw new Error(`Dialogue ${dialogue.id} references missing quest ${dialogue.questId}`);
    }
    if (!npcById.has(dialogue.npcId)) {
      throw new Error(`Dialogue ${dialogue.id} references missing NPC ${dialogue.npcId}`);
    }
    if (dialogueById.has(dialogue.id)) throw new Error(`Duplicate dialogue id: ${dialogue.id}`);
    dialogueById.set(dialogue.id, dialogue);

    if (!dialoguesByNpcId.has(dialogue.npcId)) dialoguesByNpcId.set(dialogue.npcId, []);
    dialoguesByNpcId.get(dialogue.npcId).push(dialogue);

    const npc = npcById.get(dialogue.npcId);
    const gameNpcIds = dialogue.gameNpcIds || npc?.gameNpcIds || [];
    for (const gameNpcId of gameNpcIds) {
      const key = normalizeGameNpcId(gameNpcId);
      if (!dialoguesByGameNpcId.has(key)) dialoguesByGameNpcId.set(key, []);
      dialoguesByGameNpcId.get(key).push(dialogue);
    }

    if (!dialoguesByQuestId.has(dialogue.questId)) dialoguesByQuestId.set(dialogue.questId, []);
    dialoguesByQuestId.get(dialogue.questId).push(dialogue);

    for (const node of dialogue.nodes || []) {
      if (nodeById.has(node.id)) throw new Error(`Duplicate dialogue node id: ${node.id}`);
      nodeById.set(node.id, { dialogue, node });
    }
  }

  for (const script of scriptList) {
    if (!questById.has(script.questId)) {
      throw new Error(`Quest script references missing quest: ${script.questId}`);
    }
    if (scriptByQuestId.has(script.questId)) {
      throw new Error(`Duplicate quest script: ${script.questId}`);
    }
    scriptByQuestId.set(script.questId, script);
  }

  return {
    quests: questList,
    npcs: npcList,
    dialogues: dialogueList,
    scripts: scriptList,
    questById,
    questByTitle,
    npcById,
    dialogueById,
    nodeById,
    scriptByQuestId,
    dialoguesByNpcId,
    dialoguesByQuestId,
    npcByGameNpcId,
    dialoguesByGameNpcId,
  };
}

export function createPlayerState(seed = {}) {
  return {
    quests: {},
    inventory: {},
    skills: {},
    skillLevels: {},
    questPoints: 0,
    flags: {},
    interactions: {},
    enemies: {},
    events: [],
    ...clone(seed),
  };
}

export function getQuestProgress(playerState, questId) {
  return (
    playerState.quests?.[questId] || {
      state: "not_started",
      stage: 0,
      readyToComplete: false,
      completedAt: null,
    }
  );
}

export function getQuestState(playerState, questId) {
  return getQuestProgress(playerState, questId).state;
}

export function startQuest(playerState, questId, stage = 10) {
  const current = getQuestProgress(playerState, questId);
  if (current.state === "completed") return playerState;
  playerState.quests[questId] = {
    ...current,
    state: "in_progress",
    stage: Math.max(current.stage || 0, stage),
    readyToComplete: Boolean(current.readyToComplete),
  };
  pushEvent(playerState, { type: "questStarted", questId, stage });
  return playerState;
}

export function startQuestWithRequirements(database, playerState, questId, stage = 10) {
  const check = checkQuestRequirements(database, playerState, questId);
  if (!check.canStart) {
    const missing = [
      ...check.missingQuestPoints.map((item) => `${item.required} quest points`),
      ...check.missingSkills.map((item) => `${item.skill} ${item.required}`),
      ...check.missingQuests.map((item) => item.questTitle),
    ].join(", ");
    throw new Error(`Cannot start ${questId}. Missing: ${missing || "requirements"}.`);
  }
  return startQuest(playerState, questId, stage);
}

export function setQuestReady(playerState, questId, ready = true) {
  const current = getQuestProgress(playerState, questId);
  playerState.quests[questId] = {
    ...current,
    state: current.state === "not_started" ? "in_progress" : current.state,
    stage: current.stage || 10,
    readyToComplete: ready,
  };
  pushEvent(playerState, { type: "questReadyChanged", questId, ready });
  return playerState;
}

export function completeQuest(playerState, questId) {
  const current = getQuestProgress(playerState, questId);
  if (current.state === "completed") return playerState;
  playerState.quests[questId] = {
    ...current,
    state: "completed",
    stage: 100,
    readyToComplete: false,
    completedAt: new Date().toISOString(),
  };
  pushEvent(playerState, { type: "questCompleted", questId });
  return playerState;
}

export function completeQuestWithRewards(database, playerState, questId) {
  const current = getQuestProgress(playerState, questId);
  if (current.state === "completed") return playerState;
  const script = database?.scriptByQuestId?.get(questId);
  if (script?.rewards) {
    if (script.rewards.questPoints) {
      playerState.questPoints += script.rewards.questPoints;
      pushEvent(playerState, {
        type: "questPointsAdded",
        questId,
        amount: script.rewards.questPoints,
      });
    }
    for (const reward of script.rewards.xpRewards || []) {
      giveXp(playerState, reward.skill, reward.amount);
    }
    for (const unlock of script.rewards.rewardCandidates || []) {
      const flag = `questReward:${questId}:${slugify(unlock.title)}`;
      playerState.flags[flag] = true;
      pushEvent(playerState, { type: "questRewardUnlocked", questId, title: unlock.title, flag });
    }
  }
  return completeQuest(playerState, questId);
}

export function getAvailableDialogueNodes(database, playerState, npcId, options = {}) {
  const dialogues = database.dialoguesByNpcId.get(npcId) || [];
  return collectAvailableDialogueNodes(dialogues, playerState, options);
}

export function getBestDialogueNode(database, playerState, npcId, options = {}) {
  return getAvailableDialogueNodes(database, playerState, npcId, options)[0] || null;
}

export function getNpcsByGameNpcId(database, gameNpcId) {
  return database.npcByGameNpcId.get(normalizeGameNpcId(gameNpcId)) || [];
}

export function getNpcByGameNpcId(database, gameNpcId) {
  return getNpcsByGameNpcId(database, gameNpcId)[0] || null;
}

export function getAvailableDialogueNodesByGameNpcId(database, playerState, gameNpcId, options = {}) {
  const key = normalizeGameNpcId(gameNpcId);
  const dialogues = database.dialoguesByGameNpcId.get(key) || [];
  return collectAvailableDialogueNodes(dialogues, playerState, options, Number(key));
}

export function getBestDialogueNodeByGameNpcId(database, playerState, gameNpcId, options = {}) {
  return getAvailableDialogueNodesByGameNpcId(database, playerState, gameNpcId, options)[0] || null;
}

function collectAvailableDialogueNodes(dialogues, playerState, options = {}, gameNpcId = null) {
  const matches = [];

  for (const dialogue of dialogues) {
    if (options.questId && dialogue.questId !== options.questId) continue;
    for (const node of dialogue.nodes || []) {
      if (matchesWhen(node.when || {}, playerState, dialogue)) {
        matches.push({
          dialogueId: dialogue.id,
          nodeId: node.id,
          questId: dialogue.questId,
          questName: dialogue.questName,
          npcId: dialogue.npcId,
          npcName: dialogue.npcName,
          gameNpcId,
          gameNpcIds: dialogue.gameNpcIds || [],
          primaryGameNpcId: dialogue.primaryGameNpcId ?? null,
          roles: dialogue.roles,
          speaker: node.speaker,
          text: node.text,
          choices: (node.choices || []).filter((choice) =>
            choiceIsAvailable(choice, playerState, dialogue)
          ),
          rawDialogue: dialogue,
          rawNode: node,
        });
      }
    }
  }

  return matches.sort(compareDialogueNodes);
}

export function applyDialogueChoice(database, playerState, nodeId, choiceId) {
  const entry = database.nodeById.get(nodeId);
  if (!entry) throw new Error(`Unknown dialogue node: ${nodeId}`);

  const { dialogue, node } = entry;
  if (!matchesWhen(node.when || {}, playerState, dialogue)) {
    throw new Error(`Dialogue node is not available in the current state: ${nodeId}`);
  }

  const choice = (node.choices || []).find((item) => item.id === choiceId);
  if (!choice) throw new Error(`Unknown choice ${choiceId} for node ${nodeId}`);
  if (!choiceIsAvailable(choice, playerState, dialogue)) {
    throw new Error(`Choice is not available in the current state: ${choiceId}`);
  }

  const beforeEventCount = playerState.events.length;
  applyActions(database, playerState, choice.actions || []);
  return {
    node,
    choice,
    response: choice.response || "",
    events: playerState.events.slice(beforeEventCount),
    playerState,
  };
}

export function applyActions(databaseOrPlayerState, playerStateOrActions, maybeActions) {
  const database = maybeActions ? databaseOrPlayerState : null;
  const playerState = maybeActions ? playerStateOrActions : databaseOrPlayerState;
  const actions = maybeActions || playerStateOrActions;
  for (const action of actions) {
    applyAction(database, playerState, action);
  }
  return playerState;
}

export function applyAction(databaseOrPlayerState, playerStateOrAction, maybeAction) {
  const database = maybeAction ? databaseOrPlayerState : null;
  const playerState = maybeAction ? playerStateOrAction : databaseOrPlayerState;
  const action = maybeAction || playerStateOrAction;
  switch (action.type) {
    case "startQuest":
      if (action.checkRequirements) {
        return startQuestWithRequirements(database, playerState, action.questId, action.stage ?? 10);
      }
      return startQuest(playerState, action.questId, action.stage ?? 10);
    case "setQuestStage":
      return setQuestStage(playerState, action.questId, action.stage ?? 0);
    case "advanceQuestStage":
      return advanceQuestStage(playerState, action.questId, action.stage ?? 0);
    case "setQuestReady":
      return setQuestReady(playerState, action.questId, action.ready ?? true);
    case "completeQuest":
      return database
        ? completeQuestWithRewards(database, playerState, action.questId)
        : completeQuest(playerState, action.questId);
    case "recordNpcInteraction":
      return recordNpcInteraction(playerState, action.questId, action.npcId, action.role);
    case "recordEnemyEncounter":
      return recordEnemyEncounter(playerState, action.questId, action.npcId, action.role);
    case "recordEnemyDefeated":
      return recordEnemyDefeated(playerState, action.questId, action.npcId);
    case "giveItem":
      return addInventoryItem(playerState, action.itemId, action.quantity ?? 1);
    case "takeItem":
      return removeInventoryItem(playerState, action.itemId, action.quantity ?? 1);
    case "giveXp":
      return giveXp(playerState, action.skill, action.amount ?? 0);
    case "addQuestPoints":
      playerState.questPoints += action.amount ?? 0;
      pushEvent(playerState, { type: "questPointsAdded", amount: action.amount ?? 0 });
      return playerState;
    case "setFlag":
      playerState.flags[action.flag] = action.value ?? true;
      pushEvent(playerState, { type: "flagSet", flag: action.flag, value: action.value ?? true });
      return playerState;
    default:
      throw new Error(`Unsupported action type: ${action.type}`);
  }
}

export function getQuestScript(database, questId) {
  return database.scriptByQuestId.get(questId) || null;
}

export function checkQuestRequirements(database, playerState, questId) {
  const script = getQuestScript(database, questId);
  const missingQuestPoints = [];
  const missingSkills = [];
  const missingQuests = [];

  if (!script) {
    return {
      questId,
      canStart: true,
      missingQuestPoints,
      missingSkills,
      missingQuests,
      script: null,
    };
  }

  const requiredQuestPoints = script.requirements?.questPointRequirement;
  if (requiredQuestPoints && playerState.questPoints < requiredQuestPoints) {
    missingQuestPoints.push({ required: requiredQuestPoints, current: playerState.questPoints });
  }

  for (const requirement of script.requirements?.skillRequirements || []) {
    const current = getSkillLevel(playerState, requirement.skill);
    if (current < requirement.level) {
      missingSkills.push({
        skill: requirement.skill,
        required: requirement.level,
        current,
      });
    }
  }

  for (const questTitle of script.requirements?.questRequirements || []) {
    const requiredQuest = database.questByTitle.get(questTitle);
    const requiredQuestId = requiredQuest?.id || slugify(questTitle);
    if (getQuestState(playerState, requiredQuestId) !== "completed") {
      missingQuests.push({
        questTitle,
        questId: requiredQuestId,
      });
    }
  }

  return {
    questId,
    canStart: missingQuestPoints.length === 0 && missingSkills.length === 0 && missingQuests.length === 0,
    missingQuestPoints,
    missingSkills,
    missingQuests,
    script,
  };
}

export function getQuestChecklist(database, playerState, questId) {
  const script = getQuestScript(database, questId);
  const requirements = checkQuestRequirements(database, playerState, questId);
  if (!script) return { questId, requirements, items: [], enemies: [], rewards: [] };

  return {
    questId,
    requirements,
    items: script.items?.itemRequirements || [],
    itemCandidates: script.items?.itemCandidates || [],
    enemies: script.kills?.enemyCandidates || [],
    rewards: [
      ...(script.rewards?.questPoints ? [{ type: "questPoints", amount: script.rewards.questPoints }] : []),
      ...(script.rewards?.xpRewards || []).map((reward) => ({ type: "xp", ...reward })),
      ...(script.rewards?.rewardCandidates || []).map((reward) => ({ type: "unlock", ...reward })),
    ],
    steps: script.steps || [],
  };
}

export function getQuestLog(database, playerState) {
  return database.quests.map((quest) => ({
    id: quest.id,
    name: quest.name,
    type: quest.type,
    order: quest.order,
    sourceUrl: quest.sourceUrl,
    scriptQuality: database.scriptByQuestId.get(quest.id)?.quality || null,
    ...getQuestProgress(playerState, quest.id),
  }));
}

export function getNpcQuestSummary(database, npcId) {
  const npc = database.npcById.get(npcId);
  if (!npc) throw new Error(`Unknown NPC: ${npcId}`);
  return {
    id: npc.id,
    name: npc.name,
    entityType: npc.entityType,
    gameNpcIds: npc.gameNpcIds || [],
    primaryGameNpcId: npc.primaryGameNpcId ?? null,
    quests: npc.quests || [],
  };
}

export function getNpcQuestSummaryByGameNpcId(database, gameNpcId) {
  return getNpcsByGameNpcId(database, gameNpcId).map((npc) => ({
    id: npc.id,
    name: npc.name,
    entityType: npc.entityType,
    gameNpcIds: npc.gameNpcIds || [],
    primaryGameNpcId: npc.primaryGameNpcId ?? null,
    quests: npc.quests || [],
  }));
}

function setQuestStage(playerState, questId, stage) {
  const current = getQuestProgress(playerState, questId);
  playerState.quests[questId] = {
    ...current,
    state: current.state === "not_started" ? "in_progress" : current.state,
    stage,
  };
  pushEvent(playerState, { type: "questStageSet", questId, stage });
  return playerState;
}

function advanceQuestStage(playerState, questId, stage) {
  const current = getQuestProgress(playerState, questId);
  const nextStage = Math.max(current.stage || 0, stage);
  return setQuestStage(playerState, questId, nextStage);
}

function recordNpcInteraction(playerState, questId, npcId, role = "helper") {
  if (!playerState.interactions[questId]) playerState.interactions[questId] = {};
  if (!playerState.interactions[questId][npcId]) {
    playerState.interactions[questId][npcId] = { count: 0, roles: [] };
  }
  const record = playerState.interactions[questId][npcId];
  record.count += 1;
  if (role && !record.roles.includes(role)) record.roles.push(role);
  pushEvent(playerState, { type: "npcInteractionRecorded", questId, npcId, role });
  return playerState;
}

function recordEnemyEncounter(playerState, questId, npcId, role = "enemy") {
  if (!playerState.enemies[questId]) playerState.enemies[questId] = {};
  if (!playerState.enemies[questId][npcId]) {
    playerState.enemies[questId][npcId] = { encounters: 0, defeated: false, roles: [] };
  }
  const record = playerState.enemies[questId][npcId];
  record.encounters += 1;
  if (role && !record.roles.includes(role)) record.roles.push(role);
  pushEvent(playerState, { type: "enemyEncounterRecorded", questId, npcId, role });
  return playerState;
}

function recordEnemyDefeated(playerState, questId, npcId) {
  recordEnemyEncounter(playerState, questId, npcId, "enemy");
  playerState.enemies[questId][npcId].defeated = true;
  pushEvent(playerState, { type: "enemyDefeated", questId, npcId });
  return playerState;
}

function addInventoryItem(playerState, itemId, quantity) {
  playerState.inventory[itemId] = (playerState.inventory[itemId] || 0) + quantity;
  pushEvent(playerState, { type: "itemAdded", itemId, quantity });
  return playerState;
}

function removeInventoryItem(playerState, itemId, quantity) {
  const current = playerState.inventory[itemId] || 0;
  if (current < quantity) throw new Error(`Not enough ${itemId}. Needed ${quantity}, had ${current}.`);
  const next = current - quantity;
  if (next === 0) delete playerState.inventory[itemId];
  else playerState.inventory[itemId] = next;
  pushEvent(playerState, { type: "itemRemoved", itemId, quantity });
  return playerState;
}

function giveXp(playerState, skill, amount) {
  if (!skill) throw new Error("giveXp requires a skill.");
  playerState.skills[skill] = (playerState.skills[skill] || 0) + amount;
  pushEvent(playerState, { type: "xpAdded", skill, amount });
  return playerState;
}

function getSkillLevel(playerState, skill) {
  const key = String(skill).toLowerCase();
  return (
    playerState.skillLevels?.[key] ??
    playerState.levels?.[key] ??
    playerState.skillLevels?.[skill] ??
    playerState.levels?.[skill] ??
    1
  );
}

function matchesWhen(when, playerState, dialogue) {
  const progress = getQuestProgress(playerState, dialogue.questId);
  if (when.questState && progress.state !== when.questState) return false;
  if (when.stage != null && progress.stage !== when.stage) return false;
  if (when.stageAtLeast != null && (progress.stage || 0) < when.stageAtLeast) return false;
  if (when.stageBelow != null && (progress.stage || 0) >= when.stageBelow) return false;
  if (when.questReady != null && Boolean(progress.readyToComplete) !== Boolean(when.questReady)) {
    return false;
  }
  return true;
}

function choiceIsAvailable(choice, playerState, dialogue) {
  if (!choice.requires) return true;
  const requirements = choice.requires;
  const progress = getQuestProgress(playerState, dialogue.questId);

  if (requirements.questState && progress.state !== requirements.questState) return false;
  if (requirements.questReady != null && Boolean(progress.readyToComplete) !== Boolean(requirements.questReady)) {
    return false;
  }
  if (requirements.items) {
    for (const requirement of requirements.items) {
      const quantity = requirement.quantity ?? 1;
      if ((playerState.inventory[requirement.itemId] || 0) < quantity) return false;
    }
  }
  if (requirements.flags) {
    for (const [flag, expected] of Object.entries(requirements.flags)) {
      if (playerState.flags[flag] !== expected) return false;
    }
  }
  return true;
}

function compareDialogueNodes(left, right) {
  return nodePriority(left.rawNode) - nodePriority(right.rawNode) || left.questName.localeCompare(right.questName);
}

function nodePriority(node) {
  const id = node.id || "";
  if (id.includes(".turn_in.ready")) return 0;
  if (id.includes(".start.not_started")) return 1;
  if (id.includes(".turn_in.in_progress")) return 2;
  if (id.includes(".helper.in_progress")) return 3;
  if (id.includes(".enemy.in_progress")) return 4;
  if (id.includes(".start.in_progress")) return 5;
  if (id.includes(".story.in_progress")) return 6;
  if (id.includes(".completed")) return 7;
  return 10;
}

function pushEvent(playerState, event) {
  playerState.events.push({ ...event, at: new Date().toISOString() });
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeGameNpcId(value) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 0) {
    throw new Error(`Invalid game NPC id: ${value}`);
  }
  return String(numeric);
}
