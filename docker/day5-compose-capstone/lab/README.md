# Day 5 Lab — Compose

**Time:** ~2 hours · **Work in:** `~/projects/docker-training/labs/compose`

You are walking through five compose files that build up the same system you
constructed by hand yesterday. Each one is a diff against the previous — read
them in order, comments included.

```bash
cd ~/projects/docker-training/labs/compose
ls
cp .env.example .env
```

---

## Exercise 1 — One service (10 min)

```bash
cat 01-single.yaml
docker compose -f 01-single.yaml up -d --build
curl -s localhost:8080/health
```

Now look at what Compose created without being asked:

```bash
docker network ls | grep compose
docker compose -f 01-single.yaml ps
docker compose -f 01-single.yaml ps --format '{{.Name}}'
```

```
compose_default
compose-api-1
```

A network and a container name, both derived from the directory name.

Now ask for readiness:

```bash
curl -s localhost:8080/ready
```

```json
{"ready":false,"checks":{
  "postgres":"getaddrinfo ENOTFOUND postgres",
  "redis":"redis timed out after 3000ms"}}
```

**Read that error.** `ENOTFOUND postgres` is Day 4's cause #1 — the name does
not resolve because nothing by that name exists on this network. The app is
alive but not ready, and it can tell you which dependency is missing.

```bash
docker compose -f 01-single.yaml down
```

**Question:** you wrote no `--network`, no `--name`, no `--network-alias`. Which
Day 4 mechanism did Compose set up for you?

---

## Exercise 2 — Add the database, prove the data survives (15 min)

```bash
diff 01-single.yaml 02-db.yaml
docker compose -f 02-db.yaml up -d
sleep 12
```

```bash
curl -s -X POST -H 'content-type: application/json' -d '{"name":"alice"}' localhost:8080/users
curl -s localhost:8080/users
```

Now redeploy the way a release would — replacing containers, not just stopping
them:

```bash
docker compose -f 02-db.yaml down
docker compose -f 02-db.yaml up -d
sleep 12
curl -s localhost:8080/users
```

Alice is still there. Where did she live?

```bash
docker volume ls | grep compose
docker volume inspect compose_pgdata --format '{{.Mountpoint}}'
```

Now the destructive version:

```bash
docker compose -f 02-db.yaml down -v
docker volume ls | grep compose        # gone
docker compose -f 02-db.yaml up -d
sleep 12
curl -s localhost:8080/users           # []
docker compose -f 02-db.yaml down -v
```

**Write down:** the exact difference between `down` and `down -v`, and one
sentence on when you would deliberately use each.

**Question:** `PGHOST: postgres` in the compose file. Nothing anywhere defines
a host called `postgres`. Who resolves it, and what is the address of the
server that answers?

---

## Exercise 3 — Watch the startup-order bug, then fix it (25 min)

**The most valuable exercise today.**

### See the ordering work

```bash
docker compose -f 03-healthcheck.yaml down -v
docker compose -f 03-healthcheck.yaml up
```

Foreground on purpose — watch the sequence:

```
Container compose-postgres-1  Starting
Container compose-postgres-1  Started
Container compose-postgres-1  Waiting        ← Compose is polling the healthcheck
Container compose-postgres-1  Healthy
Container compose-api-1       Starting       ← only now
```

`Ctrl+C`, then:

```bash
docker compose -f 03-healthcheck.yaml down -v
```

### Now break it

Copy the file and weaken the dependency:

```bash
cp 03-healthcheck.yaml 03-broken.yaml
```

Edit `03-broken.yaml` — replace

```yaml
    depends_on:
      postgres:
        condition: service_healthy
```

with

```yaml
    depends_on:
      - postgres
```

and delete the whole `healthcheck:` block from the postgres service.

```bash
docker compose -f 03-broken.yaml down -v
docker compose -f 03-broken.yaml up
```

Watch the API start immediately — Postgres has not finished initialising.

```bash
# in a second terminal
curl -s localhost:8080/ready
```

The first few seconds report Postgres unreachable.

> **You may not see a hard failure.** A fast machine with a warm image cache
> can initialise Postgres quickly enough that the API's first query succeeds.
> **That is exactly what makes this bug dangerous** — it passes on your machine
> and fails in CI, or on a cold start, or on a colleague's laptop. The absence
> of a symptom is not the absence of the bug.
>
> To make it obvious, force a slow start: `docker compose -f 03-broken.yaml
> down -v` first, so Postgres has to create the database from scratch.

```bash
docker compose -f 03-broken.yaml down -v
rm 03-broken.yaml
```

**Questions:**

1. Why is `sleep 10` in the API's entrypoint not an acceptable fix?
2. `pg_isready` is the healthcheck test. Why is `CMD ["true"]` a bad one, even
   though it would "pass"?
