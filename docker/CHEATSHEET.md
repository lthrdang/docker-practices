# Docker Cheatsheet

For when you know what you want and forgot the flag. Grouped by what you are
trying to do, not alphabetically.

Written for **Docker Engine on WSL2** — every command runs in the WSL terminal,
not PowerShell.

---

## Containers

```bash
docker run IMAGE                     # create + start
docker run -d IMAGE                  # detached (background)
docker run -it IMAGE sh              # interactive shell
docker run --rm IMAGE                # delete when it exits
docker run --name web IMAGE          # give it a name
docker run -p 8080:3000 IMAGE        # publish HOST:CONTAINER
docker run -e KEY=value IMAGE        # environment variable
docker run --env-file .env IMAGE     # environment from a file
docker run -v vol:/path IMAGE        # mount a volume
docker run --network mynet IMAGE     # attach to a network
docker run --user 1000:1000 IMAGE    # run as a specific uid:gid
docker run --memory=512m --cpus=1 IMAGE
docker run --restart unless-stopped IMAGE
docker run IMAGE CMD ARGS            # override the image's CMD
```

```bash
docker ps                            # running
docker ps -a                         # including stopped
docker ps -q                         # IDs only (for piping)
docker ps --filter name=web
docker ps --format '{{.Names}}\t{{.Status}}\t{{.Ports}}'

docker start|stop|restart|pause|unpause NAME
docker rm NAME                       # remove (must be stopped)
docker rm -f NAME                    # force
docker rm -f $(docker ps -aq)        # remove everything -- careful

docker logs NAME
docker logs -f NAME                  # follow
docker logs --tail=50 --timestamps NAME

docker exec -it NAME sh              # shell into a running container
docker exec NAME env                 # run one command
docker exec -u root NAME sh          # as root, e.g. to install a tool

docker stats                         # live CPU/memory
docker stats --no-stream             # one snapshot
docker top NAME                      # processes inside
docker cp NAME:/path/file ./file     # copy out
docker cp ./file NAME:/path/file     # copy in
docker wait NAME                     # block until exit, print exit code
docker port NAME                     # published ports
```

### Inspect without drowning in JSON

```bash
docker inspect NAME                                          # everything
docker inspect NAME --format '{{.State.Status}}'
docker inspect NAME --format '{{.State.Pid}}'                # host PID
docker inspect NAME --format '{{.State.ExitCode}}'
docker inspect NAME --format '{{.State.OOMKilled}}'
docker inspect NAME --format '{{.Config.Image}}'
docker inspect NAME --format '{{json .NetworkSettings.Ports}}'
docker inspect NAME --format '{{json .Mounts}}'
docker inspect NAME --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{$v.IPAddress}}{{end}}'
docker inspect NAME --format '{{json .State.Health}}'
```

---

## Images

```bash
docker build -t name:tag .
docker build -t name:tag -f Dockerfile.dev .
docker build --no-cache -t name:tag .
docker build --target build -t name:tag .     # stop at a named stage
docker build --build-arg VERSION=22 -t name:tag .

docker images
docker images --format '{{.Repository}}:{{.Tag}}\t{{.Size}}'
docker history IMAGE                          # layers and their sizes
docker history --no-trunc IMAGE               # full commands -- finds baked secrets
docker tag src:tag registry/dst:tag
docker pull IMAGE
docker push registry/name:tag
docker rmi IMAGE
docker image prune                            # dangling only
docker image prune -a                         # every unused image
docker save IMAGE > image.tar                 # export
docker load < image.tar                       # import
docker image inspect IMAGE --format '{{.Config.Volumes}}'      # declared VOLUMEs
docker image inspect IMAGE --format '{{.Config.ExposedPorts}}' # declared EXPOSEs
docker image inspect IMAGE --format '{{json .Config.Env}}'     # baked env -- check for secrets
```

---

## Volumes

