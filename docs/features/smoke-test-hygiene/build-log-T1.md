# Build log — T1 (smoke-test-hygiene)

## Change
- `compose.smoke.yaml`: appended exactly one trailing newline to the end of the file. No other bytes modified.

## Verify

### `tail -c 2 compose.smoke.yaml | od -c` (AC-1)
```
$ tail -c 2 compose.smoke.yaml | od -c
0000000   d  \n
0000002
```
Final byte is `\n`; preceding byte is `d` (not `\n`) — exactly one trailing newline.

### `git diff -- compose.smoke.yaml` (AC-2)
```
diff --git a/compose.smoke.yaml b/compose.smoke.yaml
index 1460ad6..3faef2b 100644
--- a/compose.smoke.yaml
+++ b/compose.smoke.yaml
@@ -25,4 +25,4 @@ services:
       frontend:
         condition: service_started
       mailpit:
-        condition: service_started
\ No newline at end of file
+        condition: service_started
```
Only the missing trailing newline is added; no other bytes changed.

### `podman compose -f compose.yaml -f compose.smoke.yaml config` (AC-7)
```
$ podman compose -f compose.yaml -f compose.smoke.yaml config
exit=0
```
(stderr only contained the podman-compose external provider notice.)

## Status
completed