3. The API image's own `HEALTHCHECK` calls `/health`, not `/ready`. What would
   break if it called `/ready`?

---

## Exercise 4 — Two networks, declared (20 min)

```bash
diff 03-healthcheck.yaml 04-networks.yaml
docker compose -f 04-networks.yaml up -d
sleep 16
docker compose -f 04-networks.yaml ps
```

Verify it works through the proxy:

```bash
curl -s localhost:8080/health
curl -s localhost:8080/ready
```

Now verify the isolation. **Predict each result first.**

```bash
docker compose -f 04-networks.yaml exec nginx nslookup postgres
docker compose -f 04-networks.yaml exec api   nslookup postgres
```

```
** server can't find postgres: NXDOMAIN        ← from nginx
Name: postgres  Address: 192.168.x.x           ← from api
```

```bash
docker network inspect compose_frontend --format '{{range .Containers}}{{.Name}} {{end}}'
docker network inspect compose_backend  --format '{{range .Containers}}{{.Name}} {{end}}'
```

`compose-api-1` appears in both. That is what makes it the bridge between
tiers.

Confirm Postgres is not reachable from your host at all:

```bash
docker compose -f 04-networks.yaml ps --format '{{.Service}}\t{{.Ports}}'
curl -s --max-time 3 localhost:5432 || echo "unreachable from host (correct)"
```

### Try `internal: true`

Uncomment `internal: true` under `backend:` at the bottom of the file, then:

```bash
docker compose -f 04-networks.yaml down
docker compose -f 04-networks.yaml up -d
sleep 16
docker compose -f 04-networks.yaml exec postgres ping -c1 -W2 1.1.1.1 || echo "no internet (correct)"
docker compose -f 04-networks.yaml exec api ping -c1 -W2 1.1.1.1
```

The API can still reach the internet — it is also on `frontend`. Postgres
cannot.

Undo the change (comment it back out) and:

```bash
docker compose -f 04-networks.yaml down -v
```

**Question:** compare this file with the ten commands you typed yesterday. What
did you gain besides fewer keystrokes? Name at least two things.

---

## Exercise 5 — The full system (20 min)

```bash
cat .env
docker compose -f 05-final.yaml up -d --build
sleep 20
docker compose -f 05-final.yaml ps
```

Five services, three healthy, one published port.

Exercise every path through the system:

```bash
curl -s localhost:8080/ready
curl -s -X POST -H 'content-type: application/json' -d '{"name":"alice"}' localhost:8080/users
curl -s localhost:8080/cache-demo
curl -s -X POST -H 'content-type: application/json' -d '{"message":"day5"}' localhost:8080/jobs
sleep 3
docker compose -f 05-final.yaml logs worker | tail -2
curl -s localhost:8080/files
```

Expected:

```json
{"ready":true,"checks":{"postgres":"ok","redis":"ok"}}
{"id":1,"name":"alice",...}
{"hits":1,"servedBy":"..."}
{"queued":"day5"}
worker-1 | processed job -> /data/job-2026...txt (total 1)
{"dir":"/data","count":1,"files":["job-2026...txt"]}
```

**Trace what happened in that last pair of calls.** The job went API → Redis →
worker over the **network**; the result came worker → API over a **shared
volume**. Two containers, two different mechanisms, in one request flow.

Check the secret handling:

```bash
docker compose -f 05-final.yaml config | grep -A3 POSTGRES_PASSWORD
cat .gitignore
```

The password is in `.env`, which is gitignored; `.env.example` is committed and
documents the variable without its value.

---

## Exercise 6 — Scale it, and find the bug that hides here (20 min)

```bash
docker compose -f 05-final.yaml up -d --scale api=3
sleep 18
docker compose -f 05-final.yaml ps | grep api
```

Which replica answers?

```bash
for i in $(seq 9); do
  curl -s localhost:8080/whoami | python3 -c 'import sys,json;print(json.load(sys.stdin)["hostname"])'
done | sort | uniq -c
```

Expected — an even spread:

```
   3 35834507f020
   3 a28bafb4a393
   3 d677b466bc2d
```

Where does that come from?

```bash
docker compose -f 05-final.yaml exec nginx nslookup api
```

Three addresses for one name.

### Now break the load balancing

```bash
cp ../nginx/default.conf ../nginx/default.conf.bak
```

Edit `../nginx/default.conf` — replace

```nginx
        set $upstream http://api:3000;
        proxy_pass $upstream$request_uri;
```

with the "obvious" version:

```nginx
        proxy_pass http://api:3000;
```

and delete the `resolver` line. Then:

```bash
docker compose -f 05-final.yaml restart nginx
sleep 5
for i in $(seq 9); do
  curl -s localhost:8080/whoami | python3 -c 'import sys,json;print(json.load(sys.stdin)["hostname"])'
done | sort | uniq -c
```

