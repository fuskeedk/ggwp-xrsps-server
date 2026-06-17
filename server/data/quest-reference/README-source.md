# Quest/NPC Dialogue System

This file explains how `osrs-quest-dialogue-starter.json` can be used in a game.

## Core Idea

Each NPC can be linked to one or more quests. When the player clicks an NPC, the game should find:

1. The NPC's `npcId`
2. Which quests the NPC is connected to
3. The player's quest state
4. The dialogue node where `when` matches best
5. The choices the player can select

The dialogue text is original for this project, so we do not need to copy OSRS dialogue directly.

## Player Quest State

The player should store quest data like this:

```json
{
  "quests": {
    "cooks_assistant": {
      "state": "in_progress",
      "stage": 20
    }
  },
  "inventory": {
    "egg": 1,
    "pot_of_flour": 1,
    "bucket_of_milk": 1
  }
}
```

Possible quest states:

- `not_started`
- `in_progress`
- `completed`

## Dialogue Matching

When an NPC is opened, the game should select a node from `dialogues`.

Example:

```text
Click Cook
-> npcId = cook_lumbridge
-> questId = cooks_assistant
-> player quest state = in_progress
-> player has all requiredItems
-> show the node with hasRequiredItems = true
```

Simple rules:

- `questState` must match the player's status.
- `stage` must match exactly.
- `stageAtLeast` means the player's stage is equal or higher.
- `hasRequiredItems` is calculated from the quest objective.
- `missingItems` is the opposite of `hasRequiredItems`.

## Actions

When the player selects a choice, run the choice actions.

Support these actions first:

```json
{ "type": "startQuest", "questId": "cooks_assistant", "stage": 20 }
```

Starts the quest and sets the stage.

```json
{ "type": "setQuestStage", "questId": "the_restless_ghost", "stage": 30 }
```

Moves the quest to a new stage.

```json
{ "type": "giveItem", "itemId": "air_talisman", "quantity": 1 }
```

Gives the player an item.

```json
{ "type": "giveItemIfMissing", "itemId": "shears", "quantity": 1 }
```

Gives the item only if the player does not already have it.

```json
{ "type": "takeItem", "itemId": "research_package", "quantity": 1 }
```

Removes an item from the inventory.

```json
{ "type": "takeItemsForObjective", "questId": "cooks_assistant", "stage": 20 }
```

Finds the quest objective for that stage and removes all `requiredItems`.

```json
{ "type": "completeQuest", "questId": "cooks_assistant" }
```

Marks the quest as completed and gives the rewards.

## Rewards

When `completeQuest` runs:

1. Set the quest state to `completed`.
2. Give quest points.
3. Give XP.
4. Give reward items.
5. Unlock access if needed, such as Doric's anvils.

## Expanding To All Quest NPCs

For each quest, we need:

- `questId`
- `name`
- `startNpcId`
- `requirements`
- `objectives`
- `starterItems`
- `rewards`
- One or more dialogue blocks

OSRSBox can be used for NPC and item IDs. OSRS Wiki or manually verified data can be used for quest facts. The dialogue should stay original, while the mechanics can follow the quest's requirements and rewards.

## Recommended Next Version

The next step is to build a small engine with:

```ts
getDialogueForNpc(npcId, playerState)
applyDialogueChoice(choice, playerState)
completeQuest(questId, playerState)
```

Once those three functions exist, quests can be added as data without changing the core dialogue system very much.
