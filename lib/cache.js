'use strict';

/**
 * Tiny TTL cache: memory first, disk second (so restarts are instant),
 * and stale values surfaced on upstream failures (graceful degradation).
 */

const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'cache');
const mem = new Map();

function diskPath(key) {
  return path.join(DIR, key.replace(/[^\w.-]+/g, '_').slice(0, 150) + '.json');
}

function readDisk(key, maxAgeMs) {
  try {
    const raw = fs.readFileSync(diskPath(key), 'utf8');
    const j = JSON.parse(raw);
    if (typeof j.e !== 'number') return null;
    if (maxAgeMs !== Infinity && Date.now() - j.e > maxAgeMs) return null;
    return j.v;
  } catch {
    return null;
  }
}

function writeDisk(key, value, expiresAt) {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(diskPath(key), JSON.stringify({ v: value, e: expiresAt }));
  } catch {
    /* cache is best-effort */
  }
}

function pruneDisk() {
  try {
    if (!fs.existsSync(DIR)) return;
    for (const f of fs.readdirSync(DIR)) {
      const p = path.join(DIR, f);
      try {
        const j = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (typeof j.e === 'number' && j.e < Date.now()) fs.rmSync(p, { force: true });
      } catch {
        return; // unreadable leaves; stop early
      }
    }
  } catch {
    /* best-effort */
  }
}
pruneDisk();

/**
 * Run `fn()` and cache its result under `key` for `ttlMs`.
 * On error, serves any previous (stale) disk value instead of failing.
 */
async function cached(key, ttlMs, fn) {
  const now = Date.now();
  const hit = mem.get(key);
  if (hit && hit.e > now) return hit.v;
  const fresh = readDisk(key, ttlMs);
  if (fresh != null) {
    mem.set(key, { v: fresh, e: now + ttlMs });
    return fresh;
  }
  try {
    const value = await fn();
    mem.set(key, { v: value, e: now + ttlMs });
    writeDisk(key, value, now + ttlMs);
    return value;
  } catch (err) {
    const stale = readDisk(key, Infinity);
    if (stale != null) return stale;
    throw err;
  }
}

module.exports = { cached };
