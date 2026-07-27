# Assessment

| Part | What | Points |
|---|---|---|
| **1** | [Quiz](#part-1--quiz-40-points) — 30 questions | 40 |
| **2** | [Capstone](day5-compose-capstone/capstone.md) — build the system, in pairs | 100 → scaled to 30 |
| **3** | [Debug exam](#part-3--debug-exam-30-points) — find six defects in 30 minutes | 30 |

**Pass mark: 70/100.**

The quiz is closed book. The capstone and debug exam are open book — that is
deliberate. Nobody memorises flags in real work; the skill being tested is
whether you can reason about a system and find your own answers.

---

## Part 1 — Quiz (40 points)

30 questions. Multiple choice is 1 point; questions marked **(why)** are worth
2 and need a sentence or two. Closed book, 40 minutes.

Answers with explanations: [below](#answer-key).

---

### Foundations

**1.** A container is best described as:

- a) A lightweight virtual machine with its own kernel
- b) A process on the host, isolated by namespaces and limited by cgroups
- c) A compressed archive of an application
- d) A hypervisor feature

**2.** You run a Linux container on Windows. Whose kernel executes it?

- a) The Windows kernel
- b) A kernel inside the container image
- c) The WSL2 Linux kernel
- d) The container's own kernel, emulated

**3.** `docker run ubuntu` exits immediately. Why?

- a) The image is broken
- b) Ubuntu images cannot be run directly
- c) A container lives exactly as long as its main process, and bash with no terminal has nothing to do
- d) It needs `-d`

**4. (why)** Two containers each listen on port 80 without conflicting, but two
programs on your laptop cannot. Explain.

**5.** Exit code **137** most often means:

- a) The application returned an error
- b) The image was not found
- c) The process was SIGKILLed — usually the OOM killer or a `docker stop` timeout
- d) A network failure

---

### Images & Dockerfiles

**6.** Which ordering rebuilds fastest after a one-line source change?

- a) `COPY . .` then `RUN npm install`
- b) `COPY package.json ./` then `RUN npm install` then `COPY server.js ./`
- c) They are the same
- d) It depends on the base image

**7. (why)** A Dockerfile copies a `.env` in at step 3 and `RUN rm .env` at
step 7. Is the secret in the shipped image? Explain.

**8.** `EXPOSE 3000` in a Dockerfile:

- a) Publishes port 3000 to the host
- b) Is metadata only — it publishes nothing
- c) Makes the port reachable from other containers
- d) Is required for `-p` to work

**9.** `CMD node server.js` (shell form) versus `CMD ["node","server.js"]`
(exec form). What breaks with shell form?

- a) The app cannot read environment variables
- b) PID 1 is `sh`, which does not forward SIGTERM, so `docker stop` takes the full 10-second grace period
- c) The image is larger
- d) Nothing — they are equivalent

**10.** In a multi-stage build, what reaches the final image?

- a) Everything from every stage
- b) Only what the last stage's `FROM` provides plus what you explicitly `COPY --from`
- c) Only the last stage's `RUN` commands
- d) Everything except the build cache

**11.** Which is *not* a reason to write a `.dockerignore`?

- a) Faster builds
- b) Keeping secrets out of image layers
- c) Preventing `node_modules` from being shipped
- d) Reducing the number of layers in the image

**12. (why)** Why is `FROM node:latest` a problem, even though it always works?

---

### Volumes & data

**13.** You mount an **empty named volume** over a directory that contains
files in the image. What does the container see?

- a) An empty directory
- b) The image's files — they are copied into the volume
- c) An error
- d) Only files created after startup

**14.** You **bind-mount** a host directory over that same image directory.
What does the container see?

- a) Both sets of files merged
- b) The image's files
- c) The host directory's contents; the image's files are hidden
- d) An error

**15.** You bind-mount your source over `/app` and the container dies with
`Cannot find module 'express'`. The fix is:

- a) Run `npm install` on the host
- b) Add an anonymous volume: `-v /app/node_modules`
- c) Rebuild without cache
- d) Use a named volume for `/app`

