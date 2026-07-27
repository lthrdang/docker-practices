# Day 3 Homework

**Time:** ~50 minutes. Bring your fixed file and your written justification to
Day 4.

---

## Part 1 — Fix a stack that loses its data (30 min)

[`homework-project/`](homework-project/) contains a small stack with **four
storage-related problems**. Three lose data or break a feature; one is
something you would fail in code review.

```bash
cd ~/projects/docker-training/day3-volumes/homework-project
cat compose.yaml
```

> You have not been taught Compose yet — that is Day 5. You do not need it. The
> `volumes:` entries under each service are the same `source:destination` pairs
> you have been typing after `-v` all day, and `depends_on` means "start that
> one first". Read it that way.

### Step 1 — run it and watch it fail

```bash
docker compose up -d
sleep 8
docker compose ps
curl -s localhost:8080/health
```

**Something is not running.** Find out what and why:

```bash
docker compose logs api | tail -20
```

That error should look extremely familiar from this afternoon. **Fix that one
first** — nothing else is testable until the API starts.

Once `/health` answers, keep going:

```bash
# Does data survive a redeploy?
curl -s -X POST -H 'content-type: application/json' -d '{"name":"alice"}' localhost:8080/users
curl -s localhost:8080/users
docker compose down
docker compose up -d
sleep 8
curl -s localhost:8080/users

# What user is the API running as?
curl -s localhost:8080/whoami

# Does the worker's output reach the API?
curl -s -X POST -H 'content-type: application/json' -d '{"message":"test"}' localhost:8080/jobs
sleep 2
docker compose logs worker | tail -3
curl -s localhost:8080/files
```

### Step 2 — name the four problems

For each: what is wrong, which rule it breaks, and what the symptom is.

Two hints:

- One problem stops a container from starting at all.
- One is not about volumes — it is about who the process runs as, and someone
  has left a comment admitting they took the easy way out.

### Step 3 — fix it

Edit `compose.yaml`. When you are done, this must pass:

```bash
docker compose down -v          # -v deletes volumes: a genuinely clean slate
docker compose up -d
sleep 8
curl -s -X POST -H 'content-type: application/json' -d '{"name":"alice"}' localhost:8080/users
docker compose down             # note: NO -v
docker compose up -d
sleep 8
curl -s localhost:8080/users    # alice must still be here
curl -s localhost:8080/whoami   # uid must not be 0
curl -s -X POST -H 'content-type: application/json' -d '{"message":"test"}' localhost:8080/jobs
sleep 2
curl -s localhost:8080/files    # must list the file the worker wrote
```

```bash
docker compose down -v
```

### Hand in

1. Your fixed `compose.yaml`
2. For **each of the four**: the problem, the rule it broke, the symptom, your fix
3. A short paragraph answering: **for each of the three kinds of data in this
   stack — database files, worker output files, application source code — which
   mount type did you choose and why?** That question is the actual point of
   the homework.

Reference solution:
[`labs/solutions/day3-homework/`](../labs/solutions/day3-homework/). Look after
you have your own answer.

---

## Part 2 — Online lab (15 min)

From [ONLINE-LABS.md](../ONLINE-LABS.md), KodeKloud **Docker Training Course
for the Absolute Beginner**:

- Module 6 — *Docker Engine & Storage*

It covers storage drivers and the layered filesystem from a different angle
than we did. Worth the different framing.

---

## Part 3 — One question to think about

Not to hand in.

Today, two containers exchanged data through a shared volume with no network
involved. Tomorrow is the network.

**Before we cover it:** when container A wants to reach container B, it uses
`http://b:3000`. Where does the name `b` come from? Nothing in your code, your
image, or your `/etc/hosts` defines it. **Who answers that lookup, and what
would have to exist for it to work?**

Write down your guess. We will check it against reality in the first ten
minutes tomorrow.
