# Worker image.
#
# Deliberately simpler than the API's Dockerfile -- a single stage. Not every
# image needs multi-stage: this one installs a pure-Python dependency and has
# no build toolchain to discard. Reach for multi-stage when there is genuinely
# something to leave behind, not as a reflex.

FROM python:3.13-alpine

# PYTHONUNBUFFERED: without it, Python buffers stdout when it is not a TTY, so
# `docker logs` shows nothing until the buffer flushes -- and a crashed
# container may lose its last output entirely. In containers, stdout IS the log
# transport. Never buffer it.
#
# PYTHONDONTWRITEBYTECODE: .pyc files are useless in an immutable image and
# only add layer weight.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Same cache-ordering rule as the API: manifest first, install, then source.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY worker.py ./

# Create an unprivileged user. Unlike node:alpine, the python image does not
# ship one, so we make it -- with an explicit UID so Day 3's file-ownership
# exercise has a known number to reason about.
RUN adduser -D -u 1000 worker \
    && mkdir -p /data \
    && chown worker:worker /data
USER worker

# Exec form: the Python process becomes PID 1 and receives SIGTERM directly,
# which is why worker.py's signal handler works at all.
CMD ["python", "worker.py"]
