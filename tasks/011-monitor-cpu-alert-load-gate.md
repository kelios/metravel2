# TASK-20260609-011: Stop monitor.sh CPU false-alert spam (gate CPU alert on sustained load)

Status: Backlog
Owner: Backend
Support: Developer, Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Stop the constant 🚨/✅ alert-recovery email spam from `monitor.sh` on the 1-core prod box
by making the CPU alert fire only on *sustained* load (run-queue > cores), not on momentary
100% CPU spikes. The fix is already applied to the LIVE server copy; this task is to land the
same fix in the repo and reconcile the two diverged versions.

## Context

Owner received ~29 alert/recovery emails ("System alert / System recovered on
server-dtwewu.localdomain") to `metraveldev@gmail.com`, flapping every 5–10 min. Investigated
2026-06-09:

- The trigger is **CPU, not memory**. A real alert body:
  ```
  Problems detected:
  CPU usage is high: 100% (threshold: 95%)
  Current metrics: CPU Usage: 100%  Memory Usage: 69%  Disk Alerts: none
  ...
  LOAD AVERAGE: load average: 0.77, 0.38, 0.32
  ```
  Memory (69%) is healthy; the user just saw the "Memory Usage" line and assumed memory.
- Root cause: on a **1-core** box `get_cpu_usage()` takes an instantaneous `mpstat 1 1`
  sample and catches a momentary 100% (gunicorn/postgres/**monitor's own curl probe**).
  `CPU_THRESHOLD=95` → ALERT, next run CPU idle → RECOVERED → endless flapping. Real load
  average was only 0.77 (no actual saturation).
- Objective data (metrics collector, 48 samples): system memory used 48–69% (avg 60%),
  swap ~0, no OOM, load1 max 1.86. So memory/disk are fine; only momentary CPU spikes flap.

**Version divergence discovered (must reconcile):**

- LIVE server `/home/sx3/monitor.sh` = 5519 bytes, newer hand-edited version with
  `get_cpu_usage()` / `build_alert_reasons()` / OK↔ALERT state machine. **This is the one that
  spammed, and it has ALREADY been patched on the live server** (backup:
  `/home/sx3/monitor.sh.bak-20260609`).
- Repo `metravel-backend/monitor.sh` = 2330 bytes, OLDER different implementation
  (`MPSTAT=$(mpstat 1 1 ...)`, `LOAD_FACTOR=1.2`, `LOAD_CRIT`). It is NOT the file running in
  prod. The repo copy and the deployed copy have diverged.

> Note: live `/home/sx3/monitor.sh` is OUTSIDE the backend repo path (`/home/sx3/metravel/`),
> so backend deploys do not overwrite it — the live fix is durable. This task is about keeping
> the repo as the source of truth and not regressing if someone re-copies the repo version.

### Applied fix (reference artifacts, outside repos)

- Patch: `D:\metravel\ops\monitor-cpu-loadgate.patch`
- Full patched file (the live version): `D:\metravel\ops\monitor.sh.server`

The change (against the 5519-byte server version):

```diff
@@ build_alert_reasons() @@
     local cpu="$1"
     local mem="$2"
     local disk_alerts="$3"
+    local load1="${4:-0}"
+    local cores="${5:-1}"
     local reasons=""

-    if (( cpu > CPU_THRESHOLD )); then
-        reasons+="CPU usage is high: ${cpu}% (threshold: ${CPU_THRESHOLD}%)\n"
+    # CPU: alert only if instantaneous CPU is high AND the 1-minute load average
+    # shows SUSTAINED saturation (run-queue > number of cores). On a 1-core box a
+    # momentary 100% spike (gunicorn/postgres/even monitor's own curl) is normal
+    # and must NOT trigger an alert — that was the source of the alert/recovery spam.
+    if (( cpu > CPU_THRESHOLD )) && awk "BEGIN{exit !($load1 > $cores)}"; then
+        reasons+="CPU sustained high: ${cpu}% inst, load1=${load1} on ${cores} core(s) (threshold: load1>${cores})\n"
     fi

@@ MAIN @@
 CPU_USAGE="$(get_cpu_usage)"
 MEM_USAGE="$(get_mem_usage)"
 DISK_ALERTS="$(get_disk_alerts)"
+LOAD1="$(awk '{print $1}' /proc/loadavg 2>/dev/null || echo 0)"
+CORES="$(nproc 2>/dev/null || echo 1)"

-ALERT_REASONS="$(build_alert_reasons "$CPU_USAGE" "$MEM_USAGE" "$DISK_ALERTS")"
+ALERT_REASONS="$(build_alert_reasons "$CPU_USAGE" "$MEM_USAGE" "$DISK_ALERTS" "$LOAD1" "$CORES")"
```

Source task:

- Source id:
- Source path: prod alert-spam investigation 2026-06-09 + Gmail alert sample + metrics collector

## Acceptance Criteria

- [ ] Decide the canonical `monitor.sh` (recommended: adopt the deployed 5519-byte version as
      source of truth) and commit it to `metravel-backend/monitor.sh` so repo == prod.
- [ ] The committed `monitor.sh` raises a CPU alert ONLY when instantaneous CPU > `CPU_THRESHOLD`
      AND `load1 > cores` (sustained saturation); a momentary 100% spike with low load1 does NOT alert.
- [ ] Memory and disk alert logic unchanged (memory still `used/total`, disk still per-mount > threshold).
- [ ] Verified on the box: `bash -n monitor.sh` passes; a manual run with low load leaves state `OK`
      and sends no mail; the OK↔ALERT state machine still works.
- [ ] Over 24h on prod, the `metraveldev@gmail.com` alert/recovery flapping stops (no CPU-spike emails
      while load average stays below the core count).
- [ ] If a deploy path copies the repo `monitor.sh` to `/home/sx3/monitor.sh`, the load-gate fix is
      preserved (don't regress to the old instantaneous-CPU spam).

## Gherkin Tests

```gherkin
Feature: monitor.sh does not spam alerts on momentary CPU spikes

  Scenario: Momentary 100% CPU on a 1-core box does not alert
    Given a 1-core server whose instantaneous CPU sample reads 100%
    And the 1-minute load average is 0.77 (below 1 core)
    When monitor.sh runs
    Then no CPU alert reason is produced and state stays OK
    And no alert email is sent

  Scenario: Sustained saturation still alerts
    Given the instantaneous CPU is above the threshold
    And the 1-minute load average exceeds the number of cores
    When monitor.sh runs
    Then a "CPU sustained high" alert is produced and an email is sent once (OK -> ALERT)

  Scenario: Memory and disk checks are unaffected
    Given memory usage is 69 percent and no disk is over threshold
    When monitor.sh runs
    Then no memory or disk alert reason is produced
```

## Assignment

Primary owner: Backend. Apply to `metravel-backend/monitor.sh` (reconcile with the deployed
5519-byte version), commit, and ensure the prod-deployed copy carries the load-gate. Live server
`/home/sx3/monitor.sh` is already patched (backup `monitor.sh.bak-20260609`); reference patch and
full file are in `D:\metravel\ops\` (`monitor-cpu-loadgate.patch`, `monitor.sh.server`).
