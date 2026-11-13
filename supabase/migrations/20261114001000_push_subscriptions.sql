-- =============================================================================
-- Phone notifications (D-351, D-358).
--
-- push_subscriptions: one browser install of a soldier that agreed to phone notifications. Device data:
-- never exported, deleted (not archived) on unsubscribe, on the loss of the soldier's link or archive,
-- and when the push service answers that it no longer knows the endpoint. Only the command gateway
-- reads or writes it (D-203).
--
-- The new preference keys (updates_seen_at, notifications) need no change: missing keys read as defaults.
--
-- Non-destructive.
-- =============================================================================

CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
  "soldier_id" UUID NOT NULL REFERENCES "soldiers"("id"),
  "endpoint" VARCHAR(2048) NOT NULL,
  "p256dh" VARCHAR(200) NOT NULL,
  "auth" VARCHAR(100) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY("id"),
  CONSTRAINT "push_subscriptions_endpoint_key" UNIQUE ("endpoint")
);
CREATE INDEX IF NOT EXISTS "idx_push_subscriptions_soldier" ON "push_subscriptions"("soldier_id");

ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "push_subscriptions" FROM anon, authenticated;
