# Docker & Compose fresher training — COMPLETE

**Finished 2026-07-27.** Plan: `/Users/luther/.claude/plans/snuggly-growing-moore.md`

Everything in the plan is built and verified. **One task remains for a human:
the WSL2 dry-run** (see the bottom of this file).

---

## What exists

`docker/` — 28 markdown files (~43,000 words) + 36 lab files.

| | |
|---|---|
| **Entry** | `README.md` · `SETUP.md` · `WSL2-NOTES.md` · `ONLINE-LABS.md` |
| **Day 1** Foundations | README + lab + homework |
| **Day 2** Images | README + lab + homework + `homework-project/` (bad Dockerfile) |
| **Day 3** Volumes | README + lab + homework + `homework-project/` (4 seeded defects) |
| **Day 4** Networking | README + lab + homework |
| **Day 5** Compose | README + lab + `capstone.md` + `debug-exam/` (6 seeded defects) |
| **Reference** | `CHEATSHEET.md` · `TROUBLESHOOTING.md` · `ASSESSMENT.md` (quiz + capstone/debug-exam prompts only — no answer key) |
| **Lab app** | `labs/` — Node API, Python worker, nginx, `.gitattributes` |
| **Compose** | `labs/compose/` — `01-single` → `05-final`, dev override, `.env.example` |
| **Solutions** | `instructor/solutions/` — day2, day3, capstone, debug-exam |

Assessment is 100 points: quiz 40 (30 questions, explained key) + capstone 30
(100-point rubric, scaled) + debug exam 30.

---

## Constraints honoured

- All content in **English**
- **No Docker Desktop** — Docker Engine natively inside WSL2 (licensing)
- Trainees on **Windows + WSL2, already installed**
- Browser labs = **KodeKloud** only; Play with Docker named as discontinued
- **Volumes and networking each get a full dedicated day**

---

## Verification performed (Docker 29.4.0)

- **All 9 compose files** pass `docker compose config -q`
- **Clean `--no-cache` rebuild** of both lab images, then a full 5-service
  stack: all healthy, `/ready` true, Postgres write, Redis counter, job →
  worker → shared volume → API read-back
- **Capstone acceptance test** passes every requirement: data survives
  `down`+`up`, uid 1000, one published port in the base file, nginx→postgres
  NXDOMAIN while api resolves, image 238 MB, `docker compose down` in 0.76 s
- **Debug exam** verified to fail in exactly the six designed ways, and the
  reference solution verified to fix all six
- **Day 3 homework** verified broken and its solution verified passing
- **Day 2 homework** measured before and after
- **All 28 markdown files**: every internal link resolves
- No leftover containers, networks, volumes, or stray `.env` files

### Measurements in the material are real, not estimates

| | |
|---|---|
| Lab API image | naive `node:22` **1.63 GB** → multi-stage alpine **238 MB** |
| Rebuild after 1-line change | bad layer order **3.82 s** → good **0.72 s** |
| Day 2 homework | **1.74 GB → 209 MB** (88%); rebuild **5.32 s → 1.06 s** (80%) |
| Shell form vs exec form | `docker stop` **10.16 s → 0.23 s** |
| `--scale api=3` | 9 requests split **3/3/3** with the nginx resolver fix, **9/0/0** without |

### Two findings that contradict most Docker tutorials

1. **Cross-network isolation by raw IP was NOT enforced on the authoring
   machine.** Name isolation held (NXDOMAIN); the ping by IP succeeded and the
   iptables packet counters stayed at zero. Day 4 therefore teaches name
   isolation as the reliable boundary, flags packet isolation as
   implementation-dependent, and has trainees test it themselves. **This is the
   single most important item in the dry-run.**
2. **Docker 28+ renamed the isolation chains.** `DOCKER-ISOLATION-STAGE-1/2`
   are gone, replaced by `DOCKER-FORWARD` → `DOCKER-CT` / `DOCKER-INTERNAL` /
   `DOCKER-BRIDGE` → `DOCKER`. Most tutorials still name the old ones.

Also confirmed: **Play with Docker shut down 2026-03-01**, so any curriculum
built on it is dead. `ONLINE-LABS.md` says so explicitly.

---

## The one outstanding task: the WSL2 dry-run

The material was authored on **macOS**. Everything inside a container was
executed and verified. The **WSL2↔Windows boundary** could not be, so those
claims were written from Microsoft's and Docker's official docs and tagged
`[NEEDS WSL2 DRY-RUN]` — **11 tags across 4 files**.

**Checklist: [`WSL2-DRY-RUN-CHECKLIST.md`](WSL2-DRY-RUN-CHECKLIST.md)** (moved
out of `WSL2-NOTES.md` when instructor-only material was split from
trainee-facing docs).

Run it once on a Windows machine before Day 1 — ideally by following `SETUP.md`
verbatim on a clean distro, which doubles as a rehearsal of the trainee
experience. Then delete each tag you verify.

Highest priority: **Day 4 Exercise 6** (finding #1 above) — the result changes
what Day 4 §5 and quiz answer 25 should say.

---

## Open questions for the user — resolved 2026-07-27

1. **Day 5 length** — keeping as a full ~6 hour day. No changes.
2. **WSL distro** — Ubuntu confirmed. No changes.
3. **Slide deck** — out of scope, staying that way. No changes.

---

## Notes for anyone editing this later

- **`instructor/` (this folder) is not for trainees.** It holds `PROGRESS.md`,
  `ANSWER-KEY.md` (split out of `ASSESSMENT.md`), `WSL2-DRY-RUN-CHECKLIST.md`
  (split out of `WSL2-NOTES.md`), and `solutions/`. Exclude this whole folder
  when handing the repo to trainees — everything trainee-facing lives outside
  it and has no dependency on it. Trainee-facing homework/capstone files point
  to it with "ask your instructor" instead of a direct link.
- `day2-images/homework-project/`, `day3-volumes/homework-project/` and
  `day5-compose-capstone/debug-exam/` are **deliberately broken**. Their defects
  are documented in the matching `instructor/solutions/*/README.md`.
- Solution compose files for day2/day3/debug-exam use paths relative to the
  **exercise** directory — copy them there, do not run from `solutions/`. The
  capstone solution is the exception: it runs in place from
  `instructor/solutions/capstone/`.
- `labs/compose/.env` and `instructor/solutions/capstone/.env` are gitignored;
  create them with `cp .env.example .env`.
- The API's `ensureSchema()` runs on both GET and POST `/users` on purpose, and
  `/ready` wraps each dependency check in a 3-second timeout — node-redis
  retries forever, so an unguarded `await redis.ping()` never settles and the
  endpoint hangs instead of reporting failure.
