'use strict';

try {
  process.loadEnvFile();
} catch (e) {}

const { serveHTTP } = require('stremio-addon-sdk');
// addon.js wires TMDB key from env when first imported
require('./lib/tmdb').setApiKey(process.env.TMDB_API_KEY);
const addon = require('./addon');

// port 7000 is taken by macOS AirPlay Receiver
const PORT = parseInt(process.env.PORT, 10) || 7001;

if (!process.env.TMDB_API_KEY) {
  console.warn(
    '\n⚠  TMDB_API_KEY is not set.\n' +
    '   Catalog rows will fail (streams still work).\n' +
    '   Get a free key at https://www.themoviedb.org/settings/api\n' +
    '   then run: TMDB_API_KEY=yourkey npm start\n'
  );
}

serveHTTP(addon, { port: PORT, static: '/public' })
  .then(({ url }) => {
    console.log(`\n✔ Bollywood Streams addon is running.`);
    console.log(`  Add to Stremio ->  ${url}\n`);
  })
  .catch(err => {
    console.error('Failed to start addon server:', err.message);
    process.exit(1);
  });
