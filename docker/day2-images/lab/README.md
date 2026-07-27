# Day 2 Lab — Building images

**Time:** ~2 hours · **Work in:** `~/projects/docker-training/labs/app-api`

Several exercises ask you to record a number. Record it — Exercise 2 and
Exercise 3 are compared as a group at the end.

---

## Exercise 1 — Write a Dockerfile from nothing (20 min)

Do **not** look at [`labs/app-api/Dockerfile`](../../labs/app-api/Dockerfile)
yet. Write your own.

```bash
cd ~/projects/docker-training/labs/app-api
ls
```

You have `package.json` and `server.js`. It is a Node app started with
`node server.js` on port 3000.

Create `Dockerfile.mine`:

```dockerfile
FROM node:22
WORKDIR /app
COPY . .
RUN npm install
CMD node server.js
```

Yes, this has several problems. That is the point — we will fix them one at a
time and measure each fix.

```bash
docker build -f Dockerfile.mine -t api:v1 .
docker run -d --name api -p 8080:3000 api:v1
curl localhost:8080/health
```

Expected:

```json
{"status":"ok","host":"<container id>"}
```

Also try, from your **Windows browser**: <http://localhost:8080/health>

If the browser cannot reach it but `curl` in WSL can, that is
[WSL2-NOTES.md](../../WSL2-NOTES.md) #8 — work through it now while it is
isolated, rather than during Day 4.

Record the size:

```bash
docker images api:v1 --format '{{.Size}}'
```

**Write down: v1 size = ______**

```bash
docker rm -f api
```

---

## Exercise 2 — Measure the cost of bad layer ordering (25 min)

**The most important exercise of the day.**

Your `Dockerfile.mine` has `COPY . .` before `RUN npm install`. Let us find out
what that costs.

### Baseline

```bash
docker build -f Dockerfile.mine -t api:v1 .
```

Now change one character of source:

```bash
echo "// touch $(date)" >> server.js
```

Rebuild and time it:

```bash
time docker build -f Dockerfile.mine -t api:v1 .
```

**Write down: bad ordering = ______ seconds**

Watch the output as it runs. Notice `RUN npm install` executing again, even
though no dependency changed.

### Now fix the ordering

Create `Dockerfile.v2`:

```dockerfile
FROM node:22
WORKDIR /app
COPY package.json ./
RUN npm install
COPY server.js ./
CMD node server.js
```

```bash
docker build -f Dockerfile.v2 -t api:v2 .
echo "// touch $(date)" >> server.js
time docker build -f Dockerfile.v2 -t api:v2 .
```

**Write down: good ordering = ______ seconds**

Watch for `CACHED` next to `RUN npm install`.

### Compare

| | Rebuild after a one-line source change |
|---|---|
| `COPY . .` first | ______ s |
| `COPY package.json` first | ______ s |
| Instructor's measurement | 3.82 s → 0.72 s |

**Questions:**

1. This project has **three** dependencies. A real project has three hundred.
   What happens to the gap?
2. You rebuild maybe fifty times a day. What is that per week?
3. `RUN npm install` was not cached the first time even though you had built
   before. Why not?

> **Takeaway:** cheap to change, expensive to change — put the expensive things
> earlier. This one rule is most of Dockerfile optimisation.

---

## Exercise 3 — Shrink the image (25 min)

`api:v1` is built on `node:22`, a full Debian. Let us see what that costs.

### Step 1: a smaller base

`Dockerfile.v3`:

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js ./
CMD ["node", "server.js"]
```

```bash
docker build -f Dockerfile.v3 -t api:v3 .
docker images 'api' --format '{{.Tag}}\t{{.Size}}'
```

### Step 2: multi-stage

`Dockerfile.v4`:

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js ./

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/server.js ./
USER node
EXPOSE 3000
CMD ["node", "server.js"]
```

```bash
docker build -f Dockerfile.v4 -t api:v4 .
docker images 'api' --format '{{.Tag}}\t{{.Size}}'
```

Fill in:

