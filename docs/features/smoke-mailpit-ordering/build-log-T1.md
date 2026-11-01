# Build Log — T1: Add Mailpit to smoke depends_on

## Changes
- `compose.smoke.yaml`: converted `smoke.depends_on` to long form and added `mailpit` with `condition: service_started` (backend/frontend retained as `service_started`).

## Verify

### `podman compose -f compose.yaml -f compose.smoke.yaml config` (exit 0)
```
EXIT=0
```
(stderr only contained the podman-compose external provider notice.)

### `grep -n "mailpit" compose.smoke.yaml`
```
27:      mailpit:
```

### merged config `smoke.depends_on`
```
      backend:
        condition: service_started
        required: true
      frontend:
        condition: service_started
        required: true
      mailpit:
        condition: service_started
        required: true
```