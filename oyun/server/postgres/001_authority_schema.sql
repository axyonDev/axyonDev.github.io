BEGIN;
CREATE TABLE IF NOT EXISTS authority_actors (
  actor_id text PRIMARY KEY,
  revision bigint NOT NULL CHECK (revision >= 0),
  state_json jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS authority_command_ledger (
  actor_id text NOT NULL,
  command_id text NOT NULL,
  fingerprint text NOT NULL,
  receipt_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_id, command_id)
) PARTITION BY HASH (actor_id);
CREATE TABLE IF NOT EXISTS authority_sequence_ledger (
  actor_id text NOT NULL,
  source_id text NOT NULL,
  sequence bigint NOT NULL CHECK (sequence > 0),
  command_id text NOT NULL,
  fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_id, source_id, sequence)
) PARTITION BY HASH (actor_id);
CREATE TABLE IF NOT EXISTS authority_event_outbox (
  event_id uuid PRIMARY KEY,
  actor_id text NOT NULL,
  command_id text NOT NULL,
  event_type text NOT NULL,
  server_revision bigint NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','publishing','published','dead_letter')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  UNIQUE(actor_id, command_id, event_type)
);
CREATE INDEX IF NOT EXISTS authority_event_outbox_pending_idx ON authority_event_outbox(status,next_attempt_at,created_at) WHERE status IN ('pending','publishing');
COMMIT;
-- Production command transaction must use SELECT ... FOR UPDATE on authority_actors,
-- insert the command/sequence claims, CAS-update the actor revision and insert outbox
-- in one database transaction. Create hash partitions per deployment shard before launch.
