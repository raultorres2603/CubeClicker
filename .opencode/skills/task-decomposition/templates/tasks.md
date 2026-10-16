# Tasks — <Feature name>

Dependency overview: T1 → T2 → T4; T3 ∥ T4 (both after T1)

## T1 — <title> `[seq]`
depends_on: —
files_owned: <paths>
verify: `<cmd1>`, `<cmd2>`
acceptance: AC-1
status: [ ]

## T2 — <title> `[P]`
depends_on: T1
files_owned: <paths>
verify: `<cmd>`
acceptance: AC-2
status: [ ]
