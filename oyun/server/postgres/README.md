# PostgreSQL production target

The executable U4.3 acceptance repository uses SQLite/WAL so restart, crash, unique-ledger and transaction semantics can be tested without an external service. SQLite is not the million-user production database.

`001_authority_schema.sql` is the production storage contract. Deployment must create actor-hash partitions, use a connection pool, run each command under one transaction with `SELECT ... FOR UPDATE` or equivalent CAS, and publish the event outbox with `FOR UPDATE SKIP LOCKED`. Multi-region active/active routing is not claimed in U4.3.
