# OSRS Quest Dialogue/State System

This is a data-driven quest and dialogue system generated from the final QA mapping.

## What Is Included

- `data/quests.json`  
  209 quest-like entries in OSRS Wiki `Quests/List` order: 190 quests and 19 miniquests.

- `data/npcs.json`  
  1,937 final QA-approved NPC/monster records. After running the NPC ID import,
  each record also includes `gameNpcIds` and `primaryGameNpcId` for server-side
  OSRS NPC ids.

- `data/dialogues.json`  
  Original English dialogue nodes for each quest/NPC relation.

- `data/npc-id-index.json`  
  Generated lookup from numeric OSRS server NPC id to internal quest NPC records.

- `data/quest-scripts.json`  
  Quest details imported from OSRS Wiki: difficulty, length, start text, skill requirements, quest requirements, quest point requirements, item requirements, kills/enemies, rewards, XP rewards and generated step headings.

- `src/questEngine.js`  
  Runtime state system for starting quests, advancing stages, recording NPC interactions, recording enemy encounters and completing quests.

## Important Note

The dialogue text is original generated project text. It does not copy OSRS quest dialogue.

The NPC-to-quest roles come from the final QA mapping. This is strong enough for routing dialogue to the correct NPCs. Full gameplay correctness still needs quest-specific requirements, rewards, item checks and scripted step logic.

The quest script layer now includes imported requirements/rewards for all 209 quest-like entries. Item requirements are split into `direct` and `contextual` because OSRS Wiki item fields often include components, alternatives and obtain-during-quest notes.

## Run

```bash
npm test
npm run demo
```

## Import Numeric NPC IDs

From the workspace root, place OSRSBox `docs/npcs-summary.json` at
`work/npcs-summary.json`, or run the importer with network access:

```bash
python work/enrich_osrs_npc_ids.py --download
```

Then use the numeric-id helpers when your server gives you an NPC id:

```js
import {
  createPlayerState,
  getBestDialogueNodeByGameNpcId,
  loadQuestDatabase
} from "./src/questEngine.js";

const database = await loadQuestDatabase();
const player = createPlayerState();

const serverNpcId = 741;
const node = getBestDialogueNodeByGameNpcId(database, player, serverNpcId, {
  questId: "rune_mysteries"
});
```

## Basic Use

```js
import {
  applyDialogueChoice,
  createPlayerState,
  getBestDialogueNode,
  loadQuestDatabase
} from "./src/questEngine.js";

const database = await loadQuestDatabase();
const player = createPlayerState();

const npc = database.npcs.find((entry) => entry.name === "Cassius");
const quest = database.quests.find((entry) => entry.name === "The Ides of Milk");

const node = getBestDialogueNode(database, player, npc.id, { questId: quest.id });
applyDialogueChoice(database, player, node.nodeId, node.choices[0].id);
```

## Supported Quest State

```js
{
  quests: {
    the_ides_of_milk: {
      state: "in_progress",
      stage: 10,
      readyToComplete: false
    }
  },
  inventory: {},
  skills: {},
  questPoints: 0,
  flags: {},
  interactions: {},
  enemies: {}
}
```

Supported quest states:

- `not_started`
- `in_progress`
- `completed`

## Script Helpers

```js
import {
  checkQuestRequirements,
  getQuestChecklist,
  getQuestScript,
  startQuestWithRequirements,
  completeQuestWithRewards
} from "./src/questEngine.js";
```

- `getQuestScript(database, questId)` returns the imported script data.
- `checkQuestRequirements(database, player, questId)` checks quest points, skill levels and required completed quests.
- `startQuestWithRequirements(database, player, questId)` starts only if requirements are met.
- `completeQuestWithRewards(database, player, questId)` completes and grants imported quest points/XP/unlock flags.
- `getQuestChecklist(database, player, questId)` returns requirements, item requirements, enemies, rewards and step headings.

Player skill levels should be stored in `player.skillLevels`, for example:

```js
const player = createPlayerState({
  questPoints: 32,
  skillLevels: {
    attack: 40,
    strength: 40,
    defence: 40
  }
});
```

## Supported Actions

- `startQuest`
- `setQuestStage`
- `advanceQuestStage`
- `setQuestReady`
- `completeQuest`
- `recordNpcInteraction`
- `recordEnemyEncounter`
- `recordEnemyDefeated`
- `giveItem`
- `takeItem`
- `giveXp`
- `addQuestPoints`
- `setFlag`

## Next Step

The next layer after this should add hand-authored quest-specific step scripts for high-value quests:

- Exact item alternatives
- Exact dialogue branches
- Exact stage conditions
- Combat hooks for quest enemies
- Turn-in conditions
