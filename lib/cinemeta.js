'use strict';

/**
 * Cinemeta is Stremio's built-in metadata engine (no key needed).
 * We only need it to turn an IMDb id into a title + year for torrent search.
 */

const { cached } = require('./cache');

const DAY = 24 * 60 * 60 * 1000;

async function movieMeta(imdbId) {
  return cached(`cinemeta:${imdbId}`, 7 * DAY, async () => {
    const res = await fetch(`https://v3-cinemeta.strem.io/meta/movie/${encodeURIComponent(imdbId)}.json`);
    if (!res.ok) throw new Error(`cinemeta ${res.status} for ${imdbId}`);
    const j = await res.json();
    const m = j && j.meta;
    if (!m || !m.name) throw new Error(`cinemeta: no meta for ${imdbId}`);
    const year = parseInt(String(m.releaseInfo || '').slice(0, 4), 10);
    return { id: m.imdb_id || m.id, name: m.name, year: Number.isFinite(year) ? year : null };
  });
}

module.exports = { movieMeta };
