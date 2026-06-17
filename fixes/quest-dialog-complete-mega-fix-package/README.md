# Quest + Dialogue Complete Mega Fix

This package is the combined quest/dialogue fix for the OSRS rev 238 server project.

It supersedes the earlier quest packages and also includes them under `included-fixes/` for reference:

- `included-fixes/quest-dialog-state-fix-package.zip`
- `included-fixes/quest-dialog-all-209-fix-package.zip`

## What this fix contains

- Registers all 209 playable quest-reference entries from the local OSRS quest reference.
- Coverage is 190 quests + 19 miniquests.
- Adds/keeps English playable dialogue for generated quests and miniquests.
- Keeps the NPC-id based quest handler routing so the server can bind dialogue to the correct NPCs.
- Allows multiple quest handlers on the same NPC, so chain NPCs can serve the right quest instead of one handler overwriting another.
- Prevents already completed quests from paying rewards/quest points more than once.
- Fixes several shared NPC handoffs so a completed quest does not block the next quest on the same NPC.

Generated dialogue is playable server dialogue. It is not a word-for-word copy of official OSRS dialogue transcripts.

## Miniquests included

- Alfred Grimhand's Barcrawl
- Enter the Abyss
- The General's Shadow
- Barbarian Training
- Skippy and the Mogres
- Curse of the Empty Lord
- Lair of Tarn Razorlor
- Bear Your Soul
- The Enchanted Key
- Mage Arena I
- Family Pest
- Mage Arena II
- In Search of Knowledge
- Daddy's Home
- The Frozen Door
- Hopespear's Will
- Into the Tombs
- His Faithful Servants
- Vale Totems (miniquest)

## Install instructions for the AI/dev

1. Extract this zip into the root of the server repository.
2. Keep the folder paths exactly as they are in the package.
3. Replace the matching files in the server project.
4. Run dependency install if needed.
5. Build/check the server.
6. Start the server and confirm the quest log says `Registered 209 quest(s)`.

## Expected QA result

The active server files were checked against `server/data/quest-reference/quests.json`.

- Registered definitions: 209
- Reference definitions: 209
- Reference quests: 190
- Reference miniquests: 19
- Miniquests registered: 19
- Missing miniquests: 0
- Reference entries missing from registered quests: 0
- Registered quests not in reference: 0
- Duplicate quest names: 0
- Duplicate parsed progress state ids: 0

## Files included

- `server/src/game/scripts/ScriptRegistry.ts`
- `server/src/game/scripts/ScriptRuntime.ts`
- `server/gamemodes/vanilla/quests/index.ts`
- `server/gamemodes/vanilla/quests/QuestService.ts`
- `server/gamemodes/vanilla/quests/definitions/questFactory.ts`
- `server/gamemodes/vanilla/quests/definitions/generatedAutoQuests.ts`
- `server/gamemodes/vanilla/quests/definitions/f2pRemainingQuests.ts`
- `server/gamemodes/vanilla/quests/definitions/membersQuestPack.ts`
- `server/gamemodes/vanilla/quests/definitions/additionalMembersQuests.ts`
- `server/gamemodes/vanilla/quests/definitions/membersQuestPack2.ts`
- `server/gamemodes/vanilla/quests/definitions/membersQuestPack3.ts`
- `included-fixes/quest-dialog-state-fix-package.zip`
- `included-fixes/quest-dialog-all-209-fix-package.zip`
