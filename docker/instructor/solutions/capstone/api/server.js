// Minimal API for the Docker training labs.
//
// Every endpoint exists to make one Docker concept observable. Read it all --
// it is about 120 lines and there is nothing clever in it.

const os = require('os');
const fs = require('fs/promises');
const dns = require('dns/promises');
const express = require('express');
const { Pool } = require('pg');
const { createClient } = require('redis');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || '/data';

// Note the defaults: `postgres` and `redis` are *service names*, not IPs.
// Docker's embedded DNS resolves them on a user-defined network. That is the
// whole Day 4 lesson, encoded in two environment variables.
const PG_HOST = process.env.PGHOST || 'postgres';
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';

const pool = new Pool({
  host: PG_HOST,
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || 'app',
  password: process.env.PGPASSWORD || 'app',
  database: process.env.PGDATABASE || 'app',
  // Fail fast. A long default timeout makes a networking problem look like a
  // hang instead of an error, which is the opposite of what you want while
  // learning.
  connectionTimeoutMillis: 3000,
});

const redis = createClient({ url: REDIS_URL });
redis.on('error', (err) => console.error('[redis]', err.message));

const app = express();
app.use(express.json());

// --- Liveness: is this process alive? Nothing else. -------------------------
// This is what a Docker HEALTHCHECK should call. It must not depend on
// Postgres or Redis: if it did, a database blip would make Docker kill and
// restart a perfectly healthy API.
app.get('/health', (_req, res) => res.json({ status: 'ok', host: os.hostname() }));

// --- Readiness: can this process actually serve traffic? -------------------
// Depends on its backing services. Day 5 uses the difference between this and
// /health to explain depends_on + condition: service_healthy.

// A dependency check must have a deadline. node-redis retries a broken
// connection forever, so `await redis.ping()` on a down Redis never settles --
// and a readiness endpoint that hangs is worse than one that reports failure,
// because a hang looks identical to a slow network.
const withTimeout = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);

app.get('/ready', async (_req, res) => {
  const checks = {};
  try {
    await withTimeout(pool.query('SELECT 1'), 3000, 'postgres');
    checks.postgres = 'ok';
  } catch (err) {
    checks.postgres = err.message;
  }
  try {
    await withTimeout(redis.ping(), 3000, 'redis');
    checks.redis = 'ok';
  } catch (err) {
    checks.redis = err.message;
  }
  const ready = Object.values(checks).every((v) => v === 'ok');
  res.status(ready ? 200 : 503).json({ ready, checks });
});

// --- Who answered, as what user, and what do names resolve to? -------------
// The most useful debugging endpoint here. Under `--scale api=3` the hostname
// tells you which instance replied.
app.get('/whoami', async (_req, res) => {
  const resolve = async (name) => {
    try {
      return (await dns.lookup(name, { all: true })).map((a) => a.address);
    } catch (err) {
      return `UNRESOLVED (${err.code})`;
    }
  };
  res.json({
    hostname: os.hostname(),
    uid: process.getuid ? process.getuid() : null,
    gid: process.getgid ? process.getgid() : null,
    resolved: {
      postgres: await resolve(PG_HOST),
      redis: await resolve(new URL(REDIS_URL).hostname),
    },
  });
});

// --- Postgres: data that must survive the container ------------------------

// Called on every request rather than once at startup, on purpose: the API may
// well come up before Postgres is accepting connections, and a one-shot
// migration at boot would fail permanently. CREATE TABLE IF NOT EXISTS is
// cheap and idempotent.
//
// This is a teaching shortcut. Real projects use a migration tool and run it
// as a separate step -- see the Day 5 discussion of startup ordering.
async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id    SERIAL PRIMARY KEY,
      name  TEXT NOT NULL,
      added TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
}

app.get('/users', async (_req, res) => {
  try {
    await ensureSchema();
    const { rows } = await pool.query('SELECT * FROM users ORDER BY id');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message, hint: `could not reach postgres at ${PG_HOST}` });
  }
});

app.post('/users', async (req, res) => {
  const name = (req.body && req.body.name) || `user-${Date.now()}`;
  try {
    await ensureSchema();
    const { rows } = await pool.query('INSERT INTO users (name) VALUES ($1) RETURNING *', [name]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Redis: a second network dependency ------------------------------------
app.get('/cache-demo', async (_req, res) => {
  try {
    const hits = await redis.incr('hits');
    res.json({ hits, servedBy: os.hostname() });
  } catch (err) {
    res.status(500).json({ error: err.message, hint: `could not reach redis at ${REDIS_URL}` });
  }
});

// --- Jobs: container -> container over the network -------------------------
app.post('/jobs', async (req, res) => {
  const message = (req.body && req.body.message) || 'hello from the api';
  try {
    await redis.lPush('jobs', JSON.stringify({ message, at: new Date().toISOString() }));
    res.status(202).json({ queued: message });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Files: container -> container over a shared volume --------------------
// The worker writes here; the API reads. No network involved at all. Day 3
// uses this to show that the network is not the only way containers interact.
app.get('/files', async (_req, res) => {
  try {
    const files = await fs.readdir(DATA_DIR);
    res.json({ dir: DATA_DIR, count: files.length, files: files.slice(-20) });
  } catch (err) {
    res.status(500).json({ error: err.message, hint: `is a volume mounted at ${DATA_DIR}?` });
  }
});

app.get('/files/:name', async (req, res) => {
  // Reject path separators so a request cannot escape DATA_DIR.
  if (/[/\\]/.test(req.params.name)) return res.status(400).json({ error: 'bad name' });
  try {
    res.type('text/plain').send(await fs.readFile(`${DATA_DIR}/${req.params.name}`, 'utf8'));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// --- Startup ---------------------------------------------------------------
// Listening on 0.0.0.0 is deliberate and load-bearing. Bind to 127.0.0.1 and
// the process is reachable only from inside its own network namespace -- so
// `-p 8080:3000` publishes a port that answers nothing. That is one of the
// break-and-fix scenarios in Day 4.
function main() {
  // Note: NOT awaited. If Redis is unreachable, node-redis keeps retrying and
  // this promise never settles -- so awaiting it would mean the API never
  // starts listening, and /health would never answer, and Docker would mark
  // the container unhealthy because of a *dependency* being down.
  //
  // That is exactly backwards. Start serving, report the dependency as
  // not-ready via /ready, and let the orchestrator decide. This is the
  // liveness-vs-readiness distinction as running code rather than a slogan.
  redis.connect().catch((err) => console.error('[redis] initial connect failed:', err.message));

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`api listening on 0.0.0.0:${PORT} (hostname=${os.hostname()}, uid=${process.getuid?.()})`);
  });
}

// Docker sends SIGTERM on `docker stop`. Handling it is what makes a container
// stop in 1 second instead of being killed after the 10-second grace period.
// You only receive this signal if the process is PID 1 -- see the exec-form
// vs shell-form discussion in Day 2.
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    console.log(`received ${sig}, shutting down`);
    process.exit(0);
  });
}

main();