**16.** `docker run -v /path/that/does/not/exist:/x alpine` does what?

- a) Errors
- b) Silently creates the host directory and mounts it empty
- c) Mounts a tmpfs
- d) Creates a named volume

**17. (why)** You meant `-v pgdata:/var/lib/postgresql/data` and typed `pgdta`.
Describe exactly what happens, what the symptom is, and where your data is.

**18.** A fresh named volume mounted into a container running as `USER node`
gives `Permission denied`. The **best** fix is:

- a) `user: root` in the compose file
- b) `chmod 777` the volume
- c) Pre-create the directory with the right owner in the Dockerfile, so the empty volume inherits it when seeded
- d) Use a bind mount instead

**19.** `docker compose down` versus `docker compose down -v`:

- a) No difference
- b) `-v` is more verbose output
- c) `-v` also deletes named volumes
- d) `-v` also removes images

**20. (why)** Name two ways containers exchange data, and give one trade-off
for each.

---

### Networking

**21.** Two containers on the **default** `bridge` network. `ping other-name`
fails, `ping <IP>` works. Why?

- a) They are on different networks
- b) The default bridge has no DNS-based name resolution
- c) ICMP is blocked by name
- d) The container is not running

**22.** What is `127.0.0.11`?

- a) The container's loopback
- b) Docker's embedded DNS server, on user-defined networks
- c) The bridge gateway
- d) The host's address as seen from the container

**23.** `docker ps` shows `0.0.0.0:8083->8000/tcp` and `curl localhost:8083`
fails, but `docker exec c wget http://127.0.0.1:8000` works inside. The cause
is:

- a) The port mapping is wrong
- b) The app is bound to `127.0.0.1` inside the container, so nothing listens on its `eth0`
- c) A firewall
- d) The container is unhealthy

**24.** In `-p 8080:3000`, which is the container port?

- a) 8080  b) 3000  c) Both  d) Neither

**25. (why)** A colleague says "put the database on a separate network, then it
is secure." What is right about that, and what is missing?

**26.** `host.docker.internal` does not resolve on your setup. Why, and what do
you use instead?

- a) A DNS bug; restart Docker
- b) It is injected by Docker Desktop, which we do not run; use `--add-host=host.docker.internal:host-gateway`
- c) It only works in Compose
- d) You must edit `/etc/hosts`

**27. (why)** List the four hops between your Windows browser and a Postgres
container, and name one way each can fail.

---

### Compose

**28.** Plain `depends_on: [postgres]` guarantees:

- a) Postgres is accepting connections
- b) Only that the Postgres container has started
- c) Postgres has finished its healthcheck
- d) Postgres has finished migrations

**29. (why)** The API image's `HEALTHCHECK` calls `/health`, not `/ready`, even
though `/ready` is a more thorough test. Why is that the right choice?

**30. (why)** You run `--scale api=3`. Docker's DNS returns three addresses,
but nginx sends every request to one replica. What is wrong and where is the
fix?

---

## Part 2 — Capstone (30 points)

See [capstone.md](day5-compose-capstone/capstone.md) for requirements, the
acceptance test, and the 100-point rubric. Your capstone score is scaled to 30.

---

## Part 3 — Debug exam (30 points)

**30 minutes. Individual. Open book.**

[`day5-compose-capstone/debug-exam/`](day5-compose-capstone/debug-exam/)
contains a Compose stack with **six defects**.

```bash
cd ~/projects/docker-training/day5-compose-capstone/debug-exam
docker compose up -d --build
docker compose ps
```

**Hand in**, for each defect: what it was, the symptom, and your fix.

**Marking:** 3 points for correctly identifying each, 2 for correctly fixing
it. 30 total.

Two warnings:

1. **Do not rewrite the file from scratch.** One defect produces no runtime
   symptom whatsoever — a rewrite passes every test and still misses it.
   (**−5** for a rewrite.)
2. **Two defects stop the stack working at all.** Fix those first; the others
   are not testable until you do.

Suggested approach:

```bash
docker compose ps                     # what is not running?
docker compose logs <service>         # why not?
docker compose exec <service> ss -tln # what is it actually listening on?
docker compose config                 # what did Compose actually resolve?
```

