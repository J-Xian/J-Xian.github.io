# Planning — Grafana RCE → Container Foothold → Root via Cron (Lab)

**Date:** 2025-10-16

---

## TL;DR

Discovered a Grafana virtual host (`grafana.planning.htb`) via host‑header fuzzing. Using lab‑provided Grafana credentials and an in‑lab Grafana SQL‑expression RCE PoC, I obtained a shell inside the Grafana container, recovered internal credentials and a cron/backup password, used those credentials to reach an internal admin UI on `127.0.0.1:8000` (via SSH port‑forward), and escalated to **root** by abusing a cron job that executed web‑writable content. All actions were performed on a retired HackTheBox VM in an isolated lab. PoC artifacts are sanitized.

---

## Scope & permission

This work was performed on a **retired HackTheBox machine** in a lab I control. All commands and artifacts in this document are sanitized for public release. **Do not run exploit code against third‑party or production systems.**

---

## Environment & notable findings

* **Target:** `TARGET_IP` (`planning.htb`) — lab IP used during testing
* **Services discovered (sanitized):**

  * SSH — OpenSSH 9.6p1 (port 22)
  * HTTP — nginx 1.24.0 (port 80)
  * Grafana web UI reachable at `grafana.planning.htb` (Grafana v11.0.0)
  * Internal services bound to `127.0.0.1` inside the host/container: `8000`, `3000`, `3306`, etc.
* **Container evidence:** environment `HOSTNAME` appeared to be a container ID

---

## Tools used

`nmap`, `ffuf`, web browser, `nc` (listener), and standard SSH/shell utilities. The Grafana SQL‑expression RCE PoC was executed in‑lab and is not published here; all exploit steps were performed in an isolated testing environment.

---

## Chain summary (short)

1. `nmap` → discovered HTTP (nginx) and host `planning.htb`.
2. Host‑header fuzzing with `ffuf` → discovered `grafana.planning.htb`.
3. Add `/etc/hosts` entry → open the Grafana web UI.
4. Login to Grafana (lab credentials) → identified Grafana v11.0.0.
5. Execute in‑lab Grafana SQL‑expression RCE PoC → interactive shell inside the Grafana container.
6. `env` revealed `GF_SECURITY_ADMIN_USER` and `GF_SECURITY_ADMIN_PASSWORD`.
7. SSH to host as recovered user (`enzo`) → captured `user.txt`.
8. `netstat`/`ss` → internal services on `127.0.0.1:8000` (admin UI).
9. SSH local port‑forward (`ssh -L 8000:127.0.0.1:8000 enzo@TARGET`) → access internal admin UI locally.
10. Found `crontab.db` → backup job with an `@daily` schedule and a backup password.
11. Authenticate to internal UI with backup/root credential → obtain admin access.
12. Abuse cron/web‑writable input (lab) → `chmod u+s /bin/bash` → `bash -p` → root and `root.txt`.

---

## Detailed, reproducible (sanitized) steps

### 1) Port scan

```bash
nmap -sCV -T4 --open --stats-every 5s -oA recon TARGET_IP
```

**Observed:** open ports `22` (SSH) and `80` (HTTP). The HTTP response indicated `planning.htb` as the host.

### 2) Add initial host mapping (resolve `planning.htb` locally)

```bash
echo "TARGET_IP planning.htb" | sudo tee -a /etc/hosts
```

This allows opening `http://planning.htb` from your browser.

### 3) Virtual‑host (vhost) discovery — found `grafana.planning.htb`

I ran host‑header fuzzing with `ffuf`, filtering noise and identical responses; the run produced `grafana.planning.htb`:

```bash
ffuf -w /usr/share/seclists/Discovery/DNS/bitquark-subdomains-top100000.txt \
     -H 'Host: FUZZ.planning.htb' \
     -u http://planning.htb -c -fs 178
```

After finding the vhost, add it to `/etc/hosts`:

```bash
echo "TARGET_IP grafana.planning.htb" | sudo tee -a /etc/hosts
```

Now `http://grafana.planning.htb` is reachable.

### 4) Access Grafana & identify version

Opened `http://grafana.planning.htb` in the browser and observed the Grafana login page. Version reported: **Grafana v11.0.0**.

### 5) Login with provided/lab credentials

Logged in using the lab‑provided account:

* **Username:** `admin`
* **Password:** `<GRAFANA_ADMIN_PASS>` (redacted for publication)

### 6) Researched vulnerability (high level)

From the Grafana version information I researched known vulnerabilities and located an in‑lab PoC for the Grafana SQL‑expression RCE. I executed the PoC in‑lab while a local listener (ATTACKER_IP:PORT) awaited the reverse shell.

