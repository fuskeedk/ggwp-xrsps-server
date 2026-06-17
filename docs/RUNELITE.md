# RuneLite + xrsps-typescript

## Status

**RuneLite kan ikke forbinde til xrsps-serveren i dag.** Det er ikke et download-/launcher-problem — protokollerne er forskellige.

| | Browser (xrsps) | RuneLite (ggwp-osrs-client) |
|---|---|---|
| Transport | WebSocket (`wss://osrs.ggwp.dk`) | TCP (Jagex) |
| Login | Custom binary (`HELLO`/`HANDSHAKE`/`LOGIN`, opcode 200+) | RSA-krypteret Jagex login |
| Cache | HTTP/CDN + IndexedDB | JS5 over Jagex-protokol |
| Game packets | OSRS-lignende opcodes over WS | OSRS opcodes over TCP (rsprot) |
| Revision | **237** | **238** |

Den gamle Kotlin-server (`osrs-server` + rsprot) taler Jagex-protokol, men **ikke** samme game engine som xrsps. At køre den parallelt giver RuneLite-adgang til *gammelt* indhold — ikke jeres nye quests, ggwp-gamemode osv.

## Mål

Én server: **xrsps-typescript** — både browser og RuneLite.

## Hvad der skal bygges

En **Jagex-protokol gateway** (rsprot) der:

1. Lytter på TCP (fx port 43596) med login + JS5 fra OSRS-cache
2. Verificerer konto mod samme `openrune_central` som browseren
3. Opretter en WebSocket-session til den lokale xrsps-proces (port 43595)
4. Oversætter pakker begge veje:
   - Jagex client → xrsps WS (login-handshake + OSRS game opcodes)
   - xrsps WS → Jagex server packets (player sync, NPC info, interfaces)

xrsps har allerede OSRS-lignende packet encoding (`PacketHandler`, `PlayerPacketEncoder`, `NpcPacketEncoder`) — det meste arbejde er **transport + login + JS5**, ikke game logic fra bunden.

## Anbefalet arkitektur

```
RuneLite ──TCP/Jagex──► xrsps-jagex-gateway (Kotlin + rsprot)
                              │
                              └──WebSocket──► xrsps-typescript :43595
```

Gateway kan genbruge mønstre fra `/home/ggwp/osrs-server/api/net/rsprot/`.

## Revision

RuneLite-klienten er rev **238**; xrsps bruger rev **237**. Enten:

- Opgradér xrsps-cache til 238, eller
- Byg RuneLite-klient mod 237

## Eksisterende assets

- RuneLite-fork: `/home/ggwp/ggwp-osrs-client` (GGWP plugins, RSA-patch, launcher)
- Downloads: `https://ggwp.dk/downloads/osrs/`
- rsprot-reference: `/home/ggwp/osrs-server/api/net/`

## Ikke en løsning

- Køre `osrs-server` parallelt — anden server, andet save-format, andet indhold
- Kun ændre host/port i RuneLite — gamepack taler stadig Jagex TCP, ikke WebSocket
