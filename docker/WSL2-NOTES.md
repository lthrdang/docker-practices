# WSL2 Notes — the things that will waste your afternoon

Docker behaves the same on WSL2 as on any Linux box, **except** at the boundary
between Linux and Windows. Every problem in this file lives on that boundary.

Read it once now. Come back to it when something works for everyone else but
not for you.

Each entry is: **symptom → cause → fix**.

> Items marked **`[NEEDS WSL2 DRY-RUN]`** were written from Microsoft's and
> Docker's official documentation but have not been executed on a Windows
> machine by the author of this material. Verify them once during the
> instructor dry-run (checklist at the bottom) and delete the tag.

---

## 1. Your bind mount is slow, and hot reload never fires

**Symptom.** `npm install` inside a bind-mounted directory takes minutes
instead of seconds. Your dev server does not restart when you save a file. The
same project is fast on a colleague's machine.

**Cause.** Your project is under `/mnt/c/...`. Files on the Windows drive are
reached through a network-protocol translation layer (9P). Every file operation
is a round trip out of the Linux VM and back. Worse, Linux `inotify` events —
what every file watcher uses — are **not reliably generated** for changes made
on the Windows side.

So it is not that hot reload is slow. It is that the event never arrives.

**Fix.** Keep code in the Linux filesystem:

```bash
mkdir -p ~/projects && cd ~/projects
```

Edit it with VS Code + the **WSL** extension (`code ~/projects`), which runs
the editor backend inside Linux.

**Rule of thumb:** if the path you are working in starts with `/mnt/`, you are
on the slow path.

*You will measure this yourself in Day 3, Exercise 6.*

---

## 2. `exec format error` — or a "not found" naming a file that exists

**Symptom.** One of these, from a container that ran fine on someone else's
machine:

```
exec /app/entrypoint.sh: no such file or directory
```
```
standard_init_linux.go: exec user process caused: exec format error
```

The maddening part: `ls -l /app/entrypoint.sh` inside the container shows the
file is right there.

**Cause.** **CRLF line endings.** Windows Git checks out text files with
`\r\n`. The shebang line then reads:

```
#!/bin/sh\r
```

Linux looks for an interpreter literally named `/bin/sh\r`, which does not
exist. The error says "no such file or directory" and means the *interpreter*,
not the script — which is why it reads like a lie.

**Fix — three layers, use all three:**

```bash
# 1. Tell Git never to convert on checkout
git config --global core.autocrlf input
```

```gitattributes
# 2. Pin it per-repo in .gitattributes (the lab repo ships with this)
* text=auto eol=lf
*.sh text eol=lf
```

3. Set your editor to LF. In VS Code: bottom-right status bar shows `CRLF` or
   `LF` — click it to switch.

To fix a file that is already broken:

```bash
sed -i 's/\r$//' entrypoint.sh
```

To check whether a file is affected:

```bash
file entrypoint.sh          # says "with CRLF line terminators"
cat -A entrypoint.sh | head # shows ^M$ at line ends
```

*Day 2 makes you trigger this on purpose. It is the single most common
Windows-developer Docker failure, and it costs people hours the first time.*
**`[NEEDS WSL2 DRY-RUN]`** — confirm the exact error text on Windows Git.

---

## 3. `chmod +x` does not stick

**Symptom.** You run `chmod +x script.sh`, then `ls -l` still shows the file as
non-executable — or it shows as executable but Docker says permission denied.

**Cause.** Files under `/mnt/c` live on NTFS, which has no Unix permission
bits. WSL synthesizes them, and by default the mode you set does not persist.

**Fix.** Same as #1 — work in `~`, not `/mnt/c`.

If you genuinely must work on the Windows drive, set the executable bit inside
the image instead of relying on the host:

```dockerfile
COPY entrypoint.sh /app/
RUN chmod +x /app/entrypoint.sh
```

That is good practice regardless: it makes the image self-contained rather than
dependent on how the host checked the file out.

---

## 4. Docker ate my C: drive, and pruning did not give it back

**Symptom.** Windows reports tens of gigabytes gone. You run
`docker system prune -a`, it reports reclaiming 20 GB, and the free space on
C: does not change.

**Cause.** Everything Docker stores — images, containers, volumes, build cache —
lives in `/var/lib/docker` **inside your distro's `ext4.vhdx`**. That VHDX
grows as needed but historically **never shrinks on its own**. Deleting files
inside it frees space *inside* the virtual disk; the file on Windows stays the
size it grew to.

**Fix, in order:**

First, actually free the space inside:

```bash
docker system df            # see what is using space, by category
docker system prune         # dangling images, stopped containers, unused networks
docker system prune -a      # also every image not used by a running container
docker volume prune         # unused volumes — see the warning below
docker builder prune        # build cache, often the biggest surprise
```

