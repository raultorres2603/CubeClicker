# Build log — T2 — Migration 006 + schema mirror

Task: T2 (2026-11-08)
Files changed: `src/backend/src/db/migrations/006_granular_spaceship_parts.sql`, `src/backend/src/db/schema.sql`, `src/backend/src/db/migrate.test.ts`, `src/backend/src/db/migration-006.test.ts`, `docs/features/spaceship-cursor-loot-animations/build-log-T2.md`

What changed & why:
- Added migration 006: `customization_version INT NOT NULL DEFAULT 1` → backfill all rows to `2` → `SET DEFAULT 2`, mirrored in `schema.sql` with `DEFAULT 2`.
- Rewrote legacy appearance **keys and values** (`body→hull`, `wings→wing-left`+`wing-right`, `engine→ignition-left`+`ignition-right`, nose/cockpit retained) through one `jsonb_strip_nulls(jsonb_build_object(...))` update.
- Rewrote `parts` with a CTE: legacy keys expand to one/two v2 keys, `^[0-9]+$` + `BETWEEN 0 AND 2147483647` bound counts, non-numeric/negative/fractional/overflow values are skipped, collisions summed.
- Added `migration-006.test.ts`: static statement/schema contract plus a real PostgreSQL suite (exact AC-33 fixture, overflow skip, collision sum, version/default, idempotent re-run) that starts a throwaway `postgres:16-alpine` via Podman/Docker; 006 loading/order asserted in `migrate.test.ts`.
- Recorded the pre-006 `pg_dump`, fingerprint, restore/re-apply and schema-mirror run below.

Decisions:
- The parts rewrite matches the **exact legacy id set** (`body-*` 3 ids, `wings-*` 2 ids, `engine-default|blue`) instead of a broad `LIKE 'engine-%'`: v2 `engine-left-*`/`engine-right-*` ids also start with `engine-` and would otherwise be corrupted on re-run.
- Appearance values are rewritten from the canonical slot value when present, else the legacy alias (`COALESCE(appearance->'hull', appearance->'body')` etc.), so canonical v2 keys win and a re-run is a no-op.
- Count regex runs before the numeric cast (`CASE WHEN p.value ~ '^[0-9]+$' THEN p.value::numeric END`), avoiding cast errors on non-numeric JSONB text.
- `migration-006.test.ts` is the integration tier: it exercises real JSONB/CTE semantics against PostgreSQL 16. It auto-detects Podman or Docker and skips the DB suite only when neither runtime is available; CI's `verify-app` job has Docker, and this build ran the suite unskipped against `docker.io/library/postgres:16-alpine` (same image as `compose.yaml`).
- The static suite always runs, pinning file loading, statement shape, bounds/defaults and the `schema.sql` mirror, so a regression still fails without a container runtime.

Evidence (raw):

## npm run lint

```
$ npm run lint

> lint
> eslint .

```
(exit 0, no findings)

## npm run typecheck --workspace @cubeclicker/backend

```
$ npm run typecheck --workspace @cubeclicker/backend

> typecheck
> tsc --noEmit

```
(exit 0, no diagnostics)

## npm test --workspace @cubeclicker/backend

