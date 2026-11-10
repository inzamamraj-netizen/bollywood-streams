'use strict';

/**
 * Public torrent sources — searched in parallel:
 *  - Torrents-CSV (community index, https://torrents-csv.com)
 *  - PirateBay mirror API (apibay.org)
 *  - YTS (official base https://movies-api.accel.li, fallback yts.lt)
 *
 * All are thin fetch adapters; matching/ranking lives in lib/match.js.
 */

const { cached } = require('./cache');

const TIMEOUT_MS = 15000;
const HOUR = 60 * 60 * 1000;

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${new URL(url).host}`);
  return res.json();
}

function intOr0(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}

async function searchTorrentsCsv(q) {
  return cached(`tcsv:${q}`, HOUR, async () => {
    const j = await fetchJson(`https://torrents-csv.com/service/search?q=${encodeURIComponent(q)}`);
    const rows = (j && j.torrents) || [];
    return rows
      .filter(r => r.infohash && r.name)
      .map(r => ({
        name: r.name,
        infoHash: String(r.infohash).toLowerCase(),
        seeders: intOr0(r.seeders),
        sizeBytes: intOr0(r.size_bytes),
      }));
  });
}

async function searchApibay(q) {
  return cached(`apibay:${q}`, HOUR, async () => {
    const rows = await fetchJson(`https://apibay.org/q.php?q=${encodeURIComponent(q)}`);
    if (!Array.isArray(rows)) return [];
    return rows
      .filter(r => r.info_hash && r.info_hash !== '0' && r.name)
      .map(r => ({
        name: r.name,
        infoHash: String(r.info_hash).toLowerCase(),
        seeders: intOr0(r.seeders),
        sizeBytes: intOr0(r.size),
      }));
  });
}

// '2.1 GB' -> bytes (approximate is fine for labeling)
function sizeStrToBytes(s) {
  if (!s) return 0;
  const m = String(s).match(/([\d.]+)\s*(KB|MB|GB|TB)/i);
  if (!m) return 0;
  const mult = { KB: 1024 ** 2 / 1000, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 }[m[2].toUpperCase()];
  return Math.round(parseFloat(m[1]) * mult);
}

async function searchYts(q) {
  return cached(`yts:${q}`, HOUR, async () => {
    const bases = ['https://movies-api.accel.li/api/v2', 'https://yts.lt/api/v2'];
    let lastErr;
    for (const base of bases) {
      try {
        const j = await fetchJson(`${base}/list_movies.json?query_term=${encodeURIComponent(q)}&limit=50`);
        const movies = (j && j.data && j.data.movies) || [];
        const out = [];
        for (const mv of movies) {
          for (const t of mv.torrents || []) {
            if (!t.hash) continue;
            out.push({
              name: `${mv.title_long} [${t.quality}] ${t.size}`,
              infoHash: String(t.hash).toLowerCase(),
              seeders: intOr0(t.seeds),
              sizeBytes: sizeStrToBytes(t.size),
            });
          }
        }
        return out;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr;
  });
}

/** Search all sources in parallel; errors resolve to [] so one dead source never blocks playback. */
async function searchAll(title, year) {
  const cleanTitle = String(title || '').split(/[:\-–]/)[0].trim();
  const queries = new Set();

  queries.add(year ? `${title} ${year}` : title);
  if (cleanTitle && cleanTitle !== title) {
    queries.add(year ? `${cleanTitle} ${year}` : cleanTitle);
  }
  // Search with "Hindi" suffix to find Hindi dubbed / Dual Audio versions of South Indian films
  if (cleanTitle) {
    queries.add(`${cleanTitle} Hindi`);
  }

  const lookups = [];
  for (const q of queries) {
    lookups.push(searchTorrentsCsv(q), searchApibay(q));
  }
  lookups.push(searchYts(title));

  const settled = await Promise.allSettled(lookups);
  const all = settled.flatMap(s => (s.status === 'fulfilled' ? s.value : []));
  return all;
}

module.exports = { searchAll };
