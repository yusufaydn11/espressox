/*
# FAZ 1 — Retail iyzico Payment Infrastructure
- payment_intents: server-side payment session tracking (amount from orders)
- webhook_events: idempotent iyzico webhook/callback audit log
- RLS: customers read own intents; no client writes
*/

-- ─── payment_intents ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_number text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_payment_id uuid REFERENCES order_payments(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'iyzico',
  amount numeric(10,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'TRY',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','initiated','threeds','authorized','paid','failed','cancelled')),
  conversation_id text NOT NULL,
  provider_payment_id text,
  session_token text UNIQUE,
  session_expires_at timestamptz,
  threeds_html text,
  failure_reason text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_intents_order ON payment_intents(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_order_number ON payment_intents(order_number);
CREATE INDEX IF NOT EXISTS idx_payment_intents_user ON payment_intents(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_provider_payment ON payment_intents(provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_intents_session ON payment_intents(session_token)
  WHERE session_token IS NOT NULL;

ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_intents_select_own" ON payment_intents;
CREATE POLICY "payment_intents_select_own" ON payment_intents
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "payment_intents_select_internal" ON payment_intents;
CREATE POLICY "payment_intents_select_internal" ON payment_intents
  FOR SELECT TO authenticated
  USING (is_internal());

-- ─── webhook_events ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'iyzico',
  event_type text,
  provider_event_id text NOT NULL,
  provider_payment_id text,
  payment_intent_id uuid REFERENCES payment_intents(id) ON DELETE SET NULL,
  order_number text,
  payload jsonb NOT NULL DEFAULT '{}',
  signature_valid boolean,
  processed boolean NOT NULL DEFAULT false,
  process_result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_payment_intent ON webhook_events(payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_order_number ON webhook_events(order_number)
  WHERE order_number IS NOT NULL;

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webhook_events_select_internal" ON webhook_events;
CREATE POLICY "webhook_events_select_internal" ON webhook_events
  FOR SELECT TO authenticated
  USING (is_internal());

-- ─── updated_at trigger ──────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS tr_payment_intents_updated ON payment_intents;
CREATE TRIGGER tr_payment_intents_updated
  BEFORE UPDATE ON payment_intents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
