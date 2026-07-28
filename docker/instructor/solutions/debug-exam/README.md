# Debug Exam — Reference Solution

**Read after the exam.**

```bash
cd ~/projects/docker-training/day5-compose-capstone/debug-exam
cp compose.yaml compose.broken.bak
cp ../../instructor/solutions/debug-exam/compose.yaml .
cp ../../instructor/solutions/debug-exam/.env.example .env
docker compose up -d --build
```

---

## The six defects

Ordered the way you would actually find them, not the way they appear in the
file.

| # | Defect | Symptom | Found by |
|---|---|---|---|
| 6 | Bind mount hides `node_modules` | API missing from `docker compose ps`; `Cannot find module 'express'` | `docker compose logs api` |
| 3 | `ports: "8080:8080"` on nginx | `curl localhost:8080` → 000, though PORTS looks healthy | `docker compose exec nginx ss -tln` → `:80` |
| 1 | `worker` on `frontend` instead of `backend` | `Name does not resolve` in the worker log, forever | `docker compose logs worker` |
| 5 | Postgres has no volume | Rows vanish across `down` + `up` | Write a row, redeploy, read it back |
| 2 | No healthcheck; plain `depends_on` list | Intermittent — the API may connect before Postgres is ready | Reading, plus `down -v` then `up` to force a cold init |
| 4 | `PGPASSWORD: SuperSecret123` literal | **None.** The stack works perfectly. | Reading the file |

Full explanations are in the comments of
[`compose.yaml`](compose.yaml), marked `FIX 1` … `FIX 6`.

---

## The two that teach the most

### #4 — the one with no symptom

Everything works. Every test passes. And the credential is in the git history
forever; changing the file later does not remove it, and the only real remedy
is rotating the secret.

**If your process for finding problems is "run it and see", you will never find
this class of defect.** Some things are only found by reading — which is what
code review is for.

### #1 — the one that fails politely

The worker did not crash. It logged a retry and waited:

```
redis not ready (Error -2 connecting to redis:6379. Name does not resolve.); retrying in 10s
```

`docker compose ps` showed it `running` the whole time. **A service that
retries politely can be broken for hours with a green dashboard.** Retry logic
is good; retry logic without an alert is a way to not notice.

Note also that this is Day 4's cause #1 — different networks, so the name does
not resolve. The error even says so.

---

## Verified fixed run

```
ps        -> api, nginx, postgres, redis, worker all running
/health   -> {"status":"ok",...}                            fix 3
/ready    -> {"ready":true,"checks":{"postgres":"ok","redis":"ok"}}
worker    -> connected to redis://redis:6379                fix 1
down (no -v) then up -> alice still present                 fix 5
node_modules in /app -> 86 packages                         fix 6
no literal password in the service definitions              fix 4
```

---

## Marking

Six defects, and for each: **correctly identified** (3 pts) + **correctly
fixed** (2 pts) = 30 points.

Partial credit worth giving:

- Fixing #3 as `"8080:8080"` plus editing nginx to listen on 8080 — **full
  marks.** It works, and it is a defensible choice; just note that changing the
  published port is the smaller change.
- Fixing #1 by adding `backend` to the worker **without** removing `frontend` —
  **4 of 5.** It works, but the worker has no business on the frontend network,
  and least privilege is the point of splitting them.
- Fixing #2 by adding `restart: unless-stopped` instead of a healthcheck —
  **2 of 5.** It masks the symptom by restarting until the race is won. Ask
  what happens when Postgres is down for a genuine reason.
- Fixing #4 by moving the password to `.env` but **not** adding `.env` to
  `.gitignore` — **3 of 5.**

**Deduct 5** for any answer of "I rewrote it from scratch". The exam is about
reading an unfamiliar file and finding what is wrong with it — which is what
you will spend far more of your career doing than writing new ones.
