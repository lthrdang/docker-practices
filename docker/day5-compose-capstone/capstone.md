# Capstone — Build the whole thing

**Time:** 2.5 hours · **In pairs** · **Counts for most of your assessment**

Build a complete, production-shaped multi-container system from scratch. You
have all the pieces; this is putting them together without step-by-step
instructions.

---

## Ground rules

1. **Start from an empty directory.** Do not copy `05-final.yaml`. You may look
   at anything from the week — that is what reference material is for — but
   type your own file.
2. **Pairs, one keyboard, swap every 30 minutes.** The person not typing reads
   the docs and asks "why". Both of you must be able to explain every line.
3. **Commit as you go** if you use git. Working increments beat one big leap.
4. **When something breaks, use the four-cause table** from Day 4 before
   changing anything at random.

---

## What to build

```
Windows browser
      │  :8080
   nginx ─────────► api ────────► postgres     (users)
                     │  └───────► redis        (cache + job queue)
                     │                              │
                     │                            worker
                     │                              │
                     └────── shared volume ─────────┘
```

Application source — `server.js`/`package.json` for the API,
`worker.py`/`requirements.txt` for the worker — is in
[`labs/app-api/`](../labs/app-api/) and [`labs/app-worker/`](../labs/app-worker/).
**You are not writing application code. You are writing the Dockerfile(s) and
the compose file.**

**Copy the source files into your own `api/` and `worker/` directories — not
the `Dockerfile`s that are already sitting next to them.** Those are the
finished reference from Day 2, shown so you'd know what one looks like once
built; pointing `build:` straight at `labs/app-api/` reuses that finished
Dockerfile and skips the R1–R4 work entirely. Write your own from a blank
file, the same way you did for the Day 2 homework.

### Deliverables

```
capstone/
├── compose.yaml
├── compose.override.yaml     # dev conveniences
├── .env.example              # committed
├── .env                      # NOT committed
├── .gitignore
├── api/
│   ├── Dockerfile            # yours, written from scratch
│   ├── server.js             # copied from labs/app-api/
│   └── package.json
├── worker/
│   ├── Dockerfile            # yours, written from scratch
│   ├── worker.py             # copied from labs/app-worker/
│   └── requirements.txt
├── nginx/default.conf
└── README.md                 # one command to run it
```

---

## Requirements

Each maps to a rubric line. Tick them off as you go.

### Images

- [ ] **R1.** The API image is **multi-stage** and under **300 MB**
- [ ] **R2.** It runs as a **non-root** user — `curl .../whoami` must report a non-zero uid
- [ ] **R3.** It has a `.dockerignore`, and **no secret appears in `docker history --no-trunc`**
- [ ] **R4.** `CMD`/`ENTRYPOINT` use **exec form** — `docker stop` returns in under 2 seconds

### Storage

- [ ] **R5.** Postgres data is in a **named volume** and survives `docker compose down` + `up`
- [ ] **R6.** The worker's output reaches the API — **one shared volume, mounted into both**
- [ ] **R7.** In dev, API source is **bind-mounted** with hot reload, and `node_modules` is shielded
- [ ] **R8.** Your README states, for each of the three kinds of data (**DB files, worker output, source code**), which mount type you chose and **why**

### Networking

- [ ] **R9.** **Two networks.** `nginx` on the frontend only; `api` on both; `postgres`, `redis`, `worker` on the backend only
- [ ] **R10.** **Exactly one published port in the base compose file** (nginx). Postgres is not published *there* — publishing it in the **override**, bound to `127.0.0.1`, is fine and expected
- [ ] **R11.** `docker compose exec nginx nslookup postgres` **fails**; from `api` it **succeeds**
- [ ] **R12.** Reachable from the **Windows browser**, not only from WSL2

### Orchestration

- [ ] **R13.** Postgres and Redis have **healthchecks** that test the real thing
- [ ] **R14.** The API waits for `condition: service_healthy` on both
- [ ] **R15.** The API's own healthcheck tests **liveness**, not readiness — and your README says why
- [ ] **R16.** `restart:` policies are set deliberately

### Secrets & hygiene

- [ ] **R17.** The DB password comes from `.env`; `.env` is in **both** `.gitignore` and `.dockerignore`; `.env.example` is committed
- [ ] **R18.** `docker compose config` runs clean
- [ ] **R19.** The README's single command works on a machine that has never run it: `docker compose up -d`

---

## Acceptance test

Run this verbatim. Everything must pass.

```bash
cd capstone
cp .env.example .env
docker compose down -v 2>/dev/null

# R19: one command, from nothing
docker compose up -d --build
sleep 25

# R13/R14: everything healthy
docker compose ps

# R12: through nginx
curl -s localhost:8080/ready
# expect: {"ready":true,"checks":{"postgres":"ok","redis":"ok"}}

# R2: non-root
curl -s localhost:8080/whoami
# expect: "uid": non-zero

# R5: data survives a redeploy
curl -s -X POST -H 'content-type: application/json' -d '{"name":"alice"}' localhost:8080/users
docker compose down          # NO -v
docker compose up -d
sleep 25
curl -s localhost:8080/users
# expect: alice is still there

# R6: worker output reaches the API over the shared volume
curl -s -X POST -H 'content-type: application/json' -d '{"message":"capstone"}' localhost:8080/jobs
sleep 3
curl -s localhost:8080/files
# expect: count >= 1

# R10: exactly one published port IN THE BASE FILE.
#
# Note `-f compose.yaml`. A bare `docker compose` auto-merges your override,
# which deliberately publishes extra dev ports -- so `docker compose ps` is the
# wrong thing to check R10 against. The requirement is about what ships.
docker compose -f compose.yaml config | grep published
# expect: exactly one line -- published: "8080"

# R11: isolation
docker compose exec nginx nslookup postgres     # expect: NXDOMAIN
docker compose exec api   nslookup postgres     # expect: an address

# R1: image size
docker images --format '{{.Repository}}:{{.Tag}}\t{{.Size}}' | grep capstone

# R4: fast shutdown
time docker compose down
# expect: seconds, not tens of seconds

# R3: no secrets in the image
docker history --no-trunc <your-api-image> | grep -i -E 'password|secret' || echo "clean"
```

