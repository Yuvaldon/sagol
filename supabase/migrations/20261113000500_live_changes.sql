-- =============================================================================
-- Live changes (D-348, OI-151).
-- After a write commits, the command gateway sends one Realtime broadcast to the
-- private topic named by the organization's id: the names of the tables it changed,
-- never a row or an id. A client hears that topic only while its identity holds a
-- live soldier account in that organization, the same rule as a linked session (D-008).
-- No table is opened to the API roles (D-203): the membership check is one function,
-- outside `public`, that reads the accounts as its owner and answers a boolean.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS "live";
REVOKE ALL ON SCHEMA "live" FROM PUBLIC;
GRANT USAGE ON SCHEMA "live" TO authenticated;

-- True when the caller's identity holds a live account in the organization the topic names.
CREATE OR REPLACE FUNCTION "live"."hears"(topic text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.soldier_accounts a
    WHERE a.auth_user_id = auth.uid() AND a.revoked_at IS NULL AND a.organization_id::text = topic
  )
$$;
REVOKE ALL ON FUNCTION "live"."hears"(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "live"."hears"(text) TO authenticated;

-- Realtime asks this policy when a client joins a private channel. Clients only listen:
-- no INSERT policy, so no client sends on a topic; only the gateway does, as the owner.
DROP POLICY IF EXISTS "members hear their organization" ON realtime.messages;
CREATE POLICY "members hear their organization" ON realtime.messages
  FOR SELECT TO authenticated
  USING (realtime.messages.extension = 'broadcast' AND "live"."hears"(realtime.topic()));
