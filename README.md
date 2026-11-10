# Bollywood Streams — Stremio Addon

Browse Hindi & Bollywood movies and stream them via public torrents.

- **Catalogs** (The Movie DB API, filtered to Hindi originals): Popular, Top Rated, New Releases, genre rows, Hindi-only search
- **Details**: served by Stremio's built-in Cinemeta (every catalog item is a real IMDb id)
- **Streams**: Torrents-CSV + PirateBay mirror + YTS, searched in parallel per movie; camera rips kept but ranked last; dead (0-seed) torrents dropped; deduped by infoHash

## Install

1. Get a free TMDB API key (2 minutes):
   - Create/login at https://www.themoviedb.org
   - Settings → API → Create → "Developer" → copy the **v3 API key**
2. In this folder:
   ```
   npm install
   TMDB_API_KEY=paste_your_key_here npm start
   ```
3. In Stremio (desktop/mobile/web): **Add-ons → Community** → paste in the search box:
   ```
   http://127.0.0.1:7001/manifest.json
   ```

Runs on port **7001** by default (port 7000 is taken by macOS AirPlay Receiver). Override with `PORT=...`.

## Files

| File | Role |
|---|---|
| `addon.js` | manifest + catalog/stream handlers |
| `lib/tmdb.js` | TMDB discover/search + TMDB→IMDb id mapping |
| `lib/cinemeta.js` | IMDb id → title/year (for torrent search) |
| `lib/providers.js` | the three torrent sources |
| `lib/match.js` | title matching, quality parsing, ranking, dedupe |
| `lib/cache.js` | memory + disk TTL cache; stale values served on upstream failures |

## Notes & troubleshooting

- Streams depend on **public seeders** — new films usually have several; very old or obscure ones may have none.
- Catalog and stream results are cached in `cache/` (safe to delete to force refresh; restart first).
- Upstream outages degrade gracefully: stale cached lists are served instead of blanks.
- `npm test` — unit tests for the matching/ranking logic (node's built-in runner).
- To relocate: any machine with Node ≥ 18; set `PORT` if 7001 is taken.