Then read the file for what testing cannot find.

---

# Answer key

**Instructors: do not hand this out before marking.**

---

**1. b)** A process, isolated by namespaces and limited by cgroups. There is no
"container" object in the kernel — only a process the kernel has been told to
lie to.

**2. c)** The WSL2 Linux kernel. Containers share the host kernel, which is why
Windows needs WSL2 to run Linux containers at all — and why there are two
"hosts" in your setup.

**3. c)** A container lives exactly as long as its main process. Nothing is
broken.

**4. (why)** Each container has its own **network namespace**, and therefore
its own port space. There is no shared resource to conflict over. Your laptop's
programs all share one namespace, so port 80 is genuinely one thing.

**5. c)** SIGKILL — 128 + 9. Usually the OOM killer (check
`docker inspect --format '{{.State.OOMKilled}}'`) or `docker stop` escalating
after the 10-second grace period.

---

**6. b)** Manifest first. Docker invalidates every layer after the first
change; source changes constantly, dependencies rarely. Measured: **3.82 s →
0.72 s** on a three-dependency project.

**7. (why)** **Yes, it is still there.** Layers are immutable. The `rm` created
a new layer recording a deletion; the earlier layer still contains the file and
ships with the image. `docker history --no-trunc` finds it, and anyone can
unpack the layer. The only fix is to never let it into a layer — hence
`.dockerignore` and build secrets.

**8. b)** Metadata only. It documents the port and hints to `docker run -P`.
Verified: nginx with `EXPOSE 80` and no `-p` is unreachable from the host and
reachable from a container on the same network.

**9. b)** Shell form runs `/bin/sh -c "..."`, so PID 1 is `sh`. It does not
forward SIGTERM, so your process never hears the stop and Docker SIGKILLs after
10 seconds. Measured: **10.16 s → 0.23 s**.

**10. b)** Each `FROM` starts a fresh image. Only explicit `COPY --from`
crosses over. That is both the size win and the security win — a shipped
compiler is a shipped tool for an attacker.

**11. d)** `.dockerignore` does not affect layer count. It controls the build
**context** — what is sent to the daemon.

**12. (why)** `latest` is just a default tag name, not "the newest version". It
is a moving pointer, so the same Dockerfile built two months apart produces two
different programs. Builds should be reproducible; "it broke and nothing
changed" usually means the base image changed.

---

**13. b)** **Seeded.** Docker copies the image's files — and their ownership —
into the empty volume on first use. After that the volume is the source of
truth.

**14. c)** **Shadowed.** Bind mounts never seed. The image's files are hidden,
not deleted; remove the mount and they are back.

**15. b)** An anonymous volume at `/app/node_modules`. It is empty, so it *is*
seeded from the image, and being mounted deeper it takes precedence over the
bind mount above it.

**16. b)** Silently creates it. `--mount type=bind` errors instead:
`invalid mount config for type "bind": bind source path does not exist`. That
is the argument for `--mount`.

**17. (why)** Docker creates a **brand-new empty volume named `pgdta`** — no
error, no warning — and Postgres starts with an empty data directory. The
symptom is identical to total data loss. **The data is not lost**: it is
untouched in `pgdata`. `docker volume ls` shows both. This is the most common
"my data disappeared", and it is a typo.

**18. c)** Pre-create the directory with the right owner in the Dockerfile. The
empty volume is seeded from the image and inherits the ownership — no manual
step, works on a clean machine. (a) trades a real security property for one
`chown`; (b) is worse security for the same reason; (d) changes the storage
type to dodge a permissions question.

**19. c)** `-v` deletes named volumes. Read it twice before pressing enter.

**20. (why)** **Network** — request/response, both must be running, fails with
connection refused, and needs DNS/ports/networks to line up. **Shared volume** —
producer and consumer can run at different times, fails as "the file is not
there yet", and gives you **no locking**, so concurrent writers corrupt data.

---

**21. b)** The default bridge has no DNS. They are connected — only the naming
is missing. Use a user-defined network.

