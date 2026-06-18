# GGWP OSRS Existing Content Parity - Phase 1

This package is meant to be applied after the existing quest/dialogue/staff/trade/membership mega fix package.

It does not add new content. It corrects OSRS parity for systems that already exist in the build.

## Apply Order

1. Start from the original `ggwp-xrsps-server-main` source.
2. Apply the previous mega fix package with quests, dialogue, trade, membership, staff commands and chat tags.
3. Apply this package on top, overwriting matching files.
4. Run:

```bash
npm install
npm run server:build
```

## Files Included

- `server/gamemodes/vanilla/combat/CombatFormulas.ts`
- `server/src/game/combat/CombatFormulaProvider.ts`
- `server/src/game/combat/CombatRules.ts`
- `server/src/game/services/PlayerCombatService.ts`
- `server/src/game/systems/combat/CombatEngine.ts`

## What This Fixes

### NPC Combat Formula Parity

OSRS monster combat rolls use monster level + 9 for NPC attack, strength and defence style calculations.

This package changes:

- NPC effective attack from `level + 8` to `level + 9`
- NPC effective strength from `level + 8` to `level + 9`
- NPC effective defence from `level + 8` to `level + 9`

### NPC Magic and Ranged Accuracy

NPC-vs-player accuracy now uses the correct stat when the NPC attack type is known:

- melee uses `attackLevel`
- ranged uses `rangedLevel`
- magic uses `magicLevel`

The old calculation always used `attackLevel`, which made many ranged/magic NPCs inaccurate compared with OSRS.

### NPC Max Hit Fallback

If an NPC does not have an explicit `maxHit`, the fallback max-hit formula now carries attack type context.

This keeps melee behavior intact, while allowing ranged/magic NPC fallback calculations to use ranged/magic levels where available.

### Salamander Hybrid Combat

Salamanders are OSRS hybrid weapons:

- style 0: melee
- style 1: ranged
- style 2: magic

The build had a stale salamander category reference of `31`, while the weapon data uses category `6`. This package fixes that mismatch and prevents salamanders from being treated as generic ranged weapons.

## Verification Done

Static checks were run for:

- old `SALAMANDER_WEAPON_CATEGORY = 31` references
- stale ranged category lists containing salamander category `6`
- updated NPC formula provider usage

The local build command could not complete in this workspace because `tsc` is not installed here until project dependencies are installed.

Expected receiver-side check:

```bash
npm install
npm run server:build
```

## Source References

- OSRS Wiki DPS calculator: https://tools.runescape.wiki/osrs-dps/
- OSRS Wiki attack speed reference: https://oldschool.runescape.wiki/w/Attack_speed
- OSRS Wiki-backed DPS source used for monster formula comparison: https://github.com/weirdgloop/osrs-dps-calc

