# Debug Exam

**30 minutes. Individual. Open book — you may use any course material.**

This directory contains a Compose stack with **six defects**. Find them, fix
them, and write down what each one was.

Instructions and marking: [ASSESSMENT.md](../../ASSESSMENT.md#part-3--debug-exam-30-points).

```bash
cd ~/projects/docker-training/day5-compose-capstone/debug-exam
docker compose up -d --build
docker compose ps
```

Start by finding out what is *not* running, and why.

> **Do not rewrite the file from scratch.** One of the six defects produces no
> runtime symptom at all — a rewrite will pass every test and still miss it.
> The exam is about reading an unfamiliar file, which is what you will do far
> more often than writing a new one.

Clean up when you are done:

```bash
docker compose down -v
```
