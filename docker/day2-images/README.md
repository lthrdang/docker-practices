# Day 2 — Images & Dockerfiles

**Goal:** write a Dockerfile that is fast to rebuild, small to ship, and safe to
run. All three come from understanding one thing: **layers**.

| | |
|---|---|
| **Warm-up** | KodeKloud Playground, 15 min — build and run a 5-line image |
| **Lab** | [lab/](lab/) |
| **Homework** | [homework.md](homework.md) |

---

## 1. An image is a stack of layers

Every instruction in a Dockerfile that changes the filesystem produces one
read-only layer. The image is those layers stacked, plus a small manifest.

```
┌─────────────────────────────┐  ← thin WRITABLE layer (per container)
├─────────────────────────────┤
│ COPY server.js              │  ← read-only, shared by every container
│ RUN npm install             │
│ COPY package.json           │
│ FROM node:22-alpine         │
└─────────────────────────────┘
```

Starting a container adds **one thin writable layer** on top. Reads fall
through the stack until a file is found. Writes copy the file up into the
writable layer first — **copy-on-write**.

Three consequences that explain almost everything:

1. **Ten containers from one image cost almost nothing extra**, because they
   share every read-only layer. Only the writable layers differ.
2. **Deleting a file in a later layer does not shrink the image.** The layer
   below still contains it; the upper layer just records "this is deleted". A
   secret copied in at step 3 and deleted at step 7 is still in the image, and
   anyone can extract it.
3. **Layer order determines rebuild speed.** Which is the next section.

Look at a real stack:

```bash
docker history training-api:ref
```

---

## 2. The build cache — the highest-value thing you will learn today

When Docker builds, it checks each instruction against the cache. If the
instruction and its inputs are unchanged, it reuses the cached layer. **The
moment one layer misses, every layer after it is rebuilt too.**

So put what changes *rarely* first, and what changes *constantly* last.

Your source code changes on every commit. Your dependency list changes maybe
once a month. Therefore:

```dockerfile
# WRONG — source and manifest arrive together
COPY . .
RUN npm install
```

```dockerfile
# RIGHT — manifest alone, install, then source
COPY package.json ./
RUN npm install
COPY server.js ./
```

With the wrong order, changing one character of source invalidates `COPY . .`,
which invalidates `RUN npm install`, and you reinstall every dependency.

**Measured on the lab project** (three dependencies, tiny):

| | Rebuild after a one-line source change |
|---|---|
| `COPY . .` before install | **3.82 s** |
| `COPY package.json` first | **0.72 s** |

Five times faster on a project with *three* dependencies. On a real project
with several hundred, this is the difference between a two-second rebuild and a
three-minute one, dozens of times a day. You will measure it yourself in
Exercise 2.

> Numbers measured on the instructor's machine. Yours will differ; the ratio
> will not.

---

## 3. The instructions

### `FROM` — the base

```dockerfile
FROM node:22-alpine
```

**Always pin a version.** `FROM node` means "whatever `latest` points at
today", so the same Dockerfile built two months apart produces two different
programs. That is not a build, that is a lottery.

Rough sizes for the same app:

| Base | Final image | Trade-off |
|---|---|---|
| `node:22` | **1.63 GB** | Full Debian: every tool present, nothing to debug |
| `node:22-alpine` | **238 MB** | musl libc, not glibc — some native modules misbehave |
| `gcr.io/distroless/nodejs22` | ~150 MB | No shell at all; smallest attack surface, hardest to debug |

*(Both measured on the lab API. See Exercise 3.)*

Alpine is the sensible default. Be aware of the musl caveat: a native module
compiled against glibc can fail in ways that look like your code is broken.
When that happens, `node:22-slim` is the escape hatch.

### `WORKDIR`

```dockerfile
WORKDIR /app
```

Sets the directory for everything after it, and creates it if missing. Use it
instead of `RUN cd /app` — `cd` in a `RUN` does not persist to the next
instruction, because each instruction runs in a fresh layer.

### `COPY` vs `ADD`

Use `COPY`. Always.

`ADD` also auto-extracts tar archives and can download URLs. Both behaviours
are surprising, and the URL feature does not use the build cache well. `COPY`
does exactly one thing.

```dockerfile
COPY package.json ./
COPY --chown=node:node server.js ./
```

`--chown` matters: copied files are owned by root by default, so a process
running as a non-root user cannot write to them. Day 3 explores that in depth.

### `RUN`

Executes at **build** time and its result becomes a layer.

```dockerfile
# Two layers, and the apt cache is left inside the image
RUN apt-get update
RUN apt-get install -y curl

# One layer, and the cache is removed in the same layer that created it
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
```

The cleanup **must** be in the same `RUN`. Delete it in a later instruction and
the files are still in the earlier layer — you added a deletion record, not
free space.

### `ENV` and `ARG`

```dockerfile
ARG NODE_VERSION=22        # build time only, gone at runtime
ENV NODE_ENV=production    # baked into the image, present at runtime
```

**Neither is a secret store.** Both are visible in `docker history` and
`docker inspect` to anyone with the image.

### `EXPOSE`

```dockerfile
EXPOSE 3000
```

**This publishes nothing.** It is metadata: documentation for readers, and a
hint for `docker run -P`. Reaching the port from outside requires `-p` at run
time. Day 4 proves this by running a container with `EXPOSE` and no `-p` and
watching it be unreachable.

### `USER`