```
$ npm test --workspace @cubeclicker/backend

> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/auth/rate-limit.test.ts (16 tests) 5ms
 ✓ src/auth/verification-token-repository.test.ts (44 tests) 10ms
 ✓ src/game/config.test.ts (13 tests) 6ms
 ✓ src/auth/user-repository.test.ts (40 tests) 10ms
 ✓ src/game/parts.test.ts (19 tests) 10ms
 ✓ src/auth/config.test.ts (25 tests) 10ms
 ✓ src/game/upgrades.test.ts (20 tests) 6ms
 ✓ src/db/pool.test.ts (10 tests) 7ms
 ✓ src/game/economy.test.ts (20 tests) 5ms
 ✓ src/game/cubes.test.ts (24 tests) 13ms
 ✓ src/db/migrate.test.ts (11 tests) 8ms
 ✓ src/game/servers.test.ts (38 tests) 13ms
 ✓ src/auth/session-repository.test.ts (35 tests) 18ms
 ✓ src/game/parts-v2.test.ts (40 tests) 17ms
 ✓ src/auth/economy-repository.test.ts (69 tests) 22ms
 ✓ src/game/players.test.ts (13 tests) 12ms
 ✓ src/auth/email.test.ts (12 tests) 12ms
 ✓ src/game/hub.test.ts (78 tests) 76ms
 ✓ src/game/protocol.test.ts (166 tests) 17ms
 ✓ src/auth/password.test.ts (17 tests) 281ms
 ✓ src/auth/auth-routes.test.ts (25 tests) 641ms
 ✓ src/auth/auth-service.test.ts (50 tests) 859ms
 ✓ src/app.test.ts (20 tests) 1470ms
   ✓ GET /ws > packs three servers after each completion over live sockets (X = 2, AC-10, F3)  1037ms
 ✓ src/db/migration-006.test.ts (13 tests) 2257ms

 Test Files  24 passed (24)
      Tests  818 passed (818)
   Start at  19:03:36
   Duration  2.85s (transform 2.21s, setup 0ms, collect 5.21s, tests 5.79s, environment 4ms, prepare 1.83s)
```
(exit 0; `migration-006.test.ts` ran 5 static + 8 PostgreSQL tests, unskipped)

## npm run coverage --workspace @cubeclicker/backend

```
$ npm run coverage --workspace @cubeclicker/backend

> coverage
> vitest run --coverage

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
      Coverage enabled with v8

 ✓ src/game/config.test.ts (13 tests) 7ms
 ✓ src/auth/config.test.ts (25 tests) 10ms
 ✓ src/auth/user-repository.test.ts (40 tests) 15ms
 ✓ src/game/cubes.test.ts (24 tests) 14ms
 ✓ src/game/parts.test.ts (19 tests) 9ms
 ✓ src/game/economy.test.ts (20 tests) 5ms
 ✓ src/auth/rate-limit.test.ts (16 tests) 5ms
 ✓ src/db/pool.test.ts (10 tests) 6ms
 ✓ src/game/upgrades.test.ts (20 tests) 9ms
 ✓ src/auth/session-repository.test.ts (35 tests) 16ms
 ✓ src/auth/verification-token-repository.test.ts (44 tests) 21ms
 ✓ src/db/migrate.test.ts (11 tests) 14ms
 ✓ src/game/servers.test.ts (38 tests) 8ms
 ✓ src/game/parts-v2.test.ts (40 tests) 22ms
 ✓ src/game/players.test.ts (13 tests) 11ms
 ✓ src/auth/economy-repository.test.ts (69 tests) 26ms
 ✓ src/auth/email.test.ts (12 tests) 13ms
 ✓ src/game/hub.test.ts (78 tests) 104ms
 ✓ src/game/protocol.test.ts (166 tests) 20ms
 ✓ src/auth/password.test.ts (17 tests) 314ms
 ✓ src/auth/auth-routes.test.ts (25 tests) 648ms
 ✓ src/auth/auth-service.test.ts (50 tests) 883ms
 ✓ src/app.test.ts (20 tests) 1487ms
   ✓ GET /ws > packs three servers after each completion over live sockets (X = 2, AC-10, F3)  1041ms
 ✓ src/db/migration-006.test.ts (13 tests) 1978ms

 Test Files  24 passed (24)
      Tests  818 passed (818)
   Start at  19:03:39
   Duration  2.72s (transform 2.17s, setup 0ms, collect 5.76s, tests 5.64s, environment 5ms, prepare 2.00s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   94.73 |    87.02 |   99.69 |   94.73 |                   
 src               |   80.54 |    84.44 |     100 |   80.54 |                   
  app.ts           |   80.54 |    84.44 |     100 |   80.54 | ...46,159,226-243 
 src/auth          |   94.42 |    80.15 |     100 |   94.42 |                   
  auth-routes.ts   |      80 |    47.54 |     100 |      80 | ...45-347,353-354 
  auth-service.ts  |     100 |    80.53 |     100 |     100 | ...95,400,417,503 
  config.ts        |     100 |      100 |     100 |     100 |                   
  ...repository.ts |   90.27 |    79.61 |     100 |   90.27 | ...85-586,642-655 
  email.ts         |     100 |      100 |     100 |     100 |                   
  password.ts      |     100 |      100 |     100 |     100 |                   
  rate-limit.ts    |     100 |      100 |     100 |     100 |                   
  ...repository.ts |   96.53 |    85.48 |     100 |   96.53 | ...40-141,146-147 
  ...repository.ts |    98.8 |    90.58 |     100 |   98.8 | 61-62,315         
  ...repository.ts |   97.29 |    91.57 |     100 |   97.29 | 63-68             
 src/db            |     100 |      100 |     100 |     100 |                   
  migrate.ts       |     100 |      100 |     100 |     100 |                   
  pool.ts          |     100 |      100 |     100 |     100 |                   
 src/game          |   96.37 |    95.12 |   99.23 |   96.37 |                   
  config.ts        |     100 |      100 |     100 |     100 |                   
  cubes.ts         |     100 |      100 |     100 |     100 |                   
  economy.ts       |     100 |      100 |     100 |     100 |                   
  hub.ts           |   92.21 |     89.6 |     100 |   92.21 | ...91-892,895-896 
  parts-v2.ts      |     100 |      100 |     100 |     100 |                   
  parts.ts         |     100 |      100 |     100 |     100 |                   
  players.ts       |     100 |      100 |     100 |     100 |                   
  protocol.ts      |   98.79 |    98.43 |   96.55 |   98.79 | 233-234,548-549   
  servers.ts       |     100 |      100 |     100 |     100 |                   
  upgrades.ts      |   94.44 |    93.33 |     100 |   94.44 | 41-42             
-------------------|---------|----------|---------|---------|-------------------
```
(exit 0; thresholds 80/80/80/80 green on all four metrics)