Then open **<http://localhost:8080/health> in your Windows browser** (R12).

---

## Suggested order

Do not try to write the whole file at once. Build up the way the lab did — get
each step working before adding the next.

| | Step | Roughly |
|---|---|---|
| 1 | API only, published, `/health` answers | 20 min |
| 2 | Add Postgres + named volume; prove data survives | 25 min |
| 3 | Add healthchecks + `service_healthy` | 20 min |
| 4 | Add Redis and the worker + shared volume | 25 min |
| 5 | Add nginx; split into two networks; unpublish the API | 30 min |
| 6 | `.env`, `.gitignore`, `.dockerignore`, override file | 20 min |
| 7 | Run the acceptance test; write the README | 20 min |

**If you fall behind, stop adding and make what you have pass its checks.** A
four-service stack that passes fifteen requirements scores better than a
five-service stack that half-works.

---

## Hints for the parts people get stuck on

<details>
<summary>The API container keeps dying with "Cannot find module 'express'"</summary>

Day 3, Rule 2. Your bind mount is hiding the image's `/app`, including
`node_modules`. You need the anonymous-volume shield — and it belongs in the
**override** file, not the base file, because production does not bind-mount
source.
</details>

<details>
<summary>The API cannot reach Postgres, but the name looks right</summary>

Work the four-cause table:

```bash
docker compose exec api nslookup postgres   # cause 1 or 2?
docker compose exec postgres ss -tln        # cause 3?
docker compose logs postgres                # cause 5 -- still starting?
```
</details>

<details>
<summary>nginx returns 502</summary>

nginx resolved, connected, and got nothing back. So nginx is fine — look at the
API. Is it healthy? Is it on the frontend network? Is it listening on the port
nginx is proxying to?
</details>

<details>
<summary>The worker says "permission denied" writing to /data</summary>

Day 3, section 6. A fresh named volume mounts root-owned. Look at what
[`labs/app-worker/Dockerfile`](../labs/app-worker/Dockerfile) does about it —
and note that adding `user: root` would "fix" it while failing R2.
</details>

<details>
<summary>It works in WSL2 but not the Windows browser</summary>

[WSL2-NOTES.md](../WSL2-NOTES.md) #8. Work the hops: `docker ps` PORTS column →
`curl` in WSL → `wsl.exe hostname -I` and browse that IP → `wsl --shutdown`.
</details>

---

## Grading rubric

**100 points.** 70 is a pass; 85+ is what we would ship.

| Area | Points | Awarded for |
|---|---|---|
| **Images** (R1–R4) | 20 | Multi-stage 6 · non-root 6 · dockerignore + no secrets 4 · exec form 4 |
| **Storage** (R5–R8) | 25 | DB persistence 8 · shared volume works 7 · dev bind mount + shield 5 · written justification 5 |
| **Networking** (R9–R12) | 25 | Two networks correct 8 · one published port 6 · isolation verified 6 · reachable from Windows 5 |
| **Orchestration** (R13–R16) | 15 | Real healthchecks 6 · `service_healthy` 5 · liveness/readiness explained 4 |
| **Hygiene** (R17–R19) | 15 | Secrets handled 6 · `config` clean 4 · one-command README 5 |

**Deductions**

| | |
|---|---|
| `user: root` used to make a permission error go away | **−10** |
| A secret committed, or baked into an image layer | **−10** |
| Postgres published in the base compose file | **−8** |
| `container_name:` on a service that should be scalable | **−3** |
| `:latest` on any image | **−3** |

**Bonus (up to +5)**

- `internal: true` on the backend network, with the trade-off explained
- Resource limits set deliberately
- A `profiles:`-gated debug service
- `--scale api=3` works **and** load-balances (check your nginx `resolver`)

---

## Demo

Ten minutes per pair at the end.

1. Run the acceptance test live
2. Walk through your compose file — **the other person in the pair explains it**
3. Answer three questions from the assessors

Likely questions:

- Why is the API on two networks and nginx on one?
- What happens to your data on `docker compose down -v`, and when would you run it?
- Your API healthcheck calls `/health`. Why not `/ready`?
- Which of your mounts is a bind mount and why is that one not a named volume?
- Show me that Postgres is not reachable from nginx. Now show me *why*.

**"My partner wrote that part" is not an answer.** Both of you own the whole
file — that is why you swapped every 30 minutes.

---

## Reference solution

A reference solution exists — ask your instructor for it **after** your demo,
not before. Your version does not have to match it. If you pass the acceptance
test and can defend your choices, you are right, and possibly better.
