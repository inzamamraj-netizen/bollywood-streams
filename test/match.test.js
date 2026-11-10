'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { matchAndRank } = require('../lib/match');

const t = (name, infoHash, seeders = 10, sizeBytes = 2 * 1024 ** 3) => ({
  name,
  infoHash,
  seeders,
  sizeBytes,
});

test('matches a torrent whose name is the movie title plus junk', () => {
  const results = matchAndRank(
    { title: 'Jawan', year: 2023 },
    [t('Jawan (2023) [1080p] [WEBRip] [YTS.MX]', '6cd6c324e518400c5dcd11fa49fd263707837288', 25)]
  );
  assert.equal(results.length, 1);
  assert.equal(results[0].infoHash, '6cd6c324e518400c5dcd11fa49fd263707837288');
  assert.equal(results[0].quality, '1080p');
});

test('ignores case, brackets and punctuation when matching', () => {
  const results = matchAndRank(
    { title: 'Jawan', year: 2023 },
    [t('JaWaN.2023.Hindi.1080p.NF.WEB-DL.x264', '1630dbdd', 8)]
  );
  assert.equal(results.length, 1);
});

test('rejects a different movie that merely shares a title token', () => {
  // "Jawani" is not "Jawan" — token equality, not substring matching
  const results = matchAndRank(
    { title: 'Jawan', year: 2023 },
    [t('Jawani (2023) 1080p WEBRip', 'aaa1', 50)]
  );
  assert.equal(results.length, 0);
});

test('rejects torrents with a wrong explicit year', () => {
  const results = matchAndRank(
    { title: 'Jawan', year: 2023 },
    [t('Jawan (2020) 1080p BluRay', 'bbb2', 100)]
  );
  assert.equal(results.length, 0);
});

test('requires a year for short titles without one in the torrent name', () => {
  const results = matchAndRank(
    { title: 'Animal', year: 2023 },
    [t('Animal 1080p BluRay x264 DTS', 'ccc3', 30)]
  );
  assert.equal(results.length, 0);
});

test('allows a missing year for distinctive multi-word titles', () => {
  const results = matchAndRank(
    { title: 'Laal Singh Chaddha', year: 2022 },
    [t('Laal Singh Chaddha 720p WEB-DL', 'ddd4', 15)]
  );
  assert.equal(results.length, 1);
});

test('drops torrents with zero seeders', () => {
  const results = matchAndRank(
    { title: 'Jawan', year: 2023 },
    [t('Jawan (2023) 1080p WEBRip', 'eee5', 0)]
  );
  assert.equal(results.length, 0);
});

test('keeps camera releases but ranks them last and labels them CAM', () => {
  const results = matchAndRank(
    { title: 'Jawan', year: 2023 },
    [
      t('Jawan (2023) HDCAM 1080p x264 Rip', 'fff6', 5),
      t('Jawan (2023) 1080p BluRay x265', '7777', 40),
    ]
  );
  assert.equal(results.length, 2);
  assert.ok(results[1].title.includes('CAM'));
  assert.match(results[1].title, /CAM/);
});

test('ranks resolution first, then source quality, then seeders', () => {
  const results = matchAndRank(
    { title: 'Jawan', year: 2023 },
    [
      t('Jawan (2023) 720p WEB-DL 500 seeds', 'h001', 500),
      t('Jawan (2023) 2160p WEB-DL 5 seeds', 'h002', 5),
      t('Jawan (2023) 1080p WEBRip 100 seeds', 'h003', 100),
      t('Jawan (2023) 1080p BluRay 60 seeds', 'h004', 60),
    ]
  );
  assert.deepEqual(
    results.map(r => r.infoHash),
    ['h002', 'h004', 'h003', 'h001']
  );
});

test('dedupes the same info hash across providers, keeping more seeders', () => {
  const results = matchAndRank(
    { title: 'Jawan', year: 2023 },
    [
      t('Jawan (2023) [1080p] [WEBRip]', '6CD6C324E518400C5DCD11FA49FD263707837288', 3),
      t('Jawan (2023) [1080p] [WEBRip] [YTS.MX]', '6cd6c324e518400c5dcd11fa49fd263707837288', 25),
    ]
  );
  assert.equal(results.length, 1);
  assert.match(results[0].title, /25 seeds/);
});

test('stream label carries quality, size and seed count', () => {
  const results = matchAndRank(
    { title: 'Jawan', year: 2023 },
    [t('Jawan (2023) [1080p] [WEBRip]', 'i007', 25, 3377937342)]
  );
  assert.ok(results[0].title.includes('1080p'));
  assert.ok(results[0].title.includes('GB'));
  assert.ok(results[0].title.includes('25 seeds'));
});

test('carries encoding/source tags like x265 HDR into the label', () => {
  const results = matchAndRank(
    { title: 'Jawan', year: 2023 },
    [t('Jawan (2023) [2160p] [x265] [10bit] [HDR] [DV]', 'j008', 30)]
  );
  assert.ok(results[0].title.includes('x265'));
  assert.ok(results[0].title.includes('HDR'));
});

test('every stream has the infoHash Stremio needs and a binge group', () => {
  const results = matchAndRank(
    { title: 'Jawan', year: 2023 },
    [t('Jawan (2023) 1080p WEBRip', 'k009', 12)]
  );
  assert.equal(results[0].name, 'BollyStreams');
  assert.equal(typeof results[0].infoHash, 'string');
  assert.ok(results[0].behaviorHints && results[0].behaviorHints.bingeGroup);
});

test('identifies and labels Dual Audio and Hindi Dubbed streams', () => {
  const results = matchAndRank(
    { title: 'Pushpa: The Rise - Part 1', year: 2021 },
    [
      t('Pushpa The Rise - Part 1 (2021) Hindi (Cleaned) 720p AMZN WEB-DL', 'p001', 44),
      t('Pushpa (2021) Dual Audio [Telugu + Hindi] 1080p WEB-DL', 'p002', 20),
      t('Pushpa (2021) 1080p Telugu Original WEB-DL', 'p003', 15),
    ]
  );
  assert.equal(results.length, 3);
  assert.ok(results.some(r => r.title.includes('🎧 Dual Audio')));
  assert.ok(results.some(r => r.title.includes('🎧 Hindi Dubbed')));
});

test('matches Punjabi movie torrents with Punjabi audio tag', () => {
  const results = matchAndRank(
    { title: 'Carry On Jatta 3', year: 2023 },
    [t('Carry On Jatta 3 (2023) Punjabi 1080p WEB-DL x264', 'c001', 18)]
  );
  assert.equal(results.length, 1);
  assert.ok(results[0].title.includes('🎧 Punjabi'));
});
