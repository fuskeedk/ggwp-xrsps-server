# GGWP xRSPS Server Guide

This document explains how the GGWP browser OSRS server is built, deployed, and operated.

## What GGWP Runs

GGWP runs a customized `xrsps-typescript` stack:

- **Client:** React/WebGL browser client (`src/`)
- **Game server:** TypeScript WebSocket server (`server/src/`)
- **Gamemode/content:** GGWP + Vanilla gamemode content (`server/gamemodes/`)
- **Public frontend:** `ggwp.dk/osrs` for account flow and highscores

Legacy Kotlin/OpenRune content under `osrs-server` is no longer the runtime target for browser gameplay.

## High-Level Architecture

1. Player opens the browser client.
2. Client connects over WebSocket to the xRSPS game server.
3. Client sends binary interaction packets (movement, trade, chat, widget actions, combat).
4. Server processes actions on the 600ms game tick loop.
5. Server sends binary sync updates back (player/npc state, interfaces, inventory, varps/varbits).

Core architecture reference: `docs/ARCHITECTURE.md`.

## Important Directories

- `src/` — browser client engine and UI
- `server/src/` — core server engine and networking
- `server/gamemodes/ggwp/` — GGWP-specific content/rules
- `server/gamemodes/vanilla/` — shared OSRS-style gameplay systems
- `server/data/gamemodes/ggwp/` — persisted player state (JSON snapshots)
- `scripts/` — cache/import/build tooling

## Data and Persistence

- **Authentication:** GGWP account system (Argon2) via central account DB integration.
- **Player state:** currently persisted as JSON snapshots per gamemode.
- **Skills/inventory/equipment/varps/varbits/quest flags/social state** are serialized through `PlayerStateSerializer`.
- **Highscores:** served separately through GGWP web backend integration.

## Quests and NPC Routing

GGWP quest/dialogue content is integrated with numeric OSRS NPC IDs (not NPC name lookup).

- Quest/dialogue datasets are generated/imported into server data files.
- Runtime routing uses server-side numeric NPC IDs for dialogue and progression.
- This avoids ambiguity across NPC name variants and duplicate NPC names.

## Trade System (OSRS-style)

Trade is handled by server + client bridge modules:

- Server authority: `server/src/game/trade/TradeManager.ts`
- Client trade bridge/UI sync: `src/client/trade/TradeBridge.ts`
- Wire protocol: `src/network/ServerConnection.ts` and binary packet encoders/decoders

Recent fixes focus on:

- robust quantity normalization
- correct item ID validation
- preventing inventory-offer desync
- interface-group ambiguity handling in trade interactions

## Deploy Model

### Server

The game server is started through:

```bash
/home/ggwp/bin/xrsps-start.sh
```

This runs `yarn server:start` in `/home/ggwp/xrsps-typescript`.

### Client

Production client deployment:

```bash
/home/ggwp/bin/xrsps-deploy-client.sh
```

This builds and syncs client assets to:

- `/home/osrs/public_html`

### Web Routing

- Static client files are served by Apache.
- WebSocket traffic is proxied to the game server port.
- `GET /status` is proxied to the game server status endpoint.

## Local/Stage Operations

### Start server

```bash
cd /home/ggwp/xrsps-typescript
yarn server:start
```

### Start client (dev)

```bash
cd /home/ggwp/xrsps-typescript
yarn start
```

### First-time collision build

```bash
cd /home/ggwp/xrsps-typescript
yarn server:build-collision
```

## Common Debug Areas

- **Trade:** `TradeManager`, `TradeBridge`, `ServerConnection`
- **Messaging/social:** `MessagingService`, `FriendsService`, chat handlers
- **Quest UI/scroll:** widget/CS2 handlers and quest widgets
- **Special attack + combat vars:** varp transmit and combat state services
- **Inventory desync:** `InventoryService` + client inventory sync paths

## Security and Public Sharing Notes

Before publishing this repository publicly:

- remove real secrets from `.env` and configs
- confirm DB credentials are not committed
- verify private hostnames/IPs are scrubbed where required
- keep deployment scripts but replace sensitive values with placeholders

---

If you want this documented as a full public project page, also include:

- a short product overview in `README.md`
- setup instructions for contributors
- a "current known issues" section
- contribution and support channels (Discord, issues, etc.)
