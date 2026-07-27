# Day 2 Homework

**Time:** ~60 minutes. Bring your Dockerfile and your numbers to Day 3.

---

## Part 1 — Fix a bad Dockerfile (40 min)

In [`homework-project/`](homework-project/) there is a small Python web
service with a deliberately terrible Dockerfile. Everything wrong with it is
something we covered today.

```bash
cd ~/projects/docker-training/day2-images/homework-project
cat Dockerfile
```

### Step 1 — baseline

```bash
time docker build -t hw:before .
docker images hw:before --format '{{.Size}}'
docker run -d --name hw -p 5000:5000 hw:before
curl localhost:5000/
docker rm -f hw
```

Record:

| | Before |
|---|---|
| Image size | |
| Cold build time | |
| Rebuild after a one-line change to `app.py` | |
| UID the process runs as (`curl localhost:5000/whoami`) | |

### Step 2 — find the problems

There are **at least eight**. Write them down before you start fixing. For each
one, note *which* of today's rules it breaks.

Two hints, because two of them are easy to miss:

- One problem is not in the Dockerfile at all — it is a file that should exist
  next to it and does not.
- One problem is invisible until you run `docker stop` and count the seconds.

### Step 3 — fix it

Write `Dockerfile.fixed`. Targets:

- **Image size: at least 60% smaller**
- **Rebuild after a one-line source change: at least 50% faster**
- **Process runs as non-root**
- **The service still works** — `curl localhost:5000/` returns the same thing

### Step 4 — prove it

```bash
time docker build -f Dockerfile.fixed -t hw:after .
docker images 'hw' --format '{{.Tag}}\t{{.Size}}'
docker run -d --name hw -p 5000:5000 hw:after
curl localhost:5000/
curl localhost:5000/whoami
docker rm -f hw
```

Fill in the After column and calculate the percentages.

### Hand in

1. Your `Dockerfile.fixed` (and any file you added alongside it)
2. The before/after table with real numbers
3. Your list of problems, each with one sentence on why it is a problem

> A fixed Dockerfile with no numbers does not count. Measuring is half the
> skill — a change you cannot measure is a change you cannot defend in review.

The reference solution is in
[`labs/solutions/day2-homework/`](../labs/solutions/day2-homework/). **Look
only after you have your own numbers.**

---

## Part 2 — Online labs (20 min)

From [ONLINE-LABS.md](../ONLINE-LABS.md), KodeKloud **Docker Training Course
for the Absolute Beginner**:

- Module 4 — *Docker Images*
- Module 8 — *Docker Registry*

Module 8 covers pushing to a registry, which we did not do in class. It is the
step that turns "it builds on my machine" into "the team can run it".

---

## Part 3 — One question to think about

Not to hand in.

Today you made an image 85% smaller and left the compiler behind. Tomorrow's
topic is data that must **survive** the container.

Given what you now know about layers — **why can a database not simply write to
the container's writable layer?** What exactly goes wrong? Come with an answer;
we will compare it to the real one.
