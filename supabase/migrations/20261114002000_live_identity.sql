-- =============================================================================
-- An identity's own topic (D-437, OI-299).
-- A requester whose account link waits for review has no organization to hear, so
-- the answer to their request reached them only on reload. The gateway now also
-- announces, on the private topic `identity:<auth user id>`, the tables of the rows
-- it wrote that carry that identity (`account_link_requests`, `soldier_accounts`):
-- table names only, as on the organization's topic (D-348). Each identity hears its
-- own topic and no other; the prefix is `REMOTE.identityTopicPrefix` in config.
-- The policy is unchanged: it already asks this function.
-- =============================================================================

CREATE OR REPLACE FUNCTION "live"."hears"(topic text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(topic = 'identity:' || auth.uid()::text, false) OR EXISTS (
    SELECT 1 FROM public.soldier_accounts a
    WHERE a.auth_user_id = auth.uid() AND a.revoked_at IS NULL AND a.organization_id::text = topic
  )
$$;
REVOKE ALL ON FUNCTION "live"."hears"(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "live"."hears"(text) TO authenticated;
