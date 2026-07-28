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

