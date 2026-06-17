# Staff Command Permission Fix

This fix locks debug/admin commands behind the existing GGWP staff check.

Staff access is unchanged from the current project rules:

- `modlevel.owner`
- `modlevel.admin`
- names listed in `ADMIN_USERNAMES`, `ADMIN_PLAYERS`, or `ADMIN_NAMES`

## What was wrong

Several powerful commands were handled directly in `chatHandler.ts` before the script command registry was reached. Those commands had no owner/admin permission check.

That meant normal players could potentially use commands such as item spawn, quest unlock, debug spellbook switching, skill debug, rune loading, and test item grants.

## What this fix changes

The following hardcoded chat commands are now owner/admin only:

- `::tickstats`
- `::clear`
- `::allrunes`
- `::randomitem`
- `::smithing`
- `::rubytest`
- `::scroll`
- `::quest`
- `::pos`
- `::levelup`
- `::whip`
- `::bond`
- `::item`
- `::kill`
- `::onehealth`
- `::standard`
- `::ancient`
- `::lunar`
- `::arceuus`

The following script-registered commands are also blocked at chat dispatch unless the player is owner/admin:

- `::itemspawner`
- `::resetquests`
- `::sail`

The item-spawner tool now also checks permissions inside:

- `::itemspawner`
- Item Spawner item activation
- Item Spawner UI item spawn buttons

## Public commands left public

- `::bank`
- `::home`
- `::help`
- `::yell`
- `::xprate`
- `::skillcape`
- `::spawn`

## Extra fix

Command parsing now preserves argument case for script commands. For example, `::yell Hello` no longer turns the message into `hello` before it reaches the command handler.

## Install

Extract this package into the server repository root and replace the matching files.

## Validation done

Static command audit completed:

- Hardcoded debug/admin commands are covered by the owner/admin gate.
- Script commands without their own guard were identified and gated at chat dispatch.
- Item-spawner has a second internal guard so the UI cannot be abused if a player already has the item.

Build was not run in this workspace because `node_modules` is missing and `tsc` is not installed.
