# Day 3 Lab — Mounts

**Time:** ~2 hours · **Work in:** `~/projects/docker-training`

Exercises 2, 3 and 5 are the ones that matter most. If you are running short of
time, do those and come back to the rest.

---

## Exercise 1 — Data that survives, and data that does not (15 min)

### Without a volume

```bash
docker run -d --name pg-novol \
  -e POSTGRES_USER=app -e POSTGRES_PASSWORD=app -e POSTGRES_DB=app \
  postgres:17-alpine
sleep 5
docker exec pg-novol psql -U app -d app -c "CREATE TABLE t (id int); INSERT INTO t VALUES (42);"
docker exec pg-novol psql -U app -d app -c "SELECT * FROM t;"
```

You have data. Now destroy the container the way a deployment would:

```bash
docker rm -f pg-novol
docker run -d --name pg-novol \
  -e POSTGRES_USER=app -e POSTGRES_PASSWORD=app -e POSTGRES_DB=app \
  postgres:17-alpine
sleep 5
docker exec pg-novol psql -U app -d app -c "SELECT * FROM t;"
```

```
ERROR:  relation "t" does not exist
```

```bash
docker rm -f pg-novol
```

### With a named volume

```bash
docker volume create pgdata
docker run -d --name pg -v pgdata:/var/lib/postgresql/data \
  -e POSTGRES_USER=app -e POSTGRES_PASSWORD=app -e POSTGRES_DB=app \
  postgres:17-alpine
sleep 5
docker exec pg psql -U app -d app -c "CREATE TABLE t (id int); INSERT INTO t VALUES (42);"
docker rm -f pg
docker run -d --name pg -v pgdata:/var/lib/postgresql/data \
  -e POSTGRES_USER=app -e POSTGRES_PASSWORD=app -e POSTGRES_DB=app \
  postgres:17-alpine
sleep 5
docker exec pg psql -U app -d app -c "SELECT * FROM t;"
```

`42` is still there.

### Now look at it

```bash
docker volume inspect pgdata --format '{{.Mountpoint}}'
sudo ls -la /var/lib/docker/volumes/pgdata/_data | head
```

**It is just a directory.** Do this once and volumes stop being magic.

```bash
docker rm -f pg
```
Keep the volume — Exercise 8 uses it.

---

## Exercise 2 — Seeding vs shadowing (20 min)

**The most important exercise today.** You are deriving the two rules from
section 4 by experiment.

```bash
mkdir -p ~/projects/mountlab && cd ~/projects/mountlab
cat > Dockerfile <<'EOF'
FROM alpine
RUN mkdir -p /content \
    && echo "FROM THE IMAGE" > /content/image-file.txt \
    && echo "second" > /content/other.txt
CMD ["ls", "-1", "/content"]
EOF
docker build -t mountlab .
```

### Baseline — no mount

```bash
docker run --rm mountlab
```
```
image-file.txt
other.txt
```

### Case A — an EMPTY named volume

```bash
docker volume rm -f seedvol 2>/dev/null; docker volume create seedvol
docker run --rm -v seedvol:/content mountlab
```

**Predict before you press enter.** Then look:

```
image-file.txt
other.txt
```

The files are there. Are they in the volume, or is the image showing through?
Check with a container that has nothing to do with the image:

```bash
docker run --rm -v seedvol:/v alpine ls -1 /v
```

They are genuinely **in the volume**. It was **seeded**.

### Case B — a BIND MOUNT of an empty directory

```bash
mkdir -p ~/projects/mountlab/emptydir
docker run --rm -v ~/projects/mountlab/emptydir:/content mountlab
```

**Nothing.** The image's files are **hidden**.

### Case C — a NON-EMPTY named volume

```bash
docker volume rm -f prefilled 2>/dev/null; docker volume create prefilled
docker run --rm -v prefilled:/v alpine sh -c 'echo PREEXISTING > /v/mine.txt'
docker run --rm -v prefilled:/content mountlab
```
```
mine.txt
```

Only the volume's file. The image's are **hidden**.

### Write the rules down

Fill this in **in your own words** — you will be asked for it on Day 5:

| Mount over a non-empty image directory | What happens |
|---|---|
| Empty named volume | |
| Non-empty named volume | |
| Bind mount | |

**Question:** in Case B, were the image's files deleted? Prove your answer.

<details>
<summary>Hint if you are stuck</summary>

Run the image again with no mount at all.
</details>

---

## Exercise 3 — Break `node_modules`, then fix it (25 min)

The real-world consequence of Rule 2. Every Node developer meets this; you get
to meet it deliberately.

```bash
cd ~/projects/docker-training/labs/app-api
docker build -t api:ref .
```

