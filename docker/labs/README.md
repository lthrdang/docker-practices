# The lab application

One small system, introduced piece by piece across the week.

```
Windows browser
      │
   nginx ──────────► api ──────► postgres      (users)
  (reverse proxy)     │  └─────► redis         (cache + job queue)
                      │                            │
                      │                          worker  (Python)
                      │                            │
                      └──────── shared volume ─────┘
                                  (/data)
```

**Every service is deliberately tiny.** You are here to learn Docker, not to
read someone else's business logic. Read the source — all of it fits on a
screen.

---

## What each piece is for, pedagogically

| Service | Language | Teaches |
|---|---|---|
| `app-api` | Node.js | Building an image, layer caching, multi-stage, non-root |
| `postgres` | (official image) | Named volumes, data that must survive, healthchecks |
| `redis` | (official image) | A second network dependency; ephemeral vs persistent data |
| `app-worker` | Python | Cross-language container communication; **volume-based** IPC |
| `nginx` | (official image) | Reverse proxy, network isolation, `--scale` load balancing |

The worker is Python on purpose: it proves that containers communicate over
protocols and filesystems, not over shared language runtimes.

---

## The API endpoints, and which lesson each one serves

| Endpoint | Does | Used in |
|---|---|---|
| `GET /health` | Returns 200 if the process is up | Day 5 — `healthcheck` |
| `GET /ready` | Returns 200 only if Postgres **and** Redis answer | Day 5 — readiness vs liveness |
| `GET /users` | Reads from Postgres (creates + seeds the table on first call) | Day 3 — volume persistence |
| `GET /cache-demo` | `INCR` a Redis counter | Day 4 — a second network hop |
| `POST /jobs` | Pushes a job onto a Redis list | Day 4 — container → container |
| `GET /files` | Lists files in `/data` | Day 3 — shared-volume IPC |
| `GET /whoami` | Returns hostname, UID, and resolved peer IPs | Days 1, 4 — proving what you are looking at |

`/whoami` is the one you will use most while debugging. It tells you which
container instance answered (useful under `--scale`), what user the process
runs as (Day 2's non-root work), and what the service names resolve to
(Day 4's DNS).

---

## Running it before you have learned how

You are not supposed to be able to yet — that is the week. But if you want to
see the finished thing on Day 1:

```bash
cd compose
docker compose -f 05-final.yaml up -d
curl localhost:8080/health
docker compose -f 05-final.yaml down
```

The compose files are numbered in the order they are introduced:

| File | Introduced | What it adds |
|---|---|---|
| `01-single.yaml` | Day 5 | One service. The smallest possible compose file. |
| `02-db.yaml` | Day 5 | Adds Postgres + a named volume |
| `03-healthcheck.yaml` | Day 5 | Adds healthchecks and correct startup ordering |
| `04-networks.yaml` | Day 5 | Splits frontend/backend networks; hides Postgres |
| `05-final.yaml` | Day 5 | Adds nginx, redis, worker — the full system |
| `compose.override.yaml` | Day 5 | Dev-only: bind mount + hot reload |

Read them in order. Each one is a diff against the previous.

---

## Line endings

This directory ships a [`.gitattributes`](.gitattributes) that pins everything
to LF. Do not remove it. If you are curious what it prevents, see
[WSL2-NOTES.md](../WSL2-NOTES.md) #2 — and Day 2 makes you break it on purpose.
