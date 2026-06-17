# osrs-server import notes

This folder is a debug/reference import of `/home/ggwp/osrs-server` for cross-checking xRSPS behavior against the legacy Kotlin/OpenRune stack.

Included:
- source modules (`api`, `content`, `engine`, `server`, `tools`, `or-cache`)
- raw cache/data dumps (`.data/raw-cache`, quest package outputs, npc/item-related dumps)
- scripts and docs used for cache/data extraction and quest mapping

Excluded intentionally:
- local secret-bearing runtime configs (for example `game.yml`)
- `.git` metadata
- large runtime/build artifacts and platform binaries
- files above GitHub's hard 100MB limit (notably `.data/cache/LIVE/main_file_cache.dat2`)

If you need the missing runtime blob(s), keep them on the server filesystem and reference this import side-by-side.