| Tag | Base | Size | vs v1 |
|---|---|---|---|
| v1 | node:22 | | — |
| v3 | node:22-alpine | | |
| v4 | multi-stage alpine | | |

Instructor's measurement: **1.63 GB → 238 MB**, an 85% reduction.

### Step 3: verify it still works, and that it is now unprivileged

```bash
docker run -d --name api -p 8080:3000 api:v4
curl localhost:8080/whoami
```

Look at the `uid` field. It should be **1000**, not 0.

Compare against the unfixed one:

```bash
docker rm -f api
docker run -d --name api -p 8080:3000 api:v1
curl localhost:8080/whoami
```

`uid: 0` — that container was running as **root**. It was the whole time.

```bash
docker rm -f api
```

**Questions:**

1. Where did the ~1.4 GB go? What was in `node:22` that `node:22-alpine` lacks?
2. `docker history api:v1` — which single layer is largest?
3. Multi-stage saved less than switching to alpine did. Why? What kind of
   project would show the opposite?

---

## Exercise 4 — Look inside the layers (15 min)

```bash
docker history api:v1
docker history api:v4
```

Read the `SIZE` column and match instructions to layers.

Now watch the "deleting does not shrink" rule:

```bash
mkdir -p ~/projects/layerdemo && cd ~/projects/layerdemo
cat > Dockerfile <<'EOF'
FROM alpine
RUN dd if=/dev/urandom of=/big.bin bs=1M count=50
RUN rm /big.bin
EOF
docker build -t layerdemo .
docker images layerdemo --format '{{.Size}}'
docker history layerdemo
```

The file is deleted. The image is still ~50 MB larger than alpine.

**Why?** The `rm` created a *new* layer recording a deletion. The layer below
still contains all 50 MB, and it ships with the image.

Now do it correctly:

```bash
cat > Dockerfile <<'EOF'
FROM alpine
RUN dd if=/dev/urandom of=/big.bin bs=1M count=50 && rm /big.bin
EOF
docker build -t layerdemo:fixed .
docker images layerdemo --format '{{.Tag}}\t{{.Size}}'
```

Same commands, one layer, ~50 MB smaller.

> **Security version of this rule:** a secret copied in and deleted later is
> still in the image. `docker history` will show it and anyone can unpack the
> layer. **Never put a secret in a layer, not even temporarily.**

```bash
cd ~/projects/docker-training/labs/app-api
```

---

## Exercise 5 — exec form vs shell form (15 min)

`Dockerfile.shell`:

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js ./
CMD node server.js
```

Note: shell form, no JSON array.

```bash
docker build -f Dockerfile.shell -t api:shell .
docker run -d --name shellapi api:shell
docker exec shellapi ps
```

Look at what is PID 1.

Now time a stop:

```bash
time docker stop shellapi
```

**Write down: ______ seconds**

Compare with the exec-form image:

```bash
docker run -d --name execapi api:v4
docker exec execapi ps
time docker stop execapi
```

**Write down: ______ seconds**

You should see roughly **10 seconds vs under 1 second**.

**What happened:** in the shell-form container PID 1 is `/bin/sh`, with Node as
its child. `docker stop` SIGTERMs PID 1; `sh` does not forward it; Node never
hears it; Docker waits out the 10-second grace period and SIGKILLs.

Confirm the killing was not graceful:

```bash
docker inspect shellapi --format 'ExitCode={{.State.ExitCode}}'
```

`137` — SIGKILL, the same code you met on Day 1.

> Multiply ten seconds by five services. Every `docker compose down` on a real
> project. **Use exec form.**

```bash
docker rm -f shellapi execapi
```

---

## Exercise 6 — Break it with CRLF, on purpose (15 min)

You will meet this on a real project. Meet it here first.

```bash
cd ~/projects/docker-training/labs/app-api
cat > entrypoint.sh <<'EOF'
#!/bin/sh
echo "entrypoint starting"
exec "$@"
EOF
chmod +x entrypoint.sh
```

`Dockerfile.entry`:

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js entrypoint.sh ./
RUN chmod +x entrypoint.sh
ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "server.js"]
```