```bash
docker volume create NAME
docker volume ls
docker volume ls -qf dangling=true            # attached to nothing
docker volume inspect NAME
docker volume inspect NAME --format '{{.Mountpoint}}'
docker volume rm NAME
docker volume prune                           # DELETES DATA -- ls first
```

### Mount syntax

```bash
-v myvol:/data                                # named volume
-v /home/me/src:/app                          # bind mount
-v /home/me/src:/app:ro                       # read-only
-v /app/node_modules                          # anonymous -- the shield
--tmpfs /tmp/cache:size=64m                   # RAM only

--mount type=volume,src=myvol,dst=/data
--mount type=bind,src=/home/me/src,dst=/app,readonly
--mount type=tmpfs,dst=/tmp/cache
```

**`--mount` errors on a missing host path; `-v` silently creates it.** Use
`--mount` when it matters.

### Backup / restore

```bash
docker run --rm -v myvol:/data:ro -v "$PWD":/backup alpine \
  tar czf /backup/myvol.tar.gz -C /data .

docker run --rm -v myvol:/data -v "$PWD":/backup alpine \
  tar xzf /backup/myvol.tar.gz -C /data
```

Stop the writer first — a tar of a live database is a snapshot mid-write.

---

## Networks

```bash
docker network create mynet
docker network ls
docker network inspect mynet
docker network inspect mynet --format '{{range .IPAM.Config}}{{.Subnet}} {{.Gateway}}{{end}}'
docker network inspect mynet --format '{{range .Containers}}{{.Name}} {{.IPv4Address}}{{"\n"}}{{end}}'
docker network connect mynet NAME
docker network disconnect mynet NAME
docker network rm mynet
docker network prune
```

```bash
--network mynet                               # attach at run time
--network-alias db                            # an extra DNS name
--network host                                # no isolation (= the WSL2 VM)
--network none                                # no networking
--network container:other                     # share another container's stack
--add-host=host.docker.internal:host-gateway  # reach the host (no Docker Desktop)
```

### Diagnose from inside

```bash
docker exec c cat /etc/resolv.conf    # 127.0.0.11 on a user-defined network
docker exec c cat /etc/hosts
docker exec c ip addr
docker exec c nslookup other-service
docker exec c ss -tln                 # what is it ACTUALLY listening on?
```

### Diagnose with a toolbox

```bash
docker run -it --rm --network container:api nicolaka/netshoot
# inside: dig, curl, tcpdump, nmap, ss, ping, traceroute
```

### From WSL2 itself

```bash
ip link show type bridge              # one bridge per Docker network
ip link | grep veth                   # one veth per running container
bridge link
sudo iptables -t nat -L DOCKER -n     # the published-port DNAT rules
sudo iptables -L DOCKER-FORWARD -n -v # Docker 28+; older: DOCKER-ISOLATION-STAGE-1
```

---

## Compose

```bash
docker compose up -d                  # create and start
docker compose up -d --build          # rebuild first
docker compose up                     # foreground -- watch startup ordering
docker compose up -d --scale api=3
docker compose up -d --force-recreate api

docker compose ps
docker compose logs -f api
docker compose logs --tail=50
docker compose exec api sh
docker compose run --rm api npm test  # one-off, then delete
docker compose restart api
docker compose build
docker compose pull

docker compose stop                   # stop, keep containers
docker compose down                   # remove containers + networks, KEEP volumes
docker compose down -v                # ...and DELETE volumes
docker compose config                 # print the fully resolved file
docker compose config --services
docker compose top

docker compose -f other.yaml up -d
docker compose -f base.yaml -f override.yaml up -d
docker compose -p myproject up -d     # explicit project name
docker compose --profile debug up -d
```

**`docker compose config` first, whenever something is not what you expected.**

### Compose file shape