Confirm it works normally:

```bash
docker run -d --name api -p 8080:3000 api:ref
sleep 3
curl localhost:8080/health
docker rm -f api
```

### Break it

Bind-mount your source over `/app`, the way a hot-reload setup would:

```bash
docker run -d --name api -p 8080:3000 -v "$PWD":/app api:ref
sleep 3
docker logs api
```

```
Error: Cannot find module 'express'
```

```bash
docker ps -a --filter name=api      # Exited
```

**Explain it before reading on.** Which rule applies? What happened to the
`node_modules` that `npm install` created during the build?

<details>
<summary>Answer</summary>

Rule 2. The bind mount hid the image's entire `/app`, including
`node_modules`. Your host directory has no `node_modules` — it is in
`.gitignore` and `.dockerignore`. Bind mounts never seed, so nothing was
copied in. Node then cannot find `express`.

</details>

### Fix it

```bash
docker rm -f api
docker run -d --name api -p 8080:3000 \
  -v "$PWD":/app \
  -v /app/node_modules \
  api:ref
sleep 4
docker logs api
docker exec api ls /app
curl localhost:8080/health
```

Working, and `/app` now shows your source **and** `node_modules`.

**Explain the fix:**

1. `-v /app/node_modules` has no source. What kind of volume is that?
2. It is empty, so which rule applies to it?
3. Why does the deeper mount win over the `/app` mount above it?

```bash
docker volume ls -qf dangling=true | head
```

Note the anonymous volume it created. Exercise 7 comes back to those.

```bash
docker rm -f api
```

---

## Exercise 4 — `-v` fails silently, `--mount` fails loudly (15 min)

### Missing host path

```bash
cd ~/projects/mountlab
docker run --rm -v ~/projects/mountlab/nope1:/x alpine ls -la /x
ls -ld ~/projects/mountlab/nope1
```

Ran fine — and Docker **created the directory for you**.

```bash
docker run --rm --mount type=bind,src=$HOME/projects/mountlab/nope2,dst=/x alpine ls /x
```

```
docker: Error response from daemon: invalid mount config for type "bind":
  bind source path does not exist: /home/you/projects/mountlab/nope2
```

```bash
ls -ld ~/projects/mountlab/nope2      # does not exist
```

### The typo that eats an afternoon

```bash
docker volume ls -q | wc -l
docker run --rm -v seedvoll:/x alpine ls /x | wc -l
docker volume ls -q | grep seedvol
```

You typed `seedvoll`. Docker silently created a **new, empty** volume.

Imagine that is your database:

```bash
docker run -d --name pg-typo -v pgdta:/var/lib/postgresql/data \
  -e POSTGRES_USER=app -e POSTGRES_PASSWORD=app -e POSTGRES_DB=app \
  postgres:17-alpine
sleep 5
docker exec pg-typo psql -U app -d app -c "SELECT * FROM t;"
```

```
ERROR:  relation "t" does not exist
```

Your data is **not** lost — it is safe in `pgdata`. But nothing told you, and
the symptom is identical to data loss.

```bash
docker volume ls | grep pg
docker rm -f pg-typo
docker volume rm pgdta seedvoll
```

**Write down:** which flag would have caught this, and what would it have said?

---

## Exercise 5 — Permissions (25 min)

The collision between Day 2's `USER node` and today's volumes.

### Reproduce it

```bash
docker volume rm -f permvol 2>/dev/null; docker volume create permvol
docker run --rm --user 1000:1000 -v permvol:/data alpine \
  sh -c 'id; ls -ldn /data; touch /data/x && echo WROTE OK || echo WRITE FAILED'
```

```
uid=1000 gid=1000 groups=1000
drwxr-xr-x 1 0 0 0 /data
touch: /data/x: Permission denied
WRITE FAILED
```

**A fresh named volume mounts as a root-owned directory.** Note `1 0 0` — owner
uid 0, group 0.

Same thing with the real API image:

```bash
docker volume rm -f apidata 2>/dev/null
docker run --rm -v apidata:/data api:ref \
  sh -c 'id; ls -ldn /data; touch /data/x && echo WROTE OK || echo WRITE FAILED'
```

Also fails. The API image runs as `node` (uid 1000) and never pre-creates
`/data`.

### Fix A — chown from a root container

```bash
docker run --rm --user 0:0 -v permvol:/data alpine chown 1000:1000 /data
docker run --rm --user 1000:1000 -v permvol:/data alpine \
  sh -c 'ls -ldn /data; touch /data/x && echo WROTE OK || echo WRITE FAILED'
```

Works. But it is a manual step, and the next person to clone the repo will not
know to run it.