## Focused migration test

```
$ npx vitest run src/db/migration-006.test.ts src/db/migrate.test.ts

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/db/migrate.test.ts (11 tests) 7ms
 ✓ src/db/migration-006.test.ts (13 tests) 2261ms

 Test Files  2 passed (2)
      Tests  24 passed (24)
   Start at  19:03:21
   Duration  2.67s (transform 66ms, setup 0ms, collect 236ms, tests 2.27s, environment 0ms, prepare 113ms)
```

## Pre-migration pg_dump (AC-14/AC-15/F24/T14 acceptance evidence)

Command:

```
podman run -d --rm --name cc-t2-dump \
  -e POSTGRES_USER=cubeclicker -e POSTGRES_PASSWORD=cubeclicker \
  -e POSTGRES_DB=cubeclicker -p 127.0.0.1:55434:5432 \
  docker.io/library/postgres:16-alpine

# applied 001–005 (in order) and seeded the AC-33 fixture + overflow row, then:
podman exec cc-t2-dump pg_dump -U cubeclicker -d cubeclicker \
  --no-owner --no-privileges > /tmp/opencode/cubeclicker-t2/pre-006.sql
```

Output metadata:

```
pg_dump exit=0
 243 7077 /tmp/opencode/cubeclicker-t2/pre-006.sql
b1e9d30f03dc208f6153311513544ca538f68412169b7054914fa2101069d5ab  /tmp/opencode/cubeclicker-t2/pre-006.sql
```

Full dump:

