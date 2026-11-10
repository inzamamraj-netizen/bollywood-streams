'use strict';

/**
 * Pure torrent matching + ranking logic with Indian cinema & audio support.
 * Supports: Hindi, Punjabi, South Indian (Telugu, Tamil, Malayalam, Kannada),
 * Dual Audio, and Hindi Dubbed streams.
 *
 * Input torrents: { name, infoHash, seeders, sizeBytes? }
 * Returns Stremio stream objects, best first:
 * { name: 'BollyStreams', title, infoHash, sources, behaviorHints }
 */

const TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.tracker.cl:1337/announce',
  'udp://tracker.dler.org:6969/announce',
  'udp://exodus.desync.com:6969/announce',
];

const TITLE_STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'and', 'or', 'to', 'in', 'on', 'at', 'for', 'is', 'it',
]);

const CAM_RE = /\b(hd|org)?cams?(rip)?\b|\bts\b|\btelesync\b|\bscreener\b|\bdvdscr\w*\b|\bhdts\b|\bpre[-. ]?dvd\w*\b/i;

const SOURCE_RE = [
  { tag: 'Remux', re: /\bremux\b/i, score: 0 },
  { tag: 'BluRay', re: /\b(bluray|bdrip|brrip|blu-ray)\b/i, score: 1 },
  { tag: 'WEB-DL', re: /\b(web-?dl|webdl)\b/i, score: 2 },
  { tag: 'WEBRip', re: /\b(web-?rip|hdrip|hdtv|webdlrip)\b/i, score: 3 },
  { tag: 'DVD', re: /\b(dvdrip|dvd-?r)\b/i, score: 4 },
];

const TAG_RES = [
  { label: 'x265', re: /\b(x265|hevc)\b/i },
  { label: '10bit', re: /\b10bit\b/i },
  { label: 'HDR', re: /\bhdr(10)?\+?\b/i },
  { label: 'DV', re: /\b(dovi|dv|dolby.?vision)\b/i },
  { label: '5.1', re: /\b5\.?[01]\b/i },
  { label: 'Atmos', re: /\batmos\b/i },
];

const AUDIO_TAG_RES = [
  { label: 'Dual Audio', re: /\b(dual[-. ]?audio|multi[-. ]?audio|multi[-. ]?lang)\b|\[(hin|hindi)[-+ ]+(eng|tam|tel|mal)/i },
  { label: 'Hindi Dubbed', re: /\b(hindi[-. ]?dubbed|dubbed[-. ]?in[-. ]?hindi|hindi[-. ]*\(?cleaned?\)?|cleaned?[-. ]?hindi|hin[-. ]?audio)\b/i },
  { label: 'Hindi', re: /\b(hindi)\b/i },
  { label: 'Punjabi', re: /\b(punjabi|panjabi)\b/i },
  { label: 'Tamil Dubbed', re: /\b(tamil[-. ]?dubbed|dubbed[-. ]?in[-. ]?tamil)\b/i },
  { label: 'Tamil', re: /\b(tamil)\b/i },
  { label: 'Telugu Dubbed', re: /\b(telugu[-. ]?dubbed|dubbed[-. ]?in[-. ]?telugu)\b/i },
  { label: 'Telugu', re: /\b(telugu)\b/i },
  { label: 'Malayalam', re: /\b(malayalam)\b/i },
  { label: 'Kannada', re: /\b(kannada)\b/i },
];

const RES_RE = /\b(4k|2160p?|1080p?|720p?|480p?|360p?)\b/i;

function resolveQuality(name) {
  const m = name.match(RES_RE);
  if (!m) return null;
  const n = m[1].toLowerCase().replace('p', '');
  if (n === '4k' || n === '2160') return '2160p';
  if (n === '1080') return '1080p';
  if (n === '720') return '720p';
  if (n === '480') return '480p';
  if (n === '360') return '360p';
  return null;
}

function tokenize(s) {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !TITLE_STOPWORDS.has(w));
}

function primaryTitleTokens(title) {
  const mainPart = String(title || '').split(/[:\-–]/)[0].trim();
  return tokenize(mainPart);
}

function yearsIn(name) {
  const years = [];
  const re = /(19\d\d|20\d\d)/g;
  let m;
  while ((m = re.exec(name)) !== null) years.push(parseInt(m[1], 10));
  return years;
}

function sourceTag(name) {
  for (const s of SOURCE_RE) {
    if (s.re.test(name)) return s.tag;
  }
  return null;
}

function sourceScore(name) {
  for (const s of SOURCE_RE) {
    if (s.re.test(name)) return s.score;
  }
  return 5;
}

