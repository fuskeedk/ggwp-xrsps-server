# Trade chat accept fix for ggwp-xrsps-server

This package contains only the files changed for the trade-request chat accept/decline fix.

## What this fixes

The server/client already had a trade system, but accepting a trade request from the chatbox/meslayer could fail because:

- the server only accepted full widget UIDs for chatbox widget `162`
- some client paths can pass the raw group id instead
- chat click handling only recognized a very small set of exact text values
- stale/expired trade requests could leave the chatbox trade prompt visible

The fix makes the trade request flow more tolerant on both client and server.

## Files included

Copy or merge these files into the same paths in the target server:

- `server/src/game/trade/TradeManager.ts`
- `src/client/OsrsClient.ts`
- `src/client/trade/TradeBridge.ts`

## Recommended install steps

1. Back up the target server first.
2. Compare each included file with the target repo version.
3. If the target repo is the same `ggwp-xrsps-server-main` version, replacing the three files is fine.
4. If the target repo has extra local edits, merge only these changes:
   - add `resolveWidgetGroupId(...)` in `TradeManager.ts`
   - use `CHATBOX_GROUP_ID` instead of hardcoded `162` in `handleResumePauseButton`
   - clear the trade request meslayer when a request is missing or the initiator is offline
   - add tolerant trade accept/decline text helpers in `OsrsClient.ts`
   - use the same tolerant accept/decline checks in `TradeBridge.ts`
5. Install dependencies if needed:

```bash
npm install
```

6. Build/check the server:

```bash
npm run server:build
```

7. Test in-game with two accounts:
   - Player A trades Player B.
   - Player B clicks `Accept trade` in chat.
   - The trade interface should open for both players.
   - Repeat with `Decline trade`.

## Notes

The local repo this was made from has `target.txt` set to `osrs-237_2026-03-25`, not rev 238. The fix is not data/revision-specific, but the target server should still be checked for its actual cache/revision.

The original local checkout did not have `node_modules`, so `npm run server:build` could not complete here until dependencies are installed.
