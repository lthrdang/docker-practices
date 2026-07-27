# Docker & Docker Compose — Fresher Training

A five-day, hands-on program. By the end you will be able to containerize an
application, choose the right storage for its data, wire several containers
together over a network, and debug the whole thing when it breaks.

This course is written for **Windows + WSL2 running Docker Engine natively**.
Docker Desktop is not used anywhere (see [SETUP.md](SETUP.md) for why).

---

## Before Day 1

| Do this | Where |
|---|---|
| Install Docker Engine inside WSL2 and pass the smoke test | [SETUP.md](SETUP.md) |
| Skim the WSL2 gotchas — they will save you hours | [WSL2-NOTES.md](WSL2-NOTES.md) |
| Create a free KodeKloud account for the browser labs | [ONLINE-LABS.md](ONLINE-LABS.md) |

**Setup problems are solved before Day 1, not during it.** If `docker run hello-world`
does not work on your machine, say so in the group chat the day before.

---

## The five days

| Day | Topic | You will be able to | Length |
|---|---|---|---|
| **1** | [Foundations](day1-foundation/) | Explain what a container actually is, and drive its lifecycle | 3.5h |
| **2** | [Images & Dockerfiles](day2-images/) | Write a fast, small, secure Dockerfile | 3.5h |
| **3** | [Volumes & persistent data](day3-volumes/) | Choose the right mount type and predict what a mount does | 3.5h |
| **4** | [Networking](day4-networking/) | Make containers talk to each other — and diagnose it when they don't | 3.5h |
| **5** | [Compose & capstone](day5-compose-capstone/) | Run and debug a real multi-container system | 6h |

Days 3 and 4 are the deep dives. They are the two things freshers are most often
missing on a real project, and they are where the exercises get hardest.

---

## How each day is structured

```
15 min   Warm-up in a browser lab (KodeKloud) — no setup, gets the room moving
75 min   Theory + live demo
120 min  Hands-on lab on your own machine
         Homework
```

The browser labs are for warm-ups and homework. **The real learning happens in
the labs on your own machine**, because the environment you have to debug at
work is your own machine — not a clean sandbox.

---

## Reference material (use these all week)

| File | Use it when |
|---|---|
| [CHEATSHEET.md](CHEATSHEET.md) | You know what you want to do but forgot the flag |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Something broke and the error message is unhelpful |
| [WSL2-NOTES.md](WSL2-NOTES.md) | It works for everyone else but not on your machine |
| [ONLINE-LABS.md](ONLINE-LABS.md) | You want extra practice |
| [ASSESSMENT.md](ASSESSMENT.md) | End of the week: quiz, capstone rubric, debugging exam |

---

## The lab application

Everything is built around one small system, introduced piece by piece:

```
Windows browser
      |
   nginx  (reverse proxy)
      |
    api  (Node.js / Express)
     /  \
postgres  redis
             \
            worker  (Python)
```

The application code lives in [labs/](labs/) and is deliberately tiny — about
fifty lines per service. **You are here to learn Docker, not to read someone
else's business logic.** Every file is short enough to read in full.

---

## Ground rules

1. **Type the commands.** Do not copy-paste the lab steps. The muscle memory is
   part of the point, and you will notice more when you type.
2. **Read the error before asking.** Most Docker errors say exactly what is
   wrong. The skill being trained is reading them.
3. **Break things on purpose.** Several labs ask you to make something fail
   first. Do not skip those steps — recognizing a failure mode is worth more
   than avoiding it once.
4. **Write down what you observe.** Several labs ask you to record numbers or
   state a rule in your own words. Do it; it is how the rule sticks.

---

## A note on your environment

You are running a real Linux kernel in WSL2 with Docker Engine installed
directly inside it. This is a **better** learning setup than a Mac, where the
same internals are hidden behind an opaque VM. When Day 4 says "look at the
veth interface", you can genuinely look at it.

Where WSL2 behaves differently from plain Linux, the material says so
explicitly rather than pretending the difference does not exist.