function audioTagsIn(name) {
  const tags = new Set();
  for (const a of AUDIO_TAG_RES) {
    if (a.re.test(name)) tags.add(a.label);
  }
  if (tags.has('Hindi Dubbed') && tags.has('Hindi')) tags.delete('Hindi');
  if (tags.has('Tamil Dubbed') && tags.has('Tamil')) tags.delete('Tamil');
  if (tags.has('Telugu Dubbed') && tags.has('Telugu')) tags.delete('Telugu');
  return Array.from(tags);
}

function audioPriorityScore(name) {
  const tags = audioTagsIn(name);
  if (tags.includes('Dual Audio') || tags.includes('Hindi Dubbed')) return 0;
  if (tags.includes('Hindi')) return 1;
  if (tags.length > 0) return 2;
  return 3;
}

function tagsIn(name) {
  const tags = [];
  for (const t of TAG_RES) {
    if (t.re.test(name)) tags.push(t.label);
  }
  return tags;
}

function fmtSize(bytes) {
  if (!bytes || bytes <= 0) return null;
  const GB = 1024 ** 3;
  if (bytes >= 0.85 * GB) return `${(bytes / GB).toFixed(1)} GB`;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

function isMatch(movieTokens, primaryTokens, movieYear, torrent) {
  if (torrent.seeders <= 0) return false;
  if (torrent.sizeBytes != null && (torrent.sizeBytes < 1024 * 1024 || torrent.sizeBytes > 80 * 1024 ** 3)) return false;

  const nameTokenSet = new Set(tokenize(torrent.name));

  // Match full movie title tokens OR primary title tokens (for subtitles like "Pushpa: The Rise - Part 1")
  const allMatch = movieTokens.length > 0 && movieTokens.every(tok => nameTokenSet.has(tok));
  const primaryMatch = primaryTokens.length > 0 && primaryTokens.every(tok => nameTokenSet.has(tok));

  if (!allMatch && !primaryMatch) return false;

  // explicit wrong year -> reject; missing year allowed only for distinctive (3+ word) titles
  const years = yearsIn(torrent.name);
  if (years.length > 0) {
    if (!years.some(y => Math.abs(y - movieYear) <= 1)) return false;
  } else if ((allMatch ? movieTokens.length : primaryTokens.length) <= 2) {
    return false;
  }
  return true;
}

function rank(torrent) {
  const cam = CAM_RE.test(torrent.name);
  const quality = resolveQuality(torrent.name);
  const resTier = quality ? ['2160p', '1080p', '720p', '480p', '360p'].indexOf(quality) : 4;
  const audioScore = audioPriorityScore(torrent.name);
  const seeders = torrent.seeders || 0;
  const sizeBytes = torrent.sizeBytes || 0;
  return [
    cam ? 1 : 0,
    resTier,
    audioScore,
    sourceScore(torrent.name),
    -Math.min(seeders, 1e9),
    -Math.min(sizeBytes, 1e12),
  ];
}

function matchAndRank(movie, torrents) {
  const movieTokens = tokenize(movie.title);
  const primaryTokens = primaryTitleTokens(movie.title);

  const matched = torrents
    .filter(tr => isMatch(movieTokens, primaryTokens, movie.year, tr))
    .sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      for (let i = 0; i < ra.length; i++) {
        if (ra[i] !== rb[i]) return ra[i] - rb[i];
      }
      return 0;
    });

  // dedupe by info hash (case-insensitive across providers), keep the more-seeded copy
  const byHash = new Map();
  for (const tr of matched) {
    const key = String(tr.infoHash).toLowerCase();
    const prev = byHash.get(key);
    if (!prev || tr.seeders > prev.seeders) byHash.set(key, tr);
  }

  const streams = [];
  for (const tr of byHash.values()) {
    const cam = CAM_RE.test(tr.name);
    const quality = resolveQuality(tr.name);
    const audioTags = audioTagsIn(tr.name);
    const audioBadge = audioTags.length > 0 ? `🎧 ${audioTags.join(' / ')}` : null;

    const parts = [
      cam ? 'CAM' : quality,
      audioBadge,
      sourceTag(tr.name),
      fmtSize(tr.sizeBytes),
      `${tr.seeders} seeds`,
      ...tagsIn(tr.name),
    ].filter(Boolean);

    streams.push({
      name: 'BollyStreams',
      title: parts.join(' · '),
      infoHash: String(tr.infoHash).toLowerCase(),
      quality: quality || 'CAM',
      sources: TRACKERS,
      behaviorHints: { bingeGroup: `bollywoodstreams:${quality || 'cam'}` },
    });
  }
  return streams;
}

module.exports = { matchAndRank };
