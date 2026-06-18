# Remaining OSRS Parity Work

This package fixes the current quest/dialogue/trade/membership/staff handoff layer. It is not a final 100% OSRS parity patch.

## Highest Priority

1. Verify and move server data to real rev 238.
2. Decide whether `Vale Totems (miniquest)` belongs in the official target scope.
3. Run a full build and in-game smoke test after dependency install.
4. Fix PvP melee/ranged combat scheduling.
5. Fix toxic blowpipe PvP attack speed.
6. Expand NPC combat stats/defs beyond the current small subset.
7. Implement NPC stat drain tracking.
8. Finish ammo and special attack side effects.
9. Replace generated quest stubs with real quest-specific mechanics in batches.
10. Add licensed/permitted official-style dialogue only if allowed by source/license.

## Suggested Combat Test Cases

- Melee PvP hit with no autocast.
- Ranged PvP hit with bow/crossbow/thrown weapon.
- Magic PvP autocast.
- Toxic blowpipe PvM normal/rapid.
- Toxic blowpipe PvP normal/rapid.
- Karil's crossbow with bolt racks.
- Enchanted bolts with PvP-only effects.
- Dragon warhammer/BGS/Darklight-style stat drain vs NPC.
- NPC retaliation timing against 4-tick and 6-tick monsters.