```yaml
services:
  api:
    build: ./app                        # or: image: postgres:17-alpine
    ports: ["8080:3000"]                # HOST:CONTAINER
    environment:
      KEY: value
      FROM_ENV: ${VAR}
    env_file: [.env.app]
    volumes:
      - named-vol:/data
      - ./src:/app
      - /app/node_modules               # the shield
    networks: [frontend, backend]
    depends_on:
      postgres:
        condition: service_healthy      # not just service_started
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
      interval: 5s
      timeout: 3s
      retries: 5
      start_period: 10s
    restart: unless-stopped

volumes:
  named-vol:

networks:
  frontend:
  backend:
    internal: true                      # no route to the internet
```

---

## Housekeeping

```bash
docker system df                      # what is using space
docker system df -v                   # per image / container / volume
docker system prune                   # dangling images, stopped containers, unused networks
docker system prune -a                # + every image not used by a running container
docker builder prune                  # build cache -- often the biggest surprise
docker volume prune                   # DELETES DATA
```

**On WSL2, pruning frees space inside the `ext4.vhdx` but does not shrink the
file.** See [WSL2-NOTES.md](WSL2-NOTES.md) #4:

```powershell
wsl --shutdown
wsl --manage <distro> --set-sparse true
```

---

## Dockerfile

```dockerfile
FROM node:22-alpine AS build     # pin the version, minimal base
WORKDIR /app
COPY package.json ./             # manifest first...
RUN npm install --omit=dev       # ...so this stays cached
COPY server.js ./                # source last

FROM node:22-alpine AS runtime   # multi-stage: leave the toolchain behind
RUN apk add --no-cache tini
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/server.js ./
USER node                        # non-root
EXPOSE 3000                      # documentation only -- publishes nothing
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]        # EXEC FORM -- a JSON array
```

| | |
|---|---|
| `COPY` vs `ADD` | Use `COPY`. `ADD` also untars and downloads — surprising. |
| `CMD` vs `ENTRYPOINT` | `CMD` is replaced by run-time args; `ENTRYPOINT` has them appended. |
| Exec vs shell form | Exec form (`["a","b"]`) makes your process PID 1 so signals arrive. Shell form costs you 10 s on every `docker stop`. |
| `ENV` / `ARG` | Neither is a secret store. Both are visible in `docker history`. |
| Cleanup | Must be in the **same** `RUN` as what it cleans, or it frees nothing. |

Always write a `.dockerignore` at the same time:

```
node_modules
.git
.env
*.md
Dockerfile*
```

---

## Numbers worth memorising

| | |
|---|---|
| **127.0.0.11** | Docker's embedded DNS, on user-defined networks only |
| **Exit 137** | 128 + 9 (SIGKILL) — usually the OOM killer, or a `docker stop` timeout |
| **Exit 143** | 128 + 15 (SIGTERM) — a clean stop |
| **10 seconds** | `docker stop` grace period before SIGKILL |
| **0.0.0.0** | What a containerised app must bind. `127.0.0.1` makes it unreachable. |

---

## The four causes of "A cannot reach B"

| # | Cause | Symptom | Check |
|---|---|---|---|
| 1 | Different networks / default bridge | Name does not resolve | `docker exec a nslookup b` |
| 2 | Wrong name | Name does not resolve | `docker network inspect NET` |
| 3 | Wrong port | Resolves, connection refused | `docker exec b ss -tln` |
| 4 | Bound to `127.0.0.1` | Works inside b, refused from a | `docker exec b curl localhost:PORT` |
| 5 | B is not ready yet | Works on retry | `docker logs b` → healthchecks |

## The four hops on WSL2

```
Windows browser → [WSL2 localhost forwarding] → WSL2 → [Docker DNAT -p] →
container → [Docker DNS] → other container
```

Test the innermost first; the break is at the next hop out.

```bash
docker exec api curl -s localhost:3000/health      # is the app alive?
docker exec nginx curl -s http://api:3000/health   # DNS + connectivity
curl localhost:8080/health                         # publishing (from WSL2)
# then the Windows browser                         # WSL2 forwarding
```

---

See also: [TROUBLESHOOTING.md](TROUBLESHOOTING.md) ·
[WSL2-NOTES.md](WSL2-NOTES.md)
