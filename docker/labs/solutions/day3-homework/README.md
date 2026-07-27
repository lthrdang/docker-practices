# Day 3 Homework — Reference Solution

**Read this only after you have your own answer.**

To try it:

```bash
cd ~/projects/docker-training/day3-volumes/homework-project
cp compose.yaml compose.broken.bak                       # keep the original
cp ../../labs/solutions/day3-homework/compose.yaml .
docker compose down -v && docker compose up -d --build
```

> The paths in this file are relative to the **homework-project** directory —
> copy it there rather than running it from `solutions/`.

---

## The four problems

### 1. The API bind mount hides `node_modules`

```yaml
volumes:
  - ./../../labs/app-api:/app     # nothing shielding /app/node_modules
```

**Rule broken:** a bind mount always obscures pre-existing image content, and
**never seeds**.

**Symptom:** the API never starts.

```
Error: Cannot find module 'express'
code: 'MODULE_NOT_FOUND'
```

**Fix:** add an anonymous volume one level deeper. It is empty, so Rule 1 seeds
it from the image, restoring exactly what `npm install` produced at build time.

```yaml
volumes:
  - ../../labs/app-api:/app
  - /app/node_modules
```

This is the single most common Docker problem in Node projects. Recognise it by
`MODULE_NOT_FOUND` in a container that built successfully.

---

### 2. The worker has no mount at all, and the API mounts a different volume

```yaml
api:
  volumes:
    - apidata:/data      # the API reads here
worker:
  # ...no volumes at all. The worker writes to /data anyway.
```

**Rule broken:** two containers share a directory only if they mount **the same
volume**. Without a mount, a write goes into the container's own writable layer.

**Symptom:** the worker's log says it wrote a file, but `GET /files` returns
`{"count":0}` — and the file disappears when the worker container is recreated.

**Fix:** one volume, mounted into both.

```yaml
api:
  volumes:
    - shared-data:/data
worker:
  volumes:
    - shared-data:/data
volumes:
  shared-data:
```

This one is instructive because **nothing errors.** The worker reports success.
Only the consumer notices, and only if you check.

---

### 3. Postgres has no volume

```yaml
postgres:
  image: postgres:17-alpine
  # no volumes:
```

**Rule broken:** anything that must outlive the container needs a mount.

**Symptom:** `alice` is gone after `docker compose down && docker compose up`.

**The subtlety worth understanding:** the Postgres image *declares*
`VOLUME /var/lib/postgresql/data`, so Docker did create a volume — an
**anonymous** one, on every `up`. `down` removed the container and orphaned it;
the next `up` created another empty one.

So the data was never deleted. It is sitting in an orphaned volume named with
64 hex characters, unreachable in practice.

```bash
docker volume ls -qf dangling=true
```

**Fix:** name it.

```yaml
postgres:
  volumes:
    - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

**Note the difference between the two teardown commands.** `docker compose
down` keeps named volumes; `docker compose down -v` deletes them. Both are
correct in different situations, and confusing them is how people lose real
data.

---

### 4. `user: root`

```yaml
api:
  user: root      # "added to fix permission denied"
```

**Not a storage rule — a Day 2 one.** The permission error was real: a fresh
named volume mounts root-owned, and the API image runs as `node` (uid 1000).
`user: root` makes the error go away by giving the whole application root.

**Symptom:** `curl localhost:8080/whoami` returns `"uid": 0`.

**Fix:** delete the line, and make the volume writable by the user that
actually runs the app. The best version is what the worker's Dockerfile does —
pre-create the directory with the right owner, so Rule 1 copies that ownership
into the volume when it seeds:

```dockerfile
RUN adduser -D -u 1000 worker \
    && mkdir -p /data \
    && chown worker:worker /data
USER worker
```

In this stack the API only **reads** `/data`, so removing `user: root` is
sufficient — a root-owned `755` directory is readable by anyone. If the API
needed to write there, it would need the Dockerfile fix too.

> The general point: **when a permission error appears, ask which user should
> own the data.** Escalating the process to root answers a different question.

---

## The question that was the actual point

> For each of the three kinds of data — database files, worker output, source
> code — which mount type, and why?

| Data | Mount | Why |
|---|---|---|
| Postgres data | **Named volume** | Must survive container replacement. Docker-managed means no host paths in the compose file, so it works identically on every machine. A bind mount would hand the DB's storage layout to whatever filesystem the host has — and on WSL2, to a translation layer. |
| Worker output | **Named volume**, mounted into both | Must be shared between two containers and outlive both. Named because it is application-owned data, not something a human edits. |
| Source code | **Bind mount** (dev only) | The entire point is that a human edits it on the host and the container sees it immediately. Only in development — a production image contains its code, it does not mount it. |
| Redis | **No volume** — on purpose | A cache and an in-transit queue. Losing it on restart is acceptable. Written down as a decision, not left as an oversight. |

That last row matters as much as the others. "No volume" is a legitimate answer
when you can say why.

---

## Verified acceptance run

```
POST /users              -> {"id":1,"name":"alice",...}
docker compose down          (no -v)
docker compose up -d
GET  /users              -> [{"id":1,"name":"alice",...}]     ← survived
GET  /whoami             -> {"uid":1000,...}                  ← not root
POST /jobs ; GET /files  -> {"count":1,"files":["job-...txt"]} ← shared volume works
```

---

## Checking your own answer

You do not need to match this file. You are right if:

- [ ] All four services reach `running`
- [ ] `/health` answers
- [ ] A row written before `docker compose down` is still there after `up`
- [ ] `/whoami` reports a non-zero uid
- [ ] A job posted to `/jobs` shows up in `/files`
- [ ] You can justify each mount type in one sentence

If you fixed problem 2 by giving the worker `apidata:/data` instead of renaming
to `shared-data`, that is equally correct — the name does not matter, sharing
one volume does.
