#!/usr/bin/env bash
# Build one zip per training day for trainee distribution.
#
# Each zip is self-contained: the shared reference docs + labs/ (needed from
# Day 2 onward for build contexts) + that day's own folder. Never includes
# docker/instructor/. ASSESSMENT.md is only bundled with Day 5, since it's
# the end-of-week quiz/capstone-rubric/debug-exam doc and no earlier day
# links to it.
#
# Archive contents are flattened (no leading "docker/"), so a trainee can
# unzip each one straight into the same ~/projects/docker-training/ and get
# the layout every doc's relative links already assume.
set -euo pipefail

cd "$(dirname "$0")/docker"
OUT="${1:-../dist}"
mkdir -p "$OUT"

SHARED=(README.md SETUP.md WSL2-NOTES.md CHEATSHEET.md TROUBLESHOOTING.md ONLINE-LABS.md)
EXCLUDE=(-x '*/.env' -x '*.env' -x '*/.DS_Store' -x '**/__pycache__/*')

zip -rq "$OUT/docker-training-day1.zip" \
  "${SHARED[@]}" day1-foundation "${EXCLUDE[@]}"

zip -rq "$OUT/docker-training-day2.zip" \
  "${SHARED[@]}" labs day2-images "${EXCLUDE[@]}"

zip -rq "$OUT/docker-training-day3.zip" \
  "${SHARED[@]}" labs day3-volumes "${EXCLUDE[@]}"

zip -rq "$OUT/docker-training-day4.zip" \
  "${SHARED[@]}" labs day4-networking "${EXCLUDE[@]}"

zip -rq "$OUT/docker-training-day5.zip" \
  "${SHARED[@]}" ASSESSMENT.md labs day5-compose-capstone "${EXCLUDE[@]}"

echo "Built:"
ls -lh "$OUT"/docker-training-day*.zip
