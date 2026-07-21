# DA-RISK-005 database verification

Run these checks only against an isolated test database. Never run destructive import, reset, or restore tests against production.

## Automated core integrity check

Run:

```bash
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f database/tests/integrity_test_cases.sql
```

Expected result:

- PostgreSQL prints `DA-RISK-005 core integrity checks passed`.
- The script ends with `ROLLBACK`.
- No test member, project, or task remains in the database.

The SQL file covers valid create/update, duplicate rejection, invalid FK rejection, orphan detection, numeric rounding, timezone equivalence, and project soft-delete fields.

## Manual checks required before release

### Import transaction

1. Back up the isolated database.
2. Import a file containing one valid row, one duplicate row, and one invalid FK.
3. Verify the documented policy: either the whole import rolls back or rejected rows are reported explicitly.
4. Confirm no silent partial import.

### Restore and reset

1. Record row counts and checksums before backup.
2. Restore into a new empty database.
3. Compare row counts, FK/orphan queries, and sequence next values.
4. Run reset only on the disposable database and verify audit records.

### Concurrent update

1. Open two independent database/API sessions.
2. Both read the same record and `updated_at`.
3. Session A updates and commits.
4. Session B submits its stale update.
5. Session B must receive a conflict or use an explicit documented last-write-wins policy.

### Audit and secret masking

Verify create, update, archive, import, restore, and reset record actor, timestamp, action, and object ID. Logs, exports, backups, and API responses must not expose password hashes, JWTs, database URLs, API keys, or Slack secrets.

### RBAC and IDOR

Use at least one manager and one specialist test account. For every read/write endpoint, replace the object ID with an object owned by another user. The backend must reject actions outside the authenticated user's permission scope.

## Release gate

Keep DA-RISK-005 open until the automated SQL check and every manual check above have recorded evidence. Test data must never be added to production to close this risk.
