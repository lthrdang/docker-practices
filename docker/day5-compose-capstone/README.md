# Day 5 — Docker Compose, capstone & assessment

**Goal:** take everything from the week and make it one file and one command —
then prove you can build and debug such a system on your own.

Compose is where images, volumes and networks come together. Almost nothing
today is a new concept: it is the same mechanisms you already understand,
written declaratively instead of typed.

| | |
|---|---|
| **Morning** | Compose theory + [lab/](lab/) (~3h) |
| **Afternoon** | [Capstone](capstone.md) in pairs (~2.5h) |
| **End of day** | [Assessment](../ASSESSMENT.md) |
| **Warm-up** | KodeKloud Playground, 15 min — bring up a two-service `compose.yaml` |

> **A full day.** If a 6-hour day does not work for your team, the capstone
> works equally well as a take-home project reviewed the following week — the
> rubric does not change.

---

## 1. What Compose actually does

Yesterday you built the isolation model by hand:

```bash
docker network create frontend-net
docker network create backend-net
docker volume create pgdata
docker run -d --name postgres --network backend-net --network-alias postgres \
  -e POSTGRES_USER=app -e POSTGRES_PASSWORD=app -e POSTGRES_DB=app \
  -v pgdata:/var/lib/postgresql/data postgres:17-alpine
docker run -d --name redis --network backend-net --network-alias redis redis:7-alpine
docker run -d --name api --network backend-net --network-alias api ... api:ref
docker network connect frontend-net api
docker run -d --name nginx --network frontend-net -p 8080:80 ... nginx:alpine
```

Eight commands, in an order that mattered, with flags you had to remember and
no record of any of it afterwards. Someone joining the team gets a README that
is already out of date.

Compose replaces that with **one file, checked into git, that is the truth**.

```bash
docker compose up -d
```

**Compose is not a new runtime.** It reads YAML and issues the same API calls
you were making by hand. Everything you learned this week still applies — this
is a nicer way to say it.

---

## 2. Your first compose file

[`labs/compose/01-single.yaml`](../labs/compose/01-single.yaml):

```yaml
services:
  api:
    build: ../app-api
    ports:
      - "8080:3000"
```

```bash
cd ~/projects/docker-training/labs/compose
docker compose -f 01-single.yaml up -d
curl localhost:8080/health
```

**Look at what you did not have to write:**

```bash
docker network ls | grep compose        # compose_default -- created for you
docker compose -f 01-single.yaml ps     # compose-api-1  -- named for you
```

Compose automatically:
- creates a **network for the project** and puts every service on it
- names containers `<project>-<service>-<index>`
- makes **the service name a DNS name** on that network

That last one is the important one, and it is exactly Day 4's mechanism —
Compose just sets up the user-defined network and the alias for you.

The project name defaults to the directory name. Override it with `-p` or
`COMPOSE_PROJECT_NAME`. It is what keeps two projects' containers, networks and
volumes from colliding.

---

## 3. The structure

```yaml
services:      # the containers
networks:      # the networks they attach to
volumes:       # the named volumes they mount
configs:       # config files (mostly Swarm; bind mounts are the common way)
secrets:       # secrets (mostly Swarm)
```

### `build` vs `image`

```yaml
build: ../app-api          # build from a Dockerfile in that directory
image: postgres:17-alpine  # pull a prebuilt image
```

Both together means "build this, and tag the result with that name". A longer
form gives you build arguments:

```yaml
build:
  context: ../app-api
  dockerfile: Dockerfile
  args:
    NODE_VERSION: "22"
```

> `docker compose up` does **not** rebuild when your Dockerfile changes. Use
> `up --build`, or `docker compose build`. Forgetting this and wondering why
> your change had no effect happens to everyone once.

### `ports` — same rules as Day 4

```yaml
ports:
  - "8080:3000"              # HOST:CONTAINER
  - "127.0.0.1:5432:5432"    # bind to loopback only -- not the whole LAN
  - "3000"                   # random host port, rarely what you want
```

**Quote them.** Unquoted `5432:5432` is fine, but `22:22` is parsed by YAML as
a sexagesimal number. Quoting sidesteps the whole class of problem.

If a service does not need to be reachable from outside, **give it no `ports:`
at all.** Other services still reach it by name over the project network.

### `environment` and `env_file`

```yaml
environment:
  PGHOST: postgres
  PGUSER: ${POSTGRES_USER}         # substituted from .env or your shell

env_file:
  - .env.app                       # read a whole file
```

Compose reads `.env` from the project directory automatically for `${VAR}`
substitution.

**Commit `.env.example`, never `.env`.** The example documents which variables
exist without leaking their values. That pairing is the convention — follow it.

