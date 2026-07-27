# Day 1 Lab — Driving containers

**Time:** ~2 hours · **Work in:** `~/projects` (not `/mnt/c` — see [WSL2-NOTES.md](../../WSL2-NOTES.md) #1)

Type the commands. Do not paste them. You will notice more.

Where a step says **write down**, actually write it down — those are the ones
that get asked back on Day 5.

---

## Exercise 1 — Read the output of `hello-world` (10 min)

```bash
docker run hello-world
```

Read the message it prints. It describes exactly what just happened, in four
steps.

**Questions to answer in your notes:**

1. Where did the image come from? What would happen if you ran it again — would
   it download again? Test it:
   ```bash
   docker run hello-world
   ```
   Notice what is missing from the output the second time.

2. Where is the container now?
   ```bash
   docker ps
   docker ps -a
   ```
   `docker ps` shows nothing. `docker ps -a` shows two exited containers.
   **Why does `docker ps` not show them?**

3. Clean up:
   ```bash
   docker ps -aq --filter ancestor=hello-world | xargs docker rm
   ```

> **Takeaway:** a container that has exited still exists. It occupies disk and
> a name until you remove it. `docker ps` shows *running* containers; `-a`
> shows all of them. Forgetting this is how people end up with 200 dead
> containers.

---

## Exercise 2 — Foreground vs background (15 min)

```bash
docker run nginx
```

Your terminal is now stuck — nginx is running in the foreground and its logs
are printing to your screen. Press `Ctrl+C`.

Now the useful way:

```bash
docker run -d --name web nginx
```

`-d` = detached. You get the container ID back and your prompt returns.

```bash
docker ps
docker logs web
docker logs -f web        # follow, Ctrl+C to stop following
```

Open a second terminal and generate some traffic to watch the log move:

```bash
docker exec web curl -s -o /dev/null localhost && echo requested
```

Now drive the lifecycle:

```bash
docker stop web
docker ps            # gone
docker ps -a         # Exited
docker start web
docker ps            # back, same container, same ID
docker restart web
docker rm web        # fails - it is running
docker rm -f web     # force
```

**Write down:** what is the difference between `docker stop` + `docker start`,
and `docker rm` + `docker run`? Which one keeps changes made inside the
container?

> **Takeaway:** `stop`/`start` preserve the writable layer. `rm` destroys it.

---

## Exercise 3 — Three layers of "where am I" (20 min)

This is the exercise that makes the WSL2 picture concrete. You will compare the
same three commands in three places.

```bash
docker run -d --name box alpine sleep 3600
docker exec -it box sh
```

You are now inside the container. Run:

```sh
hostname
ps
ip addr
cat /etc/os-release
ls /
```

Then `exit`, and run the equivalent in **WSL2**:

```bash
hostname
ps aux | head
ip addr
cat /etc/os-release
```

And finally in **PowerShell** on Windows:

```powershell
hostname
ipconfig
```

Fill this in:

| | Container | WSL2 | Windows |
|---|---|---|---|
| `hostname` | | | |
| Number of processes | | | |
| First IP address | | | |
| OS | Alpine Linux | Ubuntu | Windows |

**Questions:**

1. The container says Alpine. WSL2 says Ubuntu. **Whose kernel is the Alpine
   container actually running on?** (Check: `docker exec box uname -r` and
   `uname -r` in WSL2. Compare them.)

2. Inside the container, `ps` shows two or three processes. In WSL2 it shows
   dozens. The container's processes *are* running in WSL2 — so why can it not
   see the others?

> **Takeaway:** same kernel, different namespaces. The Alpine "OS" is just a
> different set of files. There is no second kernel.

---

## Exercise 4 — Prove that a container is a process (15 min)

```bash
docker run -d --name proof alpine sleep 999
docker inspect proof --format '{{.State.Pid}}'
```

That prints a number — a real PID in WSL2. Look it up **in WSL2**, not in the
container:

```bash
ps -p <that number> -o pid,user,comm,args
```

You will see your `sleep 999`. Now ask the container:

```bash
docker exec proof ps
```

```
PID   USER     TIME  COMMAND
    1 root      0:00 sleep 999
```

**The same process has two different PIDs**, depending on which PID namespace
is asking. That is the whole trick.

Now kill it from the WSL2 side:

```bash
kill <that number>
docker ps -a --filter name=proof
```

The container is `Exited`. **You did not stop a container — you killed a
process, and the container ceased to exist as a consequence.** Because that is
all it ever was.

```bash
docker rm proof
```

---

## Exercise 5 — Watch a cgroup enforce a limit (15 min)

```bash
docker run --name oomtest --memory=100m alpine \
  sh -c 'dd if=/dev/zero of=/dev/shm/fill bs=1M count=500'
```

It dies partway through. Ask why:

```bash
docker inspect oomtest --format 'OOMKilled={{.State.OOMKilled}} ExitCode={{.State.ExitCode}}'
```

Expected:

```
OOMKilled=true ExitCode=137
```

**137 = 128 + 9.** By convention a process killed by signal N reports exit code
128+N, and 9 is SIGKILL. **Remember 137: it means "the kernel killed this for
using too much memory".** You will meet it on real systems, usually at 3 a.m.,
and recognising it instantly is worth a lot.

Now watch live usage:

```bash
docker rm oomtest
docker run -d --name web nginx
docker stats --no-stream
```

Note the `MEM USAGE / LIMIT` column. Then:

```bash
docker rm -f web
docker run -d --name web --memory=64m --cpus=0.5 nginx
docker stats --no-stream
```

The limit column changed. **Write down:** who enforces that limit — nginx, the
Docker daemon, or the kernel?

```bash
docker rm -f web
```

---

## Exercise 6 — Watch changes disappear (20 min)

This exercise motivates the whole of Day 3. Do not skip it.

```bash
docker run -it --name scratch ubuntu bash
```

Inside:

```bash
apt-get update && apt-get install -y cowsay
ls /usr/games/
echo "some work I did" > /root/important.txt
cat /root/important.txt
exit
```

The container has stopped, but it still exists. Start it again:

```bash
docker start -ai scratch
```

Inside:

```bash
cat /root/important.txt      # still there
ls /usr/games/               # cowsay still there
exit
```

**Stopping does not lose anything.** Now destroy it:

```bash
docker rm scratch
docker run -it --name scratch ubuntu bash
```

Inside:

```bash
cat /root/important.txt      # No such file or directory
ls /usr/games/               # empty
exit
docker rm scratch
```

**Everything is gone.** Not corrupted, not deleted — the writable layer that
held it was destroyed with the container. A brand-new container starts from the
same pristine image layers.

**Write down, in your own words:** where did `important.txt` live, and why did
`docker stop` keep it while `docker rm` did not?

> This is the problem Day 3 solves. Right now, notice how *aggressive* the
> default is: no warning, no confirmation, no recovery.

---

## Exercise 7 — Read a container's full description (15 min)

```bash
docker run -d --name web -p 8080:80 nginx
docker inspect web
```

That is a lot of JSON. Learn to query it instead of scrolling:

```bash
docker inspect web --format '{{.State.Status}}'
docker inspect web --format '{{.Config.Image}}'
docker inspect web --format '{{.NetworkSettings.IPAddress}}'
docker inspect web --format '{{json .NetworkSettings.Ports}}'
docker inspect web --format '{{.State.Pid}}'
docker inspect web --format '{{json .Mounts}}'
```

Find the answers to these in the inspect output:

1. What command does this container run as PID 1?
2. What is its IP address?
3. Which host port maps to which container port?
4. Which network is it attached to?

Check your port answer:

```bash
curl -I localhost:8080
```

Then look at the same information the short way:

```bash
docker ps
```

The `PORTS` column shows `0.0.0.0:8080->80/tcp`. **You will read this column
constantly on Day 4.** Learn it now: *host side* on the left of the arrow,
*container side* on the right.

```bash
docker rm -f web
```

---

## Exercise 8 — Tidy up and see what you accumulated (10 min)

```bash
docker ps -a
docker images
docker system df
```

`docker system df` shows what Docker is using, by category. Note the
`RECLAIMABLE` column.

Clean up just this lab's leftovers:

```bash
docker ps -aq | xargs -r docker rm -f
```

Then look at `docker system df` again.

> **Do not run `docker system prune -a` yet.** It would delete the images you
> just pulled and you would re-download them tomorrow. Housekeeping is covered
> properly on Day 5 — and [WSL2-NOTES.md](../../WSL2-NOTES.md) #4 explains why
> pruning alone will not give you your C: drive back.

---

## Done when you can

- [ ] Explain why `docker ps` and `docker ps -a` differ
- [ ] Find a container's host PID and kill it from WSL2
- [ ] Say what exit code 137 means without looking it up
- [ ] Explain where a file written inside a container lives, and when it is lost
- [ ] Read the `PORTS` column of `docker ps` and say which side is the host

→ [Homework](../homework.md)
