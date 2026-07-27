# Setup — Docker Engine inside WSL2

**Do this before Day 1.** Budget 20 minutes. If you get stuck, post the exact
error message in the group chat — do not arrive on Day 1 with a broken setup.

---

## What we are installing, and why not Docker Desktop

We install **Docker Engine** directly inside your WSL2 distro.

We do **not** use Docker Desktop. Docker Desktop requires a paid subscription
for commercial use at companies with **250+ employees or $10M+ annual revenue**
([Docker's licensing terms](https://docs.docker.com/subscription/desktop-license/)).
Docker Engine is Apache-2.0 licensed and free at any company size.

This is not a downgrade. Docker Engine *is* Docker — the same daemon, the same
CLI, the same images. Docker Desktop is a GUI wrapper plus a VM manager, and on
WSL2 you already have the VM.

**What you give up, and what replaces it:**

| Docker Desktop gives you | Without it |
|---|---|
| `docker` in PowerShell/CMD | Work inside the WSL terminal. That is where everything happens. |
| A GUI dashboard | `docker ps`, `docker stats`, `docker logs`. Optionally the free TUIs `lazydocker` or `ctop`. |
| `host.docker.internal` automatically | Add it explicitly: `--add-host=host.docker.internal:host-gateway`. Covered on Day 4. |
| Auto-start on login | `systemctl enable docker` does the same job. |

---

## Prerequisites

You already have WSL2 with a Linux distro installed. This guide assumes
**Ubuntu**. Check:

```bash
cat /etc/os-release
```

You should see `Ubuntu`. Confirm you are on WSL **2**, not WSL 1 — run this in
**PowerShell**, not in WSL:

```powershell
wsl -l -v
```

The `VERSION` column must say `2`. If it says `1`, convert it:

```powershell
wsl --set-version Ubuntu 2
```

---

## Step 1 — Enable systemd

WSL2 does not run systemd by default, but Docker's service is managed by
systemd. Turn it on.

Inside WSL, create or edit `/etc/wsl.conf`:

```bash
sudo tee /etc/wsl.conf > /dev/null <<'EOF'
[boot]
systemd=true
EOF
```

Then shut WSL down completely from **PowerShell** so it restarts with systemd:

```powershell
wsl --shutdown
```

Reopen your WSL terminal and verify:

```bash
systemctl is-system-running
```

Anything other than `Failed to connect to bus` is fine — `running` or
`degraded` both mean systemd is up. `degraded` just means some unrelated unit
failed to start, which is normal on WSL.

> **Why this matters:** without systemd you would have to start the Docker
> daemon by hand (`sudo dockerd &`) every single time you open a terminal. With
> systemd it starts on its own and stays running.

---

## Step 2 — Add Docker's official APT repository

Do **not** use `apt install docker.io`. That package is Ubuntu's fork, it lags
behind, and on some releases it ships without the Compose v2 plugin.

Remove any conflicting older packages first:

```bash
for pkg in docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc; do
  sudo apt-get remove -y $pkg
done
```

It is fine if apt reports that none of them were installed.

Add Docker's GPG key:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
```

Add the repository:

```bash
sudo tee /etc/apt/sources.list.d/docker.sources > /dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

sudo apt-get update
```

---

## Step 3 — Install

```bash
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

What each package is:

| Package | What it does |
|---|---|
| `docker-ce` | The daemon (`dockerd`) — the thing that actually runs containers |
| `docker-ce-cli` | The `docker` command you type |
| `containerd.io` | The lower-level runtime the daemon delegates to |
| `docker-buildx-plugin` | The modern build engine (`docker build` uses it) |
| `docker-compose-plugin` | Gives you `docker compose` (v2, no hyphen) |

> The old standalone `docker-compose` binary with a hyphen is **v1 and end of
> life**. Every command in this course uses `docker compose`. If a tutorial you
> find online uses `docker-compose`, it is old — the YAML is usually still
> valid, the command is not.

---

## Step 4 — Run Docker without `sudo`

By default the Docker socket is owned by root, so every command would need
`sudo`. Add yourself to the `docker` group:

```bash
sudo usermod -aG docker $USER
```

Group membership is only picked up on a new login session. The reliable way on
WSL is to shut the distro down from **PowerShell**:

```powershell
wsl --shutdown
```

Reopen the terminal and check:

```bash
groups
```

You should see `docker` in the list.

> **Security note, so you know what you just did:** membership in the `docker`
> group is equivalent to root on this machine. Anyone who can talk to the Docker
> socket can start a container that mounts the whole filesystem. On your own dev
> machine this is the normal trade-off. On a shared or production server, it is
> a decision someone should make deliberately.

---

## Step 5 — Start the daemon and make it stay started

```bash
sudo systemctl enable --now docker
```

`enable` makes it start on boot, `--now` starts it immediately. Check:

```bash
systemctl status docker --no-pager
```

You want `Active: active (running)`.

---

## Step 6 — Smoke test

Run all four. All four must pass before Day 1.

```bash
docker version
```
Both a **Client** and a **Server** section must appear. If you see
`Cannot connect to the Docker daemon`, the daemon is not running — go back to
step 5.

```bash
docker run --rm hello-world
```
Prints "Hello from Docker!". This proves the daemon can pull an image from the
registry and run a container.

```bash
docker compose version
```
Prints `Docker Compose version v2.x.x` or later. If this says
`docker: 'compose' is not a docker command`, the `docker-compose-plugin`
package did not install — go back to step 3.

```bash
docker run --rm alpine ping -c 2 1.1.1.1
```
Proves containers have working outbound networking. If this hangs, you likely
have a corporate VPN or proxy in the way — flag it now, not on Day 4.

---

## Step 7 — Set up your working directory

**This step is not optional, and it is the one people skip.**

Create your project directory **inside the Linux filesystem**:

```bash
mkdir -p ~/projects
cd ~/projects
```

Do **not** work in `/mnt/c/Users/...`. Files on the Windows drive are reached
through a translation layer: file I/O is dramatically slower, and file-change
events frequently never reach Linux at all — so hot reload silently stops
working and you will blame Docker for it.

You will measure this difference yourself on Day 3. For now, just work in `~`.

### Editing files

Install the **WSL** extension in VS Code, then from your WSL terminal:

```bash
code ~/projects
```

VS Code opens with its backend running inside WSL, editing Linux files
directly. The window looks normal; the bottom-left corner shows `WSL: Ubuntu`.

### Git line endings — do this now

Windows Git checks out files with CRLF line endings by default. A shell script
with CRLF endings fails inside a Linux container with a baffling error
(`exec format error`, or a "not found" that names a file that clearly exists).

Set this once:

```bash
git config --global core.autocrlf input
```

The lab repo also ships a `.gitattributes` that pins line endings, but knowing
this setting is what saves you on a real project. Day 2 makes you trigger the
failure on purpose so you recognize it forever.

---

## Step 8 — Cap WSL2's memory (recommended)

By default WSL2 will happily take a large share of your RAM and not give it
back. You are about to run five containers at once.

In **Windows**, create or edit `C:\Users\<you>\.wslconfig`:

```ini
[wsl2]
memory=6GB
processors=4
```

Tune to your machine — roughly half your physical RAM is a reasonable start.
Apply with `wsl --shutdown` from PowerShell.

To reclaim RAM at any time after a heavy lab, close your terminals and run
`wsl --shutdown` from PowerShell.

---

## Done

Checklist:

- [ ] `systemctl is-system-running` does not say "Failed to connect to bus"
- [ ] `groups` includes `docker`
- [ ] `docker version` shows both Client and Server
- [ ] `docker run --rm hello-world` succeeds without `sudo`
- [ ] `docker compose version` shows v2 or later
- [ ] `docker run --rm alpine ping -c 2 1.1.1.1` succeeds
- [ ] `~/projects` exists and you are editing files there, not on `/mnt/c`
- [ ] `git config --global core.autocrlf input` is set

If something failed, check [TROUBLESHOOTING.md](TROUBLESHOOTING.md) first —
the common setup failures are listed there with their causes.

---

## Sources

- [Install Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/) — official install steps
- [Docker Desktop license agreement](https://docs.docker.com/subscription/desktop-license/) — the 250 employees / $10M thresholds
- [Post-installation steps for Linux](https://docs.docker.com/engine/install/linux-postinstall/) — the `docker` group and its security implications

*Links verified 2026-07-27.*