```bash
docker compose -f 05-final.yaml config
```

Prints the fully resolved file with every variable substituted. **This is the
best debugging tool in Compose** — it shows you what Compose actually thinks
you asked for, which is regularly not what you meant.

### `volumes` — Day 3, unchanged

```yaml
services:
  postgres:
    volumes:
      - pgdata:/var/lib/postgresql/data        # named volume
      - ./config.conf:/etc/app/config.conf:ro  # bind mount, read-only
      - /app/node_modules                      # anonymous -- the Day 3 shield

volumes:
  pgdata:                    # must be declared here to be used above
  legacy:
    external: true           # created outside Compose; Compose will not delete it
```

**`docker compose down` keeps named volumes. `docker compose down -v` deletes
them.** Learn the difference now — `-v` on the wrong project deletes a
database.

---

## 4. Startup ordering — the most common Compose bug

```yaml
depends_on:
  - postgres
```

**This only waits for the postgres container to START.** Not for Postgres to be
ready to accept connections. Postgres takes seconds to initialise, and on a
first run — while it creates the database — considerably longer.

So the API starts, connects, fails. On a good day it retries and recovers. On a
bad day it crash-loops, and you get a bug that appears only on a cold start,
only on slower machines, and never on yours.

**"Just add `sleep 5`" is a guess, not a solution.** It is too long on a fast
machine and too short on a loaded one.

### The fix: healthchecks

```yaml
services:
  api:
    depends_on:
      postgres:
        condition: service_healthy    # wait for READY, not merely started

  postgres:
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d app"]
      interval: 5s        # how often
      timeout: 3s         # how long to wait for an answer
      retries: 5          # consecutive failures before "unhealthy"
      start_period: 10s   # grace window; failures here do not count
```

Verified output from [`03-healthcheck.yaml`](../labs/compose/03-healthcheck.yaml):

```
Container compose-postgres-1  Starting
Container compose-postgres-1  Started
Container compose-postgres-1  Waiting
Container compose-postgres-1  Healthy      ← only now...
Container compose-api-1       Starting     ← ...does the API start
```

`condition:` values:

| Value | Waits until |
|---|---|
| `service_started` | the container has started (the weak default) |
| `service_healthy` | its healthcheck passes |
| `service_completed_successfully` | it has exited with code 0 — for migration/seed jobs |

**A healthcheck must test the thing that matters.** `pg_isready` asks exactly
the right question. `CMD ["true"]` would also pass and would tell you nothing.

### Liveness vs readiness — why our API has two endpoints

The API's own `HEALTHCHECK` calls `/health`, **not** `/ready`. Deliberately.

| | Asks | Depends on |
|---|---|---|
| `/health` | Is this process alive? | Nothing |
| `/ready` | Can it serve traffic? | Postgres and Redis |

If the healthcheck called `/ready`, a Postgres restart would mark a perfectly
healthy API as unhealthy, and anything watching health would restart it. **One
dependency blipping would take down the whole stack.**

**Rule: a healthcheck answers "should I be restarted?", not "is everything I
depend on working?"** This distinction is the entire basis of Kubernetes
liveness and readiness probes — learning it here means you already know it
there.

> Even with healthchecks, **write applications that retry.** Compose orders the
> first start; it cannot stop Postgres restarting at 3 a.m. while your API is
> running. See the retry loop in
> [`labs/app-worker/worker.py`](../labs/app-worker/worker.py) — healthchecks and
> retries solve different halves of the same problem.

---

## 5. Networks in Compose — Day 4, declared

```yaml
services:
  nginx:
    networks: [frontend]
  api:
    networks: [frontend, backend]     # the bridge between tiers
  postgres:
    networks: [backend]

networks:
  frontend:
  backend:
    # internal: true    # no route to the outside world at all
```

Verified from [`04-networks.yaml`](../labs/compose/04-networks.yaml):

```
nginx -> nslookup postgres    ** server can't find postgres: NXDOMAIN
api   -> nslookup postgres    Name: postgres  Address: 192.168.117.2
```

Same isolation as Day 4, eleven lines instead of ten commands.

`internal: true` is the documented way to say "this network has no external
connectivity" — enforced by Docker, not by convention. Worth knowing when a
tier genuinely must not reach the internet.

> Day 4's caveat still stands: **name isolation is the boundary you design
> with.** Packet-level isolation between bridge networks is enforced by
> iptables and varies between Docker versions and distributions. Never rely on
> it alone — also do not publish the port, and require real credentials.

---

## 6. Scaling, and a real bug it exposes

```bash
docker compose -f 05-final.yaml up -d --scale api=3
```