> **`docker volume prune` deletes data.** It removes every volume not currently
> attached to a container — including the database volume of a project you
> merely stopped. Run `docker volume ls` first and know what you are deleting.

Then reclaim it on the Windows side. Modern WSL supports automatic reclamation
via a sparse VHD:

```powershell
wsl --shutdown
wsl --manage <distro> --set-sparse true
```

Check availability with `wsl --help` — `--manage` requires WSL 2.5+, and the
sparse option is a newer WSL 2 feature. `wsl -l -v` gives you the distro name.

Two things that surprise people:
- Windows Explorer still shows the **Size** it grew to. Look at **Size on
  disk** in the file's Properties to see the real usage.
- The VHDX lives under
  `%LOCALAPPDATA%\Packages\<PackageFamilyName>\LocalState\ext4.vhdx`. Do not
  move or edit it with Windows tools — you can corrupt the distro.

**`[NEEDS WSL2 DRY-RUN]`** — confirm `--set-sparse` exists in the WSL version
the team runs, and note the fallback if it does not.

**Prevention beats cleanup.** Get in the habit of `docker system df` weekly and
`docker compose down` when you finish for the day.

---

## 5. Your laptop grinds to a halt with five containers running

**Symptom.** `Vmmem` or `vmmemWSL` in Task Manager is using most of your RAM.
Windows becomes unresponsive. Closing WSL does not give the memory back.

**Cause.** WSL2 claims memory as the Linux side needs it and is slow to return
it to Windows.

**Fix.** Cap it. In **Windows**, create or edit `C:\Users\<you>\.wslconfig`:

```ini
[wsl2]
memory=6GB
processors=4
```

Apply with `wsl --shutdown` from PowerShell, then reopen your terminal.

Roughly half your physical RAM is a sensible starting point. The Day 5 capstone
runs five containers; 4 GB is workable, 6–8 GB is comfortable.

To hand memory back immediately after a heavy lab: close your WSL terminals and
run `wsl --shutdown` from PowerShell.

You can also limit an individual container — useful and worth knowing:

```bash
docker run --memory=512m --cpus=1 <image>
```

---

## 6. `--network host` does not do what the tutorial says

**Symptom.** You read that `--network host` makes the container share "the
host's" network, so you expect `localhost:3000` to work from your Windows
browser. It does not behave the way the article implies.

**Cause.** There are **two** hosts in your setup:

```
Windows  ──►  WSL2 VM (real Linux kernel)  ──►  container
```

`--network host` puts the container in the **WSL2 VM's** network namespace, not
Windows'. Every tutorial written for native Linux collapses those two into one
machine. Yours does not.

**Fix.** Use normal published ports instead — `-p 8080:80` — which is what you
should be doing anyway. Published ports are explicit, they work with Compose,
and they do not depend on this distinction.

If you need the WSL2 VM's own address:

```bash
wsl hostname -I          # the WSL2 VM's IP, run from PowerShell
```

*Covered properly in Day 4.*

---

## 7. `host.docker.internal` does not resolve

**Symptom.**

```
getaddrinfo ENOTFOUND host.docker.internal
```

...on a machine where a colleague's Docker Desktop setup resolves it fine.

**Cause.** `host.docker.internal` is a convenience that **Docker Desktop**
injects. We run Docker Engine directly, so nothing injects it.

**Fix.** Add it explicitly. `host-gateway` is a magic value Docker resolves to
the host's gateway address:

```bash
docker run --add-host=host.docker.internal:host-gateway myimage
```

In Compose:

```yaml
services:
  api:
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

This is arguably better practice than relying on Docker Desktop's implicit
behavior — the dependency is written down in your compose file instead of
depending on which Docker product a teammate installed.

To find the Windows host's address from inside WSL2:

```bash
ip route show | grep -i default | awk '{ print $3 }'
```

**`[NEEDS WSL2 DRY-RUN]`** — confirm `host-gateway` resolves to a reachable
address under Docker Engine on WSL2.

---

## 8. The container works in WSL2 but the Windows browser cannot reach it

**Symptom.** `curl localhost:8080` works inside WSL. Opening
`http://localhost:8080` in Chrome on Windows times out.

**Cause.** Reaching a container from Windows crosses **two** boundaries:

```
Windows localhost  ──►  WSL2 VM  ──►  published port  ──►  container
        (WSL localhost forwarding)      (Docker DNAT)
```

The second hop is Docker's job and is well behaved. The first hop is WSL's
localhost forwarding, and it is the one that occasionally misbehaves — after
sleep/resume, after a VPN connects, or when a Windows process already holds the
port.

**Fix, in order:**

1. Confirm the container is actually published:
   ```bash
   docker ps          # the PORTS column must show 0.0.0.0:8080->80/tcp
   ```
   If PORTS is empty you forgot `-p`. That is not a WSL problem.