```dockerfile
USER node
```

Everything after runs unprivileged. **Containers run as root by default**, and
root in the container is uid 0 on the host kernel. A container escape from a
root process is far more interesting to an attacker than one from uid 1000.

This is one line and it is the highest-value security change you can make.

### `CMD` vs `ENTRYPOINT` — and the "Ctrl+C doesn't work" bug

```dockerfile
CMD ["node", "server.js"]              # exec form   — a JSON array
CMD node server.js                     # shell form  — a bare string
```

They are not equivalent.

**Shell form** wraps the command: `/bin/sh -c "node server.js"`. PID 1 is `sh`,
and Node is its child. `docker stop` sends SIGTERM to PID 1. `sh` does not
forward it. Node never hears it. Docker waits ten seconds and SIGKILLs
everything.

**That is the real reason "Ctrl+C doesn't stop my container" and
`docker compose down` takes forever.** It is not Docker being slow; it is a
shell swallowing your signal.

**Exec form** makes your process PID 1 directly. Signals arrive. Shutdown takes
under a second.

**Always use exec form.**

The difference between the two instructions:

| | Meaning | Overridden by `docker run <image> <args>` |
|---|---|---|
| `CMD` | Default command | **Replaced entirely** |
| `ENTRYPOINT` | Fixed command | Arguments are **appended** to it |

```dockerfile
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
```

`docker run img node --version` runs `tini -- node --version`. The entrypoint
holds; only the CMD is swapped. That is the common, useful pattern.

---

## 4. Multi-stage builds

Build tools are needed to build and useless to run. Multi-stage keeps them out
of the final image.

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js ./

FROM node:22-alpine AS runtime
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/server.js ./
USER node
CMD ["node", "server.js"]
```

The second `FROM` starts a **brand new image**. Only what you explicitly
`COPY --from=build` crosses over. npm, the build cache and any compiler stay
behind.

For Node the win is moderate. For a compiled language it is dramatic: a Go
build image is ~800 MB, the resulting binary is ~10 MB, and the runtime stage
can be `FROM scratch`.

The security benefit is as large as the size benefit: **a shipped compiler is a
shipped tool for an attacker.**

---

## 5. `.dockerignore`

Before a build starts, the CLI packs the build context — the directory you
point at — and sends it to the daemon. `.dockerignore` excludes files from that
package.

```
node_modules
.git
.env
*.md
```

Two reasons, one of which is serious:

**Speed.** Without it, `COPY . .` ships your host `node_modules` — hundreds of
megabytes, on every build, to be immediately overwritten.

**Secrets.** Without it, `COPY . .` bakes your `.env` into a layer.
Permanently. Deleting it in a later instruction does not remove it. Anyone who
pulls the image can extract it.

> `.dockerignore` sits next to the Dockerfile and is easy to forget. Write it
> at the same time as the Dockerfile, every time.

---

## 6. Tags and registries

```bash
docker build -t myapp:1.2.3 .
docker tag myapp:1.2.3 myapp:latest
docker push registry.example.com/team/myapp:1.2.3
```

**`latest` is not "the newest version".** It is just the default tag name — a
label with no automatic meaning. `docker pull myapp` fetches whatever someone
last tagged `latest`, which may be older than `1.2.3`.

For deployments, use immutable tags: a version, or a commit SHA. "Which code is
in production?" should have exactly one answer.

---

## 7. The Windows trap: CRLF

You will hit this on a real project. You may as well hit it here first, on
purpose.

A shell script checked out by Windows Git has `\r\n` line endings, so its
shebang reads `#!/bin/sh\r`. Linux looks for an interpreter literally named
`/bin/sh\r`, does not find it, and reports:

```
exec /app/entrypoint.sh: no such file or directory
```

...about a file that is visibly present. The message is about the *interpreter*,
not the script.

Diagnose:

```bash
file entrypoint.sh          # "with CRLF line terminators"
cat -A entrypoint.sh | head # ^M$ at line ends
```

Fix: `git config --global core.autocrlf input`, a `.gitattributes` with
`* text=auto eol=lf`, and your editor set to LF. Full detail in
[WSL2-NOTES.md](../WSL2-NOTES.md) #2. Exercise 6 makes you break it deliberately.

---

## 8. Checklist for a good Dockerfile

```dockerfile
FROM node:22-alpine AS build        # pinned version, minimal base
WORKDIR /app
COPY package.json ./                # manifest first...
RUN npm install --omit=dev          # ...so this stays cached
COPY server.js ./                   # source last

FROM node:22-alpine AS runtime      # multi-stage: leave the toolchain behind
RUN apk add --no-cache tini         # init: correct signal handling
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/server.js ./
USER node                           # non-root
EXPOSE 3000                         # documentation
HEALTHCHECK CMD ...                 # liveness, not readiness
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]           # exec form
```

Plus a `.dockerignore` next to it. Always.

The full annotated version is [`labs/app-api/Dockerfile`](../labs/app-api/Dockerfile).

---

## Checklist

- [ ] Why does instruction order change rebuild speed?
- [ ] Why does deleting a file in a later layer not shrink the image?
- [ ] What does `EXPOSE` actually do?
- [ ] Why does shell-form `CMD` break `docker stop`?
- [ ] What does the second `FROM` in a multi-stage build discard?
- [ ] Why is a missing `.dockerignore` a security problem, not just a slow one?

→ [Lab](lab/) · [Homework](homework.md)
