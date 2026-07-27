# Online Labs — KodeKloud

Browser-based labs, no setup. We use them for the **15-minute warm-up** at the
start of each day and for **homework**.

They are not the main event. The labs on your own machine are, because the
environment you have to debug at work is your own machine. A hosted sandbox is
always clean; yours will not be. But warm-ups in a clean sandbox get the room
moving without twenty minutes of "it doesn't work on mine", and they are a
genuinely useful control: **if something works in KodeKloud but fails on your
laptop, the difference is the lesson.**

---

## Set up your account

Create a free account at [kodekloud.com](https://kodekloud.com) before Day 1.
No credit card required for the free tier.

---

## The two things you will use

### 1. Docker Playground — a blank Docker box in your browser

**<https://kodekloud.com/playgrounds/playground-docker>**

One click, instant terminal with Docker and **Docker Compose preinstalled**.
Sessions run **one hour, extendable by another hour**.

Use it for: warm-ups, trying a command you are unsure about, and reproducing a
problem in a clean environment to find out whether the problem is your code or
your machine.

> Nothing persists after the session ends. Copy anything you want to keep.

### 2. Docker Training Course for the Absolute Beginner — free, with labs

**<https://kodekloud.com/courses/docker-for-the-absolute-beginner>**

Free course, ~55 topics across 11 modules, most with hands-on labs. Verified
module structure:

| Module | Has a lab | Maps to our |
|---|---|---|
| 1. Introduction | – | Day 1 |
| 2. Docker Commands | yes | Day 1 |
| 3. Docker Run Commands | yes | Day 1 + Day 3 (volumes and bind mounts live here) |
| 4. Docker Images | yes | Day 2 |
| 5. Docker Compose | yes | Day 5 |
| 6. Docker Engine & Storage | yes | Day 3 |
| 7. Docker Networking | yes | Day 4 |
| 8. Docker Registry | yes | Day 2 |
| 9. Docker on Mac & Windows | – | see [WSL2-NOTES.md](WSL2-NOTES.md) instead |
| 10. Container Orchestration | – | Day 5 wrap-up |
| 11. Conclusion | yes | – |

> **Module 9 is not our setup.** It covers Docker Desktop. We run Docker Engine
> natively in WSL2. Read [SETUP.md](SETUP.md) and [WSL2-NOTES.md](WSL2-NOTES.md)
> for what actually applies to you.

**If KodeKloud signup is a blocker for anyone**, the same course is on Coursera,
free to enrol: <https://www.coursera.org/learn/docker-for-the-absolute-beginner>

---

## What to do each day

| Day | Warm-up (15 min, in class) | Homework |
|---|---|---|
| **1** | Playground: run `nginx`, exec into it, stop it, remove it | Course modules 2–3 + their labs |
| **2** | Playground: write a 5-line Dockerfile, build it, run it | Course module 4 (Images) + module 8 (Registry) |
| **3** | Playground: `docker volume create`, mount it, write a file, destroy the container, prove the file survived | Course module 6 (Engine & Storage) |
| **4** | Playground: two containers on a custom network, ping by name | Course module 7 (Networking) |
| **5** | Playground: bring up a 2-service `compose.yaml` | Course module 5 (Compose) |

Each warm-up is deliberately small. The point is to have the concept in your
hands before you hear it explained, not to finish anything.

---

## Standalone free labs (extra practice)

KodeKloud Studio hosts individual free Docker labs:
**<https://kodekloud.com/studio/labs/docker>**

Two confirmed by direct link:

- [Docker Basic Commands](https://kodekloud.com/studio/labs/docker/docker_basiccommands) — pairs with Day 1
- [Docker CMD & Entrypoint](https://kodekloud.com/studio/labs/docker/docker_cmd_entrypoint) — pairs with Day 2, and covers exactly the `CMD` vs `ENTRYPOINT` distinction that trips everyone up

> **Instructor note.** The Studio catalog page is rendered by JavaScript and
> could not be enumerated when this document was written, so the full list of
> free labs is unconfirmed. Open the catalog before Day 1, check which labs are
> free at that moment, and list them here. **Do not assign a lab you have not
> confirmed is free** — nothing kills momentum like a paywall at homework time.

KodeKloud also runs a periodic **[Free Learning Week](https://kodekloud.com/free-week)**
that unlocks their full lab catalogue (1,280+ labs; the last one ran February
2026). Worth watching for.

---

## Do not use Play with Docker

You will find it recommended constantly — it was the default Docker sandbox for
years, and a large share of Docker tutorials, blog posts, and course materials
still build on it.

**It was discontinued on 1 March 2026.** `labs.play-with-docker.com` no longer
provides sessions.

The tutorial text at `training.play-with-docker.com` is still readable, but its
"launch lab" buttons are dead. If you follow a tutorial that tells you to start
a PWD session, it is at least a year out of date — check the rest of its claims
too.

This is a useful habit in general: **check whether the tooling a tutorial
assumes still exists** before you spend an hour on it.

---

## Other free resources, if you want to go further

Not assigned, but good, and all free:

| Resource | What it is good for |
|---|---|
| [Docker's official workshop](https://docs.docker.com/get-started/workshop/) | The canonical getting-started guide, from Docker themselves. Runs locally. |
| [Docker documentation](https://docs.docker.com/) | The actual reference. Get comfortable reading it — it is better than most tutorials about it. |
| [courselabs.co/docker](https://docker.courselabs.co/) | Free lab set with a good *Container networking* and *Limitations of Compose* section. Runs locally. |
| [DockerLabs by Collabnix](https://dockerlabs.collabnix.com/) | 500+ free labs, including Kubernetes 101 for after this course. Runs locally. |

---

*Links verified 2026-07-27. If one is dead by the time you read this, that is
itself the lesson from the Play with Docker section — tell the instructor so
this file gets updated.*