2. Confirm it answers inside WSL:
   ```bash
   curl -I localhost:8080
   ```
   If this fails, the problem is Docker-side — go to
   [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

3. If it works in WSL but not Windows, bypass localhost forwarding:
   ```bash
   wsl hostname -I        # e.g. 172.24.115.3
   ```
   Then browse to `http://172.24.115.3:8080`. **If that works, the container is
   fine and the issue is purely WSL localhost forwarding.**

4. Reset it: `wsl --shutdown` from PowerShell, reopen, restart the container.

5. Check nothing on Windows already owns the port:
   ```powershell
   netstat -ano | findstr :8080
   ```

**`[NEEDS WSL2 DRY-RUN]`** — confirm default localhost-forwarding behavior on
the team's Windows build.

---

## What is *not* a problem on WSL2

Worth stating, because it saves you from chasing ghosts:

- **Container networking internals are genuinely real.** WSL2 runs a real Linux
  kernel and Docker Engine runs natively in it. `docker0`, veth pairs,
  iptables NAT rules, network namespaces — you can inspect all of them with
  `ip`, `iptables`, and `nsenter`, exactly as on a Linux server. On a Mac these
  are hidden inside an opaque VM. **Your setup is the better one for learning
  this.**
- **Volume storage is a real ext4 filesystem.**
  `/var/lib/docker/volumes/<name>/_data` is a real path you can `ls`.
- **Performance inside `~` is native.** The slowness is specific to crossing to
  `/mnt/c`, not to WSL2 in general.

---

## Instructor dry-run checklist

Run once on a real Windows machine before Day 1 — ideally by following
[SETUP.md](SETUP.md) verbatim on a clean distro, which doubles as a rehearsal
of the trainee experience.

**Why this exists.** The course material was authored on macOS. Everything that
happens *inside* a container was executed and verified — image sizes, build
timings, volume seeding and shadowing, DNS behaviour, port publishing. What
could **not** be verified from there is the **WSL2↔Windows boundary**, plus one
networking finding below. Those claims were written from Microsoft's and
Docker's official documentation and tagged `[NEEDS WSL2 DRY-RUN]` rather than
asserted.

There are **11 tagged claims across 4 files**. Verify them, then delete the tag.

### Setup

- [ ] `SETUP.md` start to finish on a clean Ubuntu distro; all four smoke tests pass
- [ ] Note the real elapsed time so you can set expectations on the day

### This file

- [ ] **#2** — check out a `.sh` with CRLF and capture the *exact* error text from Windows Git
- [ ] **#4** — confirm `wsl --manage <distro> --set-sparse true` exists in the team's WSL version; record the fallback if not
- [ ] **#7** — confirm `--add-host=host.docker.internal:host-gateway` reaches a Windows-side service
- [ ] **#8** — confirm `http://localhost:8080` reaches a published container from the Windows browser; record `wsl hostname -I` as the fallback

### Day 3 lab

- [ ] **Ex. 5, Fix C** — confirm the observed file ownership on a bind mount. macOS remaps ownership and hides the effect; on WSL2 it is real
- [ ] **Ex. 6** — record baseline `/mnt/c` vs `~` write timings **and** whether the inotify watcher fires, on typical team hardware
- [ ] **Ex. 9** — confirm the VHDX sparse/compaction steps end to end

### Day 4 lab

- [ ] **Ex. 3** — confirm `ip link show type bridge`, `ip link | grep veth` and `bridge link` show what the exercise describes
- [ ] **Ex. 6** — **the important one.** Confirm whether a container on one network can reach another network's container **by raw IP**. On the authoring machine it **could**, and the iptables packet counters stayed at zero. Standard Docker Engine on Linux should drop it. Record the real result and update the exercise, plus the caveat in `day4-networking/README.md` §5 and the Q25 answer in `ASSESSMENT.md`

### Finally

- [ ] Delete every `[NEEDS WSL2 DRY-RUN]` tag you have verified
- [ ] Run one full pass of `labs/compose/01` → `05` on WSL2 to confirm the Day 5 lab timings hold

---

## Sources

- [How to manage WSL disk space](https://learn.microsoft.com/en-us/windows/wsl/disk-space) — VHDX location, `wsl --manage`, repair
- [Basic commands for WSL](https://learn.microsoft.com/en-us/windows/wsl/basic-commands) — `wsl hostname -I`, host IP from WSL2, `--shutdown`
- [Advanced settings configuration](https://learn.microsoft.com/en-us/windows/wsl/wsl-config) — `.wslconfig` and `/etc/wsl.conf`
- [Networking with WSL](https://learn.microsoft.com/en-us/windows/wsl/networking) — localhost forwarding and IP identification

*Links verified 2026-07-27.*