Confirm it works:

```bash
docker build -f Dockerfile.entry -t api:entry .
docker run --rm --name entrytest api:entry node --version
```

Now break it — convert to Windows line endings:

```bash
sed -i 's/$/\r/' entrypoint.sh
file entrypoint.sh          # "with CRLF line terminators"
docker build -f Dockerfile.entry -t api:entry .
docker run --rm api:entry node --version
```

**Record the exact error message. Write it down.**

```bash
cat -A entrypoint.sh | head -2
```

`^M$` at the end of each line — that is the `\r`.

Fix it:

```bash
sed -i 's/\r$//' entrypoint.sh
file entrypoint.sh
docker build -f Dockerfile.entry -t api:entry .
docker run --rm api:entry node --version
```

**Questions:**

1. The error names a file that clearly exists. What is actually missing?
2. Which Git setting causes this on Windows, and what does
   `.gitattributes` do about it?
3. You cloned a repo on Windows and every `.sh` in it is CRLF. What do you do?

---

## Exercise 7 — `.dockerignore` (10 min)

```bash
cd ~/projects/docker-training/labs/app-api
mv .dockerignore .dockerignore.off
npm install 2>/dev/null || true   # create a local node_modules to be shipped
echo "SECRET_KEY=hunter2" > .env
docker build -f Dockerfile.mine -t api:noignore . 2>&1 | head -5
```

Watch the first line: `transferring context: ... MB`. Note the number.

Now check whether your secret went into the image:

```bash
docker run --rm api:noignore cat /app/.env
```

**Your secret is in the image.** Anyone who pulls it can read it.

Restore and rebuild:

```bash
mv .dockerignore.off .dockerignore
docker build -f Dockerfile.mine -t api:ignore . 2>&1 | head -5
docker run --rm api:ignore cat /app/.env
```

Context size is far smaller and the `.env` is not there.

```bash
rm -f .env
```

> **Remember:** deleting `.env` from the image in a later `RUN` would **not**
> have helped — Exercise 4's rule. It must never enter a layer at all.

---

## Exercise 8 — Compare with the reference (15 min)

Now open [`labs/app-api/Dockerfile`](../../labs/app-api/Dockerfile) and read
it, comments included.

```bash
docker build -t api:ref .
docker images 'api' --format '{{.Tag}}\t{{.Size}}'
```

It has three things your `v4` does not:

1. `tini` as an init — why, given the exec form already fixes signals?
   (Hint: what reaps a child process that your app spawns and abandons?)
2. A `HEALTHCHECK` calling `/health` and **not** `/ready` — why does that
   distinction matter?
3. `--chown=node:node` on every `COPY` — what breaks without it?

Check the healthcheck working:

```bash
docker run -d --name api -p 8080:3000 api:ref
docker ps                       # STATUS shows "health: starting"
sleep 15
docker ps                       # STATUS shows "(healthy)"
docker inspect api --format '{{json .State.Health}}'
```

Day 5 uses exactly this to make Compose start services in the right order.

```bash
docker rm -f api
```

---

## Clean up

```bash
docker rm -f $(docker ps -aq) 2>/dev/null
docker rmi api:v1 api:v2 api:v3 api:shell api:noignore api:ignore api:entry layerdemo layerdemo:fixed 2>/dev/null
rm -f Dockerfile.mine Dockerfile.v2 Dockerfile.v3 Dockerfile.shell Dockerfile.entry entrypoint.sh
docker system df
```

Keep `api:v4` and `api:ref` — Day 3 uses them.

---

## Done when you can

- [ ] State your own measured before/after numbers for cache ordering and image size
- [ ] Explain why deleting a file in a later layer does not shrink an image
- [ ] Recognise the CRLF error message on sight
- [ ] Explain why shell-form `CMD` makes `docker stop` take ten seconds
- [ ] Say what `.dockerignore` protects besides build speed

→ [Homework](../homework.md)
