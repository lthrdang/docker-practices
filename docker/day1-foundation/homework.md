# Day 1 Homework

**Time:** ~45 minutes. Bring your written answer to Day 2 — we start by
comparing them.

---

## Part 1 — Written (30 min)

Describe, in your own words, **everything that happens between typing
`docker run -d -p 8080:80 nginx` and nginx answering a request from your
Windows browser.**

Aim for 300–500 words. Cover at least:

1. Which program receives the command, and which program does the work
2. What happens if the image is not on your machine yet
3. What gets created: namespaces, cgroups, the writable layer
4. Which process becomes PID 1 inside the container
5. What `-p 8080:80` sets up, and which side is which
6. How a request travels from the Windows browser to the process inside the
   container — **name every hop**, including WSL2

Point 6 is the one that matters most. If you cannot describe the hops yet, say
so explicitly and write what you think happens — you will find out on Day 4 and
we will compare it to what you wrote.

**Do not paste an AI-generated answer.** The exercise is finding out where your
own model is fuzzy. A wrong answer you wrote yourself is worth more here than a
correct one you did not.

---

## Part 2 — Online labs (15 min)

From [ONLINE-LABS.md](../ONLINE-LABS.md):

- KodeKloud **Docker Training Course for the Absolute Beginner**, modules 2 and
  3 (*Docker Commands*, *Docker Run Commands*) including their labs

You have seen most of this today. Treat it as a speed run — if a section feels
obvious, skip ahead. If one does not, that is your gap for tomorrow.

---

## Part 3 — Two questions to think about

Not to hand in. To arrive with an opinion on.

**A.** Today you saw a container lose all its data on `docker rm`. Before we
cover the answer on Day 3 — how would *you* design a way to keep a database's
files? What would have to be true about where those files live?

**B.** Today, two containers you started were each able to listen on port 80
without conflicting. On your laptop, two programs cannot both bind port 80.
Why can containers?

---

## Optional — if you want more

```bash
docker run --rm -it alpine sh
```

Inside, explore what a minimal Linux actually contains:

```sh
ls /bin | wc -l      # how many commands exist at all?
cat /etc/os-release
apk list --installed | wc -l
du -sh /
```

Compare to your WSL2 Ubuntu. **Alpine is roughly 8 MB.** Ask yourself what got
left out, and what that costs you — Day 2 makes that trade-off a real decision.
