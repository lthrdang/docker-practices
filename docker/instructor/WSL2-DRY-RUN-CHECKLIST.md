# WSL2 dry-run checklist

Run once on a real Windows machine before Day 1 — ideally by following
[SETUP.md](../SETUP.md) verbatim on a clean distro, which doubles as a
rehearsal of the trainee experience.

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

### WSL2-NOTES.md

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
- [ ] **Ex. 6** — **the important one.** Confirm whether a container on one network can reach another network's container **by raw IP**. On the authoring machine it **could**, and the iptables packet counters stayed at zero. Standard Docker Engine on Linux should drop it. Record the real result and update the exercise, plus the caveat in `../day4-networking/README.md` §5 and the Q25 answer in `ANSWER-KEY.md`

### Finally

- [ ] Delete every `[NEEDS WSL2 DRY-RUN]` tag you have verified
- [ ] Run one full pass of `../labs/compose/01` → `05` on WSL2 to confirm the Day 5 lab timings hold

