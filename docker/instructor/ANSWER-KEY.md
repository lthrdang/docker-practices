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
