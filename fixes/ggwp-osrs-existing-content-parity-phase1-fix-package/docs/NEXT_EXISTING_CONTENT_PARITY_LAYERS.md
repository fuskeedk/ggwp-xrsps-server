# Next Existing-Content Parity Layers

Phase 1 fixes the first combat formula and hybrid weapon issues.

Recommended next layers:

1. Player-vs-NPC combat parity:
   - Toxic blowpipe PvM/PvP speed handling
   - powered staff range and hit-delay checks
   - magic spell max-hit and powered staff special effects
   - prayer protection and damage reduction rules

2. Equipment effect parity:
   - Slayer helmet/salve priority
   - Void, elite void and set-effect validation
   - Barrows set effects
   - special attack accuracy/damage modifiers

3. NPC data parity:
   - Expand `npc-combat-stats.json` beyond the current small combat-stat set
   - Ensure ranged/magic NPCs have correct max hit, attack speed, attack style and bonuses
   - Add hardcoded max-hit exceptions where Wiki/DPS data requires them

4. Ammo and charge parity:
   - Karil's crossbow bolt racks
   - blowpipe darts/scales behavior
   - crystal/bowfa charges
   - powered staff charges

5. Existing quest parity:
   - Replace generated quest stubs with real object/NPC/item steps
   - Keep the 209 registered quest list, but mark generated auto-quests as not full OSRS parity until scripted

