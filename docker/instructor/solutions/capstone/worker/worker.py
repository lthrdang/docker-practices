"""Minimal job worker for the Docker training labs.

Demonstrates the two ways containers interact:

  1. Over the NETWORK  -- it blocks on a Redis list that the API pushes to.
  2. Over a SHARED VOLUME -- it writes result files that the API reads back.

Neither container knows anything about the other's language, runtime, or IP.
That is the point.
"""

import json
import os
import signal
import socket
import sys
import time
from datetime import datetime, timezone

import redis

# "redis" is a service name, not a hostname you configured anywhere. Docker's
# embedded DNS resolves it on a user-defined network -- see Day 4.
REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379")
DATA_DIR = os.environ.get("DATA_DIR", "/data")
QUEUE = "jobs"

running = True


def stop(signum, _frame):
    """Docker sends SIGTERM on `docker stop`. Exit cleanly instead of being
    killed after the 10-second grace period."""
    global running
    print(f"received signal {signum}, finishing current job then exiting", flush=True)
    running = False


signal.signal(signal.SIGTERM, stop)
signal.signal(signal.SIGINT, stop)


def connect():
    """Retry rather than crash-loop.

    A worker that dies because its dependency was not ready yet is a worker
    that needs a supervisor to keep restarting it. Retrying here is simpler and
    honest about the fact that startup order is not guaranteed. Day 5 shows the
    other half of the answer: healthchecks and `condition: service_healthy`.
    """
    delay = 1
    while running:
        try:
            client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
            client.ping()
            print(f"connected to {REDIS_URL}", flush=True)
            return client
        except redis.exceptions.RedisError as err:
            print(f"redis not ready ({err}); retrying in {delay}s", flush=True)
            time.sleep(delay)
            delay = min(delay * 2, 10)
    return None


def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    print(
        f"worker starting: host={socket.gethostname()} uid={os.getuid()} data_dir={DATA_DIR}",
        flush=True,
    )

    client = connect()
    if client is None:
        return 0

    processed = 0
    while running:
        try:
            # Block for 2s at a time rather than forever, so SIGTERM is noticed
            # promptly. A worker that ignores SIGTERM for 30 seconds makes every
            # `docker compose down` take 30 seconds.
            item = client.brpop(QUEUE, timeout=2)
        except redis.exceptions.RedisError as err:
            print(f"lost redis ({err}); reconnecting", flush=True)
            client = connect()
            continue

        if item is None:
            continue

        _, payload = item
        try:
            job = json.loads(payload)
        except json.JSONDecodeError:
            job = {"message": payload}

        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%f")
        path = os.path.join(DATA_DIR, f"job-{stamp}.txt")

        # This write is the whole point of the shared volume. The API will read
        # this file back through GET /files -- with no network call between the
        # two containers.
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(
                f"processed by : {socket.gethostname()}\n"
                f"at           : {datetime.now(timezone.utc).isoformat()}\n"
                f"message      : {job.get('message', '')}\n"
            )

        processed += 1
        print(f"processed job -> {path} (total {processed})", flush=True)

    print(f"stopped after {processed} jobs", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
