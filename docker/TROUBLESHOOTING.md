# Troubleshooting

Find your error message. Every entry is **symptom → cause → fix**, and every
error string here was produced by running the failure, not remembered.

**Jump to:** [Setup](#setup) · [Build](#build--images) ·
[Container won't start](#the-container-wont-start) ·
[Networking](#networking) · [Data](#volumes--data) · [Disk & memory](#disk--memory) ·
[Compose](#compose) · [WSL2](#wsl2)

---

## The one diagnostic that saves the most time

Before anything else, read whether the error contains **an IP address**.

```
getaddrinfo ENOTFOUND postgress              ← no IP: DNS failed
connect ECONNREFUSED 192.168.107.2:5433      ← has an IP: DNS worked
```

**If there is an IP, the name resolved** — your problem is the port, or the
service is not ready. **If there is no IP**, your problem is the name or the
network. That single distinction eliminates half the possibilities before you
run a command.

---

## Setup

### `Cannot connect to the Docker daemon at unix:///var/run/docker.sock`

**Cause.** The daemon is not running. The CLI and the daemon are separate
programs — the CLI is fine.

**Fix.**

```bash
sudo systemctl status docker
sudo systemctl start docker
sudo systemctl enable --now docker      # and make it start on boot
```

If `systemctl` itself fails with `Failed to connect to bus`, systemd is not
enabled in WSL — [SETUP.md](SETUP.md) step 1.

---

### `permission denied while trying to connect to the Docker daemon socket`

**Cause.** You are not in the `docker` group, so you cannot talk to the socket.

**Fix.**

```bash
sudo usermod -aG docker $USER
```

Then, from **PowerShell**, `wsl --shutdown`, and reopen your terminal. Group
membership is only picked up by a new login session — this is why "I ran the
command and it still does not work" is so common. Verify with `groups`.

**Do not "fix" it by running `sudo docker` forever.** It works, but every file
your containers create on a bind mount will be root-owned and you will fight
that instead.

---

### `docker: 'compose' is not a docker command`

**Cause.** The `docker-compose-plugin` package is not installed. You may have
installed Ubuntu's `docker.io` instead of Docker's own packages.

**Fix.** Follow [SETUP.md](SETUP.md) steps 2–3 exactly.

**Note:** the standalone hyphenated `docker-compose` is **v1 and end of life**.
Everything here uses `docker compose`. If a tutorial uses the hyphen, it is old
— the YAML is usually still fine, the command is not.

---

## Build & images

### `exec ./entrypoint.sh: no such file or directory` — but the file is there

Or: `standard_init_linux.go: exec user process caused: exec format error`.

**Cause.** **CRLF line endings.** The shebang reads `#!/bin/sh\r`, so Linux
looks for an interpreter literally named `/bin/sh\r`. The message is about the
*interpreter*, not the script — which is why it reads like a lie.

**Diagnose.**

```bash
file entrypoint.sh              # "with CRLF line terminators"
cat -A entrypoint.sh | head     # ^M$ at line ends
```

**Fix.**

```bash
sed -i 's/\r$//' entrypoint.sh          # this file
git config --global core.autocrlf input # future checkouts
```

Plus `* text=auto eol=lf` in `.gitattributes`, and your editor set to LF. Full
detail in [WSL2-NOTES.md](WSL2-NOTES.md) #2.

---

### Every build reinstalls all dependencies

**Cause.** `COPY . .` before the install step. Any source change invalidates
that layer and everything after it.

**Fix.** Manifest first, source last.

```dockerfile
COPY package.json ./
RUN npm install --omit=dev
COPY server.js ./
```

Measured on the lab project: **3.82 s → 0.72 s** on a three-dependency app. On
a real one it is minutes versus seconds.

---

### The image is enormous

**Causes, in order of impact.**

1. A full base image. `node:22` → **1.63 GB**; `node:22-alpine` multi-stage →
   **238 MB**.
2. Build tools shipped into the runtime. Use multi-stage.
3. Package-manager caches. Clean **in the same `RUN`**:
   ```dockerfile
   RUN apt-get update && apt-get install -y --no-install-recommends curl \
       && rm -rf /var/lib/apt/lists/*
   ```
4. A missing `.dockerignore`, so your host `node_modules` and `.git` ship too.

**Find the culprit:**

```bash
docker history IMAGE
```

> Deleting a file in a **later** layer frees nothing — the layer below still
> contains it. Cleanup must happen in the layer that created the mess.

---

### `docker compose up` ignores my Dockerfile change

**Cause.** `up` does not rebuild by default.

**Fix.**

```bash
docker compose up -d --build
```

---

### Alpine made my Python image *bigger* / the build got much slower

**Cause.** Python wheels on PyPI are built against **glibc**; Alpine uses
**musl**. On Alpine, `pip` often cannot use a prebuilt wheel and compiles from
source — needing a toolchain, taking far longer, and sometimes ending larger.

**Fix.** Use `python:3.13-slim`. It is Debian-based, glibc, and already small.

**The general lesson:** "Alpine is smaller" is true for many stacks and false
for some. Build both and measure.

---

## The container won't start

### It exits immediately, `docker ps -a` shows `Exited (0)`

**Cause.** Not an error. **A container lives exactly as long as its main
process.** `docker run ubuntu` starts bash, bash has nothing to do, bash exits,
the container ends.

**Fix.** Give it something to do: `-it` for an interactive shell, or a
long-running command.

---

### `Exited (137)`

**Cause.** 128 + 9 = SIGKILL. Two usual sources:

- **The OOM killer.** Check:
  ```bash
  docker inspect NAME --format '{{.State.OOMKilled}}'
  ```
- **`docker stop` timing out.** The process ignored SIGTERM for 10 seconds, so
  Docker escalated — usually shell-form `CMD` (see below).

**Fix for OOM.** Raise `--memory`, or find the leak. Watch it live with
`docker stats`.

---

### `Exited (1)` and the logs are empty

**Cause.** The app is buffering stdout. In a container, **stdout is the log
transport** — a crash can lose the last output entirely.

**Fix.** Unbuffer it:

```dockerfile
ENV PYTHONUNBUFFERED=1      # Python
```

Node is unbuffered by default. For a shell script, `exec` your real process
rather than backgrounding it.

---

### `docker stop` takes exactly 10 seconds every time

**Cause.** Shell-form `CMD`. `CMD node server.js` runs `/bin/sh -c "node
server.js"`, so PID 1 is `sh`. Docker SIGTERMs PID 1; `sh` does not forward it;
your process never hears it; Docker waits out the grace period and SIGKILLs.

**Fix.** Exec form — a JSON array:

```dockerfile
CMD ["node", "server.js"]
```

Measured: **10.16 s → 0.23 s**. Multiply by five services on every
`docker compose down`.

---

### `Bind for 0.0.0.0:8080 failed: port is already allocated`

Full message:

```
docker: Error response from daemon: failed to set up container networking:
driver failed programming external connectivity on endpoint p2 (...):
Bind for 0.0.0.0:18099 failed: port is already allocated
```

**Cause.** Something already holds that host port — often a container you
forgot.

**Fix.**

```bash
docker ps -a --format '{{.Names}}\t{{.Ports}}' | grep 8080
sudo ss -tlnp | grep 8080
```

Or pick another host port — only the left-hand number has to change.

If nothing in WSL2 holds it, check **Windows**: `netstat -ano | findstr :8080`.

---

## Networking

### `getaddrinfo ENOTFOUND postgres` / `ping: bad address 'postgres'`

**Cause.** The name does not resolve. Three possibilities:

1. **You are on the default `bridge` network**, which has **no DNS**.
2. **The containers are on different networks.**
3. **The name is wrong** (`postgress`, a typo, or the container name rather
   than the alias you meant).

**Diagnose.**

```bash
docker inspect a --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'
docker inspect b --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'
docker exec a cat /etc/resolv.conf     # 127.0.0.11 = a user-defined network
```

**Fix.** Put both on the same **user-defined** network:

```bash
docker network create mynet
docker network connect mynet a
docker network connect mynet b
```

In Compose this is automatic — every service in a project shares a network and
the service name is a DNS name.

---

### `** server can't find postgres: NXDOMAIN`

Same cause as above, seen from `nslookup`. In a two-network design this is
**correct behaviour** from a container that is not supposed to reach that tier:

```
nginx -> nslookup postgres    ** server can't find postgres: NXDOMAIN   ← by design
api   -> nslookup postgres    Address: 192.168.117.2                    ← by design
```

Check whether it is intentional before you "fix" it.

---

### `connect ECONNREFUSED 192.168.107.2:5433`

**Cause.** **The name resolved** — there is an IP. So it is one of:

1. **Wrong port.** Postgres is on 5432, not 5433.
2. **The service is not ready yet.** It is still starting.
3. **It is bound to `127.0.0.1`** inside its own container.

**Diagnose.**

```bash
docker exec b ss -tln          # what is it ACTUALLY listening on?
docker logs b                  # still starting?
```

**Fix.** Correct the port, add a healthcheck with
`depends_on: condition: service_healthy`, or make the app bind `0.0.0.0`.

---

### `docker ps` shows the port published, but `curl` returns nothing

```
PORTS: 0.0.0.0:8083->8000/tcp     ← looks perfect
curl localhost:8083               → 000
```

**Two possible causes.**

**A. The container port is wrong.** `-p 8082:8080` against nginx forwards to
container port 8080, where nothing listens. Docker cannot know what your app
binds.

**B. The app is bound to `127.0.0.1` inside the container.** This is the hard
one — every diagnostic looks healthy.

**Tell them apart:**

```bash
docker exec NAME ss -tln
```

```
127.0.0.1:8000    ← cause B: bound to the container's own loopback
0.0.0.0:80        ← cause A: right binding, you published the wrong port
```

**Fix B.** Containerised apps must bind `0.0.0.0`:

```js
app.listen(PORT, '0.0.0.0')
```
```python
app.run(host="0.0.0.0")
```

---

### nginx returns `502 Bad Gateway`

**Cause.** nginx resolved the upstream and connected — or tried to — and got
nothing usable. **So nginx is fine; look at the backend.**

**Diagnose, in order.**

```bash
docker compose ps                                   # is the backend running/healthy?
docker compose exec nginx nslookup api              # does the name resolve from nginx?
docker compose exec nginx wget -qO- http://api:3000/health
docker compose logs api
```

**Usual causes:** the backend is on a different network from nginx; nginx is
proxying to the wrong port; the backend is still starting.

---

### `--scale api=3` works but one replica gets all the traffic

**Cause.** Not Docker. **nginx resolved the name once, at its own last
start/reload, and cached it.** Docker's DNS is correctly returning three
addresses; nginx never asked again. This bites hardest when nginx started (or
last reloaded) *before* you scaled up — restarting nginx after scaling makes
it re-resolve and pick up every replica that already exists at that moment.

**Fix.** Force per-request resolution with a variable in `proxy_pass`:

```nginx
resolver 127.0.0.11 valid=10s;
set $upstream http://api:3000;
proxy_pass $upstream$request_uri;
```

Verified: nine requests split **3 / 3 / 3** with this, **9 / 0 / 0** without.

**Verify DNS is not the problem** before touching anything:

```bash
docker compose exec nginx nslookup api      # should show three addresses
```

---

### `host.docker.internal` does not resolve

**Cause.** Docker Desktop injects it. We run Docker Engine, so nothing does.

**Fix.**

```bash
docker run --add-host=host.docker.internal:host-gateway myimage
```

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

---

## Volumes & data

### `Error: Cannot find module 'express'` — after adding a bind mount

**Cause.** Day 3, Rule 2. Your bind mount **hides** the image's entire `/app`,
including the `node_modules` that `npm install` produced at build time. Bind
mounts **never seed**, so nothing replaced them.

**Fix.** Shield the subdirectory with an anonymous volume:

```bash
docker run -v "$PWD":/app -v /app/node_modules myimage
```

```yaml
volumes:
  - ./app:/app
  - /app/node_modules
```

The anonymous volume is empty, so it *is* seeded from the image — and being
mounted deeper, it wins.

Same pattern for Python `.venv`, Go build caches, Rust `target/`.

---

### My data disappeared

**Work through these in order.**

**1. Is there a volume at all?**

```bash
docker inspect NAME --format '{{json .Mounts}}'
```

No mount → the data was in the container's writable layer and `docker rm`
destroyed it.

**2. Did you typo the volume name?** This is the most common cause and it is
silent:

```bash
docker run -v pgdta:/var/lib/postgresql/data postgres    # meant pgdata
docker volume ls | grep pg
```

Docker created a brand-new empty volume. **Your data is not lost** — it is in
`pgdata`, untouched. Nothing warned you.

> `--mount type=volume,src=pgdta,...` would have behaved the same for a volume,
> but for a **bind** path `--mount` errors where `-v` silently creates. Use
> `--mount` when it matters.

**3. Did you run `down -v`?** That deletes named volumes. `down` alone does not.

**4. Is it an anonymous volume?** Images like Postgres declare
`VOLUME /var/lib/postgresql/data`, so a run without `-v` creates an anonymous
volume that `down` orphans:

```bash
docker volume ls -qf dangling=true
```

The data may still be in one of those.

---

### `touch: /data/x: Permission denied` in a non-root container

**Cause.** A freshly created named volume mounts as a **root-owned** directory.
Your `USER node` (uid 1000) cannot write to it.

**Fix (best).** Pre-create the directory with the right owner in the Dockerfile
— an empty volume is seeded from the image, **including the ownership**:

```dockerfile
RUN adduser -D -u 1000 app && mkdir -p /data && chown app:app /data
USER app
```

**Fix (quick).**

```bash
docker run --rm --user 0:0 -v myvol:/data alpine chown 1000:1000 /data
```

**Do not fix it with `user: root`.** That trades a real security property for
one `chown`.

---

### `invalid mount config for type "bind": bind source path does not exist`

**Cause.** `--mount` refuses to invent a host path that is not there. This is a
feature — `-v` would have silently created an empty directory and left you
debugging "my files are missing".

**Fix.** Create the directory, or fix the typo in the path.

---

### Files created by my container are owned by root and I cannot delete them

**Cause.** On Linux and WSL2, a bind mount is a real bind mount: a container
running as root creates root-owned files on your host.

**Fix.** Run as yourself for development:

```bash
docker run --user "$(id -u):$(id -g)" -v "$PWD":/app myimage
```

To clean up what already happened: `sudo rm -rf <dir>`, or

```bash
docker run --rm -v "$PWD":/w alpine chown -R $(id -u):$(id -g) /w
```

---

## Disk & memory

### `no space left on device`

```bash
docker system df            # what is using it
docker system df -v         # per image / container / volume
docker system prune         # dangling images, stopped containers, unused networks
docker system prune -a      # + every image not used by a running container
docker builder prune        # build cache -- often the biggest surprise
```

> **`docker volume prune` deletes data.** It removes every volume not attached
> to a container, including the database of a project you merely stopped.
> `docker volume ls` first, every time.

If Docker reports gigabytes reclaimed and Windows shows no change, see
[WSL2](#wsl2) below.

---

### Windows becomes unresponsive when the stack is running

**Cause.** WSL2 takes memory as Linux needs it and is slow to return it.
`Vmmem` / `vmmemWSL` in Task Manager will confirm.

**Fix.** Cap it in `C:\Users\<you>\.wslconfig`:

```ini
[wsl2]
memory=6GB
processors=4
```

Then `wsl --shutdown` from PowerShell. To reclaim RAM after a heavy lab, close
your terminals and `wsl --shutdown`.

Per-container limits also help:

```bash
docker run --memory=512m --cpus=1 IMAGE
```

---

## Compose

### `depends_on` does not actually wait

**Cause.** Plain `depends_on` waits for the container to **start**, not for the
service to be **ready**. Postgres takes seconds to initialise — longer on a
first run.

**Fix.**

```yaml
api:
  depends_on:
    postgres:
      condition: service_healthy

postgres:
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U app -d app"]
    interval: 5s
    timeout: 3s
    retries: 5
    start_period: 10s
```

> **`sleep 10` is not a fix.** Too long on a fast machine, too short on a
> loaded one. And write applications that retry anyway — Compose orders the
> *first* start; it cannot stop Postgres restarting at 3 a.m.

---

### My environment variable is empty

**Diagnose first, always:**

```bash
docker compose config
```

That prints the fully resolved file. Usual causes: no `.env` in the project
directory; the variable is in `.env` but the compose file never references it;
you are using `env_file` and expecting `${VAR}` substitution (different
mechanisms); or a typo.

---

### My override file is not being applied

**Cause.** Compose auto-merges `compose.override.yaml` only with a file named
`compose.yaml` (or `docker-compose.yaml`). With a custom base name you must
name both:

```bash
docker compose -f 05-final.yaml -f compose.override.yaml up -d
```

**Check the merge result:**

```bash
docker compose -f base.yaml -f override.yaml config
```

Remember: later files win; **lists like `ports:` are replaced, not appended.**

---

### Two projects are fighting over containers or volumes

**Cause.** The project name defaults to the directory name, and two directories
with the same name collide.

**Fix.**

```bash
docker compose -p myproject up -d
```

or set `COMPOSE_PROJECT_NAME` in `.env`.

---

## WSL2

### It works in WSL2 but the Windows browser cannot reach it

**Work the hops in order.**

```bash
docker ps                       # 1. is PORTS showing an arrow? no arrow = no -p
curl -I localhost:8080          # 2. does it answer inside WSL2?
```

If both are fine, the problem is WSL's localhost forwarding:

```bash
wsl.exe hostname -I             # 3. e.g. 172.24.115.3
```

Browse `http://172.24.115.3:8080`. **If that works, the container is fine** and
the issue is purely forwarding.

```powershell
wsl --shutdown                  # 4. reset it, then reopen and restart
netstat -ano | findstr :8080    # 5. does a Windows process hold the port?
```

Full detail: [WSL2-NOTES.md](WSL2-NOTES.md) #8.

---

### Hot reload never fires

**Cause.** Your code is under `/mnt/c`. Linux `inotify` events are **not
reliably generated** for changes made on the Windows side, so the watcher never
hears anything. It is not slow — the event never arrives.

**Fix.** Move the project into the Linux filesystem:

```bash
mkdir -p ~/projects && cp -r /mnt/c/path/to/project ~/projects/
```

Edit with VS Code + the **WSL** extension (`code ~/projects`).

---

### Builds and `npm install` are extremely slow

Same cause, same fix. Files under `/mnt/c` are reached through a translation
layer and every operation is a round trip out of the Linux VM.

---

### Docker freed 20 GB and my C: drive did not change

**Cause.** Everything Docker stores lives in `/var/lib/docker` inside the
distro's `ext4.vhdx`. That file grows and historically **never shrinks**.
Deleting inside it frees space inside it.

**Fix.**

```powershell
wsl --shutdown
wsl --manage <distro> --set-sparse true
```

`wsl -l -v` gives the distro name; `wsl --help` confirms whether `--manage` is
available in your WSL version.

**Two things that confuse people:** Explorer still shows the **Size** it grew
to — look at **Size on disk**. And the VHDX is under
`%LOCALAPPDATA%\Packages\...\LocalState\ext4.vhdx`; do not move or edit it with
Windows tools.

---

### `systemctl` says `Failed to connect to bus`

**Cause.** systemd is not enabled in WSL.

**Fix.** `/etc/wsl.conf`:

```ini
[boot]
systemd=true
```

Then `wsl --shutdown` from PowerShell.

---

## When none of this helps

Work outwards from what you know is true:

```bash
docker ps -a                        # is it even running? what exit code?
docker logs NAME --tail=50          # what did it say on the way down?
docker inspect NAME --format '{{json .State}}'
docker compose config               # is the config what you think it is?
docker exec NAME sh                 # go look
```

Then run the four hops from the top of this file. Find the innermost thing that
works; the break is at the next hop out.

**Read the error message twice before changing anything.** Docker's errors are
usually precise — and if the message contains an IP address, you have already
eliminated half the possibilities.

---

See also: [CHEATSHEET.md](CHEATSHEET.md) · [WSL2-NOTES.md](WSL2-NOTES.md) ·
[SETUP.md](SETUP.md)
