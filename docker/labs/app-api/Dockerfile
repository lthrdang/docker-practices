# Reference Dockerfile for the training API.
#
# This is the finished version -- multi-stage, small, non-root, with a
# healthcheck. On Day 2 you will write this yourself, starting from nothing and
# arriving here step by step. Read it now if you like; it will make more sense
# afterwards.

# ---------------------------------------------------------------------------
# Stage 1: build. Everything needed to install dependencies lives here and is
# thrown away afterwards.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

# Copy the manifest FIRST, install, and only then copy the source.
#
# This ordering is the single highest-value line in the file. Docker caches
# each layer and invalidates every layer after the first change. Source code
# changes on every commit; package.json changes rarely. Copy package.json
# alone, and `npm install` stays cached across source edits.
#
# Do it the other way round (COPY . . before install) and every one-character
# code change reinstalls every dependency. Day 2, Exercise 2 makes you measure
# exactly how much that costs.
COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./

# ---------------------------------------------------------------------------
# Stage 2: runtime. Starts from a clean base and copies in only what runs.
# npm, the build cache, and the toolchain never reach the final image.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runtime

# Tini reaps zombie processes and forwards signals properly. Without an init,
# a Node process running as PID 1 does not get default signal handlers -- our
# server installs its own SIGTERM handler so it would survive, but relying on
# that is fragile. This is one line and removes a whole class of "my container
# takes 10 seconds to stop" problems.
RUN apk add --no-cache tini

ENV NODE_ENV=production
WORKDIR /app

# node:alpine already ships an unprivileged `node` user (uid 1000). Use it
# rather than inventing another one.
#
# --chown matters: files copied in are owned by root by default, and a process
# running as `node` cannot write to them. Day 3 explores what happens when this
# is wrong, and why it bites hardest with bind mounts.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/server.js ./
COPY --chown=node:node package.json ./

# Everything below this line runs unprivileged. A container breakout is much
# less interesting to an attacker when the process was never root.
USER node

# EXPOSE is documentation. It publishes nothing -- see Day 4. It tells a reader
# (and `docker run -P`) which port the process listens on.
EXPOSE 3000

# Calls the liveness endpoint only. Deliberately NOT /ready: if the healthcheck
# depended on Postgres, a database restart would make Docker mark a healthy API
# as unhealthy and restart it too. Liveness and readiness answer different
# questions -- Day 5 covers this.
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# Exec form (a JSON array), not shell form.
#
# Shell form -- CMD node server.js -- runs `/bin/sh -c "node server.js"`, so
# PID 1 is the shell and Node is its child. `docker stop` signals PID 1; sh
# does not forward SIGTERM; Node never hears it; Docker waits 10 seconds and
# kills it. That is the real reason "Ctrl+C doesn't stop my container".
#
# Exec form makes Node the direct child of tini, and signals arrive.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
