# ggwp OSRS — xrsps-typescript migration

Browser-baseret OSRS (xrsps) erstatter gradvist OpenRune/RuneLite.

## Start server (staging)

```bash
/home/ggwp/bin/xrsps-start.sh
```

Kræver collision-cache (første gang, ~5–15 min):

```bash
cd /home/ggwp/xrsps-typescript
export PATH="/usr/bin:/usr/local/bin:$PATH"
yarn server:build-collision
```

## Client dev

```bash
cd /home/ggwp/xrsps-typescript
yarn start   # http://localhost:3000
```

## Production client build

```bash
/home/ggwp/bin/xrsps-deploy-client.sh
```

Deployer `build/` til `/home/osrs/public_html` (osrs.ggwp.dk).

## Apache (osrs.ggwp.dk)

- Static client: `/home/osrs/public_html`
- `GET /status` → proxy til intern game-server host på port `43595`
- WebSocket (`wss://osrs.ggwp.dk`) → proxy til game server (port 43595)
- Game server: Pterodactyl **ggwp** (`f96dca78-a84f-4e1f-ab89-da3a3b4f447d`) — start/stop i panelet

```bash
/home/ggwp/bin/xrsps-deploy-client.sh   # efter client-ændringer
```

## Konto-login

- Opret konto: https://ggwp.dk/osrs/register
- Server validerer mod `openrune_central.accounts` (Argon2, samme som OsrsAuth.php)
- Spiller-state gemmes i `server/data/gamemodes/ggwp/` (JSON) indtil Postgres-persistence er klar

## In-game kommandoer

Alle spillere:

- `::bank` / `::openbank` / `::ob` — åbn bank
- `::home` — teleporter til spawn (Lumbridge)
- `::yell <besked>` — global chat (30 sek. cooldown)
- `::skillcape <skill>` / `::cape` — køb skillcape ved 99 (99.000 gp + hood)
- `::help` — vis kommando-oversigt

Admin (`fuskee` / `modlevel.admin`):

- `::tele x y [level]`, `::ge`, `::up`, `::down`, `::mypos`
- `::master`, `::reset`, `::invclear`, `::invadd <id> [qty]`, `::itemsearch <navn>`

## Miljø

Kopiér `.env.ggwp.example` → `.env` (allerede oprettet med ggwp DB).

## OpenRune (legacy)

Den gamle Kotlin-server (`/home/ggwp/osrs-server`) er **ikke** målet for RuneLite længere — den deler ikke game state med xrsps.

RuneLite på samme server som browseren kræver en Jagex/rsprot-gateway — se `docs/RUNELITE.md`.
