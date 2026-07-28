# Day 2 Homework — Reference Solution

**Read this only after you have your own numbers.**

Files here:
- [`Dockerfile.fixed`](Dockerfile.fixed) — the rewritten Dockerfile, annotated
- [`.dockerignore`](.dockerignore) — the file that was missing entirely

To use them:

```bash
cd ~/projects/docker-training/day2-images/homework-project
cp ../../instructor/solutions/day2-homework/Dockerfile.fixed .
cp ../../instructor/solutions/day2-homework/.dockerignore .
docker build -f Dockerfile.fixed -t hw:after .
```

---

## The problems, and what each one costs

| # | Problem | Rule broken | Cost |
|---|---|---|---|
| 1 | `FROM python:latest` — unpinned | Pin your base | Same Dockerfile, different program next month |
| 2 | Full `python` image, not `-slim` | Minimal base | ~1.3 GB of unused toolchain |
| 3 | `apt-get install curl vim git build-essential` | Install only what runs | Hundreds of MB; every tool is also an attacker's tool |
| 4 | `apt-get update` and `install` in separate `RUN`s, no cleanup | One `RUN`, clean in the same layer | Stale cache layer, apt lists shipped |
| 5 | `ENV SECRET_KEY=...` | Never bake secrets | Readable by anyone with the image, permanently |
| 6 | `ADD . /app` | Use `COPY` | Surprising tar/URL behaviour |
| 7 | `ADD . /app` **before** `pip install` | Manifest first | Every source edit reinstalls every dependency |
| 8 | `pip install` without `--no-cache-dir` | Do not ship caches | Wasted layer weight |
| 9 | No `USER` | Run non-root | Process runs as uid 0 |
| 10 | Shell-form `CMD` | Exec form | `docker stop` takes 10 s instead of 0.2 s |
| 11 | No `.dockerignore` | Always write one | `.git`, `.env`, venvs shipped into the image |

---

## Measured results

Instructor's machine. **Your absolute numbers will differ; the ratios should
be similar.**

| | Before | After | Change |
|---|---|---|---|
| Image size | **1.74 GB** | **209 MB** | **88% smaller** |
| Cold build | 41.7 s | 10.8 s | 74% faster |
| Rebuild after one-line `app.py` change | 5.32 s | 1.06 s | **80% faster** |
| Process UID | **0 (root)** | 1000 | non-root |
| `docker stop` | **10.16 s** | **0.23 s** | 44× faster |

Targets were ≥60% smaller and ≥50% faster rebuild. Both are comfortably met.

The `docker stop` row is the one people underestimate. Ten seconds per service,
five services, every time you tear the stack down — that is a minute of your
day, every day, caused by a missing pair of brackets.

---

## The one that surprises people: Alpine is not automatically smaller

The obvious move is `FROM python:3.13-alpine`. For Python it is often the wrong
one.

Python wheels on PyPI are built against **glibc**. Alpine uses **musl**. So on
Alpine, `pip install` frequently cannot use a prebuilt wheel and compiles from
source instead — which needs `build-base`, takes far longer, and can produce a
*larger* image than `-slim`.

`python:3.13-slim` is Debian-based, glibc, and already small. For Python it is
usually the right default.

**The general lesson matters more than the specific fact: measure, do not
assume.** "Alpine is smaller" is true for many stacks and false for this one,
and the only way to know which case you are in is to build both and look.

---

## Checking your own answer

You do not need to match this file. You have a good solution if:

- [ ] Size reduced by ≥60%
- [ ] Rebuild after a source change ≥50% faster
- [ ] `curl localhost:5000/whoami` reports a non-zero uid
- [ ] `docker stop` returns in under a second
- [ ] No secret appears in `docker history --no-trunc <image>`
- [ ] A `.dockerignore` exists
- [ ] `curl localhost:5000/` still returns the original JSON

If you hit all seven by a different route, your answer is right and possibly
better. Bring it to class.