```sql
--
-- PostgreSQL database dump
--

\restrict szZRepN1aXxY8d7MWBcluYHOaVraygbMyfgeNMDGdf6R2VW1aB4byhMqKcJ0Lh3

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    name text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_economy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_economy (
    user_id uuid NOT NULL,
    coins numeric(18,2) DEFAULT 0 NOT NULL,
    clicks bigint DEFAULT 0 NOT NULL,
    faces_destroyed bigint DEFAULT 0 NOT NULL,
    cubes_destroyed bigint DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    upgrades jsonb DEFAULT '{}'::jsonb NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    lootboxes integer DEFAULT 0 NOT NULL,
    keys integer DEFAULT 0 NOT NULL,
    parts jsonb DEFAULT '{}'::jsonb NOT NULL,
    appearance jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    username text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    verified boolean DEFAULT false NOT NULL,
    failed_login_attempts integer DEFAULT 0 NOT NULL,
    locked_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: verification_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.schema_migrations (name, applied_at) FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sessions (id, user_id, token_hash, expires_at, created_at, last_seen_at) FROM stdin;
\.


--
-- Data for Name: user_economy; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_economy (user_id, coins, clicks, faces_destroyed, cubes_destroyed, updated_at, upgrades, last_seen_at, lootboxes, keys, parts, appearance) FROM stdin;
20000000-0000-4000-8000-000000000001	42.50	7	3	2	2026-11-08 18:01:48.727534+00	{"mini_cube_value": 1}	2026-11-08 18:01:48.727534+00	3	1	{"body-gold": 1, "engine-blue": 1, "wings-silver": 2}	{"body": "body-gold", "wings": "wings-silver", "engine": "engine-blue"}
20000000-0000-4000-8000-000000000002	0.00	0	0	0	2026-11-08 18:01:48.727534+00	{}	2026-11-08 18:01:48.727534+00	0	0	{"body-gold": 3, "engine-blue": "abc", "nose-crimson": 2147483647, "wings-silver": 99999999999}	{}
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, username, email, password_hash, verified, failed_login_attempts, locked_until, created_at, updated_at) FROM stdin;
20000000-0000-4000-8000-000000000001	acct-fixture	fixture@example.test	hash	f	0	\N	2026-11-08 18:01:48.726117+00	2026-11-08 18:01:48.726117+00
20000000-0000-4000-8000-000000000002	acct-overflow	overflow@example.test	hash	f	0	\N	2026-11-08 18:01:48.726117+00	2026-11-08 18:01:48.726117+00
\.


--
-- Data for Name: verification_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.verification_tokens (id, user_id, token_hash, expires_at, used_at, created_at) FROM stdin;
\.


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (name);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_token_hash_key UNIQUE (token_hash);


--
-- Name: user_economy user_economy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_economy
    ADD CONSTRAINT user_economy_pkey PRIMARY KEY (user_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: verification_tokens verification_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_tokens
    ADD CONSTRAINT verification_tokens_pkey PRIMARY KEY (id);


--
-- Name: verification_tokens verification_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_tokens
    ADD CONSTRAINT verification_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: users_email_lower_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_lower_uq ON public.users USING btree (lower(email));


--
-- Name: users_username_lower_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_username_lower_uq ON public.users USING btree (lower(username));


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_economy user_economy_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_economy
    ADD CONSTRAINT user_economy_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: verification_tokens verification_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_tokens
    ADD CONSTRAINT verification_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict szZRepN1aXxY8d7MWBcluYHOaVraygbMyfgeNMDGdf6R2VW1aB4byhMqKcJ0Lh3
```

## Apply 006 to the dumped database (psql)

