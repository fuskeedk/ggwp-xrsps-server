# GGWP OSRS Combat Parity Fix Package v2

This is a combat-only fix package for `fuskeedk/ggwp-xrsps-server` / `ggwp-xrsps-server-main`.

It intentionally does not include the quest/dialog, membership, staff command, staff chat tag, or trade fixes. Keep those as their own packages.

## Install

Copy the `server/` folder from this package into the server repo root and let it overwrite the matching files.

Recommended target:

```text
ggwp-xrsps-server-main/
```

Do not apply this on top of `ggwp-xrsps-server-main-fixed` unless you have already checked for conflicts, because this package was built from the original repo plus the previous clean fixes, not from the `-fixed` folder.

## What This Fixes

- NPC-vs-player formulas now use OSRS-style `level + 9` effective NPC stats instead of `level + 8`.
- NPC max-hit and accuracy now respect melee/ranged/magic NPC attack type instead of always treating NPC offensive levels as melee.
- Salamanders are no longer treated as generic ranged weapons. Their style slots now resolve as melee, ranged, and magic.
- Toxic blowpipe attack speed is context-aware:
  - PvM: 3 ticks normally, 2 ticks on rapid.
  - PvP: 4 ticks normally, 3 ticks on rapid.
- Karil's crossbow now requires bolt racks instead of accepting all bolts.
- NPC combat stats can now be temporarily drained per spawned NPC and reset cleanly on respawn/reset.
- Dragon warhammer / other percent Defence drain effects now actually drain NPC Defence.
- Bandos godsword Warstrike now drains NPC combat stats by damage dealt, cascading through Defence, Strength, Attack, Magic, and Ranged.
- Bone dagger variants now use damage-based Defence drain and only drain when the NPC Defence is not already lowered.
- Special attack effect payloads now carry the missing stat-drain fields through scheduling into hit resolution.

## Files Included

See `changed-files.txt` for the exact file list.

## Verification Status

I attempted:

```text
npm run server:build
```

Build could not run in this workspace because `tsc` is not installed:

```text
'tsc' is not recognized as an internal or external command
```

After installing dependencies in the target repo, run:

```text
npm install
npm run server:build
```

Then smoke-test:

- Equip toxic blowpipe and confirm PvM speed is 3/2 ticks normal/rapid.
- Test blowpipe against another player and confirm PvP speed is 4/3 ticks normal/rapid.
- Equip Karil's crossbow with normal bolts and confirm it rejects them.
- Equip Karil's crossbow with bolt racks and confirm it attacks.
- Hit an NPC with dragon warhammer and confirm Defence drops.
- Hit an NPC with Bandos godsword and confirm stat drain applies by damage.
- Hit an NPC with bone dagger twice and confirm the second spec does not keep lowering Defence if it is already drained.

## Still Not Full 100% OSRS Combat

This package fixes the combat framework issues we found in code. Full OSRS parity still needs the data/scripting layer:

- Full NPC combat stat import for all OSRS NPC IDs.
- Boss-specific mechanics and phases.
- Full toxic blowpipe charge/scales/internal dart storage.
- Full PvP melee/ranged scheduling if the server has not implemented non-magic PvP combat yet.
- More special attack edge cases, especially PvP-only effects.

Treat this as the clean combat-code parity package, not as a complete OSRS data dump.
