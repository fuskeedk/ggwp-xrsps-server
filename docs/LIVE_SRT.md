# SRT streaming — live.ggwp.dk

Live-ingest på fluxhost via **MediaMTX** (Docker). Seere afspiller HLS på https://live.ggwp.dk.

## Arkitektur

```
OBS (SRT) → UDP :8890 MediaMTX → HLS :8888 → Apache /hls/ → https://live.ggwp.dk
```

Eksisterende **nginx-rtmp** på TCP `:1935` (`/usr/local/nginx-rtmp`) er uændret (Twitch-relay). MediaMTX bruger **ikke** RTMP.

## Server-stier

| Sti | Indhold |
|-----|---------|
| `/home/live/srt/` | `docker-compose.yml`, `mediamtx.yml`, `OBS.txt`, `STREAM_KEY.txt` |
| `/home/live/public_html/index.html` | Player |
| `/etc/apache2/conf-available/live-ggwp-hls-proxy.conf` | Proxy `/hls/` → `127.0.0.1:8888` |

## Drift

```bash
cd /home/live/srt
docker compose up -d
docker compose logs -f mediamtx
docker compose restart
```

## OBS

1. Settings → Stream → Service: **Custom**
2. Server URL:

```
srt://live.ggwp.dk:8890?streamid=publish:live:ggwp:STREAM_KEY&pkt_size=1316
```

`STREAM_KEY` ligger i `/home/live/srt/STREAM_KEY.txt` (root) og i `/home/live/srt/OBS.txt`.

## Afspilning

- https://live.ggwp.dk
- https://live.ggwp.dk/hls/live/index.m3u8

## Porte

| Port | Brug |
|------|------|
| 8890/udp | SRT ingest |
| 8888/tcp | HLS (localhost; proxied via Apache) |
| 8889/tcp | WebRTC signaling |
| 8189/udp | WebRTC ICE |
| 9997/tcp | MediaMTX API (`127.0.0.1` only) |

## Auth

Kun publish kræver login (`ggwp` + stream key). Read/HLS er åben.
