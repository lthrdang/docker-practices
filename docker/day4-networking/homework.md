# Day 4 Homework

**Time:** ~45 minutes. Bring your diagram to Day 5 — we build exactly this
system in Compose tomorrow, and you will be checking your own drawing against
what Compose produces.

---

## Part 1 — Draw the system (25 min)

**By hand, on paper.** Not a diagramming tool. The point is to force yourself to
decide where each line goes rather than letting a tool arrange it.

The system:

| Service | Notes |
|---|---|
| `nginx` | reverse proxy, the only service reachable from outside |
| `api` | Node.js, port 3000 |
| `postgres` | port 5432, must not be reachable from outside |
| `redis` | port 6379, must not be reachable from outside |
| `worker` | Python, consumes jobs from Redis, writes to a shared volume |

Your drawing must show:

1. **Networks** — how many, which containers on which. Justify the number.
2. **Which container is on more than one network**, and why it has to be.
3. **The published port** — exactly one, with both numbers.
4. **Every name that gets resolved**, and by whom. (`api` calls `postgres` —
   draw that as a labelled arrow.)
5. **The shared volume** between worker and api — drawn differently from the
   network arrows, because it is a different mechanism.
6. **The four hops** from the Windows browser to a Postgres query, numbered.

---

## Part 2 — Written (15 min)

Answer using your own diagram.

**A.** A colleague says: "Just publish Postgres with `-p 5432:5432` so I can
connect with a GUI client." What do you say? Give the risk, and give them a way
to do what they want that you would be comfortable with.

**B.** The API needs to call an external payment API on the internet. Does that
change your network design? Which network does the outbound traffic leave from,
and what would `internal: true` do to it?

**C.** For each of these symptoms, name the most likely cause and the **first**
command you would run:

1. `getaddrinfo ENOTFOUND postgres`
2. `connect ECONNREFUSED 172.18.0.5:5432`
3. `curl localhost:8080` times out from Windows but works from WSL2
4. `docker ps` shows `0.0.0.0:8080->3000/tcp` and `curl localhost:8080` still fails

**D.** You run `docker compose up --scale api=3`. nginx keeps sending every
request to the same replica. Nothing is wrong with Docker's DNS. **What is
wrong, and where is the fix?**

<details>
<summary>Where to look if you are stuck on D</summary>

[`labs/nginx/default.conf`](../labs/nginx/default.conf) — read the comment
above the `resolver` line.
</details>

---

## Part 3 — Online lab (10 min)

From [ONLINE-LABS.md](../ONLINE-LABS.md), KodeKloud **Docker Training Course
for the Absolute Beginner**:

- Module 7 — *Docker Networking*

Shorter than today. Treat it as a check that nothing is missing.

---

## Part 4 — One question to think about

Not to hand in.

Today you started five containers with five `docker run` commands, each with
its own flags, in an order that mattered, and you had to create the networks
first. Tomorrow that becomes one file and one command.

**Before we get there:** you started Postgres, then immediately started the
API. Sometimes `/ready` reported Postgres as unreachable for the first few
seconds, then started working.

**Why?** And what would you want a tool to do about it — bearing in mind that
"wait 5 seconds" is a guess, not a solution?
