# Capstone — Reference Solution

**Read after your demo, not before.**

Your version does not have to match this. If it passes the acceptance test and
you can defend each choice, it is correct — and possibly better.

---

## Run it

```bash
cd labs/solutions/capstone
cp .env.example .env
docker compose up -d --build
curl localhost:8080/ready
```

Tear down:

```bash
docker compose down       # keeps the data
docker compose down -v    # deletes the data
```

> Build contexts point at `../../app-api` and `../../app-worker` — this
> directory shares the lab application rather than duplicating it.

---

## R8 — Which mount type for which data, and why

The question the capstone is actually testing.

### Postgres data → **named volume** (`pgdata`)

Must survive container replacement, which is how every deployment works. Named
rather than bind-mounted because:

- **Portability.** No host path in the compose file, so it works identically on
  every machine. A bind mount hard-codes someone's directory layout.
- **Docker owns the filesystem semantics.** A bind mount hands the database's
  storage to whatever the host happens to provide — and on WSL2, if anyone
  points it at `/mnt/c`, to a translation layer a database has no business
  running on.
- **Not something a human edits.** Nobody opens Postgres's data directory in an
  editor. The convenience a bind mount buys is worth nothing here.

Without it, the Postgres image's own `VOLUME` declaration would create a fresh
**anonymous** volume on every `up`, and `down` would orphan it. The data is
never technically deleted — it is stranded in a volume named with 64 hex
characters.

### Worker output → **named volume**, mounted into both (`shared-data`)

Must be shared between two containers and outlive both. Named for the same
reasons as above.

This is the second way containers communicate. The job goes API → Redis →
worker over the **network**; the result comes worker → API over the **shared
volume**, with no network call between them.

The trade-off, stated so it is a decision and not an accident: **a shared
volume gives no locking.** Two writers on the same file corrupt it. Safe here
because the worker writes once, to a uniquely timestamped filename, and the API
only reads.

### API source → **bind mount, development only**

The entire point is that a human edits it on the host and the container sees it
immediately. That is what a bind mount is for and what a named volume cannot
do.

**Only in `compose.override.yaml`.** A production image contains its code; it
does not mount it. Mounting source in production means the image is no longer
what runs, and your build artifact stops being the thing you tested.

And it needs `- /app/node_modules` alongside it — see the comment in the
override file.

### Redis → **no volume**, deliberately

A cache and jobs in transit. Losing it on restart is acceptable: the cache
refills and a lost job is a queue that emptied. If it held anything that
mattered — sessions, rate-limit counters with billing consequences — it would
need a volume too.

**Written down as a decision.** "No volume" is fine when you can say why, and a
bug when you cannot.

---

## R15 — Why the API healthcheck calls `/health`, not `/ready`

| | Asks | Depends on |
|---|---|---|
| `/health` | Is this process alive? | Nothing |
| `/ready` | Can it serve traffic? | Postgres and Redis |

The image's `HEALTHCHECK` calls `/health`.

**If it called `/ready`:** Postgres restarts for thirty seconds. Every API
replica reports unhealthy. `restart: unless-stopped` plus anything watching
health restarts them all. Now the API is cold-starting *while* the database is
coming back — you have converted a thirty-second database blip into a
multi-minute outage of everything.

**A healthcheck answers "should I be restarted?"** Restarting the API does not
fix a broken Postgres, so a broken Postgres must not make the API look
unhealthy.

`/ready` still matters — it is what a load balancer should consult before
sending traffic, and what you curl when debugging. Different question, different
consumer.

This is exactly Kubernetes' liveness/readiness split. Learning it here means
you already know it there.

---

## Design notes

### Why `api` is on both networks and nginx is on one

`api` is the only service that legitimately talks to both tiers, so it is the
only one on both. Everything else gets the minimum.

The result: compromise nginx and you still cannot reach the database — the name
does not resolve from there. Verified:

```
nginx -> nslookup postgres    ** server can't find postgres: NXDOMAIN
api   -> nslookup postgres    Name: postgres  Address: 192.168.x.x
```

**With the caveat from Day 4:** name isolation is the boundary you *design*
with. Packet-level isolation between bridge networks is enforced by iptables
and varies between Docker versions and distributions. It is one control, not
the only one — which is why Postgres is also unpublished and also requires
credentials.

### Why exactly one published port

One thing to secure, one thing to monitor, one thing to reason about. Every
extra `ports:` entry is another way in, and `-p` is what actually exposes a
service — networks alone do not.

Postgres *is* published in the **override** file, on `127.0.0.1` only, because
attaching a GUI client during development is genuinely useful. Loopback-bound
means this machine only; `"5432:5432"` would listen on `0.0.0.0` and offer your
database to the whole LAN.

### Why no `container_name:`

Three containers cannot share one name, so setting it breaks `--scale api=3`
before you have started. Compose names containers `<project>-<service>-<index>`
for exactly this reason.

Same argument for not putting a fixed host port on a scalable service — three
containers cannot bind one host port. The published port belongs on the proxy
in front.

### Why `internal: true` is off

It would remove the backend network's route to the internet entirely — a real
security win. It is off because the worker may need outbound access (an
external API, a webhook), and turning it on would break that in a way that is
annoying to diagnose.

**The point is that it is a stated trade-off rather than an omission.** If the
backend genuinely never needs outbound access, turn it on; it is the documented
way to enforce that.

---

## Verified acceptance run

```
docker compose ps
  api        Up (healthy)
  nginx      Up
  postgres   Up (healthy)
  redis      Up (healthy)
  worker     Up

/ready    -> {"ready":true,"checks":{"postgres":"ok","redis":"ok"}}
/whoami   -> {"uid":1000,...}                       R2: non-root
POST /users, down (no -v), up, GET /users -> alice  R5: data survives
POST /jobs -> GET /files -> {"count":1,...}         R6: shared volume
ports     -> nginx 0.0.0.0:8080->80/tcp only        R10
nslookup  -> NXDOMAIN from nginx, resolves from api R11
image     -> capstone-api:1.0  238MB                R1: under 300MB
docker stop -> under 1s                             R4: exec form
--scale api=3 -> 9 requests split 3/3/3             bonus
```

---

## Common ways to lose points

| | |
|---|---|
| `user: root` to make a permission error go away | Fails R2. The error was real; the fix is to make the volume writable by the app's user — see [`labs/app-worker/Dockerfile`](../../app-worker/Dockerfile). |
| Postgres published in the **base** file | Fails R10. Put it in the override, on `127.0.0.1`. |
| Bind-mounting source in the **base** file | Fails R7's intent. Production runs the image, not your laptop's directory. |
| `depends_on:` as a plain list | Fails R14. It waits for *started*, not *ready*. |
| The API healthcheck calling `/ready` | Fails R15. Explained above. |
| `:latest` anywhere | −3. The same file builds a different program next month. |
| `.env` committed | −10. And rotate the credential — it is in the git history now. |
| Forgetting `- /app/node_modules` | The API crash-loops with `Cannot find module`. Day 3, Rule 2. |
