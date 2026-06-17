# Final Dialogue Coverage Report

## Summary

This final package is built from `quest-dialog-complete-mega-fix-package` and adds a finished non-quest `Talk-to` fallback.

The quest/dialogue content is English and playable, but it is not copied from official OSRS dialogue transcripts.

## Quest scope

The quest scope is treated as complete against the local quest reference used by this project:

- Total quest-like entries: 209
- Normal quests: 190
- Miniquests: 19
- Registered quest definitions: 209
- Reference entries missing from registered quests: 0
- Registered quests not in reference: 0
- Missing miniquests: 0
- Duplicate quest names: 0
- Duplicate parsed progress state ids: 0

## Quest NPC/dialogue scope

The generated quest-dialogue system contains:

- NPC/monster entries: 1,937
- Dialogue records: 2,433
- Dialogue records with unique NPC ids referenced: 1,937
- Dialogue records with unique NPC names referenced: 1,937

Within the generated quest-dialogue scope, there are no unmapped quest entries.

## Whole-game NPC comparison

The local OSRSBox NPC summary used for NPC-id support contains:

- NPC ids: 9,375
- Unique NPC names: 3,632

Direct name comparison against the quest-dialogue data showed:

- Unique quest-dialogue names: 1,937
- Unique OSRSBox names directly matched by quest-dialogue names: 1,347
- Unique OSRSBox names not directly covered by quest-dialogue names: 2,285

The 2,285 figure is not the same as "missing official dialogue". It includes combat NPCs, variants, pets, duplicate families, non-talk NPCs and NPCs that may not have meaningful dialogue.

## Non-quest NPC handling

This final package includes:

- `server/gamemodes/vanilla/scripts/content/defaultTalk.ts`

That file registers a global `Talk-to` fallback. The runtime checks specific NPC instance/type handlers first, then uses this fallback only when no bespoke quest/content handler exists.

Fallback categories include:

- Bank-style NPCs
- Shop/trader-style NPCs
- Guard/knight/soldier-style NPCs
- Tutor/guide/master-style NPCs
- Combat-level NPCs
- Generic town/world NPCs

The fallback is intentionally original text. It is designed to avoid dead interactions while keeping the game feeling coherent.

## Accuracy statement

What this package can honestly claim:

- Quest registration/state/routing target: complete against the local 209-entry reference.
- Quest dialogue: playable, English, quest-aware and state-aware.
- Non-quest dialogue: present as a generic fallback, not official transcript matching.

What this package does not claim:

- Official OSRS transcript parity.
- 80% text similarity to official OSRS dialogue.
- 100% whole-game bespoke NPC dialogue coverage.

## If exact official dialogue is required

Use a licensed/permitted source and add transcript text manually or through an importer that respects the source license. Do not paste scraped official dialogue into this package.