### Fix B — pre-create the directory in the image (the good one)

Look at the worker's Dockerfile:

```bash
grep -A3 'adduser' ~/projects/docker-training/labs/app-worker/Dockerfile
```

```dockerfile
RUN adduser -D -u 1000 worker \
    && mkdir -p /data \
    && chown worker:worker /data
USER worker
```

Test it:

```bash
cd ~/projects/docker-training/labs/app-worker
docker build -t worker:ref .
docker run --rm worker:ref sh -c 'ls -ldn /data'
docker volume rm -f seedown 2>/dev/null
docker run --rm -v seedown:/data worker:ref \
  sh -c 'ls -ldn /data; touch /data/x && echo WROTE OK || echo WRITE FAILED'
```

```
drwxr-xr-x 1 1000 1000 0 /data
WROTE OK
```

**Why does this work?** Rule 1 — the empty volume is seeded from the image's
`/data`, and **the ownership is copied along with the contents**. No manual
step, no root container, works on a clean machine.

**Write down:** why does the worker succeed where the API fails, when both run
as uid 1000?

### Fix C — `--user` at run time (bind mounts, development only)

```bash
cd ~/projects/mountlab
mkdir -p hostdir
docker run --rm -v "$PWD/hostdir":/data alpine touch /data/from-root
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD/hostdir":/data alpine touch /data/from-me
ls -ln hostdir
```

Compare the owner UIDs. **On WSL2**, files created by a root container are
owned by root **on your host filesystem** — which is why you sometimes cannot
delete a directory your container created without `sudo`.

> **`[NEEDS WSL2 DRY-RUN]`** — this exercise was authored on macOS, where bind
> mounts pass through a translation layer that remaps ownership and hides the
> effect. On WSL2's native Docker Engine the ownership is real and the
> difference will show. Instructor: confirm the observed UIDs before class.

```bash
sudo rm -rf hostdir
```

---

## Exercise 6 — Measure `/mnt/c` vs `~` (15 min)

You have been told to keep code in `~`. Prove it.

```bash
mkdir -p /mnt/c/temp/perftest ~/perftest
```

Write 2000 small files in each, from a container:

```bash
echo "=== /mnt/c (Windows drive) ==="
time docker run --rm -v /mnt/c/temp/perftest:/t alpine \
  sh -c 'for i in $(seq 1 2000); do echo x > /t/f$i; done'

echo "=== ~ (Linux filesystem) ==="
time docker run --rm -v ~/perftest:/t alpine \
  sh -c 'for i in $(seq 1 2000); do echo x > /t/f$i; done'
```

| | Time |
|---|---|
| `/mnt/c` | |
| `~` | |
| Ratio | |

Now the part that actually costs you time — does the file watcher fire?

```bash
docker run -d --name w1 -v /mnt/c/temp/perftest:/t alpine \
  sh -c 'apk add -q inotify-tools; inotifywait -m /t'
docker run -d --name w2 -v ~/perftest:/t alpine \
  sh -c 'apk add -q inotify-tools; inotifywait -m /t'
sleep 8
echo hello > /mnt/c/temp/perftest/trigger.txt
echo hello > ~/perftest/trigger.txt
sleep 2
echo "--- watcher on /mnt/c ---"; docker logs w1 | tail -3
echo "--- watcher on ~ ---";      docker logs w2 | tail -3
docker rm -f w1 w2
```

**The `~` watcher reports the change. The `/mnt/c` one very likely does not.**
That is why hot reload "randomly stops working" for people who keep code on the
Windows drive — the event never arrives.

```bash
rm -rf ~/perftest /mnt/c/temp/perftest
```

> **`[NEEDS WSL2 DRY-RUN]`** — record real numbers on team hardware before
> class.

---

## Exercise 7 — Anonymous volumes and cleanup (10 min)

```bash
docker volume ls -q | wc -l
docker image inspect postgres:17-alpine --format '{{.Config.Volumes}}'
```

```
map[/var/lib/postgresql/data:{}]
```

The image **declares** a volume. So:

```bash
for i in 1 2 3; do
  docker run -d --name anon$i -e POSTGRES_PASSWORD=x postgres:17-alpine >/dev/null
done
sleep 3
docker rm -f anon1 anon2 anon3
docker volume ls -qf dangling=true | wc -l
```

Three containers, no `-v`, three anonymous volumes left behind — each holding a
database, each named with 64 hex characters.

```bash
docker volume ls -qf dangling=true | head -3
```

Clean up **carefully**:

```bash
docker volume ls
docker volume prune
```

> `docker volume prune` deletes every unattached volume, including the database
> of a project you merely stopped. `docker volume ls` first, every time.

---

## Exercise 8 — Backup and restore (15 min)