**22. b)** Docker's embedded DNS server, injected into containers on
user-defined networks. It resolves container names, aliases and Compose service
names.

**23. b)** `127.0.0.1` inside the container is the *container's* loopback.
Docker forwards to the container's `eth0`, where nothing is listening.
Containerised apps must bind `0.0.0.0`. **The hardest of the failure modes to
spot** — every diagnostic looks healthy.

**24. b)** 3000. `-p HOST:CONTAINER` — left is the host. The right-hand number
must match what the app actually binds.

**25. (why)** **Right:** a container on another network cannot resolve the
service name, so the application cannot accidentally reach the wrong tier, and
that is the boundary you design with. **Missing:** packet-level isolation is
enforced by iptables and varies between Docker versions and distributions — the
chains were renamed in Docker 28, and some Docker distributions bypass host
iptables entirely. It must be combined with **not publishing the port** (`-p`
is what actually exposes a service), `internal: true` where appropriate, and
real credentials. A network boundary is not authentication.

**26. b)** Docker Desktop injects it; we run Docker Engine. Use
`--add-host=host.docker.internal:host-gateway`, or `extra_hosts:` in Compose —
which is arguably better, since the dependency is written down rather than
depending on which Docker product a teammate installed.

**27. (why)**

| Hop | Mechanism | Fails when |
|---|---|---|
| Browser → WSL2 | WSL2 localhost forwarding | After sleep/resume, VPN, or a Windows process holds the port |
| WSL2 → container | Docker DNAT (`-p`) | No `-p`; wrong container port; app bound to `127.0.0.1` |
| nginx → api | Docker embedded DNS | Default bridge, different networks, wrong name |
| api → postgres | Same | Same, plus Postgres not ready yet |

---

**28. b)** Only that the container has started. Postgres takes seconds to
accept connections — longer on a cold init. You need `healthcheck` plus
`condition: service_healthy`. `sleep 10` is a guess, not a fix.

**29. (why)** `/health` is **liveness** (is this process alive?), `/ready` is
**readiness** (can it serve traffic — do its dependencies answer?). A
healthcheck answers *"should I be restarted?"*. If it called `/ready`, a
30-second Postgres restart would mark every API replica unhealthy, and
`restart:` plus anything watching health would restart them all — turning a
database blip into a full outage. Restarting the API does not fix a broken
Postgres, so a broken Postgres must not make the API look unhealthy.

**30. (why)** Not Docker — **nginx**. With `proxy_pass http://api:3000;` nginx
resolves the name **once at startup** and caches it forever. The fix is in
`nginx/default.conf`: name the resolver and use a variable so resolution
happens per request.

```nginx
resolver 127.0.0.11 valid=10s;
set $upstream http://api:3000;
proxy_pass $upstream$request_uri;
```

Measured: **3/3/3** across nine requests with this; **9/0/0** without.

---

## Marking the quiz

| | |
|---|---|
| Multiple choice (24 questions) | 1 point each = 24 |
| **(why)** questions (8 questions) | 2 points each = 16 |
| **Total** | **40** |

For **(why)** answers, award:

- **2** — correct mechanism *and* correct consequence
- **1** — right conclusion, hand-wavy mechanism ("layers keep stuff" for Q7)
- **0** — wrong, or a restatement of the question

**Be generous about wording and strict about mechanism.** "The secret is still
in the image because layers are immutable and deleting only adds a whiteout" is
a 2 even if they call it something else. "Docker keeps a backup" is a 0 even
though the conclusion is right.

---

## Overall scoring

| Part | Raw | Weight |
|---|---|---|
| Quiz | /40 | 40 |
| Capstone | /100 | 30 (× 0.3) |
| Debug exam | /30 | 30 |
| | | **100** |

| Score | Means |
|---|---|
| **85+** | Can be trusted with the Docker setup on a real project |
| **70–84** | Pass. Solid, will need to look things up — which is normal |
| **55–69** | Gaps. Identify which section and redo that day's lab |
| **< 55** | Repeat the week |

**If most of the group loses points in the same section, that is a signal about
the teaching, not the group.** Adjust that day before running the course again.
