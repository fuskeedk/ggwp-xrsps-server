# GGWP OSRS Wiki Audit Handoff Fix Package

Target repo: `fuskeedk/ggwp-xrsps-server` / `ggwp-xrsps-server-main`

Important: this package was built from the original `ggwp-xrsps-server-main` plus the project fix packages. It does not use `ggwp-xrsps-server-main-fixed.zip`.

## What This Package Includes

- Trade chat accept/decline fix.
- Membership lookup and members-world state fix.
- Quest/dialogue state routing fix.
- All local OSRS quest-reference entries registered: 190 quests + 19 miniquests = 209 entries.
- NPC-id based quest dialogue routing.
- Multiple quest handlers on the same NPC id without overwriting each other.
- Duplicate quest reward protection.
- Generated English playable quest dialogue.
- Non-quest `Talk-to` fallback dialogue for NPCs without bespoke handlers.
- Staff command permission gates for owner/admin.
- Staff public chat tags:
  - `modlevel.owner` -> red `[Owner]`
  - `modlevel.admin` -> `[Admin]`

## Files Included

Copy or merge the included `server/` and `src/` folders into the target repository root.

This package intentionally includes the already-merged versions of overlapping files:

- `src/client/OsrsClient.ts` includes both trade and membership changes.
- `server/src/network/handlers/chatHandler.ts` includes both command permission gates and staff chat tags.

## Install Steps For The Other AI

1. Start from the target server repo, not from `ggwp-xrsps-server-main-fixed.zip`.
2. Back up the target repo first.
3. Extract this package into the repo root.
4. Preserve folder paths exactly.
5. Replace matching files only if the target repo has no newer local edits.
6. If the target repo has local edits, merge these files manually.
7. Install dependencies:

```bash
npm install
```

8. Build:

```bash
npm run server:build
```

9. Start the server and check logs for:

```text
[quests] Registered 209 quest(s)
```

## Required Smoke Tests

Run these after install:

- Trade: two accounts, Player A trades Player B, Player B clicks `Accept trade` in chat.
- Membership: set a test character as member and confirm members-world/client state works.
- Staff commands: normal player cannot use restricted commands such as `::item`, owner/admin can.
- Staff chat: owner/admin public chat shows the expected tag.
- Quest registration: confirm 209 quests are registered.
- Quest chains:
  - King Roald: Shield of Arrav -> Priest in Peril
  - Drezel: Priest in Peril -> Nature Spirit
  - King Narnode Shareen: The Grand Tree -> Monkey Madness I
  - Kolodion: Mage Arena I -> Mage Arena II
  - King Arthur: Merlin's Crystal -> Holy Grail
  - Elena: Plague City -> Biohazard
- Dialogue fallback: talk to a normal NPC without a bespoke script.
- Border Guard: confirm normal Al Kharid toll/payment/gate behavior still works.

## Known Remaining Gaps From The Wiki Audit

These are not fully solved by this package and should be the next work items:

1. Revision target mismatch.
   - Current local `target.txt` says `osrs-237_2026-03-25`.
   - If the live server is rev 238, install/use the rev 238 cache and regenerate/check revision-sensitive data.

2. Miniquest count needs final verification.
   - OSRS Wiki miniquest page lists 18 official miniquests.
   - The local project reference has 19 because it includes `Vale Totems (miniquest)`.
   - Verify whether `Vale Totems` belongs in the target rev 238 scope.

3. Generated quest scripts are playable stubs.
   - The 137 generated quests can start/progress/turn in/complete.
   - They are not full official OSRS implementations with every puzzle, cutscene, combat instance, object state, and side mechanic.

4. Dialogue is playable, not official transcript parity.
   - Quest dialogue is English and state-aware.
   - Non-quest NPC dialogue uses fallback text.
   - This package does not copy official OSRS dialogue transcripts.

5. Combat still needs a dedicated parity pass.
   - PvP melee/ranged scheduling should be fixed and tested.
   - Toxic blowpipe PvP attack speed should follow OSRS: 4 ticks base, 3 ticks rapid.
   - NPC combat data is still too small compared with full OSRS coverage.
   - Special attack side effects and ammo effects need more parity work.
   - NPC stat drain tracking is not implemented.
   - Boss mechanics and encounter-specific scripts are incomplete.

6. Build was not verified in this workspace.
   - `npm run server:build` could not complete here because `tsc` was not installed.
   - The receiving AI must run `npm install` and then build.

## Source Notes

Relevant OSRS Wiki checks used during audit:

- https://oldschool.runescape.wiki/w/Quest_List
- https://oldschool.runescape.wiki/w/Miniquests
- https://oldschool.runescape.wiki/w/Attack_speed
- https://tools.runescape.wiki/osrs-dps/