```bash
docker run -d --name pg -v pgdata:/var/lib/postgresql/data \
  -e POSTGRES_USER=app -e POSTGRES_PASSWORD=app -e POSTGRES_DB=app \
  postgres:17-alpine
sleep 5
docker exec pg psql -U app -d app -c "SELECT * FROM t;"   # 42 from Exercise 1
```

Stop the writer before archiving — a tar of a live database is a snapshot
mid-write:

```bash
docker stop pg
cd ~/projects/mountlab
docker run --rm -v pgdata:/data:ro -v "$PWD":/backup alpine \
  tar czf /backup/pgdata-backup.tar.gz -C /data .
ls -lh pgdata-backup.tar.gz
```

Restore into a **fresh** volume:

```bash
docker volume create pgdata-restored
docker run --rm -v pgdata-restored:/data -v "$PWD":/backup alpine \
  tar xzf /backup/pgdata-backup.tar.gz -C /data
docker run -d --name pg-restored -v pgdata-restored:/var/lib/postgresql/data \
  -e POSTGRES_USER=app -e POSTGRES_PASSWORD=app -e POSTGRES_DB=app \
  postgres:17-alpine
sleep 5
docker exec pg-restored psql -U app -d app -c "SELECT * FROM t;"
```

`42`. Same data, different volume, different container.

**Question:** the backup container mounted the volume `:ro`. Why is that the
right choice, and what would `docker cp` not have given you here?

```bash
docker rm -f pg pg-restored
docker volume rm pgdata-restored
rm -f pgdata-backup.tar.gz
```

---

## Exercise 9 — Where the disk went (10 min)

```bash
docker system df
docker system df -v | head -30
```

Read the `RECLAIMABLE` column.

```bash
docker builder prune -f
docker system df
```

Now the WSL2 half. In **PowerShell**:

```powershell
(Get-ChildItem -Path HKCU:\Software\Microsoft\Windows\CurrentVersion\Lxss |
  Where-Object { $_.GetValue("DistributionName") -eq 'Ubuntu' }).GetValue("BasePath") + "\ext4.vhdx"
```

Open that file's Properties in Explorer and compare **Size** with **Size on
disk**. Docker just freed gigabytes and the VHDX did not shrink.

Fix per [WSL2-NOTES.md](../../WSL2-NOTES.md) #4:

```powershell
wsl --shutdown
wsl --manage Ubuntu --set-sparse true
```

> **`[NEEDS WSL2 DRY-RUN]`** — confirm `--set-sparse` exists in the team's WSL
> version and record the fallback.

---

## Exercise 10 — Two containers, one volume (15 min)

Inter-container communication with no network at all.

```bash
cd ~/projects/docker-training/labs
docker network create day3-net
docker volume create shared-data

docker run -d --name redis --network day3-net --network-alias redis redis:7-alpine
docker run -d --name worker --network day3-net -v shared-data:/data worker:ref
docker run -d --name api --network day3-net --network-alias api \
  -p 8080:3000 -v shared-data:/data api:ref
sleep 5
```

Queue a job through the API, which pushes it to Redis:

```bash
curl -s -X POST -H 'content-type: application/json' \
  -d '{"message":"hello from day 3"}' localhost:8080/jobs
sleep 2
docker logs worker | tail -2
```

The worker consumed it and wrote a file. Now read it back through the API:

```bash
curl -s localhost:8080/files
curl -s localhost:8080/files/<the filename from above>
```

**Trace what just happened:**

1. Your curl → API. Which mechanism?
2. API → worker. Which mechanism?
3. Worker → API (the result file). Which mechanism?

Step 3 involved **no network call between the two containers at all.**

Prove the volume is what connects them:

```bash
docker rm -f worker
docker run --rm -v shared-data:/data alpine ls -1 /data
```

The files outlived the container that wrote them.

```bash
docker rm -f api redis
docker network rm day3-net
docker volume rm shared-data
```

---

## Clean up

```bash
docker rm -f $(docker ps -aq) 2>/dev/null
docker volume ls
docker volume rm pgdata seedvol prefilled permvol apidata seedown 2>/dev/null
rm -rf ~/projects/mountlab
docker system df
```

---

## Done when you can

- [ ] State both mount rules from memory and give an example of each
- [ ] Explain the `node_modules` failure and fix it without looking it up
- [ ] Say what `-v` does that `--mount` will not, and why that is dangerous
- [ ] Explain why a non-root container cannot write to a fresh volume, and give the best fix
- [ ] Quote your own `/mnt/c` vs `~` numbers
- [ ] Name two ways containers exchange data, with a trade-off for each

→ [Homework](../homework.md)
