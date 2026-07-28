# Instructor-only material

**Do not include this folder when handing the course to trainees.** Everything
outside `instructor/` is trainee-facing and has no dependency on anything in
here — excluding this folder is the entire delivery step.

| File | What it is |
|---|---|
| [PROGRESS.md](PROGRESS.md) | Build/verification log for the course material itself |
| [ANSWER-KEY.md](ANSWER-KEY.md) | Quiz answer key + marking guide (split out of `../ASSESSMENT.md`) |
| [WSL2-DRY-RUN-CHECKLIST.md](WSL2-DRY-RUN-CHECKLIST.md) | Pre-course checklist to run once on real Windows/WSL2 (split out of `../WSL2-NOTES.md`) |
| [solutions/](solutions/) | Reference solutions for day2/day3 homework, the capstone, and the debug exam |

Trainee-facing files (`day2-images/homework.md`, `day3-volumes/homework.md`,
`day5-compose-capstone/capstone.md`) point here with "ask your instructor",
not a direct link — they still work if this folder is present, and degrade
gracefully if it isn't.
