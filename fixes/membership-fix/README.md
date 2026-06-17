# GGWP membership fix

This package contains the membership fixes for `ggwp-xrsps-server`.

## What was broken

The GGWP membership lookup expected `account_characters.membership_expires_at`.
The legacy schema in this repo only has:

```sql
members BOOLEAN NOT NULL DEFAULT FALSE
```

When `membership_expires_at` did not exist, the query failed, the player was treated as non-member, and membership gameplay state was never reliably set.

There was also at least one hardcoded members check:

```ts
const isMembersWorld = false;
```

That made Aubury's members reward path impossible to reach.

## What this fix does

- Adds a generic server membership helper in `server/src/game/membership.ts`.
- Makes GGWP membership lookup work with both schemas:
  - modern DB with `membership_expires_at`
  - legacy DB with only `members BOOLEAN`
- Treats `members=true` with no expiry column as active/lifetime membership.
- Looks up characters by display name or account name when possible.
- Stores membership state on the player for other server features to use.
- Fixes Aubury's members reward logic to use real membership state.
- Adds client-side membership state so CS1/CS2/widget logic can read members-world state.
- Makes CS2 `map_members` read the client state instead of always returning a constant.

## Files included

Copy or merge these files into the same paths:

- `server/src/game/membership.ts`
- `server/gamemodes/ggwp/membership.ts`
- `server/gamemodes/vanilla/shops/shopInteractions.ts`
- `src/client/OsrsClient.ts`
- `src/network/ServerConnection.ts`
- `src/rs/cs2/Cs2Vm.ts`
- `src/rs/cs2/handlers/HandlerTypes.ts`
- `src/rs/cs2/handlers/ClientOps.ts`

## Optional env

The code defaults to a members world. You can make it explicit:

```bash
GGWP_MEMBERS_WORLD=1
```

Set it to `0` only if this server should behave as a free-to-play world.

## Test steps

1. Install dependencies if needed:

```bash
npm install
```

2. Build:

```bash
npm run server:build
```

3. Test with a character row:

```sql
UPDATE account_characters
SET members = TRUE
WHERE lower(display_name) = lower('YourName');
```

4. Log in with that character.
5. Check server logs for:

```text
[ggwp-membership] synced YourName member=true
```

6. Talk to Aubury with the combat path voucher. Members-only reward flow should no longer be blocked by a hardcoded free-world check.

## Notes

If the target repo already has local edits in `OsrsClient.ts`, merge the membership additions instead of replacing the file blindly.

The local workspace did not have `node_modules`, so `npm run server:build` could not complete here until dependencies are installed.
