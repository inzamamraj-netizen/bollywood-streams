'use strict';

/**
 * TMDB client — powers the catalogs. Requires TMDB_API_KEY (free, themoviedb.org).
 * TMDB items have their own numeric ids; we resolve each to its IMDb id so
 * Stremio (via Cinemeta) can show full details and our stream handler matches.
 */

const { cached } = require('./cache');

const BASE = 'https://api.themoviedb.org/3';
const DAY = 24 * 60 * 60 * 1000;

// TMDB genre ids (language-agnostic)
const GENRES = {
  Action: 28,
  Adventure: 12,
  Animation: 16,
  Comedy: 35,
  Crime: 80,
  Drama: 18,
  Family: 10751,
  Fantasy: 14,
  History: 36,
  Horror: 27,
  Music: 10402,
  Mystery: 9648,
  Romance: 10749,
  'Sci-Fi': 878,
  Thriller: 53,
  War: 10752,
};

const LISTS = {
  'bollywood-popular': {
    sort_by: 'popularity.desc',
    lang: 'hi',
    label: 'Popular Hindi / Bollywood',
  },
  'bollywood-new': {
    sort_by: 'primary_release_date.desc',
    lang: 'hi',
    maxToday: true,
    label: 'New Hindi Releases',
  },
  'bollywood-top': {
    sort_by: 'vote_average.desc',
    lang: 'hi',
    minVotes: 100,
    label: 'Top Rated Hindi',
  },
  'south-indian-hindi': {
    sort_by: 'popularity.desc',
    lang: 'te|ta|ml|kn',
    label: 'South Indian Hits (Hindi Dubbed / Multi)',
  },
  'punjabi-popular': {
    sort_by: 'popularity.desc',
    lang: 'pa',
    label: 'Popular Punjabi (Pollywood)',
  },
  'punjabi-new': {
    sort_by: 'primary_release_date.desc',
    lang: 'pa',
    maxToday: true,
    label: 'New Punjabi Releases',
  },
};

let apiKey = process.env.TMDB_API_KEY || null;

function setApiKey(key) {
  apiKey = key || null;
}

function getApiKey() {
  return apiKey;
}

async function tmdbGet(pathname, params) {
  if (!apiKey) throw new Error('TMDB_API_KEY is not set — catalogs are unavailable (streams still work)');
  const url = new URL(BASE + pathname);
  url.searchParams.set('api_key', apiKey);
  for (const [k, v] of Object.entries(params || {})) {
    if (v != null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`TMDB ${res.status} for ${pathname}: ${body.slice(0, 120)}`);
  }
  return res.json();
}

/** One TMDB discover page (20 items), 3h cache. */
async function discoverPage(listId, pageNum, genreId) {
  const conf = LISTS[listId];
  if (!conf) throw new Error(`unknown catalog ${listId}`);
  const today = new Date().toISOString().slice(0, 10);
  return cached(`tmdb:${listId}:${genreId || ''}:${pageNum}`, 3 * 60 * 60 * 1000, async () => {
    const j = await tmdbGet('/discover/movie', {
      with_original_language: conf.lang || 'hi',
      include_adult: 'false',
      sort_by: conf.sort_by,
      page: pageNum,
      ...(conf.minVotes ? { 'vote_count.gte': conf.minVotes } : {}),
      ...(conf.maxToday ? { 'primary_release_date.lte': today } : {}),
      ...(genreId ? { with_genres: genreId } : {}),
    });
    return (j && j.results) || [];
  });
}

/** Fetch `count` TMDB pages in parallel and concat. */
async function discoverSlice(listId, firstPage, count, genreId) {
  const pages = await Promise.all(
    Array.from({ length: count }, (_, i) => discoverPage(listId, firstPage + i, genreId).catch(() => []))
  );
  return pages.flat();
}

/** tmdbId -> imdb id ('tt...'), cached ~forever by default. */
async function toImdbId(tmdbId) {
  return cached(`tmdb-ext-${tmdbId}`, 90 * DAY, async () => {
    const j = await tmdbGet(`/movie/${tmdbId}/external_ids`, {});
    return (j && j.imdb_id && /^tt\d+$/.test(j.imdb_id) ? j.imdb_id : null);
  });
}

/** Map a slice of TMDB results to Stremio catalog metas (IMDb ids, tmdb posters). */
async function toMetas(items) {
  const imdbIds = await Promise.all(items.map(i => toImdbId(i.id).catch(() => null)));
  const metas = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const imdb = imdbIds[i];
    if (!imdb) continue;
    const name = item.title || item.original_title;
    if (!name || item.adult) continue;
    const year = String(item.release_date || '').slice(0, 4);
    metas.push({
      id: imdb,
      type: 'movie',
      name,
      poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : undefined,
      background: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : undefined,
      releaseInfo: year || undefined,
      description: item.overview || undefined,
    });
  }
  // skip can straddle a page boundary -> the same movie can appear twice
  const seen = new Set();
  return metas.filter(m => (seen.has(m.id) ? false : (seen.add(m.id), true)));
}

/** Search across Indian languages (Hindi, Punjabi, Telugu, Tamil, Malayalam, Kannada). */
async function search(q) {
  const INDIAN_LANGS = new Set(['hi', 'pa', 'te', 'ta', 'ml', 'kn']);
  return cached(`tmdb-search:${q}`, 3 * 60 * 60 * 1000, async () => {
    const pages = await Promise.all(
      [1, 2].map(p =>
        tmdbGet('/search/movie', { query: q, include_adult: 'false', page: p }).catch(() => ({ results: [] }))
      )
    );
    const hits = pages.flatMap(p => p.results || []).filter(r => INDIAN_LANGS.has(r.original_language));
    return toMetas(hits);
  });
}

module.exports = { GENRES, LISTS, setApiKey, getApiKey, discoverSlice, toMetas, search };