**All nine hit the same replica.** Docker's DNS is still returning three
addresses — nginx resolved the name once at startup, cached it, and never
looked again.

Restore it:

```bash
mv ../nginx/default.conf.bak ../nginx/default.conf
docker compose -f 05-final.yaml restart nginx
```

**This is a real production bug.** You scale to three replicas, your dashboard
shows three healthy containers, and one of them is doing all the work.

**Questions:**

1. Why does a variable in `proxy_pass` change when resolution happens?
2. Why must a scaled service not have `container_name:` set?
3. Why must it not have a fixed host port in `ports:`?

---

## Exercise 7 — Development overrides (15 min)

```bash
cat compose.override.yaml
docker compose -f 05-final.yaml -f compose.override.yaml config | head -40
```

`config` prints the merged result. Compare it with the base file — that is the
merge rules made visible.

```bash
docker compose -f 05-final.yaml down -v
docker compose -f 05-final.yaml -f compose.override.yaml up -d
sleep 20
docker compose -f 05-final.yaml -f compose.override.yaml ps --format '{{.Service}}\t{{.Ports}}'
```

```
api        0.0.0.0:3000->3000/tcp
nginx      0.0.0.0:8080->80/tcp
postgres   127.0.0.1:5432->5432/tcp
redis      6379/tcp
```

Three things to notice:

```bash
curl -s localhost:3000/health          # api published directly, dev convenience
```

Postgres is on **`127.0.0.1:5432`**, not `0.0.0.0` — reachable from this
machine only, not from anything else on the network. You could attach a GUI
client from Windows. `"5432:5432"` would have exposed your database to the
whole LAN.

And the Day 3 shield is doing its job:

```bash
docker compose -f 05-final.yaml -f compose.override.yaml exec api ls /app
docker compose -f 05-final.yaml -f compose.override.yaml exec api sh -c 'ls /app/node_modules | wc -l'
```

```
Dockerfile  node_modules  package.json  server.js
86
```

Your source is bind-mounted over `/app`, **and** `node_modules` survived —
because of the one line `- /app/node_modules`.

### Prove the shield is what saves you

Comment out `- /app/node_modules` in `compose.override.yaml`, then:

```bash
docker compose -f 05-final.yaml -f compose.override.yaml up -d --force-recreate api
sleep 5
docker compose -f 05-final.yaml -f compose.override.yaml logs api | tail -5
```

```
Error: Cannot find module 'express'
```

Day 3, Exercise 3, met again in its natural habitat. Uncomment the line and
recreate.

### Hot reload

The override sets `command: ["node", "--watch", "server.js"]`. Test it:

```bash
# in a second terminal
docker compose -f 05-final.yaml -f compose.override.yaml logs -f api
```

Then edit `../app-api/server.js` — change the string in the `/health` response —
save, and watch the process restart. Then:

```bash
curl -s localhost:3000/health
```

**If nothing happens, your code is on `/mnt/c`.** The file event never reached
Linux. [WSL2-NOTES.md](../../WSL2-NOTES.md) #1.

Undo your edit.

---

## Exercise 8 — Reading a system you did not write (15 min)

A skill you will need more often than writing one from scratch.

```bash
docker compose -f 05-final.yaml down -v
docker compose -f 05-final.yaml up -d
sleep 20
```

Answer these using **only** `docker compose` commands — do not open the YAML:

1. How many services, and which are healthy?
2. Which host ports are published, and by which service?
3. Which networks exist, and which services are on more than one?
4. Which volumes exist, and which services mount them?
5. What is `POSTGRES_PASSWORD` resolved to?
6. Which service would you restart to pick up a change to `nginx/default.conf`?

<details>
<summary>The commands</summary>

```bash
docker compose -f 05-final.yaml ps
docker compose -f 05-final.yaml config --services
docker compose -f 05-final.yaml config | grep -E 'networks:|volumes:|ports:' -A3
docker network ls | grep compose
docker volume ls | grep compose
docker compose -f 05-final.yaml config | grep POSTGRES_PASSWORD
docker compose -f 05-final.yaml top
```

</details>

```bash
docker compose -f 05-final.yaml down -v
```

---

## Clean up

```bash
docker compose -f 05-final.yaml down -v 2>/dev/null
docker ps -a
docker system df
```

---

## Done when you can

- [ ] Explain what Compose creates automatically, and which Day 4 mechanism that is
- [ ] Explain why plain `depends_on` is not enough, and demonstrate the fix
- [ ] State the difference between `down` and `down -v` without hesitating
- [ ] Reproduce the scaled-nginx load-balancing bug and explain the cause
- [ ] Explain what `- /app/node_modules` in an override file is for
- [ ] Answer all six questions in Exercise 8 without opening the YAML

→ [Capstone](../capstone.md)