```
$ podman exec -i cc-t2-dump psql -U cubeclicker -d cubeclicker -v ON_ERROR_STOP=1 \
    < src/backend/src/db/migrations/006_granular_spaceship_parts.sql
ALTER TABLE
UPDATE 2
UPDATE 2
UPDATE 2
ALTER TABLE

$ podman exec cc-t2-dump psql -U cubeclicker -d cubeclicker -At -c \
    "SELECT user_id, parts::text, appearance::text, customization_version FROM user_economy ORDER BY user_id"
20000000-0000-4000-8000-000000000001|{"hull-gold": 1, "wing-left-silver": 2, "wing-right-silver": 2, "ignition-left-blue": 1, "ignition-right-blue": 1}|{"hull": "hull-gold", "wing-left": "wing-left-silver", "wing-right": "wing-right-silver", "ignition-left": "ignition-left-blue", "ignition-right": "ignition-right-blue"}|2
20000000-0000-4000-8000-000000000002|{"hull-gold": 3, "nose-crimson": 2147483647}|{}|2

$ podman exec cc-t2-dump psql -U cubeclicker -d cubeclicker -At -c \
    "SELECT data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name='user_economy' AND column_name='customization_version'"
integer|NO|2
```

Idempotent re-run of the same SQL:

```
$ podman exec -i cc-t2-dump psql -U cubeclicker -d cubeclicker -v ON_ERROR_STOP=1 \
    < src/backend/src/db/migrations/006_granular_spaceship_parts.sql
NOTICE:  column "customization_version" of relation "user_economy" already exists, skipping
ALTER TABLE
UPDATE 2
UPDATE 2
UPDATE 0
ALTER TABLE

$ podman exec cc-t2-dump psql -U cubeclicker -d cubeclicker -At -c \
    "SELECT user_id, parts::text, appearance::text, customization_version FROM user_economy ORDER BY user_id"
20000000-0000-4000-8000-000000000001|{"hull-gold": 1, "wing-left-silver": 2, "wing-right-silver": 2, "ignition-left-blue": 1, "ignition-right-blue": 1}|{"hull": "hull-gold", "wing-left": "wing-left-silver", "wing-right": "wing-right-silver", "ignition-left": "ignition-left-blue", "ignition-right": "ignition-right-blue"}|2
20000000-0000-4000-8000-000000000002|{"hull-gold": 3, "nose-crimson": 2147483647}|{}|2
```

## Restore command (recorded for T14/rollback)

Command:

```
podman exec cc-t2-dump dropdb -U cubeclicker --if-exists cubeclicker_restore
podman exec cc-t2-dump createdb -U cubeclicker cubeclicker_restore
podman exec -i cc-t2-dump psql -U cubeclicker -d cubeclicker_restore -v ON_ERROR_STOP=1 \
  < /tmp/opencode/cubeclicker-t2/pre-006.sql
```

Output:

```
restore exit=0
CREATE INDEX
CREATE INDEX
ALTER TABLE
ALTER TABLE
ALTER TABLE

$ podman exec cc-t2-dump psql -U cubeclicker -d cubeclicker_restore -At -c \
    "SELECT user_id, parts::text, appearance::text FROM user_economy ORDER BY user_id"
20000000-0000-4000-8000-000000000001|{"body-gold": 1, "engine-blue": 1, "wings-silver": 2}|{"body": "body-gold", "wings": "wings-silver", "engine": "engine-blue"}
20000000-0000-4000-8000-000000000002|{"body-gold": 3, "engine-blue": "abc", "nose-crimson": 2147483647, "wings-silver": 99999999999}|{}

$ podman exec cc-t2-dump psql -U cubeclicker -d cubeclicker_restore -At -c \
    "SELECT count(*) FROM information_schema.columns WHERE table_name='user_economy' AND column_name='customization_version'"
0
```

Applying 006 to the restored database:

