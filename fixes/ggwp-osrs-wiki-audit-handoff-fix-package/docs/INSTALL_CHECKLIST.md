# Install Checklist

Use this checklist after copying the package into the server repo.

## Before Copying

- Confirm the target repo is `ggwp-xrsps-server-main` or a compatible fork.
- Do not apply this on top of `ggwp-xrsps-server-main-fixed.zip`.
- Back up local changes.

## After Copying

- Run `npm install`.
- Run `npm run server:build`.
- Start the server.
- Confirm the quest log says `Registered 209 quest(s)`.

## In-Game Checks

- Trade chat accept opens the trade interface for both players.
- Members account is treated as member by server and client.
- Owner/admin command access works.
- Normal players are denied restricted commands.
- Owner/admin chat tags display in public chat.
- Quest NPC chains still route to the correct quest.
- Normal NPCs have fallback dialogue.
- Border Guard still handles Al Kharid toll behavior.