### 7) Obtained shell in Grafana container

The PoC produced an interactive shell inside the Grafana container. Within that shell:

* `pwd` showed `/usr/share/grafana` (container context)
* `env` revealed:

  * `HOSTNAME=7ce659d667d7` (container‑like hostname)
  * `GF_SECURITY_ADMIN_USER=enzo`
  * `GF_SECURITY_ADMIN_PASSWORD=<REDACTED_GRAFANA_ENV_PASS>`

The presence of a container‑style `HOSTNAME` and the filesystem layout indicated a containerized Grafana service.

### 8) Test SSH access with recovered credentials

Using the discovered credentials (`enzo` + `<REDACTED_GRAFANA_ENV_PASS>`):

```bash
ssh enzo@TARGET_IP
# password: <REDACTED_GRAFANA_ENV_PASS>
```

Authentication succeeded and I retrieved `user.txt` on the host.

### 9) Enumerated local services (inside host/container)

I inspected listening services to find internal admin panels:

```bash
netstat -tulnp
```

Sanitized/listening summary (from the session):

* `127.0.0.1:8000` — LISTEN
* `127.0.0.1:3000` — LISTEN
* `127.0.0.1:3306` — LISTEN
* `127.0.0.1:40193` — LISTEN
* `127.0.0.1:33060` — LISTEN
* `0.0.0.0:80` — LISTEN
* `:::22` — LISTEN

The notable internal‑only web service was on `127.0.0.1:8000`.

### 10) Port‑forward to access internal admin (`127.0.0.1:8000`)

From my attacker host I forwarded the target's localhost:8000 to my local port 8000:

```bash
ssh -L 8000:127.0.0.1:8000 enzo@TARGET_IP
# then open http://127.0.0.1:8000 locally
```

The internal UI was now reachable locally. Initial attempts with obvious credentials failed.

### 11) Found cron/backup configuration (`crontab.db`)

While enumerating files, I discovered `crontab.db`. Inspecting it revealed:

* A backup job entry named **Grafana backup**
* Schedule: `@daily`
* A password used by the backup process: `<BACKUP_PASSWORD_REDACTED>`
* A cleanup script invoked from the root directory (actions run as root)

This indicated the backup/cron job ran with root privileges and relied on a password recoverable from local configuration — a critical escalation vector.

### 12) Use backup/root credentials to access internal admin

Using the discovered backup/root credential, I authenticated to the internal admin UI on `127.0.0.1:8000` and obtained administrative access.

### 13) Achieve full root via setuid / cron technique

In the lab, after gaining admin/root access via the internal UI, I exercised a controlled escalation technique to obtain a persistent root shell:

**(Lab‑only action)**

```bash
# setuid on /bin/bash (lab environment only)
chmod u+s /bin/bash
```

Observed effect:

```text
ls -l /bin/bash
# -rwsr-xr-x root root /bin/bash
```

Running `bash -p` produced an interactive shell with effective root privileges. I then accessed `/root/root.txt` to confirm root.

> **Important:** setting the setuid bit on system binaries is destructive and dangerous. This action is included for lab‑chain completeness only and must never be reproduced on production systems.

---

## Impact

A remote compromise of an admin web console (Grafana) led to container shell access. Internal configuration and cron‑driven backups exposed credentials that enabled access to an internal admin UI and ultimately root via cron/web‑writable content. This chain results in complete host compromise and poses severe risk to confidentiality, integrity, and availability.

---

## Remediation (prioritized)

1. **Patch Grafana** to a version that addresses the reported SQL‑expression RCE. Apply vendor updates promptly.
2. **Avoid embedding secrets** in dashboards, environment variables, or web‑editable configuration. Use secret managers and environment isolation.
3. **Harden cron and backup scripts:** ensure cron scripts and backup inputs are owned by `root` and are not writable by web services. Use strict file permissions and input validation.
4. **Limit container privileges:** avoid mounting host‑sensitive resources (e.g., Docker socket) into application containers and minimize capabilities.
5. **Log and alert:** monitor changes to cron, setuid bits, and web‑writable locations; alert on unexpected admin‑UI access or authentication using internal service credentials.
6. **Network segmentation:** block administrative interfaces from untrusted networks and limit internal admin UIs to authenticated, secure channels.

---

## Appendix / Notes

* All artifacts and commands in this document are **sanitized** and were executed in an isolated, controlled lab environment.
* The writeup documents an actionable but preventable attack chain; it is presented for defensive awareness and remediation guidance only.
