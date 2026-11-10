'use strict';

const { addonBuilder } = require('stremio-addon-sdk');
const tmdb = require('./lib/tmdb');
const cinemeta = require('./lib/cinemeta');
const providers = require('./lib/providers');
const { matchAndRank } = require('./lib/match');

const CATALOG_IDS = Object.keys(tmdb.LISTS);

const manifest = {
  id: 'community.bollywoodstreams',
  version: '1.0.0',
  name: 'Bollywood Streams',
  description: 'Browse Hindi, Punjabi & South Indian dubbed movies (popular, top rated, new, by genre) and stream them via public torrents.',
  resources: ['catalog', 'stream'],
  types: ['movie'],
  idPrefixes: ['tt'],
  catalogs: [
    ...CATALOG_IDS.map(id => ({
      type: 'movie',
      id,
      name: tmdb.LISTS[id].label,
      extra: [
        { name: 'genre', options: Object.keys(tmdb.GENRES) },
        { name: 'skip', step: 100 },
      ],
    })),
    {
      type: 'movie',
      id: 'bollywood-search',
      name: 'Search Indian Movies (Hindi, Punjabi, South)',
      extra: [{ name: 'search', isRequired: true }],
    },
  ],
};

const builder = new addonBuilder(manifest);

// ---- catalog: TMDB discover / search, mapped to IMDb ids ----
builder.defineCatalogHandler(async ({ type, id, extra = {} }) => {
  if (type !== 'movie') return { metas: [] };

  if (id === 'bollywood-search') {
    const q = String(extra.search || '').trim();
    if (!q) return { metas: [] };
    return { metas: await tmdb.search(q) };
  }

  if (!CATALOG_IDS.includes(id)) return { metas: [] };

  const skip = Math.max(0, parseInt(extra.skip, 10) || 0);
  // Stremio pages in steps of 100; TMDB serves 20-item pages
  const tmdbFirstPage = 1 + Math.floor(skip / 100) * 5;
  const genreId = extra.genre && extra.genre !== 'All' ? tmdb.GENRES[extra.genre] : null;
  const items = await tmdb.discoverSlice(id, tmdbFirstPage, 5, genreId);
  return { metas: await tmdb.toMetas(items) };
});

// ---- catalog handlers must not be silent: SDK logs errors ----
// Interface wiring done below in one place.

// ---- stream: resolve tt id -> title/year (Cinemeta) -> search sources -> rank ----
builder.defineStreamHandler(async ({ type, id }) => {
  if (type !== 'movie' || !/^tt\d+$/.test(id)) return { streams: [] };
  let movie;
  try {
    movie = await cinemeta.movieMeta(id);
  } catch (err) {
    console.warn(`stream: cannot resolve ${id}: ${err.message}`);
    return { streams: [] };
  }
  if (!movie.name) return { streams: [] };

  const torrents = await providers.searchAll(movie.name, movie.year);
  const streams = matchAndRank({ title: movie.name, year: movie.year || 0 }, torrents);
  if (streams.length === 0) console.log(`stream: no sources found for ${id} (${movie.name} ${movie.year})`);
  return { streams };
});

module.exports = builder.getInterface();