```
$ podman exec -i cc-t2-dump psql -U cubeclicker -d cubeclicker_restore -v ON_ERROR_STOP=1 \
    < src/backend/src/db/migrations/006_granular_spaceship_parts.sql
ALTER TABLE
UPDATE 2
UPDATE 2
UPDATE 2
ALTER TABLE

$ podman exec cc-t2-dump psql -U cubeclicker -d cubeclicker_restore -At -c \
    "SELECT user_id, parts::text, appearance::text, customization_version FROM user_economy ORDER BY user_id"
20000000-0000-4000-8000-000000000001|{"hull-gold": 1, "wing-left-silver": 2, "wing-right-silver": 2, "ignition-left-blue": 1, "ignition-right-blue": 1}|{"hull": "hull-gold", "wing-left": "wing-left-silver", "wing-right": "wing-right-silver", "ignition-left": "ignition-left-blue", "ignition-right": "ignition-right-blue"}|2
20000000-0000-4000-8000-000000000002|{"hull-gold": 3, "nose-crimson": 2147483647}|{}|2
```

## schema.sql mirror applies cleanly (fresh database)

```
$ podman exec cc-t2-dump createdb -U cubeclicker cubeclicker_schema
$ podman exec -i cc-t2-dump psql -U cubeclicker -d cubeclicker_schema -v ON_ERROR_STOP=1 \
    < src/backend/src/db/schema.sql
schema.sql exit=0

$ podman exec cc-t2-dump psql -U cubeclicker -d cubeclicker_schema -At -c \
    "SELECT data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name='user_economy' AND column_name='customization_version'"
integer|NO|2

$ podman exec -i cc-t2-dump psql -U cubeclicker -d cubeclicker_schema -v ON_ERROR_STOP=1 \
    < src/backend/src/db/migrations/006_granular_spaceship_parts.sql
NOTICE:  column "customization_version" of relation "user_economy" already exists, skipping
ALTER TABLE
UPDATE 0
UPDATE 0
UPDATE 0
ALTER TABLE

$ podman exec cc-t2-dump psql -U cubeclicker -d cubeclicker_schema -At -c \
    "SELECT data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name='user_economy' AND column_name='customization_version'"
integer|NO|2
```

Container cleaned up after validation: `podman rm -f cc-t2-dump` (no containers left; the test suite also removes its throwaway container in `afterAll`).

Acceptance audit:
- AC-14 → met: migration adds `customization_version INT NOT NULL DEFAULT 1`, backfills to `2`, sets `DEFAULT 2`; `schema.sql` mirrors `DEFAULT 2`; idempotent `ADD COLUMN IF NOT EXISTS` and data rewrite; startup runner unchanged and covered by `migrate.test.ts`. Evidence: migration/schema files, static statements, live PostgreSQL column metadata `integer|NO|2`, fresh `schema.sql` run and idempotent re-apply above.
- AC-15 → met: exact legacy key/value rewrite (`body-*`→`hull-*`, both `wing-*`, both `ignition-*`, nose/cockpit retained), non-numeric/overflow skipped (`2147483648`, `-1`, `1.5`, `"abc"`, `99999999999` dropped), collisions summed (`wing-left-silver 2+5=7`, `hull-gold 1+2=3`, `ignition-right-blue 1+4=5`), every row version 2, re-run changes nothing. Evidence: `migration-006.test.ts` PostgreSQL suite + psql outputs above.
- AC-33 (migration portion) → met: exact fixture `parts={"wings-silver":2,"engine-blue":1,"body-gold":1}` / `appearance={"wings":"wings-silver","engine":"engine-blue","body":"body-gold"}` becomes `parts={"hull-gold":1,"wing-left-silver":2,"wing-right-silver":2,"ignition-left-blue":1,"ignition-right-blue":1}`, `appearance={"hull":"hull-gold","wing-left":"wing-left-silver","wing-right":"wing-right-silver","ignition-left":"ignition-left-blue","ignition-right":"ignition-right-blue"}`, version 2. Full account join/read end-to-end is T4/T5/T14 by design.

Deviations from spec: none. The only environment note is the graceful DB-suite skip when neither Podman nor Docker is available; this build ran unskipped, and CI's `verify-app` runner has Docker.