Verified: nine requests through nginx, distributed **3 / 3 / 3** across the
replicas. And inside the network:

```
nslookup api
Address: 192.168.107.2
Address: 192.168.107.4
Address: 192.168.107.5
```

Docker's DNS returns **all three**, and clients spread across them.

**This only works because of three lines in
[`labs/nginx/default.conf`](../labs/nginx/default.conf):**

```nginx
resolver 127.0.0.11 valid=10s;
set $upstream http://api:3000;
proxy_pass $upstream$request_uri;
```

With a plain `proxy_pass http://api:3000;`, **nginx resolves the name once at
startup, caches that single IP forever, and sends 100% of traffic to one
replica** — while you watch the other two sit idle and conclude that scaling
does not work. It does; nginx just never looked again.

Using a variable in `proxy_pass` defers resolution to request time. This is a
real production bug, not a lab curiosity.

Two constraints on scaling:

- **Never set `container_name:`** on a service you might scale — three
  containers cannot share one name.
- **Never set a fixed host `ports:`** on one either — three containers cannot
  bind the same host port. Put the published port on the proxy in front.

---

## 7. Override files and profiles

Compose merges `compose.yaml` with `compose.override.yaml` automatically on a
bare `docker compose up`. Base = true everywhere. Override = true only on a
developer's machine.

```yaml
# compose.override.yaml
services:
  api:
    ports: ["3000:3000"]        # reach the API without going through nginx
    volumes:
      - ../app-api:/app         # live source
      - /app/node_modules       # the Day 3 shield -- verified: 86 packages survive
    command: ["node", "--watch", "server.js"]
  postgres:
    ports: ["127.0.0.1:5432:5432"]   # attach a GUI client, loopback only
```

Merge rules: later files win; scalars are overwritten; **lists like `ports:`
are replaced, not appended**; `volumes:` merge by container path. When in
doubt:

```bash
docker compose -f 05-final.yaml -f compose.override.yaml config
```

**Profiles** switch optional services on and off:

```yaml
services:
  adminer:
    image: adminer
    profiles: ["debug"]
```

```bash
docker compose up -d                      # no adminer
docker compose --profile debug up -d      # with adminer
```

---

## 8. The commands you will actually use

```bash
docker compose up -d                  # create and start, detached
docker compose up -d --build          # rebuild images first
docker compose up                     # foreground -- best for watching startup order
docker compose ps                     # what is running, and health status
docker compose logs -f api            # follow one service
docker compose logs --tail=50         # last 50 lines, all services
docker compose exec api sh            # shell into a running service
docker compose run --rm api npm test  # one-off container, then delete it
docker compose restart api
docker compose stop                   # stop, keep containers
docker compose down                   # remove containers + networks, KEEP volumes
docker compose down -v                # ...and DELETE volumes
docker compose config                 # print the fully resolved file
docker compose top                    # processes in each service
```

Three worth calling out:

- **`docker compose config`** — your first move when something is not what you
  expected. It shows what Compose resolved, which is often not what you meant.
- **`docker compose up`** *without* `-d` — the only way to watch the startup
  ordering happen live. Use it when debugging `depends_on`.
- **`docker compose down -v`** — read it twice before pressing enter.

---

## 9. Where Compose stops

Compose is a single-machine tool. It will not:

- **restart a failed container on another machine** — there is no other machine
- **do rolling updates** — `up` recreates changed services with downtime
- **autoscale** — `--scale` is a number you type
- **spread load across hosts** — one machine, one Docker daemon
- **manage secrets properly** — `secrets:` in Compose is mostly a Swarm feature

`restart: unless-stopped` gets you container-level resilience on one host, and
for a dev environment or a small internal service that is genuinely enough.
**Do not reach for Kubernetes because a blog post said so.** Reach for it when
you actually need more than one machine, zero-downtime deploys, or autoscaling.

When you do, everything from this week transfers: a Pod is containers sharing a
network namespace, a Service is DNS-based discovery, a PersistentVolume is a
volume, liveness and readiness probes are the two endpoints you built today.

---

## Checklist

- [ ] What does Compose create automatically that you had to create by hand yesterday?
- [ ] Why is plain `depends_on` not enough, and what fixes it?
- [ ] Why does the API's healthcheck call `/health` and not `/ready`?
- [ ] What is the difference between `down` and `down -v`?
- [ ] Why can a scaled service not have `container_name:` or a fixed host port?
- [ ] Why does nginx need `resolver 127.0.0.11` to load-balance a scaled service?
- [ ] Name three things Compose cannot do.

→ [Lab](lab/) · [Capstone](capstone.md) · [Assessment](../ASSESSMENT.md)
